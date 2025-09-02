import { spawn, ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { mkdir, copyFile, readdir, stat, readFile, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir, platform } from 'os';
import { EventEmitter } from 'events';
import { CompileStatusDTO, ErrorDTO } from '../types';
import { ProjectService } from './ProjectService';
import { SettingsService } from './SettingsService';

interface CompileJob {
  id: string;
  projectId: string;
  state: 'queued' | 'running' | 'success' | 'error' | 'killed' | 'cancelled';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  logs: string[];
  errors: ErrorDTO[];
  process?: ChildProcess;
  buildDir?: string;
  isAutoCompile?: boolean; // Milestone 5: Track auto vs manual compile
  priority?: number; // Milestone 5: Job priority (manual > auto)
  isIncrementalBuild?: boolean; // Milestone 13: Track incremental vs clean builds
  useExistingBuildDir?: boolean; // Milestone 13: Reuse build directory for speed
}

// Milestone 5: Circular buffer for log storage
class CircularBuffer {
  private buffer: string[] = [];
  private maxSize: number;
  private currentIndex = 0;
  private isFull = false;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  add(item: string): void {
    this.buffer[this.currentIndex] = item;
    this.currentIndex = (this.currentIndex + 1) % this.maxSize;
    if (this.currentIndex === 0) {
      this.isFull = true;
    }
  }

  getAll(): string[] {
    if (!this.isFull) {
      return this.buffer.slice(0, this.currentIndex);
    }
    return [
      ...this.buffer.slice(this.currentIndex),
      ...this.buffer.slice(0, this.currentIndex)
    ];
  }

  clear(): void {
    this.buffer = [];
    this.currentIndex = 0;
    this.isFull = false;
  }
}

export class CompileOrchestrator extends EventEmitter {
  private jobs: Map<string, CompileJob> = new Map();
  private queue: string[] = [];
  private running = false;
  private projectService: ProjectService;
  private settingsService: SettingsService;
  
  // Milestone 5: Enhanced queue management
  private maxConcurrency = 1; // Milestone 5: Concurrency=1 as specified
  private currentlyRunning = 0;
  private logBuffers: Map<string, CircularBuffer> = new Map(); // Milestone 5: Circular buffer per job
  
  // Milestone 5: Auto-compile debouncing
  private autoCompileTimers: Map<string, NodeJS.Timeout> = new Map(); // projectId -> timer
  private lastCompileEnd: Map<string, number> = new Map(); // projectId -> timestamp
  private pendingAutoCompile: Map<string, boolean> = new Map(); // projectId -> needsBuild flag
  private autoCompileDebounceMs = 750; // Default 750ms debounce
  private autoCompileMinInterval = 2000; // 2 seconds minimum between auto-compiles

  // Milestone 13: Incremental build management
  private persistentBuildDirs: Map<string, string> = new Map(); // projectId -> buildDir
  private lastCleanBuild: Map<string, number> = new Map(); // projectId -> timestamp
  private buildDirModTimes: Map<string, Map<string, number>> = new Map(); // projectId -> file -> mtime

  constructor() {
    super();
    this.projectService = new ProjectService();
    this.settingsService = new SettingsService();
  }

  // Set auto-compile debounce delay
  setAutoCompileDelay(delayMs: number): void {
    if (delayMs >= 100 && delayMs <= 10000) {
      this.autoCompileDebounceMs = delayMs;
      console.log(`[CompileOrchestrator] Auto-compile delay set to: ${delayMs}ms`);
    }
  }

  // Get current auto-compile delay
  getAutoCompileDelay(): number {
    return this.autoCompileDebounceMs;
  }

  // Reset compilation state for a project (useful when enabling auto-compile after manual compiles)
  resetProjectState(projectId: string): void {
    console.log(`[CompileOrchestrator] Resetting compilation state for project: ${projectId}`);
    
    // Clear any pending auto-compile timers
    const existingTimer = this.autoCompileTimers.get(projectId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.autoCompileTimers.delete(projectId);
    }
    
    // Reset pending auto-compile flag
    this.pendingAutoCompile.set(projectId, false);
    
    // Clear last compile time to allow immediate auto-compile
    this.lastCompileEnd.delete(projectId);
    
    console.log(`[CompileOrchestrator] Project state reset completed for: ${projectId}`);
  }

  // Milestone 5: Debounced auto-compile triggered by file saves
  triggerAutoCompile(projectId: string): { ok: boolean; scheduled: boolean } {
    console.log(`[CompileOrchestrator] Auto-compile triggered for project: ${projectId}`);
    
    // Clear existing timer
    const existingTimer = this.autoCompileTimers.get(projectId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      console.log(`[CompileOrchestrator] Cleared existing auto-compile timer for project: ${projectId}`);
    }

    // Set new debounced timer
    const timer = setTimeout(() => {
      this.handleAutoCompile(projectId);
      this.autoCompileTimers.delete(projectId);
    }, this.autoCompileDebounceMs);

    this.autoCompileTimers.set(projectId, timer);
    console.log(`[CompileOrchestrator] Auto-compile scheduled for project: ${projectId} in ${this.autoCompileDebounceMs}ms`);
    
    return { ok: true, scheduled: true };
  }

  // Milestone 5: Handle auto-compile with coalescing logic
  private async handleAutoCompile(projectId: string): Promise<void> {
    console.log(`[CompileOrchestrator] handleAutoCompile called for project: ${projectId}`);
    
    const lastCompileTime = this.lastCompileEnd.get(projectId) || 0;
    const timeSinceLastCompile = Date.now() - lastCompileTime;

    console.log(`[CompileOrchestrator] Time since last compile: ${timeSinceLastCompile}ms (min required: ${this.autoCompileMinInterval}ms)`);

    // Check if there's already a running job for this project
    const runningJob = Array.from(this.jobs.values()).find(
      job => job.projectId === projectId && job.state === 'running'
    );

    if (runningJob) {
      // Mark that we need to build again after current job finishes
      this.pendingAutoCompile.set(projectId, true);
      console.log(`[CompileOrchestrator] Job already running, marking auto-compile as pending for project: ${projectId}`);
      return;
    }

    // Check minimum interval between compiles
    if (timeSinceLastCompile < this.autoCompileMinInterval) {
      // Mark as pending and wait
      this.pendingAutoCompile.set(projectId, true);
      console.log(`[CompileOrchestrator] Auto-compile too soon (${timeSinceLastCompile}ms < ${this.autoCompileMinInterval}ms), marking as pending for project: ${projectId}`);
      return;
    }

    // Clear pending flag and trigger compile
    this.pendingAutoCompile.set(projectId, false);
    console.log(`[CompileOrchestrator] Starting auto-compile for project: ${projectId}`);
    
    try {
      const result = await this.run(projectId, undefined, undefined, true); // isAutoCompile = true
      console.log(`[CompileOrchestrator] Auto-compile started successfully for project: ${projectId}, jobId: ${result.jobId}`);
    } catch (error) {
      console.error(`[CompileOrchestrator] Failed to start auto-compile for project: ${projectId}`, error);
    }
  }

  // Milestone 5: Get overall queue state for UI
  getQueueState(): { 
    state: 'idle' | 'queued' | 'building'; 
    queueLength: number; 
    currentJobs: Array<{jobId: string, projectId: string, isAutoCompile: boolean}> 
  } {
    const runningJobs = Array.from(this.jobs.values()).filter(job => job.state === 'running');
    const queuedJobs = Array.from(this.jobs.values()).filter(job => job.state === 'queued');
    
    let state: 'idle' | 'queued' | 'building' = 'idle';
    if (runningJobs.length > 0) {
      state = 'building';
    } else if (queuedJobs.length > 0) {
      state = 'queued';
    }

    return {
      state,
      queueLength: queuedJobs.length,
      currentJobs: runningJobs.map(job => ({
        jobId: job.id,
        projectId: job.projectId,
        isAutoCompile: job.isAutoCompile || false
      }))
    };
  }

  // Milestone 13: Check if incremental build is possible and beneficial
  private async shouldUseIncrementalBuild(projectId: string): Promise<boolean> {
    const settings = await this.settingsService.getIncrementalBuildSettings();
    if (!settings.enabled) return false;

    const lastClean = this.lastCleanBuild.get(projectId) || 0;
    const hoursSinceClean = (Date.now() - lastClean) / (1000 * 60 * 60);
    
    // Force clean build if it's been too long
    if (hoursSinceClean > settings.cleanBuildThreshold) {
      console.log(`[CompileOrchestrator] Forcing clean build for ${projectId} - ${hoursSinceClean.toFixed(1)} hours since last clean`);
      return false;
    }

    // Check if persistent build directory exists
    const persistentDir = this.persistentBuildDirs.get(projectId);
    if (!persistentDir || !existsSync(persistentDir)) {
      console.log(`[CompileOrchestrator] No persistent build dir for ${projectId}, using clean build`);
      return false;
    }

    return true;
  }

  // Milestone 13: Get or create persistent build directory for incremental builds
  private async getOrCreatePersistentBuildDir(projectId: string): Promise<string> {
    let buildDir = this.persistentBuildDirs.get(projectId);
    
    if (!buildDir || !existsSync(buildDir)) {
      // Create new persistent build directory
      const tempBasePath = join(tmpdir(), 'overleaf-builds');
      await mkdir(tempBasePath, { recursive: true });
      buildDir = join(tempBasePath, `build-${projectId}-${Date.now()}`);
      await mkdir(buildDir, { recursive: true });
      
      this.persistentBuildDirs.set(projectId, buildDir);
      console.log(`[CompileOrchestrator] Created persistent build dir: ${buildDir}`);
    }
    
    return buildDir;
  }

  // Milestone 13: Clean build directory for a project
  async cleanBuildDir(projectId: string): Promise<{ ok: boolean }> {
    try {
      const buildDir = this.persistentBuildDirs.get(projectId);
      if (buildDir && existsSync(buildDir)) {
        await rm(buildDir, { recursive: true, force: true });
        console.log(`[CompileOrchestrator] Cleaned build directory: ${buildDir}`);
      }
      
      this.persistentBuildDirs.delete(projectId);
      this.buildDirModTimes.delete(projectId);
      this.lastCleanBuild.set(projectId, Date.now());
      
      return { ok: true };
    } catch (error) {
      console.error(`[CompileOrchestrator] Failed to clean build dir for ${projectId}:`, error);
      return { ok: false };
    }
  }

  async run(projectId: string, engine?: string, mainFile?: string, isAutoCompile = false, forceClean = false): Promise<{ jobId: string }> {
    const project = await this.projectService.getById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Milestone 13: Determine if this should be an incremental build
    const useIncremental = !forceClean && await this.shouldUseIncrementalBuild(projectId);

    const jobId = uuidv4();
    const job: CompileJob = {
      id: jobId,
      projectId,
      state: 'queued',
      progress: 0,
      logs: [],
      errors: [],
      isAutoCompile, // Milestone 5: Track auto vs manual compile
      priority: isAutoCompile ? 2 : 1, // Milestone 5: Manual jobs have higher priority
      isIncrementalBuild: useIncremental, // Milestone 13: Track incremental builds
      useExistingBuildDir: useIncremental, // Milestone 13: Reuse build directory
    };

    this.jobs.set(jobId, job);
    
    // Milestone 5: Sort queue by priority (manual jobs first)
    this.queue.push(jobId);
    this.queue.sort((a, b) => {
      const jobA = this.jobs.get(a);
      const jobB = this.jobs.get(b);
      return (jobA?.priority || 3) - (jobB?.priority || 3);
    });

    // Milestone 5: Initialize circular buffer for this job
    this.logBuffers.set(jobId, new CircularBuffer(1000));

    // Emit queue state change
    this.emitQueueStateChange();

    // Start processing queue if under concurrency limit
    if (this.currentlyRunning < this.maxConcurrency) {
      this.processQueue();
    }

    return { jobId };
  }

  // Milestone 5: Emit queue state changes for UI updates
  // Milestone 5: Write circular buffer logs to file after job completion
  private async writeFullLogFile(job: CompileJob) {
    try {
      const project = await this.projectService.getById(job.projectId);
      if (!project) return;
      
      const outputDir = join(project.root, 'output');
      await mkdir(outputDir, { recursive: true });
      
      const logFilePath = join(outputDir, 'compile.log');
      
      // Get all buffered logs for this job
      const allLogs = job.logs.slice(); // Get all logs from the job's log array
      
      if (allLogs.length > 0) {
        const logContent = allLogs.join('\n');
        await writeFile(logFilePath, logContent, 'utf8');
        console.log(`[CompileOrchestrator] Wrote ${allLogs.length} log lines to: ${logFilePath}`);
      }
    } catch (error) {
      console.error('[CompileOrchestrator] Failed to write log file:', error);
    }
  }

  // Helper method for robust file copying with retries and validation
  private async robustFileCopy(sourcePath: string, destPath: string, fileType: string, maxRetries = 3): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait a bit between attempts to handle filesystem timing issues
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
        
        // Verify source file exists and has content
        const sourceStats = await stat(sourcePath);
        if (sourceStats.size === 0) {
          throw new Error(`Source ${fileType} file is empty`);
        }
        
        // Perform the copy
        await copyFile(sourcePath, destPath);
        
        // Verify the copy was successful
        const destStats = await stat(destPath);
        if (destStats.size !== sourceStats.size) {
          throw new Error(`${fileType} copy size mismatch: ${destStats.size} vs ${sourceStats.size}`);
        }
        
        console.log(`[CompileOrchestrator] Successfully copied ${fileType} (${sourceStats.size} bytes) on attempt ${attempt}`);
        return; // Success!
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[CompileOrchestrator] Copy attempt ${attempt} failed for ${fileType}:`, lastError.message);
        
        // Clean up partial copy on failure
        try {
          if (existsSync(destPath)) {
            await rm(destPath);
          }
        } catch (cleanupError) {
          console.warn(`[CompileOrchestrator] Failed to cleanup partial copy:`, cleanupError);
        }
      }
    }
    
    throw new Error(`Failed to copy ${fileType} after ${maxRetries} attempts: ${lastError?.message}`);
  }

  private emitQueueStateChange(): void {
    const queueState = this.getQueueState();
    this.emit('queueState', queueState);
  }

  async cancel(jobId: string): Promise<{ ok: boolean }> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { ok: false };
    }

    if (job.state === 'running' && job.process) {
      job.process.kill('SIGTERM');
      job.state = 'cancelled';
      job.endTime = new Date();
    } else if (job.state === 'queued') {
      job.state = 'cancelled';
      const queueIndex = this.queue.indexOf(jobId);
      if (queueIndex > -1) {
        this.queue.splice(queueIndex, 1);
      }
    }

    return { ok: true };
  }

  getStatus(jobId: string): CompileStatusDTO | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      jobId: job.id,
      state: job.state,
      progress: job.progress,
      startTime: job.startTime?.toISOString(),
      endTime: job.endTime?.toISOString(),
      logs: job.logs,
    };
  }

  getErrors(jobId: string): ErrorDTO[] {
    const job = this.jobs.get(jobId);
    return job ? job.errors : [];
  }

  private emitProgress(jobId: string, data: { 
    state?: string; 
    line?: string; 
    percent?: number; 
    message?: string 
  }) {
    this.emit('progress', {
      jobId,
      ...data
    });
  }

  // Milestone 5: Enhanced queue processing with concurrency control
  private async processQueue() {
    // Process jobs while we have capacity and queued jobs
    while (this.currentlyRunning < this.maxConcurrency && this.queue.length > 0) {
      const jobId = this.queue.shift()!;
      const job = this.jobs.get(jobId);
      
      if (!job || job.state === 'cancelled') {
        continue;
      }

      // Start job execution (don't await - run concurrently)
      this.executeJob(job).catch(error => {
        console.error(`[CompileOrchestrator] Job execution failed: ${error}`);
      });
    }
  }

  private async executeJob(job: CompileJob) {
    // Milestone 5: Track concurrency
    this.currentlyRunning++;
    this.emitQueueStateChange();

    let cleanupPaths: string[] = []; // Track paths to cleanup
    
    try {
      job.state = 'running';
      job.startTime = new Date();
      job.progress = 10;
      
      // Emit initial progress
      this.emitProgress(job.id, { 
        state: 'running', 
        percent: 10, 
        message: 'Starting compilation...' 
      });

      const project = await this.projectService.getById(job.projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Milestone 10: Check shell-escape setting and warn if enabled
      if (project.settings.shellEscape) {
        job.logs.push('⚠️  WARNING: Shell-escape is ENABLED for this project. This can execute arbitrary system commands!');
        this.emitProgress(job.id, { 
          line: '⚠️  WARNING: Shell-escape is ENABLED for this project. This can execute arbitrary system commands!',
          message: 'Shell-escape enabled - security warning' 
        });
      }

      // Milestone 10 & 13: Create build directory (incremental or secure temp)
      let buildDir: string;
      
      if (job.useExistingBuildDir) {
        // Milestone 13: Use persistent build directory for incremental builds
        buildDir = await this.getOrCreatePersistentBuildDir(job.projectId);
        job.logs.push(`🔄 Using incremental build directory: ${buildDir}`);
        this.emitProgress(job.id, { 
          line: `🔄 Using incremental build directory for faster compilation`,
          message: 'Using incremental build directory' 
        });
      } else {
        // Milestone 10: Create secure temporary build directory under app control
        buildDir = join(tmpdir(), 'texlab-secure', `build-${job.id}`);
        await mkdir(buildDir, { recursive: true });
        cleanupPaths.push(buildDir); // Mark for cleanup only if not persistent
        job.logs.push(`🗂️  Created clean build directory: ${buildDir}`);
        this.emitProgress(job.id, { 
          line: `🗂️  Created clean build directory for fresh compilation`,
          message: 'Created clean build directory' 
        });
      }
      
      job.buildDir = buildDir;

      job.progress = 20;
      this.emitProgress(job.id, { 
        percent: 20, 
        message: 'Copying project files to secure build environment...' 
      });

      // Copy project files to build directory
      await this.copyProjectFiles(project.root, buildDir);
      job.progress = 40;
      this.emitProgress(job.id, { 
        percent: 40, 
        message: 'Setting up secure TeX environment...' 
      });

      // Get LaTeX binary path
      const engine = project.settings.engine || 'pdflatex';
      const latexmkPath = await this.settingsService.getTexBinaryPath('latexmk');
      
      console.log(`[CompileOrchestrator] Looking for latexmk, found: ${latexmkPath}`);
      console.log(`[CompileOrchestrator] Using engine: ${engine}`);
      
      if (!latexmkPath) {
        throw new Error('latexmk not found. Please install TeX Live or configure TeX paths.');
      }

      job.progress = 50;
      this.emitProgress(job.id, { 
        percent: 50, 
        message: 'Running LaTeX compilation in sandboxed environment...' 
      });

      // Milestone 10: Run compilation with enhanced security
      console.log(`[CompileOrchestrator] Starting secure compilation with latexmk at: ${latexmkPath}`);
      console.log(`[CompileOrchestrator] Secure build directory: ${buildDir}`);
      console.log(`[CompileOrchestrator] Main file: ${project.mainFile}`);
      await this.runSecureLatexmk(job, latexmkPath, buildDir, project.mainFile, engine, project.settings.shellEscape);

      // Enhanced PDF copy with reliability improvements
      const outputDir = join(project.root, 'output');
      await mkdir(outputDir, { recursive: true });
      
      // Always copy compile.log (Milestone 4: keep compile.log on error)
      const logPath = join(buildDir, project.mainFile.replace('.tex', '.log'));
      if (existsSync(logPath)) {
        await this.robustFileCopy(logPath, join(outputDir, 'compile.log'), 'compile.log');
      }
      
      const pdfPath = join(buildDir, project.mainFile.replace('.tex', '.pdf'));
      if (existsSync(pdfPath)) {
        // Validate PDF exists and has content before copying
        const pdfStats = await stat(pdfPath);
        if (pdfStats.size > 1024) { // PDF should be at least 1KB
          await this.robustFileCopy(pdfPath, join(outputDir, 'main.pdf'), 'main.pdf');
          
          // Final verification that PDF was copied successfully
          const destPdfPath = join(outputDir, 'main.pdf');
          if (existsSync(destPdfPath)) {
            const destStats = await stat(destPdfPath);
            if (destStats.size === pdfStats.size) {
              job.state = 'success';
              this.emitProgress(job.id, { 
                state: 'success', 
                percent: 100, 
                message: 'Compilation completed successfully!' 
              });
            } else {
              job.state = 'error';
              job.logs.push('ERROR: PDF copy verification failed - size mismatch');
              this.emitProgress(job.id, { 
                state: 'error', 
                message: 'PDF copy verification failed' 
              });
            }
          } else {
            job.state = 'error';
            job.logs.push('ERROR: PDF copy failed - destination file not found');
            this.emitProgress(job.id, { 
              state: 'error', 
              message: 'PDF copy failed' 
            });
          }
        } else {
          job.state = 'error';
          job.logs.push('ERROR: PDF file is too small (possibly corrupted)');
          this.emitProgress(job.id, { 
            state: 'error', 
            message: 'PDF file is too small or corrupted' 
          });
        }
      } else {
        job.state = 'error';
        job.logs.push('ERROR: PDF file not generated');
        this.emitProgress(job.id, { 
          state: 'error', 
          message: 'PDF file not generated' 
        });
      }

      job.progress = 100;
      job.endTime = new Date();

    } catch (error) {
      job.state = 'error';
      job.endTime = new Date();
      const errorMessage = error instanceof Error ? error.message : String(error);
      job.logs.push(`ERROR: ${errorMessage}`);
      this.emitProgress(job.id, { 
        state: 'error', 
        message: errorMessage 
      });
    } finally {
      // Milestone 10: Secure cleanup - always remove temporary build directories
      for (const path of cleanupPaths) {
        try {
          await rm(path, { recursive: true, force: true });
          console.log(`[CompileOrchestrator] Cleaned up temporary directory: ${path}`);
        } catch (cleanupError) {
          console.warn(`[CompileOrchestrator] Failed to cleanup temporary directory ${path}:`, cleanupError);
        }
      }
      
      // Milestone 5: Post-job cleanup and auto-compile handling
      this.currentlyRunning--;
      this.lastCompileEnd.set(job.projectId, Date.now());
      
      // Milestone 5: Write full log file at end
      await this.writeFullLogFile(job);
      
      // Check for pending auto-compile
      if (this.pendingAutoCompile.get(job.projectId)) {
        console.log(`[CompileOrchestrator] Processing pending auto-compile for project: ${job.projectId}`);
        // Clear the pending flag first to avoid loops
        this.pendingAutoCompile.set(job.projectId, false);
        
        // For pending auto-compiles, use a longer delay to respect the minimum interval
        const remainingInterval = this.autoCompileMinInterval - 1000; // Account for the 1s we already waited
        const delay = Math.max(remainingInterval, 1000); // At least 1s delay
        
        console.log(`[CompileOrchestrator] Scheduling pending auto-compile with ${delay}ms delay`);
        setTimeout(() => {
          this.handleAutoCompile(job.projectId);
        }, delay);
      }
      
      this.emitQueueStateChange();
      
      // Continue processing queue
      this.processQueue();
    }
  }

  private async copyProjectFiles(sourceDir: string, destDir: string) {
    const entries = await readdir(sourceDir);
    
    for (const entry of entries) {
      // Skip output directory and hidden files
      if (entry === 'output' || entry.startsWith('.')) {
        continue;
      }
      
      const sourcePath = join(sourceDir, entry);
      const destPath = join(destDir, entry);
      const stats = await stat(sourcePath);
      
      if (stats.isDirectory()) {
        await mkdir(destPath, { recursive: true });
        await this.copyProjectFiles(sourcePath, destPath);
      } else {
        await copyFile(sourcePath, destPath);
      }
    }
  }

  // Milestone 10: Enhanced secure compilation with sandboxing and process limits
  private async runSecureLatexmk(
    job: CompileJob, 
    latexmkPath: string, 
    buildDir: string, 
    mainFile: string, 
    engine: string, 
    shellEscapeEnabled: boolean
  ): Promise<void> {
    // Get timeout settings from global security configuration
    const globalSettings = await this.settingsService.getTexSettings();
    const manualTimeoutMs = globalSettings?.resourceLimits?.maxCompileTimeMs || 180000;
    const autoTimeoutMs = globalSettings?.resourceLimits?.autoCompileTimeoutMs || 120000;
    const timeoutMs = job.isAutoCompile ? autoTimeoutMs : manualTimeoutMs;
    
    return new Promise((resolve, reject) => {
      const args = [
        '-interaction=nonstopmode',
        '-halt-on-error',
        '-file-line-error',
      ];

      // Milestone 10: Shell-escape control - default OFF, explicit opt-in required
      if (shellEscapeEnabled) {
        args.push('-shell-escape');
        console.warn('[CompileOrchestrator] ⚠️  Shell-escape is ENABLED - security risk!');
      } else {
        args.push('-no-shell-escape'); // Explicitly disable shell-escape
      }

      // Add engine-specific flags
      switch (engine) {
        case 'xelatex':
          args.push('-xelatex');
          break;
        case 'lualatex':
          args.push('-lualatex');
          break;
        default:
          args.push('-pdf');
      }

      args.push(mainFile);

      // Milestone 10: Sanitized environment - pass minimal env (no secrets)
      const sanitizedEnv = this.createSanitizedEnvironment(buildDir);

      // Milestone 10: Spawn with enhanced security options
      const childProcess = spawn(latexmkPath, args, {
        cwd: buildDir,
        env: sanitizedEnv
      });

      // Milestone 10: Lower process priority on Unix systems (best effort)
      if (platform() !== 'win32' && childProcess.pid) {
        try {
          // Lower process priority using nice (higher nice value = lower priority)
          process.kill(childProcess.pid, 0); // Check if process exists
          spawn('renice', ['10', childProcess.pid.toString()], { stdio: 'ignore' });
          console.log(`[CompileOrchestrator] Lowered process priority for PID: ${childProcess.pid}`);
        } catch (error) {
          console.warn('[CompileOrchestrator] Failed to lower process priority:', error);
          // Continue execution - this is best effort
        }
      }

      job.process = childProcess;

      let logBuffer = '';

      // Milestone 5: Use circular buffer for efficient log management
      childProcess.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        logBuffer += text;
        
        // Split into lines and emit each line as progress
        const lines = text.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            job.logs.push(line); // Store in job logs
            this.logBuffers.get(job.projectId)?.add(line); // Also add to circular buffer
            
            // Emit live log lines (Milestone 4)
            this.emitProgress(job.id, { 
              line: line,
              percent: Math.min(90, job.progress + 2) // Milestone 5: smoother progress
            });
          }
        });
        
        job.progress = Math.min(90, job.progress + 2); // Milestone 5: smoother increments
      });

      childProcess.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        logBuffer += text;
        
        // Split into lines and emit each line as progress
        const lines = text.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            const logLine = `STDERR: ${line}`;
            job.logs.push(logLine); // Store in job logs
            this.logBuffers.get(job.projectId)?.add(logLine); // Also add to circular buffer
            
            // Emit live log lines for stderr too
            this.emitProgress(job.id, { 
              line: logLine
            });
          }
        });
      });

      // Milestone 10: Enhanced timeout with hard kill and reason exposure  
      const timeout = setTimeout(() => {
        this.killProcessTree(childProcess.pid);
        job.state = 'killed';
        const timeoutReason = `Compilation timeout after ${timeoutMs / 1000}s - process killed for security`;
        job.logs.push(`TIMEOUT: ${timeoutReason}`);
        this.emitProgress(job.id, { 
          state: 'killed', 
          message: timeoutReason
        });
        reject(new Error(timeoutReason));
      }, timeoutMs);

      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeout);
        
        // Parse errors from log
        job.errors = this.parseLatexErrors(logBuffer, buildDir);
        
        if (code === 0) {
          resolve();
        } else {
          const errorMsg = `LaTeX compilation failed with exit code ${code}`;
          if (job.state !== 'killed') { // Don't override killed state
            reject(new Error(errorMsg));
          }
        }
      });

      childProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  // Milestone 10: Create sanitized environment for child process (no secrets)
  private createSanitizedEnvironment(buildDir: string): NodeJS.ProcessEnv {
    const safeEnvVars = [
      'PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TERM',
      'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT', 'WINDIR', 'PROGRAMFILES'
    ];

    const sanitizedEnv: NodeJS.ProcessEnv = {};
    
    // Copy only safe environment variables
    for (const key of safeEnvVars) {
      if (process.env[key]) {
        sanitizedEnv[key] = process.env[key];
      }
    }

    // Ensure TeX paths are in PATH - critical for finding pdflatex, xelatex, etc.
    const texPaths = [
      '/Library/TeX/texbin',
      '/usr/local/texlive/2025/bin/universal-darwin',
      '/usr/local/texlive/2024/bin/universal-darwin',
      '/usr/local/texlive/2023/bin/universal-darwin',
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin'
    ];

    // Add TeX paths to existing PATH if they exist
    let currentPath = sanitizedEnv.PATH || '';
    const pathSeparator = platform() === 'win32' ? ';' : ':';
    
    for (const texPath of texPaths) {
      if (existsSync(texPath) && !currentPath.includes(texPath)) {
        currentPath = texPath + pathSeparator + currentPath;
      }
    }
    
    sanitizedEnv.PATH = currentPath;

    // Milestone 4 & 10: Set TeX-specific environment variables pointing to build dir
    sanitizedEnv.TEXMFVAR = buildDir;
    sanitizedEnv.TEXINPUTS = `${buildDir}:`;
    sanitizedEnv.TEXMFOUTPUT = buildDir;
    sanitizedEnv.TEXMFCACHE = buildDir;

    // Milestone 10: Remove potentially sensitive environment variables
    const sensitiveVars = [
      'NODE_ENV', 'npm_config_cache', 'npm_config_prefix', 'npm_config_registry',
      'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'SSH_AUTH_SOCK', 'SSH_AGENT_PID',
      'GITHUB_TOKEN', 'GITLAB_TOKEN', 'DOCKER_HOST', 'KUBERNETES_SERVICE_HOST'
    ];

    for (const key of sensitiveVars) {
      delete sanitizedEnv[key];
    }

    console.log(`[CompileOrchestrator] Created sanitized environment with PATH: ${sanitizedEnv.PATH}`);
    return sanitizedEnv;
  }

  // Milestone 10: Hard kill process tree on timeout - cross-platform process termination
  private killProcessTree(pid: number | undefined): void {
    if (!pid) return;

    try {
      if (platform() === 'win32') {
        // Windows: Use taskkill to kill process tree
        spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], { stdio: 'ignore' });
      } else {
        // Unix-like: Kill process group
        try {
          process.kill(-pid, 'SIGKILL'); // Kill process group
        } catch (error) {
          process.kill(pid, 'SIGKILL'); // Fallback to single process
        }
      }
      console.log(`[CompileOrchestrator] Killed process tree for PID: ${pid}`);
    } catch (error) {
      console.warn(`[CompileOrchestrator] Failed to kill process tree for PID ${pid}:`, error);
    }
  }

  private parseLatexErrors(logContent: string, buildDir: string): ErrorDTO[] {
    const errors: ErrorDTO[] = [];
    const lines = logContent.split('\n');
    
    // File stack to track current file context
    const fileStack: string[] = [];
    let currentFile = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Track file stack using parentheses - LaTeX opens files with (./ and closes with )
      this.updateFileStack(line, fileStack, buildDir);
      currentFile = fileStack.length > 0 ? fileStack[fileStack.length - 1] : '';
      
      // Pattern 0: file.tex:line: error message (handle both ./relative and absolute paths)
      const fileLineErrorMatch = line.match(/^(?:\.\/)?(.+?\.tex):(\d+):\s*(.+)/);
      if (fileLineErrorMatch) {
        const [, filePath, lineNum, message] = fileLineErrorMatch;
        // Extract just the filename from the full path
        const fileName = filePath.includes('/') ? filePath.split('/').pop() || filePath : filePath;
        errors.push({
          file: this.mapTempPathToProject(fileName, buildDir),
          line: parseInt(lineNum),
          message: message.trim(),
          severity: 'error'
        });
        continue;
      }
      
      // Pattern 1: ! LaTeX Error: messages
      if (line.startsWith('! LaTeX Error:')) {
        const message = line.substring(14).trim(); // Remove '! LaTeX Error:'
        const lineNumber = this.findLineNumber(lines, i);
        if (currentFile) {
          errors.push({
            file: this.mapTempPathToProject(currentFile, buildDir),
            line: lineNumber,
            message: `LaTeX Error: ${message}`,
            severity: 'error'
          });
        }
        continue;
      }
      
      // Pattern 2: ! Package <name> Error: messages
      const packageErrorMatch = line.match(/^! Package (\w+) Error:\s*(.+)/);
      if (packageErrorMatch) {
        const [, packageName, message] = packageErrorMatch;
        const lineNumber = this.findLineNumber(lines, i);
        if (currentFile) {
          errors.push({
            file: this.mapTempPathToProject(currentFile, buildDir),
            line: lineNumber,
            message: `Package ${packageName} Error: ${message}`,
            severity: 'error'
          });
        }
        continue;
      }
      
      // Pattern 3: ! <general error messages>
      if (line.startsWith('!') && !line.startsWith('! =')) {
        const message = line.substring(1).trim();
        const lineNumber = this.findLineNumber(lines, i);
        if (currentFile && message) {
          errors.push({
            file: this.mapTempPathToProject(currentFile, buildDir),
            line: lineNumber,
            message: message,
            severity: 'error'
          });
        }
        continue;
      }
      
      // Pattern 4: l.<line> explicit line references
      const lineRefMatch = line.match(/^l\.(\d+)\s*(.*)$/);
      if (lineRefMatch) {
        const [, lineNum, context] = lineRefMatch;
        // Look back for the error message
        const errorMessage = this.findPreviousErrorMessage(lines, i);
        if (currentFile && errorMessage) {
          errors.push({
            file: this.mapTempPathToProject(currentFile, buildDir),
            line: parseInt(lineNum),
            message: errorMessage + (context ? ` (at: ${context})` : ''),
            severity: 'error'
          });
        }
        continue;
      }
      
      // Pattern 5: Warning messages
      if (line.includes('Warning') || line.includes('warning')) {
        const warningLineMatch = line.match(/.*line (\d+)/);
        const lineNumber = warningLineMatch ? parseInt(warningLineMatch[1]) : this.findLineNumber(lines, i);
        if (currentFile) {
          errors.push({
            file: this.mapTempPathToProject(currentFile, buildDir),
            line: lineNumber,
            message: line,
            severity: 'warning'
          });
        }
        continue;
      }
      
      // Pattern 6: Overfull/Underfull box warnings
      const boxWarningMatch = line.match(/(Overfull|Underfull) \\[hv]box.*at lines (\d+)--(\d+)/);
      if (boxWarningMatch && currentFile) {
        const [, type, startLine] = boxWarningMatch;
        errors.push({
          file: this.mapTempPathToProject(currentFile, buildDir),
          line: parseInt(startLine),
          message: line,
          severity: 'warning'
        });
        continue;
      }
      
      // Pattern 7: Missing package/file errors
      if (line.includes('File') && line.includes('not found')) {
        const lineNumber = this.findLineNumber(lines, i);
        if (currentFile) {
          errors.push({
            file: this.mapTempPathToProject(currentFile, buildDir),
            line: lineNumber,
            message: line,
            severity: 'error'
          });
        }
      }
    }
    
    // Sort errors by severity (errors first, then warnings) and then by line number
    return errors.sort((a, b) => {
      if (a.severity !== b.severity) {
        if (a.severity === 'error') return -1;
        if (b.severity === 'error') return 1;
      }
      return a.line - b.line;
    });
  }
  
  // Helper method to track file stack from LaTeX log parentheses
  private updateFileStack(line: string, fileStack: string[], buildDir: string): void {
    // Count opening parentheses for file paths
    const openMatches = line.match(/\([^)]*\.tex/g);
    if (openMatches) {
      for (const match of openMatches) {
        const filePath = match.substring(1); // Remove opening parenthesis
        // Handle both relative (./) and absolute paths
        if (filePath.startsWith('./')) {
          fileStack.push(filePath.substring(2));
        } else if (filePath.startsWith(buildDir)) {
          fileStack.push(filePath.substring(buildDir.length + 1));
        } else if (filePath.endsWith('.tex')) {
          fileStack.push(filePath);
        }
      }
    }
    
    // Count closing parentheses
    const closeCount = (line.match(/\)/g) || []).length;
    for (let i = 0; i < closeCount && fileStack.length > 0; i++) {
      fileStack.pop();
    }
  }
  
  // Helper method to find line number from context
  private findLineNumber(lines: string[], currentIndex: number): number {
    // Look ahead for l.<number> pattern
    for (let i = currentIndex + 1; i < Math.min(currentIndex + 5, lines.length); i++) {
      const lineMatch = lines[i].match(/^l\.(\d+)/);
      if (lineMatch) {
        return parseInt(lineMatch[1]);
      }
    }
    
    // Look back for line references
    for (let i = currentIndex - 1; i >= Math.max(currentIndex - 3, 0); i--) {
      const lineMatch = lines[i].match(/line (\d+)/);
      if (lineMatch) {
        return parseInt(lineMatch[1]);
      }
    }
    
    return 1; // Default line number
  }
  
  // Helper method to find previous error message for l.<line> references
  private findPreviousErrorMessage(lines: string[], currentIndex: number): string {
    for (let i = currentIndex - 1; i >= Math.max(currentIndex - 5, 0); i--) {
      const line = lines[i].trim();
      if (line.startsWith('! ')) {
        return line.substring(1).trim();
      }
    }
    return '';
  }
  
  // Helper method to map temp build paths back to project relative paths
  private mapTempPathToProject(filePath: string, buildDir: string): string {
    // Remove build directory prefix if present
    if (filePath.startsWith(buildDir)) {
      filePath = filePath.substring(buildDir.length + 1);
    }
    
    // Remove leading ./
    if (filePath.startsWith('./')) {
      filePath = filePath.substring(2);
    }
    
    // Ensure we return relative paths from project root
    return filePath;
  }
}
