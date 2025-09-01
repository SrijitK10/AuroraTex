import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { app } from 'electron';
import { TeXLiveInstaller } from './TeXLiveInstaller';

export interface TeXBinary {
  path: string | null;
  version: string | null;
  isValid: boolean;
  source: 'bundled' | 'system' | 'custom' | 'auroratex-installed';
}

export interface TeXDistribution {
  name: string;
  latexmk: TeXBinary;
  pdflatex: TeXBinary;
  xelatex: TeXBinary;
  lualatex: TeXBinary;
  biber: TeXBinary;
  bibtex: TeXBinary;
  isBundled: boolean;
  isValid: boolean;
  isActive: boolean;
}

export interface TeXSettings {
  distributions: TeXDistribution[];
  activeDistribution: string;
  engineDefault: 'pdflatex' | 'xelatex' | 'lualatex';
  timeoutMs: number;
  maxLogSizeKB: number;
  shellEscapeEnabled: boolean;
  // Milestone 10: Enhanced security settings
  shellEscapeGlobalWarning?: boolean;
  resourceLimits?: {
    enableProcessPriority: boolean;
    maxCompileTimeMs: number;
    autoCompileTimeoutMs: number;
  };
}

export class TeXDetectionService {
  private bundledPath: string;
  private texLiveInstaller: TeXLiveInstaller;

  constructor() {
    // Path to bundled TeX distribution (if included)
    this.bundledPath = join(process.resourcesPath || '', 'texlive', 'bin');
    this.texLiveInstaller = new TeXLiveInstaller();
  }

  async detectAllDistributions(): Promise<TeXDistribution[]> {
    console.log('[TeXDetectionService] Starting comprehensive TeX distribution detection...');
    
    const distributions: TeXDistribution[] = [];
    
    // 1. Try AuroraTex-installed TeX Live
    const auroraTexInstalled = await this.detectAuroraTexInstalledDistribution();
    if (auroraTexInstalled) {
      distributions.push(auroraTexInstalled);
    }
    
    // 2. Try bundled distribution
    const bundled = await this.detectBundledDistribution();
    if (bundled) {
      distributions.push(bundled);
    }
    
    // 3. Try system distributions
    const system = await this.detectSystemDistribution();
    if (system) {
      distributions.push(system);
    }
    
    return distributions;
  }

  async detectAuroraTexInstalledDistribution(): Promise<TeXDistribution | null> {
    console.log('[TeXDetectionService] Checking for AuroraTex-installed TeX distribution...');
    
    // Check if TeX Live was installed by AuroraTex
    if (!await this.texLiveInstaller.isTexLiveInstalled()) {
      console.log('[TeXDetectionService] AuroraTex-installed TeX Live not found');
      return null;
    }

    const binPath = this.texLiveInstaller.getTexLiveBinPath();
    console.log(`[TeXDetectionService] Checking AuroraTex TeX binaries at: ${binPath}`);

    const binaries = ['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'biber', 'bibtex'];
    const detectedBinaries: Record<string, TeXBinary> = {};
    let validCount = 0;

    for (const binary of binaries) {
      const binaryPath = join(binPath, process.platform === 'win32' ? `${binary}.exe` : binary);
      const detected = await this.validateBinaryAtPath(binaryPath, binary);
      
      if (detected) {
        detectedBinaries[binary] = {
          ...detected,
          source: 'auroratex-installed'
        };
        if (detected.isValid) validCount++;
      } else {
        detectedBinaries[binary] = {
          path: null,
          version: null,
          isValid: false,
          source: 'auroratex-installed'
        };
      }
    }

    const isValid = validCount >= 3; // Need at least 3 essential binaries
    const installStatus = this.texLiveInstaller.getInstallationStatus();

    if (isValid) {
      console.log(`[TeXDetectionService] Found valid AuroraTex TeX Live installation with ${validCount} binaries`);
    }

    return {
      name: `AuroraTex TeX Live ${installStatus.version || '2025'}`,
      isBundled: false,
      isValid,
      isActive: false, // Will be set by SettingsService
      latexmk: detectedBinaries.latexmk,
      pdflatex: detectedBinaries.pdflatex,
      xelatex: detectedBinaries.xelatex,
      lualatex: detectedBinaries.lualatex,
      biber: detectedBinaries.biber,
      bibtex: detectedBinaries.bibtex,
    };
  }

  /**
   * Check if we should offer automatic TeX Live installation
   */
  async shouldOfferAutoInstall(): Promise<boolean> {
    const distributions = await this.detectAllDistributions();
    const hasValidDistribution = distributions.some(dist => dist.isValid);
    
    // Only offer if no valid TeX distribution is found
    return !hasValidDistribution;
  }

  /**
   * Get the TeX Live installer instance for automatic installation
   */
  getTexLiveInstaller(): TeXLiveInstaller {
    return this.texLiveInstaller;
  }

  /**
   * Check system readiness for TeX Live installation
   */
  async checkInstallationReadiness(): Promise<{
    canInstall: boolean;
    platform: string;
    architecture: string;
    estimatedSize: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Check platform support
    const supportedPlatforms = ['darwin', 'win32', 'linux'];
    if (!supportedPlatforms.includes(process.platform)) {
      issues.push(`Platform ${process.platform} not supported for automatic installation`);
    }

    // Check for required tools on Unix systems
    if (process.platform !== 'win32') {
      const hasPerl = await this.checkCommand('perl', ['--version']);
      if (!hasPerl) {
        issues.push('Perl is required for TeX Live installation but not found');
      }

      const hasTar = await this.checkCommand('tar', ['--version']);
      if (!hasTar) {
        issues.push('tar is required for extraction but not found');
      }
    }

    // Check available disk space (simplified)
    const estimatedSize = process.platform === 'win32' ? 4800 : 4500; // MB

    return {
      canInstall: issues.length === 0,
      platform: process.platform,
      architecture: process.arch,
      estimatedSize,
      issues
    };
  }

  /**
   * Check if a command is available
   */
  private async checkCommand(command: string, args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(command, args, { stdio: 'ignore' });
      
      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(false);
      }, 5000);
    });
  }

  async detectBundledDistribution(): Promise<TeXDistribution | null> {
    console.log('[TeXDetectionService] Checking for bundled TeX distribution...');
    
    if (!existsSync(this.bundledPath)) {
      console.log('[TeXDetectionService] Bundled TeX not found');
      return null;
    }

    const binaries = ['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'biber', 'bibtex'];
    const detectedBinaries: Record<string, TeXBinary> = {};
    let validCount = 0;

    for (const binary of binaries) {
      const binaryPath = join(this.bundledPath, binary);
      const detected = await this.validateBinaryAtPath(binaryPath, binary);
      
      if (detected) {
        detectedBinaries[binary] = {
          ...detected,
          source: 'bundled'
        };
        if (detected.isValid) validCount++;
      } else {
        detectedBinaries[binary] = {
          path: null,
          version: null,
          isValid: false,
          source: 'bundled'
        };
      }
    }

    const isValid = validCount >= 3; // Need at least 3 essential binaries

    return {
      name: 'Bundled TeX Live',
      isBundled: true,
      isValid,
      isActive: false, // Will be set by SettingsService
      latexmk: detectedBinaries.latexmk,
      pdflatex: detectedBinaries.pdflatex,
      xelatex: detectedBinaries.xelatex,
      lualatex: detectedBinaries.lualatex,
      biber: detectedBinaries.biber,
      bibtex: detectedBinaries.bibtex,
    };
  }

  async detectSystemDistribution(): Promise<TeXDistribution | null> {
    console.log('[TeXDetectionService] Searching for system TeX distribution...');
    
    const binaries = ['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'biber', 'bibtex'];
    const detectedBinaries: Record<string, TeXBinary> = {};
    let validCount = 0;

    for (const binary of binaries) {
      // Try to find in PATH first
      let detected = await this.findInPath(binary);
      
      // If not found in PATH, try common macOS locations
      if (!detected || !detected.isValid) {
        detected = await this.findInCommonPaths(binary);
      }
      
      if (detected && detected.isValid) {
        detectedBinaries[binary] = {
          ...detected,
          source: 'system'
        };
        validCount++;
        console.log(`[TeXDetectionService] Found ${binary} at: ${detected.path}`);
      } else {
        detectedBinaries[binary] = {
          path: null,
          version: null,
          isValid: false,
          source: 'system'
        };
        console.log(`[TeXDetectionService] Could not find ${binary}`);
      }
    }

    if (validCount === 0) {
      console.log('[TeXDetectionService] No system TeX binaries found');
      return null;
    }

    console.log(`[TeXDetectionService] Found ${validCount} valid TeX binaries`);
    const isValid = validCount >= 3; // Need at least 3 essential binaries

    return {
      name: 'System TeX Live',
      isBundled: false,
      isValid,
      isActive: false, // Will be set by SettingsService
      latexmk: detectedBinaries.latexmk,
      pdflatex: detectedBinaries.pdflatex,
      xelatex: detectedBinaries.xelatex,
      lualatex: detectedBinaries.lualatex,
      biber: detectedBinaries.biber,
      bibtex: detectedBinaries.bibtex,
    };
  }

  private async findInPath(binaryName: string): Promise<TeXBinary | null> {
    return new Promise((resolve) => {
      // Use 'which' on Unix or 'where' on Windows
      const command = process.platform === 'win32' ? 'where' : 'which';
      
      try {
        const child = spawn(command, [binaryName], { shell: true });
        let output = '';
        
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });
        
        child.on('close', async (code) => {
          if (code === 0 && output.trim()) {
            const path = output.split('\n')[0].trim();
            if (existsSync(path)) {
              const validated = await this.validateBinaryAtPath(path, binaryName);
              resolve(validated);
              return;
            }
          }
          
          resolve({
            path: null,
            version: null,
            isValid: false,
            source: 'system'
          });
        });
        
        child.on('error', () => {
          resolve({
            path: null,
            version: null,
            isValid: false,
            source: 'system'
          });
        });
      } catch (error) {
        resolve({
          path: null,
          version: null,
          isValid: false,
          source: 'system'
        });
      }
    });
  }

  private async findInCommonPaths(binaryName: string): Promise<TeXBinary | null> {
    console.log(`[TeXDetectionService] Searching for ${binaryName} in common paths...`);
    
    // Common TeX installation paths
    const commonPaths = [
      // MacTeX standard locations
      '/usr/local/texlive/2025/bin/universal-darwin',
      '/usr/local/texlive/2024/bin/universal-darwin',
      '/usr/local/texlive/2023/bin/universal-darwin',
      '/usr/local/texlive/2022/bin/universal-darwin',
      '/usr/local/texlive/2021/bin/universal-darwin',
      '/usr/local/texlive/2020/bin/universal-darwin',
      '/usr/local/texlive/2025/bin/x86_64-darwin',
      '/usr/local/texlive/2024/bin/x86_64-darwin',
      '/usr/local/texlive/2023/bin/x86_64-darwin',
      '/usr/local/texlive/2022/bin/x86_64-darwin',
      '/usr/local/texlive/2021/bin/x86_64-darwin',
      '/usr/local/texlive/2020/bin/x86_64-darwin',
      // BasicTeX locations
      '/Library/TeX/texbin',
      '/usr/texbin',
      // Homebrew locations
      '/opt/homebrew/bin',
      '/usr/local/bin',
      // User-specific installations
      join(process.env.HOME || '', 'texlive/2025/bin/universal-darwin'),
      join(process.env.HOME || '', 'texlive/2024/bin/universal-darwin'),
      join(process.env.HOME || '', 'texlive/2023/bin/universal-darwin'),
      join(process.env.HOME || '', 'texlive/2022/bin/universal-darwin'),
      // Standard Unix paths
      '/usr/bin',
      '/bin',
    ];

    for (const basePath of commonPaths) {
      const fullPath = join(basePath, binaryName);
      console.log(`[TeXDetectionService] Checking: ${fullPath}`);
      
      if (existsSync(fullPath)) {
        console.log(`[TeXDetectionService] Found file at: ${fullPath}`);
        const validated = await this.validateBinaryAtPath(fullPath, binaryName);
        if (validated && validated.isValid) {
          console.log(`[TeXDetectionService] Validated ${binaryName} at: ${fullPath}`);
          return validated;
        } else {
          console.log(`[TeXDetectionService] File exists but validation failed: ${fullPath}`);
        }
      }
    }

    console.log(`[TeXDetectionService] Could not find ${binaryName} in any common paths`);
    return {
      path: null,
      version: null,
      isValid: false,
      source: 'system'
    };
  }

  async validateBinaryPath(path: string, binaryName: string): Promise<boolean> {
    const result = await this.validateBinaryAtPath(path, binaryName);
    return result?.isValid || false;
  }

  private async validateBinaryAtPath(binaryPath: string, binaryName: string): Promise<TeXBinary | null> {
    if (!existsSync(binaryPath)) {
      console.log(`[TeXDetectionService] Binary does not exist: ${binaryPath}`);
      return null;
    }

    console.log(`[TeXDetectionService] Validating ${binaryName} at: ${binaryPath}`);

    return new Promise((resolve) => {
      // Get version to validate binary works
      const versionArg = binaryName === 'latexmk' ? '-version' : '--version';
      
      try {
        const child = spawn(binaryPath, [versionArg], { 
          shell: false,
          env: { ...process.env, PATH: process.env.PATH }
        });
        let output = '';
        let hasData = false;
        
        child.stdout?.on('data', (data) => {
          output += data.toString();
          hasData = true;
        });
        
        child.stderr?.on('data', (data) => {
          output += data.toString();
          hasData = true;
        });
        
        const timeout = setTimeout(() => {
          console.log(`[TeXDetectionService] Timeout validating ${binaryName} at ${binaryPath}`);
          child.kill('SIGTERM');
          resolve({
            path: binaryPath,
            version: null,
            isValid: false,
            source: 'system'
          });
        }, 10000); // Increased timeout to 10 seconds
        
        child.on('close', (code) => {
          clearTimeout(timeout);
          
          console.log(`[TeXDetectionService] ${binaryName} validation result: code=${code}, hasData=${hasData}, output length=${output.length}`);
          
          // More lenient validation - consider success if:
          // 1. Exit code is 0, OR
          // 2. We got output containing TeX-related keywords, OR
          // 3. Exit code is 1 but output suggests it's a valid TeX binary
          const isValidOutput = output.includes('TeX Live') || 
                               output.includes('pdfTeX') || 
                               output.includes('XeTeX') || 
                               output.includes('LuaTeX') || 
                               output.includes('Latexmk') ||
                               output.includes('BibTeX') ||
                               output.includes('Biber') ||
                               (binaryName === 'bibtex' && output.includes('BibTeX')) ||
                               (binaryName === 'biber' && output.includes('biber'));
          
          const isValid = (code === 0 && hasData) || isValidOutput || (code === 1 && isValidOutput);
          
          if (isValid) {
            // Extract version from output
            const version = this.extractVersion(output, binaryName);
            
            console.log(`[TeXDetectionService] Successfully validated ${binaryName} at ${binaryPath}, version: ${version}`);
            
            resolve({
              path: binaryPath,
              version: version || 'detected',
              isValid: true,
              source: 'system'
            });
          } else {
            console.log(`[TeXDetectionService] Validation failed for ${binaryName} at ${binaryPath}: code=${code}, output="${output.slice(0, 200)}..."`);
            resolve({
              path: binaryPath,
              version: null,
              isValid: false,
              source: 'system'
            });
          }
        });
        
        child.on('error', (error) => {
          clearTimeout(timeout);
          console.log(`[TeXDetectionService] Error validating ${binaryName} at ${binaryPath}:`, error.message);
          resolve({
            path: binaryPath,
            version: null,
            isValid: false,
            source: 'system'
          });
        });
      } catch (error) {
        console.log(`[TeXDetectionService] Exception validating ${binaryName} at ${binaryPath}:`, error);
        resolve({
          path: binaryPath,
          version: null,
          isValid: false,
          source: 'system'
        });
      }
    });
  }

  private extractVersion(output: string, binaryName: string): string | null {
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Common version patterns
      if (line.includes('TeX Live')) {
        const match = line.match(/TeX Live (\d{4})/);
        if (match) return `TeX Live ${match[1]}`;
      }
      
      if (line.includes('pdfTeX') && binaryName === 'pdflatex') {
        const match = line.match(/pdfTeX ([0-9.]+)/);
        if (match) return `pdfTeX ${match[1]}`;
      }
      
      if (line.includes('XeTeX') && binaryName === 'xelatex') {
        const match = line.match(/XeTeX ([0-9.]+)/);
        if (match) return `XeTeX ${match[1]}`;
      }
      
      if (line.includes('LuaTeX') && binaryName === 'lualatex') {
        const match = line.match(/LuaTeX ([0-9.]+)/);
        if (match) return `LuaTeX ${match[1]}`;
      }
      
      if (binaryName === 'latexmk') {
        const match = line.match(/Latexmk, John Collins, ([0-9. ]+)/);
        if (match) return `Latexmk ${match[1].trim()}`;
        
        // Alternative latexmk version pattern
        const altMatch = line.match(/latexmk version ([0-9.]+)/i);
        if (altMatch) return `Latexmk ${altMatch[1]}`;
      }
      
      if (binaryName === 'bibtex') {
        const match = line.match(/BibTeX ([0-9.]+)/);
        if (match) return `BibTeX ${match[1]}`;
        
        // Alternative BibTeX pattern
        const altMatch = line.match(/bibtex version ([0-9.]+)/i);
        if (altMatch) return `BibTeX ${altMatch[1]}`;
      }
      
      if (binaryName === 'biber') {
        const match = line.match(/biber version: ([0-9.]+)/i);
        if (match) return `Biber ${match[1]}`;
        
        // Alternative Biber pattern
        const altMatch = line.match(/Biber ([0-9.]+)/);
        if (altMatch) return `Biber ${altMatch[1]}`;
      }
    }
    
    // Fallback: look for any version number in the output
    for (const line of lines) {
      const versionMatch = line.match(/(?:version|v\.?)\s*:?\s*([0-9]+(?:\.[0-9]+)*)/i);
      if (versionMatch) {
        return versionMatch[1];
      }
    }
    
    return null;
  }

  getDefaultSettings(): TeXSettings {
    return {
      distributions: [],
      activeDistribution: '',
      engineDefault: 'pdflatex',
      timeoutMs: 180000, // 3 minutes
      maxLogSizeKB: 1024, // 1MB
      shellEscapeEnabled: false // Security: OFF by default
    };
  }
}
