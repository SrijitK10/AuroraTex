awesome — here’s an **extensive, end-to-end workflow** for building a fully offline Overleaf-style desktop app. It’s organized into **milestones** that snap together cleanly, with **frontend vs backend responsibilities**, **IPC/API contracts**, **data models**, **state machines**, and **acceptance tests** so you can implement and integrate without thrash.

I’ll assume:

* **Desktop shell:** Electron (Node + Chromium). (Tauri is fine too; swap IPC/packaging notes if you choose it.)
* **Frontend:** React + Vite + Tailwind + CodeMirror 6 + pdf.js.
* **Backend (local):** Electron main process + Node services (no external server), SQLite for metadata, filesystem for projects.
* **LaTeX:** TinyTeX or TeX Live bundled (for true offline) + `latexmk` driver.

---

# Architecture at a glance

```
+----------------- Desktop App (Electron) -----------------+
|  Renderer (React)         |  Main Process (Node)         |
|---------------------------+------------------------------|
|  UI Shell (Topbar,        |  IPC Router (secure)         |
|  Sidebar, Editor, PDF)    |  FileService                 |
|  CodeMirror 6             |  ProjectService (SQLite)     |
|  pdf.js                   |  CompileOrchestrator         |
|  Log Console              |  WorkerPool (child procs)    |
|                           |  SettingsService             |
+---------------------------+------------------------------+
            | IPC (invoke/handle, channels & events)
            v
      +-------------+
      | OS & FS     |  (filesystem, processes, env)
      +-------------+
```

**Data placement**

* `/Workspace/<Project>/` → project files (tex/bib/img) + `/output/*` + `project.json` + `/.history/*`
* `~/.myoverleaf/db.sqlite` → projects metadata, snapshots index, preferences.

---

# Milestone 0 — Project scaffolding & foundations

### Goals

* Create the skeleton app, enforce strict type boundaries, and lock down IPC early.

### Frontend

* Vite + React + Tailwind.
* Base layout: **Topbar** (project name, Build), **Sidebar** (file tree), **Main** (tabs + editor), **Right** (PDF viewer), **Bottom** (build log panel).
* Add a typed IPC client wrapper (e.g., `ipcClient.invoke<'Project.Open', {path}, ProjectDTO>()`).

### Backend

* Electron main with **Context Isolation**, **`nodeIntegration: false`**, preload script exposing a **typed `window.api`** (IPC).
* Create services:

  * **FileService** (read/write/rename/delete, zip import/export).
  * **ProjectService** (SQLite via `better-sqlite3`): tables `projects`, `snapshots`, `preferences`.
  * **SettingsService** (paths, binaries, timeouts).
* Define **IPC channels** (namespaced):
  `Project.Open`, `Project.Create`, `Project.List`, `FS.ReadFile`, `FS.WriteFile`, `Compile.Run`, `Compile.Status`, `Settings.Get/Set`.

### Contracts (examples)

```ts
// request
channel: "Project.Create"
payload: { name: string; path?: string; templateId?: string }
// response
ProjectDTO: { id: string; name: string; root: string; mainFile: string; createdAt: string }
```

### Acceptance

* App opens, creates a project folder with `project.json`, persists metadata to SQLite, lists projects.

---

# Milestone 1 — Project model & filesystem semantics

### Frontend

* **File tree**: recursive listing, context menu (New File/Folder, Rename, Delete), drag-move within project.
* **Tabs**: open, close, dirty indicator.

### Backend

* `ProjectService`:

  * `create(root, mainFile="main.tex")` → write default files, insert row.
  * `listFiles(projectId)` → returns normalized tree (type, size, mtime).
* `FileService`:

  * Safe writes with atomic temp files (`.tmp` then rename).
  * Guard rails: no access outside project root.

### IPC

* `FS.ListTree {projectId} -> FileNode[]`
* `FS.ReadFile {projectId, relPath} -> string|Uint8Array`
* `FS.WriteFile {projectId, relPath, content} -> {ok:true, mtime}`

### Acceptance

* Can create/open project, edit multiple files, and see changes reflected on disk.

---

# Milestone 2 — Editor (CodeMirror 6) & basic UX

### Frontend

* CodeMirror 6 with **LaTeX language package**, **search/replace**, **folding**, **vim/emacs keymaps** (optional), **snippets**.
* **Autosave**: debounce per tab (e.g., 750ms idle), show “Saved” tick.
* **Dirty guard**: prevent app close with unsaved buffers.

### Backend

* Nothing new (re-use FS APIs). Add **file change watcher** (`chokidar`) to reflect external changes.

### Acceptance

* Smooth editing experience, autosaves without stutter, external edits show up with a “file changed” prompt.

---

# Milestone 3 — PDF preview (pdf.js) & basic compile button

### Frontend

* Right pane renders `/output/main.pdf` via pdf.js (single-document viewer).
* **Refresh** button. For now, manual.

### Backend

* Provide a `GET-PATH` IPC that resolves a **sandboxed file URL** or streams the PDF through a safe URL handler (Electron `protocol` API).
* Ensure `output/` is created on project open.

### IPC

* `Project.OutputPath {projectId, file="main.pdf"} -> file://…` (custom protocol).

### Acceptance

* After a mock compile (copy a test PDF), preview shows it; zoom and page nav work.

---

# Milestone 4 — Compile pipeline (single job)

### Backend

* **CompileOrchestrator**:

  * Snapshot (optional) or lock a **read-only view** of project files (copy to temp build dir).
  * **Spawn** `latexmk` (configurable engine: `-pdf`, `-xelatex`, or `-lualatex`).
  * Capture **stdout/stderr** line-by-line to a **rolling log**.
  * Signal progress events over IPC (`Compile.Progress`).
  * On success, move `main.pdf` to `project/output/main.pdf`; on error, keep `compile.log` there.

* **Env**:

  * Default **no `-shell-escape`**.
  * Set `TEXMFVAR` & `TEXINPUTS` to project’s temp build dir and bundled tex tree.

* **Timeouts**:

  * Hard timeout (e.g., 180s default). Kill process tree on exceed.

### Frontend

* **Build button** triggers `Compile.Run {projectId, engine, mainFile}` and opens the **Log Panel** (append live lines).
* On success: auto-refresh PDF viewer.

### IPC

* `Compile.Run -> {jobId}`
* `Compile.Events jobId`: `state` (`queued|running|success|error|killed`), `line`, `percent?`.
* `Compile.Status {jobId} -> CompileStatusDTO`
* `Compile.Cancel {jobId}`

### Acceptance

* Large project compiles; live logs visible; PDF updates; errors shown in log.

---

# Milestone 5 — Job queue & state machine (robust builds)

### Backend

* Implement a **Queue** with concurrency=1 (or N) and **states**:

```
IDLE → QUEUED → RUNNING → (SUCCESS | ERROR | KILLED)
             ↘ (CANCELLED)
```

* Debounce **auto-compile**: whenever a LaTeX file saves, enqueue a build if last build finished > N sec ago; otherwise **coalesce** changes.

* **Artifacts policy**: write all build artifacts to temp dir; only copy `main.pdf` + `compile.log` back.

* **Log storage**: circular buffer in memory + write full log file at end.

### Frontend

* Show **queue indicator** in Topbar (Idle/Queued/Building).
* Allow **toggle**: Manual vs Auto compile (Topbar switch).

### Acceptance

* Rapid changes don’t thrash compiles; cancellation works; UI state always correct.

---

# Milestone 6 — Error parsing & source mapping

### Backend

* **Log parser** module:

  * Extract `(file, line, message)` from LaTeX logs. Typical patterns:

    * `l.<line> ...` after a `(<file>)` block
    * `! LaTeX Error: ...`
    * `Package <name> Error: ...`
  * Maintain a **current file stack** from log parentheses `(<file>)`.
  * Output `ErrorDTO[]` sorted by severity.

* **Source map**:

  * Map temp build paths back to project relative paths.

### Frontend

* **Errors panel** (table): message, file, line; click → opens file and **go-to-line**.
* Inline **gutter markers** in CodeMirror for errors/warnings.

### IPC

* `Compile.Errors {jobId} -> ErrorDTO[]`
* Optionally include **quick-fix** hints for common errors (missing package).

### Acceptance

* Clicking an error jumps to correct file/line; markers clear after next clean build.

---

# Milestone 7 — Local history & snapshots

### Backend

* `SnapshotService`:

  * `create(projectId, message?)` → tar/gzip of project (excluding `output/` by default) to `/.history/<ts>.tar.gz`.
  * Index in SQLite: `snapshots(id, project_id, ts, message, size_bytes, path)`.
* Provide `restore(snapshotId)` to overwrite project files (with confirmation).

### Frontend

* **History panel**: list snapshots, preview date/size/message, restore with confirm.
* Optional: store **PDF thumbnail** per snapshot (render first page once).

### IPC

* `Snapshot.Create/List/Restore`
* `Snapshot.Thumb {snapshotId} -> file URL`

### Acceptance

* Manual snapshot before risky edits; restore works and triggers recompile.

---

# Milestone 8 — Templates, snippets, BibTeX tooling

### Backend

* **TemplateService**:

  * Stored under `~/.myoverleaf/templates` as folders with `template.json`.
  * `Template.List`, `Template.Apply {projectId, templateId}` (copy files).

### Frontend

* **New Project modal** with searchable templates.
* **Snippets palette** (e.g., `\begin{figure}` scaffold).
* **Bib manager**: simple BibTeX editor (grid view of entries) that writes `.bib`.

### Acceptance

* Create project from a template; snippet inserts structured text; bib edited without corrupting file.

---

# Milestone 9 — Settings & TeX distribution detection/bundling

### Backend

* **Detect** TeX binaries on first run:

  * Look for **bundled** binaries `resources/texlive/bin/*`.
  * Else search PATH for `latexmk`, `pdflatex`, `xelatex`, `biber`.
  * Validate versions; store absolute paths in SQLite `preferences`.
* **Installer mode**:

  * If you ship **bundled TinyTeX/TeX Live**, set `TEXMFHOME` and point tools accordingly.
* **Limits**: preferences for **timeout**, **max log size**, **shell-escape** toggle (default OFF).

### Frontend

* **Settings dialog**:

  * Paths (read-only if bundled), engine default, auto-compile debounce ms, security toggles.

### Acceptance

* App runs fully offline on a clean machine (no prior TeX) when bundled; otherwise gracefully asks user to point to binaries.

---

# Milestone 10 — Security & sandboxing (very important)

### Backend

* **Default flags**: **no shell-escape**; if enabled, show **red warning** and require per-project opt-in.
* **Working dir:** always compile in a **temp dir** under app control.
* **Kill switch:** hard kill on timeout and expose reason in status.
* **Resource limits** (best effort cross-platform):

  * Lower process priority (`nice`) on \*nix; on macOS/Windows emulate via timeouts.
  * Optional: **Docker sandbox** (if user has Docker), route compiles through container runtime with a local TeX image.
* **Sanitize env**: pass a minimal env to child process (no secrets).

### Frontend

* Show clear **security banner** if shell-escape is ON for a project.

### Acceptance

* Malicious `.tex` with shell escapes does not run unless explicitly allowed; timeouts reliably stop runaway compiles.

---

# Milestone 11 — Optional local collaboration (offline)

*(Skip if single-user is enough.)*

### Strategy (CRDT, offline-first)

* Use **Yjs** to model document state.
* **Storage**: persist Yjs docs to `IndexedDB` (renderer) + periodic flush to real files via FS writes.
* **Same device, multi-window**: a lightweight **BroadcastChannel** or Electron **IPC** provider shares updates.
* **LAN** (still offline from internet): run a tiny **y-websocket** server embedded in main process; discover peers with mDNS; **no external services**.

### Frontend

* Remote cursor decorations, color per peer, presence list.

### Backend

* A background **SyncService** that loads/saves Yjs docs to disk at safe points (blur/interval/snapshot).

### Acceptance

* Two windows editing same file converge without conflicts; killing one window does not lose changes.

---

# Milestone 12 — Git (local) & import/export

### Backend

* Use `isomorphic-git` (pure JS) or shell to system `git`.
* Commands: `init`, `status`, `add all`, `commit`, (optional) `remote add` and `push` if user sets a local bare repo.
* **Export ZIP**: stream project (excluding `.history` optionally) to a zip.

### Frontend

* Simple **Git panel** with staged/unstaged lists, commit message, branch switcher.

### Acceptance

* Create commits locally; export/import projects; no internet needed.

---

# Milestone 13 — Performance & UX polish

### Frontend

* Virtualized file tree for big projects.
* **PDF incremental refresh**: if only aux refs changed, avoid full reload when possible; at minimum, keep scroll position and page.
* Keyboard shortcuts: Build (`Cmd/Ctrl+B`), Toggle Auto-compile, Quick file search.

### Backend

* **Cold-start cache**: remember last opened project and re-open quickly.
* **Incremental builds**: Optionally reuse build dir between compiles for speed, with a **clean build** button.

### Acceptance

* Large docs feel snappy; repeated compiles faster than first compile.

---

# Milestone 14 — Packaging & installers (offline-ready)

### Backend/DevOps

* **electron-builder** targets: macOS (dmg/pkg), Windows (nsis/msi), Linux (AppImage/deb/rpm).
* If bundling TeX:

  * Place under `resources/texlive/…`, ensure **codesign** on macOS as needed.
  * Verify **gatekeeper**/notarization steps.
* Post-install first run: **self-check** for binaries and write defaults.

### Acceptance

* Fresh machine, no internet: install app, open sample template, build to PDF successfully.

---

# Milestone 15 — QA: automated tests & resilience

### Tests

* **Unit**: services (FileService, ProjectService, LogParser).
* **Integration**: compile simple & complex projects (with bibliography, images).
* **E2E**: Playwright—open project, type text, auto-compile, PDF updates, error click-through.
* **Chaos**: kill compile mid-run; simulate low disk (mock FS errors); missing binaries; corrupted `.aux`.

### Tooling

* Test projects in `/tests/projects/*`.
* Golden PDFs for byte/size sanity (do not diff PDFs pixel-by-pixel unless you rasterize first).

### Acceptance

* CI (local) runs all tests; flaky tests eliminated; failures yield actionable logs.

---

## Data models (SQLite)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root TEXT NOT NULL UNIQUE,
  main_file TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  message TEXT,
  path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**`project.json`** (at project root):

```json
{
  "id": "uuid",
  "name": "My Project",
  "mainFile": "main.tex",
  "settings": {
    "engine": "pdflatex",
    "shellEscape": false,
    "bibTool": "bibtex",
    "timeoutMs": 180000
  },
  "createdAt": "2025-08-17T16:00:00.000Z",
  "updatedAt": "2025-08-17T16:00:00.000Z"
}
```

---

## Core state machines

### Compile job

```
NEW → QUEUED → RUNNING → (SUCCESS | ERROR | KILLED | CANCELLED)
                      ↘ on-timeout → KILLED
```

### Auto-compile debounce

```
onFileSave → set timer (N ms)
   if another save → reset timer
timer fires → enqueue compile (if not RUNNING) else mark "needsBuild"
on RUNNING→SUCCESS/ERROR:
   if "needsBuild" true and lastChange > (M ms) → enqueue again
```

---

## IPC surface (summary)

**Project**

* `Project.Create {name, path?, templateId?} -> ProjectDTO`
* `Project.Open {path} -> ProjectDTO`
* `Project.List {} -> ProjectDTO[]`
* `Project.SetMain {projectId, relPath} -> {ok:true}`

**FS**

* `FS.ListTree {projectId} -> FileNode[]`
* `FS.ReadFile {projectId, relPath} -> string|Uint8Array`
* `FS.WriteFile {projectId, relPath, content} -> {ok:true}`
* `FS.Rename/Delete/Create` variants

**Compile**

* `Compile.Run {projectId, engine?, mainFile?} -> {jobId}`
* `Compile.Events (event channel per jobId)`
* `Compile.Status {jobId} -> CompileStatusDTO`
* `Compile.Errors {jobId} -> ErrorDTO[]`
* `Compile.Cancel {jobId} -> {ok:true}`

**Snapshots**

* `Snapshot.Create/List/Restore`

**Settings**

* `Settings.Get/Set`
* `Settings.CheckTeX -> {found: boolean, paths: {...}}`

---

## Security defaults

* Shell-escape **OFF** by default; explicit per-project override with warning.
* Compile in **temp dir**; copy back only whitelisted artifacts.
* **Timeout** + **kill** entire process tree.
* **Minimized env** for child process.
* Read/write **only inside project root**.

---

## Implementation hints (pseudocode snippets)

**Spawn build**

```ts
const child = spawn(latexmkPath, [
  '-pdf', '-interaction=nonstopmode',
  '-halt-on-error', mainFile
], { cwd: buildDir, env: minimalEnv });

child.stdout.on('data', onLine);
child.stderr.on('data', onLine);
const timer = setTimeout(() => killTree(child.pid), timeoutMs);
child.on('exit', (code) => {
  clearTimeout(timer);
  if (code === 0) finalizeSuccess();
  else finalizeError();
});
```

**Log parsing (very simplified)**

```ts
// Track current file using a stack on "(" and ")" lines,
// match "! LaTeX Error:" and "l.<num>" patterns,
// normalize temp paths back to project rel paths.
```

---

## Final build checklist

* [ ] Electron app signed/notarized (macOS), code-signed (Win).
* [ ] Bundled TeX in `resources/texlive` (or robust detection UI).
* [ ] First-run self-check passes offline.
* [ ] Sample templates included.
* [ ] Docs: security notes, troubleshooting (timeouts, missing packages), keyboard shortcuts.

---

## Optional upgrades

* Multi-pane PDF sync (jump to PDF location from source; use `.synctex.gz`).
* Multi-engine matrix (pdflatex/xelatex/lualatex) with per-project overrides.
* Cloudless LAN collaboration (Yjs + y-websocket).
* Plugin system (user scripts) executed in a sandboxed worker.

---

If you want, I can turn this into a **starter repo outline** (folders + stubbed code for IPC, services, and a minimal compile) that you can drop onto your machine and run.
