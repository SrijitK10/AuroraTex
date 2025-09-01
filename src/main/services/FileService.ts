import { join, resolve, relative, dirname } from 'path';
import { readFile, writeFile, mkdir, readdir, stat, rename, unlink, rmdir } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { watch, FSWatcher } from 'chokidar';
import { FileNode } from '../types';
import { ProjectService } from './ProjectService';
import { AutoCompileService } from './AutoCompileService';
import { BrowserWindow } from 'electron';

export class FileService {
  private projectService: ProjectService;
  private autoCompileService?: AutoCompileService;
  private watchers: Map<string, FSWatcher> = new Map();
  private internalWrites: Map<string, Set<string>> = new Map(); // projectId -> set of file paths being written internally
  private recentWrites: Map<string, Map<string, number>> = new Map(); // projectId -> (relPath -> timestamp)

  constructor(autoCompileService?: AutoCompileService) {
    this.projectService = new ProjectService();
    this.autoCompileService = autoCompileService;
  }

  private async getProjectRoot(projectId: string): Promise<string> {
    const project = await this.projectService.getById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    return project.root;
  }

  private validatePath(projectRoot: string, filePath: string): string {
    const absolutePath = resolve(projectRoot, filePath);
    const normalizedProjectRoot = resolve(projectRoot);
    
    if (!absolutePath.startsWith(normalizedProjectRoot)) {
      throw new Error('Access denied: path outside project root');
    }
    
    return absolutePath;
  }

  async listTree(projectId: string): Promise<FileNode[]> {
    const projectRoot = await this.getProjectRoot(projectId);
    return this.buildFileTree(projectRoot, projectRoot);
  }

  private async buildFileTree(dirPath: string, projectRoot: string): Promise<FileNode[]> {
    const items: FileNode[] = [];
    
    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        // Skip hidden files and output directory
        if (entry.startsWith('.') || entry === 'output' || entry === 'node_modules') {
          continue;
        }
        
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);
        const relativePath = relative(projectRoot, fullPath);
        
        const node: FileNode = {
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
    } catch (error) {
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

  async readFile(projectId: string, relPath: string): Promise<string | Uint8Array> {
    const projectRoot = await this.getProjectRoot(projectId);
    const absolutePath = this.validatePath(projectRoot, relPath);
    
    if (!existsSync(absolutePath)) {
      throw new Error('File not found');
    }
    
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      throw new Error('Cannot read directory as file');
    }
    
    // Check if file is binary
    const extension = relPath.split('.').pop()?.toLowerCase();
    const textExtensions = ['tex', 'txt', 'md', 'bib', 'cls', 'sty', 'json', 'xml', 'html', 'css', 'js', 'ts'];
    
    if (textExtensions.includes(extension || '')) {
      return await readFile(absolutePath, 'utf-8');
    } else {
      return await readFile(absolutePath);
    }
  }

  async writeFile(projectId: string, relPath: string, content: string, isAutosave = false): Promise<{ ok: boolean; mtime: string }> {
    const projectRoot = await this.getProjectRoot(projectId);
    const absolutePath = this.validatePath(projectRoot, relPath);
    
    // Track this as an internal write BEFORE any file operations
    if (!this.internalWrites.has(projectId)) {
      this.internalWrites.set(projectId, new Set());
    }
    if (!this.recentWrites.has(projectId)) {
      this.recentWrites.set(projectId, new Map());
    }
    
    const internalWritesSet = this.internalWrites.get(projectId)!;
    const recentWritesMap = this.recentWrites.get(projectId)!;
    
    // Set flags IMMEDIATELY before any file operations
    internalWritesSet.add(relPath);
    recentWritesMap.set(relPath, Date.now());
    
    console.log(`[FileService] Internal write started for: ${relPath} at ${Date.now()} (autosave: ${isAutosave})`);
    
    try {
      // Ensure directory exists
      const dir = dirname(absolutePath);
      await mkdir(dir, { recursive: true });
      
      // Write to temporary file first, then rename for atomic operation
      const tempPath = absolutePath + '.tmp';
      await writeFile(tempPath, content, 'utf-8');
      await rename(tempPath, absolutePath);
      
      const stats = await stat(absolutePath);
      
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
    } catch (error) {
      // Clean up on error
      internalWritesSet.delete(relPath);
      recentWritesMap.delete(relPath);
      throw error;
    }
  }

  async startWatching(projectId: string, mainWindow: BrowserWindow): Promise<void> {
    if (this.watchers.has(projectId)) {
      return; // Already watching
    }

    const projectRoot = await this.getProjectRoot(projectId);
    
    const watcher = watch(projectRoot, {
      ignored: [
        /\.tmp$/,         // Temporary files
        /\.temp$/,        // More temporary files
        /~$/,             // Backup files
        /(^|[\/\\])\../,  // Hidden files
        /output/,         // Output directory
        /node_modules/,   // Node modules
        /\.git/,          // Git directory
        /\.history/,      // History directory
        /\.DS_Store$/,    // macOS system files
        /Thumbs\.db$/,    // Windows system files
        /\.swp$/,         // Vim swap files
        /\.swo$/,         // Vim swap files
        /\#.*\#$/,        // Emacs backup files
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 10,
      usePolling: false, // Use native file system events for better performance
      awaitWriteFinish: { // Wait for write operations to complete
        stabilityThreshold: 100,
        pollInterval: 10
      }
    });

    watcher
      .on('add', (path) => {
        const relPath = relative(projectRoot, path);
        mainWindow.webContents.send('file-changed', {
          type: 'add',
          path: relPath,
          projectId,
        });
      })
      .on('change', (path) => {
        const relPath = relative(projectRoot, path);
        
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
        const relPath = relative(projectRoot, path);
        mainWindow.webContents.send('file-changed', {
          type: 'unlink',
          path: relPath,
          projectId,
        });
      })
      .on('addDir', (path) => {
        const relPath = relative(projectRoot, path);
        mainWindow.webContents.send('file-changed', {
          type: 'addDir',
          path: relPath,
          projectId,
        });
      })
      .on('unlinkDir', (path) => {
        const relPath = relative(projectRoot, path);
        mainWindow.webContents.send('file-changed', {
          type: 'unlinkDir',
          path: relPath,
          projectId,
        });
      });

    this.watchers.set(projectId, watcher);
  }

  async stopWatching(projectId: string): Promise<void> {
    const watcher = this.watchers.get(projectId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(projectId);
      this.internalWrites.delete(projectId); // Clean up internal writes tracking
      this.recentWrites.delete(projectId); // Clean up recent writes tracking
    }
  }

  async stopAllWatching(): Promise<void> {
    for (const [projectId] of this.watchers) {
      await this.stopWatching(projectId);
    }
  }

  async createFile(projectId: string, relPath: string): Promise<{ ok: boolean }> {
    const projectRoot = await this.getProjectRoot(projectId);
    const absolutePath = this.validatePath(projectRoot, relPath);
    
    if (existsSync(absolutePath)) {
      throw new Error('File already exists');
    }
    
    // Ensure directory exists
    const dir = dirname(absolutePath);
    await mkdir(dir, { recursive: true });
    
    // Create empty file
    await writeFile(absolutePath, '', 'utf-8');
    
    return { ok: true };
  }

  async createDirectory(projectId: string, relPath: string): Promise<{ ok: boolean }> {
    const projectRoot = await this.getProjectRoot(projectId);
    const absolutePath = this.validatePath(projectRoot, relPath);
    
    if (existsSync(absolutePath)) {
      throw new Error('Directory already exists');
    }
    
    await mkdir(absolutePath, { recursive: true });
    
    return { ok: true };
  }

  async rename(projectId: string, oldPath: string, newPath: string): Promise<{ ok: boolean }> {
    const projectRoot = await this.getProjectRoot(projectId);
    const oldAbsolutePath = this.validatePath(projectRoot, oldPath);
    const newAbsolutePath = this.validatePath(projectRoot, newPath);
    
    if (!existsSync(oldAbsolutePath)) {
      throw new Error('Source file/directory not found');
    }
    
    if (existsSync(newAbsolutePath)) {
      throw new Error('Destination already exists');
    }
    
    // Ensure destination directory exists
    const dir = dirname(newAbsolutePath);
    await mkdir(dir, { recursive: true });
    
    await rename(oldAbsolutePath, newAbsolutePath);
    
    return { ok: true };
  }

  async delete(projectId: string, relPath: string): Promise<{ ok: boolean }> {
    const projectRoot = await this.getProjectRoot(projectId);
    const absolutePath = this.validatePath(projectRoot, relPath);
    
    if (!existsSync(absolutePath)) {
      throw new Error('File/directory not found');
    }
    
    const stats = await stat(absolutePath);
    
    if (stats.isDirectory()) {
      await this.deleteDirectory(absolutePath);
    } else {
      await unlink(absolutePath);
    }
    
    return { ok: true };
  }

  private async deleteDirectory(dirPath: string): Promise<void> {
    const entries = await readdir(dirPath);
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        await this.deleteDirectory(fullPath);
      } else {
        await unlink(fullPath);
      }
    }
    
    await rmdir(dirPath);
  }
}
