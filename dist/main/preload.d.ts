import { ErrorDTO } from './types';
export interface ElectronAPI {
    dialogShowOpenDialog: () => Promise<{
        canceled: boolean;
        filePaths?: string[];
    }>;
    projectCreate: (payload: {
        name: string;
        path?: string;
        templateId?: string;
    }) => Promise<any>;
    projectOpen: (payload: {
        path: string;
    }) => Promise<any>;
    projectList: () => Promise<any[]>;
    projectSetMain: (payload: {
        projectId: string;
        relPath: string;
    }) => Promise<{
        ok: boolean;
    }>;
    projectOutputPath: (payload: {
        projectId: string;
        file?: string;
    }) => Promise<string>;
    fsListTree: (payload: {
        projectId: string;
    }) => Promise<any[]>;
    fsReadFile: (payload: {
        projectId: string;
        relPath: string;
    }) => Promise<string | Uint8Array>;
    fsWriteFile: (payload: {
        projectId: string;
        relPath: string;
        content: string;
        isAutosave?: boolean;
    }) => Promise<{
        ok: boolean;
        mtime: string;
    }>;
    fsCreateFile: (payload: {
        projectId: string;
        relPath: string;
    }) => Promise<{
        ok: boolean;
    }>;
    fsCreateDir: (payload: {
        projectId: string;
        relPath: string;
    }) => Promise<{
        ok: boolean;
    }>;
    fsRename: (payload: {
        projectId: string;
        oldPath: string;
        newPath: string;
    }) => Promise<{
        ok: boolean;
    }>;
    fsDelete: (payload: {
        projectId: string;
        relPath: string;
    }) => Promise<{
        ok: boolean;
    }>;
    fsStartWatching: (payload: {
        projectId: string;
    }) => Promise<{
        ok: boolean;
    }>;
    fsStopWatching: (payload: {
        projectId: string;
    }) => Promise<{
        ok: boolean;
    }>;
    compileRun: (payload: {
        projectId: string;
        engine?: string;
        mainFile?: string;
        isAutoCompile?: boolean;
    }) => Promise<{
        jobId: string;
    }>;
    compileStatus: (payload: {
        jobId: string;
    }) => Promise<any>;
    compileErrors: (payload: {
        jobId: string;
    }) => Promise<ErrorDTO[]>;
    compileCancel: (payload: {
        jobId: string;
    }) => Promise<{
        ok: boolean;
    }>;
    compileMock: (payload: {
        projectId: string;
    }) => Promise<{
        ok: boolean;
    }>;
    compileQueueState: (payload: {
        projectId: string;
    }) => Promise<{
        pending: number;
        running: number;
        maxConcurrency: number;
    }>;
    compileTriggerAutoCompile: (payload: {
        projectId: string;
    }) => Promise<{
        ok: boolean;
    }>;
    snapshotCreate: (payload: {
        projectId: string;
        message?: string;
    }) => Promise<any>;
    snapshotList: (payload: {
        projectId: string;
    }) => Promise<any[]>;
    snapshotRestore: (payload: {
        snapshotId: string;
    }) => Promise<{
        ok: boolean;
    }>;
    snapshotDelete: (payload: {
        snapshotId: string;
    }) => Promise<{
        ok: boolean;
    }>;
    settingsGet: (payload: {
        key: string;
    }) => Promise<any>;
    settingsSet: (payload: {
        key: string;
        value: any;
    }) => Promise<{
        ok: boolean;
    }>;
    settingsCheckTeX: () => Promise<{
        found: boolean;
        paths: any;
    }>;
    templateList: () => Promise<any[]>;
    templateApply: (payload: {
        projectId: string;
        templateId: string;
        projectRoot: string;
    }) => Promise<{
        ok: boolean;
    }>;
    snippetList: () => Promise<any[]>;
    snippetSearch: (payload: {
        query: string;
    }) => Promise<any[]>;
    snippetGetByCategory: (payload: {
        category: string;
    }) => Promise<any[]>;
    bibTexParse: (payload: {
        projectId: string;
        fileName: string;
    }) => Promise<any[]>;
    bibTexWrite: (payload: {
        projectId: string;
        fileName: string;
        entries: any[];
    }) => Promise<{
        ok: boolean;
    }>;
    bibTexCreateEntry: (payload: {
        type: string;
    }) => Promise<any>;
    bibTexGetEntryTypes: () => Promise<any[]>;
    onCompileProgress: (callback: (event: any, data: any) => void) => void;
    removeCompileProgressListener: (callback: (event: any, data: any) => void) => void;
    onFileChanged: (callback: (event: any, data: any) => void) => void;
    removeFileChangedListener: (callback: (event: any, data: any) => void) => void;
    onQueueStateChange: (callback: (event: any, data: any) => void) => void;
    removeQueueStateChangeListener: (callback: (event: any, data: any) => void) => void;
}
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
//# sourceMappingURL=preload.d.ts.map