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

  // Milestone 13: Cold-start cache functionality
  async getLastOpenedProject(): Promise<string | null> {
    return await this.get('app.lastOpenedProject');
  }

  async setLastOpenedProject(projectId: string): Promise<{ ok: boolean }> {
    return await this.set('app.lastOpenedProject', projectId);
  }

  async getRecentProjects(): Promise<Array<{ id: string; name: string; lastOpened: number }>> {
    const recent = await this.get('app.recentProjects');
    return recent || [];
  }

  async addToRecentProjects(projectId: string, projectName: string): Promise<{ ok: boolean }> {
    const recent = await this.getRecentProjects();
    const existing = recent.findIndex(p => p.id === projectId);
    
    const projectEntry = {
      id: projectId,
      name: projectName,
      lastOpened: Date.now()
    };
    
    if (existing >= 0) {
      // Update existing entry
      recent[existing] = projectEntry;
    } else {
      // Add new entry
      recent.unshift(projectEntry);
    }
    
    // Keep only last 10 recent projects
    const trimmed = recent.slice(0, 10);
    
    // Sort by last opened (most recent first)
    trimmed.sort((a, b) => b.lastOpened - a.lastOpened);
    
    return await this.set('app.recentProjects', trimmed);
  }

  // Milestone 13: Incremental build settings
  async getIncrementalBuildSettings(): Promise<{
    enabled: boolean;
    preserveTempDir: boolean;
    cleanBuildThreshold: number; // Hours after which to force clean build
  }> {
    const settings = await this.get('compile.incrementalBuild');
    return settings || {
      enabled: true,
      preserveTempDir: true,
      cleanBuildThreshold: 24 // 24 hours default
    };
  }

  async updateIncrementalBuildSettings(settings: {
    enabled: boolean;
    preserveTempDir: boolean;
    cleanBuildThreshold: number;
  }): Promise<{ ok: boolean }> {
    return await this.set('compile.incrementalBuild', settings);
  }

  // Milestone 13: Editor state persistence
  async getEditorState(projectId: string): Promise<{
    openTabs?: Array<{ path: string; isActive: boolean }>;
    scrollPositions?: Record<string, { line: number; column: number }>;
    foldedRegions?: Record<string, Array<{ from: number; to: number }>>;
  } | null> {
    return await this.get(`editor.state.${projectId}`);
  }

  async saveEditorState(projectId: string, state: {
    openTabs?: Array<{ path: string; isActive: boolean }>;
    scrollPositions?: Record<string, { line: number; column: number }>;
    foldedRegions?: Record<string, Array<{ from: number; to: number }>>;
  }): Promise<{ ok: boolean }> {
    return await this.set(`editor.state.${projectId}`, state);
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
      shellEscapeEnabled: false, // Milestone 10: Default OFF for security
      shellEscapeGlobalWarning: true, // Milestone 10: Show global security warnings
      resourceLimits: {
        enableProcessPriority: true, // Milestone 10: Lower process priority on Unix
        maxCompileTimeMs: 180000, // Milestone 10: Hard timeout
        autoCompileTimeoutMs: 120000 // Milestone 10: Shorter timeout for auto-compile
      }
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
    let activeDistribution = settings.distributions.find(d => d.isActive);
    
    // If no active distribution is set, try to find the first valid one
    if (!activeDistribution) {
      activeDistribution = settings.distributions.find(d => d.isValid);
      if (activeDistribution) {
        console.log(`[SettingsService] No active distribution set, using first valid: ${activeDistribution.name}`);
        // Automatically set as active
        await this.setActiveDistribution(activeDistribution.name);
      }
    }
    
    if (activeDistribution) {
      const binaryInfo = activeDistribution[binary as keyof TeXDistribution] as any;
      if (binaryInfo && binaryInfo.path && binaryInfo.isValid) {
        console.log(`[SettingsService] Found ${binary} at: ${binaryInfo.path}`);
        return binaryInfo.path;
      } else {
        console.log(`[SettingsService] Binary ${binary} not found or invalid in active distribution`);
      }
    } else {
      console.log(`[SettingsService] No valid TeX distribution found for binary: ${binary}`);
    }
    
    return null;
  }
}
