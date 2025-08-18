import { spawn, ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { mkdir, copyFile, readdir, stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import { EventEmitter } from 'events';
import { CompileStatusDTO, ErrorDTO } from '../types';
import { ProjectService } from './ProjectService';
import { SettingsService } from './SettingsService';

interface CompileJob {
  id: string;
  projectId: string;
  state: 'queued' | 'running' | 'success' | 'error' | 'killed' | 'cancelled';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  logs: string[];
  errors: ErrorDTO[];
  process?: ChildProcess;
  buildDir?: string;
}

export class CompileOrchestrator extends EventEmitter {
  private jobs: Map<string, CompileJob> = new Map();
  private queue: string[] = [];
  private running = false;
  private projectService: ProjectService;
  private settingsService: SettingsService;

  constructor() {
    super();
    this.projectService = new ProjectService();
    this.settingsService = new SettingsService();
  }

  async createMockPDF(projectId: string): Promise<void> {
    const project = await this.projectService.getById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const outputDir = join(project.root, 'output');
    const outputPdf = join(outputDir, 'main.pdf');

    // Create a simple mock PDF content (minimal PDF structure)
    const mockPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 24 Tf
100 700 Td
(Hello LaTeX!) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000251 00000 n 
0000000318 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
410
%%EOF`;

    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });
    
    // Write the mock PDF
    const fs = require('fs').promises;
    await fs.writeFile(outputPdf, mockPdfContent, 'binary');
  }

  async run(projectId: string, engine?: string, mainFile?: string): Promise<{ jobId: string }> {
    const project = await this.projectService.getById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const jobId = uuidv4();
    const job: CompileJob = {
      id: jobId,
      projectId,
      state: 'queued',
      progress: 0,
      logs: [],
      errors: [],
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);

    // Start processing queue if not already running
    if (!this.running) {
      this.processQueue();
    }

    return { jobId };
  }

  async cancel(jobId: string): Promise<{ ok: boolean }> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { ok: false };
    }

    if (job.state === 'running' && job.process) {
      job.process.kill('SIGTERM');
      job.state = 'cancelled';
      job.endTime = new Date();
    } else if (job.state === 'queued') {
      job.state = 'cancelled';
      const queueIndex = this.queue.indexOf(jobId);
      if (queueIndex > -1) {
        this.queue.splice(queueIndex, 1);
      }
    }

    return { ok: true };
  }

  getStatus(jobId: string): CompileStatusDTO | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      jobId: job.id,
      state: job.state,
      progress: job.progress,
      startTime: job.startTime?.toISOString(),
      endTime: job.endTime?.toISOString(),
      logs: job.logs,
    };
  }

  getErrors(jobId: string): ErrorDTO[] {
    const job = this.jobs.get(jobId);
    return job ? job.errors : [];
  }

  private emitProgress(jobId: string, data: { 
    state?: string; 
    line?: string; 
    percent?: number; 
    message?: string 
  }) {
    this.emit('progress', {
      jobId,
      ...data
    });
  }

  private async processQueue() {
    if (this.running || this.queue.length === 0) {
      return;
    }

    this.running = true;

    while (this.queue.length > 0) {
      const jobId = this.queue.shift()!;
      const job = this.jobs.get(jobId);
      
      if (!job || job.state === 'cancelled') {
        continue;
      }

      await this.executeJob(job);
    }

    this.running = false;
  }

  private async executeJob(job: CompileJob) {
    try {
      job.state = 'running';
      job.startTime = new Date();
      job.progress = 10;
      
      // Emit initial progress
      this.emitProgress(job.id, { 
        state: 'running', 
        percent: 10, 
        message: 'Starting compilation...' 
      });

      const project = await this.projectService.getById(job.projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Create temporary build directory (Milestone 4: snapshot/lock read-only view)
      const buildDir = join(tmpdir(), `latex-build-${job.id}`);
      await mkdir(buildDir, { recursive: true });
      job.buildDir = buildDir;

      job.progress = 20;
      this.emitProgress(job.id, { 
        percent: 20, 
        message: 'Copying project files...' 
      });

      // Copy project files to build directory
      await this.copyProjectFiles(project.root, buildDir);
      job.progress = 40;
      this.emitProgress(job.id, { 
        percent: 40, 
        message: 'Setting up TeX environment...' 
      });

      // Get LaTeX binary path
      const engine = project.settings.engine || 'pdflatex';
      const latexmkPath = await this.settingsService.getTexBinaryPath('latexmk');
      
      console.log(`[CompileOrchestrator] Looking for latexmk, found: ${latexmkPath}`);
      console.log(`[CompileOrchestrator] Using engine: ${engine}`);
      
      if (!latexmkPath) {
        throw new Error('latexmk not found. Please install TeX Live or configure TeX paths.');
      }

      job.progress = 50;
      this.emitProgress(job.id, { 
        percent: 50, 
        message: 'Running LaTeX compilation...' 
      });

      // Run compilation
      console.log(`[CompileOrchestrator] Starting compilation with latexmk at: ${latexmkPath}`);
      console.log(`[CompileOrchestrator] Build directory: ${buildDir}`);
      console.log(`[CompileOrchestrator] Main file: ${project.mainFile}`);
      await this.runLatexmk(job, latexmkPath, buildDir, project.mainFile, engine);

      // Copy output back to project (Milestone 4: move main.pdf to project/output/main.pdf)
      const outputDir = join(project.root, 'output');
      await mkdir(outputDir, { recursive: true });
      
      // Always copy compile.log (Milestone 4: keep compile.log on error)
      const logPath = join(buildDir, project.mainFile.replace('.tex', '.log'));
      if (existsSync(logPath)) {
        await copyFile(logPath, join(outputDir, 'compile.log'));
      }
      
      const pdfPath = join(buildDir, project.mainFile.replace('.tex', '.pdf'));
      if (existsSync(pdfPath)) {
        await copyFile(pdfPath, join(outputDir, 'main.pdf'));
        job.state = 'success';
        this.emitProgress(job.id, { 
          state: 'success', 
          percent: 100, 
          message: 'Compilation completed successfully!' 
        });
      } else {
        job.state = 'error';
        job.logs.push('ERROR: PDF file not generated');
        this.emitProgress(job.id, { 
          state: 'error', 
          message: 'PDF file not generated' 
        });
      }

      job.progress = 100;
      job.endTime = new Date();

    } catch (error) {
      job.state = 'error';
      job.endTime = new Date();
      const errorMessage = error instanceof Error ? error.message : String(error);
      job.logs.push(`ERROR: ${errorMessage}`);
      this.emitProgress(job.id, { 
        state: 'error', 
        message: errorMessage 
      });
    }
  }

  private async copyProjectFiles(sourceDir: string, destDir: string) {
    const entries = await readdir(sourceDir);
    
    for (const entry of entries) {
      // Skip output directory and hidden files
      if (entry === 'output' || entry.startsWith('.')) {
        continue;
      }
      
      const sourcePath = join(sourceDir, entry);
      const destPath = join(destDir, entry);
      const stats = await stat(sourcePath);
      
      if (stats.isDirectory()) {
        await mkdir(destPath, { recursive: true });
        await this.copyProjectFiles(sourcePath, destPath);
      } else {
        await copyFile(sourcePath, destPath);
      }
    }
  }

  private async runLatexmk(job: CompileJob, latexmkPath: string, buildDir: string, mainFile: string, engine: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-interaction=nonstopmode',
        '-halt-on-error',
        '-file-line-error',
      ];

      // Add engine-specific flags
      switch (engine) {
        case 'xelatex':
          args.push('-xelatex');
          break;
        case 'lualatex':
          args.push('-lualatex');
          break;
        default:
          args.push('-pdf');
      }

      args.push(mainFile);

      // Milestone 4: Set TEXMFVAR & TEXINPUTS to project's temp build dir
      // Milestone 4: Default no -shell-escape for security
      const childProcess = spawn(latexmkPath, args, {
        cwd: buildDir,
        env: {
          ...process.env,
          TEXMFVAR: buildDir,
          TEXINPUTS: `${buildDir}:`,
          // Milestone 4: Sanitize env - remove potentially sensitive vars
          NODE_ENV: undefined,
          npm_config_cache: undefined,
        },
      });

      job.process = childProcess;

      let logBuffer = '';

      // Milestone 4: Capture stdout/stderr line-by-line to a rolling log
      childProcess.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        logBuffer += text;
        
        // Split into lines and emit each line as progress
        const lines = text.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            job.logs.push(line);
            // Emit live log lines (Milestone 4)
            this.emitProgress(job.id, { 
              line: line,
              percent: Math.min(90, job.progress + 5)
            });
          }
        });
        
        job.progress = Math.min(90, job.progress + 5);
      });

      childProcess.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        logBuffer += text;
        
        // Split into lines and emit each line as progress
        const lines = text.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            const logLine = `STDERR: ${line}`;
            job.logs.push(logLine);
            // Emit live log lines for stderr too
            this.emitProgress(job.id, { 
              line: logLine
            });
          }
        });
      });

      // Milestone 4: Hard timeout (180s default)
      const timeout = setTimeout(() => {
        childProcess.kill('SIGTERM');
        job.state = 'killed';
        this.emitProgress(job.id, { 
          state: 'killed', 
          message: 'Compilation timeout - process killed' 
        });
        reject(new Error('Compilation timeout'));
      }, 180000); // 3 minutes

      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeout);
        
        // Parse errors from log
        job.errors = this.parseLatexErrors(logBuffer, buildDir);
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`LaTeX compilation failed with exit code ${code}`));
        }
      });

      childProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private parseLatexErrors(logContent: string, buildDir: string): ErrorDTO[] {
    const errors: ErrorDTO[] = [];
    const lines = logContent.split('\n');
    
    let currentFile = '';
    const fileStack: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track file stack using parentheses
      if (line.includes('(./')) {
        const match = line.match(/\(\.\/([^)]+)/);
        if (match) {
          currentFile = match[1];
          fileStack.push(currentFile);
        }
      }
      
      // Error patterns
      const errorMatch = line.match(/^(.+):(\d+):\s*(.+)/);
      if (errorMatch) {
        const [, file, lineNum, message] = errorMatch;
        errors.push({
          file: file.replace(buildDir + '/', ''),
          line: parseInt(lineNum),
          message: message.trim(),
          severity: 'error',
        });
      }
      
      // Warning patterns
      const warningMatch = line.match(/Warning.*line (\d+)/i);
      if (warningMatch && currentFile) {
        errors.push({
          file: currentFile,
          line: parseInt(warningMatch[1]),
          message: line.trim(),
          severity: 'warning',
        });
      }
    }
    
    return errors;
  }
}
