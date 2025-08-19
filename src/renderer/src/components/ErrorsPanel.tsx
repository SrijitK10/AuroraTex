import React, { useEffect } from 'react';

interface ErrorItem {
  file: string;
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ErrorsPanelProps {
  errors: ErrorItem[];
  onErrorClick: (file: string, line: number) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const ErrorsPanel: React.FC<ErrorsPanelProps> = ({ 
  errors, 
  onErrorClick,
  onClose,
  isOpen
}) => {
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

  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return (
    <>
      {/* Overlay */}
      <div 
        className={`errors-panel-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      {/* Panel Container */}
      <div className={`errors-panel-container ${isOpen ? 'open' : ''}`}>
        <div className="h-full bg-gray-900 flex flex-col">
          {/* Errors panel header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-sm font-medium text-white">Compilation Issues</h3>
              <div className="flex items-center space-x-3 text-xs">
                {errorCount > 0 && (
                  <span className="flex items-center text-red-400 bg-red-900/20 px-2 py-1 rounded">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errorCount} {errorCount === 1 ? 'error' : 'errors'}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="flex items-center text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Close errors panel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error content */}
          <div className="flex-1 overflow-y-auto bg-gray-900">
            {errors.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="mb-4">
                  <svg className="w-12 h-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg text-gray-300">No errors or warnings found</p>
                <p className="text-sm text-gray-500 mt-2">Your LaTeX compilation was successful!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {errors.map((error, index) => (
                  <div
                    key={index}
                    className={`flex items-start p-4 hover:bg-gray-800 cursor-pointer transition-colors ${
                      error.severity === 'error' 
                        ? 'border-l-4 border-l-red-500' 
                        : error.severity === 'warning'
                        ? 'border-l-4 border-l-yellow-500'
                        : 'border-l-4 border-l-blue-500'
                    }`}
                    onClick={() => onErrorClick(error.file, error.line)}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 mr-3 mt-0.5">
                      {error.severity === 'error' ? (
                        <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      ) : error.severity === 'warning' ? (
                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-200 break-words">
                            {error.message}
                          </p>
                          <div className="flex items-center mt-2 text-xs text-gray-400">
                            <span className="font-mono bg-gray-800 px-2 py-1 rounded text-gray-300">
                              {error.file}
                            </span>
                            <span className="mx-2">:</span>
                            <span className="font-mono text-gray-400">
                              line {error.line}
                              {error.column && `:${error.column}`}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with error count */}
          <div className="border-t border-gray-700 px-4 py-2 bg-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                {errors.length === 0 
                  ? 'No issues found' 
                  : `${errors.length} issue${errors.length !== 1 ? 's' : ''} found`
                }
              </span>
              <span>Press Esc to close</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
