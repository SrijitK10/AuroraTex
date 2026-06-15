import { spawn } from 'child_process';
import { platform } from 'os';
import { existsSync } from 'fs';
import { join } from 'path';

export interface SyncTexResult {
  file: string;
  line: number;
  column?: number;
}

export class SyncTexService {
  constructor(private getTexBinaryPath: (binaryName: string) => Promise<string | null>) {}

  public async inverseSearch(
    projectRoot: string,
    pdfPath: string,
    page: number,
    x: number, // in typographic points (pt)
    y: number  // in typographic points (pt)
  ): Promise<SyncTexResult | null> {
    if (!existsSync(pdfPath)) {
      return null;
    }

    const synctexPath = await this.getTexBinaryPath('synctex');
    if (!synctexPath) {
      console.warn('[SyncTexService] synctex binary not found');
      return null;
    }

    return new Promise((resolve) => {
      // synctex edit -o <page>:<x>:<y>:<file.pdf>
      const args = ['edit', '-o', `${page}:${x}:${y}:${pdfPath}`];
      
      const child = spawn(synctexPath, args, { cwd: projectRoot });
      let output = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('error', (err) => {
        console.error('[SyncTexService] Failed to run synctex:', err);
        resolve(null);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`[SyncTexService] synctex exited with code ${code}`);
          resolve(null);
          return;
        }

        const lines = output.split('\n');
        let file = '';
        let line = 1;
        let column: number | undefined = undefined;

        for (const l of lines) {
          if (l.startsWith('Input:')) {
            file = l.substring('Input:'.length).trim();
            // If absolute path within project root, make it relative
            if (file.startsWith(projectRoot)) {
              file = file.substring(projectRoot.length).replace(/^[/\\]+/, '');
            } else {
              // Extract relative path by finding a suffix that exists in projectRoot
              const parts = file.replace(/\\/g, '/').split('/');
              let foundRelativePath = '';
              for (let i = 0; i < parts.length; i++) {
                const candidate = parts.slice(i).join('/');
                if (existsSync(join(projectRoot, candidate))) {
                  foundRelativePath = candidate;
                  break;
                }
              }
              if (foundRelativePath) {
                file = foundRelativePath;
              } else {
                file = parts.pop() || file;
              }
            }
          } else if (l.startsWith('Line:')) {
            line = parseInt(l.substring('Line:'.length).trim(), 10);
          } else if (l.startsWith('Column:')) {
            const colVal = parseInt(l.substring('Column:'.length).trim(), 10);
            if (!isNaN(colVal)) column = colVal;
          }
        }

        if (file && !isNaN(line)) {
          resolve({ file, line, column });
        } else {
          resolve(null);
        }
      });
    });
  }
}
