import React, { useState, useEffect, useRef } from 'react';
import { ProjectExplorer } from './components/ProjectExplorer';
import { FileTree } from './components/FileTree';
import { VirtualizedFileTree } from './components/VirtualizedFileTree';
import { QuickFileSearch } from './components/QuickFileSearch';
import { Editor, EditorRef } from './components/Editor';
import { PDFViewer } from './components/PDFViewer';
import { LogPanel } from './components/LogPanel';
import { ErrorsPanel } from './components/ErrorsPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SnippetsPalette } from './components/SnippetsPalette';
import { BibManager } from './components/BibManager';
import { Topbar } from './components/Topbar';
import { ResizableSplitter } from './components/ResizableSplitter';
import { CollapsibleSidebar } from './components/CollapsibleSidebar';
import SettingsModal from './components/SettingsModal';

export interface Project {
  id: string;
  name: string;
  root: string;
  mainFile: string;
  createdAt: string;
  updatedAt: string;
  settings?: {
    engine?: 'pdflatex' | 'xelatex' | 'lualatex';
    shellEscape?: boolean;
    bibTool?: 'bibtex' | 'biber';
    timeoutMs?: number;
  };
}

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  mtime?: string;
  children?: FileNode[];
}

export interface Tab {
  id: string;
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
}

function App() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [pdfRefreshTrigger, setPdfRefreshTrigger] = useState(0); // Add trigger for PDF refresh
  const [compilationStatus, setCompilationStatus] = useState<'idle' | 'compiling' | 'success' | 'error'>('idle');
  const [showSidebar, setShowSidebar] = useState(true); // Add sidebar toggle state

  // Milestone 5: Queue and auto-compile state
  const [queueState, setQueueState] = useState<{
    pending: number;
    running: number;
    maxConcurrency: number;
  } | undefined>(undefined);
  const [isAutoCompileEnabled, setIsAutoCompileEnabled] = useState(false);
  const [autoCompileDelay, setAutoCompileDelay] = useState(750); // Default 750ms
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Milestone 6: Error parsing and source mapping state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Array<{
    file: string;
    line: number;
    column?: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>>([]);
  const [errorMarkersForFile, setErrorMarkersForFile] = useState<Record<string, Array<{
    line: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
  }>>>({});
  const [showErrorsPanel, setShowErrorsPanel] = useState(false);

  // Milestone 7: History panel state
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [isRestoringSnapshot, setIsRestoringSnapshot] = useState(false);

  // Auto-snapshot configuration
  const [autoSnapshotSettings, setAutoSnapshotSettings] = useState({
    onAppClose: true,
    onProjectSwitch: true,
    periodic: true,
    periodicIntervalMinutes: 30,
  });

  // Auto-snapshot state
  const [lastSnapshotTime, setLastSnapshotTime] = useState<number | null>(null);
  const [periodicSnapshotTimer, setPeriodicSnapshotTimer] = useState<NodeJS.Timeout | null>(null);

  // Milestone 8: Templates, snippets, and bibliography state
  const [showSnippetsPalette, setShowSnippetsPalette] = useState(false);
  const [showBibManager, setShowBibManager] = useState(false);
  const [selectedBibFile, setSelectedBibFile] = useState<string>('references.bib');
  const [managedFiles, setManagedFiles] = useState<Set<string>>(new Set()); // Files being managed by editors

  // Milestone 13: Performance & UX Polish state
  const [showQuickFileSearch, setShowQuickFileSearch] = useState(false);
  const [useVirtualizedFileTree, setUseVirtualizedFileTree] = useState(false);
  const [isIncrementalBuildEnabled, setIsIncrementalBuildEnabled] = useState(true);

  // Editor ref for direct access to editor functions
  const editorRef = useRef<EditorRef>(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Milestone 13: Build shortcut - Cmd+B (Mac) or Ctrl+B (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault();
        if (currentProject) {
          compileProject();
        }
      }
      
      // Milestone 13: Toggle Auto-compile - Cmd+Shift+B or Ctrl+Shift+B
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'B') {
        event.preventDefault();
        handleToggleAutoCompile(!isAutoCompileEnabled);
      }
      
      // Milestone 13: Quick file search - Cmd+P (Mac) or Ctrl+P (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'p') {
        event.preventDefault();
        if (currentProject) {
          setShowQuickFileSearch(true);
        }
      }
      
      // Milestone 13: Toggle sidebar - Cmd+\ or Ctrl+\
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        setShowSidebar(prev => !prev);
      }
      
      // Ctrl+Shift+P to open snippets palette (like VS Code command palette)
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        event.preventDefault();
        setShowSnippetsPalette(true);
      }
      
      // Ctrl+. (or Cmd+. on Mac) to open snippets palette (quick actions)
      if ((event.ctrlKey || event.metaKey) && event.key === '.') {
        event.preventDefault();
        setShowSnippetsPalette(true);
      }
      
      // Escape key to go back to projects (only if no modal is open and no panels are open)
      if (event.key === 'Escape' && 
          !(event.target as Element)?.closest?.('.modal') &&
          !showLogPanel && 
          !showErrorsPanel && 
          !showHistoryPanel &&
          !showSnippetsPalette &&
          !showQuickFileSearch) {
        event.preventDefault();
        handleEscapeBackToProjects();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentProject, isAutoCompileEnabled, showLogPanel, showErrorsPanel, showHistoryPanel, showSnippetsPalette, showQuickFileSearch]);

  // Load file tree when project changes
  useEffect(() => {
    if (currentProject) {
      loadFileTree();
      startFileWatching();
      startPeriodicSnapshots();
    }
    
    return () => {
      if (currentProject) {
        stopFileWatching();
        stopPeriodicSnapshots();
      }
    };
  }, [currentProject]);

  // Manage periodic snapshots
  useEffect(() => {
    if (currentProject && autoSnapshotSettings.periodic) {
      startPeriodicSnapshots();
    } else {
      stopPeriodicSnapshots();
    }
    
    return () => stopPeriodicSnapshots();
  }, [currentProject, autoSnapshotSettings.periodic, autoSnapshotSettings.periodicIntervalMinutes]);

  // Set up file change listener
  useEffect(() => {
    const handleFileChange = (event: any, data: any) => {
      if (data.projectId === currentProject?.id) {
        console.log('File changed:', data);
        
        // Refresh file tree on any changes
        loadFileTree();
        
        // Handle file changes for open tabs
        if (data.type === 'change' && !data.path.includes('.tmp') && !isRestoringSnapshot) {
          const affectedTab = openTabs.find(tab => tab.path === data.path);
          
          // Check if this file is currently being managed by an editor (e.g., BibManager)
          const isFileManaged = managedFiles.has(data.path);
          
          if (affectedTab && !affectedTab.isDirty && !isFileManaged) {
            // Only show reload dialog for files that aren't being managed by specialized editors
            const shouldReload = window.confirm(
              `The file "${data.path}" has been modified externally. Would you like to reload it?`
            );
            if (shouldReload) {
              reloadFile(affectedTab.id, data.path);
            }
          } else if (affectedTab && !affectedTab.isDirty && isFileManaged) {
            // Silently reload files that are being managed by specialized editors
            reloadFile(affectedTab.id, data.path);
          }

          // Milestone 5: Trigger auto-compile on file changes (only if not external and is .tex file)
          if (isAutoCompileEnabled && data.path.endsWith('.tex')) {
            console.log('Auto-compile check - path:', data.path, 'isExternal:', data.isExternal, 'enabled:', isAutoCompileEnabled);
            
            // Trigger auto-compile for any .tex file changes when enabled
            // For now, trigger on any .tex file change since we want to test the functionality
            console.log('Auto-compile triggered by file change:', data.path);
            handleAutoCompile();
          }
        }
        
        // Handle file deletions
        if (data.type === 'unlink' || data.type === 'unlinkDir') {
          handleFileDelete(data.path);
        }
      }
    };

    window.electronAPI.onFileChanged(handleFileChange);
    
    return () => {
      window.electronAPI.removeFileChangedListener(handleFileChange);
    };
  }, [currentProject?.id, openTabs, isAutoCompileEnabled, isRestoringSnapshot]);

  // Set up compile progress event cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clean up any remaining progress listeners on unmount
      const cleanup = () => {};
      window.electronAPI.removeCompileProgressListener(cleanup);
    };
  }, []);

  // Set up app close handler for auto-snapshot
  useEffect(() => {
    const handleAppClose = async () => {
      if (currentProject && autoSnapshotSettings.onAppClose) {
        const hasUnsavedChanges = openTabs.some(tab => tab.isDirty);
        const timeSinceLastSnapshot = lastSnapshotTime ? (Date.now() - lastSnapshotTime) / (1000 * 60) : Infinity;
        
        // Create snapshot if there are unsaved changes or it's been a while since last snapshot
        if (hasUnsavedChanges || timeSinceLastSnapshot >= 60) {
          try {
            await createAutoSnapshot('Auto-snapshot before app close');
            console.log('Created auto-snapshot before app close');
          } catch (error) {
            console.error('Failed to create auto-snapshot on app close:', error);
          }
        }
      }
    };

    // Listen for app close events
    window.addEventListener('beforeunload', handleAppClose);
    
    return () => {
      window.removeEventListener('beforeunload', handleAppClose);
    };
  }, [currentProject, autoSnapshotSettings.onAppClose, openTabs, lastSnapshotTime]);

  const startFileWatching = async () => {
    if (!currentProject) return;
    
    try {
      await window.electronAPI.fsStartWatching({ projectId: currentProject.id });
    } catch (error) {
      console.error('Failed to start file watching:', error);
    }
  };

  const stopFileWatching = async () => {
    if (!currentProject) return;
    
    try {
      await window.electronAPI.fsStopWatching({ projectId: currentProject.id });
    } catch (error) {
      console.error('Failed to stop file watching:', error);
    }
  };

  // Auto-snapshot management functions
  const createAutoSnapshot = async (message: string) => {
    if (!currentProject) return;

    try {
      console.log(`Creating auto-snapshot: ${message}`);
      await window.electronAPI.snapshotCreate({ 
        projectId: currentProject.id, 
        message 
      });
      setLastSnapshotTime(Date.now());
      console.log(`Auto-snapshot created successfully: ${message}`);
    } catch (error) {
      console.error('Failed to create auto-snapshot:', error);
    }
  };

  const startPeriodicSnapshots = () => {
    if (!currentProject || !autoSnapshotSettings.periodic) return;
    
    // Clear any existing timer
    stopPeriodicSnapshots();
    
    const intervalMs = autoSnapshotSettings.periodicIntervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
      const now = Date.now();
      // Only create snapshot if there has been recent activity or unsaved changes
      const hasUnsavedChanges = openTabs.some(tab => tab.isDirty);
      const timeSinceLastSnapshot = lastSnapshotTime ? (now - lastSnapshotTime) / (1000 * 60) : Infinity;
      
      if (hasUnsavedChanges || timeSinceLastSnapshot >= autoSnapshotSettings.periodicIntervalMinutes) {
        const timeStr = new Date().toLocaleTimeString();
        createAutoSnapshot(`Periodic auto-snapshot (${timeStr})`);
      }
    }, intervalMs);
    
    setPeriodicSnapshotTimer(timer);
    console.log(`Started periodic snapshots every ${autoSnapshotSettings.periodicIntervalMinutes} minutes`);
  };

  const stopPeriodicSnapshots = () => {
    if (periodicSnapshotTimer) {
      clearInterval(periodicSnapshotTimer);
      setPeriodicSnapshotTimer(null);
      console.log('Stopped periodic snapshots');
    }
  };

  const reloadFile = async (tabId: string, filePath: string) => {
    if (!currentProject) return;

    try {
      const content = await window.electronAPI.fsReadFile({
        projectId: currentProject.id,
        relPath: filePath,
      });

      setOpenTabs(prev => prev.map(tab => 
        tab.id === tabId 
          ? { ...tab, content: typeof content === 'string' ? content : '', isDirty: false }
          : tab
      ));
    } catch (error) {
      console.error('Failed to reload file:', error);
    }
  };

  const reloadAllOpenTabs = async () => {
    if (!currentProject || openTabs.length === 0) return;

    try {
      const reloadPromises = openTabs.map(async (tab) => {
        try {
          const content = await window.electronAPI.fsReadFile({
            projectId: currentProject.id,
            relPath: tab.path,
          });
          return {
            ...tab,
            content: typeof content === 'string' ? content : '',
            isDirty: false
          };
        } catch (error) {
          console.error(`Failed to reload file ${tab.path}:`, error);
          return tab; // Keep original tab if reload fails
        }
      });

      const reloadedTabs = await Promise.all(reloadPromises);
      setOpenTabs(reloadedTabs);
    } catch (error) {
      console.error('Failed to reload open tabs:', error);
    }
  };

  const loadFileTree = async () => {
    if (!currentProject) return;
    
    try {
      const tree = await window.electronAPI.fsListTree({ projectId: currentProject.id });
      setFileTree(tree);
    } catch (error) {
      console.error('Failed to load file tree:', error);
    }
  };

  const openFile = async (filePath: string) => {
    if (!currentProject) return;

    // Check if file is already open
    const existingTab = openTabs.find(tab => tab.path === filePath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    try {
      const content = await window.electronAPI.fsReadFile({
        projectId: currentProject.id,
        relPath: filePath,
      });

      const tab: Tab = {
        id: Date.now().toString(),
        path: filePath,
        name: filePath.split('/').pop() || filePath,
        content: typeof content === 'string' ? content : '',
        isDirty: false,
      };

      setOpenTabs(prev => [...prev, tab]);
      setActiveTabId(tab.id);
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const closeTab = (tabId: string) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (tab && tab.isDirty) {
      const confirmed = window.confirm(`"${tab.name}" has unsaved changes. Close anyway?`);
      if (!confirmed) return;
    }
    
    setOpenTabs(prev => prev.filter(tab => tab.id !== tabId));
    
    if (activeTabId === tabId) {
      const remainingTabs = openTabs.filter(tab => tab.id !== tabId);
      setActiveTabId(remainingTabs.length > 0 ? remainingTabs[0].id : null);
    }
  };

  const saveFile = async (tabId: string, content: string, isAutosave = false) => {
    if (!currentProject) return;

    const tab = openTabs.find(tab => tab.id === tabId);
    if (!tab) return;

    try {
      await window.electronAPI.fsWriteFile({
        projectId: currentProject.id,
        relPath: tab.path,
        content,
        isAutosave,
      });

      setOpenTabs(prev => prev.map(t => 
        t.id === tabId ? { ...t, content, isDirty: false } : t
      ));
      
      console.log(`File saved: ${tab.path} (autosave: ${isAutosave})`);
      
      // Auto-compile integration: trigger auto-compile if enabled and file is a .tex file
      if (isAutoCompileEnabled && tab.path.toLowerCase().endsWith('.tex')) {
        console.log(`Auto-compile trigger: saving ${tab.path} with auto-compile enabled`);
        try {
          await window.electronAPI.compileTriggerAutoCompile({
            projectId: currentProject.id
          });
          console.log('Auto-compile triggered successfully');
        } catch (error) {
          console.error('Failed to trigger auto-compile:', error);
          // Don't show an alert for auto-compile failures to avoid disrupting user workflow
        }
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      alert('Failed to save file: ' + (error as Error).message);
    }
  };

  const updateTabContent = (tabId: string, content: string) => {
    setOpenTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, content, isDirty: true } : tab
    ));
  };

  const handleFileCreate = (filePath: string) => {
    console.log(`File created: ${filePath}`);
    // Automatically open the new file if it's a text file
    const extension = filePath.split('.').pop()?.toLowerCase();
    const textExtensions = ['tex', 'txt', 'md', 'bib', 'cls', 'sty', 'json'];
    if (textExtensions.includes(extension || '')) {
      setTimeout(() => openFile(filePath), 100);
    }
  };

  const handleFileDelete = (filePath: string) => {
    console.log(`File deleted: ${filePath}`);
    // Close any open tabs for the deleted file or folder
    setOpenTabs(prev => prev.filter(tab => 
      !tab.path.startsWith(filePath) && tab.path !== filePath
    ));
    
    // Update active tab if needed
    const remainingTabs = openTabs.filter(tab => 
      !tab.path.startsWith(filePath) && tab.path !== filePath
    );
    if (activeTabId && !remainingTabs.find(tab => tab.id === activeTabId)) {
      setActiveTabId(remainingTabs.length > 0 ? remainingTabs[0].id : null);
    }
  };

  const handleFileRename = (oldPath: string, newPath: string) => {
    console.log(`File renamed: ${oldPath} -> ${newPath}`);
    // Update any open tabs
    setOpenTabs(prev => prev.map(tab => {
      if (tab.path === oldPath) {
        return {
          ...tab,
          path: newPath,
          name: newPath.split('/').pop() || newPath,
        };
      } else if (tab.path.startsWith(oldPath + '/')) {
        const newTabPath = newPath + tab.path.substring(oldPath.length);
        return {
          ...tab,
          path: newTabPath,
          name: newTabPath.split('/').pop() || newTabPath,
        };
      }
      return tab;
    }));
  };

  // Milestone 6: Fetch and process compilation errors
  const fetchAndProcessErrors = async (jobId: string) => {
    if (!jobId) return;
    
    try {
      const fetchedErrors = await window.electronAPI.compileErrors({ jobId });
      console.log('Fetched errors:', fetchedErrors);
      
      setErrors(fetchedErrors);
      setCurrentJobId(jobId);
      
      // Group errors by file for editor gutter markers
      const markersByFile: Record<string, Array<{
        line: number;
        severity: 'error' | 'warning' | 'info';
        message: string;
      }>> = {};
      
      fetchedErrors.forEach(error => {
        if (!markersByFile[error.file]) {
          markersByFile[error.file] = [];
        }
        markersByFile[error.file].push({
          line: error.line,
          severity: error.severity,
          message: error.message
        });
      });
      
      setErrorMarkersForFile(markersByFile);
      
      // Show errors panel if there are errors or warnings
      if (fetchedErrors.length > 0) {
        setShowErrorsPanel(true);
      }
    } catch (error) {
      console.error('Failed to fetch compilation errors:', error);
    }
  };

  // Milestone 6: Handle clicking on an error to go to the file and line
  const handleErrorClick = async (filePath: string, line: number) => {
    if (!currentProject) return;
    
    try {
      // Check if the file is already open in a tab
      const existingTab = openTabs.find(tab => tab.path === filePath);
      
      if (existingTab) {
        // File is already open, just switch to it
        setActiveTabId(existingTab.id);
        
        // Wait a bit for the tab to become active, then goto line
        setTimeout(() => {
          editorRef.current?.gotoLine(line);
        }, 100);
      } else {
        // Need to open the file first
        const content = await window.electronAPI.fsReadFile({
          projectId: currentProject.id,
          relPath: filePath
        });
        
        const fileName = filePath.split('/').pop() || filePath;
        const newTab: Tab = {
          id: Date.now().toString(),
          path: filePath,
          name: fileName,
          content: typeof content === 'string' ? content : '',
          isDirty: false
        };
        
        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        
        // Wait for the tab to be created and rendered, then goto line
        setTimeout(() => {
          editorRef.current?.gotoLine(line);
        }, 200);
      }
      
    } catch (error) {
      console.error('Failed to open file for error:', error);
    }
  };

  const compileProject = async (forceClean = false) => {
    if (!currentProject || isCompiling) return;

    setIsCompiling(true);
    setCompilationStatus('compiling');
    setShowLogPanel(true); // Milestone 4: Open Log Panel
    setLogs([]);
    // Milestone 6: Clear previous errors
    setErrors([]);
    setErrorMarkersForFile({});
    setShowErrorsPanel(false);

    try {
      const result = await window.electronAPI.compileRun({
        projectId: currentProject.id,
        forceClean, // Milestone 13: Support clean builds
      });

      // Milestone 4: Listen for live progress events
      const handleProgress = (event: any, data: any) => {
        if (data.jobId === result.jobId) {
          // Milestone 4: Append live lines to log
          if (data.line) {
            setLogs(prev => [...prev, data.line]);
          }
          
          // Update state based on progress
          if (data.state === 'success') {
            setIsCompiling(false);
            setCompilationStatus('success');
            // Milestone 4: Auto-refresh PDF viewer on success
            console.log('Compilation successful - refreshing PDF');
            setPdfRefreshTrigger(prev => prev + 1);
            // Milestone 6: Fetch and process errors (might have warnings even on success)
            fetchAndProcessErrors(data.jobId || result.jobId);
            window.electronAPI.removeCompileProgressListener(handleProgress);
          } else if (data.state === 'error' || data.state === 'killed') {
            setIsCompiling(false);
            setCompilationStatus('error');
            // Milestone 6: Fetch and process errors
            fetchAndProcessErrors(data.jobId || result.jobId);
            window.electronAPI.removeCompileProgressListener(handleProgress);
          }
          
          // Update progress message if available
          if (data.message) {
            console.log(`Compile progress: ${data.message}`);
          }
        }
      };

      // Set up live progress listener
      window.electronAPI.onCompileProgress(handleProgress);

      // Fallback: Also poll for status updates in case events are missed
      const pollStatus = async () => {
        try {
          const status = await window.electronAPI.compileStatus({ jobId: result.jobId });
          
          if (status.state === 'running') {
            setTimeout(pollStatus, 2000); // Less frequent polling since we have live events
          } else {
            // Handle final state if not caught by events
            setIsCompiling(false);
            if (status.state === 'success') {
              setCompilationStatus('success');
              setPdfRefreshTrigger(prev => prev + 1);
            } else {
              setCompilationStatus('error');
            }
            // Milestone 6: Always fetch errors when compilation finishes
            fetchAndProcessErrors(result.jobId);
            window.electronAPI.removeCompileProgressListener(handleProgress);
          }
        } catch (error) {
          console.error('Failed to get compile status:', error);
          setIsCompiling(false);
          setCompilationStatus('error');
          window.electronAPI.removeCompileProgressListener(handleProgress);
        }
      };

      // Start polling as fallback
      setTimeout(pollStatus, 2000);
      
    } catch (error) {
      console.error('Failed to start compilation:', error);
      setIsCompiling(false);
      setCompilationStatus('error');
    }
  };

  // Milestone 13: Clean build function
  const handleCleanBuild = async () => {
    if (!currentProject) return;
    
    const confirmed = window.confirm(
      'This will delete all intermediate build files and start a clean compilation. Continue?'
    );
    
    if (confirmed) {
      try {
        // Clean the build directory first
        await window.electronAPI.compileCleanBuildDir({ projectId: currentProject.id });
        console.log('Build directory cleaned for clean build');
        
        // Start clean compilation
        await compileProject(true);
      } catch (error) {
        console.error('Failed to clean build directory:', error);
        alert('Failed to clean build directory: ' + (error as Error).message);
      }
    }
  };

  // Milestone 13: Detect when to use virtualized file tree based on project size
  useEffect(() => {
    if (fileTree.length > 100) {
      setUseVirtualizedFileTree(true);
      console.log('Large project detected - using virtualized file tree');
    } else {
      setUseVirtualizedFileTree(false);
    }
  }, [fileTree]);

  // Milestone 5: Auto-compile and toggle functions
  const handleAutoCompile = async () => {
    if (!currentProject || !isAutoCompileEnabled || isCompiling) {
      console.log('Auto-compile skipped:', { 
        hasProject: !!currentProject, 
        enabled: isAutoCompileEnabled, 
        isCompiling 
      });
      return;
    }

    console.log('Auto-compile triggered for project:', currentProject.id);
    
    try {
      // Use the regular compile function but mark it as auto-compile
      setIsCompiling(true);
      setCompilationStatus('compiling');
      // Note: Don't automatically open log panel for auto-compiles to be less disruptive
      
      const result = await window.electronAPI.compileRun({
        projectId: currentProject.id,
        isAutoCompile: true as any, // Auto-compile flag
      } as any);

      console.log('Auto-compile job started:', result.jobId);

      // Listen for progress (same as manual compile)
      const handleProgress = (event: any, data: any) => {
        if (data.jobId === result.jobId) {
          if (data.line) {
            setLogs(prev => [...prev, data.line]);
          }
          
          if (data.state === 'success') {
            setIsCompiling(false);
            setCompilationStatus('success');
            console.log('✅ Auto-compilation successful - refreshing PDF');
            setPdfRefreshTrigger(prev => prev + 1);
            // Milestone 6: Fetch and process errors for auto-compile too
            fetchAndProcessErrors(data.jobId || result.jobId);
            window.electronAPI.removeCompileProgressListener(handleProgress);
          } else if (data.state === 'error' || data.state === 'killed') {
            setIsCompiling(false);
            setCompilationStatus('error');
            console.log('❌ Auto-compilation failed');
            // Milestone 6: Fetch and process errors for auto-compile
            fetchAndProcessErrors(data.jobId || result.jobId);
            window.electronAPI.removeCompileProgressListener(handleProgress);
          }
        }
      };

      window.electronAPI.onCompileProgress(handleProgress);
      
    } catch (error) {
      console.error('Failed to trigger auto-compile:', error);
      setIsCompiling(false);
      setCompilationStatus('error');
    }
  };

  const handleToggleAutoCompile = (enabled: boolean) => {
    setIsAutoCompileEnabled(enabled);
    console.log('Auto-compile mode:', enabled ? 'enabled' : 'disabled');
    
    // If enabling auto-compile, trigger an immediate compilation to test
    if (enabled && currentProject) {
      console.log('Auto-compile enabled - triggering immediate test compilation');
      setTimeout(() => {
        handleAutoCompile();
      }, 100); // Small delay to ensure state is updated
    }
  };

  const handleAutoCompileDelayChange = async (delayMs: number) => {
    setAutoCompileDelay(delayMs);
    try {
      await window.electronAPI.compileSetAutoCompileDelay({ delayMs });
      console.log('Auto-compile delay updated to:', delayMs, 'ms');
    } catch (error) {
      console.error('Failed to update auto-compile delay:', error);
    }
  };

  // Load auto-compile delay on startup
  useEffect(() => {
    const loadAutoCompileDelay = async () => {
      try {
        const result = await window.electronAPI.compileGetAutoCompileDelay();
        setAutoCompileDelay(result.delayMs);
      } catch (error) {
        console.error('Failed to load auto-compile delay:', error);
      }
    };

    loadAutoCompileDelay();
  }, []);

  const activeTab = openTabs.find(tab => tab.id === activeTabId);

  const handleEscapeBackToProjects = () => {
    // Show confirmation dialog for Escape key navigation
    const confirmed = window.confirm(
      'Are you sure you want to go back to the project list?\n\nPress OK to continue or Cancel to stay in the project.'
    );
    if (confirmed) {
      handleBackToProjects();
    }
  };

  const handleBackToProjects = async () => {
    // Check for unsaved changes
    const dirtyTabs = openTabs.filter(tab => tab.isDirty);
    if (dirtyTabs.length > 0) {
      const tabNames = dirtyTabs.map(tab => tab.name).join(', ');
      const confirmed = window.confirm(
        `You have unsaved changes in: ${tabNames}\n\nAre you sure you want to go back? All unsaved changes will be lost.`
      );
      if (!confirmed) return;
    }

    // Create auto-snapshot on going back to projects if enabled
    if (currentProject && autoSnapshotSettings.onProjectSwitch) {
      const hasUnsavedChanges = openTabs.some(tab => tab.isDirty);
      const timeSinceLastSnapshot = lastSnapshotTime ? (Date.now() - lastSnapshotTime) / (1000 * 60) : Infinity;
      
      // Always create snapshot when leaving the editor to preserve work session
      const message = hasUnsavedChanges 
        ? 'Auto-snapshot with unsaved changes before returning to project list'
        : 'Auto-snapshot of current session before returning to project list';
      
      await createAutoSnapshot(message);
    }

    // Stop file watching for current project
    if (currentProject) {
      try {
        await stopFileWatching();
      } catch (error) {
        console.error('Failed to stop file watching:', error);
      }
    }

    // Reset all state
    setCurrentProject(null);
    setFileTree([]);
    setOpenTabs([]);
    setActiveTabId(null);
    setIsCompiling(false);
    setLogs([]);
    setShowLogPanel(false);
    setPdfRefreshTrigger(0);
    setCompilationStatus('idle');
    // Milestone 7: Reset history panel state
    setShowHistoryPanel(false);
  };

  const handleProjectSelect = async (newProject: Project) => {
    // Create auto-snapshot of current project before switching (if we have one)
    if (currentProject && autoSnapshotSettings.onProjectSwitch) {
      const hasUnsavedChanges = openTabs.some(tab => tab.isDirty);
      const timeSinceLastSnapshot = lastSnapshotTime ? (Date.now() - lastSnapshotTime) / (1000 * 60) : Infinity;
      
      // Always create snapshot when switching projects to preserve work session
      const message = hasUnsavedChanges 
        ? `Auto-snapshot with unsaved changes before switching to "${newProject.name}"`
        : `Auto-snapshot of current session before switching to "${newProject.name}"`;
      
      console.log(`Creating auto-snapshot before switching from ${currentProject.name} to ${newProject.name}`);
      await createAutoSnapshot(message);
    }

    // Set the new project
    setCurrentProject(newProject);
  };

  // Milestone 8: Handler functions for templates, snippets, and bibliography
  const handleInsertSnippet = (content: string, cursorPosition?: number) => {
    if (editorRef.current) {
      editorRef.current.insertText(content, cursorPosition);
    }
  };

  const handleOpenBibliography = () => {
    // Auto-detect .bib files in the project or use default
    const bibFiles = fileTree.filter(file => file.name.endsWith('.bib'));
    const defaultBibFile = bibFiles.length > 0 ? bibFiles[0].name : 'references.bib';
    setSelectedBibFile(defaultBibFile);
    
    // Track this file as being managed
    setManagedFiles(prev => new Set(prev).add(defaultBibFile));
    
    setShowBibManager(true);
  };

  const handleCloseBibManager = () => {
    // Remove the file from managed files when closing
    setManagedFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(selectedBibFile);
      return newSet;
    });
    setShowBibManager(false);
  };

  if (!currentProject) {
    return <ProjectExplorer onProjectSelect={handleProjectSelect} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      <Topbar 
        project={currentProject}
        isCompiling={isCompiling}
        onCompile={() => compileProject(false)}
        onCleanBuild={handleCleanBuild}
        onToggleLog={() => setShowLogPanel(!showLogPanel)}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        onBack={handleBackToProjects}
        queueState={queueState}
        showErrorsPanel={showErrorsPanel}
        onToggleErrorsPanel={() => setShowErrorsPanel(!showErrorsPanel)}
        errorCount={errors.length}
        showHistoryPanel={showHistoryPanel}
        onToggleHistoryPanel={() => setShowHistoryPanel(!showHistoryPanel)}
        onOpenSnippets={() => setShowSnippetsPalette(true)}
        onOpenBibliography={handleOpenBibliography}
        onOpenSettings={() => setShowSettingsModal(true)}
        onQuickFileSearch={() => setShowQuickFileSearch(true)}
        isAutoCompileEnabled={isAutoCompileEnabled}
        onToggleAutoCompile={handleToggleAutoCompile}
      />
      
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <CollapsibleSidebar 
          isVisible={showSidebar}
          onToggle={() => setShowSidebar(!showSidebar)}
        >
          {useVirtualizedFileTree ? (
            <VirtualizedFileTree 
              files={fileTree}
              projectId={currentProject.id}
              onFileSelect={openFile}
              onRefresh={loadFileTree}
              onFileCreate={handleFileCreate}
              onFileDelete={handleFileDelete}
              onFileRename={handleFileRename}
              onQuickFileSearch={() => setShowQuickFileSearch(true)}
              maxVisibleItems={50}
              itemHeight={32}
            />
          ) : (
            <FileTree 
              files={fileTree}
              projectId={currentProject.id}
              onFileSelect={openFile}
              onRefresh={loadFileTree}
              onFileCreate={handleFileCreate}
              onFileDelete={handleFileDelete}
              onFileRename={handleFileRename}
              onQuickFileSearch={() => setShowQuickFileSearch(true)}
            />
          )}
        </CollapsibleSidebar>
        
        <ResizableSplitter
          left={
            <Editor
              ref={editorRef}
              tabs={openTabs}
              activeTabId={activeTabId}
              onTabSelect={setActiveTabId}
              onTabClose={closeTab}
              onContentChange={updateTabContent}
              onSave={saveFile}
              errorMarkersForFile={errorMarkersForFile}
              onGotoLine={handleErrorClick}
            />
          }
          right={
            <PDFViewer 
              projectId={currentProject?.id || null} 
              refreshTrigger={pdfRefreshTrigger}
              compilationStatus={compilationStatus}
            />
          }
          defaultSplit={60}
          minLeft={300}
          minRight={250}
          className="flex-1 min-h-0"
        />
      </div>
      
      {/* Log Panel - Slide-out */}
      <LogPanel 
        logs={logs}
        isCompiling={isCompiling}
        onClose={() => setShowLogPanel(false)}
        isOpen={showLogPanel}
      />
      
      {/* Milestone 6: Errors Panel - Slide-out */}
      <ErrorsPanel 
        errors={errors}
        onErrorClick={handleErrorClick}
        onClose={() => setShowErrorsPanel(false)}
        isOpen={showErrorsPanel}
      />
      
      {/* Milestone 7: History Panel */}
      <HistoryPanel 
        projectId={currentProject?.id || null}
        onClose={() => setShowHistoryPanel(false)}
        isOpen={showHistoryPanel}
        className="h-64"
        autoSnapshotSettings={autoSnapshotSettings}
        onAutoSnapshotSettingsChange={setAutoSnapshotSettings}
        onRestoreStart={() => {
          console.log('[App] Restore started - stopping file watching and setting restore state');
          setIsRestoringSnapshot(true);
          // Temporarily stop file watching during restore
          stopFileWatching();
        }}
        onRestoreEnd={() => {
          console.log('[App] Restore ended - restarting file watching and clearing restore state');
          setIsRestoringSnapshot(false);
          // Restart file watching after restore
          startFileWatching();
          // Reload all open tabs to reflect the restored content
          reloadAllOpenTabs();
          // Refresh file tree as well
          loadFileTree();
        }}
      />

      {/* Milestone 13: Quick File Search */}
      <QuickFileSearch
        isOpen={showQuickFileSearch}
        onClose={() => setShowQuickFileSearch(false)}
        files={fileTree}
        onFileSelect={(path) => {
          openFile(path);
          setShowQuickFileSearch(false);
        }}
        projectName={currentProject?.name}
      />

      {/* Milestone 8: Snippets Palette */}
      <SnippetsPalette 
        isOpen={showSnippetsPalette}
        onClose={() => setShowSnippetsPalette(false)}
        onInsertSnippet={handleInsertSnippet}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        isAutoCompileEnabled={isAutoCompileEnabled}
        onToggleAutoCompile={handleToggleAutoCompile}
        autoCompileDelay={autoCompileDelay}
        onAutoCompileDelayChange={handleAutoCompileDelayChange}
      />

      {/* Milestone 8: Bibliography Manager */}
      {currentProject && (
        <BibManager
          projectId={currentProject.id}
          fileName={selectedBibFile}
          isOpen={showBibManager}
          onClose={handleCloseBibManager}
        />
      )}
    </div>
  );
}export default App;
