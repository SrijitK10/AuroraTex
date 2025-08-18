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
}

export const Topbar: React.FC<TopbarProps> = ({ 
  project, 
  isCompiling, 
  onCompile, 
  onToggleLog,
  onMockCompile,
  showSidebar,
  onToggleSidebar,
  onBack
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
        {isCompiling && (
          <div className="flex items-center space-x-2 text-blue-600">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="text-sm">Compiling...</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
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
