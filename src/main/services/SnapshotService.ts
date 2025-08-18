import { join } from 'path';
import { mkdir, readdir, stat, copyFile, rmdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import { homedir } from 'os';
import { SnapshotDTO } from '../types';
import { ProjectService } from './ProjectService';
import { inMemoryDB } from './InMemoryDB';

export class SnapshotService {
  private projectService: ProjectService;

  constructor(projectService?: ProjectService) {
    this.projectService = projectService || new ProjectService();
  }

  async create(projectId: string, message?: string): Promise<SnapshotDTO> {
    const project = await this.projectService.getById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const snapshotId = uuidv4();
    const timestamp = Date.now();
    
    // Create snapshots directory if it doesn't exist
    const snapshotsDir = join(project.root, '.history');
    if (!existsSync(snapshotsDir)) {
      await mkdir(snapshotsDir, { recursive: true });
    }

    const snapshotPath = join(snapshotsDir, `${timestamp}.tar.gz`);

    // Create tarball of project files (excluding output and .history)
    await this.createTarball(project.root, snapshotPath);

    // Get file size
    const stats = await stat(snapshotPath);
    const sizeBytes = stats.size;

    // Insert into in-memory database
    inMemoryDB.insertSnapshot({
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

  async list(projectId: string): Promise<SnapshotDTO[]> {
    const snapshots = inMemoryDB.getSnapshotsByProject(projectId);

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

  async restore(snapshotId: string): Promise<{ ok: boolean }> {
    console.log(`[SnapshotService] Starting restore of snapshot: ${snapshotId}`);
    
    const snapshot = inMemoryDB.getSnapshot(snapshotId);

    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    const project = await this.projectService.getById(snapshot.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (!existsSync(snapshot.path)) {
      throw new Error('Snapshot file not found');
    }

    try {
      console.log('[SnapshotService] Creating auto-backup before restore...');
      // Create automatic backup before restore
      await this.create(snapshot.projectId, `Auto-backup before restore (${new Date().toLocaleString()})`);
      
      console.log('[SnapshotService] Creating temporary directory for extraction...');
      // Create temporary directory for extraction
      const tempDir = join(project.root, '.history', `restore-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });

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
      inMemoryDB.updateProject(snapshot.projectId, { 
        updatedAt: new Date().toISOString() 
      });

      console.log('[SnapshotService] Restore completed successfully');

      return { ok: true };
    } catch (error) {
      throw new Error(`Failed to restore snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean project directory, preserving .history and output directories
   */
  private async cleanProjectDirectory(projectRoot: string): Promise<void> {
    const items = await readdir(projectRoot, { withFileTypes: true });

    for (const item of items) {
      const itemPath = join(projectRoot, item.name);

      // Preserve .history and output directories
      if (item.name === '.history' || item.name === 'output') {
        continue;
      }

      if (item.isDirectory()) {
        await this.removeDirectory(itemPath);
      } else {
        await unlink(itemPath);
      }
    }
  }

  /**
   * Copy all contents from source to destination directory
   */
  private async copyDirectoryContents(sourceDir: string, destDir: string): Promise<void> {
    const items = await readdir(sourceDir, { withFileTypes: true });

    for (const item of items) {
      const sourcePath = join(sourceDir, item.name);
      const destPath = join(destDir, item.name);

      if (item.isDirectory()) {
        if (!existsSync(destPath)) {
          await mkdir(destPath, { recursive: true });
        }
        await this.copyDirectoryContents(sourcePath, destPath);
      } else {
        await copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Recursively remove a directory and all its contents
   */
  private async removeDirectory(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) return;

    const items = await readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = join(dirPath, item.name);

      if (item.isDirectory()) {
        await this.removeDirectory(itemPath);
      } else {
        await unlink(itemPath);
      }
    }

    await rmdir(dirPath);
  }

  private async createTarball(sourceDir: string, outputPath: string): Promise<void> {
    // Create tarball excluding output directory and .history
    await tar.c(
      {
        gzip: true,
        file: outputPath,
        cwd: sourceDir,
        filter: (path: string) => {
          // Exclude output directory and .history
          const normalizedPath = path.replace(/\\/g, '/');
          return !normalizedPath.includes('output/') && 
                 !normalizedPath.includes('.history/') &&
                 !normalizedPath.startsWith('output') &&
                 !normalizedPath.startsWith('.history');
        },
      },
      ['.'] // Include current directory
    );
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async delete(snapshotId: string): Promise<{ ok: boolean }> {
    const snapshot = inMemoryDB.getSnapshot(snapshotId);

    if (!snapshot) {
      return { ok: false };
    }

    // Delete file if it exists
    if (existsSync(snapshot.path)) {
      await import('fs/promises').then(fs => fs.unlink(snapshot.path));
    }

    // Remove from database
    const success = inMemoryDB.deleteSnapshot(snapshotId);

    return { ok: success };
  }
}
