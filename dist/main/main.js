"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const url_1 = require("url");
const FileService_1 = require("./services/FileService");
const ProjectService_1 = require("./services/ProjectService");
const SettingsService_1 = require("./services/SettingsService");
const CompileOrchestrator_1 = require("./services/CompileOrchestrator");
const SnapshotService_1 = require("./services/SnapshotService");
const TemplateService_1 = require("./services/TemplateService");
const SnippetService_1 = require("./services/SnippetService");
const BibTeXService_1 = require("./services/BibTeXService");
class App {
    constructor() {
        this.mainWindow = null;
        this.fileService = new FileService_1.FileService();
        this.projectService = new ProjectService_1.ProjectService();
        this.settingsService = new SettingsService_1.SettingsService();
        this.compileOrchestrator = new CompileOrchestrator_1.CompileOrchestrator();
        this.snapshotService = new SnapshotService_1.SnapshotService(this.projectService);
        this.templateService = new TemplateService_1.TemplateService();
        this.snippetService = new SnippetService_1.SnippetService();
        this.bibTexService = new BibTeXService_1.BibTeXService();
    }
    async initialize() {
        await electron_1.app.whenReady();
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
    createMainWindow() {
        this.createWindow();
    }
    createWindow() {
        this.mainWindow = new electron_1.BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: (0, path_1.join)(__dirname, 'preload.js'),
            },
        });
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.loadURL('http://localhost:3000');
            this.mainWindow.webContents.openDevTools();
        }
        else {
            this.mainWindow.loadFile((0, path_1.join)(__dirname, '../renderer/index.html'));
        }
    }
    setupProtocolHandlers() {
        electron_1.protocol.registerFileProtocol('safe-file', (request, callback) => {
            const url = request.url.substr(10); // Remove 'safe-file:' prefix
            try {
                return callback({ path: url });
            }
            catch (error) {
                console.error('Failed to register protocol', error);
                return callback({ error: -6 }); // ENOENT
            }
        });
    }
    setupIPC() {
        // Dialog IPC handlers
        electron_1.ipcMain.handle('Dialog.ShowOpenDialog', async () => {
            if (!this.mainWindow)
                return { canceled: true };
            const result = await electron_1.dialog.showOpenDialog(this.mainWindow, {
                properties: ['openDirectory'],
                title: 'Select Project Folder'
            });
            return result;
        });
        // Project IPC handlers
        electron_1.ipcMain.handle('Project.Create', async (_, payload) => {
            return await this.projectService.create(payload.name, payload.path, payload.templateId);
        });
        electron_1.ipcMain.handle('Project.Open', async (_, payload) => {
            const project = await this.projectService.open(payload.path);
            // Ensure output directory exists
            await this.projectService.ensureOutputDirectory(project.id);
            // Start file watching for the opened project
            if (this.mainWindow) {
                await this.fileService.startWatching(project.id, this.mainWindow);
            }
            return project;
        });
        electron_1.ipcMain.handle('Project.List', async () => {
            return await this.projectService.list();
        });
        electron_1.ipcMain.handle('Project.SetMain', async (_, payload) => {
            return await this.projectService.setMainFile(payload.projectId, payload.relPath);
        });
        electron_1.ipcMain.handle('Project.OutputPath', async (_, payload) => {
            const project = await this.projectService.getById(payload.projectId);
            if (!project)
                throw new Error('Project not found');
            const outputPath = (0, path_1.join)(project.root, 'output', payload.file || 'main.pdf');
            return (0, url_1.pathToFileURL)(outputPath).href;
        });
        // File System IPC handlers
        electron_1.ipcMain.handle('FS.ListTree', async (_, payload) => {
            return await this.fileService.listTree(payload.projectId);
        });
        electron_1.ipcMain.handle('FS.ReadFile', async (_, payload) => {
            return await this.fileService.readFile(payload.projectId, payload.relPath);
        });
        electron_1.ipcMain.handle('FS.WriteFile', async (_, payload) => {
            return await this.fileService.writeFile(payload.projectId, payload.relPath, payload.content, payload.isAutosave);
        });
        electron_1.ipcMain.handle('FS.CreateFile', async (_, payload) => {
            return await this.fileService.createFile(payload.projectId, payload.relPath);
        });
        electron_1.ipcMain.handle('FS.CreateDir', async (_, payload) => {
            return await this.fileService.createDirectory(payload.projectId, payload.relPath);
        });
        electron_1.ipcMain.handle('FS.Rename', async (_, payload) => {
            return await this.fileService.rename(payload.projectId, payload.oldPath, payload.newPath);
        });
        electron_1.ipcMain.handle('FS.Delete', async (_, payload) => {
            return await this.fileService.delete(payload.projectId, payload.relPath);
        });
        // Compile IPC handlers
        electron_1.ipcMain.handle('Compile.Run', async (_, payload) => {
            return await this.compileOrchestrator.run(payload.projectId, payload.engine, payload.mainFile, payload.isAutoCompile);
        });
        electron_1.ipcMain.handle('Compile.Status', async (_, payload) => {
            return this.compileOrchestrator.getStatus(payload.jobId);
        });
        electron_1.ipcMain.handle('Compile.Errors', async (_, payload) => {
            return this.compileOrchestrator.getErrors(payload.jobId);
        });
        electron_1.ipcMain.handle('Compile.Cancel', async (_, payload) => {
            return this.compileOrchestrator.cancel(payload.jobId);
        });
        // Milestone 5: Queue state and auto-compile handlers
        electron_1.ipcMain.handle('Compile.QueueState', async (_, payload) => {
            return this.compileOrchestrator.getQueueState();
        });
        electron_1.ipcMain.handle('Compile.TriggerAutoCompile', async (_, payload) => {
            return this.compileOrchestrator.triggerAutoCompile(payload.projectId);
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
        // Mock compile for testing (Milestone 3)
        electron_1.ipcMain.handle('Compile.Mock', async (_, payload) => {
            await this.compileOrchestrator.createMockPDF(payload.projectId);
            return { ok: true };
        });
        // Snapshot IPC handlers
        electron_1.ipcMain.handle('Snapshot.Create', async (_, payload) => {
            return await this.snapshotService.create(payload.projectId, payload.message);
        });
        electron_1.ipcMain.handle('Snapshot.List', async (_, payload) => {
            return await this.snapshotService.list(payload.projectId);
        });
        electron_1.ipcMain.handle('Snapshot.Restore', async (_, payload) => {
            try {
                console.log(`[Main] Starting snapshot restore: ${payload.snapshotId}`);
                const result = await this.snapshotService.restore(payload.snapshotId);
                console.log('[Main] Snapshot restore completed successfully');
                return result;
            }
            catch (error) {
                console.error('[Main] Snapshot restore failed:', error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('Snapshot.Delete', async (_, payload) => {
            return await this.snapshotService.delete(payload.snapshotId);
        });
        // Template IPC handlers
        electron_1.ipcMain.handle('Template.List', async () => {
            return await this.templateService.list();
        });
        electron_1.ipcMain.handle('Template.Apply', async (_, payload) => {
            return await this.templateService.apply(payload.projectId, payload.templateId, payload.projectRoot);
        });
        // Snippet IPC handlers
        electron_1.ipcMain.handle('Snippet.List', async () => {
            return await this.snippetService.list();
        });
        electron_1.ipcMain.handle('Snippet.Search', async (_, payload) => {
            return await this.snippetService.search(payload.query);
        });
        electron_1.ipcMain.handle('Snippet.GetByCategory', async (_, payload) => {
            return await this.snippetService.getByCategory(payload.category);
        });
        // BibTeX IPC handlers
        electron_1.ipcMain.handle('BibTeX.Parse', async (_, payload) => {
            const project = await this.projectService.getById(payload.projectId);
            if (!project)
                throw new Error('Project not found');
            return await this.bibTexService.parseBibFile(project.root, payload.fileName);
        });
        electron_1.ipcMain.handle('BibTeX.Write', async (_, payload) => {
            const project = await this.projectService.getById(payload.projectId);
            if (!project)
                throw new Error('Project not found');
            return await this.bibTexService.writeBibFile(project.root, payload.fileName, payload.entries);
        });
        electron_1.ipcMain.handle('BibTeX.CreateEntry', async (_, payload) => {
            return this.bibTexService.createNewEntry(payload.type);
        });
        electron_1.ipcMain.handle('BibTeX.GetEntryTypes', async () => {
            return this.bibTexService.getEntryTypes();
        });
        // Settings IPC handlers
        electron_1.ipcMain.handle('Settings.Get', async (_, payload) => {
            return await this.settingsService.get(payload.key);
        });
        electron_1.ipcMain.handle('Settings.Set', async (_, payload) => {
            return await this.settingsService.set(payload.key, payload.value);
        });
        electron_1.ipcMain.handle('Settings.CheckTeX', async () => {
            return await this.settingsService.checkTexInstallation();
        });
        // File watching handler
        electron_1.ipcMain.handle('FS.StartWatching', async (_, payload) => {
            if (this.mainWindow) {
                await this.fileService.startWatching(payload.projectId, this.mainWindow);
            }
            return { ok: true };
        });
        electron_1.ipcMain.handle('FS.StopWatching', async (_, payload) => {
            await this.fileService.stopWatching(payload.projectId);
            return { ok: true };
        });
    }
}
const appInstance = new App();
global.appInstance = appInstance; // Store reference for cleanup
appInstance.initialize().catch(console.error);
electron_1.app.on('window-all-closed', async () => {
    // Clean up file watchers
    await appInstance.cleanup();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', async () => {
    // Clean up file watchers
    await appInstance.cleanup();
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        appInstance.createMainWindow();
    }
});
//# sourceMappingURL=main.js.map