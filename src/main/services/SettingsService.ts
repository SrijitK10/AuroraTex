import { existsSync } from 'fs';
import { TeXDetectionService, TeXDistribution, TeXSettings } from './TeXDetectionService';

export class SettingsService {
  private inMemoryDB = new Map<string, any>();
  private texDetection: TeXDetectionService;

  constructor() {
    this.texDetection = new TeXDetectionService();
  }

  async initialize(): Promise<void> {
    console.log('[SettingsService] Initializing...');
    
    // Check if this is first run
    const hasSettings = await this.get('tex.initialized');
    
    if (!hasSettings) {
      console.log('[SettingsService] First run detected, performing TeX detection...');
      await this.detectAndStoreTeXDistribution();
      await this.set('tex.initialized', true);
    }
  }

  async get(key: string): Promise<any> {
    return this.inMemoryDB.get(key) || null;
  }

  async set(key: string, value: any): Promise<{ ok: boolean }> {
    this.inMemoryDB.set(key, value);
    return { ok: true };
  }

  private async detectAndStoreTeXDistribution(): Promise<TeXSettings> {
    const distributions = await this.texDetection.detectAllDistributions();
    
    // Set the first valid distribution as active, prefer bundled
    let activeDistribution = '';
    const bundled = distributions.find(d => d.isBundled && d.isValid);
    const system = distributions.find(d => !d.isBundled && d.isValid);
    
    if (bundled) {
      activeDistribution = bundled.name;
      bundled.isActive = true;
    } else if (system) {
      activeDistribution = system.name;
      system.isActive = true;
    }
    
    const settings: TeXSettings = {
      distributions,
      activeDistribution,
      engineDefault: 'pdflatex',
      timeoutMs: 180000,
      maxLogSizeKB: 1024,
      shellEscapeEnabled: false
    };
    
    // Store settings
    await this.set('tex.settings', settings);
    
    return settings;
  }

  async getTexSettings(): Promise<TeXSettings> {
    const stored = await this.get('tex.settings');
    if (stored) {
      return stored;
    }
    
    // Fallback: detect and store
    return await this.detectAndStoreTeXDistribution();
  }

  async updateTexSettings(settings: TeXSettings): Promise<{ ok: boolean }> {
    await this.set('tex.settings', settings);
    return { ok: true };
  }

  async redetectTeX(): Promise<TeXSettings> {
    console.log('[SettingsService] Re-detecting TeX distributions...');
    return await this.detectAndStoreTeXDistribution();
  }

  async setActiveDistribution(distributionName: string): Promise<{ ok: boolean }> {
    const settings = await this.getTexSettings();
    
    // Deactivate all distributions
    settings.distributions.forEach(d => d.isActive = false);
    
    // Activate the selected one
    const selected = settings.distributions.find(d => d.name === distributionName);
    if (selected) {
      selected.isActive = true;
      settings.activeDistribution = distributionName;
      await this.updateTexSettings(settings);
      return { ok: true };
    }
    
    return { ok: false };
  }

  async addCustomDistribution(name: string, paths: Record<string, string>): Promise<{ ok: boolean }> {
    const settings = await this.getTexSettings();
    
    const binaries: Record<string, any> = {};
    const binaryNames = ['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'biber', 'bibtex'];
    
    let validCount = 0;
    for (const binary of binaryNames) {
      const path = paths[binary];
      if (path) {
        const isValid = await this.texDetection.validateBinaryPath(path, binary);
        binaries[binary] = {
          path,
          version: 'Custom',
          isValid,
          source: 'custom'
        };
        if (isValid) validCount++;
      } else {
        binaries[binary] = {
          path: null,
          version: null,
          isValid: false,
          source: 'custom'
        };
      }
    }
    
    const customDistribution: TeXDistribution = {
      name,
      isBundled: false,
      isValid: validCount >= 3,
      isActive: false,
      latexmk: binaries.latexmk,
      pdflatex: binaries.pdflatex,
      xelatex: binaries.xelatex,
      lualatex: binaries.lualatex,
      biber: binaries.biber,
      bibtex: binaries.bibtex,
    };
    
    settings.distributions.push(customDistribution);
    await this.updateTexSettings(settings);
    
    return { ok: true };
  }

  async updateBinaryPath(binary: string, path: string): Promise<{ ok: boolean; valid: boolean }> {
    const isValid = await this.texDetection.validateBinaryPath(path, binary);
    
    if (isValid) {
      await this.set(`tex.${binary}Path`, path);
      // Clear version to force re-detection
      await this.set(`tex.${binary}Version`, null);
    }

    return { ok: true, valid: isValid };
  }

  // Legacy support for existing compile system
  async checkTexInstallation(): Promise<{ found: boolean; paths: Record<string, string> }> {
    const settings = await this.getTexSettings();
    const paths: Record<string, string> = {};
    
    const activeDistribution = settings.distributions.find(d => d.isActive);
    if (activeDistribution) {
      const binaries = ['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'biber', 'bibtex'];
      for (const binary of binaries) {
        const binaryInfo = activeDistribution[binary as keyof TeXDistribution] as any;
        if (binaryInfo && binaryInfo.path && binaryInfo.isValid) {
          paths[binary] = binaryInfo.path;
        }
      }
    }

    return { found: activeDistribution?.isValid || false, paths };
  }

  async getTexBinaryPath(binary: string): Promise<string | null> {
    const settings = await this.getTexSettings();
    const activeDistribution = settings.distributions.find(d => d.isActive);
    
    if (activeDistribution) {
      const binaryInfo = activeDistribution[binary as keyof TeXDistribution] as any;
      if (binaryInfo && binaryInfo.path && binaryInfo.isValid) {
        return binaryInfo.path;
      }
    }
    
    return null;
  }
}
