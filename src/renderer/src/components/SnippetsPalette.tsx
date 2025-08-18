import React, { useState, useEffect, useRef } from 'react';

interface Snippet {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger: string;
  content: string;
  cursorPosition?: number;
}

interface SnippetsPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSnippet: (content: string, cursorPosition?: number) => void;
  className?: string;
}

export const SnippetsPalette: React.FC<SnippetsPaletteProps> = ({
  isOpen,
  onClose,
  onInsertSnippet,
  className = '',
}) => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [filteredSnippets, setFilteredSnippets] = useState<Snippet[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadSnippets();
      setSearchQuery('');
      setSelectedCategory('All');
      setSelectedIndex(0);
      // Focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    filterSnippets();
  }, [snippets, searchQuery, selectedCategory]);

  useEffect(() => {
    // Reset selected index when filtered snippets change
    setSelectedIndex(0);
  }, [filteredSnippets]);

  const loadSnippets = async () => {
    try {
      const snippetList = await window.electronAPI.snippetList();
      setSnippets(snippetList);
    } catch (error) {
      console.error('Failed to load snippets:', error);
    }
  };

  const filterSnippets = () => {
    let filtered = snippets;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(snippet => snippet.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(snippet =>
        snippet.name.toLowerCase().includes(query) ||
        snippet.description.toLowerCase().includes(query) ||
        snippet.trigger.toLowerCase().includes(query) ||
        snippet.content.toLowerCase().includes(query)
      );
    }

    setFilteredSnippets(filtered);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredSnippets.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredSnippets[selectedIndex]) {
          insertSnippet(filteredSnippets[selectedIndex]);
        }
        break;
    }
  };

  const insertSnippet = (snippet: Snippet) => {
    onInsertSnippet(snippet.content, snippet.cursorPosition);
    onClose();
  };

  const categories = ['All', ...Array.from(new Set(snippets.map(s => s.category)))];

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Insert Snippet</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex space-x-4 mb-3">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search snippets... (try 'figure', 'table', 'equation')"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-500">
            {filteredSnippets.length} snippet{filteredSnippets.length !== 1 ? 's' : ''} found
            • Use ↑↓ arrow keys to navigate • Enter to insert • Esc to close
          </div>
        </div>

        {/* Snippets List */}
        <div className="flex-1 overflow-y-auto">
          {filteredSnippets.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 
                `No snippets found matching "${searchQuery}"` : 
                'No snippets available'
              }
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredSnippets.map((snippet, index) => (
                <div
                  key={snippet.id}
                  onClick={() => insertSnippet(snippet)}
                  className={`p-4 cursor-pointer transition-colors ${
                    index === selectedIndex 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{snippet.name}</h4>
                      <p className="text-sm text-gray-600">{snippet.description}</p>
                    </div>
                    <div className="flex space-x-2">
                      <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                        {snippet.category}
                      </span>
                      <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-mono">
                        {snippet.trigger}
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded p-2 font-mono text-sm text-gray-700 overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{snippet.content}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Tip:</span> You can also type a snippet trigger (like "figure") 
            in the editor and press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl+Space</kbd> to quickly insert it.
          </div>
        </div>
      </div>
    </div>
  );
};
