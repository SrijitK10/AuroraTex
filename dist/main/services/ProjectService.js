"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectService = void 0;
const path_1 = require("path");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const uuid_1 = require("uuid");
const os_1 = require("os");
const InMemoryDB_1 = require("./InMemoryDB");
const TemplateService_1 = require("./TemplateService");
class ProjectService {
    constructor() {
        // Initialize defaults
        InMemoryDB_1.inMemoryDB.initializeDefaults();
        this.templateService = new TemplateService_1.TemplateService();
    }
    async initialize() {
        // No database initialization needed for in-memory storage
    }
    async create(name, path, templateId) {
        const id = (0, uuid_1.v4)();
        const projectRoot = path || (0, path_1.join)((0, os_1.homedir)(), 'Documents', 'LaTeX Projects', name);
        const mainFile = 'main.tex';
        const now = new Date().toISOString();
        const defaultSettings = {
            engine: 'pdflatex',
            shellEscape: false,
            bibTool: 'bibtex',
            timeoutMs: 180000,
        };
        // Create project directory
        if (!(0, fs_1.existsSync)(projectRoot)) {
            await (0, promises_1.mkdir)(projectRoot, { recursive: true });
        }
        // Create output directory
        const outputDir = (0, path_1.join)(projectRoot, 'output');
        if (!(0, fs_1.existsSync)(outputDir)) {
            await (0, promises_1.mkdir)(outputDir, { recursive: true });
        }
        // Apply template if specified
        if (templateId) {
            const templateResult = await this.templateService.apply('', templateId, projectRoot);
            if (!templateResult.ok) {
                throw new Error('Failed to apply template');
            }
        }
        else {
            // Create default main.tex file only if no template is applied
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
            await (0, promises_1.writeFile)((0, path_1.join)(projectRoot, mainFile), defaultMainContent);
        }
        // Create project.json
        const projectConfig = {
            id,
            name,
            mainFile,
            settings: defaultSettings,
            createdAt: now,
            updatedAt: now,
        };
        await (0, promises_1.writeFile)((0, path_1.join)(projectRoot, 'project.json'), JSON.stringify(projectConfig, null, 2));
        // Insert into in-memory database
        InMemoryDB_1.inMemoryDB.insertProject({
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
    async open(projectPath) {
        const projectConfigPath = (0, path_1.join)(projectPath, 'project.json');
        // If project.json exists, open as existing app project
        if ((0, fs_1.existsSync)(projectConfigPath)) {
            return this.openExistingProject(projectPath);
        }
        // Otherwise, try to import as LaTeX project
        return this.importLatexProject(projectPath);
    }
    async openExistingProject(projectPath) {
        const projectConfigPath = (0, path_1.join)(projectPath, 'project.json');
        const configContent = await (0, promises_1.readFile)(projectConfigPath, 'utf-8');
        const config = JSON.parse(configContent);
        // Check if project already exists in database
        let project = InMemoryDB_1.inMemoryDB.getProjectByRoot(projectPath);
        if (!project) {
            // Add to database
            InMemoryDB_1.inMemoryDB.insertProject({
                id: config.id,
                name: config.name,
                root: projectPath,
                mainFile: config.mainFile,
                createdAt: config.createdAt,
                updatedAt: config.updatedAt,
                settings: config.settings,
            });
            project = InMemoryDB_1.inMemoryDB.getProjectByRoot(projectPath);
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
    async importLatexProject(projectPath) {
        // Check if this is a valid LaTeX project by looking for .tex files
        const files = await (0, promises_1.readdir)(projectPath);
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
        const id = (0, uuid_1.v4)();
        const projectName = (0, path_1.basename)(projectPath);
        const now = new Date().toISOString();
        const defaultSettings = {
            engine: 'pdflatex',
            shellEscape: false,
            bibTool: 'bibtex',
            timeoutMs: 180000,
        };
        // Create output directory
        const outputDir = (0, path_1.join)(projectPath, 'output');
        if (!(0, fs_1.existsSync)(outputDir)) {
            await (0, promises_1.mkdir)(outputDir, { recursive: true });
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
        await (0, promises_1.writeFile)((0, path_1.join)(projectPath, 'project.json'), JSON.stringify(projectConfig, null, 2));
        // Add to database
        InMemoryDB_1.inMemoryDB.insertProject({
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
    async list() {
        const projects = InMemoryDB_1.inMemoryDB.getAllProjects();
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
    async getById(projectId) {
        const project = InMemoryDB_1.inMemoryDB.getProject(projectId);
        if (!project)
            return null;
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
    async setMainFile(projectId, relPath) {
        const now = new Date().toISOString();
        const success = InMemoryDB_1.inMemoryDB.updateProject(projectId, {
            mainFile: relPath,
            updatedAt: now,
        });
        // Also update project.json
        const project = await this.getById(projectId);
        if (project) {
            const projectConfigPath = (0, path_1.join)(project.root, 'project.json');
            const configContent = await (0, promises_1.readFile)(projectConfigPath, 'utf-8');
            const config = JSON.parse(configContent);
            config.mainFile = relPath;
            config.updatedAt = now;
            await (0, promises_1.writeFile)(projectConfigPath, JSON.stringify(config, null, 2));
        }
        return { ok: success };
    }
    async ensureOutputDirectory(projectId) {
        const project = await this.getById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        const outputDir = (0, path_1.join)(project.root, 'output');
        // Create output directory if it doesn't exist
        if (!(0, fs_1.existsSync)(outputDir)) {
            await (0, promises_1.mkdir)(outputDir, { recursive: true });
        }
    }
}
exports.ProjectService = ProjectService;
//# sourceMappingURL=ProjectService.js.map