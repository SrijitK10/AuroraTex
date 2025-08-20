import React, { useState, useRef, useEffect, useCallback } from 'react';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  mtime?: string;
  children?: FileNode[];
}

interface QuickFileSearchProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileNode[];
  onFileSelect: (path: string) => void;
  projectName?: string;
}

// Flatten file tree for searching
const flattenFiles = (files: FileNode[], path: string = ''): Array<{ path: string; name: string; type: 'file' | 'directory' }> => {
  const result: Array<{ path: string; name: string; type: 'file' | 'directory' }> = [];
  
  files.forEach(file => {
    const fullPath = path ? `${path}/${file.name}` : file.name;
    result.push({ 
      path: file.path || fullPath, 
      name: file.name, 
      type: file.type 
    });
    
    if (file.type === 'directory' && file.children) {
      result.push(...flattenFiles(file.children, fullPath));
    }
  });
  
  return result;
};

// Fuzzy search function
const fuzzySearch = (query: string, text: string): { score: number; matches: number[] } => {
  if (!query) return { score: 0, matches: [] };
  
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  let score = 0;
  let queryIndex = 0;
  const matches: number[] = [];
  
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matches.push(i);
      score += 1;
      queryIndex++;
      
      // Bonus for consecutive matches
      if (i > 0 && matches.includes(i - 1)) {
        score += 0.5;
      }
      
      // Bonus for word start matches
      if (i === 0 || textLower[i - 1] === '/' || textLower[i - 1] === ' ') {
        score += 1;
      }
    }
  }
  
  // Penalty for unmatched query characters
  if (queryIndex < queryLower.length) {
    return { score: 0, matches: [] };
  }
  
  // Bonus for exact matches
  if (textLower.includes(queryLower)) {
    score += 3;
  }
  
  // Penalty for length difference
  score -= Math.abs(text.length - query.length) * 0.01;
  
  return { score, matches };
};

const HighlightedText: React.FC<{ text: string; matches: number[] }> = ({ text, matches }) => {
  if (matches.length === 0) {
    return <span>{text}</span>;
  }
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  matches.forEach((index, i) => {
    // Add text before the match
    if (index > lastIndex) {
      parts.push(
        <span key={`text-${i}`} className="text-gray-600">
          {text.slice(lastIndex, index)}
        </span>
      );
    }
    
    // Add the highlighted character
    parts.push(
      <span key={`match-${i}`} className="bg-yellow-200 text-gray-900 font-medium">
        {text[index]}
      </span>
    );
    
    lastIndex = index + 1;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key="text-end" className="text-gray-600">
        {text.slice(lastIndex)}
      </span>
    );
  }
  
  return <span>{parts}</span>;
};

export const QuickFileSearch: React.FC<QuickFileSearchProps> = ({
  isOpen,
  onClose,
  files,
  onFileSelect,
  projectName
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  
  // Flatten and search files
  const flatFiles = React.useMemo(() => flattenFiles(files), [files]);
  
  const searchResults = React.useMemo(() => {
    if (!query.trim()) {
      return flatFiles.slice(0, 20).map(file => ({
        ...file,
        score: 0,
        nameMatches: [] as number[],
        pathMatches: [] as number[]
      })); // Show first 20 files when no query
    }
    
    const results = flatFiles
      .map(file => {
        const nameSearch = fuzzySearch(query, file.name);
        const pathSearch = fuzzySearch(query, file.path);
        const bestScore = Math.max(nameSearch.score, pathSearch.score);
        
        return {
          ...file,
          score: bestScore,
          nameMatches: nameSearch.matches,
          pathMatches: pathSearch.matches
        };
      })
      .filter(file => file.score > 0)
      .sort((a, b) => {
        // Sort by score (descending), then by file type (files first), then by name length
        if (a.score !== b.score) return b.score - a.score;
        if (a.type !== b.type) return a.type === 'file' ? -1 : 1;
        return a.name.length - b.name.length;
      })
      .slice(0, 10); // Limit to 10 results
    
    return results;
  }, [query, flatFiles]);
  
  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (selectedItemRef.current && resultsRef.current) {
      const selectedElement = selectedItemRef.current;
      const container = resultsRef.current;
      
      const selectedRect = selectedElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // Check if the selected item is visible in the container
      const isAboveView = selectedRect.top < containerRect.top;
      const isBelowView = selectedRect.bottom > containerRect.bottom;
      
      if (isAboveView || isBelowView) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }, [selectedIndex]);
  
  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => {
            const newIndex = Math.min(prev + 1, searchResults.length - 1);
            return newIndex;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => {
            const newIndex = Math.max(prev - 1, 0);
            return newIndex;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (searchResults[selectedIndex]) {
            onFileSelect(searchResults[selectedIndex].path);
            onClose();
          }
          break;
        case 'Tab':
          e.preventDefault();
          // Tab behaves like ArrowDown
          setSelectedIndex(prev => {
            const newIndex = Math.min(prev + 1, searchResults.length - 1);
            return newIndex;
          });
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, selectedIndex, onFileSelect, onClose]);
  
  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);
  
  const getFileIcon = (filename: string, type: 'file' | 'directory') => {
    if (type === 'directory') return '📁';
    
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tex': return '📄';
      case 'bib': return '📚';
      case 'pdf': return '📕';
      case 'png':
      case 'jpg':
      case 'jpeg': return '🖼️';
      case 'cls':
      case 'sty': return '⚙️';
      default: return '📄';
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-96 flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search files in ${projectName || 'project'}...`}
              className="flex-1 text-lg outline-none placeholder-gray-400"
            />
            <div className="text-xs text-gray-400 hidden sm:flex items-center space-x-1">
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">↑↓</kbd>
              <span>navigate</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd>
              <span>next</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">↵</kbd>
              <span>select</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">esc</kbd>
              <span>close</span>
            </div>
          </div>
        </div>
        
        {/* Results */}
        <div 
          ref={resultsRef}
          className="flex-1 overflow-y-auto max-h-80"
          style={{ scrollBehavior: 'smooth' }}
        >
          {searchResults.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {query.trim() ? (
                <>
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No files found matching "{query}"</p>
                </>
              ) : (
                <>
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p>Start typing to search files...</p>
                </>
              )}
            </div>
          ) : (
            <div className="py-2">
              {searchResults.map((file, index) => (
                <button
                  key={file.path}
                  ref={index === selectedIndex ? selectedItemRef : null}
                  onClick={() => {
                    onFileSelect(file.path);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 border-l-4 transition-colors duration-150 ${
                    index === selectedIndex
                      ? 'bg-blue-50 border-l-blue-500 ring-2 ring-blue-200 ring-inset'
                      : 'border-l-transparent'
                  }`}
                >
                  <span className="text-lg">{getFileIcon(file.name, file.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      <HighlightedText text={file.name} matches={file.nameMatches} />
                    </div>
                    {file.path !== file.name && (
                      <div className="text-xs text-gray-500 truncate mt-1">
                        <HighlightedText text={file.path} matches={file.pathMatches} />
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 capitalize">
                    {file.type}
                  </div>
                  {index === selectedIndex && (
                    <div className="text-blue-500">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        {searchResults.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500 bg-gray-50">
            {searchResults.length} {searchResults.length === 1 ? 'file' : 'files'} found
            {query.trim() && flatFiles.length > 10 && (
              <span className="ml-2">(showing first 10 results)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
