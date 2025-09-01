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
    private persistentBuildDirs;
    private lastCleanBuild;
    private buildDirModTimes;
    constructor();
    setAutoCompileDelay(delayMs: number): void;
    getAutoCompileDelay(): number;
    resetProjectState(projectId: string): void;
    triggerAutoCompile(projectId: string): {
        ok: boolean;
        scheduled: boolean;
    };
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
    private shouldUseIncrementalBuild;
    private getOrCreatePersistentBuildDir;
    cleanBuildDir(projectId: string): Promise<{
        ok: boolean;
    }>;
    run(projectId: string, engine?: string, mainFile?: string, isAutoCompile?: boolean, forceClean?: boolean): Promise<{
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
    private runSecureLatexmk;
    private createSanitizedEnvironment;
    private killProcessTree;
    private parseLatexErrors;
    private updateFileStack;
    private findLineNumber;
    private findPreviousErrorMessage;
    private mapTempPathToProject;
}
//# sourceMappingURL=CompileOrchestrator.d.ts.map