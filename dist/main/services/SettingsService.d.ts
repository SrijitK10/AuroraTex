import { TeXSettings } from './TeXDetectionService';
export declare class SettingsService {
    private inMemoryDB;
    private texDetection;
    constructor();
    initialize(): Promise<void>;
    getLastOpenedProject(): Promise<string | null>;
    setLastOpenedProject(projectId: string): Promise<{
        ok: boolean;
    }>;
    getRecentProjects(): Promise<Array<{
        id: string;
        name: string;
        lastOpened: number;
    }>>;
    addToRecentProjects(projectId: string, projectName: string): Promise<{
        ok: boolean;
    }>;
    getIncrementalBuildSettings(): Promise<{
        enabled: boolean;
        preserveTempDir: boolean;
        cleanBuildThreshold: number;
    }>;
    updateIncrementalBuildSettings(settings: {
        enabled: boolean;
        preserveTempDir: boolean;
        cleanBuildThreshold: number;
    }): Promise<{
        ok: boolean;
    }>;
    getEditorState(projectId: string): Promise<{
        openTabs?: Array<{
            path: string;
            isActive: boolean;
        }>;
        scrollPositions?: Record<string, {
            line: number;
            column: number;
        }>;
        foldedRegions?: Record<string, Array<{
            from: number;
            to: number;
        }>>;
    } | null>;
    saveEditorState(projectId: string, state: {
        openTabs?: Array<{
            path: string;
            isActive: boolean;
        }>;
        scrollPositions?: Record<string, {
            line: number;
            column: number;
        }>;
        foldedRegions?: Record<string, Array<{
            from: number;
            to: number;
        }>>;
    }): Promise<{
        ok: boolean;
    }>;
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<{
        ok: boolean;
    }>;
    private detectAndStoreTeXDistribution;
    getTexSettings(): Promise<TeXSettings>;
    updateTexSettings(settings: TeXSettings): Promise<{
        ok: boolean;
    }>;
    redetectTeX(): Promise<TeXSettings>;
    setActiveDistribution(distributionName: string): Promise<{
        ok: boolean;
    }>;
    addCustomDistribution(name: string, paths: Record<string, string>): Promise<{
        ok: boolean;
    }>;
    updateBinaryPath(binary: string, path: string): Promise<{
        ok: boolean;
        valid: boolean;
    }>;
    checkTexInstallation(): Promise<{
        found: boolean;
        paths: Record<string, string>;
    }>;
    getTexBinaryPath(binary: string): Promise<string | null>;
}
//# sourceMappingURL=SettingsService.d.ts.map