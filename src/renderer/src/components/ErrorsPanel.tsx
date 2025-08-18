import React from 'react';

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
  className?: string;
}

export const ErrorsPanel: React.FC<ErrorsPanelProps> = ({ 
  errors, 
  onErrorClick,
  className = ''
}) => {
  if (errors.length === 0) {
    return (
      <div className={`errors-panel ${className}`}>
        <div className="p-4 text-center text-gray-500">
          <div className="mb-2">
            <svg className="w-8 h-8 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p>No errors or warnings found</p>
          <p className="text-sm text-gray-400">Your LaTeX compilation was successful!</p>
        </div>
      </div>
    );
  }

  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return (
    <div className={`errors-panel ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-2 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">
            Compilation Issues
          </h3>
          <div className="flex items-center space-x-3 text-xs">
            {errorCount > 0 && (
              <span className="flex items-center text-red-600">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errorCount} {errorCount === 1 ? 'error' : 'errors'}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center text-yellow-600">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error list */}
      <div className="max-h-64 overflow-y-auto">
        {errors.map((error, index) => (
          <div
            key={index}
            className={`flex items-start p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
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
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : error.severity === 'warning' ? (
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 break-words">
                    {error.message}
                  </p>
                  <div className="flex items-center mt-1 text-xs text-gray-500">
                    <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">
                      {error.file}
                    </span>
                    <span className="mx-1">:</span>
                    <span className="font-mono">
                      line {error.line}
                      {error.column && `:${error.column}`}
                    </span>
                  </div>
                </div>
                <div className="ml-2 flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
