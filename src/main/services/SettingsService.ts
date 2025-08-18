import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { inMemoryDB } from './InMemoryDB';

export class SettingsService {
  constructor() {
    // Initialize defaults
    inMemoryDB.initializeDefaults();
  }

  async initialize() {
    // No database initialization needed for in-memory storage
  }

  async get(key: string): Promise<any> {
    const value = inMemoryDB.getPreference(key);
    
    if (!value) return null;
    
    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async set(key: string, value: any): Promise<{ ok: boolean }> {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    inMemoryDB.setPreference(key, valueStr);
    return { ok: true };
  }

  async checkTexInstallation(): Promise<{ found: boolean; paths: Record<string, string> }> {
    const binaries = ['pdflatex', 'xelatex', 'lualatex', 'latexmk', 'bibtex', 'biber'];
    const paths: Record<string, string> = {};
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

  private async findBinary(name: string): Promise<string | null> {
    // First check if we have a stored path
    const storedPath = await this.get(`tex.${name}Path`);
    if (storedPath && existsSync(storedPath)) {
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
      if (existsSync(path)) {
        return path;
      }
    }

    // Try to find in PATH using 'which' command
    return new Promise((resolve) => {
      const which = spawn('which', [name]);
      let output = '';
      
      which.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      which.on('close', (code) => {
        if (code === 0 && output.trim()) {
          resolve(output.trim());
        } else {
          resolve(null);
        }
      });
      
      which.on('error', () => {
        resolve(null);
      });
    });
  }

  async getTexBinaryPath(binary: string): Promise<string | null> {
    const storedPath = await this.get(`tex.${binary}Path`);
    if (storedPath && existsSync(storedPath)) {
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
