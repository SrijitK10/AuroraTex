// Simple in-memory database for development (will be replaced with SQLite later)
export interface ProjectData {
  id: string;
  name: string;
  root: string;
  mainFile: string;
  createdAt: string;
  updatedAt: string;
  settings: any;
}

export interface SnapshotData {
  id: string;
  projectId: string;
  timestamp: number;
  message?: string;
  path: string;
  sizeBytes: number;
}

export interface PreferenceData {
  key: string;
  value: string;
}

class InMemoryDB {
  private projects: Map<string, ProjectData> = new Map();
  private snapshots: Map<string, SnapshotData> = new Map();
  private preferences: Map<string, string> = new Map();

  // Projects
  insertProject(project: ProjectData) {
    this.projects.set(project.id, project);
  }

  getProject(id: string): ProjectData | undefined {
    return this.projects.get(id);
  }

  getProjectByRoot(root: string): ProjectData | undefined {
    for (const project of this.projects.values()) {
      if (project.root === root) {
        return project;
      }
    }
    return undefined;
  }

  getAllProjects(): ProjectData[] {
    return Array.from(this.projects.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  updateProject(id: string, updates: Partial<ProjectData>) {
    const project = this.projects.get(id);
    if (project) {
      this.projects.set(id, { ...project, ...updates });
      return true;
    }
    return false;
  }

  // Snapshots
  insertSnapshot(snapshot: SnapshotData) {
    this.snapshots.set(snapshot.id, snapshot);
  }

  getSnapshot(id: string): SnapshotData | undefined {
    return this.snapshots.get(id);
  }

  getSnapshotsByProject(projectId: string): SnapshotData[] {
    return Array.from(this.snapshots.values())
      .filter(s => s.projectId === projectId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  deleteSnapshot(id: string): boolean {
    return this.snapshots.delete(id);
  }

  // Preferences
  setPreference(key: string, value: string) {
    this.preferences.set(key, value);
  }

  getPreference(key: string): string | undefined {
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

export const inMemoryDB = new InMemoryDB();
