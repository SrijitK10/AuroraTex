import React, { useEffect, useRef } from 'react';

interface LogPanelProps {
  logs: string[];
  isCompiling: boolean;
  onClose: () => void;
  isOpen: boolean;
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs, isCompiling, onClose, isOpen }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Handle Escape key to close panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        onClose();
        return false;
      }
    };

    if (isOpen) {
      // Add event listener with capture = true to handle before other listeners
      document.addEventListener('keydown', handleKeyDown, { capture: true });
    }

    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

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
    <>
      {/* Overlay */}
      <div 
        className={`log-panel-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      {/* Panel Container */}
      <div className={`log-panel-container ${isOpen ? 'open' : ''}`}>
        <div className="h-full bg-gray-900 flex flex-col">
          {/* Log panel header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
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
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Scroll to bottom"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Close compilation logs"
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
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No logs yet</p>
                <p className="text-xs text-gray-600 mt-1">Compile your project to see output here</p>
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

          {/* Footer with log count */}
          <div className="border-t border-gray-700 px-4 py-2 bg-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{logs.length} log line{logs.length !== 1 ? 's' : ''}</span>
              <span>Press Esc to close</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};