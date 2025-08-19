import { TemplateDTO } from '../types';
export interface TemplateFile {
    path: string;
    content: string;
}
export interface TemplateConfig {
    id: string;
    name: string;
    description: string;
    category: string;
    mainFile: string;
    files: string[];
    createdAt: string;
}
export declare class TemplateService {
    private templatesDir;
    constructor();
    initialize(): Promise<void>;
    list(): Promise<TemplateDTO[]>;
    getById(templateId: string): Promise<TemplateDTO | null>;
    apply(projectId: string, templateId: string, projectRoot: string): Promise<{
        ok: boolean;
    }>;
    private createDefaultTemplates;
    private loadTemplateConfig;
    private loadTemplateFiles;
    private cleanupDuplicates;
    private deleteDirectory;
}
//# sourceMappingURL=TemplateService.d.ts.map