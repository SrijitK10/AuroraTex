import { SnippetDTO } from '../types';
export declare class SnippetService {
    private snippetsDir;
    private snippetsFile;
    constructor();
    initialize(): Promise<void>;
    list(): Promise<SnippetDTO[]>;
    search(query: string): Promise<SnippetDTO[]>;
    getByCategory(category: string): Promise<SnippetDTO[]>;
    private createDefaultSnippets;
}
//# sourceMappingURL=SnippetService.d.ts.map