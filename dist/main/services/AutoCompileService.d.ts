import { EventEmitter } from 'events';
import { CompileOrchestrator } from './CompileOrchestrator';
import { SettingsService } from './SettingsService';
/**
 * AutoCompileService - A dedicated service for handling auto-compilation
 * This service is completely independent of manual compilation and maintains
 * its own state based on settings.
 */
export declare class AutoCompileService extends EventEmitter {
    private compileOrchestrator;
    private settingsService;
    private activeJobs;
    private activeCompileJobs;
    private isEnabled;
    private delay;
    constructor(compileOrchestrator: CompileOrchestrator, settingsService: SettingsService);
    private setupCompileListeners;
    private loadSettings;
    setEnabled(enabled: boolean): Promise<void>;
    setDelay(delayMs: number): Promise<void>;
    getEnabled(): boolean;
    getDelay(): number;
    /**
     * Trigger auto-compile for a project (called when a .tex file is saved)
     */
    triggerCompile(projectId: string): void;
    private executeCompile;
    private cancelJob;
    private cancelAllJobs;
    /**
     * Get status information
     */
    getStatus(): {
        enabled: boolean;
        delay: number;
        activeJobs: number;
    };
    /**
     * Cleanup on service shutdown
     */
    destroy(): void;
}
//# sourceMappingURL=AutoCompileService.d.ts.map