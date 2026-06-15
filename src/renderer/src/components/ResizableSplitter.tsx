import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ResizableSplitterProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSplit?: number;
  minLeft?: number;
  minRight?: number;
  className?: string;
  collapseThreshold?: number;
  onLeftCollapse?: (collapsed: boolean) => void;
  leftCollapsed?: boolean;
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
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(Boolean(leftCollapsed));
  const [lastSplitBeforeCollapse, setLastSplitBeforeCollapse] = useState(defaultSplit);
  const [isNearCollapseThreshold, setIsNearCollapseThreshold] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef(defaultSplit);
  const dragFrameRef = useRef<number | null>(null);
  const pendingMouseXRef = useRef<number | null>(null);

  useEffect(() => {
    splitRef.current = split;
  }, [split]);

  const clampSplit = useCallback((requestedSplit: number, containerWidth: number) => {
    if (containerWidth <= 0) return requestedSplit;

    const minLeftPercent = (minLeft / containerWidth) * 100;
    const maxLeftPercent = 100 - (minRight / containerWidth) * 100;

    return Math.max(minLeftPercent, Math.min(maxLeftPercent, requestedSplit));
  }, [minLeft, minRight]);

  const updateFromMousePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const containerWidth = rect.width;
    const rawLeftWidth = clientX - rect.left;

    if (rawLeftWidth < collapseThreshold && !isLeftCollapsed) {
      setLastSplitBeforeCollapse(splitRef.current);
      setIsLeftCollapsed(true);
      setIsNearCollapseThreshold(false);
      onLeftCollapse?.(true);
      return;
    }

    if (rawLeftWidth >= collapseThreshold && isLeftCollapsed) {
      setIsLeftCollapsed(false);
      onLeftCollapse?.(false);
    }

    const nextSplit = clampSplit((rawLeftWidth / containerWidth) * 100, containerWidth);
    const nearCollapse = rawLeftWidth < collapseThreshold * 1.5 && !isLeftCollapsed;

    setIsNearCollapseThreshold(nearCollapse);

    if (!isLeftCollapsed || rawLeftWidth >= collapseThreshold) {
      setSplit(nextSplit);
    }
  }, [clampSplit, collapseThreshold, isLeftCollapsed, onLeftCollapse]);

  const flushPendingDrag = useCallback(() => {
    dragFrameRef.current = null;

    if (pendingMouseXRef.current === null) return;
    updateFromMousePosition(pendingMouseXRef.current);
  }, [updateFromMousePosition]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging) return;

    pendingMouseXRef.current = event.clientX;

    if (dragFrameRef.current === null) {
      dragFrameRef.current = window.requestAnimationFrame(flushPendingDrag);
    }
  }, [flushPendingDrag, isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsNearCollapseThreshold(false);

    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
  }, []);

  const handleExpandClick = useCallback(() => {
    if (!isLeftCollapsed) return;

    setIsLeftCollapsed(false);
    setSplit(lastSplitBeforeCollapse);
    onLeftCollapse?.(false);
  }, [isLeftCollapsed, lastSplitBeforeCollapse, onLeftCollapse]);

  useEffect(() => {
    if (leftCollapsed === undefined || leftCollapsed === isLeftCollapsed) {
      return;
    }

    if (leftCollapsed) {
      setLastSplitBeforeCollapse(splitRef.current);
      setIsLeftCollapsed(true);
      return;
    }

    setIsLeftCollapsed(false);
    setSplit(lastSplitBeforeCollapse);
  }, [isLeftCollapsed, lastSplitBeforeCollapse, leftCollapsed]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (!width || isLeftCollapsed) return;

      const nextSplit = clampSplit(splitRef.current, width);
      if (Math.abs(nextSplit - splitRef.current) > 0.01) {
        setSplit(nextSplit);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [clampSplit, isLeftCollapsed]);

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

      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
    };
  }, [handleMouseMove, handleMouseUp, isDragging]);

  return (
    <div
      ref={containerRef}
      className={`flex h-full min-w-0 ${className}`}
    >
      <div
        className={`flex flex-col overflow-hidden min-w-0 ${isDragging ? '' : 'transition-[flex-basis] duration-150 ease-out'}`}
        style={{
          flex: isLeftCollapsed ? '0 0 0px' : `0 0 ${split}%`,
          minWidth: isLeftCollapsed ? '0px' : `${minLeft}px`
        }}
      >
        {!isLeftCollapsed && left}
      </div>

      <div
        className={`relative w-1.5 flex-shrink-0 transition-colors duration-150 group ${
          isLeftCollapsed
            ? 'bg-blue-400 hover:bg-blue-500 cursor-pointer'
            : isNearCollapseThreshold
              ? 'bg-orange-400 hover:bg-orange-500 cursor-col-resize'
              : isDragging
                ? 'bg-blue-500'
                : 'bg-gray-300 dark:bg-gray-700 hover:bg-blue-400 cursor-col-resize'
        }`}
        onMouseDown={isLeftCollapsed ? undefined : handleMouseDown}
        onClick={isLeftCollapsed ? handleExpandClick : undefined}
        style={{ cursor: isLeftCollapsed ? 'pointer' : 'col-resize' }}
      >
        <div className={`absolute inset-y-0 left-0 w-full flex items-center justify-center transition-opacity ${
          isLeftCollapsed ? 'opacity-70 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          {isLeftCollapsed ? (
            <div className="w-1.5 h-9 bg-blue-500 rounded-full shadow-sm flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          ) : (
            <div className="w-0.5 h-8 bg-white dark:bg-gray-600 rounded-full shadow-sm flex flex-col justify-center items-center gap-0.5">
              <div className="w-0.5 h-0.5 bg-gray-600 dark:bg-gray-400 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-gray-600 dark:bg-gray-400 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-gray-600 dark:bg-gray-400 rounded-full"></div>
            </div>
          )}
        </div>
      </div>

      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        style={{ minWidth: `${minRight}px` }}
      >
        {right}
      </div>
    </div>
  );
};
