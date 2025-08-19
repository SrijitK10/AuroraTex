"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeXDetectionService = void 0;
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
'child_process';
class TeXDetectionService {
    constructor() {
        // Path to bundled TeX binaries (would be in resources in packaged app)
        this.bundledTexPath = (0, path_1.join)(process.resourcesPath || '', 'texlive', 'bin');
    }
    async detectTeXDistribution() {
        console.log('[TeXDetectionService] Starting TeX distribution detection...');
        // First try bundled TeX
        const bundledDistribution = await this.detectBundledTeX();
        if (bundledDistribution.isValid) {
            console.log('[TeXDetectionService] Found valid bundled TeX distribution');
            return bundledDistribution;
        }
        // Fall back to system PATH
        console.log('[TeXDetectionService] Bundled TeX not found, searching system PATH...');
        const systemDistribution = await this.detectSystemTeX();
        return systemDistribution;
    }
    async detectBundledTeX() {
        const binaries = {
            latexmk: await this.detectBinary('latexmk', this.bundledTexPath),
            pdflatex: await this.detectBinary('pdflatex', this.bundledTexPath),
            xelatex: await this.detectBinary('xelatex', this.bundledTexPath),
            lualatex: await this.detectBinary('lualatex', this.bundledTexPath),
            biber: await this.detectBinary('biber', this.bundledTexPath),
            bibtex: await this.detectBinary('bibtex', this.bundledTexPath),
        };
        const isValid = binaries.latexmk.isValid && binaries.pdflatex.isValid;
        return {
            ...binaries,
            isBundled: true,
            isValid
        };
    }
    async detectSystemTeX() {
        const binaries = {
            latexmk: await this.detectBinary('latexmk'),
            pdflatex: await this.detectBinary('pdflatex'),
            xelatex: await this.detectBinary('xelatex'),
            lualatex: await this.detectBinary('lualatex'),
            biber: await this.detectBinary('biber'),
            bibtex: await this.detectBinary('bibtex'),
        };
        const isValid = binaries.latexmk.isValid && binaries.pdflatex.isValid;
        return {
            ...binaries,
            isBundled: false,
            isValid
        };
    }
    async detectBinary(name, searchPath) {
        try {
            let fullPath;
            if (searchPath) {
                // Check specific path first
                const extension = process.platform === 'win32' ? '.exe' : '';
                fullPath = (0, path_1.join)(searchPath, name + extension);
                if (!(0, fs_1.existsSync)(fullPath)) {
                    return {
                        name,
                        path: '',
                        isValid: false
                    };
                }
            }
            else {
                // Use which/where to find in PATH
                const foundPath = await this.findInPath(name);
                if (!foundPath) {
                    return {
                        name,
                        path: '',
                        isValid: false
                    };
                }
                fullPath = foundPath;
            }
            // Validate binary by getting version
            const version = await this.getBinaryVersion(fullPath, name);
            return {
                name,
                path: fullPath,
                version,
                isValid: true
            };
        }
        catch (error) {
            console.log(`[TeXDetectionService] Failed to detect ${name}:`, error);
            return {
                name,
                path: '',
                isValid: false
            };
        }
    }
    async findInPath(binaryName) {
        return new Promise((resolve) => {
            const command = process.platform === 'win32' ? 'where' : 'which';
            const child = (0, child_process_1.spawn)(command, [binaryName], { shell: true });
            let output = '';
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            child.on('close', (code) => {
                if (code === 0 && output.trim()) {
                    const firstPath = output.split('\n')[0].trim();
                    resolve(firstPath);
                }
                else {
                    resolve(null);
                }
            });
            child.on('error', () => {
                resolve(null);
            });
        });
    }
    async getBinaryVersion(binaryPath, binaryName) {
        return new Promise((resolve) => {
            let versionArg = '--version';
            // Some binaries use different version flags
            if (binaryName === 'bibtex') {
                versionArg = '--version';
            }
            const child = (0, child_process_1.spawn)(binaryPath, [versionArg], { shell: false });
            let output = '';
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            child.stderr.on('data', (data) => {
                output += data.toString();
            });
            child.on('close', (code) => {
                if (output.trim()) {
                    // Extract version from output (first line usually contains version info)
                    const firstLine = output.split('\n')[0].trim();
                    resolve(firstLine);
                }
                else {
                    resolve(undefined);
                }
            });
            child.on('error', () => {
                resolve(undefined);
            });
            // Timeout after 5 seconds
            setTimeout(() => {
                child.kill();
                resolve(undefined);
            }, 5000);
        });
    }
    async validateBinaryPath(path, expectedBinary) {
        try {
            if (!(0, fs_1.existsSync)(path)) {
                return false;
            }
            const version = await this.getBinaryVersion(path, expectedBinary);
            return !!version;
        }
        catch {
            return false;
        }
    }
    getDefaultTeXSettings() {
        return {
            'tex.timeout': 180000, // 3 minutes
            'tex.maxLogSize': 1024 * 1024, // 1MB
            'tex.shellEscape': false,
            'tex.engine': 'pdflatex',
            'tex.bibTool': 'bibtex'
        };
    }
}
exports.TeXDetectionService = TeXDetectionService;
//# sourceMappingURL=TeXDetectionService.old.js.map