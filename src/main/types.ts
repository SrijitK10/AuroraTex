export interface ProjectDTO {
  id: string;
  name: string;
  root: string;
  mainFile: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  engine: 'pdflatex' | 'xelatex' | 'lualatex';
  shellEscape: boolean;
  bibTool: 'bibtex' | 'biber';
  timeoutMs: number;
}

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  mtime?: string;
  children?: FileNode[];
}

export interface CompileStatusDTO {
  jobId: string;
  state: 'queued' | 'running' | 'success' | 'error' | 'killed' | 'cancelled';
  progress?: number;
  startTime?: string;
  endTime?: string;
  logs: string[];
}

export interface ErrorDTO {
  file: string;
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface SnapshotDTO {
  id: string;
  projectId: string;
  timestamp: number;
  message?: string;
  path: string;
  sizeBytes: number;
  formattedDate?: string;
  formattedSize?: string;
}

export interface TemplateDTO {
  id: string;
  name: string;
  description: string;
  category: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

export interface SnippetDTO {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger: string;
  content: string;
  cursorPosition?: number;
}

export interface BibEntryDTO {
  id: string;
  type: string;
  key: string;
  fields: Record<string, string>;
}
