"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose the API to the renderer process
const electronAPI = {
    // Dialog APIs
    dialogShowOpenDialog: () => electron_1.ipcRenderer.invoke('Dialog.ShowOpenDialog'),
    // Project APIs
    projectCreate: (payload) => electron_1.ipcRenderer.invoke('Project.Create', payload),
    projectOpen: (payload) => electron_1.ipcRenderer.invoke('Project.Open', payload),
    projectList: () => electron_1.ipcRenderer.invoke('Project.List'),
    projectSetMain: (payload) => electron_1.ipcRenderer.invoke('Project.SetMain', payload),
    projectOutputPath: (payload) => electron_1.ipcRenderer.invoke('Project.OutputPath', payload),
    // File System APIs
    fsListTree: (payload) => electron_1.ipcRenderer.invoke('FS.ListTree', payload),
    fsReadFile: (payload) => electron_1.ipcRenderer.invoke('FS.ReadFile', payload),
    fsWriteFile: (payload) => electron_1.ipcRenderer.invoke('FS.WriteFile', payload),
    fsCreateFile: (payload) => electron_1.ipcRenderer.invoke('FS.CreateFile', payload),
    fsCreateDir: (payload) => electron_1.ipcRenderer.invoke('FS.CreateDir', payload),
    fsRename: (payload) => electron_1.ipcRenderer.invoke('FS.Rename', payload),
    fsDelete: (payload) => electron_1.ipcRenderer.invoke('FS.Delete', payload),
    fsStartWatching: (payload) => electron_1.ipcRenderer.invoke('FS.StartWatching', payload),
    fsStopWatching: (payload) => electron_1.ipcRenderer.invoke('FS.StopWatching', payload),
    // Compile APIs
    compileRun: (payload) => electron_1.ipcRenderer.invoke('Compile.Run', payload),
    compileStatus: (payload) => electron_1.ipcRenderer.invoke('Compile.Status', payload),
    compileErrors: (payload) => electron_1.ipcRenderer.invoke('Compile.Errors', payload),
    compileCancel: (payload) => electron_1.ipcRenderer.invoke('Compile.Cancel', payload),
    // Milestone 5: Queue and auto-compile APIs
    compileQueueState: (payload) => electron_1.ipcRenderer.invoke('Compile.QueueState', payload),
    compileTriggerAutoCompile: (payload) => electron_1.ipcRenderer.invoke('Compile.TriggerAutoCompile', payload),
    compileSetAutoCompileDelay: (payload) => electron_1.ipcRenderer.invoke('Compile.SetAutoCompileDelay', payload),
    compileGetAutoCompileDelay: () => electron_1.ipcRenderer.invoke('Compile.GetAutoCompileDelay'),
    compileResetProjectState: (payload) => electron_1.ipcRenderer.invoke('Compile.ResetProjectState', payload),
    // Milestone 13: Clean build API
    compileCleanBuildDir: (payload) => electron_1.ipcRenderer.invoke('Compile.CleanBuildDir', payload),
    // Snapshot APIs
    snapshotCreate: (payload) => electron_1.ipcRenderer.invoke('Snapshot.Create', payload),
    snapshotList: (payload) => electron_1.ipcRenderer.invoke('Snapshot.List', payload),
    snapshotRestore: (payload) => electron_1.ipcRenderer.invoke('Snapshot.Restore', payload),
    snapshotDelete: (payload) => electron_1.ipcRenderer.invoke('Snapshot.Delete', payload),
    // Settings APIs
    settingsGet: (payload) => electron_1.ipcRenderer.invoke('Settings.Get', payload),
    settingsSet: (payload) => electron_1.ipcRenderer.invoke('Settings.Set', payload),
    settingsCheckTeX: () => electron_1.ipcRenderer.invoke('Settings.CheckTeX'),
    settingsGetTexSettings: () => electron_1.ipcRenderer.invoke('Settings.GetTexSettings'),
    settingsUpdateTexSettings: (payload) => electron_1.ipcRenderer.invoke('Settings.UpdateTexSettings', payload),
    settingsRedetectTeX: () => electron_1.ipcRenderer.invoke('Settings.RedetectTeX'),
    settingsSetActiveDistribution: (payload) => electron_1.ipcRenderer.invoke('Settings.SetActiveDistribution', payload),
    settingsAddCustomDistribution: (payload) => electron_1.ipcRenderer.invoke('Settings.AddCustomDistribution', payload),
    // Auto-compile settings
    settingsGetAutoCompileEnabled: () => electron_1.ipcRenderer.invoke('Settings.GetAutoCompileEnabled'),
    settingsSetAutoCompileEnabled: (payload) => electron_1.ipcRenderer.invoke('Settings.SetAutoCompileEnabled', payload),
    // Template APIs
    templateList: () => electron_1.ipcRenderer.invoke('Template.List'),
    templateApply: (payload) => electron_1.ipcRenderer.invoke('Template.Apply', payload),
    // Snippet APIs
    snippetList: () => electron_1.ipcRenderer.invoke('Snippet.List'),
    snippetSearch: (payload) => electron_1.ipcRenderer.invoke('Snippet.Search', payload),
    snippetGetByCategory: (payload) => electron_1.ipcRenderer.invoke('Snippet.GetByCategory', payload),
    // BibTeX APIs
    bibTexParse: (payload) => electron_1.ipcRenderer.invoke('BibTeX.Parse', payload),
    bibTexWrite: (payload) => electron_1.ipcRenderer.invoke('BibTeX.Write', payload),
    bibTexCreateEntry: (payload) => electron_1.ipcRenderer.invoke('BibTeX.CreateEntry', payload),
    bibTexGetEntryTypes: () => electron_1.ipcRenderer.invoke('BibTeX.GetEntryTypes'),
    // First Run APIs
    firstRunPerformCheck: () => electron_1.ipcRenderer.invoke('FirstRun.PerformCheck'),
    firstRunIsFirstRun: () => electron_1.ipcRenderer.invoke('FirstRun.IsFirstRun'),
    firstRunWriteDefaultSettings: () => electron_1.ipcRenderer.invoke('FirstRun.WriteDefaultSettings'),
    // Event listeners
    onCompileProgress: (callback) => electron_1.ipcRenderer.on('Compile.Progress', callback),
    removeCompileProgressListener: (callback) => electron_1.ipcRenderer.removeListener('Compile.Progress', callback),
    onFileChanged: (callback) => electron_1.ipcRenderer.on('file-changed', callback),
    removeFileChangedListener: (callback) => electron_1.ipcRenderer.removeListener('file-changed', callback),
    // Milestone 5: Queue state change event listeners
    onQueueStateChange: (callback) => electron_1.ipcRenderer.on('Compile.QueueStateChange', callback),
    removeQueueStateChangeListener: (callback) => electron_1.ipcRenderer.removeListener('Compile.QueueStateChange', callback),
    // Auto-compile event listeners
    onAutoCompileProgress: (callback) => electron_1.ipcRenderer.on('AutoCompile.Progress', callback),
    removeAutoCompileProgressListener: (callback) => electron_1.ipcRenderer.removeListener('AutoCompile.Progress', callback),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
//# sourceMappingURL=preload.js.map