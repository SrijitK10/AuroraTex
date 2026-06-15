import React, { useState, useRef, useEffect } from 'react';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  mtime?: string;
  children?: FileNode[];
}

interface FileTreeProps {
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
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: FileNode | null;
  isRoot?: boolean;
}

export const FileTree: React.FC<FileTreeProps> = ({ 
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
  onToggleSidebar
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
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);

  const resetDragState = () => {
    setDraggedNode(null);
    setDragOverNode(null);
  };

  const getTargetDirectoryPath = (targetNode?: FileNode) => {
    if (!targetNode) {
      return '';
    }

    if (targetNode.type === 'directory') {
      return targetNode.path;
    }

    const lastSlashIndex = targetNode.path.lastIndexOf('/');
    return lastSlashIndex === -1 ? '' : targetNode.path.slice(0, lastSlashIndex);
  };

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

  const toggleDirectory = (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

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
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.path);
    setDraggedNode(node);
  };

  const handleDragOver = (e: React.DragEvent, targetNode?: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const targetPath = getTargetDirectoryPath(targetNode);
    setDragOverNode(targetPath || 'root');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();

    const relatedTarget = e.relatedTarget;
    if (relatedTarget instanceof Node && e.currentTarget.contains(relatedTarget)) {
      return;
    }

    setDragOverNode(null);
  };

  const handleDrop = async (e: React.DragEvent, targetNode?: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverNode(null);
    
    if (!draggedNode) return;
    
    // Determine the target directory
    const targetPath = getTargetDirectoryPath(targetNode);
    
    // Don't allow dropping on itself or its children
    if (draggedNode.path === targetPath || 
        targetPath.startsWith(draggedNode.path + '/')) {
      resetDragState();
      return;
    }
    
    // Calculate new path
    const fileName = draggedNode.name;
    const newPath = targetPath ? `${targetPath}/${fileName}` : fileName;
    
    // Don't move if it's the same location
    if (draggedNode.path === newPath) {
      resetDragState();
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

    resetDragState();
  };

  const renderFileNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedDirs.has(node.path);
    const paddingLeft = depth * 16;
    const isEditing = editingNode === node.path;
    const isDraggedOver = dragOverNode === node.path;
    const isDragging = draggedNode?.path === node.path;

    return (
      <div key={node.path}>
        <div
          className={`file-tree-item relative group cursor-pointer ${
            isDraggedOver ? 'drag-over' : ''
          } ${
            isDragging ? 'dragging' : ''
          }`}
          style={{ paddingLeft: `${paddingLeft + 8}px` }}
          draggable={!isEditing}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragEnd={resetDragState}
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
          <div className="flex items-center space-x-2 py-1">
            {node.type === 'directory' && (
              <span className="text-gray-500 dark:text-gray-400 text-xs w-4 flex justify-center">
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            {node.type === 'file' && <span className="w-4"></span>}
            <span className="text-gray-600 dark:text-gray-400 text-xs">
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
                className="text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-blue-500 dark:border-blue-400 rounded px-1 py-0 flex-1 min-w-0"
                autoFocus
              />
            ) : (
              <span className="text-sm truncate flex-1 min-w-0">{node.name}</span>
            )}
          </div>
        </div>
        
        {/* Show create input for this directory */}
        {creatingNode && creatingNode.parentPath === node.path && node.type === 'directory' && isExpanded && (
          <div
            className="file-tree-item"
            style={{ paddingLeft: `${paddingLeft + 24}px` }}
          >
            <div className="flex items-center space-x-2 py-1">
              <span className="w-4"></span>
              <span className="text-gray-600 dark:text-gray-400 text-xs">
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
                className="text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-blue-500 dark:border-blue-400 rounded px-1 py-0 flex-1 min-w-0"
                placeholder={`New ${creatingNode.type} name`}
                autoFocus
              />
            </div>
          </div>
        )}
        
        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
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

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200/50 dark:border-gray-800/50 bg-transparent">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Files</h3>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleCreateFile()}
              className="p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              title="New File"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button
              onClick={() => handleCreateFolder()}
              className="p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              title="New Folder"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div 
        className="flex-1 overflow-y-auto bg-transparent custom-scrollbar file-tree" 
        onContextMenu={(e) => handleContextMenu(e, null, true)}
        onDragOver={(e) => {
          if (e.target !== e.currentTarget) {
            return;
          }
          handleDragOver(e);
        }}
        onDragLeave={(e) => {
          if (e.target !== e.currentTarget) {
            return;
          }
          handleDragLeave(e);
        }}
        onDrop={(e) => {
          if (e.target !== e.currentTarget) {
            return;
          }
          handleDrop(e);
        }}
      >
        {files.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No files found
          </div>
        ) : (
          <div className="py-2">
            {files.map(file => renderFileNode(file))}
            
            {/* Show create input at root level */}
            {creatingNode && creatingNode.parentPath === '' && (
              <div className="file-tree-item" style={{ paddingLeft: '8px' }}>
                <div className="flex items-center space-x-2 py-1">
                  <span className="w-4"></span>
                  <span className="text-gray-600 dark:text-gray-400 text-xs">
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
                    className="text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-blue-500 dark:border-blue-400 rounded px-1 py-0 flex-1 min-w-0"
                    placeholder={`New ${creatingNode.type} name`}
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="fixed glass-panel rounded-xl z-50 py-1 min-w-[160px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          {contextMenu.isRoot ? (
            <>
              <button
                onClick={() => handleCreateFile()}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 transition-colors"
              >
                <span>📄</span>
                <span>New File</span>
              </button>
              <button
                onClick={() => handleCreateFolder()}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 transition-colors"
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
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 transition-colors"
                  >
                    <span>📄</span>
                    <span>New File</span>
                  </button>
                  <button
                    onClick={() => handleCreateFolder(contextMenu.node?.path)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 transition-colors"
                  >
                    <span>📁</span>
                    <span>New Folder</span>
                  </button>
                  <hr className="my-1 border-gray-200 dark:border-gray-800" />
                </>
              )}
              <button
                onClick={() => contextMenu.node && handleRename(contextMenu.node)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 transition-colors"
              >
                <span>✏️</span>
                <span>Rename</span>
              </button>
              <button
                onClick={() => contextMenu.node && handleDelete(contextMenu.node)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center space-x-2 transition-colors"
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
