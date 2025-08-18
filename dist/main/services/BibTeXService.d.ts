import { BibEntryDTO } from '../types';
export declare class BibTeXService {
    private writeTimeouts;
    parseBibFile(projectRoot: string, fileName: string): Promise<BibEntryDTO[]>;
    writeBibFile(projectRoot: string, fileName: string, entries: BibEntryDTO[]): Promise<{
        ok: boolean;
    }>;
    private parseBibContent;
    private generateBibContent;
    private shouldQuoteField;
    createNewEntry(type: string): BibEntryDTO;
    getEntryTypes(): Array<{
        type: string;
        description: string;
        fields: string[];
    }>;
}
//# sourceMappingURL=BibTeXService.d.ts.map