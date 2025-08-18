import React, { useState, useEffect } from 'react';
import { ProjectExplorer } from './components/ProjectExplorer';
import { FileTree } from './components/FileTree';
import { Editor } from './components/Editor';
import { PDFViewer } from './components/PDFViewer';
import { LogPanel } from './components/LogPanel';
import { Topbar } from './components/Topbar';
import { ResizableSplitter } from './components/ResizableSplitter';
import { CollapsibleSidebar } from './components/CollapsibleSidebar';

export interface Project {
  id: string;
  name: string;
  root: string;
  mainFile: string;
  createdAt: string;
  updatedAt: string;
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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+B (Mac) or Ctrl+B (Windows/Linux) to toggle sidebar
      if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault();
        setShowSidebar(prev => !prev);
      }
      
      // Escape key to go back to projects (only if no modal is open)
      if (event.key === 'Escape' && !(event.target as Element)?.closest?.('.modal')) {
        event.preventDefault();
        handleBackToProjects();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openTabs]); // Include openTabs to get latest state in handleBackToProjects

  // Load file tree when project changes
  useEffect(() => {
    if (currentProject) {
      loadFileTree();
      startFileWatching();
    }
    
    return () => {
      if (currentProject) {
        stopFileWatching();
      }
    };
  }, [currentProject]);

  // Set up file change listener
  useEffect(() => {
    const handleFileChange = (event: any, data: any) => {
      if (data.projectId === currentProject?.id) {
        console.log('File changed:', data);
        
        // Refresh file tree on any changes
        loadFileTree();
        
        // Handle file changes for open tabs
        if (data.type === 'change' && !data.path.includes('.tmp')) {
          const affectedTab = openTabs.find(tab => tab.path === data.path);
          if (affectedTab && !affectedTab.isDirty) {
            // File changed externally and tab is not dirty, offer to reload
            const shouldReload = window.confirm(
              `The file "${data.path}" has been modified externally. Would you like to reload it?`
            );
            if (shouldReload) {
              reloadFile(affectedTab.id, data.path);
            }
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
  }, [currentProject?.id, openTabs]);

  // Set up compile progress event cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clean up any remaining progress listeners on unmount
      const cleanup = () => {};
      window.electronAPI.removeCompileProgressListener(cleanup);
    };
  }, []);

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

  const compileProject = async () => {
    if (!currentProject || isCompiling) return;

    setIsCompiling(true);
    setCompilationStatus('compiling');
    setShowLogPanel(true); // Milestone 4: Open Log Panel
    setLogs([]);

    try {
      const result = await window.electronAPI.compileRun({
        projectId: currentProject.id,
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
            window.electronAPI.removeCompileProgressListener(handleProgress);
          } else if (data.state === 'error' || data.state === 'killed') {
            setIsCompiling(false);
            setCompilationStatus('error');
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
          } else if (status.state !== 'success') {
            // Handle final state if not caught by events
            setIsCompiling(false);
            if (status.state === 'success') {
              setCompilationStatus('success');
              setPdfRefreshTrigger(prev => prev + 1);
            } else {
              setCompilationStatus('error');
            }
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

  const mockCompile = async () => {
    if (!currentProject) return;

    setCompilationStatus('compiling');
    try {
      await window.electronAPI.compileMock({
        projectId: currentProject.id,
      });
      console.log('Mock PDF created successfully - refreshing PDF');
      setCompilationStatus('success');
      // Trigger PDF refresh
      setPdfRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to create mock PDF:', error);
      setCompilationStatus('error');
    }
  };

  const activeTab = openTabs.find(tab => tab.id === activeTabId);

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
  };

  if (!currentProject) {
    return <ProjectExplorer onProjectSelect={setCurrentProject} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Topbar 
        project={currentProject}
        isCompiling={isCompiling}
        onCompile={compileProject}
        onToggleLog={() => setShowLogPanel(!showLogPanel)}
        onMockCompile={mockCompile}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        onBack={handleBackToProjects}
      />
      
      <div className="flex-1 flex">
        <CollapsibleSidebar 
          isVisible={showSidebar}
          onToggle={() => setShowSidebar(!showSidebar)}
        >
          <FileTree 
            files={fileTree}
            projectId={currentProject.id}
            onFileSelect={openFile}
            onRefresh={loadFileTree}
            onFileCreate={handleFileCreate}
            onFileDelete={handleFileDelete}
            onFileRename={handleFileRename}
          />
        </CollapsibleSidebar>
        
        <ResizableSplitter
          left={
            <Editor
              tabs={openTabs}
              activeTabId={activeTabId}
              onTabSelect={setActiveTabId}
              onTabClose={closeTab}
              onContentChange={updateTabContent}
              onSave={saveFile}
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
          className="flex-1"
        />
      </div>
      
      {showLogPanel && (
        <div className="log-panel">
          <LogPanel 
            logs={logs}
            isCompiling={isCompiling}
            onClose={() => setShowLogPanel(false)}
          />
        </div>
      )}
    </div>
  );
}

export default App;
