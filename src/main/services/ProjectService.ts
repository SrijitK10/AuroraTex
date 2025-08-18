import { join, resolve, basename } from 'path';
import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { homedir } from 'os';
import { ProjectDTO, ProjectSettings } from '../types';
import { inMemoryDB } from './InMemoryDB';

export class ProjectService {
  constructor() {
    // Initialize defaults
    inMemoryDB.initializeDefaults();
  }

  async initialize() {
    // No database initialization needed for in-memory storage
  }

  async create(name: string, path?: string, templateId?: string): Promise<ProjectDTO> {
    const id = uuidv4();
    const projectRoot = path || join(homedir(), 'Documents', 'LaTeX Projects', name);
    const mainFile = 'main.tex';
    const now = new Date().toISOString();

    const defaultSettings: ProjectSettings = {
      engine: 'pdflatex',
      shellEscape: false,
      bibTool: 'bibtex',
      timeoutMs: 180000,
    };

    // Create project directory
    if (!existsSync(projectRoot)) {
      await mkdir(projectRoot, { recursive: true });
    }

    // Create output directory
    const outputDir = join(projectRoot, 'output');
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // Create default main.tex file
    const defaultMainContent = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}

\\title{${name}}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

Welcome to your new LaTeX document!

\\end{document}`;

    await writeFile(join(projectRoot, mainFile), defaultMainContent);

    // Create project.json
    const projectConfig = {
      id,
      name,
      mainFile,
      settings: defaultSettings,
      createdAt: now,
      updatedAt: now,
    };

    await writeFile(join(projectRoot, 'project.json'), JSON.stringify(projectConfig, null, 2));

    // Insert into in-memory database
    inMemoryDB.insertProject({
      id,
      name,
      root: projectRoot,
      mainFile,
      createdAt: now,
      updatedAt: now,
      settings: defaultSettings,
    });

    return {
      id,
      name,
      root: projectRoot,
      mainFile,
      createdAt: now,
      updatedAt: now,
      settings: defaultSettings,
    };
  }

  async open(projectPath: string): Promise<ProjectDTO> {
    const projectConfigPath = join(projectPath, 'project.json');
    
    // If project.json exists, open as existing app project
    if (existsSync(projectConfigPath)) {
      return this.openExistingProject(projectPath);
    }
    
    // Otherwise, try to import as LaTeX project
    return this.importLatexProject(projectPath);
  }

  private async openExistingProject(projectPath: string): Promise<ProjectDTO> {
    const projectConfigPath = join(projectPath, 'project.json');
    const configContent = await readFile(projectConfigPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Check if project already exists in database
    let project = inMemoryDB.getProjectByRoot(projectPath);

    if (!project) {
      // Add to database
      inMemoryDB.insertProject({
        id: config.id,
        name: config.name,
        root: projectPath,
        mainFile: config.mainFile,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        settings: config.settings,
      });

      project = inMemoryDB.getProjectByRoot(projectPath);
    }

    if (!project) {
      throw new Error('Failed to load project');
    }

    return {
      id: project.id,
      name: project.name,
      root: project.root,
      mainFile: project.mainFile,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      settings: project.settings,
    };
  }

  private async importLatexProject(projectPath: string): Promise<ProjectDTO> {
    // Check if this is a valid LaTeX project by looking for .tex files
    const files = await readdir(projectPath);
    const texFiles = files.filter(file => file.endsWith('.tex'));
    
    if (texFiles.length === 0) {
      throw new Error('No LaTeX files (.tex) found in the selected folder');
    }

    // Try to detect the main file
    let mainFile = 'main.tex';
    
    // Look for common main file names
    const commonMainNames = ['main.tex', 'document.tex', 'paper.tex', 'thesis.tex'];
    for (const name of commonMainNames) {
      if (texFiles.includes(name)) {
        mainFile = name;
        break;
      }
    }
    
    // If no common name found, use the first .tex file
    if (!texFiles.includes(mainFile)) {
      mainFile = texFiles[0];
    }

    // Generate project metadata
    const id = uuidv4();
    const projectName = basename(projectPath);
    const now = new Date().toISOString();

    const defaultSettings: ProjectSettings = {
      engine: 'pdflatex',
      shellEscape: false,
      bibTool: 'bibtex',
      timeoutMs: 180000,
    };

    // Create output directory
    const outputDir = join(projectPath, 'output');
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // Create project.json for future use
    const projectConfig = {
      id,
      name: projectName,
      mainFile,
      settings: defaultSettings,
      createdAt: now,
      updatedAt: now,
    };

    await writeFile(join(projectPath, 'project.json'), JSON.stringify(projectConfig, null, 2));

    // Add to database
    inMemoryDB.insertProject({
      id,
      name: projectName,
      root: projectPath,
      mainFile,
      createdAt: now,
      updatedAt: now,
      settings: defaultSettings,
    });

    return {
      id,
      name: projectName,
      root: projectPath,
      mainFile,
      createdAt: now,
      updatedAt: now,
      settings: defaultSettings,
    };
  }

  async list(): Promise<ProjectDTO[]> {
    const projects = inMemoryDB.getAllProjects();

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      root: project.root,
      mainFile: project.mainFile,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      settings: project.settings,
    }));
  }

  async getById(projectId: string): Promise<ProjectDTO | null> {
    const project = inMemoryDB.getProject(projectId);

    if (!project) return null;

    return {
      id: project.id,
      name: project.name,
      root: project.root,
      mainFile: project.mainFile,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      settings: project.settings,
    };
  }

  async setMainFile(projectId: string, relPath: string): Promise<{ ok: boolean }> {
    const now = new Date().toISOString();
    const success = inMemoryDB.updateProject(projectId, {
      mainFile: relPath,
      updatedAt: now,
    });

    // Also update project.json
    const project = await this.getById(projectId);
    if (project) {
      const projectConfigPath = join(project.root, 'project.json');
      const configContent = await readFile(projectConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      config.mainFile = relPath;
      config.updatedAt = now;
      await writeFile(projectConfigPath, JSON.stringify(config, null, 2));
    }

    return { ok: success };
  }

  async ensureOutputDirectory(projectId: string): Promise<void> {
    const project = await this.getById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const outputDir = join(project.root, 'output');
    
    // Create output directory if it doesn't exist
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }
  }
}
