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
export interface TeXBinary {
    name: string;
    path: string;
    version?: string;
    isValid: boolean;
}
export interface TeXDistribution {
    latexmk: TeXBinary;
    pdflatex: TeXBinary;
    xelatex: TeXBinary;
    lualatex: TeXBinary;
    biber: TeXBinary;
    bibtex: TeXBinary;
    isBundled: boolean;
    isValid: boolean;
}
export declare class TeXDetectionService {
    private bundledTexPath;
    constructor();
    detectTeXDistribution(): Promise<TeXDistribution>;
    private detectBundledTeX;
    private detectSystemTeX;
    private detectBinary;
    private findInPath;
    private getBinaryVersion;
    validateBinaryPath(path: string, expectedBinary: string): Promise<boolean>;
    getDefaultTeXSettings(): Record<string, any>;
}
//# sourceMappingURL=TeXDetectionService.old.d.ts.map