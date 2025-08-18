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
  onToggleAutoCompile
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
            onClick={onToggleAutoCompile}
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
      </div>
    </div>
  );
};
