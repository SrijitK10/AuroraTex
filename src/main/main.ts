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

class App {
  private mainWindow: BrowserWindow | null = null;
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
  }

  async initialize() {
    await app.whenReady();
    
    // Initialize services
    await this.projectService.initialize();
    await this.settingsService.initialize();
    await this.templateService.initialize();
    await this.snippetService.initialize();
    
    // Perform first-run check and setup
    console.log('[App] Performing first-run check...');
    const firstRunResult = await this.firstRunService.performFirstRunCheck();
    
    if (firstRunResult.isFirstRun) {
      console.log('[App] First run detected - setting up defaults...');
      await this.firstRunService.writeDefaultSettings();
      
      // Log first-run results for debugging
      console.log('[App] First-run check results:', {
        checks: firstRunResult.checks,
        texDistributions: firstRunResult.texDistributions.length,
        errors: firstRunResult.errors.length,
        recommendations: firstRunResult.recommendations.length
      });
    }
    
    this.createWindow();
    this.setupIPC();
    this.setupProtocolHandlers();
  }

  async cleanup() {
    await this.fileService.stopAllWatching();
    this.autoCompileService.destroy();
  }

  public createMainWindow() {
    this.createWindow();
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'preload.js'),
      },
    });

    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
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

    // First-run and installation check handlers
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
