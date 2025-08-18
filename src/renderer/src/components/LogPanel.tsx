import React, { useEffect, useRef } from 'react';

interface LogPanelProps {
  logs: string[];
  isCompiling: boolean;
  onClose: () => void;
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs, isCompiling, onClose }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const formatLogLine = (line: string, index: number) => {
    // Color code different types of log lines
    let className = 'text-green-400';
    
    if (line.includes('ERROR') || line.includes('Error') || line.includes('error')) {
      className = 'text-red-400';
    } else if (line.includes('WARNING') || line.includes('Warning') || line.includes('warning')) {
      className = 'text-yellow-400';
    } else if (line.includes('INFO') || line.includes('Info')) {
      className = 'text-blue-400';
    } else if (line.includes('SUCCESS') || line.includes('Success')) {
      className = 'text-green-400';
    }

    return (
      <div key={index} className={`${className} text-xs leading-relaxed`}>
        {line}
      </div>
    );
  };

  return (
    <div className="h-48 bg-gray-900 border-t border-gray-200 flex flex-col">
      {/* Log panel header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium text-white">Compilation Logs</h3>
          {isCompiling && (
            <div className="flex items-center space-x-2 text-blue-400">
              <div className="animate-spin h-3 w-3 border border-blue-400 border-t-transparent rounded-full"></div>
              <span className="text-xs">Compiling...</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
              }
            }}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
            title="Scroll to bottom"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
          
          <button
            onClick={() => {
              // Clear logs functionality could be added here
              console.log('Clear logs');
            }}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
            title="Clear logs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
            title="Close logs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Log content */}
      <div 
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-gray-900"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No logs yet. Compile your project to see output here.
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((line, index) => formatLogLine(line, index))}
            {isCompiling && (
              <div className="text-blue-400 text-xs animate-pulse">
                ▶ Compilation in progress...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-4 py-1 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{logs.length} log lines</span>
          <span>{isCompiling ? 'Compiling...' : 'Ready'}</span>
        </div>
      </div>
    </div>
  );
};
