// Only load dotenv in development – in production the module may not
// be resolvable inside the ASAR bundle and there is no .env file anyway.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  dotenv.config();
} catch {
  // Running in packaged app – dotenv not available, which is expected.
}
import { app, BrowserWindow, ipcMain, protocol, shell, dialog } from 'electron';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { FileService } from './services/FileService';
import { ProjectService } from './services/ProjectService';
import { SettingsService } from './services/SettingsService';
import { CompileOrchestrator } from './services/CompileOrchestrator';
import { AutoCompileService } from './services/AutoCompileService';
import { SnapshotService } from './services/SnapshotService';
import { TemplateService } from './services/TemplateService';
import { SnippetService } from './services/SnippetService';
import { BibTeXService } from './services/BibTeXService';
import { FirstRunService } from './services/FirstRunService';
import { SyncTexService } from './services/SyncTexService';
import GitService from './services/GitService';
import GitHubServiceInstance from './services/GitHubService';

// GitHubService is now imported directly (no more lazy loading race)

class App {
  private mainWindow: BrowserWindow | null = null;
  private rendererRecoveryAttempts = 0;
  private unresponsiveTimer: NodeJS.Timeout | null = null;
  private fileService: FileService;
  private projectService: ProjectService;
  private settingsService: SettingsService;
  private compileOrchestrator: CompileOrchestrator;
  private autoCompileService: AutoCompileService;
  private snapshotService: SnapshotService;
  private templateService: TemplateService;
  private snippetService: SnippetService;
  private bibTexService: BibTeXService;
  private firstRunService: FirstRunService;
  private syncTexService: SyncTexService;

  constructor() {
    this.projectService = new ProjectService();
    this.settingsService = new SettingsService();
    this.firstRunService = new FirstRunService(this.settingsService);
    this.compileOrchestrator = new CompileOrchestrator();
    this.autoCompileService = new AutoCompileService(this.compileOrchestrator, this.settingsService);
    this.fileService = new FileService(this.autoCompileService);
    this.snapshotService = new SnapshotService(this.projectService);
    this.templateService = new TemplateService();
    this.snippetService = new SnippetService();
    this.bibTexService = new BibTeXService();
    this.syncTexService = new SyncTexService((binaryName: string) => this.settingsService.getTexBinaryPath(binaryName));
  }

  async initialize() {
    await app.whenReady();
    
    // Create window first for faster perceived startup
    this.createWindow();
    this.setupProtocolHandlers();
    
    // Show loading state immediately
    if (this.mainWindow) {
      this.mainWindow.webContents.once('did-finish-load', () => {
        this.mainWindow!.webContents.send('app-initializing', { stage: 'services' });
      });
    }
    
    // Initialize services in background
    this.initializeServicesAsync();
    this.setupIPC();
  }

  private async initializeServicesAsync() {
    try {
      // Initialize core services first (fast)
      await this.projectService.initialize();
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('app-initializing', { stage: 'settings' });
      }
      
      // Initialize settings (potentially slow due to TeX detection)
      await this.settingsService.initialize();
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('app-initializing', { stage: 'templates' });
      }
      
      // Initialize other services in parallel
      await Promise.all([
        this.templateService.initialize(),
        this.snippetService.initialize()
      ]);
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('app-initializing', { stage: 'first-run' });
      }
      
      // Perform first-run check only if needed (can be slow)
      const isFirstRun = this.firstRunService.isFirstRun();
      if (isFirstRun) {
        console.log('[App] First run detected - performing checks in background...');
        // Run first-run checks in background to not block UI
        this.performFirstRunChecksAsync();
      }
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('app-initialized', { 
          success: true,
          isFirstRun 
        });
      }
      
      console.log('[App] Background initialization completed');
      
    } catch (error) {
      console.error('[App] Service initialization failed:', error);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('app-initialized', { 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async performFirstRunChecksAsync() {
    try {
      const firstRunResult = await this.firstRunService.performFirstRunCheck();
      await this.firstRunService.writeDefaultSettings();
      
      console.log('[App] First-run check completed:', {
        checks: firstRunResult.checks,
        texDistributions: firstRunResult.texDistributions.length,
        errors: firstRunResult.errors.length,
        recommendations: firstRunResult.recommendations.length
      });
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('first-run-completed', firstRunResult);
      }
    } catch (error) {
      console.error('[App] First-run check failed:', error);
    }
  }

  async cleanup() {
    await this.fileService.stopAllWatching();
    this.autoCompileService.destroy();
  }

  public createMainWindow() {
    this.createWindow();
  }

  private loadMainWindowContents() {
    if (!this.mainWindow) return;

    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
  }

  private recoverRenderer(reason: string) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    if (this.rendererRecoveryAttempts >= 3) {
      console.error(`[App] Renderer recovery limit reached after: ${reason}`);
      return;
    }

    this.rendererRecoveryAttempts += 1;
    console.warn(`[App] Recovering renderer (${this.rendererRecoveryAttempts}/3) after: ${reason}`);

    setTimeout(() => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
      this.mainWindow.webContents.reloadIgnoringCache();
    }, 400);
  }

  // GitHubService is imported at module level — no lazy loading needed

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 960,
      minHeight: 640,
      backgroundColor: '#f3f4f6',
      show: false, // Don't show until ready
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'preload.js'),
      },
    });

    // Show window when ready to render
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow!.show();
      this.mainWindow!.focus();
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      this.rendererRecoveryAttempts = 0;
    });

    this.mainWindow.webContents.on('render-process-gone', (_, details) => {
      console.error('[App] Renderer process gone:', details);
      this.recoverRenderer(`render process gone (${details.reason})`);
    });

    this.mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
      console.error('[App] Renderer failed to load:', errorCode, errorDescription);
      if (errorCode !== -3) {
        this.recoverRenderer(`did-fail-load ${errorCode}: ${errorDescription}`);
      }
    });

    this.mainWindow.webContents.on('unresponsive', () => {
      console.warn('[App] Renderer became unresponsive');
      if (this.unresponsiveTimer) {
        clearTimeout(this.unresponsiveTimer);
      }

      this.unresponsiveTimer = setTimeout(() => {
        this.recoverRenderer('renderer unresponsive timeout');
      }, 15000);
    });

    this.mainWindow.webContents.on('responsive', () => {
      if (this.unresponsiveTimer) {
        clearTimeout(this.unresponsiveTimer);
        this.unresponsiveTimer = null;
      }
    });

    this.mainWindow.on('closed', () => {
      if (this.unresponsiveTimer) {
        clearTimeout(this.unresponsiveTimer);
        this.unresponsiveTimer = null;
      }
    });

    this.loadMainWindowContents();
  }

  private setupProtocolHandlers() {
    protocol.registerFileProtocol('safe-file', (request, callback) => {
      const url = request.url.substr(10); // Remove 'safe-file:' prefix
      try {
        return callback({ path: url });
      } catch (error) {
        console.error('Failed to register protocol', error);
        return callback({ error: -6 }); // ENOENT
      }
    });
  }

  private setupIPC() {
    // Dialog IPC handlers
    ipcMain.handle('Dialog.ShowOpenDialog', async () => {
      if (!this.mainWindow) return { canceled: true };
      
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Project Folder'
      });
      
      return result;
    });

    // Project IPC handlers
    ipcMain.handle('Project.Create', async (_, payload) => {
      return await this.projectService.create(payload.name, payload.path, payload.templateId);
    });

    ipcMain.handle('Project.Open', async (_, payload) => {
      const project = await this.projectService.open(payload.path);
      
      // Ensure output directory exists
      await this.projectService.ensureOutputDirectory(project.id);
      
      // Start file watching for the opened project
      if (this.mainWindow) {
        await this.fileService.startWatching(project.id, this.mainWindow);
      }
      return project;
    });

    ipcMain.handle('Project.List', async () => {
      return await this.projectService.list();
    });

    ipcMain.handle('Project.SetMain', async (_, payload) => {
      return await this.projectService.setMainFile(payload.projectId, payload.relPath);
    });

    ipcMain.handle('Project.OutputPath', async (_, payload) => {
      const project = await this.projectService.getById(payload.projectId);
      if (!project) throw new Error('Project not found');
      
      const outputPath = join(project.root, 'output', payload.file || 'main.pdf');
      return pathToFileURL(outputPath).href;
    });

    // File System IPC handlers
    ipcMain.handle('FS.ListTree', async (_, payload) => {
      return await this.fileService.listTree(payload.projectId);
    });

    ipcMain.handle('FS.ReadFile', async (_, payload) => {
      return await this.fileService.readFile(payload.projectId, payload.relPath);
    });

    ipcMain.handle('FS.WriteFile', async (_, payload) => {
      return await this.fileService.writeFile(payload.projectId, payload.relPath, payload.content, payload.isAutosave);
    });

    ipcMain.handle('FS.CreateFile', async (_, payload) => {
      return await this.fileService.createFile(payload.projectId, payload.relPath);
    });

    ipcMain.handle('FS.CreateDir', async (_, payload) => {
      return await this.fileService.createDirectory(payload.projectId, payload.relPath);
    });

    ipcMain.handle('FS.Rename', async (_, payload) => {
      return await this.fileService.rename(payload.projectId, payload.oldPath, payload.newPath);
    });

    ipcMain.handle('FS.Delete', async (_, payload) => {
      return await this.fileService.delete(payload.projectId, payload.relPath);
    });

    // Compile IPC handlers
    ipcMain.handle('Compile.Run', async (_, payload) => {
      return await this.compileOrchestrator.run(payload.projectId, payload.engine, payload.mainFile, payload.isAutoCompile, payload.forceClean);
    });

    ipcMain.handle('Compile.Status', async (_, payload) => {
      return this.compileOrchestrator.getStatus(payload.jobId);
    });

    ipcMain.handle('Compile.Errors', async (_, payload) => {
      return this.compileOrchestrator.getErrors(payload.jobId);
    });

    ipcMain.handle('Compile.Cancel', async (_, payload) => {
      return this.compileOrchestrator.cancel(payload.jobId);
    });

    ipcMain.handle('SyncTex.InverseSearch', async (_, payload) => {
      const project = await this.projectService.getById(payload.projectId);
      if (!project) return null;
      const pdfPath = join(project.root, 'output', 'main.pdf');
      return await this.syncTexService.inverseSearch(project.root, pdfPath, payload.page, payload.x, payload.y);
    });

    // Milestone 13: Clean build directory
    ipcMain.handle('Compile.CleanBuildDir', async (_, payload) => {
      return await this.compileOrchestrator.cleanBuildDir(payload.projectId);
    });

    // Milestone 5: Queue state and auto-compile handlers
    ipcMain.handle('Compile.QueueState', async (_, payload) => {
      return this.compileOrchestrator.getQueueState();
    });

    ipcMain.handle('Compile.TriggerAutoCompile', async (_, payload) => {
      console.log(`[Main] Auto-compile trigger requested for project: ${payload.projectId}`);
      this.autoCompileService.triggerCompile(payload.projectId);
      return { ok: true };
    });

    // Auto-compile delay settings
    ipcMain.handle('Compile.SetAutoCompileDelay', async (_, payload) => {
      await this.autoCompileService.setDelay(payload.delayMs);
      return { ok: true };
    });

    ipcMain.handle('Compile.GetAutoCompileDelay', async () => {
      return { delayMs: this.autoCompileService.getDelay() };
    });

    // Reset compilation state for a project
    ipcMain.handle('Compile.ResetProjectState', async (_, payload) => {
      this.compileOrchestrator.resetProjectState(payload.projectId);
      return { ok: true };
    });

    // Setup compile progress events (Milestone 4)
    this.compileOrchestrator.on('progress', (data) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('Compile.Progress', data);
      }
    });

    // Milestone 5: Setup queue state change events
    this.compileOrchestrator.on('queueStateChange', (data) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('Compile.QueueStateChange', data);
      }
    });

    // Setup auto-compile progress events for PDF refresh
    this.autoCompileService.on('autoCompileProgress', (data) => {
      if (this.mainWindow) {
        console.log(`[Main] Auto-compile progress: ${data.state} for project: ${data.projectId}`);
        this.mainWindow.webContents.send('AutoCompile.Progress', data);
      }
    });

    this.autoCompileService.on('autoCompileStarted', (data) => {
      if (this.mainWindow) {
        console.log(`[Main] Auto-compile started for project: ${data.projectId}, jobId: ${data.jobId}`);
        this.mainWindow.webContents.send('AutoCompile.Started', data);
      }
    });

    this.autoCompileService.on('autoCompileError', (data) => {
      if (this.mainWindow) {
        console.log(`[Main] Auto-compile error for project: ${data.projectId}`, data.error);
        this.mainWindow.webContents.send('AutoCompile.Error', data);
      }
    });

    // Snapshot IPC handlers
    ipcMain.handle('Snapshot.Create', async (_, payload) => {
      return await this.snapshotService.create(payload.projectId, payload.message);
    });

    ipcMain.handle('Snapshot.List', async (_, payload) => {
      return await this.snapshotService.list(payload.projectId);
    });

    ipcMain.handle('Snapshot.Restore', async (_, payload) => {
      try {
        console.log(`[Main] Starting snapshot restore: ${payload.snapshotId}`);
        const result = await this.snapshotService.restore(payload.snapshotId);
        console.log('[Main] Snapshot restore completed successfully');
        return result;
      } catch (error) {
        console.error('[Main] Snapshot restore failed:', error);
        throw error;
      }
    });

    ipcMain.handle('Snapshot.Delete', async (_, payload) => {
      return await this.snapshotService.delete(payload.snapshotId);
    });

    // Template IPC handlers
    ipcMain.handle('Template.List', async () => {
      return await this.templateService.list();
    });

    ipcMain.handle('Template.Apply', async (_, payload) => {
      return await this.templateService.apply(payload.projectId, payload.templateId, payload.projectRoot);
    });

    // Snippet IPC handlers
    ipcMain.handle('Snippet.List', async () => {
      return await this.snippetService.list();
    });

    ipcMain.handle('Snippet.Search', async (_, payload) => {
      return await this.snippetService.search(payload.query);
    });

    ipcMain.handle('Snippet.GetByCategory', async (_, payload) => {
      return await this.snippetService.getByCategory(payload.category);
    });

    // BibTeX IPC handlers
    ipcMain.handle('BibTeX.Parse', async (_, payload) => {
      const project = await this.projectService.getById(payload.projectId);
      if (!project) throw new Error('Project not found');
      return await this.bibTexService.parseBibFile(project.root, payload.fileName);
    });

    ipcMain.handle('BibTeX.Write', async (_, payload) => {
      const project = await this.projectService.getById(payload.projectId);
      if (!project) throw new Error('Project not found');
      return await this.bibTexService.writeBibFile(project.root, payload.fileName, payload.entries);
    });

    ipcMain.handle('BibTeX.CreateEntry', async (_, payload) => {
      return this.bibTexService.createNewEntry(payload.type);
    });

    ipcMain.handle('BibTeX.GetEntryTypes', async () => {
      return this.bibTexService.getEntryTypes();
    });

    // Settings IPC handlers
    ipcMain.handle('Settings.Get', async (_, payload) => {
      return await this.settingsService.get(payload.key);
    });

    ipcMain.handle('Settings.Set', async (_, payload) => {
      return await this.settingsService.set(payload.key, payload.value);
    });

    ipcMain.handle('Settings.CheckTeX', async () => {
      return await this.settingsService.checkTexInstallation();
    });

    ipcMain.handle('Settings.GetTexSettings', async () => {
      return await this.settingsService.getTexSettings();
    });

    ipcMain.handle('Settings.UpdateTexSettings', async (_, payload) => {
      return await this.settingsService.updateTexSettings(payload.settings);
    });

    ipcMain.handle('Settings.RedetectTeX', async () => {
      return await this.settingsService.redetectTeX();
    });

    ipcMain.handle('Settings.SetActiveDistribution', async (_, payload) => {
      return await this.settingsService.setActiveDistribution(payload.distributionName);
    });

    ipcMain.handle('Settings.AddCustomDistribution', async (_, payload) => {
      return await this.settingsService.addCustomDistribution(payload.name, payload.paths);
    });

    // Milestone 13: Cold-start cache handlers
    ipcMain.handle('Settings.GetLastOpenedProject', async () => {
      return await this.settingsService.getLastOpenedProject();
    });

    ipcMain.handle('Settings.SetLastOpenedProject', async (_, payload) => {
      return await this.settingsService.setLastOpenedProject(payload.projectId);
    });

    // Auto-compile settings handlers
    ipcMain.handle('Settings.GetAutoCompileEnabled', async () => {
      return { enabled: this.autoCompileService.getEnabled() };
    });

    ipcMain.handle('Settings.SetAutoCompileEnabled', async (_, payload) => {
      await this.autoCompileService.setEnabled(payload.enabled);
      return { ok: true };
    });

    ipcMain.handle('Settings.GetRecentProjects', async () => {
      return await this.settingsService.getRecentProjects();
    });

    ipcMain.handle('Settings.AddToRecentProjects', async (_, payload) => {
      return await this.settingsService.addToRecentProjects(payload.projectId, payload.projectName);
    });

    ipcMain.handle('Settings.GetIncrementalBuildSettings', async () => {
      return await this.settingsService.getIncrementalBuildSettings();
    });

    ipcMain.handle('Settings.UpdateIncrementalBuildSettings', async (_, payload) => {
      return await this.settingsService.updateIncrementalBuildSettings(payload.settings);
    });

    ipcMain.handle('Settings.GetEditorState', async (_, payload) => {
      return await this.settingsService.getEditorState(payload.projectId);
    });

    ipcMain.handle('Settings.SaveEditorState', async (_, payload) => {
      return await this.settingsService.saveEditorState(payload.projectId, payload.state);
    });
    
    // File watching handler
    ipcMain.handle('FS.StartWatching', async (_, payload) => {
      if (this.mainWindow) {
        await this.fileService.startWatching(payload.projectId, this.mainWindow);
      }
      return { ok: true };
    });
    
    ipcMain.handle('FS.StopWatching', async (_, payload) => {
      await this.fileService.stopWatching(payload.projectId);
      return { ok: true };
    });

    // FirstRun service handlers
    ipcMain.handle('FirstRun.PerformCheck', async () => {
      return await this.firstRunService.performFirstRunCheck();
    });

    ipcMain.handle('FirstRun.IsFirstRun', async () => {
      return { isFirstRun: this.firstRunService.isFirstRun() };
    });

    ipcMain.handle('FirstRun.WriteDefaultSettings', async () => {
      await this.firstRunService.writeDefaultSettings();
      return { ok: true };
    });

    // App initialization status
    ipcMain.handle('App.GetInitializationStatus', async () => {
      return { 
        initialized: true, // Will be updated based on actual state
        services: {
          projectService: !!this.projectService,
          settingsService: !!this.settingsService,
          templateService: !!this.templateService,
          snippetService: !!this.snippetService
        }
      };
    });

    // ─── Helper: wrap IPC handler with serializable error ──────────────
    const safeHandle = (channel: string, handler: (event: any, payload: any) => Promise<any>) => {
      ipcMain.handle(channel, async (event, payload) => {
        try {
          return await handler(event, payload);
        } catch (err: any) {
          // Re-throw with a plain string message that Electron can serialize
          const message = err?.message || String(err);
          throw new Error(message);
        }
      });
    };

    // ─── Git service handlers ─────────────────────────────────────────
    safeHandle('Git.Initialize', async (_, payload) => {
      const success = await GitService.initialize(payload.projectPath);
      return { success };
    });

    safeHandle('Git.InitRepository', async (_, payload) => {
      await GitService.initRepository(payload.projectPath);
      return { ok: true };
    });

    safeHandle('Git.GetStatus', async () => {
      const files = await GitService.getStatus();
      return { files };
    });

    safeHandle('Git.StageFiles', async (_, payload) => {
      await GitService.stageFiles(payload.files);
      return { ok: true };
    });

    safeHandle('Git.StageAll', async () => {
      await GitService.stageAll();
      return { ok: true };
    });

    safeHandle('Git.UnstageFiles', async (_, payload) => {
      await GitService.unstageFiles(payload.files);
      return { ok: true };
    });

    safeHandle('Git.Commit', async (_, payload) => {
      const commit = await GitService.commit(payload.message);
      return { commit };
    });

    safeHandle('Git.GetLog', async (_, payload) => {
      const log = await GitService.getLog(payload?.maxCount || 50);
      return { log };
    });

    safeHandle('Git.GetBranches', async () => {
      const branches = await GitService.getBranches();
      return { branches };
    });

    safeHandle('Git.CreateBranch', async (_, payload) => {
      await GitService.createBranch(payload.name, payload.checkout);
      return { ok: true };
    });

    safeHandle('Git.CheckoutBranch', async (_, payload) => {
      await GitService.checkoutBranch(payload.name);
      return { ok: true };
    });

    safeHandle('Git.DeleteBranch', async (_, payload) => {
      await GitService.deleteBranch(payload.name, payload.force);
      return { ok: true };
    });

    safeHandle('Git.RenameBranch', async (_, payload) => {
      await GitService.renameBranch(payload.oldName, payload.newName);
      return { ok: true };
    });

    safeHandle('Git.Merge', async (_, payload) => {
      const result = await GitService.mergeBranch(payload.branch);
      return { result };
    });

    safeHandle('Git.Push', async (_, payload) => {
      await GitService.push(payload.remote, payload.branch, payload.setUpstream);
      return { ok: true };
    });

    safeHandle('Git.Pull', async (_, payload) => {
      await GitService.pull(payload.remote, payload.branch);
      return { ok: true };
    });

    safeHandle('Git.Fetch', async (_, payload) => {
      await GitService.fetch(payload?.remote);
      return { ok: true };
    });

    safeHandle('Git.GetRemotes', async () => {
      const remotes = await GitService.getRemotes();
      return { remotes };
    });

    safeHandle('Git.AddRemote', async (_, payload) => {
      await GitService.addRemote(payload.name, payload.url);
      return { ok: true };
    });

    safeHandle('Git.RemoveRemote', async (_, payload) => {
      await GitService.removeRemote(payload.name);
      return { ok: true };
    });

    safeHandle('Git.GetDiff', async (_, payload) => {
      const diff = await GitService.getDiff(payload?.filePath);
      return { diff };
    });

    safeHandle('Git.GetStagedDiff', async (_, payload) => {
      const diff = await GitService.getStagedDiff(payload?.filePath);
      return { diff };
    });

    safeHandle('Git.GetFileDiff', async (_, payload) => {
      const diff = await GitService.getFileDiff(payload.filePath, payload.staged);
      return { diff };
    });

    safeHandle('Git.DiscardChanges', async (_, payload) => {
      await GitService.discardChanges(payload.files);
      return { ok: true };
    });

    safeHandle('Git.Clone', async (_, payload) => {
      await GitService.clone(payload.url, payload.targetPath);
      return { ok: true };
    });

    safeHandle('Git.GetCurrentBranch', async () => {
      const branch = await GitService.getCurrentBranch();
      return { branch };
    });

    safeHandle('Git.IsClean', async () => {
      const clean = await GitService.isClean();
      return { clean };
    });

    safeHandle('Git.Stash', async (_, payload) => {
      await GitService.stash(payload?.message);
      return { ok: true };
    });

    safeHandle('Git.StashPop', async (_, payload) => {
      await GitService.stashPop(payload?.index);
      return { ok: true };
    });

    safeHandle('Git.StashDrop', async (_, payload) => {
      await GitService.stashDrop(payload?.index);
      return { ok: true };
    });

    safeHandle('Git.StashList', async () => {
      const stashes = await GitService.stashList();
      return { stashes };
    });

    // ─── GitHub service handlers ──────────────────────────────────────
    safeHandle('GitHub.Authenticate', async (_, payload) => {
      const user = await GitHubServiceInstance.authenticateWithToken(payload.token);
      return { user };
    });

    safeHandle('GitHub.StartBrowserAuth', async () => {
      const session = await GitHubServiceInstance.startBrowserAuth();
      return { session };
    });

    safeHandle('GitHub.CompleteBrowserAuth', async (_, payload) => {
      const user = await GitHubServiceInstance.completeBrowserAuth(
        payload.deviceCode,
        payload.interval,
        payload.expiresAt
      );
      return { user };
    });

    safeHandle('GitHub.SignOut', async () => {
      GitHubServiceInstance.signOut();
      return { ok: true };
    });

    safeHandle('GitHub.IsAuthenticated', async () => {
      const authenticated = await GitHubServiceInstance.isAuthenticated();
      return { authenticated };
    });

    safeHandle('GitHub.IsBrowserAuthAvailable', async () => {
      const available = GitHubServiceInstance.isBrowserAuthAvailable();
      return { available };
    });

    safeHandle('GitHub.GetCurrentUser', async () => {
      const user = await GitHubServiceInstance.getCurrentUser();
      return { user };
    });

    safeHandle('GitHub.GetRepositories', async () => {
      const repos = await GitHubServiceInstance.getRepositories();
      return { repos };
    });

    safeHandle('GitHub.CreateRepository', async (_, payload) => {
      const repo = await GitHubServiceInstance.createRepository(
        payload.name,
        payload.description,
        payload.isPrivate
      );
      return { repo };
    });

    safeHandle('GitHub.GetPullRequests', async (_, payload) => {
      const prs = await GitHubServiceInstance.getPullRequests(
        payload.owner,
        payload.repo,
        payload.state
      );
      return { prs };
    });

    safeHandle('GitHub.CreatePullRequest', async (_, payload) => {
      const pr = await GitHubServiceInstance.createPullRequest(
        payload.owner,
        payload.repo,
        payload.title,
        payload.head,
        payload.base,
        payload.body
      );
      return { pr };
    });

    safeHandle('GitHub.ForkRepository', async (_, payload) => {
      const fork = await GitHubServiceInstance.forkRepository(payload.owner, payload.repo);
      return { fork };
    });

    safeHandle('GitHub.ParseUrl', async (_, payload) => {
      const parsed = GitHubServiceInstance.parseGitHubUrl(payload.url);
      return { parsed };
    });

    safeHandle('GitHub.InviteCollaborator', async (_, payload) => {
      const invite = await GitHubServiceInstance.inviteCollaborator(
        payload.owner,
        payload.repo,
        payload.username,
        payload.permission
      );
      return { invite };
    });

    safeHandle('GitHub.GetCollaborators', async (_, payload) => {
      const collaborators = await GitHubServiceInstance.getCollaborators(payload.owner, payload.repo);
      return { collaborators };
    });

    safeHandle('GitHub.GetCredentials', async () => {
      const credentials = GitHubServiceInstance.getCredentials();
      return { credentials };
    });
  }
}

const appInstance = new App();
(global as any).appInstance = appInstance; // Store reference for cleanup
appInstance.initialize().catch(console.error);

app.on('window-all-closed', async () => {
  // Clean up file watchers
  await appInstance.cleanup();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Clean up file watchers
  await appInstance.cleanup();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    appInstance.createMainWindow();
  }
});
