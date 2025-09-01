import React from 'react';
import logo from '../assets/logo.png';

interface TopbarProps {
  project: { id: string; name: string; settings?: { shellEscape?: boolean } };
  isCompiling: boolean;
  onCompile: () => void;
  onBack: () => void;
  onOpenSettings?: () => void;
  // Milestone 5: Queue props
  queueState?: {
    pending: number;
    running: number;
    maxConcurrency: number;
  };
}

export const Topbar: React.FC<TopbarProps> = ({ 
  project, 
  isCompiling, 
  onCompile, 
  onBack,
  onOpenSettings,
  queueState
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
          {/* Back to Home Button */}
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
          
          <div className="h-6 w-px bg-gray-300"></div>
          
          <h1 className="text-lg font-semibold text-gray-800 flex-1">{project.name}</h1>
          
          {/* Queue state indicator */}
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
      
        <div className="flex items-center space-x-3">
          {/* Settings Button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded hover:bg-gray-100 transition-colors"
              title="Open Settings"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          
          {/* Compile Button */}
          <button
            onClick={onCompile}
            disabled={isCompiling}
            className={`px-4 py-2 rounded font-medium flex items-center space-x-2 transition-colors ${
              isCompiling
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            title="Build Project (Cmd/Ctrl+B)"
          >
            {isCompiling ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                <span>Compiling...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <span>Compile</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
