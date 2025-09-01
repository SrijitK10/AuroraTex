import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ResizableSplitterProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSplit?: number; // percentage (0-100)
  minLeft?: number; // minimum width in pixels
  minRight?: number; // minimum width in pixels
  className?: string;
  collapseThreshold?: number; // pixels - when to auto-collapse the left panel
  onLeftCollapse?: (collapsed: boolean) => void; // callback when left panel collapses/expands
  leftCollapsed?: boolean; // external control of collapsed state
}

export const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  left,
  right,
  defaultSplit = 50,
  minLeft = 200,
  minRight = 200,
  className = '',
  collapseThreshold = 100,
  onLeftCollapse,
  leftCollapsed,
}) => {
  const [split, setSplit] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(leftCollapsed || false);
  const [lastSplitBeforeCollapse, setLastSplitBeforeCollapse] = useState(defaultSplit);
  const [isNearCollapseThreshold, setIsNearCollapseThreshold] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;
      
      // Calculate raw mouse position as pixel width
      const rawLeftWidth = mouseX;
      
      // Check for collapse threshold BEFORE applying constraints
      if (rawLeftWidth < collapseThreshold && !isLeftCollapsed) {
        // Collapse the left panel
        setLastSplitBeforeCollapse(split);
        setIsLeftCollapsed(true);
        setIsNearCollapseThreshold(false);
        onLeftCollapse?.(true);
        return; // Exit early when collapsing
      } else if (rawLeftWidth >= collapseThreshold && isLeftCollapsed) {
        // Expand the left panel and set position based on mouse
        setIsLeftCollapsed(false);
        setIsNearCollapseThreshold(false);
        onLeftCollapse?.(false);
        
        // Calculate split for current mouse position
        let newSplit = (mouseX / containerWidth) * 100;
        const minLeftPercent = (minLeft / containerWidth) * 100;
        const minRightPercent = (minRight / containerWidth) * 100;
        newSplit = Math.max(minLeftPercent, Math.min(100 - minRightPercent, newSplit));
        setSplit(newSplit);
        return;
      }
      
      // Check if we're near the collapse threshold (for visual feedback)
      const nearThreshold = rawLeftWidth < collapseThreshold * 1.5 && !isLeftCollapsed;
      setIsNearCollapseThreshold(nearThreshold);
      
      // Only update split if not collapsed
      if (!isLeftCollapsed) {
        // Calculate new split percentage
        let newSplit = (mouseX / containerWidth) * 100;
        
        // Apply minimum constraints
        const minLeftPercent = (minLeft / containerWidth) * 100;
        const minRightPercent = (minRight / containerWidth) * 100;
        
        newSplit = Math.max(minLeftPercent, Math.min(100 - minRightPercent, newSplit));
        setSplit(newSplit);
      }
    },
    [isDragging, minLeft, minRight, collapseThreshold, isLeftCollapsed, split, onLeftCollapse]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsNearCollapseThreshold(false);
  }, []);

  const handleExpandClick = useCallback(() => {
    if (isLeftCollapsed) {
      setIsLeftCollapsed(false);
      setSplit(lastSplitBeforeCollapse);
      onLeftCollapse?.(false);
    }
  }, [isLeftCollapsed, lastSplitBeforeCollapse, onLeftCollapse]);

  // Sync external collapsed state
  useEffect(() => {
    if (leftCollapsed !== undefined && leftCollapsed !== isLeftCollapsed) {
      if (leftCollapsed && !isLeftCollapsed) {
        // External wants to collapse
        setLastSplitBeforeCollapse(split);
        setIsLeftCollapsed(true);
      } else if (!leftCollapsed && isLeftCollapsed) {
        // External wants to expand
        setIsLeftCollapsed(false);
        setSplit(lastSplitBeforeCollapse);
      }
    }
  }, [leftCollapsed, isLeftCollapsed, split, lastSplitBeforeCollapse]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={containerRef}
      className={`flex h-full ${className}`}
    >
      {/* Left panel */}
      <div 
        style={{ 
          width: isLeftCollapsed ? '0px' : `${split}%`, 
          minWidth: isLeftCollapsed ? '0px' : `${minLeft}px`,
          flexShrink: 0,
          flexGrow: 0
        }}
        className="flex flex-col overflow-hidden"
      >
        {!isLeftCollapsed && left}
      </div>
      
      {/* Resizer or Expand Button */}
      <div
        className={`w-1 transition-colors duration-150 relative group flex-shrink-0 ${
          isLeftCollapsed 
            ? 'bg-blue-400 hover:bg-blue-500 cursor-pointer' 
            : isNearCollapseThreshold 
              ? 'bg-orange-400 hover:bg-orange-500 cursor-col-resize' 
              : isDragging 
                ? 'bg-blue-500' 
                : 'bg-gray-300 hover:bg-blue-400 cursor-col-resize'
        }`}
        onMouseDown={isLeftCollapsed ? undefined : handleMouseDown}
        onClick={isLeftCollapsed ? handleExpandClick : undefined}
        style={{
          cursor: isLeftCollapsed ? 'pointer' : 'col-resize'
        }}
      >
        {/* Visual indicator */}
        <div className={`absolute inset-y-0 left-0 w-full flex items-center justify-center transition-opacity ${
          isLeftCollapsed ? 'opacity-60 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          {isLeftCollapsed ? (
            /* Expand indicator */
            <div className="w-1 h-8 bg-blue-500 rounded-full shadow-sm flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          ) : (
            /* Resize dots indicator */
            <div className="w-0.5 h-8 bg-white rounded-full shadow-sm flex flex-col justify-center items-center space-y-0.5">
              <div className="w-0.5 h-0.5 bg-gray-600 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-gray-600 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-gray-600 rounded-full"></div>
            </div>
          )}
        </div>
      </div>
      
      {/* Right panel */}
      <div 
        style={{ 
          width: isLeftCollapsed ? 'calc(100% - 4px)' : `${100 - split}%`, 
          minWidth: `${minRight}px`,
          flexShrink: 0,
          flexGrow: 0
        }}
        className="flex flex-col overflow-hidden"
      >
        {right}
      </div>
    </div>
  );
};
