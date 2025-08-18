import { SnapshotDTO } from '../types';
export declare class SnapshotService {
    private projectService;
    constructor();
    create(projectId: string, message?: string): Promise<SnapshotDTO>;
    list(projectId: string): Promise<SnapshotDTO[]>;
    restore(snapshotId: string): Promise<{
        ok: boolean;
    }>;
    private createTarball;
    private collectFiles;
    private extractTarball;
    delete(snapshotId: string): Promise<{
        ok: boolean;
    }>;
}
//# sourceMappingURL=SnapshotService.d.ts.map