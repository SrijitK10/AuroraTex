import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source to use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.js', import.meta.url).toString();

interface PDFViewerProps {
  projectId: string | null;
  refreshTrigger?: number;
  compilationStatus?: 'idle' | 'compiling' | 'success' | 'error';
}

interface PDFViewState {
  currentPage: number;
  scale: number;
  scrollTop: number;
  scrollLeft: number;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ 
  projectId, 
  refreshTrigger = 0, 
  compilationStatus = 'idle' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2); // Start with a slightly higher scale for better readability
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Milestone 13: PDF state preservation for incremental refresh
  const [savedViewState, setSavedViewState] = useState<PDFViewState | null>(null);
  const [lastPdfModTime, setLastPdfModTime] = useState<number | null>(null);
  const [isIncrementalRefresh, setIsIncrementalRefresh] = useState(false);

  // Milestone 13: Save current view state for incremental refresh
  const saveViewState = useCallback(() => {
    if (containerRef.current) {
      const state: PDFViewState = {
        currentPage,
        scale,
        scrollTop: containerRef.current.scrollTop,
        scrollLeft: containerRef.current.scrollLeft
      };
      setSavedViewState(state);
      console.log('PDF view state saved:', state);
    }
  }, [currentPage, scale]);

  // Milestone 13: Restore view state after incremental refresh
  const restoreViewState = useCallback(() => {
    if (savedViewState && containerRef.current && !loading) {
      setTimeout(() => {
        if (containerRef.current) {
          setCurrentPage(savedViewState.currentPage);
          setScale(savedViewState.scale);
          containerRef.current.scrollTop = savedViewState.scrollTop;
          containerRef.current.scrollLeft = savedViewState.scrollLeft;
          console.log('PDF view state restored:', savedViewState);
          setIsIncrementalRefresh(false);
        }
      }, 100); // Small delay to ensure PDF is rendered
    }
  }, [savedViewState, loading]);

  const loadPDF = async (isIncremental = false) => {
    if (!projectId) {
      console.log('No projectId provided, skipping PDF load');
      return;
    }

    try {
      console.log(`Loading PDF for project ${projectId}, incremental: ${isIncremental}`);
      setLoading(true);
      setError(null);
      
      // Milestone 13: Save view state before refresh if this might be incremental
      if (isIncremental && pdfDoc) {
        saveViewState();
        setIsIncrementalRefresh(true);
      }
      
      const pdfUrl = await window.electronAPI.projectOutputPath({
        projectId,
        file: 'main.pdf'
      });

      console.log('Loading PDF from:', pdfUrl);
      
      // Check if file exists and get modification time for incremental detection
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error('PDF file not found');
      }

      // Try to get last modified time for incremental refresh detection
      const lastModified = response.headers.get('last-modified');
      const modTime = lastModified ? new Date(lastModified).getTime() : Date.now();
      
      // Milestone 13: Check if this is truly an incremental change
      const isReallyIncremental = lastPdfModTime && Math.abs(modTime - lastPdfModTime) < 5000; // Within 5 seconds
      
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setLastPdfModTime(modTime);
      
      // Milestone 13: Only reset page if not incremental or if page count changed
      if (!isReallyIncremental || totalPages !== pdf.numPages) {
        setCurrentPage(1);
        console.log('PDF loaded - resetting to page 1 due to structural changes');
      } else {
        console.log('PDF loaded - preserving current page for incremental refresh');
      }
      
      console.log('PDF loaded successfully:', pdf.numPages, 'pages', isReallyIncremental ? '(incremental)' : '(full refresh)');
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError('PDF not found. Compile your LaTeX project first.');
      setIsIncrementalRefresh(false);
    } finally {
      setLoading(false);
    }
  };

  // Show message when no project is selected
  if (!projectId) {
    return (
      <div className="h-full flex flex-col bg-white border-l border-gray-200">
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-900">PDF Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center bg-gray-100">
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium">No project selected</p>
            <p className="text-sm">Open a project to view PDF preview</p>
          </div>
        </div>
      </div>
    );
  }

  const renderPage = async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      
      // Get device pixel ratio for high-DPI displays (retina, etc.)
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Always render at base scale (1.2) since we use CSS transform for zoom
      const baseScale = 1.2;
      const effectiveScale = baseScale * devicePixelRatio;
      
      // Get viewport with the effective scale
      const viewport = page.getViewport({ scale: effectiveScale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) return;
      
      // Set canvas internal size to the high-resolution size
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Set canvas display size to the normal size (scaled down for retina)
      canvas.style.height = `${viewport.height / devicePixelRatio}px`;
      canvas.style.width = `${viewport.width / devicePixelRatio}px`;
      
      // Scale the drawing context to account for device pixel ratio
      context.scale(devicePixelRatio, devicePixelRatio);
      
      // Clear the canvas before rendering
      context.clearRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);
      
      // Enable image smoothing for better quality
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      
      const renderContext = {
        canvasContext: context,
        viewport: page.getViewport({ scale: baseScale }), // Use base scale for rendering context
      };
      
      const renderTask = page.render(renderContext);
      await renderTask.promise;
      
      console.log(`Rendered page ${pageNum} at base scale ${baseScale} with DPR ${devicePixelRatio}, visual zoom: ${scale} (${viewport.width}x${viewport.height})`);
    } catch (err) {
      console.error('Error rendering page:', err);
      setError('Failed to render PDF page');
    }
  };

  useEffect(() => {
    loadPDF();
  }, [projectId]);

  // Handle window resize to re-render at correct DPI
  useEffect(() => {
    const handleResize = () => {
      // Re-render current page when window is resized (DPI might change)
      if (pdfDoc && currentPage) {
        setTimeout(() => renderPage(currentPage), 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdfDoc, currentPage]);

  // Respond to external refresh triggers (from compile success)
  useEffect(() => {
    if (refreshTrigger > 0 && projectId) {
      console.log(`PDF refresh triggered by compilation - trigger: ${refreshTrigger}`);
      loadPDF(true); // Mark as potentially incremental
    }
  }, [refreshTrigger, projectId]);

  useEffect(() => {
    console.log(`Page or document changed - pdfDoc exists: ${!!pdfDoc}, currentPage: ${currentPage}`);
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
      
      // Milestone 13: Restore view state after rendering if this was incremental
      if (isIncrementalRefresh) {
        restoreViewState();
      }
    }
  }, [pdfDoc, currentPage, isIncrementalRefresh, restoreViewState]);

  // Auto-refresh every 5 seconds to pick up new PDFs (less frequent now since we have triggers)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !error && projectId) {
        loadPDF();
      }
    }, 10000); // Reduced to 10 seconds since we have direct triggers

    return () => clearInterval(interval);
  }, [projectId, loading, error]);

  const goToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  const zoomIn = () => {
    const newScale = Math.min(scale + 0.2, 4.0); // Increased max zoom and increment
    console.log(`Zoom in: ${scale} -> ${newScale}`);
    setScale(newScale);
  };

  const zoomOut = () => {
    const newScale = Math.max(scale - 0.2, 0.4); // Better increment and minimum
    console.log(`Zoom out: ${scale} -> ${newScale}`);
    setScale(newScale);
  };

  const resetZoom = () => {
    console.log(`Reset zoom: ${scale} -> 1.2`);
    setScale(1.2); // Reset to the new default scale
  };

  // Add keyboard shortcut support for zoom (like VS Code)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if the PDF viewer container is focused or contains the active element
      if (containerRef.current && (containerRef.current.contains(document.activeElement) || document.activeElement === containerRef.current)) {
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey) {
          if (event.key === '=' || event.key === '+') {
            event.preventDefault();
            zoomIn();
          } else if (event.key === '-') {
            event.preventDefault();
            zoomOut();
          } else if (event.key === '0') {
            event.preventDefault();
            resetZoom();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scale]);

  // Make the container focusable for keyboard shortcuts
  const handleContainerClick = () => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* PDF Header */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-900">PDF Preview</h3>
          <div className="flex items-center space-x-2">
            {/* Compilation Status Indicator */}
            {compilationStatus === 'compiling' && (
              <div className="flex items-center text-xs text-blue-600">
                <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1"></div>
                Compiling...
              </div>
            )}
            {compilationStatus === 'success' && (
              <div className="flex items-center text-xs text-green-600">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Compiled
              </div>
            )}
            {compilationStatus === 'error' && (
              <div className="flex items-center text-xs text-red-600">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Error
              </div>
            )}
            {loading && (
              <div className="flex items-center text-xs text-blue-600">
                <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1"></div>
                Refreshing...
              </div>
            )}
            <button
              onClick={() => loadPDF(false)}
              disabled={loading}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="Refresh PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Controls under PDF Preview */}
        {pdfDoc && (
          <div className="flex items-center space-x-2 text-sm">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <span className="text-gray-600">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* PDF Content */}
      <div 
        ref={containerRef} 
        className="flex-1 bg-gray-100 overflow-auto relative p-4"
        tabIndex={0}
        onClick={handleContainerClick}
        style={{ 
          outline: 'none',
          scrollbarWidth: 'auto',
          scrollbarColor: '#cbd5e1 #f1f5f9'
        }}
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-600">Loading PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600 mb-2">{error}</p>
              <button
                onClick={() => loadPDF(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {pdfDoc && !loading && !error && (
          <div 
            className="flex justify-center"
            style={{ 
              minWidth: 'fit-content', 
              minHeight: 'fit-content',
              width: 'max-content',
              margin: '0 auto'
            }}
          >
            <div style={{ transform: `scale(${scale / 1.2})`, transformOrigin: 'center top' }}>
              <canvas
                ref={canvasRef}
                className="shadow-lg border border-gray-300 bg-white"
                style={{ 
                  display: 'block',
                  imageRendering: 'crisp-edges' as any
                }}
              />
            </div>
          </div>
        )}

        {/* Zoom Controls - Bottom Left */}
        {pdfDoc && !loading && !error && (
          <div className="absolute bottom-4 left-4 flex items-center space-x-1 bg-white border border-gray-300 rounded-lg shadow-md px-2 py-1 z-10">
            <button
              onClick={zoomOut}
              className="p-1 rounded hover:bg-gray-100 text-gray-600"
              title="Zoom Out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>

            <span className="text-xs text-gray-500 w-12 text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={zoomIn}
              className="p-1 rounded hover:bg-gray-100 text-gray-600"
              title="Zoom In"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>

            <button
              onClick={resetZoom}
              className="p-1 rounded hover:bg-gray-100 text-gray-600 text-xs"
              title="Reset Zoom (120%)"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
