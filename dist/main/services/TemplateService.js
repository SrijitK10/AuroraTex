"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateService = void 0;
const path_1 = require("path");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const os_1 = require("os");
const uuid_1 = require("uuid");
class TemplateService {
    constructor() {
        this.templatesDir = (0, path_1.join)((0, os_1.homedir)(), '.myoverleaf', 'templates');
    }
    async initialize() {
        // Ensure templates directory exists
        if (!(0, fs_1.existsSync)(this.templatesDir)) {
            await (0, promises_1.mkdir)(this.templatesDir, { recursive: true });
        }
        // Create default templates if none exist
        await this.createDefaultTemplates();
    }
    async list() {
        const templates = [];
        try {
            const items = await (0, promises_1.readdir)(this.templatesDir);
            for (const item of items) {
                const templatePath = (0, path_1.join)(this.templatesDir, item);
                const templateConfigPath = (0, path_1.join)(templatePath, 'template.json');
                if ((0, fs_1.existsSync)(templateConfigPath)) {
                    try {
                        const config = await this.loadTemplateConfig(templateConfigPath);
                        const files = await this.loadTemplateFiles(templatePath, config.files);
                        templates.push({
                            id: config.id,
                            name: config.name,
                            description: config.description,
                            category: config.category,
                            files,
                        });
                    }
                    catch (error) {
                        console.error(`Failed to load template ${item}:`, error);
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to list templates:', error);
        }
        return templates;
    }
    async getById(templateId) {
        const templates = await this.list();
        return templates.find(template => template.id === templateId) || null;
    }
    async apply(projectId, templateId, projectRoot) {
        try {
            const template = await this.getById(templateId);
            if (!template) {
                throw new Error('Template not found');
            }
            // Ensure project directory exists
            if (!(0, fs_1.existsSync)(projectRoot)) {
                await (0, promises_1.mkdir)(projectRoot, { recursive: true });
            }
            // Copy template files to project
            for (const file of template.files) {
                const targetPath = (0, path_1.join)(projectRoot, file.path);
                const targetDir = (0, path_1.join)(targetPath, '..');
                // Ensure target directory exists
                if (!(0, fs_1.existsSync)(targetDir)) {
                    await (0, promises_1.mkdir)(targetDir, { recursive: true });
                }
                await (0, promises_1.writeFile)(targetPath, file.content);
            }
            return { ok: true };
        }
        catch (error) {
            console.error('Failed to apply template:', error);
            return { ok: false };
        }
    }
    async createDefaultTemplates() {
        const defaultTemplates = [
            {
                name: 'Article',
                description: 'Basic article template with common packages',
                category: 'Academic',
                files: {
                    'main.tex': `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{Article Title}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
Your abstract goes here.
\\end{abstract}

\\section{Introduction}

This is the introduction section.

\\section{Methods}

Describe your methods here.

\\section{Results}

Present your results here.

\\section{Conclusion}

Summarize your findings.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}`,
                    'references.bib': `@article{example2023,
    title={Example Article},
    author={John Doe and Jane Smith},
    journal={Example Journal},
    volume={1},
    number={1},
    pages={1--10},
    year={2023},
    publisher={Example Publisher}
}`
                }
            },
            {
                name: 'Report',
                description: 'Professional report template with title page',
                category: 'Academic',
                files: {
                    'main.tex': `\\documentclass[12pt]{report}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{geometry}

\\geometry{
    a4paper,
    left=25mm,
    right=25mm,
    top=25mm,
    bottom=25mm
}

\\title{Report Title}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\tableofcontents
\\newpage

\\chapter{Introduction}

This is the introduction chapter.

\\section{Background}

Provide background information here.

\\chapter{Analysis}

Present your analysis here.

\\section{Data}

Describe your data.

\\section{Results}

Show your results.

\\chapter{Conclusion}

Summarize your findings and recommendations.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}`,
                    'references.bib': `@book{example2023,
    title={Example Book},
    author={John Doe},
    publisher={Example Publisher},
    year={2023},
    address={City, Country}
}`
                }
            },
            {
                name: 'Presentation (Beamer)',
                description: 'Beamer presentation template',
                category: 'Presentations',
                files: {
                    'main.tex': `\\documentclass{beamer}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}

\\usetheme{Madrid}
\\usecolortheme{beaver}

\\title{Presentation Title}
\\subtitle{Subtitle}
\\author{Your Name}
\\institute{Your Institution}
\\date{\\today}

\\begin{document}

\\frame{\\titlepage}

\\begin{frame}
\\frametitle{Outline}
\\tableofcontents
\\end{frame}

\\section{Introduction}
\\begin{frame}
\\frametitle{Introduction}
\\begin{itemize}
    \\item First point
    \\item Second point
    \\item Third point
\\end{itemize}
\\end{frame}

\\section{Main Content}
\\begin{frame}
\\frametitle{Main Content}
\\begin{block}{Important Point}
This is an important point to remember.
\\end{block}

\\begin{alertblock}{Warning}
This is a warning message.
\\end{alertblock}

\\begin{exampleblock}{Example}
This is an example.
\\end{exampleblock}
\\end{frame}

\\section{Conclusion}
\\begin{frame}
\\frametitle{Conclusion}
\\begin{itemize}
    \\item Summary point 1
    \\item Summary point 2
    \\item Thank you for your attention
\\end{itemize}
\\end{frame}

\\end{document}`
                }
            },
            {
                name: 'Letter',
                description: 'Formal letter template',
                category: 'Documents',
                files: {
                    'main.tex': `\\documentclass{letter}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}

\\signature{Your Name}
\\address{Your Name \\\\ Your Address \\\\ City, State ZIP \\\\ Email: your.email@example.com}

\\begin{document}

\\begin{letter}{Recipient Name \\\\ Recipient Address \\\\ City, State ZIP}

\\opening{Dear Sir or Madam,}

This is the body of your letter. Write your message here.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

\\closing{Sincerely,}

\\end{letter}

\\end{document}`
                }
            }
        ];
        for (const template of defaultTemplates) {
            const templateId = (0, uuid_1.v4)();
            const templateDir = (0, path_1.join)(this.templatesDir, templateId);
            // Skip if template directory already exists
            if ((0, fs_1.existsSync)(templateDir)) {
                continue;
            }
            await (0, promises_1.mkdir)(templateDir, { recursive: true });
            // Create template.json
            const config = {
                id: templateId,
                name: template.name,
                description: template.description,
                category: template.category,
                mainFile: 'main.tex',
                files: Object.keys(template.files),
                createdAt: new Date().toISOString(),
            };
            await (0, promises_1.writeFile)((0, path_1.join)(templateDir, 'template.json'), JSON.stringify(config, null, 2));
            // Create template files
            for (const [fileName, content] of Object.entries(template.files)) {
                await (0, promises_1.writeFile)((0, path_1.join)(templateDir, fileName), content);
            }
        }
    }
    async loadTemplateConfig(configPath) {
        const content = await (0, promises_1.readFile)(configPath, 'utf-8');
        return JSON.parse(content);
    }
    async loadTemplateFiles(templatePath, fileNames) {
        const files = [];
        for (const fileName of fileNames) {
            const filePath = (0, path_1.join)(templatePath, fileName);
            if ((0, fs_1.existsSync)(filePath)) {
                const content = await (0, promises_1.readFile)(filePath, 'utf-8');
                files.push({
                    path: fileName,
                    content,
                });
            }
        }
        return files;
    }
}
exports.TemplateService = TemplateService;
//# sourceMappingURL=TemplateService.js.map