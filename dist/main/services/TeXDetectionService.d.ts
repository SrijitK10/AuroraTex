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
    shellEscapeGlobalWarning?: boolean;
    resourceLimits?: {
        enableProcessPriority: boolean;
        maxCompileTimeMs: number;
        autoCompileTimeoutMs: number;
    };
}
export declare class TeXDetectionService {
    private bundledPath;
    constructor();
    detectAllDistributions(): Promise<TeXDistribution[]>;
    detectBundledDistribution(): Promise<TeXDistribution | null>;
    detectSystemDistribution(): Promise<TeXDistribution | null>;
    private findInPath;
    validateBinaryPath(path: string, binaryName: string): Promise<boolean>;
    private validateBinaryAtPath;
    private extractVersion;
    getDefaultSettings(): TeXSettings;
}
//# sourceMappingURL=TeXDetectionService.d.ts.map