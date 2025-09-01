import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  mtime?: string;
  children?: FileNode[];
}

interface VirtualizedFileTreeProps {
  files: FileNode[];
  projectId: string;
  onFileSelect: (path: string) => void;
  onRefresh: () => void;
  onFileCreate?: (path: string) => void;
  onFileDelete?: (path: string) => void;
  onFileRename?: (oldPath: string, newPath: string) => void;
  onQuickFileSearch?: () => void; // Milestone 13: Quick File Search
  onFileCreationChange?: (isCreating: boolean) => void; // Track file creation state
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  maxVisibleItems?: number; // For virtualization
  itemHeight?: number; // Fixed height per item
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: FileNode | null;
  isRoot?: boolean;
}

interface FlatNode {
  node: FileNode;
  depth: number;
  index: number;
  isExpanded?: boolean;
}

export const VirtualizedFileTree: React.FC<VirtualizedFileTreeProps> = ({ 
  files, 
  projectId,
  onFileSelect, 
  onRefresh,
  onFileCreate,
  onFileDelete,
  onFileRename,
  onQuickFileSearch,
  onFileCreationChange,
  showSidebar,
  onToggleSidebar,
  maxVisibleItems = 50,
  itemHeight = 32
}) => {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [creatingNode, setCreatingNode] = useState<{ parentPath: string; type: 'file' | 'directory' } | null>(null);
  const [creatingName, setCreatingName] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);

  // Flatten the file tree for virtualization
  const flattenedNodes = useMemo(() => {
    const flattened: FlatNode[] = [];
    
    const flatten = (nodes: FileNode[], depth: number = 0) => {
      nodes.forEach((node) => {
        flattened.push({
          node,
          depth,
          index: flattened.length,
          isExpanded: expandedDirs.has(node.path)
        });
        
        // Include children if directory is expanded
        if (node.type === 'directory' && expandedDirs.has(node.path) && node.children) {
          flatten(node.children, depth + 1);
        }
      });
    };
    
    flatten(files);
    return flattened;
  }, [files, expandedDirs]);

  // Calculate visible items for virtualization
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(startIndex + maxVisibleItems, flattenedNodes.length);
    
    return flattenedNodes.slice(startIndex, endIndex).map(item => ({
      ...item,
      virtualIndex: startIndex + item.index - startIndex
    }));
  }, [flattenedNodes, scrollTop, itemHeight, maxVisibleItems]);

  // Update container height on mount and resize
  useEffect(() => {
    const updateHeight = () => {
      if (scrollContainerRef.current) {
        const rect = scrollContainerRef.current.getBoundingClientRect();
        setContainerHeight(rect.height);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Handle scroll events for virtualization
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, node: null });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu.visible]);

  // Notify parent component when file creation state changes
  useEffect(() => {
    onFileCreationChange?.(creatingNode !== null);
  }, [creatingNode, onFileCreationChange]);

  // Notify parent component when file creation state changes
  useEffect(() => {
    onFileCreationChange?.(creatingNode !== null);
  }, [creatingNode, onFileCreationChange]);

  const toggleDirectory = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return newExpanded;
    });
  }, []);

  const handleContextMenu = (e: React.MouseEvent, node: FileNode | null, isRoot = false) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
      isRoot,
    });
  };

  const handleRename = (node: FileNode) => {
    setEditingNode(node.path);
    setEditingName(node.name);
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  const handleCreateFile = (parentPath?: string) => {
    const path = parentPath || '';
    setCreatingNode({ parentPath: path, type: 'file' });
    setCreatingName('');
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
    
    // Auto-expand parent directory if it's a folder
    if (parentPath) {
      setExpandedDirs(prev => new Set([...prev, parentPath]));
    }
  };

  const handleCreateFolder = (parentPath?: string) => {
    const path = parentPath || '';
    setCreatingNode({ parentPath: path, type: 'directory' });
    setCreatingName('');
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
    
    // Auto-expand parent directory if it's a folder
    if (parentPath) {
      setExpandedDirs(prev => new Set([...prev, parentPath]));
    }
  };

  const handleDelete = async (node: FileNode) => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
    
    if (window.confirm(`Are you sure you want to delete "${node.name}"?`)) {
      try {
        await window.electronAPI.fsDelete({
          projectId,
          relPath: node.path,
        });
        onRefresh();
        onFileDelete?.(node.path);
      } catch (error) {
        console.error('Failed to delete file:', error);
        alert('Failed to delete file: ' + (error as Error).message);
      }
    }
  };

  const confirmRename = async () => {
    if (!editingNode || !editingName.trim()) return;
    
    const oldPath = editingNode;
    const pathParts = oldPath.split('/');
    pathParts[pathParts.length - 1] = editingName.trim();
    const newPath = pathParts.join('/');
    
    if (oldPath === newPath) {
      setEditingNode(null);
      return;
    }
    
    try {
      await window.electronAPI.fsRename({
        projectId,
        oldPath,
        newPath,
      });
      onRefresh();
      onFileRename?.(oldPath, newPath);
      setEditingNode(null);
    } catch (error) {
      console.error('Failed to rename file:', error);
      alert('Failed to rename file: ' + (error as Error).message);
      setEditingNode(null);
    }
  };

  const confirmCreate = async () => {
    if (!creatingNode || !creatingName.trim()) return;
    
    const fileName = creatingName.trim();
    const filePath = creatingNode.parentPath 
      ? `${creatingNode.parentPath}/${fileName}`
      : fileName;
    
    try {
      if (creatingNode.type === 'file') {
        await window.electronAPI.fsCreateFile({
          projectId,
          relPath: filePath,
        });
      } else {
        await window.electronAPI.fsCreateDir({
          projectId,
          relPath: filePath,
        });
      }
      onRefresh();
      onFileCreate?.(filePath);
      setCreatingNode(null);
      setCreatingName('');
    } catch (error) {
      console.error(`Failed to create ${creatingNode.type}:`, error);
      alert(`Failed to create ${creatingNode.type}: ` + (error as Error).message);
      setCreatingNode(null);
      setCreatingName('');
    }
  };

  const handleDragStart = (e: React.DragEvent, node: FileNode) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.path);
    setDraggedNode(node);
  };

  const handleDragOver = (e: React.DragEvent, targetNode?: FileNode) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (targetNode?.type === 'directory') {
      setDragOverNode(targetNode.path);
    } else {
      setDragOverNode('root');
    }
  };

  const handleDragLeave = () => {
    setDragOverNode(null);
  };

  const handleDrop = async (e: React.DragEvent, targetNode?: FileNode) => {
    e.preventDefault();
    setDragOverNode(null);
    
    if (!draggedNode) return;
    
    // Determine the target directory
    let targetPath = '';
    if (targetNode?.type === 'directory') {
      targetPath = targetNode.path;
    }
    
    // Don't allow dropping on itself or its children
    if (draggedNode.path === targetPath || 
        targetPath.startsWith(draggedNode.path + '/')) {
      setDraggedNode(null);
      return;
    }
    
    // Calculate new path
    const fileName = draggedNode.name;
    const newPath = targetPath ? `${targetPath}/${fileName}` : fileName;
    
    // Don't move if it's the same location
    if (draggedNode.path === newPath) {
      setDraggedNode(null);
      return;
    }
    
    try {
      await window.electronAPI.fsRename({
        projectId,
        oldPath: draggedNode.path,
        newPath: newPath,
      });
      onRefresh();
      onFileRename?.(draggedNode.path, newPath);
    } catch (error) {
      console.error('Failed to move file:', error);
      alert('Failed to move file: ' + (error as Error).message);
    }
    
    setDraggedNode(null);
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tex':
        return '📄';
      case 'bib':
        return '📚';
      case 'pdf':
        return '📕';
      case 'png':
      case 'jpg':
      case 'jpeg':
        return '🖼️';
      case 'cls':
      case 'sty':
        return '⚙️';
      default:
        return '📄';
    }
  };

  const renderVirtualizedItem = (flatNode: FlatNode, index: number) => {
    const { node, depth } = flatNode;
    const isExpanded = expandedDirs.has(node.path);
    const paddingLeft = depth * 16;
    const isEditing = editingNode === node.path;
    const isDraggedOver = dragOverNode === node.path;
    const isDragging = draggedNode?.path === node.path;
    const topOffset = (Math.floor(scrollTop / itemHeight) * itemHeight) + (index * itemHeight);

    return (
      <div
        key={`${node.path}-${index}`}
        className={`absolute w-full file-tree-item group ${
          node.type === 'file' ? 'cursor-pointer hover:bg-gray-100' : 'cursor-pointer hover:bg-gray-100'
        } ${isDraggedOver ? 'bg-blue-100 border-2 border-blue-300 border-dashed' : ''} ${
          isDragging ? 'opacity-50' : ''
        }`}
        style={{ 
          top: topOffset,
          height: itemHeight,
          paddingLeft: `${paddingLeft + 8}px` 
        }}
        draggable={!isEditing}
        onDragStart={(e) => handleDragStart(e, node)}
        onDragOver={(e) => handleDragOver(e, node)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, node)}
        onClick={() => {
          if (isEditing) return;
          
          if (node.type === 'directory') {
            toggleDirectory(node.path);
          } else {
            onFileSelect(node.path);
          }
        }}
        onContextMenu={(e) => handleContextMenu(e, node)}
      >
        <div className="flex items-center space-x-2 py-1 h-full">
          {node.type === 'directory' && (
            <span className="text-gray-500 text-xs w-4 flex justify-center">
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {node.type === 'file' && <span className="w-4"></span>}
          <span className="text-gray-600 text-xs">
            {node.type === 'directory' ? '📁' : getFileIcon(node.name)}
          </span>
          
          {isEditing ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={confirmRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  confirmRename();
                } else if (e.key === 'Escape') {
                  setEditingNode(null);
                }
              }}
              className="text-sm bg-white border border-blue-500 rounded px-1 py-0 flex-1 min-w-0"
              autoFocus
            />
          ) : (
            <span className="text-sm text-gray-800 truncate flex-1 min-w-0">{node.name}</span>
          )}
        </div>
      </div>
    );
  };

  const totalHeight = flattenedNodes.length * itemHeight;
  const startIndex = Math.floor(scrollTop / itemHeight);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Files ({flattenedNodes.length})</h3>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleCreateFile()}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              title="New File"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button
              onClick={() => handleCreateFolder()}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              title="New Folder"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button
              onClick={onRefresh}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto bg-gray-50 relative" 
        onContextMenu={(e) => handleContextMenu(e, null, true)}
        onDragOver={(e) => handleDragOver(e)}
        onDrop={(e) => handleDrop(e)}
        onScroll={handleScroll}
      >
        {flattenedNodes.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No files found
          </div>
        ) : (
          <div style={{ height: totalHeight, position: 'relative' }}>
            {visibleItems.map((flatNode, index) => renderVirtualizedItem(flatNode, index))}
          </div>
        )}
        
        {/* Show create input at root level */}
        {creatingNode && creatingNode.parentPath === '' && (
          <div 
            className="absolute file-tree-item bg-white border border-blue-300 z-10" 
            style={{ 
              top: totalHeight,
              left: 8,
              right: 8,
              height: itemHeight
            }}
          >
            <div className="flex items-center space-x-2 py-1 h-full">
              <span className="w-4"></span>
              <span className="text-gray-600 text-xs">
                {creatingNode.type === 'directory' ? '📁' : '📄'}
              </span>
              <input
                type="text"
                value={creatingName}
                onChange={(e) => setCreatingName(e.target.value)}
                onBlur={confirmCreate}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmCreate();
                  } else if (e.key === 'Escape') {
                    setCreatingNode(null);
                    setCreatingName('');
                  }
                }}
                className="text-sm bg-white border border-blue-500 rounded px-1 py-0 flex-1 min-w-0"
                placeholder={`New ${creatingNode.type} name`}
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="fixed bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1 min-w-40"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          {contextMenu.isRoot ? (
            <>
              <button
                onClick={() => handleCreateFile()}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
              >
                <span>📄</span>
                <span>New File</span>
              </button>
              <button
                onClick={() => handleCreateFolder()}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
              >
                <span>📁</span>
                <span>New Folder</span>
              </button>
            </>
          ) : (
            <>
              {contextMenu.node?.type === 'directory' && (
                <>
                  <button
                    onClick={() => handleCreateFile(contextMenu.node?.path)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <span>📄</span>
                    <span>New File</span>
                  </button>
                  <button
                    onClick={() => handleCreateFolder(contextMenu.node?.path)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <span>📁</span>
                    <span>New Folder</span>
                  </button>
                  <hr className="my-1 border-gray-200" />
                </>
              )}
              <button
                onClick={() => contextMenu.node && handleRename(contextMenu.node)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
              >
                <span>✏️</span>
                <span>Rename</span>
              </button>
              <button
                onClick={() => contextMenu.node && handleDelete(contextMenu.node)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-red-600 flex items-center space-x-2"
              >
                <span>🗑️</span>
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
