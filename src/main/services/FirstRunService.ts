import { app } from 'electron';
import { join } from 'path';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { TeXDetectionService } from './TeXDetectionService';
import { SettingsService } from './SettingsService';

export interface FirstRunCheckResult {
  isFirstRun: boolean;
  checks: {
    appDataDirectory: boolean;
    bundledTeX: boolean;
    systemTeX: boolean;
    auroraTexInstalled: boolean;
    sampleTemplates: boolean;
    writePermissions: boolean;
  };
  texDistributions: any[];
  autoInstallAvailable: boolean;
  autoInstallRecommended: boolean;
  errors: string[];
  recommendations: string[];
}

export class FirstRunService {
  private settingsService: SettingsService;
  private texDetectionService: TeXDetectionService;
  private firstRunFile: string;

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
    this.texDetectionService = new TeXDetectionService();
    this.firstRunFile = join(app.getPath('userData'), '.first-run-complete');
  }

  async performFirstRunCheck(): Promise<FirstRunCheckResult> {
    console.log('[FirstRunService] Starting first-run self-check...');
    
    const isFirstRun = !existsSync(this.firstRunFile);
    const result: FirstRunCheckResult = {
      isFirstRun,
      checks: {
        appDataDirectory: false,
        bundledTeX: false,
        systemTeX: false,
        auroraTexInstalled: false,
        sampleTemplates: false,
        writePermissions: false
      },
      texDistributions: [],
      autoInstallAvailable: false,
      autoInstallRecommended: false,
      errors: [],
      recommendations: []
    };

    try {
            // 3. Check for bundled TeX distribution  
      result.checks.bundledTeX = await this.checkBundledTeX();
      
      // 4. Check for system TeX distribution
      result.checks.systemTeX = await this.checkSystemTeX();
      
      // 5. Check for AuroraTex-installed TeX
      result.checks.auroraTexInstalled = await this.checkAuroraTexInstalledTeX();
      
      // 6. Check sample templates
      result.checks.sampleTemplates = await this.checkSampleTemplates();
      
      // 7. Check write permissions
      result.checks.writePermissions = await this.checkWritePermissions();
      
      // 8. Check if automatic TeX installation is available and recommended
      await this.checkAutoInstallAvailability(result);
      
      // Generate recommendations
      this.generateRecommendations(result);
      
      // If this is a first run and basic checks pass, mark as complete
      if (isFirstRun && this.isMinimallyFunctional(result)) {
        this.markFirstRunComplete();
      }
      
    } catch (error) {
      console.error('[FirstRunService] Error during first-run check:', error);
      result.errors.push(`Self-check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private async checkAppDataDirectory(): Promise<boolean> {
    try {
      const userDataPath = app.getPath('userData');
      return existsSync(userDataPath);
    } catch (error) {
      console.error('[FirstRunService] App data directory check failed:', error);
      return false;
    }
  }

  private async checkBundledTeX(): Promise<boolean> {
    try {
      const bundledDistribution = await this.texDetectionService.detectBundledDistribution();
      return bundledDistribution?.isValid || false;
    } catch (error) {
      console.error('[FirstRunService] Bundled TeX check failed:', error);
      return false;
    }
  }

  private async checkSystemTeX(): Promise<boolean> {
    try {
      const systemDistribution = await this.texDetectionService.detectSystemDistribution();
      return systemDistribution?.isValid || false;
    } catch (error) {
      console.error('[FirstRunService] System TeX check failed:', error);
      return false;
    }
  }

  private async checkAuroraTexInstalledTeX(): Promise<boolean> {
    try {
      const auroraTexDistribution = await this.texDetectionService.detectAuroraTexInstalledDistribution();
      return auroraTexDistribution?.isValid || false;
    } catch (error) {
      console.error('[FirstRunService] AuroraTex-installed TeX check failed:', error);
      return false;
    }
  }

  private async checkAutoInstallAvailability(result: FirstRunCheckResult): Promise<void> {
    try {
      // Check if we should offer automatic TeX installation
      const shouldOffer = await this.texDetectionService.shouldOfferAutoInstall();
      const readiness = await this.texDetectionService.checkInstallationReadiness();
      
      result.autoInstallAvailable = readiness.canInstall;
      result.autoInstallRecommended = shouldOffer && readiness.canInstall;
      
      if (result.autoInstallRecommended) {
        result.recommendations.push('No TeX distribution found. AuroraTex can automatically install TeX Live for you.');
      } else if (shouldOffer && !readiness.canInstall) {
        result.recommendations.push(`Automatic TeX Live installation not available: ${readiness.issues.join(', ')}`);
      }
    } catch (error) {
      console.error('[FirstRunService] Auto-install availability check failed:', error);
      result.autoInstallAvailable = false;
      result.autoInstallRecommended = false;
    }
  }

  private async checkSampleTemplates(): Promise<boolean> {
    try {
      const templatesPath = join(process.resourcesPath || '', 'templates');
      return existsSync(templatesPath);
    } catch (error) {
      console.error('[FirstRunService] Sample templates check failed:', error);
      return false;
    }
  }

  private async checkWritePermissions(): Promise<boolean> {
    try {
      const testFile = join(app.getPath('userData'), 'write-test.tmp');
      writeFileSync(testFile, 'test');
      
      const content = readFileSync(testFile, 'utf8');
      require('fs').unlinkSync(testFile);
      
      return content === 'test';
    } catch (error) {
      console.error('[FirstRunService] Write permissions check failed:', error);
      return false;
    }
  }

  private generateRecommendations(result: FirstRunCheckResult): void {
    const { checks, texDistributions } = result;

    if (!checks.appDataDirectory) {
      result.errors.push('Cannot access application data directory');
      result.recommendations.push('Check file system permissions and available disk space');
    }

    if (!checks.writePermissions) {
      result.errors.push('Cannot write to application data directory');
      result.recommendations.push('Grant write permissions to the application data folder');
    }

    if (!checks.bundledTeX && !checks.systemTeX && !checks.auroraTexInstalled) {
      result.errors.push('No TeX distribution found');
      
      // Only recommend manual installation if auto-install is not available
      if (!result.autoInstallRecommended) {
        result.recommendations.push('Install TeX Live, MiKTeX, or use the bundled TeX distribution if available');
      }
    } else if (!checks.bundledTeX && !checks.auroraTexInstalled && checks.systemTeX) {
      result.recommendations.push('Using system TeX installation - ensure all required packages are installed');
    } else if (checks.bundledTeX) {
      result.recommendations.push('Using bundled TeX distribution - no additional setup required');
    } else if (checks.auroraTexInstalled) {
      result.recommendations.push('Using AuroraTex-installed TeX Live - automatically configured');
    }

    if (!checks.sampleTemplates) {
      result.recommendations.push('Sample templates not found - you can create projects from scratch');
    }

    if (texDistributions.length === 0) {
      result.recommendations.push('Consider installing a TeX distribution for full functionality');
    } else if (texDistributions.length > 1) {
      result.recommendations.push('Multiple TeX distributions found - you can switch between them in Settings');
    }

    // Security recommendations
    result.recommendations.push('Shell-escape is disabled by default for security');
    result.recommendations.push('Review security settings in Preferences if needed');
  }

  private isMinimallyFunctional(result: FirstRunCheckResult): boolean {
    const { checks } = result;
    
    // Minimum requirements for basic functionality
    return (
      checks.appDataDirectory &&
      checks.writePermissions &&
      (checks.bundledTeX || checks.systemTeX)
    );
  }

  private markFirstRunComplete(): void {
    try {
      const metadata = {
        completedAt: new Date().toISOString(),
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch
      };
      
      writeFileSync(this.firstRunFile, JSON.stringify(metadata, null, 2));
      console.log('[FirstRunService] First-run setup completed successfully');
    } catch (error) {
      console.error('[FirstRunService] Failed to mark first-run as complete:', error);
    }
  }

  isFirstRun(): boolean {
    return !existsSync(this.firstRunFile);
  }

  async writeDefaultSettings(): Promise<void> {
    console.log('[FirstRunService] Writing default settings...');
    
    try {
      // Get detected TeX distributions
      const distributions = await this.texDetectionService.detectAllDistributions();
      
      // Find the best distribution to use as default
      let activeDistribution = '';
      if (distributions.length > 0) {
        // Prefer bundled, then most complete system installation
        const bundled = distributions.find(d => d.isBundled && d.isValid);
        const system = distributions.find(d => !d.isBundled && d.isValid);
        
        if (bundled) {
          activeDistribution = bundled.name;
        } else if (system) {
          activeDistribution = system.name;
        }
      }
      
      // Set up default TeX settings
      const texSettings = {
        distributions,
        activeDistribution,
        engineDefault: 'pdflatex' as const,
        timeoutMs: 180000,
        maxLogSizeKB: 1024,
        shellEscapeEnabled: false
      };
      
      await this.settingsService.updateTexSettings(texSettings);
      
      // Set other default preferences
      await this.settingsService.set('firstRunCompleted', true);
      await this.settingsService.set('autoCompileEnabled', true);
      await this.settingsService.set('autoCompileDelay', 1000);
      
      console.log('[FirstRunService] Default settings written successfully');
    } catch (error) {
      console.error('[FirstRunService] Failed to write default settings:', error);
      throw error;
    }
  }
}
