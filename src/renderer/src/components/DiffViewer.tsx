import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface DiffViewerProps {
  filePath: string;
  onClose: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ filePath, onClose }) => {
  const [diff, setDiff] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiff();
  }, [filePath]);

  const loadDiff = async () => {
    try {
      setLoading(true);
      const { diff: diffText } = await (window as any).api.invoke('Git.GetDiff', { filePath });
      setDiff(diffText);
    } catch (err) {
      console.error('Failed to load diff:', err);
      setDiff('Failed to load diff');
    } finally {
      setLoading(false);
    }
  };

  const parseDiff = (diffText: string) => {
    const lines = diffText.split('\n');
    const parsedLines: Array<{ type: 'add' | 'remove' | 'context' | 'header'; content: string }> = [];

    for (const line of lines) {
      if (line.startsWith('@@')) {
        parsedLines.push({ type: 'header', content: line });
      } else if (line.startsWith('+')) {
        parsedLines.push({ type: 'add', content: line.substring(1) });
      } else if (line.startsWith('-')) {
        parsedLines.push({ type: 'remove', content: line.substring(1) });
      } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
        parsedLines.push({ type: 'header', content: line });
      } else {
        parsedLines.push({ type: 'context', content: line });
      }
    }

    return parsedLines;
  };

  const getLineClass = (type: string) => {
    switch (type) {
      case 'add':
        return 'bg-green-900/30 text-green-300';
      case 'remove':
        return 'bg-red-900/30 text-red-300';
      case 'header':
        return 'bg-blue-900/30 text-blue-300 font-semibold';
      case 'context':
        return 'text-gray-400';
      default:
        return '';
    }
  };

  const parsedDiff = diff ? parseDiff(diff) : [];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-11/12 h-5/6 max-w-6xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            Diff: {filePath}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Loading diff...
            </div>
          ) : parsedDiff.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              No changes
            </div>
          ) : (
            <div className="font-mono text-sm">
              {parsedDiff.map((line, index) => (
                <div
                  key={index}
                  className={`px-4 py-1 ${getLineClass(line.type)}`}
                >
                  <span className="inline-block w-8 text-gray-600 select-none mr-4">
                    {index + 1}
                  </span>
                  <span className={line.type === 'add' ? 'before:content-["+"] before:mr-2' : line.type === 'remove' ? 'before:content-["-"] before:mr-2' : ''}>
                    {line.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
