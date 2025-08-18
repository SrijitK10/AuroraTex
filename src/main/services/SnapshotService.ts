import { join } from 'path';
import { mkdir, readdir, stat } from 'fs/promises';
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

  constructor() {
    this.projectService = new ProjectService();
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
    }));
  }

  async restore(snapshotId: string): Promise<{ ok: boolean }> {
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

    // Extract tarball to project directory
    await this.extractTarball(snapshot.path, project.root);

    return { ok: true };
  }

  private async createTarball(sourceDir: string, outputPath: string): Promise<void> {
    const files: string[] = [];
    
    // Collect files to include (excluding output and .history)
    await this.collectFiles(sourceDir, sourceDir, files);

    // Create tarball
    await tar.c(
      {
        gzip: true,
        file: outputPath,
        cwd: sourceDir,
        filter: (path: string) => {
          // Exclude output directory and .history
          return !path.includes('output/') && !path.includes('.history/');
        },
      },
      files
    );
  }

  private async collectFiles(dir: string, rootDir: string, files: string[]): Promise<void> {
    const entries = await readdir(dir);

    for (const entry of entries) {
      // Skip output directory, .history, and hidden files
      if (entry === 'output' || entry === '.history' || entry.startsWith('.')) {
        continue;
      }

      const fullPath = join(dir, entry);
      const relativePath = fullPath.replace(rootDir + '/', '');
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        files.push(relativePath);
        await this.collectFiles(fullPath, rootDir, files);
      } else {
        files.push(relativePath);
      }
    }
  }

  private async extractTarball(tarballPath: string, destDir: string): Promise<void> {
    await tar.x({
      file: tarballPath,
      cwd: destDir,
      strip: 0,
    });
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
