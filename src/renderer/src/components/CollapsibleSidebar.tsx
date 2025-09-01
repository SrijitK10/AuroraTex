import React from 'react';

interface CollapsibleSidebarProps {
  isVisible: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  width?: string;
  disableWidthControl?: boolean; // New prop to disable width control when used with ResizableSplitter
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  isVisible,
  onToggle,
  children,
  width = 'w-64',
  disableWidthControl = false,
}) => {
  if (disableWidthControl) {
    // When width is controlled externally (e.g., by ResizableSplitter)
    // Always render content, but can use isVisible for other visual states if needed
    return (
      <div className="bg-gray-50 border-r border-gray-200 flex flex-col h-full overflow-hidden">
        {children}
      </div>
    );
  }

  // Default behavior with internal width control
  return (
    <>
      {/* Sidebar */}
      <div
        className={`${
          isVisible ? width : 'w-0'
        } bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out overflow-hidden h-full`}
      >
        {children}
      </div>
    </>
  );
};

// Toggle button component
interface SidebarToggleProps {
  isVisible: boolean;
  onToggle: () => void;
  className?: string;
}

export const SidebarToggle: React.FC<SidebarToggleProps> = ({
  isVisible,
  onToggle,
  className = '',
}) => {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcut = isMac ? '⌘B' : 'Ctrl+B';
  
  return (
    <button
      onClick={onToggle}
      className={`p-2 rounded hover:bg-gray-100 transition-colors duration-150 ${className}`}
      title={`${isVisible ? 'Hide' : 'Show'} File Explorer (${shortcut})`}
    >
      <svg 
        className="w-4 h-4" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        {isVisible ? (
          // Sidebar visible - show close/hide icon
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M11 19l-7-7 7-7m8 14l-7-7 7-7" 
          />
        ) : (
          // Sidebar hidden - show open/show icon  
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 6h16M4 10h16M4 14h16M4 18h16" 
          />
        )}
      </svg>
    </button>
  );
};
