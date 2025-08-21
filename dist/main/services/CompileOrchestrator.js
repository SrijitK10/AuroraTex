"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompileOrchestrator = void 0;
const child_process_1 = require("child_process");
const path_1 = require("path");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const uuid_1 = require("uuid");
const os_1 = require("os");
const events_1 = require("events");
const ProjectService_1 = require("./ProjectService");
const SettingsService_1 = require("./SettingsService");
// Milestone 5: Circular buffer for log storage
class CircularBuffer {
    constructor(maxSize = 1000) {
        this.buffer = [];
        this.currentIndex = 0;
        this.isFull = false;
        this.maxSize = maxSize;
    }
    add(item) {
        this.buffer[this.currentIndex] = item;
        this.currentIndex = (this.currentIndex + 1) % this.maxSize;
        if (this.currentIndex === 0) {
            this.isFull = true;
        }
    }
    getAll() {
        if (!this.isFull) {
            return this.buffer.slice(0, this.currentIndex);
        }
        return [
            ...this.buffer.slice(this.currentIndex),
            ...this.buffer.slice(0, this.currentIndex)
        ];
    }
    clear() {
        this.buffer = [];
        this.currentIndex = 0;
        this.isFull = false;
    }
}
class CompileOrchestrator extends events_1.EventEmitter {
    constructor() {
        super();
        this.jobs = new Map();
        this.queue = [];
        this.running = false;
        // Milestone 5: Enhanced queue management
        this.maxConcurrency = 1; // Milestone 5: Concurrency=1 as specified
        this.currentlyRunning = 0;
        this.logBuffers = new Map(); // Milestone 5: Circular buffer per job
        // Milestone 5: Auto-compile debouncing
        this.autoCompileTimers = new Map(); // projectId -> timer
        this.lastCompileEnd = new Map(); // projectId -> timestamp
        this.pendingAutoCompile = new Map(); // projectId -> needsBuild flag
        this.autoCompileDebounceMs = 750; // Default 750ms debounce
        this.autoCompileMinInterval = 5000; // 5 seconds minimum between auto-compiles
        // Milestone 13: Incremental build management
        this.persistentBuildDirs = new Map(); // projectId -> buildDir
        this.lastCleanBuild = new Map(); // projectId -> timestamp
        this.buildDirModTimes = new Map(); // projectId -> file -> mtime
        this.projectService = new ProjectService_1.ProjectService();
        this.settingsService = new SettingsService_1.SettingsService();
    }
    // Set auto-compile debounce delay
    setAutoCompileDelay(delayMs) {
        if (delayMs >= 100 && delayMs <= 10000) {
            this.autoCompileDebounceMs = delayMs;
            console.log(`[CompileOrchestrator] Auto-compile delay set to: ${delayMs}ms`);
        }
    }
    // Get current auto-compile delay
    getAutoCompileDelay() {
        return this.autoCompileDebounceMs;
    }
    // Reset compilation state for a project (useful when enabling auto-compile after manual compiles)
    resetProjectState(projectId) {
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
    triggerAutoCompile(projectId) {
        console.log(`[CompileOrchestrator] Auto-compile triggered for project: ${projectId}`);
        // Clear existing timer
        const existingTimer = this.autoCompileTimers.get(projectId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        // Set new debounced timer
        const timer = setTimeout(() => {
            this.handleAutoCompile(projectId);
            this.autoCompileTimers.delete(projectId);
        }, this.autoCompileDebounceMs);
        this.autoCompileTimers.set(projectId, timer);
    }
    // Milestone 5: Handle auto-compile with coalescing logic
    async handleAutoCompile(projectId) {
        const lastCompileTime = this.lastCompileEnd.get(projectId) || 0;
        const timeSinceLastCompile = Date.now() - lastCompileTime;
        // Check if there's already a running job for this project
        const runningJob = Array.from(this.jobs.values()).find(job => job.projectId === projectId && job.state === 'running');
        if (runningJob) {
            // Mark that we need to build again after current job finishes
            this.pendingAutoCompile.set(projectId, true);
            console.log(`[CompileOrchestrator] Marking auto-compile as pending for project: ${projectId}`);
            return;
        }
        // Check minimum interval between compiles
        if (timeSinceLastCompile < this.autoCompileMinInterval) {
            // Mark as pending and wait
            this.pendingAutoCompile.set(projectId, true);
            console.log(`[CompileOrchestrator] Auto-compile too soon, marking as pending for project: ${projectId}`);
            return;
        }
        // Clear pending flag and trigger compile
        this.pendingAutoCompile.set(projectId, false);
        try {
            await this.run(projectId, undefined, undefined, true); // isAutoCompile = true
            console.log(`[CompileOrchestrator] Auto-compile started for project: ${projectId}`);
        }
        catch (error) {
            console.error(`[CompileOrchestrator] Failed to start auto-compile for project: ${projectId}`, error);
        }
    }
    // Milestone 5: Get overall queue state for UI
    getQueueState() {
        const runningJobs = Array.from(this.jobs.values()).filter(job => job.state === 'running');
        const queuedJobs = Array.from(this.jobs.values()).filter(job => job.state === 'queued');
        let state = 'idle';
        if (runningJobs.length > 0) {
            state = 'building';
        }
        else if (queuedJobs.length > 0) {
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
    async shouldUseIncrementalBuild(projectId) {
        const settings = await this.settingsService.getIncrementalBuildSettings();
        if (!settings.enabled)
            return false;
        const lastClean = this.lastCleanBuild.get(projectId) || 0;
        const hoursSinceClean = (Date.now() - lastClean) / (1000 * 60 * 60);
        // Force clean build if it's been too long
        if (hoursSinceClean > settings.cleanBuildThreshold) {
            console.log(`[CompileOrchestrator] Forcing clean build for ${projectId} - ${hoursSinceClean.toFixed(1)} hours since last clean`);
            return false;
        }
        // Check if persistent build directory exists
        const persistentDir = this.persistentBuildDirs.get(projectId);
        if (!persistentDir || !(0, fs_1.existsSync)(persistentDir)) {
            console.log(`[CompileOrchestrator] No persistent build dir for ${projectId}, using clean build`);
            return false;
        }
        return true;
    }
    // Milestone 13: Get or create persistent build directory for incremental builds
    async getOrCreatePersistentBuildDir(projectId) {
        let buildDir = this.persistentBuildDirs.get(projectId);
        if (!buildDir || !(0, fs_1.existsSync)(buildDir)) {
            // Create new persistent build directory
            const tempBasePath = (0, path_1.join)((0, os_1.tmpdir)(), 'overleaf-builds');
            await (0, promises_1.mkdir)(tempBasePath, { recursive: true });
            buildDir = (0, path_1.join)(tempBasePath, `build-${projectId}-${Date.now()}`);
            await (0, promises_1.mkdir)(buildDir, { recursive: true });
            this.persistentBuildDirs.set(projectId, buildDir);
            console.log(`[CompileOrchestrator] Created persistent build dir: ${buildDir}`);
        }
        return buildDir;
    }
    // Milestone 13: Clean build directory for a project
    async cleanBuildDir(projectId) {
        try {
            const buildDir = this.persistentBuildDirs.get(projectId);
            if (buildDir && (0, fs_1.existsSync)(buildDir)) {
                await (0, promises_1.rm)(buildDir, { recursive: true, force: true });
                console.log(`[CompileOrchestrator] Cleaned build directory: ${buildDir}`);
            }
            this.persistentBuildDirs.delete(projectId);
            this.buildDirModTimes.delete(projectId);
            this.lastCleanBuild.set(projectId, Date.now());
            return { ok: true };
        }
        catch (error) {
            console.error(`[CompileOrchestrator] Failed to clean build dir for ${projectId}:`, error);
            return { ok: false };
        }
    }
    async run(projectId, engine, mainFile, isAutoCompile = false, forceClean = false) {
        const project = await this.projectService.getById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        // Milestone 13: Determine if this should be an incremental build
        const useIncremental = !forceClean && await this.shouldUseIncrementalBuild(projectId);
        const jobId = (0, uuid_1.v4)();
        const job = {
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
    async writeFullLogFile(job) {
        try {
            const project = await this.projectService.getById(job.projectId);
            if (!project)
                return;
            const outputDir = (0, path_1.join)(project.root, 'output');
            await (0, promises_1.mkdir)(outputDir, { recursive: true });
            const logFilePath = (0, path_1.join)(outputDir, 'compile.log');
            // Get all buffered logs for this job
            const allLogs = job.logs.slice(); // Get all logs from the job's log array
            if (allLogs.length > 0) {
                const logContent = allLogs.join('\n');
                await (0, promises_1.writeFile)(logFilePath, logContent, 'utf8');
                console.log(`[CompileOrchestrator] Wrote ${allLogs.length} log lines to: ${logFilePath}`);
            }
        }
        catch (error) {
            console.error('[CompileOrchestrator] Failed to write log file:', error);
        }
    }
    emitQueueStateChange() {
        const queueState = this.getQueueState();
        this.emit('queueState', queueState);
    }
    async cancel(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return { ok: false };
        }
        if (job.state === 'running' && job.process) {
            job.process.kill('SIGTERM');
            job.state = 'cancelled';
            job.endTime = new Date();
        }
        else if (job.state === 'queued') {
            job.state = 'cancelled';
            const queueIndex = this.queue.indexOf(jobId);
            if (queueIndex > -1) {
                this.queue.splice(queueIndex, 1);
            }
        }
        return { ok: true };
    }
    getStatus(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return null;
        return {
            jobId: job.id,
            state: job.state,
            progress: job.progress,
            startTime: job.startTime?.toISOString(),
            endTime: job.endTime?.toISOString(),
            logs: job.logs,
        };
    }
    getErrors(jobId) {
        const job = this.jobs.get(jobId);
        return job ? job.errors : [];
    }
    emitProgress(jobId, data) {
        this.emit('progress', {
            jobId,
            ...data
        });
    }
    // Milestone 5: Enhanced queue processing with concurrency control
    async processQueue() {
        // Process jobs while we have capacity and queued jobs
        while (this.currentlyRunning < this.maxConcurrency && this.queue.length > 0) {
            const jobId = this.queue.shift();
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
    async executeJob(job) {
        // Milestone 5: Track concurrency
        this.currentlyRunning++;
        this.emitQueueStateChange();
        let cleanupPaths = []; // Track paths to cleanup
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
            let buildDir;
            if (job.useExistingBuildDir) {
                // Milestone 13: Use persistent build directory for incremental builds
                buildDir = await this.getOrCreatePersistentBuildDir(job.projectId);
                job.logs.push(`🔄 Using incremental build directory: ${buildDir}`);
                this.emitProgress(job.id, {
                    line: `🔄 Using incremental build directory for faster compilation`,
                    message: 'Using incremental build directory'
                });
            }
            else {
                // Milestone 10: Create secure temporary build directory under app control
                buildDir = (0, path_1.join)((0, os_1.tmpdir)(), 'texlab-secure', `build-${job.id}`);
                await (0, promises_1.mkdir)(buildDir, { recursive: true });
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
            // Milestone 5: Copy output back to project (only main.pdf + compile.log)
            const outputDir = (0, path_1.join)(project.root, 'output');
            await (0, promises_1.mkdir)(outputDir, { recursive: true });
            // Always copy compile.log (Milestone 4: keep compile.log on error)
            const logPath = (0, path_1.join)(buildDir, project.mainFile.replace('.tex', '.log'));
            if ((0, fs_1.existsSync)(logPath)) {
                await (0, promises_1.copyFile)(logPath, (0, path_1.join)(outputDir, 'compile.log'));
            }
            const pdfPath = (0, path_1.join)(buildDir, project.mainFile.replace('.tex', '.pdf'));
            if ((0, fs_1.existsSync)(pdfPath)) {
                await (0, promises_1.copyFile)(pdfPath, (0, path_1.join)(outputDir, 'main.pdf'));
                job.state = 'success';
                this.emitProgress(job.id, {
                    state: 'success',
                    percent: 100,
                    message: 'Compilation completed successfully!'
                });
            }
            else {
                job.state = 'error';
                job.logs.push('ERROR: PDF file not generated');
                this.emitProgress(job.id, {
                    state: 'error',
                    message: 'PDF file not generated'
                });
            }
            job.progress = 100;
            job.endTime = new Date();
        }
        catch (error) {
            job.state = 'error';
            job.endTime = new Date();
            const errorMessage = error instanceof Error ? error.message : String(error);
            job.logs.push(`ERROR: ${errorMessage}`);
            this.emitProgress(job.id, {
                state: 'error',
                message: errorMessage
            });
        }
        finally {
            // Milestone 10: Secure cleanup - always remove temporary build directories
            for (const path of cleanupPaths) {
                try {
                    await (0, promises_1.rm)(path, { recursive: true, force: true });
                    console.log(`[CompileOrchestrator] Cleaned up temporary directory: ${path}`);
                }
                catch (cleanupError) {
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
                console.log(`[CompileOrchestrator] Checking pending auto-compile for project: ${job.projectId}`);
                setTimeout(() => {
                    this.handleAutoCompile(job.projectId);
                }, 1000); // Brief delay to allow for UI updates
            }
            this.emitQueueStateChange();
            // Continue processing queue
            this.processQueue();
        }
    }
    async copyProjectFiles(sourceDir, destDir) {
        const entries = await (0, promises_1.readdir)(sourceDir);
        for (const entry of entries) {
            // Skip output directory and hidden files
            if (entry === 'output' || entry.startsWith('.')) {
                continue;
            }
            const sourcePath = (0, path_1.join)(sourceDir, entry);
            const destPath = (0, path_1.join)(destDir, entry);
            const stats = await (0, promises_1.stat)(sourcePath);
            if (stats.isDirectory()) {
                await (0, promises_1.mkdir)(destPath, { recursive: true });
                await this.copyProjectFiles(sourcePath, destPath);
            }
            else {
                await (0, promises_1.copyFile)(sourcePath, destPath);
            }
        }
    }
    // Milestone 10: Enhanced secure compilation with sandboxing and process limits
    async runSecureLatexmk(job, latexmkPath, buildDir, mainFile, engine, shellEscapeEnabled) {
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
            }
            else {
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
            const childProcess = (0, child_process_1.spawn)(latexmkPath, args, {
                cwd: buildDir,
                env: sanitizedEnv
            });
            // Milestone 10: Lower process priority on Unix systems (best effort)
            if ((0, os_1.platform)() !== 'win32' && childProcess.pid) {
                try {
                    // Lower process priority using nice (higher nice value = lower priority)
                    process.kill(childProcess.pid, 0); // Check if process exists
                    (0, child_process_1.spawn)('renice', ['10', childProcess.pid.toString()], { stdio: 'ignore' });
                    console.log(`[CompileOrchestrator] Lowered process priority for PID: ${childProcess.pid}`);
                }
                catch (error) {
                    console.warn('[CompileOrchestrator] Failed to lower process priority:', error);
                    // Continue execution - this is best effort
                }
            }
            job.process = childProcess;
            let logBuffer = '';
            // Milestone 5: Use circular buffer for efficient log management
            childProcess.stdout.on('data', (data) => {
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
            childProcess.stderr.on('data', (data) => {
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
            childProcess.on('close', (code) => {
                clearTimeout(timeout);
                // Parse errors from log
                job.errors = this.parseLatexErrors(logBuffer, buildDir);
                if (code === 0) {
                    resolve();
                }
                else {
                    const errorMsg = `LaTeX compilation failed with exit code ${code}`;
                    if (job.state !== 'killed') { // Don't override killed state
                        reject(new Error(errorMsg));
                    }
                }
            });
            childProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }
    // Milestone 10: Create sanitized environment for child process (no secrets)
    createSanitizedEnvironment(buildDir) {
        const safeEnvVars = [
            'PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TERM',
            'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT', 'WINDIR', 'PROGRAMFILES'
        ];
        const sanitizedEnv = {};
        // Copy only safe environment variables
        for (const key of safeEnvVars) {
            if (process.env[key]) {
                sanitizedEnv[key] = process.env[key];
            }
        }
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
        console.log('[CompileOrchestrator] Created sanitized environment for LaTeX compilation');
        return sanitizedEnv;
    }
    // Milestone 10: Hard kill process tree on timeout - cross-platform process termination
    killProcessTree(pid) {
        if (!pid)
            return;
        try {
            if ((0, os_1.platform)() === 'win32') {
                // Windows: Use taskkill to kill process tree
                (0, child_process_1.spawn)('taskkill', ['/pid', pid.toString(), '/T', '/F'], { stdio: 'ignore' });
            }
            else {
                // Unix-like: Kill process group
                try {
                    process.kill(-pid, 'SIGKILL'); // Kill process group
                }
                catch (error) {
                    process.kill(pid, 'SIGKILL'); // Fallback to single process
                }
            }
            console.log(`[CompileOrchestrator] Killed process tree for PID: ${pid}`);
        }
        catch (error) {
            console.warn(`[CompileOrchestrator] Failed to kill process tree for PID ${pid}:`, error);
        }
    }
    parseLatexErrors(logContent, buildDir) {
        const errors = [];
        const lines = logContent.split('\n');
        // File stack to track current file context
        const fileStack = [];
        let currentFile = '';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Skip empty lines
            if (!line)
                continue;
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
                if (a.severity === 'error')
                    return -1;
                if (b.severity === 'error')
                    return 1;
            }
            return a.line - b.line;
        });
    }
    // Helper method to track file stack from LaTeX log parentheses
    updateFileStack(line, fileStack, buildDir) {
        // Count opening parentheses for file paths
        const openMatches = line.match(/\([^)]*\.tex/g);
        if (openMatches) {
            for (const match of openMatches) {
                const filePath = match.substring(1); // Remove opening parenthesis
                // Handle both relative (./) and absolute paths
                if (filePath.startsWith('./')) {
                    fileStack.push(filePath.substring(2));
                }
                else if (filePath.startsWith(buildDir)) {
                    fileStack.push(filePath.substring(buildDir.length + 1));
                }
                else if (filePath.endsWith('.tex')) {
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
    findLineNumber(lines, currentIndex) {
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
    findPreviousErrorMessage(lines, currentIndex) {
        for (let i = currentIndex - 1; i >= Math.max(currentIndex - 5, 0); i--) {
            const line = lines[i].trim();
            if (line.startsWith('! ')) {
                return line.substring(1).trim();
            }
        }
        return '';
    }
    // Helper method to map temp build paths back to project relative paths
    mapTempPathToProject(filePath, buildDir) {
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
exports.CompileOrchestrator = CompileOrchestrator;
//# sourceMappingURL=CompileOrchestrator.js.map