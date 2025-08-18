import React from 'react';
import { SidebarToggle } from './CollapsibleSidebar';

interface TopbarProps {
  project: { id: string; name: string };
  isCompiling: boolean;
  onCompile: () => void;
  onToggleLog: () => void;
  onMockCompile?: () => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;
  onBack: () => void;
  // Milestone 5: Queue and compile mode props
  queueState?: {
    pending: number;
    running: number;
    maxConcurrency: number;
  };
  isAutoCompileEnabled?: boolean;
  onToggleAutoCompile?: () => void;
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
}

export const Topbar: React.FC<TopbarProps> = ({ 
  project, 
  isCompiling, 
  onCompile, 
  onToggleLog,
  onMockCompile,
  showSidebar,
  onToggleSidebar,
  onBack,
  queueState,
  isAutoCompileEnabled = false,
  onToggleAutoCompile,
  showErrorsPanel = false,
  onToggleErrorsPanel,
  errorCount = 0,
  showHistoryPanel = false,
  onToggleHistoryPanel,
  onOpenSnippets,
  onOpenBibliography
}) => {
  return (
    <div className="topbar">
      <div className="flex items-center space-x-4">
        <button
          onClick={onBack}
          className="p-2 rounded hover:bg-gray-100 transition-colors duration-150 text-gray-600"
          title="Back to Projects (Esc)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 19l-7-7 7-7" 
            />
          </svg>
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
        {/* Milestone 5: Auto-compile toggle */}
        {onToggleAutoCompile && (
          <button
            onClick={() => {
              console.log('Topbar: Auto-compile button clicked, current state:', isAutoCompileEnabled);
              onToggleAutoCompile();
            }}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
              isAutoCompileEnabled
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
            }`}
            title={isAutoCompileEnabled ? 'Auto-compile enabled' : 'Auto-compile disabled'}
          >
            {isAutoCompileEnabled ? '🔄 Auto' : '⏸️ Manual'}
          </button>
        )}
        
        {/* Milestone 8: Snippets Palette */}
        {onOpenSnippets && (
          <button
            onClick={onOpenSnippets}
            className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            title="Open snippets palette (Ctrl+Space)"
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
        
        {onMockCompile && (
          <button
            onClick={onMockCompile}
            className="px-3 py-2 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            Mock PDF
          </button>
        )}
        
        <button
          onClick={onCompile}
          disabled={isCompiling}
          className={`px-4 py-2 rounded font-medium ${
            isCompiling
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isCompiling ? 'Compiling...' : 'Compile'}
        </button>
        
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
  );
};
