"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotService = void 0;
const path_1 = require("path");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const uuid_1 = require("uuid");
const tar = __importStar(require("tar"));
const ProjectService_1 = require("./ProjectService");
const InMemoryDB_1 = require("./InMemoryDB");
class SnapshotService {
    constructor(projectService) {
        this.projectService = projectService || new ProjectService_1.ProjectService();
    }
    async create(projectId, message) {
        const project = await this.projectService.getById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        const snapshotId = (0, uuid_1.v4)();
        const timestamp = Date.now();
        // Create snapshots directory if it doesn't exist
        const snapshotsDir = (0, path_1.join)(project.root, '.history');
        if (!(0, fs_1.existsSync)(snapshotsDir)) {
            await (0, promises_1.mkdir)(snapshotsDir, { recursive: true });
        }
        const snapshotPath = (0, path_1.join)(snapshotsDir, `${timestamp}.tar.gz`);
        // Create tarball of project files (excluding output and .history)
        await this.createTarball(project.root, snapshotPath);
        // Get file size
        const stats = await (0, promises_1.stat)(snapshotPath);
        const sizeBytes = stats.size;
        // Insert into in-memory database
        InMemoryDB_1.inMemoryDB.insertSnapshot({
            id: snapshotId,
            projectId,
            timestamp,
            message: message || undefined,
            path: snapshotPath,
            sizeBytes,
        });
        return {
            id: snapshotId,
            projectId,
            timestamp,
            message,
            path: snapshotPath,
            sizeBytes,
        };
    }
    async list(projectId) {
        const snapshots = InMemoryDB_1.inMemoryDB.getSnapshotsByProject(projectId);
        return snapshots.map((snapshot) => ({
            id: snapshot.id,
            projectId: snapshot.projectId,
            timestamp: snapshot.timestamp,
            message: snapshot.message,
            path: snapshot.path,
            sizeBytes: snapshot.sizeBytes,
            formattedDate: new Date(snapshot.timestamp).toLocaleString(),
            formattedSize: this.formatBytes(snapshot.sizeBytes),
        }));
    }
    async restore(snapshotId) {
        console.log(`[SnapshotService] Starting restore of snapshot: ${snapshotId}`);
        const snapshot = InMemoryDB_1.inMemoryDB.getSnapshot(snapshotId);
        if (!snapshot) {
            throw new Error('Snapshot not found');
        }
        const project = await this.projectService.getById(snapshot.projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        if (!(0, fs_1.existsSync)(snapshot.path)) {
            throw new Error('Snapshot file not found');
        }
        try {
            console.log('[SnapshotService] Creating auto-backup before restore...');
            // Create automatic backup before restore
            await this.create(snapshot.projectId, `Auto-backup before restore (${new Date().toLocaleString()})`);
            console.log('[SnapshotService] Creating temporary directory for extraction...');
            // Create temporary directory for extraction
            const tempDir = (0, path_1.join)(project.root, '.history', `restore-${Date.now()}`);
            await (0, promises_1.mkdir)(tempDir, { recursive: true });
            console.log('[SnapshotService] Extracting snapshot to temporary directory...');
            // Extract snapshot to temp directory
            await tar.x({
                file: snapshot.path,
                cwd: tempDir,
            });
            console.log('[SnapshotService] Cleaning current project directory...');
            // Clean current project files (except .history and output)
            await this.cleanProjectDirectory(project.root);
            console.log('[SnapshotService] Copying restored files to project root...');
            // Copy restored files to project root
            await this.copyDirectoryContents(tempDir, project.root);
            console.log('[SnapshotService] Cleaning up temporary directory...');
            // Clean up temp directory
            await this.removeDirectory(tempDir);
            console.log('[SnapshotService] Updating project timestamp...');
            // Update project timestamp
            InMemoryDB_1.inMemoryDB.updateProject(snapshot.projectId, {
                updatedAt: new Date().toISOString()
            });
            console.log('[SnapshotService] Restore completed successfully');
            return { ok: true };
        }
        catch (error) {
            throw new Error(`Failed to restore snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Clean project directory, preserving .history and output directories
     */
    async cleanProjectDirectory(projectRoot) {
        const items = await (0, promises_1.readdir)(projectRoot, { withFileTypes: true });
        for (const item of items) {
            const itemPath = (0, path_1.join)(projectRoot, item.name);
            // Preserve .history and output directories
            if (item.name === '.history' || item.name === 'output') {
                continue;
            }
            if (item.isDirectory()) {
                await this.removeDirectory(itemPath);
            }
            else {
                await (0, promises_1.unlink)(itemPath);
            }
        }
    }
    /**
     * Copy all contents from source to destination directory
     */
    async copyDirectoryContents(sourceDir, destDir) {
        const items = await (0, promises_1.readdir)(sourceDir, { withFileTypes: true });
        for (const item of items) {
            const sourcePath = (0, path_1.join)(sourceDir, item.name);
            const destPath = (0, path_1.join)(destDir, item.name);
            if (item.isDirectory()) {
                if (!(0, fs_1.existsSync)(destPath)) {
                    await (0, promises_1.mkdir)(destPath, { recursive: true });
                }
                await this.copyDirectoryContents(sourcePath, destPath);
            }
            else {
                await (0, promises_1.copyFile)(sourcePath, destPath);
            }
        }
    }
    /**
     * Recursively remove a directory and all its contents
     */
    async removeDirectory(dirPath) {
        if (!(0, fs_1.existsSync)(dirPath))
            return;
        const items = await (0, promises_1.readdir)(dirPath, { withFileTypes: true });
        for (const item of items) {
            const itemPath = (0, path_1.join)(dirPath, item.name);
            if (item.isDirectory()) {
                await this.removeDirectory(itemPath);
            }
            else {
                await (0, promises_1.unlink)(itemPath);
            }
        }
        await (0, promises_1.rmdir)(dirPath);
    }
    async createTarball(sourceDir, outputPath) {
        // Create tarball excluding output directory and .history
        await tar.c({
            gzip: true,
            file: outputPath,
            cwd: sourceDir,
            filter: (path) => {
                // Exclude output directory and .history
                const normalizedPath = path.replace(/\\/g, '/');
                return !normalizedPath.includes('output/') &&
                    !normalizedPath.includes('.history/') &&
                    !normalizedPath.startsWith('output') &&
                    !normalizedPath.startsWith('.history');
            },
        }, ['.'] // Include current directory
        );
    }
    /**
     * Format bytes to human readable string
     */
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    async delete(snapshotId) {
        const snapshot = InMemoryDB_1.inMemoryDB.getSnapshot(snapshotId);
        if (!snapshot) {
            return { ok: false };
        }
        // Delete file if it exists
        if ((0, fs_1.existsSync)(snapshot.path)) {
            await Promise.resolve().then(() => __importStar(require('fs/promises'))).then(fs => fs.unlink(snapshot.path));
        }
        // Remove from database
        const success = InMemoryDB_1.inMemoryDB.deleteSnapshot(snapshotId);
        return { ok: success };
    }
}
exports.SnapshotService = SnapshotService;
//# sourceMappingURL=SnapshotService.js.map