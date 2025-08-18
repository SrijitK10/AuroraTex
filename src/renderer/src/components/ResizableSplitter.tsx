import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ResizableSplitterProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSplit?: number; // percentage (0-100)
  minLeft?: number; // minimum width in pixels
  minRight?: number; // minimum width in pixels
  className?: string;
}

export const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  left,
  right,
  defaultSplit = 50,
  minLeft = 200,
  minRight = 200,
  className = '',
}) => {
  const [split, setSplit] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);
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
      
      // Calculate new split percentage
      let newSplit = (mouseX / containerWidth) * 100;
      
      // Apply minimum constraints
      const minLeftPercent = (minLeft / containerWidth) * 100;
      const minRightPercent = (minRight / containerWidth) * 100;
      
      newSplit = Math.max(minLeftPercent, Math.min(100 - minRightPercent, newSplit));
      
      setSplit(newSplit);
    },
    [isDragging, minLeft, minRight]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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
        style={{ width: `${split}%` }}
        className="flex flex-col overflow-hidden"
      >
        {left}
      </div>
      
      {/* Resizer */}
      <div
        className={`w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors duration-150 relative group ${
          isDragging ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        {/* Visual indicator dots */}
        <div className="absolute inset-y-0 left-0 w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-0.5 h-8 bg-white rounded-full shadow-sm flex flex-col justify-center items-center space-y-0.5">
            <div className="w-0.5 h-0.5 bg-gray-600 rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-gray-600 rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-gray-600 rounded-full"></div>
          </div>
        </div>
      </div>
      
      {/* Right panel */}
      <div 
        style={{ width: `${100 - split}%` }}
        className="flex flex-col overflow-hidden"
      >
        {right}
      </div>
    </div>
  );
};
