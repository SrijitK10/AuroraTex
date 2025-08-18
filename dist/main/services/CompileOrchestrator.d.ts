import { EventEmitter } from 'events';
import { CompileStatusDTO, ErrorDTO } from '../types';
export declare class CompileOrchestrator extends EventEmitter {
    private jobs;
    private queue;
    private running;
    private projectService;
    private settingsService;
    private maxConcurrency;
    private currentlyRunning;
    private logBuffers;
    private autoCompileTimers;
    private lastCompileEnd;
    private pendingAutoCompile;
    private autoCompileDebounceMs;
    private autoCompileMinInterval;
    constructor();
    triggerAutoCompile(projectId: string): void;
    private handleAutoCompile;
    getQueueState(): {
        state: 'idle' | 'queued' | 'building';
        queueLength: number;
        currentJobs: Array<{
            jobId: string;
            projectId: string;
            isAutoCompile: boolean;
        }>;
    };
    createMockPDF(projectId: string): Promise<void>;
    run(projectId: string, engine?: string, mainFile?: string, isAutoCompile?: boolean): Promise<{
        jobId: string;
    }>;
    private writeFullLogFile;
    private emitQueueStateChange;
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