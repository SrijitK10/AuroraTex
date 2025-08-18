import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { indentWithTab, defaultKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';
import { foldGutter, syntaxHighlighting, defaultHighlightStyle, foldAll, unfoldAll } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { vim } from '@replit/codemirror-vim';
import { latex, isLatexFile } from '../editor/latexLanguage';

interface Tab {
  id: string;
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
}

interface EditorProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onContentChange: (tabId: string, content: string) => void;
  onSave: (tabId: string, content: string, isAutosave?: boolean) => void;
}

// Get language support based on file extension
const getLanguageSupport = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'tex':
    case 'latex':
    case 'sty':
    case 'cls':
    case 'bib':
      return latex();
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: ext.includes('ts') });
    case 'html':
    case 'htm':
      return html();
    case 'css':
    case 'scss':
    case 'sass':
      return css();
    case 'json':
      return json();
    case 'py':
      return python();
    case 'md':
    case 'markdown':
      return markdown();
    default:
      return [];
  }
};

export const Editor: React.FC<EditorProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onContentChange,
  onSave,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [lastSaved, setLastSaved] = useState<{ [key: string]: Date }>({});
  const autosaveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isVimMode, setIsVimMode] = useState(false);
  const languageCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const keymapCompartment = useRef(new Compartment());

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // Check for unsaved changes before closing
  const hasUnsavedChanges = tabs.some(tab => tab.isDirty);

  // Format relative time for last saved
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    
    if (diffSecs < 30) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString();
  };

  // Debounced autosave function
  const debouncedSave = useCallback((tabId: string, content: string) => {
    // Clear existing timeout
    if (autosaveTimeoutRef.current[tabId]) {
      clearTimeout(autosaveTimeoutRef.current[tabId]);
    }
    
    // Set new timeout for 750ms (as per Milestone 2)
    autosaveTimeoutRef.current[tabId] = setTimeout(() => {
      onSave(tabId, content, true); // isAutosave = true
      setLastSaved(prev => ({ ...prev, [tabId]: new Date() }));
      delete autosaveTimeoutRef.current[tabId];
    }, 750);
  }, [onSave]);

  // Create editor extensions
  const createExtensions = useCallback((filename: string) => {
    const language = getLanguageSupport(filename);
    const theme = isDarkMode ? oneDark : [];
    const vimKeymap = isVimMode ? vim() : [];
    
    return [
      basicSetup,
      languageCompartment.current.of(language),
      themeCompartment.current.of(theme),
      keymapCompartment.current.of(vimKeymap),
      foldGutter(),
      syntaxHighlighting(defaultHighlightStyle),
      highlightSelectionMatches(),
      keymap.of([
        indentWithTab,
        ...defaultKeymap,
        ...searchKeymap,
        // Custom keybindings
        { key: 'Cmd-s', mac: 'Cmd-s', run: () => { handleSave(); return true; } },
        { key: 'Ctrl-s', run: () => { handleSave(); return true; } },
        { key: 'Cmd-f', mac: 'Cmd-f', run: () => { handleOpenSearch(); return true; } },
        { key: 'Ctrl-f', run: () => { handleOpenSearch(); return true; } },
        { key: 'Cmd-Shift-[', mac: 'Cmd-Shift-[', run: () => { handleFoldAll(); return true; } },
        { key: 'Cmd-Shift-]', mac: 'Cmd-Shift-]', run: () => { handleUnfoldAll(); return true; } },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && activeTabId) {
          const content = update.state.doc.toString();
          onContentChange(activeTabId, content);
          
          // Trigger autosave
          debouncedSave(activeTabId, content);
        }
      }),
      // Line numbers and word wrap
      EditorView.lineWrapping,
      EditorView.theme({
        '.cm-editor': {
          fontSize: '14px',
          fontFamily: 'SF Mono, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        },
        '.cm-scroller': {
          fontFamily: 'inherit',
        },
        '.cm-focused': {
          outline: 'none',
        },
      }),
    ];
  }, [activeTabId, isDarkMode, isVimMode, debouncedSave, onContentChange]);

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current || !activeTab) return;

    // Destroy existing editor
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const extensions = createExtensions(activeTab.name);
    
    const state = EditorState.create({
      doc: activeTab.content || '',
      extensions,
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [activeTab?.id]);

  // Update content when activeTab content changes externally
  useEffect(() => {
    if (viewRef.current && activeTab) {
      const currentDoc = viewRef.current.state.doc.toString();
      if (currentDoc !== activeTab.content) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: activeTab.content,
          },
        });
      }
    }
  }, [activeTab?.content]);

  // Update language when tab changes
  useEffect(() => {
    if (viewRef.current && activeTab) {
      const language = getLanguageSupport(activeTab.name);
      viewRef.current.dispatch({
        effects: languageCompartment.current.reconfigure(language)
      });
    }
  }, [activeTab?.name]);

  // Update theme
  useEffect(() => {
    if (viewRef.current) {
      const theme = isDarkMode ? oneDark : [];
      viewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure(theme)
      });
    }
  }, [isDarkMode]);

  // Update vim keymap
  useEffect(() => {
    if (viewRef.current) {
      const vimKeymap = isVimMode ? vim() : [];
      viewRef.current.dispatch({
        effects: keymapCompartment.current.reconfigure(vimKeymap)
      });
    }
  }, [isVimMode]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(autosaveTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  // Editor action handlers
  const handleSave = () => {
    if (activeTabId && activeTab) {
      const content = viewRef.current?.state.doc.toString() || activeTab.content;
      onSave(activeTabId, content, false); // isAutosave = false (manual save)
      setLastSaved(prev => ({ ...prev, [activeTabId]: new Date() }));
    }
  };

  const handleOpenSearch = () => {
    if (viewRef.current) {
      openSearchPanel(viewRef.current);
    }
  };

  const handleFoldAll = () => {
    if (viewRef.current) {
      foldAll(viewRef.current);
    }
  };

  const handleUnfoldAll = () => {
    if (viewRef.current) {
      unfoldAll(viewRef.current);
    }
  };

  // Dirty guard - warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">No files open</p>
          <p className="text-sm">Select a file from the file tree to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center px-4 py-2 border-r border-gray-200 cursor-pointer min-w-0 ${
                tab.id === activeTabId
                  ? 'bg-white text-gray-900'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => onTabSelect(tab.id)}
            >
              <span className="text-sm truncate mr-2">
                {tab.isDirty && <span className="text-orange-500 mr-1">●</span>}
                {tab.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  
                  // Warn about unsaved changes (dirty guard)
                  if (tab.isDirty) {
                    const confirmed = window.confirm(`"${tab.name}" has unsaved changes. Close anyway?`);
                    if (!confirmed) return;
                  }
                  
                  onTabClose(tab.id);
                }}
                className="ml-1 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        {activeTab && (
          <div className="absolute inset-0 flex flex-col">
            {/* Editor toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>{activeTab.path}</span>
                {isLatexFile(activeTab.name) && (
                  <span className="text-blue-500 text-xs bg-blue-100 px-2 py-1 rounded">LaTeX</span>
                )}
                {activeTab.isDirty ? (
                  <span className="text-orange-500 text-xs flex items-center">
                    <span className="mr-1">●</span>
                    {autosaveTimeoutRef.current[activeTab.id] ? 'Saving...' : 'Unsaved changes'}
                  </span>
                ) : (
                  lastSaved[activeTab.id] && (
                    <span className="text-green-500 text-xs flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Saved {formatRelativeTime(lastSaved[activeTab.id])}
                    </span>
                  )
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Editor controls */}
                <button
                  onClick={handleOpenSearch}
                  className="px-2 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300 text-gray-700"
                  title="Search (Cmd/Ctrl+F)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                
                <button
                  onClick={handleFoldAll}
                  className="px-2 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300 text-gray-700"
                  title="Fold All"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
                
                <button
                  onClick={handleUnfoldAll}
                  className="px-2 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300 text-gray-700"
                  title="Unfold All"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
                
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="px-2 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300 text-gray-700"
                  title="Toggle Dark Mode"
                >
                  {isDarkMode ? '☀️' : '🌙'}
                </button>
                
                <button
                  onClick={() => setIsVimMode(!isVimMode)}
                  className={`px-2 py-1 rounded text-sm ${
                    isVimMode 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                  title="Toggle Vim Mode"
                >
                  Vim
                </button>
                
                <button
                  onClick={handleSave}
                  disabled={!activeTab.isDirty}
                  className={`px-3 py-1 rounded text-sm ${
                    activeTab.isDirty
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  title="Save (Cmd/Ctrl+S)"
                >
                  Save
                </button>
              </div>
            </div>

            {/* CodeMirror editor */}
            <div className="flex-1 overflow-hidden">
              <div ref={editorRef} className="h-full editor-container" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
