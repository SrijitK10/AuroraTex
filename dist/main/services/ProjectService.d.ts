import { ProjectDTO } from '../types';
export declare class ProjectService {
    private templateService;
    constructor();
    initialize(): Promise<void>;
    create(name: string, path?: string, templateId?: string): Promise<ProjectDTO>;
    open(projectPath: string): Promise<ProjectDTO>;
    private openExistingProject;
    private importLatexProject;
    list(): Promise<ProjectDTO[]>;
    getById(projectId: string): Promise<ProjectDTO | null>;
    setMainFile(projectId: string, relPath: string): Promise<{
        ok: boolean;
    }>;
    ensureOutputDirectory(projectId: string): Promise<void>;
}
//# sourceMappingURL=ProjectService.d.ts.map