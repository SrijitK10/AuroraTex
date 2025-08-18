"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const InMemoryDB_1 = require("./InMemoryDB");
class SettingsService {
    constructor() {
        // Initialize defaults
        InMemoryDB_1.inMemoryDB.initializeDefaults();
    }
    async initialize() {
        // No database initialization needed for in-memory storage
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
    async checkTexInstallation() {
        const binaries = ['pdflatex', 'xelatex', 'lualatex', 'latexmk', 'bibtex', 'biber'];
        const paths = {};
        let found = false;
        for (const binary of binaries) {
            const path = await this.findBinary(binary);
            if (path) {
                paths[binary] = path;
                found = true;
                // Store the found path
                await this.set(`tex.${binary}Path`, path);
            }
        }
        return { found, paths };
    }
    async findBinary(name) {
        // First check if we have a stored path
        const storedPath = await this.get(`tex.${name}Path`);
        if (storedPath && (0, fs_1.existsSync)(storedPath)) {
            return storedPath;
        }
        // Check common locations
        const commonPaths = [
            `/Library/TeX/texbin/${name}`, // MacTeX standard location
            `/usr/local/texlive/2024/bin/universal-darwin/${name}`,
            `/usr/local/texlive/2023/bin/universal-darwin/${name}`,
            `/usr/local/texlive/2022/bin/universal-darwin/${name}`,
            `/usr/local/texlive/2021/bin/universal-darwin/${name}`,
            `/usr/local/bin/${name}`,
            `/opt/homebrew/bin/${name}`,
            `/usr/bin/${name}`,
        ];
        for (const path of commonPaths) {
            if ((0, fs_1.existsSync)(path)) {
                return path;
            }
        }
        // Try to find in PATH using 'which' command
        return new Promise((resolve) => {
            const which = (0, child_process_1.spawn)('which', [name]);
            let output = '';
            which.stdout.on('data', (data) => {
                output += data.toString();
            });
            which.on('close', (code) => {
                if (code === 0 && output.trim()) {
                    resolve(output.trim());
                }
                else {
                    resolve(null);
                }
            });
            which.on('error', () => {
                resolve(null);
            });
        });
    }
    async getTexBinaryPath(binary) {
        const storedPath = await this.get(`tex.${binary}Path`);
        if (storedPath && (0, fs_1.existsSync)(storedPath)) {
            return storedPath;
        }
        // Try to find it
        const path = await this.findBinary(binary);
        if (path) {
            await this.set(`tex.${binary}Path`, path);
            return path;
        }
        return null;
    }
}
exports.SettingsService = SettingsService;
//# sourceMappingURL=SettingsService.js.map