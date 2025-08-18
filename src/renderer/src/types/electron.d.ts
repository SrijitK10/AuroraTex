// Milestone 5: Updated ElectronAPI interface with queue and auto-compile methods
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
  compileErrors: (payload: { jobId: string }) => Promise<any[]>;
  compileCancel: (payload: { jobId: string }) => Promise<{ ok: boolean }>;
  compileMock: (payload: { projectId: string }) => Promise<{ ok: boolean }>;
  // Milestone 5: Queue and auto-compile APIs
  compileQueueState: (payload: { projectId: string }) => Promise<{ pending: number; running: number; maxConcurrency: number }>;
  compileTriggerAutoCompile: (payload: { projectId: string }) => Promise<{ ok: boolean }>;

  // Snapshot APIs
  snapshotCreate: (payload: { projectId: string; message?: string }) => Promise<any>;
  snapshotList: (payload: { projectId: string }) => Promise<any[]>;
  snapshotRestore: (payload: { snapshotId: string }) => Promise<{ ok: boolean }>;

  // Settings APIs
  settingsGet: (payload: { key: string }) => Promise<any>;
  settingsSet: (payload: { key: string; value: any }) => Promise<{ ok: boolean }>;
  settingsCheckTeX: () => Promise<{ found: boolean; paths: any }>;

  // Event listeners
  onCompileProgress: (callback: (event: any, data: any) => void) => void;
  removeCompileProgressListener: (callback: (event: any, data: any) => void) => void;
  onFileChanged: (callback: (event: any, data: any) => void) => void;
  removeFileChangedListener: (callback: (event: any, data: any) => void) => void;
  // Milestone 5: Queue state change event listeners
  onQueueStateChange: (callback: (event: any, data: any) => void) => void;
  removeQueueStateChangeListener: (callback: (event: any, data: any) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
