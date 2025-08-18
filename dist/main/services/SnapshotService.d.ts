import { SnapshotDTO } from '../types';
import { ProjectService } from './ProjectService';
export declare class SnapshotService {
    private projectService;
    constructor(projectService?: ProjectService);
    create(projectId: string, message?: string): Promise<SnapshotDTO>;
    list(projectId: string): Promise<SnapshotDTO[]>;
    restore(snapshotId: string): Promise<{
        ok: boolean;
    }>;
    /**
     * Clean project directory, preserving .history and output directories
     */
    private cleanProjectDirectory;
    /**
     * Copy all contents from source to destination directory
     */
    private copyDirectoryContents;
    /**
     * Recursively remove a directory and all its contents
     */
    private removeDirectory;
    private createTarball;
    /**
     * Format bytes to human readable string
     */
    private formatBytes;
    delete(snapshotId: string): Promise<{
        ok: boolean;
    }>;
}
//# sourceMappingURL=SnapshotService.d.ts.map