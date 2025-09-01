"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoCompileService = void 0;
const events_1 = require("events");
/**
 * AutoCompileService - A dedicated service for handling auto-compilation
 * This service is completely independent of manual compilation and maintains
 * its own state based on settings.
 */
class AutoCompileService extends events_1.EventEmitter {
    constructor(compileOrchestrator, settingsService) {
        super();
        this.activeJobs = new Map();
        this.activeCompileJobs = new Map(); // projectId -> jobId mapping for auto-compiles
        this.isEnabled = false;
        this.delay = 1000; // 1 second default delay
        this.compileOrchestrator = compileOrchestrator;
        this.settingsService = settingsService;
        this.setupCompileListeners();
        this.loadSettings();
    }
    setupCompileListeners() {
        // Listen for compilation progress events to detect auto-compile completion
        this.compileOrchestrator.on('progress', (data) => {
            // Check if this is an auto-compile job by matching jobId
            for (const [projectId, jobId] of this.activeCompileJobs.entries()) {
                if (data.jobId === jobId) {
                    console.log(`[AutoCompileService] Received progress for auto-compile jobId ${jobId}:`, JSON.stringify(data));
                    // Only emit progress events that have meaningful state
                    if (data.state) {
                        // Forward the progress event as an auto-compile event
                        this.emit('autoCompileProgress', {
                            projectId,
                            jobId: data.jobId,
                            state: data.state,
                            message: data.message,
                            percent: data.percent
                        });
                        // If compilation finished, clean up the tracking
                        if (data.state === 'success' || data.state === 'error' || data.state === 'killed') {
                            console.log(`[AutoCompileService] Auto-compile ${data.state} for project: ${projectId}, jobId: ${jobId}`);
                            this.activeCompileJobs.delete(projectId);
                        }
                    }
                    break;
                }
            }
        });
    }
    async loadSettings() {
        try {
            this.isEnabled = await this.settingsService.get('autoCompileEnabled') || false;
            this.delay = await this.settingsService.get('autoCompileDelay') || 1000;
            console.log(`[AutoCompileService] Loaded settings - enabled: ${this.isEnabled}, delay: ${this.delay}ms`);
        }
        catch (error) {
            console.error('[AutoCompileService] Failed to load settings:', error);
        }
    }
    async setEnabled(enabled) {
        console.log(`[AutoCompileService] Setting enabled: ${enabled}`);
        this.isEnabled = enabled;
        try {
            await this.settingsService.set('autoCompileEnabled', enabled);
            console.log(`[AutoCompileService] Saved enabled state: ${enabled}`);
        }
        catch (error) {
            console.error('[AutoCompileService] Failed to save enabled state:', error);
        }
        // If disabling, cancel all active jobs
        if (!enabled) {
            this.cancelAllJobs();
        }
    }
    async setDelay(delayMs) {
        console.log(`[AutoCompileService] Setting delay: ${delayMs}ms`);
        this.delay = Math.max(100, Math.min(delayMs, 10000)); // Clamp between 100ms and 10s
        try {
            await this.settingsService.set('autoCompileDelay', this.delay);
            console.log(`[AutoCompileService] Saved delay: ${this.delay}ms`);
        }
        catch (error) {
            console.error('[AutoCompileService] Failed to save delay:', error);
        }
    }
    getEnabled() {
        return this.isEnabled;
    }
    getDelay() {
        return this.delay;
    }
    /**
     * Trigger auto-compile for a project (called when a .tex file is saved)
     */
    triggerCompile(projectId) {
        if (!this.isEnabled) {
            console.log(`[AutoCompileService] Auto-compile disabled, skipping for project: ${projectId}`);
            return;
        }
        console.log(`[AutoCompileService] Trigger auto-compile for project: ${projectId}`);
        // Cancel any existing job for this project
        this.cancelJob(projectId);
        // Schedule new job
        const timer = setTimeout(async () => {
            await this.executeCompile(projectId);
            this.activeJobs.delete(projectId);
        }, this.delay);
        this.activeJobs.set(projectId, { projectId, timer });
        console.log(`[AutoCompileService] Scheduled auto-compile for project ${projectId} in ${this.delay}ms`);
    }
    async executeCompile(projectId) {
        if (!this.isEnabled) {
            console.log(`[AutoCompileService] Auto-compile disabled during execution, skipping for project: ${projectId}`);
            return;
        }
        console.log(`[AutoCompileService] Executing auto-compile for project: ${projectId}`);
        try {
            const result = await this.compileOrchestrator.run(projectId, undefined, undefined, true); // isAutoCompile = true
            console.log(`[AutoCompileService] Auto-compile started successfully for project: ${projectId}, jobId: ${result.jobId}`);
            // Track this job so we can detect its completion
            this.activeCompileJobs.set(projectId, result.jobId);
            // Emit event for UI updates
            this.emit('autoCompileStarted', { projectId, jobId: result.jobId });
        }
        catch (error) {
            console.error(`[AutoCompileService] Failed to execute auto-compile for project: ${projectId}`, error);
            this.emit('autoCompileError', { projectId, error });
        }
    }
    cancelJob(projectId) {
        const existingJob = this.activeJobs.get(projectId);
        if (existingJob) {
            clearTimeout(existingJob.timer);
            this.activeJobs.delete(projectId);
            console.log(`[AutoCompileService] Cancelled existing auto-compile job for project: ${projectId}`);
        }
    }
    cancelAllJobs() {
        console.log(`[AutoCompileService] Cancelling all auto-compile jobs (${this.activeJobs.size} active)`);
        for (const job of this.activeJobs.values()) {
            clearTimeout(job.timer);
        }
        this.activeJobs.clear();
    }
    /**
     * Get status information
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            delay: this.delay,
            activeJobs: this.activeJobs.size
        };
    }
    /**
     * Cleanup on service shutdown
     */
    destroy() {
        console.log('[AutoCompileService] Destroying service');
        this.cancelAllJobs();
        this.activeCompileJobs.clear();
        this.removeAllListeners();
    }
}
exports.AutoCompileService = AutoCompileService;
//# sourceMappingURL=AutoCompileService.js.map