"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const path_1 = require("path");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const chokidar_1 = require("chokidar");
const ProjectService_1 = require("./ProjectService");
class FileService {
    constructor(autoCompileService) {
        this.watchers = new Map();
        this.internalWrites = new Map(); // projectId -> set of file paths being written internally
        this.recentWrites = new Map(); // projectId -> (relPath -> timestamp)
        this.projectService = new ProjectService_1.ProjectService();
        this.autoCompileService = autoCompileService;
    }
    async getProjectRoot(projectId) {
        const project = await this.projectService.getById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        return project.root;
    }
    validatePath(projectRoot, filePath) {
        const absolutePath = (0, path_1.resolve)(projectRoot, filePath);
        const normalizedProjectRoot = (0, path_1.resolve)(projectRoot);
        if (!absolutePath.startsWith(normalizedProjectRoot)) {
            throw new Error('Access denied: path outside project root');
        }
        return absolutePath;
    }
    async listTree(projectId) {
        const projectRoot = await this.getProjectRoot(projectId);
        return this.buildFileTree(projectRoot, projectRoot);
    }
    async buildFileTree(dirPath, projectRoot) {
        const items = [];
        try {
            const entries = await (0, promises_1.readdir)(dirPath);
            for (const entry of entries) {
                // Skip hidden files and output directory
                if (entry.startsWith('.') || entry === 'output' || entry === 'node_modules') {
                    continue;
                }
                const fullPath = (0, path_1.join)(dirPath, entry);
                const stats = await (0, promises_1.stat)(fullPath);
                const relativePath = (0, path_1.relative)(projectRoot, fullPath);
                const node = {
                    name: entry,
                    type: stats.isDirectory() ? 'directory' : 'file',
                    path: relativePath,
                    size: stats.isFile() ? stats.size : undefined,
                    mtime: stats.mtime.toISOString(),
                };
                if (stats.isDirectory()) {
                    node.children = await this.buildFileTree(fullPath, projectRoot);
                }
                items.push(node);
            }
        }
        catch (error) {
            console.error('Error reading directory:', error);
        }
        return items.sort((a, b) => {
            // Directories first, then files
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
    }
    async readFile(projectId, relPath) {
        const projectRoot = await this.getProjectRoot(projectId);
        const absolutePath = this.validatePath(projectRoot, relPath);
        if (!(0, fs_1.existsSync)(absolutePath)) {
            throw new Error('File not found');
        }
        const stats = (0, fs_1.statSync)(absolutePath);
        if (stats.isDirectory()) {
            throw new Error('Cannot read directory as file');
        }
        // Check if file is binary
        const extension = relPath.split('.').pop()?.toLowerCase();
        const textExtensions = ['tex', 'txt', 'md', 'bib', 'cls', 'sty', 'json', 'xml', 'html', 'css', 'js', 'ts'];
        if (textExtensions.includes(extension || '')) {
            return await (0, promises_1.readFile)(absolutePath, 'utf-8');
        }
        else {
            return await (0, promises_1.readFile)(absolutePath);
        }
    }
    async writeFile(projectId, relPath, content, isAutosave = false) {
        const projectRoot = await this.getProjectRoot(projectId);
        const absolutePath = this.validatePath(projectRoot, relPath);
        // Track this as an internal write BEFORE any file operations
        if (!this.internalWrites.has(projectId)) {
            this.internalWrites.set(projectId, new Set());
        }
        if (!this.recentWrites.has(projectId)) {
            this.recentWrites.set(projectId, new Map());
        }
        const internalWritesSet = this.internalWrites.get(projectId);
        const recentWritesMap = this.recentWrites.get(projectId);
        // Set flags IMMEDIATELY before any file operations
        internalWritesSet.add(relPath);
        recentWritesMap.set(relPath, Date.now());
        console.log(`[FileService] Internal write started for: ${relPath} at ${Date.now()} (autosave: ${isAutosave})`);
        try {
            // Ensure directory exists
            const dir = (0, path_1.dirname)(absolutePath);
            await (0, promises_1.mkdir)(dir, { recursive: true });
            // Write to temporary file first, then rename for atomic operation
            const tempPath = absolutePath + '.tmp';
            await (0, promises_1.writeFile)(tempPath, content, 'utf-8');
            await (0, promises_1.rename)(tempPath, absolutePath);
            const stats = await (0, promises_1.stat)(absolutePath);
            console.log(`[FileService] File write completed for: ${relPath} at ${Date.now()} (autosave: ${isAutosave})`);
            // Trigger auto-compile for .tex files if auto-compile service is available
            if (this.autoCompileService && relPath.endsWith('.tex')) {
                console.log(`[FileService] Triggering auto-compile for .tex file: ${relPath}`);
                this.autoCompileService.triggerCompile(projectId);
            }
            // For autosave, use a longer timeout to avoid false positives
            const clearTimeout = isAutosave ? 15000 : 10000;
            const recentTimeout = isAutosave ? 20000 : 15000;
            // Clear the internal write flag after a longer delay to ensure file watcher processes it
            setTimeout(() => {
                internalWritesSet.delete(relPath);
                console.log(`[FileService] Internal write cleared for: ${relPath} at ${Date.now()}`);
            }, clearTimeout);
            // Clear recent write after an even longer delay
            setTimeout(() => {
                recentWritesMap.delete(relPath);
                console.log(`[FileService] Recent write cleared for: ${relPath} at ${Date.now()}`);
            }, recentTimeout);
            return {
                ok: true,
                mtime: stats.mtime.toISOString(),
            };
        }
        catch (error) {
            // Clean up on error
            internalWritesSet.delete(relPath);
            recentWritesMap.delete(relPath);
            throw error;
        }
    }
    async startWatching(projectId, mainWindow) {
        if (this.watchers.has(projectId)) {
            return; // Already watching
        }
        const projectRoot = await this.getProjectRoot(projectId);
        const watcher = (0, chokidar_1.watch)(projectRoot, {
            ignored: [
                /\.tmp$/, // Temporary files
                /\.temp$/, // More temporary files
                /~$/, // Backup files
                /(^|[\/\\])\../, // Hidden files
                /output/, // Output directory
                /node_modules/, // Node modules
                /\.git/, // Git directory
                /\.history/, // History directory
                /\.DS_Store$/, // macOS system files
                /Thumbs\.db$/, // Windows system files
                /\.swp$/, // Vim swap files
                /\.swo$/, // Vim swap files
                /\#.*\#$/, // Emacs backup files
            ],
            persistent: true,
            ignoreInitial: true,
            depth: 10,
            usePolling: false, // Use native file system events for better performance
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 10
            }
        });
        watcher
            .on('add', (path) => {
            const relPath = (0, path_1.relative)(projectRoot, path);
            mainWindow.webContents.send('file-changed', {
                type: 'add',
                path: relPath,
                projectId,
            });
        })
            .on('change', (path) => {
            const relPath = (0, path_1.relative)(projectRoot, path);
            console.log(`[FileService] File changed detected: ${relPath} at ${Date.now()}`);
            // Check if this is an internal write using multiple methods
            const isInternalWrite = this.internalWrites.get(projectId)?.has(relPath);
            const recentWriteTime = this.recentWrites.get(projectId)?.get(relPath);
            const isRecentWrite = recentWriteTime && (Date.now() - recentWriteTime < 15000); // Within 15 seconds
            console.log(`[FileService] Write status for ${relPath}: internal=${isInternalWrite}, recentTime=${recentWriteTime}, isRecent=${isRecentWrite}, timeDiff=${recentWriteTime ? Date.now() - recentWriteTime : 'N/A'}ms`);
            if (isInternalWrite || isRecentWrite) {
                console.log(`[FileService] Skipping internal write notification for: ${relPath} (internal: ${isInternalWrite}, recent: ${isRecentWrite})`);
                return; // Skip notification for internal writes
            }
            console.log(`[FileService] Sending external change notification for: ${relPath}`);
            mainWindow.webContents.send('file-changed', {
                type: 'change',
                path: relPath,
                projectId,
            });
        })
            .on('unlink', (path) => {
            const relPath = (0, path_1.relative)(projectRoot, path);
            mainWindow.webContents.send('file-changed', {
                type: 'unlink',
                path: relPath,
                projectId,
            });
        })
            .on('addDir', (path) => {
            const relPath = (0, path_1.relative)(projectRoot, path);
            mainWindow.webContents.send('file-changed', {
                type: 'addDir',
                path: relPath,
                projectId,
            });
        })
            .on('unlinkDir', (path) => {
            const relPath = (0, path_1.relative)(projectRoot, path);
            mainWindow.webContents.send('file-changed', {
                type: 'unlinkDir',
                path: relPath,
                projectId,
            });
        });
        this.watchers.set(projectId, watcher);
    }
    async stopWatching(projectId) {
        const watcher = this.watchers.get(projectId);
        if (watcher) {
            await watcher.close();
            this.watchers.delete(projectId);
            this.internalWrites.delete(projectId); // Clean up internal writes tracking
            this.recentWrites.delete(projectId); // Clean up recent writes tracking
        }
    }
    async stopAllWatching() {
        for (const [projectId] of this.watchers) {
            await this.stopWatching(projectId);
        }
    }
    async createFile(projectId, relPath) {
        const projectRoot = await this.getProjectRoot(projectId);
        const absolutePath = this.validatePath(projectRoot, relPath);
        if ((0, fs_1.existsSync)(absolutePath)) {
            throw new Error('File already exists');
        }
        // Ensure directory exists
        const dir = (0, path_1.dirname)(absolutePath);
        await (0, promises_1.mkdir)(dir, { recursive: true });
        // Create empty file
        await (0, promises_1.writeFile)(absolutePath, '', 'utf-8');
        return { ok: true };
    }
    async createDirectory(projectId, relPath) {
        const projectRoot = await this.getProjectRoot(projectId);
        const absolutePath = this.validatePath(projectRoot, relPath);
        if ((0, fs_1.existsSync)(absolutePath)) {
            throw new Error('Directory already exists');
        }
        await (0, promises_1.mkdir)(absolutePath, { recursive: true });
        return { ok: true };
    }
    async rename(projectId, oldPath, newPath) {
        const projectRoot = await this.getProjectRoot(projectId);
        const oldAbsolutePath = this.validatePath(projectRoot, oldPath);
        const newAbsolutePath = this.validatePath(projectRoot, newPath);
        if (!(0, fs_1.existsSync)(oldAbsolutePath)) {
            throw new Error('Source file/directory not found');
        }
        if ((0, fs_1.existsSync)(newAbsolutePath)) {
            throw new Error('Destination already exists');
        }
        // Ensure destination directory exists
        const dir = (0, path_1.dirname)(newAbsolutePath);
        await (0, promises_1.mkdir)(dir, { recursive: true });
        await (0, promises_1.rename)(oldAbsolutePath, newAbsolutePath);
        return { ok: true };
    }
    async delete(projectId, relPath) {
        const projectRoot = await this.getProjectRoot(projectId);
        const absolutePath = this.validatePath(projectRoot, relPath);
        if (!(0, fs_1.existsSync)(absolutePath)) {
            throw new Error('File/directory not found');
        }
        const stats = await (0, promises_1.stat)(absolutePath);
        if (stats.isDirectory()) {
            await this.deleteDirectory(absolutePath);
        }
        else {
            await (0, promises_1.unlink)(absolutePath);
        }
        return { ok: true };
    }
    async deleteDirectory(dirPath) {
        const entries = await (0, promises_1.readdir)(dirPath);
        for (const entry of entries) {
            const fullPath = (0, path_1.join)(dirPath, entry);
            const stats = await (0, promises_1.stat)(fullPath);
            if (stats.isDirectory()) {
                await this.deleteDirectory(fullPath);
            }
            else {
                await (0, promises_1.unlink)(fullPath);
            }
        }
        await (0, promises_1.rmdir)(dirPath);
    }
}
exports.FileService = FileService;
//# sourceMappingURL=FileService.js.map