import React from 'react';
import { SidebarToggle } from './CollapsibleSidebar';
import logo from '../assets/logo.png';

interface TopbarProps {
  project: { id: string; name: string; settings?: { shellEscape?: boolean } };
  isCompiling: boolean;
  onCompile: () => void;
  onToggleLog: () => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;
  onBack: () => void;
  // Milestone 5: Queue props
  queueState?: {
    pending: number;
    running: number;
    maxConcurrency: number;
  };
  // Milestone 6: Error panel props
  showErrorsPanel?: boolean;
  onToggleErrorsPanel?: () => void;
  errorCount?: number;
  // Milestone 7: History panel props
  showHistoryPanel?: boolean;
  onToggleHistoryPanel?: () => void;
  // Milestone 8: Templates, snippets, and bibliography props
  onOpenSnippets?: () => void;
  onOpenBibliography?: () => void;
  // Settings modal
  onOpenSettings?: () => void;
  // Milestone 13: Performance & UX polish props
  onCleanBuild?: () => void;
  onQuickFileSearch?: () => void;
  isAutoCompileEnabled?: boolean;
  onToggleAutoCompile?: (enabled: boolean) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ 
  project, 
  isCompiling, 
  onCompile, 
  onToggleLog,
  showSidebar,
  onToggleSidebar,
  onBack,
  queueState,
  showErrorsPanel = false,
  onToggleErrorsPanel,
  errorCount = 0,
  showHistoryPanel = false,
  onToggleHistoryPanel,
  onOpenSnippets,
  onOpenBibliography,
  onOpenSettings,
  onCleanBuild,
  onQuickFileSearch,
  isAutoCompileEnabled = false,
  onToggleAutoCompile
}) => {
  return (
    <div className="topbar-container">
      {/* Milestone 10: Security Banner - Show when shell-escape is enabled */}
      {project.settings?.shellEscape && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm font-medium">
          <div className="flex items-center justify-center space-x-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>
              ⚠️ SECURITY WARNING: Shell-escape is enabled for this project. This allows LaTeX to execute system commands.
            </span>
          </div>
        </div>
      )}
      
      <div className="topbar">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 rounded hover:bg-gray-100 transition-colors duration-150"
            title="Back to Projects (Esc)"
          >
            <img 
              src={logo} 
              alt="TexLab Logo" 
              className="h-8 w-auto max-w-32"
            />
          </button>
          
          <SidebarToggle 
            isVisible={showSidebar} 
            onToggle={onToggleSidebar}
            className="text-gray-600"
          />
          
          <h1 className="text-lg font-semibold text-gray-800">{project.name}</h1>
          
          {/* Milestone 5: Queue state indicator */}
          {queueState && (queueState.running > 0 || queueState.pending > 0) && (
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span className="text-sm">
                {queueState.running > 0 && `Running: ${queueState.running}`}
                {queueState.running > 0 && queueState.pending > 0 && ', '}
                {queueState.pending > 0 && `Queued: ${queueState.pending}`}
              </span>
            </div>
          )}
          
          {/* Legacy single compile indicator for compatibility */}
          {isCompiling && (!queueState || (queueState.running === 0 && queueState.pending === 0)) && (
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span className="text-sm">Compiling...</span>
            </div>
          )}
        </div>
      
      <div className="flex items-center space-x-2">
        {/* Settings Button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            title="Open settings"
          >
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings</span>
            </div>
          </button>
        )}
        
        {/* Milestone 8: Snippets Palette */}
        {onOpenSnippets && (
          <button
            onClick={onOpenSnippets}
            className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            title="Open snippets palette (Ctrl+Shift+P or Ctrl+.)"
          >
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span>Snippets</span>
            </div>
          </button>
        )}
        
        {/* Milestone 8: Bibliography Manager */}
        {onOpenBibliography && (
          <button
            onClick={onOpenBibliography}
            className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            title="Open bibliography manager"
          >
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Bibliography</span>
            </div>
          </button>
        )}
        
        {/* Milestone 13: Quick File Search */}
        {onQuickFileSearch && (
          <button
            onClick={onQuickFileSearch}
            className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center space-x-1"
            title="Quick File Search (Cmd/Ctrl+P)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden md:inline">Search</span>
          </button>
        )}
        
        {/* Milestone 13: Auto-compile toggle */}
        {onToggleAutoCompile && (
          <button
            onClick={() => onToggleAutoCompile(!isAutoCompileEnabled)}
            className={`px-3 py-2 rounded border flex items-center space-x-1 ${
              isAutoCompileEnabled
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            title={`Auto-compile: ${isAutoCompileEnabled ? 'ON' : 'OFF'} (Cmd/Ctrl+Shift+B)`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden md:inline">Auto</span>
          </button>
        )}
        
        {/* Milestone 13: Build buttons with dropdown */}
        <div className="relative group">
          <button
            onClick={onCompile}
            disabled={isCompiling}
            className={`px-4 py-2 rounded-l font-medium ${
              isCompiling
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            title="Build Project (Cmd/Ctrl+B)"
          >
            {isCompiling ? 'Compiling...' : 'Compile'}
          </button>
          
          {onCleanBuild && (
            <>
              <button
                className={`px-2 py-2 rounded-r border-l border-green-500 font-medium ${
                  isCompiling
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
                disabled={isCompiling}
                title="Build options"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              {/* Dropdown menu */}
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <button
                  onClick={onCleanBuild}
                  disabled={isCompiling}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Clean Build</span>
                </button>
              </div>
            </>
          )}
        </div>
        
        <button
          onClick={onToggleLog}
          className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Logs
        </button>
        
        {/* Milestone 6: Errors Panel Toggle */}
        {onToggleErrorsPanel && (
          <button
            onClick={onToggleErrorsPanel}
            className={`px-3 py-2 rounded border font-medium transition-colors relative ${
              showErrorsPanel
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            title={`${showErrorsPanel ? 'Hide' : 'Show'} compilation errors and warnings`}
          >
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Errors</span>
              {errorCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {errorCount > 99 ? '99+' : errorCount}
                </span>
              )}
            </div>
          </button>
        )}
        
        {/* Milestone 7: History Panel Toggle */}
        {onToggleHistoryPanel && (
          <button
            onClick={onToggleHistoryPanel}
            className={`px-3 py-2 rounded border font-medium transition-colors ${
              showHistoryPanel
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            title={`${showHistoryPanel ? 'Hide' : 'Show'} project snapshots and history`}
          >
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>History</span>
            </div>
          </button>
        )}
      </div>
    </div>
  </div>
);
};
