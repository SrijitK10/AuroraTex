import { TeXSettings } from './TeXDetectionService';
export declare class SettingsService {
    private inMemoryDB;
    private texDetection;
    constructor();
    initialize(): Promise<void>;
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<{
        ok: boolean;
    }>;
    private detectAndStoreTeXDistribution;
    getTexSettings(): Promise<TeXSettings>;
    updateTexSettings(settings: TeXSettings): Promise<{
        ok: boolean;
    }>;
    redetectTeX(): Promise<TeXSettings>;
    setActiveDistribution(distributionName: string): Promise<{
        ok: boolean;
    }>;
    addCustomDistribution(name: string, paths: Record<string, string>): Promise<{
        ok: boolean;
    }>;
    updateBinaryPath(binary: string, path: string): Promise<{
        ok: boolean;
        valid: boolean;
    }>;
    checkTexInstallation(): Promise<{
        found: boolean;
        paths: Record<string, string>;
    }>;
    getTexBinaryPath(binary: string): Promise<string | null>;
}
//# sourceMappingURL=SettingsService.new.d.ts.map