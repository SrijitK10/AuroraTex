import { EventEmitter } from 'events';
import { CompileStatusDTO, ErrorDTO } from '../types';
export declare class CompileOrchestrator extends EventEmitter {
    private jobs;
    private queue;
    private running;
    private projectService;
    private settingsService;
    constructor();
    createMockPDF(projectId: string): Promise<void>;
    run(projectId: string, engine?: string, mainFile?: string): Promise<{
        jobId: string;
    }>;
    cancel(jobId: string): Promise<{
        ok: boolean;
    }>;
    getStatus(jobId: string): CompileStatusDTO | null;
    getErrors(jobId: string): ErrorDTO[];
    private emitProgress;
    private processQueue;
    private executeJob;
    private copyProjectFiles;
    private runLatexmk;
    private parseLatexErrors;
}
//# sourceMappingURL=CompileOrchestrator.d.ts.map