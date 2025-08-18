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
declare class InMemoryDB {
    private projects;
    private snapshots;
    private preferences;
    insertProject(project: ProjectData): void;
    getProject(id: string): ProjectData | undefined;
    getProjectByRoot(root: string): ProjectData | undefined;
    getAllProjects(): ProjectData[];
    updateProject(id: string, updates: Partial<ProjectData>): boolean;
    insertSnapshot(snapshot: SnapshotData): void;
    getSnapshot(id: string): SnapshotData | undefined;
    getSnapshotsByProject(projectId: string): SnapshotData[];
    deleteSnapshot(id: string): boolean;
    setPreference(key: string, value: string): void;
    getPreference(key: string): string | undefined;
    initializeDefaults(): void;
}
export declare const inMemoryDB: InMemoryDB;
export {};
//# sourceMappingURL=InMemoryDB.d.ts.map