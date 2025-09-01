import { FileNode } from '../types';
import { AutoCompileService } from './AutoCompileService';
import { BrowserWindow } from 'electron';
export declare class FileService {
    private projectService;
    private autoCompileService?;
    private watchers;
    private internalWrites;
    private recentWrites;
    constructor(autoCompileService?: AutoCompileService);
    private getProjectRoot;
    private validatePath;
    listTree(projectId: string): Promise<FileNode[]>;
    private buildFileTree;
    readFile(projectId: string, relPath: string): Promise<string | Uint8Array>;
    writeFile(projectId: string, relPath: string, content: string, isAutosave?: boolean): Promise<{
        ok: boolean;
        mtime: string;
    }>;
    startWatching(projectId: string, mainWindow: BrowserWindow): Promise<void>;
    stopWatching(projectId: string): Promise<void>;
    stopAllWatching(): Promise<void>;
    createFile(projectId: string, relPath: string): Promise<{
        ok: boolean;
    }>;
    createDirectory(projectId: string, relPath: string): Promise<{
        ok: boolean;
    }>;
    rename(projectId: string, oldPath: string, newPath: string): Promise<{
        ok: boolean;
    }>;
    delete(projectId: string, relPath: string): Promise<{
        ok: boolean;
    }>;
    private deleteDirectory;
}
//# sourceMappingURL=FileService.d.ts.map