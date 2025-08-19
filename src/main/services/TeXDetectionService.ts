import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

export interface TeXBinary {
  path: string | null;
  version: string | null;
  isValid: boolean;
  source: 'bundled' | 'system' | 'custom';
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
}

export class TeXDetectionService {
  private bundledPath: string;

  constructor() {
    // Path to bundled TeX distribution (if included)
    this.bundledPath = join(process.resourcesPath || '', 'texlive', 'bin');
  }

  async detectAllDistributions(): Promise<TeXDistribution[]> {
    console.log('[TeXDetectionService] Starting comprehensive TeX distribution detection...');
    
    const distributions: TeXDistribution[] = [];
    
    // 1. Try bundled distribution
    const bundled = await this.detectBundledDistribution();
    if (bundled) {
      distributions.push(bundled);
    }
    
    // 2. Try system distributions
    const system = await this.detectSystemDistribution();
    if (system) {
      distributions.push(system);
    }
    
    return distributions;
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
      const detected = await this.findInPath(binary);
      
      if (detected) {
        detectedBinaries[binary] = {
          ...detected,
          source: 'system'
        };
        if (detected.isValid) validCount++;
      } else {
        detectedBinaries[binary] = {
          path: null,
          version: null,
          isValid: false,
          source: 'system'
        };
      }
    }

    if (validCount === 0) {
      console.log('[TeXDetectionService] No system TeX binaries found');
      return null;
    }

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

  async validateBinaryPath(path: string, binaryName: string): Promise<boolean> {
    const result = await this.validateBinaryAtPath(path, binaryName);
    return result?.isValid || false;
  }

  private async validateBinaryAtPath(binaryPath: string, binaryName: string): Promise<TeXBinary | null> {
    if (!existsSync(binaryPath)) {
      return null;
    }

    return new Promise((resolve) => {
      // Get version to validate binary works
      const versionArg = binaryName === 'latexmk' ? '-version' : '--version';
      
      try {
        const child = spawn(binaryPath, [versionArg], { shell: false });
        let output = '';
        
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });
        
        child.stderr?.on('data', (data) => {
          output += data.toString();
        });
        
        const timeout = setTimeout(() => {
          child.kill();
          resolve({
            path: binaryPath,
            version: null,
            isValid: false,
            source: 'system'
          });
        }, 5000);
        
        child.on('close', (code) => {
          clearTimeout(timeout);
          
          if (code === 0 || output.includes('TeX Live') || output.includes('pdfTeX') || output.includes('XeTeX') || output.includes('LuaTeX')) {
            // Extract version from output
            const version = this.extractVersion(output, binaryName);
            
            resolve({
              path: binaryPath,
              version: version || 'unknown',
              isValid: true,
              source: 'system'
            });
          } else {
            resolve({
              path: binaryPath,
              version: null,
              isValid: false,
              source: 'system'
            });
          }
        });
        
        child.on('error', () => {
          clearTimeout(timeout);
          resolve({
            path: binaryPath,
            version: null,
            isValid: false,
            source: 'system'
          });
        });
      } catch (error) {
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
