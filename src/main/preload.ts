import { contextBridge, ipcRenderer } from 'electron';
import { ErrorDTO } from './types';

// Define the API interface
export interface ElectronAPI {
  // Dialog APIs
  dialogShowOpenDialog: () => Promise<{ canceled: boolean; filePaths?: string[] }>;

  // Project APIs
  projectCreate: (payload: { name: string; path?: string; templateId?: string }) => Promise<any>;
  projectOpen: (payload: { path: string }) => Promise<any>;
  projectList: () => Promise<any[]>;
  projectSetMain: (payload: { projectId: string; relPath: string }) => Promise<{ ok: boolean }>;
  projectOutputPath: (payload: { projectId: string; file?: string }) => Promise<string>;

  // File System APIs
  fsListTree: (payload: { projectId: string }) => Promise<any[]>;
  fsReadFile: (payload: { projectId: string; relPath: string }) => Promise<string | Uint8Array>;
  fsWriteFile: (payload: { projectId: string; relPath: string; content: string; isAutosave?: boolean }) => Promise<{ ok: boolean; mtime: string }>;
  fsCreateFile: (payload: { projectId: string; relPath: string }) => Promise<{ ok: boolean }>;
  fsCreateDir: (payload: { projectId: string; relPath: string }) => Promise<{ ok: boolean }>;
  fsRename: (payload: { projectId: string; oldPath: string; newPath: string }) => Promise<{ ok: boolean }>;
  fsDelete: (payload: { projectId: string; relPath: string }) => Promise<{ ok: boolean }>;
  fsStartWatching: (payload: { projectId: string }) => Promise<{ ok: boolean }>;
  fsStopWatching: (payload: { projectId: string }) => Promise<{ ok: boolean }>;

  // Compile APIs
  compileRun: (payload: { projectId: string; engine?: string; mainFile?: string; isAutoCompile?: boolean }) => Promise<{ jobId: string }>;
  compileStatus: (payload: { jobId: string }) => Promise<any>;
  compileErrors: (payload: { jobId: string }) => Promise<ErrorDTO[]>;
  compileCancel: (payload: { jobId: string }) => Promise<{ ok: boolean }>;
  // Milestone 5: Queue and auto-compile APIs
  compileQueueState: (payload: { projectId: string }) => Promise<{ pending: number; running: number; maxConcurrency: number }>;
  compileTriggerAutoCompile: (payload: { projectId: string }) => Promise<{ ok: boolean }>;
  compileSetAutoCompileDelay: (payload: { delayMs: number }) => Promise<{ ok: boolean }>;
  compileGetAutoCompileDelay: () => Promise<{ delayMs: number }>;
  // Milestone 13: Clean build API
  compileCleanBuildDir: (payload: { projectId: string }) => Promise<{ ok: boolean }>;

  // Snapshot APIs
  snapshotCreate: (payload: { projectId: string; message?: string }) => Promise<any>;
  snapshotList: (payload: { projectId: string }) => Promise<any[]>;
  snapshotRestore: (payload: { snapshotId: string }) => Promise<{ ok: boolean }>;
  snapshotDelete: (payload: { snapshotId: string }) => Promise<{ ok: boolean }>;

  // Settings APIs
  settingsGet: (payload: { key: string }) => Promise<any>;
  settingsSet: (payload: { key: string; value: any }) => Promise<{ ok: boolean }>;
  settingsCheckTeX: () => Promise<{ found: boolean; paths: any }>;
  settingsGetTexSettings: () => Promise<any>;
  settingsUpdateTexSettings: (payload: { settings: any }) => Promise<{ ok: boolean }>;
  settingsRedetectTeX: () => Promise<any>;
  settingsSetActiveDistribution: (payload: { distributionName: string }) => Promise<{ ok: boolean }>;
  settingsAddCustomDistribution: (payload: { name: string; paths: Record<string, string> }) => Promise<{ ok: boolean }>;
  // Auto-compile settings
  settingsGetAutoCompileEnabled: () => Promise<{ enabled: boolean }>;
  settingsSetAutoCompileEnabled: (payload: { enabled: boolean }) => Promise<{ ok: boolean }>;

  // Template APIs
  templateList: () => Promise<any[]>;
  templateApply: (payload: { projectId: string; templateId: string; projectRoot: string }) => Promise<{ ok: boolean }>;

  // Snippet APIs
  snippetList: () => Promise<any[]>;
  snippetSearch: (payload: { query: string }) => Promise<any[]>;
  snippetGetByCategory: (payload: { category: string }) => Promise<any[]>;

  // BibTeX APIs
  bibTexParse: (payload: { projectId: string; fileName: string }) => Promise<any[]>;
  bibTexWrite: (payload: { projectId: string; fileName: string; entries: any[] }) => Promise<{ ok: boolean }>;
  bibTexCreateEntry: (payload: { type: string }) => Promise<any>;
  bibTexGetEntryTypes: () => Promise<any[]>;

  // Event listeners
  onCompileProgress: (callback: (event: any, data: any) => void) => void;
  removeCompileProgressListener: (callback: (event: any, data: any) => void) => void;
  onFileChanged: (callback: (event: any, data: any) => void) => void;
  removeFileChangedListener: (callback: (event: any, data: any) => void) => void;
  // Milestone 5: Queue state change event listeners
  onQueueStateChange: (callback: (event: any, data: any) => void) => void;
  removeQueueStateChangeListener: (callback: (event: any, data: any) => void) => void;
}

// Expose the API to the renderer process
const electronAPI: ElectronAPI = {
  // Dialog APIs
  dialogShowOpenDialog: () => ipcRenderer.invoke('Dialog.ShowOpenDialog'),

  // Project APIs
  projectCreate: (payload) => ipcRenderer.invoke('Project.Create', payload),
  projectOpen: (payload) => ipcRenderer.invoke('Project.Open', payload),
  projectList: () => ipcRenderer.invoke('Project.List'),
  projectSetMain: (payload) => ipcRenderer.invoke('Project.SetMain', payload),
  projectOutputPath: (payload) => ipcRenderer.invoke('Project.OutputPath', payload),

  // File System APIs
  fsListTree: (payload) => ipcRenderer.invoke('FS.ListTree', payload),
  fsReadFile: (payload) => ipcRenderer.invoke('FS.ReadFile', payload),
  fsWriteFile: (payload) => ipcRenderer.invoke('FS.WriteFile', payload),
  fsCreateFile: (payload) => ipcRenderer.invoke('FS.CreateFile', payload),
  fsCreateDir: (payload) => ipcRenderer.invoke('FS.CreateDir', payload),
  fsRename: (payload) => ipcRenderer.invoke('FS.Rename', payload),
  fsDelete: (payload) => ipcRenderer.invoke('FS.Delete', payload),
  fsStartWatching: (payload) => ipcRenderer.invoke('FS.StartWatching', payload),
  fsStopWatching: (payload) => ipcRenderer.invoke('FS.StopWatching', payload),

  // Compile APIs
  compileRun: (payload) => ipcRenderer.invoke('Compile.Run', payload),
  compileStatus: (payload) => ipcRenderer.invoke('Compile.Status', payload),
  compileErrors: (payload) => ipcRenderer.invoke('Compile.Errors', payload),
  compileCancel: (payload) => ipcRenderer.invoke('Compile.Cancel', payload),
  // Milestone 5: Queue and auto-compile APIs
  compileQueueState: (payload) => ipcRenderer.invoke('Compile.QueueState', payload),
  compileTriggerAutoCompile: (payload) => ipcRenderer.invoke('Compile.TriggerAutoCompile', payload),
  compileSetAutoCompileDelay: (payload) => ipcRenderer.invoke('Compile.SetAutoCompileDelay', payload),
  compileGetAutoCompileDelay: () => ipcRenderer.invoke('Compile.GetAutoCompileDelay'),
  // Milestone 13: Clean build API
  compileCleanBuildDir: (payload) => ipcRenderer.invoke('Compile.CleanBuildDir', payload),

  // Snapshot APIs
  snapshotCreate: (payload) => ipcRenderer.invoke('Snapshot.Create', payload),
  snapshotList: (payload) => ipcRenderer.invoke('Snapshot.List', payload),
  snapshotRestore: (payload) => ipcRenderer.invoke('Snapshot.Restore', payload),
  snapshotDelete: (payload) => ipcRenderer.invoke('Snapshot.Delete', payload),

  // Settings APIs
  settingsGet: (payload) => ipcRenderer.invoke('Settings.Get', payload),
  settingsSet: (payload) => ipcRenderer.invoke('Settings.Set', payload),
  settingsCheckTeX: () => ipcRenderer.invoke('Settings.CheckTeX'),
  settingsGetTexSettings: () => ipcRenderer.invoke('Settings.GetTexSettings'),
  settingsUpdateTexSettings: (payload: { settings: any }) => ipcRenderer.invoke('Settings.UpdateTexSettings', payload),
  settingsRedetectTeX: () => ipcRenderer.invoke('Settings.RedetectTeX'),
  settingsSetActiveDistribution: (payload: { distributionName: string }) => ipcRenderer.invoke('Settings.SetActiveDistribution', payload),
  settingsAddCustomDistribution: (payload: { name: string; paths: Record<string, string> }) => ipcRenderer.invoke('Settings.AddCustomDistribution', payload),
  // Auto-compile settings
  settingsGetAutoCompileEnabled: () => ipcRenderer.invoke('Settings.GetAutoCompileEnabled'),
  settingsSetAutoCompileEnabled: (payload) => ipcRenderer.invoke('Settings.SetAutoCompileEnabled', payload),

  // Template APIs
  templateList: () => ipcRenderer.invoke('Template.List'),
  templateApply: (payload) => ipcRenderer.invoke('Template.Apply', payload),

  // Snippet APIs
  snippetList: () => ipcRenderer.invoke('Snippet.List'),
  snippetSearch: (payload) => ipcRenderer.invoke('Snippet.Search', payload),
  snippetGetByCategory: (payload) => ipcRenderer.invoke('Snippet.GetByCategory', payload),

  // BibTeX APIs
  bibTexParse: (payload) => ipcRenderer.invoke('BibTeX.Parse', payload),
  bibTexWrite: (payload) => ipcRenderer.invoke('BibTeX.Write', payload),
  bibTexCreateEntry: (payload) => ipcRenderer.invoke('BibTeX.CreateEntry', payload),
  bibTexGetEntryTypes: () => ipcRenderer.invoke('BibTeX.GetEntryTypes'),

  // Event listeners
  onCompileProgress: (callback) => ipcRenderer.on('Compile.Progress', callback),
  removeCompileProgressListener: (callback) => ipcRenderer.removeListener('Compile.Progress', callback),
  onFileChanged: (callback) => ipcRenderer.on('file-changed', callback),
  removeFileChangedListener: (callback) => ipcRenderer.removeListener('file-changed', callback),
  // Milestone 5: Queue state change event listeners
  onQueueStateChange: (callback) => ipcRenderer.on('Compile.QueueStateChange', callback),
  removeQueueStateChangeListener: (callback) => ipcRenderer.removeListener('Compile.QueueStateChange', callback),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Declare global interface for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
