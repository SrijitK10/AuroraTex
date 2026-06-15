import React, { useState, useEffect, useCallback } from 'react';
import { X, Columns, AlignLeft } from 'lucide-react';

interface DiffViewerProps {
  filePath: string;
  staged?: boolean;
  onClose: () => void;
}

type DiffLine = {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldLine?: number;
  newLine?: number;
};

export const DiffViewer: React.FC<DiffViewerProps> = ({ filePath, staged = false, onClose }) => {
  const [diff, setDiff] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  const loadDiff = useCallback(async () => {
    try {
      setLoading(true);
      const { diff: diffText } = await window.electronAPI.invoke('Git.GetFileDiff', {
        filePath,
        staged,
      });
      setDiff(diffText || '');
    } catch (err) {
      console.error('Failed to load diff:', err);
      setDiff('Failed to load diff');
    } finally {
      setLoading(false);
    }
  }, [filePath, staged]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  const parseDiff = (diffText: string): DiffLine[] => {
    const lines = diffText.split('\n');
    const parsed: DiffLine[] = [];
    let oldLine = 0;
    let newLine = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Parse hunk header for line numbers
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        parsed.push({ type: 'header', content: line });
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        parsed.push({ type: 'add', content: line.substring(1), newLine: newLine++ });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        parsed.push({ type: 'remove', content: line.substring(1), oldLine: oldLine++ });
      } else if (
        line.startsWith('diff') ||
        line.startsWith('index') ||
        line.startsWith('---') ||
        line.startsWith('+++')
      ) {
        parsed.push({ type: 'header', content: line });
      } else {
        parsed.push({
          type: 'context',
          content: line.startsWith(' ') ? line.substring(1) : line,
          oldLine: oldLine++,
          newLine: newLine++,
        });
      }
    }

    return parsed;
  };

  const getLineStyle = (type: string): React.CSSProperties => {
    switch (type) {
      case 'add':
        return { background: 'rgba(22,163,74,0.12)', color: '#4ade80' };
      case 'remove':
        return { background: 'rgba(220,38,38,0.12)', color: '#f87171' };
      case 'header':
        return { background: 'rgba(59,130,246,0.08)', color: '#60a5fa', fontWeight: 600 };
      case 'context':
      default:
        return { color: '#9ca3af' };
    }
  };

  const parsedDiff = diff ? parseDiff(diff) : [];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-xl shadow-2xl w-11/12 h-5/6 max-w-6xl flex flex-col border border-gray-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">
              {filePath}
            </h2>
            {staged && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/30">
                Staged
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('unified')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'unified'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Unified view"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'split'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Side-by-side view"
              >
                <Columns className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Loading diff...
            </div>
          ) : parsedDiff.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              No changes
            </div>
          ) : viewMode === 'unified' ? (
            /* ─── Unified View ─── */
            <div className="font-mono text-xs leading-5">
              {parsedDiff.map((line, index) => {
                const style = getLineStyle(line.type);
                const prefix =
                  line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

                return (
                  <div
                    key={index}
                    style={{
                      ...style,
                      display: 'flex',
                      minHeight: 20,
                      whiteSpace: 'pre',
                    }}
                  >
                    {line.type !== 'header' && (
                      <>
                        <span
                          className="text-gray-600 select-none"
                          style={{
                            width: 48,
                            textAlign: 'right',
                            paddingRight: 8,
                            flexShrink: 0,
                            borderRight: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          {line.oldLine ?? ''}
                        </span>
                        <span
                          className="text-gray-600 select-none"
                          style={{
                            width: 48,
                            textAlign: 'right',
                            paddingRight: 8,
                            flexShrink: 0,
                            borderRight: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          {line.newLine ?? ''}
                        </span>
                        <span
                          className="select-none"
                          style={{
                            width: 16,
                            textAlign: 'center',
                            flexShrink: 0,
                            color: line.type === 'add' ? '#4ade80' : line.type === 'remove' ? '#f87171' : '#6b7280',
                          }}
                        >
                          {prefix}
                        </span>
                      </>
                    )}
                    <span style={{ paddingLeft: line.type === 'header' ? 16 : 8, flex: 1 }}>
                      {line.content}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ─── Split View ─── */
            <div style={{ display: 'flex', minHeight: '100%' }}>
              {/* Left (old) */}
              <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.08)', overflow: 'auto' }}>
                <div className="font-mono text-xs leading-5">
                  {parsedDiff
                    .filter((l) => l.type !== 'add')
                    .map((line, i) => {
                      const style = getLineStyle(line.type === 'remove' ? 'remove' : line.type);
                      return (
                        <div key={i} style={{ ...style, display: 'flex', minHeight: 20, whiteSpace: 'pre' }}>
                          {line.type !== 'header' && (
                            <span className="text-gray-600 select-none" style={{ width: 48, textAlign: 'right', paddingRight: 8, flexShrink: 0 }}>
                              {line.oldLine ?? ''}
                            </span>
                          )}
                          <span style={{ paddingLeft: line.type === 'header' ? 8 : 8, flex: 1 }}>
                            {line.type === 'remove' ? '-' : ' '} {line.content}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
              {/* Right (new) */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                <div className="font-mono text-xs leading-5">
                  {parsedDiff
                    .filter((l) => l.type !== 'remove')
                    .map((line, i) => {
                      const style = getLineStyle(line.type === 'add' ? 'add' : line.type);
                      return (
                        <div key={i} style={{ ...style, display: 'flex', minHeight: 20, whiteSpace: 'pre' }}>
                          {line.type !== 'header' && (
                            <span className="text-gray-600 select-none" style={{ width: 48, textAlign: 'right', paddingRight: 8, flexShrink: 0 }}>
                              {line.newLine ?? ''}
                            </span>
                          )}
                          <span style={{ paddingLeft: line.type === 'header' ? 8 : 8, flex: 1 }}>
                            {line.type === 'add' ? '+' : ' '} {line.content}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700/50">
          <div className="text-xs text-gray-500">
            {parsedDiff.filter((l) => l.type === 'add').length} additions,{' '}
            {parsedDiff.filter((l) => l.type === 'remove').length} deletions
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
