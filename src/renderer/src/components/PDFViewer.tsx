import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.js', import.meta.url).toString();

interface PDFViewerProps {
  projectId: string | null;
  refreshTrigger?: number;
  compilationStatus?: 'idle' | 'compiling' | 'success' | 'error';
  onSyncTexResult?: (result: { file: string; line: number; column?: number }) => void;
}

const DEFAULT_SCALE = 1.2;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SCALE_STEP = 0.2;

// --- PDF Page Component ---
const PDFPage: React.FC<{
  doc: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  scale: number;
  projectId: string | null;
  onSyncTexResult?: (result: { file: string; line: number; column?: number }) => void;
}> = ({ doc, pageNum, scale, projectId, onSyncTexResult }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  
  const [isVisible, setIsVisible] = useState(false);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  // 1. Fetch unscaled dimensions immediately so container occupies correct space
  useEffect(() => {
    let isMounted = true;
    doc.getPage(pageNum).then(page => {
      if (!isMounted) return;
      const viewport = page.getViewport({ scale: 1 });
      setPageSize({ width: viewport.width, height: viewport.height });
    }).catch(err => console.warn(`Failed to get size for page ${pageNum}`, err));
    return () => { isMounted = false; };
  }, [doc, pageNum]);

  // 2. Intersection Observer to detect when page is near viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
        }
      },
      { rootMargin: '800px 0px' }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  // 3. Render PDF Canvas and TextLayer when visible or scale changes
  useEffect(() => {
    if (!isVisible || !pageSize) return;

    let isMounted = true;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch (e) {}
        }

        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        
        const canvas = canvasRef.current;
        if (!canvas || !isMounted) return;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        const renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
        });

        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;

        if (!isMounted) return;

        if (textLayerRef.current) {
          const textLayerDiv = textLayerRef.current;
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${viewport.width}px`;
          textLayerDiv.style.height = `${viewport.height}px`;
          textLayerDiv.style.setProperty('--scale-factor', `${viewport.scale}`);

          const textContent = await page.getTextContent();
          if (!isMounted) return;

          const textLayerTask = pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
            textDivs: []
          });
          
          await textLayerTask.promise;
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      }
    };

    requestAnimationFrame(() => renderPage());

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (e) {}
      }
    };
  }, [doc, pageNum, scale, isVisible, pageSize]);

  const handleDoubleClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!projectId || !onSyncTexResult || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const xCSS = event.clientX - rect.left;
    const yCSS = event.clientY - rect.top;

    const ptX = xCSS / scale;
    const ptY = yCSS / scale;

    console.log(`[PDFViewer] Double-clicked page ${pageNum} at CSS: (${xCSS}, ${yCSS}), pt: (${ptX}, ${ptY})`);

    try {
      const result = await window.electronAPI.syncTexInverseSearch({
        projectId,
        page: pageNum,
        x: ptX,
        y: ptY
      });
      if (result) {
        onSyncTexResult(result);
      }
    } catch (err) {
      console.error('Inverse search failed:', err);
    }
  };

  // The container is sized by the canvas itself — no explicit width/height on the wrapper.
  // This means the wrapper always hugs the canvas tightly with zero white border.
  return (
    <div 
      ref={containerRef}
      className="pdf-page-container"
      onDoubleClick={handleDoubleClick}
      style={{
        position: 'relative',
        display: 'inline-block',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        background: '#fff',
        lineHeight: 0, // eliminates inline-block baseline gap
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', cursor: 'crosshair' }} />
      <div 
        ref={textLayerRef} 
        className="textLayer" 
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
      />
    </div>
  );
};

// --- Main PDFViewer Component ---
export const PDFViewer: React.FC<PDFViewerProps> = ({
  projectId,
  refreshTrigger = 0,
  compilationStatus = 'idle',
  onSyncTexResult
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLoadIdRef = useRef(0);
  const loadTaskRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanupDocument = useCallback(async (doc: pdfjsLib.PDFDocumentProxy | null) => {
    if (!doc) return;
    try { await doc.cleanup(); } catch (err) {}
    try { await doc.destroy(); } catch (err) {}
  }, []);

  const loadPDF = useCallback(async (preserveView: boolean) => {
    if (!projectId) return;

    const loadId = activeLoadIdRef.current + 1;
    activeLoadIdRef.current = loadId;

    setLoading(true);
    setError(null);

    // Save scroll position
    const scrollTop = preserveView && scrollContainerRef.current ? scrollContainerRef.current.scrollTop : 0;
    const scrollLeft = preserveView && scrollContainerRef.current ? scrollContainerRef.current.scrollLeft : 0;

    try {
      if (loadTaskRef.current) {
        try { loadTaskRef.current.destroy(); } catch (e) {}
        loadTaskRef.current = null;
      }

      const pdfUrl = await window.electronAPI.projectOutputPath({
        projectId,
        file: 'main.pdf'
      });

      const response = await fetch(pdfUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('PDF file not found.');

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer.byteLength) throw new Error('PDF file is empty.');

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        useWorkerFetch: false
      });
      loadTaskRef.current = loadingTask;

      const nextDoc = await loadingTask.promise;

      if (activeLoadIdRef.current !== loadId) {
        await cleanupDocument(nextDoc);
        return;
      }

      const previousDoc = pdfDoc;
      setPdfDoc(nextDoc);
      setTotalPages(nextDoc.numPages);

      // Restore scroll position after a slight delay to allow container to re-render
      if (preserveView && scrollContainerRef.current) {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollTop;
            scrollContainerRef.current.scrollLeft = scrollLeft;
          }
        });
      } else if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
        scrollContainerRef.current.scrollLeft = 0;
      }

      if (previousDoc && previousDoc !== nextDoc) {
        await cleanupDocument(previousDoc);
      }
    } catch (err) {
      console.error('Error loading PDF:', err);
      setPdfDoc(null);
      setTotalPages(0);
      setError('PDF not found. Compile your LaTeX project first.');
    } finally {
      if (activeLoadIdRef.current === loadId) {
        setLoading(false);
      }
    }
  }, [cleanupDocument, projectId, pdfDoc]);

  useEffect(() => {
    setScale(DEFAULT_SCALE);
    setTotalPages(0);
    setPdfDoc(null);

    if (projectId) {
      loadPDF(false);
    }

    return () => {
      activeLoadIdRef.current += 1;
    };
  }, [projectId]);

  // Refresh trigger handler
  useEffect(() => {
    if (refreshTrigger > 0 && projectId) {
      loadPDF(true);
    }
  }, [projectId, refreshTrigger]);

  // Zoom logic
  const applyScale = useCallback((nextScale: number) => {
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    if (Math.abs(clampedScale - scale) < 0.001) return;

    // Adjust scroll to keep the center of the viewer stable during zoom
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scaleRatio = clampedScale / scale;
      const centerX = container.scrollLeft + container.clientWidth / 2;
      const centerY = container.scrollTop + container.clientHeight / 2;

      setScale(clampedScale);

      // Set new scroll position after React re-renders with new scale
      requestAnimationFrame(() => {
        container.scrollTop = Math.max(0, centerY * scaleRatio - container.clientHeight / 2);
        container.scrollLeft = Math.max(0, centerX * scaleRatio - container.clientWidth / 2);
      });
    } else {
      setScale(clampedScale);
    }
  }, [scale]);

  const zoomIn = useCallback(() => applyScale(scale + SCALE_STEP), [applyScale, scale]);
  const zoomOut = useCallback(() => applyScale(scale - SCALE_STEP), [applyScale, scale]);
  const resetZoom = useCallback(() => applyScale(DEFAULT_SCALE), [applyScale]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!scrollContainerRef.current) return;
      const isViewerFocused =
        scrollContainerRef.current === document.activeElement ||
        scrollContainerRef.current.contains(document.activeElement);

      if (!isViewerFocused) return;

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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  const handleContainerClick = () => {
    scrollContainerRef.current?.focus();
  };

  const pagesArray = useMemo(() => Array.from({ length: totalPages }, (_, i) => i + 1), [totalPages]);

  if (!projectId) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800">
        <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">PDF Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900/50">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">No project selected</p>
            <p className="text-sm">Open a project to view PDF preview</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 min-w-0 relative">
      {/* Header bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-between">
        <h3 className="text-[13px] font-medium text-gray-900 dark:text-gray-100 m-0">PDF Preview</h3>
        <div className="flex items-center gap-2">
          {compilationStatus === 'compiling' && (
            <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
              <div className="animate-spin w-3 h-3 border border-blue-600 dark:border-blue-400 border-t-transparent rounded-full mr-1" />
              Compiling...
            </div>
          )}
          {compilationStatus === 'success' && (
            <div className="flex items-center text-xs text-green-600 dark:text-green-400">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Compiled
            </div>
          )}
          {compilationStatus === 'error' && (
            <div className="flex items-center text-xs text-red-600 dark:text-red-400">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Error
            </div>
          )}
          {loading && (
            <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
              <div className="animate-spin w-3 h-3 border border-blue-600 dark:border-blue-400 border-t-transparent rounded-full mr-1" />
              Refreshing...
            </div>
          )}
          <button
            onClick={() => loadPDF(Boolean(pdfDoc))}
            disabled={loading}
            title="Refresh PDF"
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-default"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable PDF area */}
      <div
        ref={scrollContainerRef}
        tabIndex={0}
        onClick={handleContainerClick}
        className="flex-1 min-h-0 overflow-auto bg-gray-200 dark:bg-gray-950 outline-none relative pdf-scroll-container"
      >
        {/* Inner wrapper that sizes to content and centers pages */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 0',
            // This minWidth/minHeight ensures the scroll container can scroll
            // when zoomed, but doesn't add any white border
            minWidth: 'fit-content',
          }}
        >
          {loading && !pdfDoc && (
            <div className="flex items-center justify-center h-full w-full py-20">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">Loading PDF...</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center justify-center h-full w-full py-20">
              <div className="text-center max-w-xs">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
                <button
                  onClick={() => loadPDF(Boolean(pdfDoc))}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white border-none rounded-md cursor-pointer text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {pdfDoc && !error && pagesArray.map(pageNum => (
            <PDFPage 
              key={`${pdfDoc.fingerprint}-${pageNum}`}
              doc={pdfDoc}
              pageNum={pageNum}
              scale={scale}
              projectId={projectId}
              onSyncTexResult={onSyncTexResult}
            />
          ))}
        </div>
      </div>

      {/* Zoom controls - fixed at the bottom of the PDF panel, always visible */}
      {pdfDoc && !error && (
        <div className="flex-shrink-0 flex items-center justify-center p-1.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 gap-0.5">
          <button
            onClick={zoomOut}
            title="Zoom Out (Cmd -)"
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300 flex items-center text-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-12 text-center select-none font-mono">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={zoomIn}
            title="Zoom In (Cmd +)"
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300 flex items-center text-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1.5" />

          <button
            onClick={resetZoom}
            title="Reset Zoom (Cmd 0)"
            className="px-2.5 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-medium"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
};
