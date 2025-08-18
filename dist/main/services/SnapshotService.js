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
    constructor() {
        this.projectService = new ProjectService_1.ProjectService();
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
        }));
    }
    async restore(snapshotId) {
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
        // Extract tarball to project directory
        await this.extractTarball(snapshot.path, project.root);
        return { ok: true };
    }
    async createTarball(sourceDir, outputPath) {
        const files = [];
        // Collect files to include (excluding output and .history)
        await this.collectFiles(sourceDir, sourceDir, files);
        // Create tarball
        await tar.c({
            gzip: true,
            file: outputPath,
            cwd: sourceDir,
            filter: (path) => {
                // Exclude output directory and .history
                return !path.includes('output/') && !path.includes('.history/');
            },
        }, files);
    }
    async collectFiles(dir, rootDir, files) {
        const entries = await (0, promises_1.readdir)(dir);
        for (const entry of entries) {
            // Skip output directory, .history, and hidden files
            if (entry === 'output' || entry === '.history' || entry.startsWith('.')) {
                continue;
            }
            const fullPath = (0, path_1.join)(dir, entry);
            const relativePath = fullPath.replace(rootDir + '/', '');
            const stats = await (0, promises_1.stat)(fullPath);
            if (stats.isDirectory()) {
                files.push(relativePath);
                await this.collectFiles(fullPath, rootDir, files);
            }
            else {
                files.push(relativePath);
            }
        }
    }
    async extractTarball(tarballPath, destDir) {
        await tar.x({
            file: tarballPath,
            cwd: destDir,
            strip: 0,
        });
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