import React from 'react';

interface ActionSidebarProps {
  // Build props
  onCleanBuild?: () => void;
  isCompiling: boolean;
  
  // Panel props
  onToggleLog: () => void;
  showErrorsPanel?: boolean;
  onToggleErrorsPanel?: () => void;
  errorCount?: number;
  showHistoryPanel?: boolean;
  onToggleHistoryPanel?: () => void;
  
  // Sidebar props
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  
  // Tool props
  onQuickFileSearch?: () => void;
  onOpenSnippets?: () => void;
  onOpenBibliography?: () => void;
}

export const ActionSidebar: React.FC<ActionSidebarProps> = ({
  onCleanBuild,
  isCompiling,
  onToggleLog,
  showErrorsPanel = false,
  onToggleErrorsPanel,
  errorCount = 0,
  showHistoryPanel = false,
  onToggleHistoryPanel,
  showSidebar = true,
  onToggleSidebar,
  onQuickFileSearch,
  onOpenSnippets,
  onOpenBibliography
}) => {
  return (
    <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4 space-y-3">
      {/* File Explorer Toggle */}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className={`p-2 rounded transition-colors group relative ${
            showSidebar
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-100 text-gray-600'
          }`}
          title={`${showSidebar ? 'Hide' : 'Show'} File Explorer`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18" />
          </svg>
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            File Explorer
          </div>
        </button>
      )}
      
      {/* Quick File Search */}
      {onQuickFileSearch && (
        <button
          onClick={onQuickFileSearch}
          className="p-2 rounded hover:bg-gray-100 transition-colors group relative text-gray-600"
          title="Quick File Search (Cmd/Ctrl+P)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            Search Files
          </div>
        </button>
      )}
      
      {/* Snippets */}
      {onOpenSnippets && (
        <button
          onClick={onOpenSnippets}
          className="p-2 rounded hover:bg-gray-100 transition-colors group relative text-gray-600"
          title="Snippets (Ctrl+Shift+P)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            Snippets
          </div>
        </button>
      )}
      
      {/* Bibliography */}
      {onOpenBibliography && (
        <button
          onClick={onOpenBibliography}
          className="p-2 rounded hover:bg-gray-100 transition-colors group relative text-gray-600"
          title="Bibliography Manager"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            Bibliography
          </div>
        </button>
      )}
      
      <div className="w-8 h-px bg-gray-300 my-2"></div>
      
      {/* Clean Build */}
      {onCleanBuild && (
        <button
          onClick={onCleanBuild}
          disabled={isCompiling}
          className="p-2 rounded hover:bg-gray-100 transition-colors group relative disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
          title="Clean Build"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            Clean Build
          </div>
        </button>
      )}
      
      {/* Logs */}
      <button
        onClick={onToggleLog}
        className="p-2 rounded hover:bg-gray-100 transition-colors group relative text-gray-600"
        title="Toggle Logs"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
          Logs
        </div>
      </button>
      
      {/* Errors Panel */}
      {onToggleErrorsPanel && (
        <button
          onClick={onToggleErrorsPanel}
          className={`p-2 rounded transition-colors group relative ${
            showErrorsPanel
              ? 'bg-red-600 text-white'
              : 'hover:bg-gray-100 text-gray-600'
          }`}
          title="Toggle Errors Panel"
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errorCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
                {errorCount > 9 ? '9+' : errorCount}
              </span>
            )}
          </div>
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {errorCount > 0 ? `Errors (${errorCount})` : 'Errors'}
          </div>
        </button>
      )}
      
      {/* History Panel */}
      {onToggleHistoryPanel && (
        <button
          onClick={onToggleHistoryPanel}
          className={`p-2 rounded transition-colors group relative ${
            showHistoryPanel
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-100 text-gray-600'
          }`}
          title="Toggle History Panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            History
          </div>
        </button>
      )}
    </div>
  );
};
