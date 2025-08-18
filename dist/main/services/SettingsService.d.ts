export declare class SettingsService {
    constructor();
    initialize(): Promise<void>;
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<{
        ok: boolean;
    }>;
    checkTexInstallation(): Promise<{
        found: boolean;
        paths: Record<string, string>;
    }>;
    private findBinary;
    getTexBinaryPath(binary: string): Promise<string | null>;
}
//# sourceMappingURL=SettingsService.d.ts.map