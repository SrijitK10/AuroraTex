"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inMemoryDB = void 0;
class InMemoryDB {
    constructor() {
        this.projects = new Map();
        this.snapshots = new Map();
        this.preferences = new Map();
    }
    // Projects
    insertProject(project) {
        this.projects.set(project.id, project);
    }
    getProject(id) {
        return this.projects.get(id);
    }
    getProjectByRoot(root) {
        for (const project of this.projects.values()) {
            if (project.root === root) {
                return project;
            }
        }
        return undefined;
    }
    getAllProjects() {
        return Array.from(this.projects.values())
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    updateProject(id, updates) {
        const project = this.projects.get(id);
        if (project) {
            this.projects.set(id, { ...project, ...updates });
            return true;
        }
        return false;
    }
    // Snapshots
    insertSnapshot(snapshot) {
        this.snapshots.set(snapshot.id, snapshot);
    }
    getSnapshot(id) {
        return this.snapshots.get(id);
    }
    getSnapshotsByProject(projectId) {
        return Array.from(this.snapshots.values())
            .filter(s => s.projectId === projectId)
            .sort((a, b) => b.timestamp - a.timestamp);
    }
    deleteSnapshot(id) {
        return this.snapshots.delete(id);
    }
    // Preferences
    setPreference(key, value) {
        this.preferences.set(key, value);
    }
    getPreference(key) {
        return this.preferences.get(key);
    }
    // Initialize with defaults
    initializeDefaults() {
        const defaults = {
            'compile.timeout': '180000',
            'compile.engine': 'pdflatex',
            'compile.autoCompile': 'true',
            'compile.autoCompileDelay': '750',
            'security.shellEscape': 'false',
            'tex.pdflatexPath': '',
            'tex.xelatexPath': '',
            'tex.lualatexPath': '',
            'tex.latexmkPath': '',
            'tex.biberPath': '',
            'tex.bibtexPath': '',
        };
        for (const [key, value] of Object.entries(defaults)) {
            if (!this.preferences.has(key)) {
                this.preferences.set(key, value);
            }
        }
    }
}
exports.inMemoryDB = new InMemoryDB();
//# sourceMappingURL=InMemoryDB.js.map