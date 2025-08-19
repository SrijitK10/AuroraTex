import { TeXDistribution } from './TeXDetectionService';
export declare class SettingsService {
    private texDetection;
    constructor();
    initialize(): Promise<void>;
    setActiveDistribution(distributionName: string): Promise<{
        ok: boolean;
    }>;
    addCustomDistribution(name: string, paths: Record<string, string>): Promise<{
        ok: boolean;
    }>;
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<{
        ok: boolean;
    }>;
    getTeXDistribution(): Promise<TeXDistribution>;
    updateBinaryPath(binary: string, path: string): Promise<{
        ok: boolean;
        valid: boolean;
    }>;
    redetectTeXDistribution(): Promise<TeXDistribution>;
    checkTexInstallation(): Promise<{
        found: boolean;
        paths: Record<string, string>;
    }>;
    getTexBinaryPath(binary: string): Promise<string | null>;
}
//# sourceMappingURL=SettingsService.old.d.ts.map