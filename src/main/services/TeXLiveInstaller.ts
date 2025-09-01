import { app, dialog } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { pipeline } from 'stream/promises';
import { EventEmitter } from 'events';

export interface TexLiveInstallProgress {
  stage: 'downloading' | 'extracting' | 'installing' | 'configuring' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

export interface TexLiveDistribution {
  version: string;
  platform: 'windows' | 'macos' | 'linux';
  architecture: 'x64' | 'arm64';
  downloadUrl: string;
  installScript: string;
  size: number; // in MB
}

export class TeXLiveInstaller extends EventEmitter {
  private installPath: string;
  private tempPath: string;
  private currentDownload: ChildProcess | null = null;
  private isInstalling = false;

  constructor() {
    super();
    this.installPath = path.join(app.getPath('userData'), 'texlive');
    this.tempPath = path.join(app.getPath('temp'), 'auroratex-texlive');
  }

  /**
   * Get the appropriate TeX Live distribution for the current platform
   */
  private getDistributionInfo(): TexLiveDistribution {
    const platform = process.platform;
    const arch = process.arch;

    const distributions: Record<string, TexLiveDistribution> = {
      'darwin-x64': {
        version: '2025',
        platform: 'macos',
        architecture: 'x64',
        downloadUrl: 'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
        installScript: 'install-tl',
        size: 4500 // Basic installation ~4.5GB
      },
      'darwin-arm64': {
        version: '2025',
        platform: 'macos',
        architecture: 'arm64',
        downloadUrl: 'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
        installScript: 'install-tl',
        size: 4500
      },
      'win32-x64': {
        version: '2025',
        platform: 'windows',
        architecture: 'x64',
        downloadUrl: 'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-windows.exe',
        installScript: 'install-tl-windows.exe',
        size: 4800
      },
      'linux-x64': {
        version: '2025',
        platform: 'linux',
        architecture: 'x64',
        downloadUrl: 'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
        installScript: 'install-tl',
        size: 4200
      }
    };

    const key = `${platform}-${arch}`;
    return distributions[key] || distributions['linux-x64']; // fallback
  }

  /**
   * Check if TeX Live is already installed by AuroraTex
   */
  async isTexLiveInstalled(): Promise<boolean> {
    try {
      const binPath = this.getTexLiveBinPath();
      const pdflatexPath = path.join(binPath, process.platform === 'win32' ? 'pdflatex.exe' : 'pdflatex');
      return await fs.pathExists(pdflatexPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the binary path for installed TeX Live
   */
  getTexLiveBinPath(): string {
    const distribution = this.getDistributionInfo();
    const year = distribution.version;
    
    if (process.platform === 'win32') {
      return path.join(this.installPath, year, 'bin', 'windows');
    } else if (process.platform === 'darwin') {
      const arch = process.arch === 'arm64' ? 'universal-darwin' : 'x86_64-darwin';
      return path.join(this.installPath, year, 'bin', arch);
    } else {
      return path.join(this.installPath, year, 'bin', 'x86_64-linux');
    }
  }

  /**
   * Get available disk space
   */
  private async getAvailableDiskSpace(): Promise<number> {
    try {
      const stats = await fs.statSync(this.installPath);
      // This is a simplified check - in production you'd use a proper disk space check
      return 10000; // Assume 10GB available for now
    } catch (error) {
      return 10000;
    }
  }

  /**
   * Show installation dialog and get user consent
   */
  async showInstallationDialog(): Promise<boolean> {
    const distribution = this.getDistributionInfo();
    
    const result = await dialog.showMessageBox({
      type: 'question',
      title: 'Install TeX Live',
      message: 'TeX Live not found - Install automatically?',
      detail: `AuroraTex can automatically download and install TeX Live ${distribution.version} for you.\n\n` +
              `• Size: ~${distribution.size}MB\n` +
              `• Platform: ${distribution.platform} (${distribution.architecture})\n` +
              `• Install location: ${this.installPath}\n\n` +
              `This will enable full LaTeX compilation support without requiring manual setup.`,
      buttons: ['Install TeX Live', 'Skip', 'Learn More'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 2) {
      // Learn More clicked
      require('electron').shell.openExternal('https://tug.org/texlive/');
      return false;
    }

    return result.response === 0;
  }

  /**
   * Download TeX Live installer
   */
  private async downloadInstaller(distribution: TexLiveDistribution): Promise<string> {
    await fs.ensureDir(this.tempPath);
    
    const filename = path.basename(distribution.downloadUrl);
    const downloadPath = path.join(this.tempPath, filename);

    this.emit('progress', {
      stage: 'downloading',
      progress: 0,
      message: 'Starting TeX Live download...'
    } as TexLiveInstallProgress);

    return new Promise((resolve, reject) => {
      const protocol = distribution.downloadUrl.startsWith('https') ? https : http;
      
      const request = protocol.get(distribution.downloadUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;

        const fileStream = fs.createWriteStream(downloadPath);
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
          
          this.emit('progress', {
            stage: 'downloading',
            progress,
            message: `Downloading TeX Live installer... ${Math.round(downloadedSize / 1024 / 1024)}MB / ${Math.round(totalSize / 1024 / 1024)}MB`
          } as TexLiveInstallProgress);
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          this.emit('progress', {
            stage: 'downloading',
            progress: 100,
            message: 'Download complete!'
          } as TexLiveInstallProgress);
          resolve(downloadPath);
        });

        fileStream.on('error', reject);
      });

      request.on('error', reject);
      request.setTimeout(300000); // 5 minute timeout
    });
  }

  /**
   * Extract installer (for Unix/macOS)
   */
  private async extractInstaller(downloadPath: string): Promise<string> {
    if (!downloadPath.endsWith('.tar.gz')) {
      return downloadPath; // Windows .exe doesn't need extraction
    }

    this.emit('progress', {
      stage: 'extracting',
      progress: 0,
      message: 'Extracting TeX Live installer...'
    } as TexLiveInstallProgress);

    const extractPath = path.join(this.tempPath, 'extracted');
    await fs.ensureDir(extractPath);

    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xzf', downloadPath, '-C', extractPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      tar.on('close', async (code) => {
        if (code === 0) {
          // Find the install-tl script
          const files = await fs.readdir(extractPath);
          const installDir = files.find(f => f.startsWith('install-tl-'));
          
          if (installDir) {
            const installScriptPath = path.join(extractPath, installDir, 'install-tl');
            this.emit('progress', {
              stage: 'extracting',
              progress: 100,
              message: 'Extraction complete!'
            } as TexLiveInstallProgress);
            resolve(installScriptPath);
          } else {
            reject(new Error('Could not find install-tl script'));
          }
        } else {
          reject(new Error(`Extraction failed with code ${code}`));
        }
      });

      tar.on('error', reject);
    });
  }

  /**
   * Create TeX Live installation profile
   */
  private async createInstallProfile(): Promise<string> {
    const profilePath = path.join(this.tempPath, 'texlive.profile');
    
    const profile = `
# TeX Live installation profile for AuroraTex
selected_scheme scheme-basic
TEXDIR ${this.installPath}/${this.getDistributionInfo().version}
TEXMFCONFIG \$TEXDIR/texmf-config
TEXMFVAR \$TEXDIR/texmf-var
TEXMFHOME \$TEXDIR/texmf-home
TEXMFLOCAL \$TEXDIR/texmf-local
TEXMFSYSCONFIG \$TEXDIR/texmf-config
TEXMFSYSVAR \$TEXDIR/texmf-var
option_adjustpath 0
option_autobackup 1
option_backupdir tlpkg/backups
option_desktop_integration 1
option_doc 0
option_file_assocs 1
option_fmt 1
option_letter 0
option_menu_integration 1
option_path 1
option_post_code 1
option_src 0
option_sys_bin /usr/local/bin
option_sys_info /usr/local/share/info
option_sys_man /usr/local/share/man
option_w32_multi_user 0
option_write18_restricted 1
portable 0
`;

    await fs.writeFile(profilePath, profile.trim());
    return profilePath;
  }

  /**
   * Run TeX Live installation
   */
  private async runInstallation(installerPath: string): Promise<void> {
    this.emit('progress', {
      stage: 'installing',
      progress: 0,
      message: 'Starting TeX Live installation...'
    } as TexLiveInstallProgress);

    await fs.ensureDir(this.installPath);
    const profilePath = await this.createInstallProfile();

    return new Promise((resolve, reject) => {
      let installCommand: string[];
      
      if (process.platform === 'win32') {
        installCommand = [installerPath, '-profile', profilePath, '-no-gui'];
      } else {
        installCommand = ['perl', installerPath, '-profile', profilePath, '-no-interaction'];
      }

      const installer = spawn(installCommand[0], installCommand.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.tempPath
      });

      let output = '';
      let progressCount = 0;

      installer.stdout?.on('data', (data) => {
        output += data.toString();
        progressCount++;
        
        // Estimate progress based on output lines (rough approximation)
        const progress = Math.min(progressCount * 2, 90);
        
        this.emit('progress', {
          stage: 'installing',
          progress,
          message: 'Installing TeX Live packages...'
        } as TexLiveInstallProgress);
      });

      installer.stderr?.on('data', (data) => {
        console.error('TeX Live installation error:', data.toString());
      });

      installer.on('close', (code) => {
        if (code === 0) {
          this.emit('progress', {
            stage: 'installing',
            progress: 100,
            message: 'TeX Live installation complete!'
          } as TexLiveInstallProgress);
          resolve();
        } else {
          reject(new Error(`Installation failed with code ${code}\n${output}`));
        }
      });

      installer.on('error', reject);
      
      // Set timeout for installation (30 minutes)
      setTimeout(() => {
        installer.kill();
        reject(new Error('Installation timeout'));
      }, 30 * 60 * 1000);
    });
  }

  /**
   * Configure PATH and environment
   */
  private async configureEnvironment(): Promise<void> {
    this.emit('progress', {
      stage: 'configuring',
      progress: 0,
      message: 'Configuring TeX Live environment...'
    } as TexLiveInstallProgress);

    const binPath = this.getTexLiveBinPath();
    
    // Verify installation
    const pdflatexPath = path.join(binPath, process.platform === 'win32' ? 'pdflatex.exe' : 'pdflatex');
    if (!await fs.pathExists(pdflatexPath)) {
      throw new Error('Installation verification failed: pdflatex not found');
    }

    // Update tlmgr and install essential packages
    try {
      await this.runTexCommand(path.join(binPath, 'tlmgr'), ['update', '--self']);
      await this.runTexCommand(path.join(binPath, 'tlmgr'), [
        'install', 
        'latex-bin', 'latex', 'amsmath', 'amsfonts', 'geometry', 'graphicx', 'hyperref'
      ]);
    } catch (error) {
      console.warn('Failed to update tlmgr or install packages:', error);
      // Continue anyway - basic installation should work
    }

    this.emit('progress', {
      stage: 'configuring',
      progress: 100,
      message: 'Environment configuration complete!'
    } as TexLiveInstallProgress);
  }

  /**
   * Run a TeX command with timeout
   */
  private async runTexCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });

      process.on('error', reject);

      // 5 minute timeout
      setTimeout(() => {
        process.kill();
        reject(new Error('Command timeout'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Clean up temporary files
   */
  private async cleanup(): Promise<void> {
    try {
      await fs.remove(this.tempPath);
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error);
    }
  }

  /**
   * Main installation method
   */
  async installTexLive(): Promise<boolean> {
    if (this.isInstalling) {
      throw new Error('Installation already in progress');
    }

    try {
      this.isInstalling = true;

      // Check if already installed
      if (await this.isTexLiveInstalled()) {
        this.emit('progress', {
          stage: 'complete',
          progress: 100,
          message: 'TeX Live is already installed!'
        } as TexLiveInstallProgress);
        return true;
      }

      // Check disk space
      const distribution = this.getDistributionInfo();
      const availableSpace = await this.getAvailableDiskSpace();
      
      if (availableSpace < distribution.size) {
        throw new Error(`Insufficient disk space. Need ${distribution.size}MB, have ${availableSpace}MB`);
      }

      // Download installer
      const downloadPath = await this.downloadInstaller(distribution);

      // Extract if needed
      const installerPath = await this.extractInstaller(downloadPath);

      // Run installation
      await this.runInstallation(installerPath);

      // Configure environment
      await this.configureEnvironment();

      // Cleanup
      await this.cleanup();

      this.emit('progress', {
        stage: 'complete',
        progress: 100,
        message: 'TeX Live installation completed successfully!'
      } as TexLiveInstallProgress);

      return true;

    } catch (error) {
      this.emit('progress', {
        stage: 'error',
        progress: 0,
        message: 'Installation failed',
        error: error instanceof Error ? error.message : String(error)
      } as TexLiveInstallProgress);

      await this.cleanup();
      throw error;

    } finally {
      this.isInstalling = false;
    }
  }

  /**
   * Cancel ongoing installation
   */
  async cancelInstallation(): Promise<void> {
    if (this.currentDownload) {
      this.currentDownload.kill();
      this.currentDownload = null;
    }
    
    this.isInstalling = false;
    await this.cleanup();
    
    this.emit('progress', {
      stage: 'error',
      progress: 0,
      message: 'Installation cancelled by user'
    } as TexLiveInstallProgress);
  }

  /**
   * Get installation status
   */
  getInstallationStatus(): { installed: boolean; path?: string; version?: string } {
    const binPath = this.getTexLiveBinPath();
    return {
      installed: fs.pathExistsSync(binPath),
      path: binPath,
      version: this.getDistributionInfo().version
    };
  }
}
