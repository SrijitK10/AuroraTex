"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const fs_1 = require("fs");
const InMemoryDB_1 = require("./InMemoryDB");
const TeXDetectionService_1 = require("./TeXDetectionService");
class SettingsService {
    constructor() {
        // Initialize defaults
        InMemoryDB_1.inMemoryDB.initializeDefaults();
        this.texDetection = new TeXDetectionService_1.TeXDetectionService();
    }
    async initialize() {
        console.log('[SettingsService] Initializing...');
        // Check if this is first run
        const hasSettings = await this.get('tex.initialized');
        if (!hasSettings) {
            console.log('[SettingsService] First run detected, performing TeX detection...');
            await this.detectAndStoreTeXDistribution();
            await this.set('tex.initialized', true);
        }
    }
    async detectAndStoreTeXDistribution() {
        const distributions = await this.texDetection.detectAllDistributions();
        // Set the first valid distribution as active, prefer bundled
        let activeDistribution = '';
        const bundled = distributions.find(d => d.isBundled && d.isValid);
        const system = distributions.find(d => !d.isBundled && d.isValid);
        if (bundled) {
            activeDistribution = bundled.name;
            bundled.isActive = true;
        }
        else if (system) {
            activeDistribution = system.name;
            system.isActive = true;
        }
        const settings = {
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
    async getTexSettings() {
        const stored = await this.get('tex.settings');
        if (stored) {
            return stored;
        }
        // Fallback: detect and store
        return await this.detectAndStoreTeXDistribution();
    }
    async updateTexSettings(settings) {
        await this.set('tex.settings', settings);
        return { ok: true };
    }
    async redetectTeX() {
        console.log('[SettingsService] Re-detecting TeX distributions...');
        return await this.detectAndStoreTeXDistribution();
    }
    async setActiveDistribution(distributionName) {
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
    async addCustomDistribution(name, paths) {
        const settings = await this.getTexSettings();
        const binaries = {};
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
                if (isValid)
                    validCount++;
            }
            else {
                binaries[binary] = {
                    path: null,
                    version: null,
                    isValid: false,
                    source: 'custom'
                };
            }
        }
        const customDistribution = {
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
    async get(key) {
        const value = InMemoryDB_1.inMemoryDB.getPreference(key);
        if (!value)
            return null;
        // Try to parse as JSON, fallback to string
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    async set(key, value) {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        InMemoryDB_1.inMemoryDB.setPreference(key, valueStr);
        return { ok: true };
    }
    async detectAndStoreTeXDistribution() {
        const distribution = await this.texDetection.detectTeXDistribution();
        // Store binary paths
        const binaries = ['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'biber', 'bibtex'];
        for (const binary of binaries) {
            const binaryInfo = distribution[binary];
            if (binaryInfo && binaryInfo.path) {
                await this.set(`tex.${binary}Path`, binaryInfo.path);
                if (binaryInfo.version) {
                    await this.set(`tex.${binary}Version`, binaryInfo.version);
                }
            }
        }
        // Store distribution metadata
        await this.set('tex.isBundled', distribution.isBundled);
        await this.set('tex.isValid', distribution.isValid);
        await this.set('tex.lastDetection', new Date().toISOString());
        return distribution;
    }
    async getTeXDistribution() {
        const binaries = ['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'biber', 'bibtex'];
        const distribution = {
            isBundled: await this.get('tex.isBundled') || false,
            isValid: false
        };
        for (const binary of binaries) {
            const path = await this.get(`tex.${binary}Path`) || '';
            const version = await this.get(`tex.${binary}Version`) || undefined;
            distribution[binary] = {
                name: binary,
                path,
                version,
                isValid: !!path && (0, fs_1.existsSync)(path)
            };
        }
        distribution.isValid = distribution.latexmk.isValid && distribution.pdflatex.isValid;
        return distribution;
    }
    async updateBinaryPath(binary, path) {
        const isValid = await this.texDetection.validateBinaryPath(path, binary);
        if (isValid) {
            await this.set(`tex.${binary}Path`, path);
            // Clear version to force re-detection
            await this.set(`tex.${binary}Version`, null);
        }
        return { ok: true, valid: isValid };
    }
    async redetectTeXDistribution() {
        console.log('[SettingsService] Re-detecting TeX distribution...');
        return await this.detectAndStoreTeXDistribution();
    }
    async getTexSettings() {
        return await this.getTeXDistribution();
    }
    async updateTexSettings(settings) {
        // Update binary paths if provided
        for (const binary of ['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'biber', 'bibtex']) {
            const binaryInfo = settings[binary];
            if (binaryInfo && binaryInfo.path) {
                await this.updateBinaryPath(binary, binaryInfo.path);
            }
        }
        return { ok: true };
    }
    async redetectTeX() {
        return await this.redetectTeXDistribution();
    }
    async checkTexInstallation() {
        const distribution = await this.getTeXDistribution();
        const paths = {};
        const binaries = ['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'biber', 'bibtex'];
        for (const binary of binaries) {
            const binaryInfo = distribution[binary];
            if (binaryInfo && binaryInfo.path) {
                paths[binary] = binaryInfo.path;
            }
        }
        return { found: distribution.isValid, paths };
    }
    async getTexBinaryPath(binary) {
        const storedPath = await this.get(`tex.${binary}Path`);
        if (storedPath && (0, fs_1.existsSync)(storedPath)) {
            return storedPath;
        }
        return null;
    }
}
exports.SettingsService = SettingsService;
//# sourceMappingURL=SettingsService.old.js.map