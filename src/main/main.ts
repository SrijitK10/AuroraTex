import { app, BrowserWindow, ipcMain, protocol, shell, dialog } from 'electron';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { FileService } from './services/FileService';
import { ProjectService } from './services/ProjectService';
import { SettingsService } from './services/SettingsService';
import { CompileOrchestrator } from './services/CompileOrchestrator';
import { SnapshotService } from './services/SnapshotService';
import { TemplateService } from './services/TemplateService';
import { SnippetService } from './services/SnippetService';
import { BibTeXService } from './services/BibTeXService';

class App {
  private mainWindow: BrowserWindow | null = null;
  private fileService: FileService;
  private projectService: ProjectService;
  private settingsService: SettingsService;
  private compileOrchestrator: CompileOrchestrator;
  private snapshotService: SnapshotService;
  private templateService: TemplateService;
  private snippetService: SnippetService;
  private bibTexService: BibTeXService;

  constructor() {
    this.fileService = new FileService();
    this.projectService = new ProjectService();
    this.settingsService = new SettingsService();
    this.compileOrchestrator = new CompileOrchestrator();
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
    
    this.createWindow();
    this.setupIPC();
    this.setupProtocolHandlers();
  }

  async cleanup() {
    await this.fileService.stopAllWatching();
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
      return await this.compileOrchestrator.run(payload.projectId, payload.engine, payload.mainFile, payload.isAutoCompile);
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

    // Milestone 5: Queue state and auto-compile handlers
    ipcMain.handle('Compile.QueueState', async (_, payload) => {
      return this.compileOrchestrator.getQueueState();
    });

    ipcMain.handle('Compile.TriggerAutoCompile', async (_, payload) => {
      return this.compileOrchestrator.triggerAutoCompile(payload.projectId);
    });

    // Auto-compile delay settings
    ipcMain.handle('Compile.SetAutoCompileDelay', async (_, payload) => {
      this.compileOrchestrator.setAutoCompileDelay(payload.delayMs);
      return { ok: true };
    });

    ipcMain.handle('Compile.GetAutoCompileDelay', async () => {
      return { delayMs: this.compileOrchestrator.getAutoCompileDelay() };
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
