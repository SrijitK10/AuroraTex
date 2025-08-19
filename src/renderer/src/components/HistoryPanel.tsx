import React, { useState, useEffect } from 'react';

export interface SnapshotItem {
  id: string;
  projectId: string;
  timestamp: number;
  message?: string;
  path: string;
  sizeBytes: number;
  formattedDate?: string;
  formattedSize?: string;
}

interface HistoryPanelProps {
  projectId: string | null;
  onClose: () => void;
  isOpen: boolean;
  className?: string;
  onRestoreStart?: () => void;
  onRestoreEnd?: () => void;
  autoSnapshotSettings?: {
    onAppClose: boolean;
    onProjectSwitch: boolean;
    periodic: boolean;
    periodicIntervalMinutes: number;
  };
  onAutoSnapshotSettingsChange?: (settings: {
    onAppClose: boolean;
    onProjectSwitch: boolean;
    periodic: boolean;
    periodicIntervalMinutes: number;
  }) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  projectId,
  onClose,
  isOpen,
  className = '',
  onRestoreStart,
  onRestoreEnd,
  autoSnapshotSettings,
  onAutoSnapshotSettingsChange,
}) => {
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [newSnapshotMessage, setNewSnapshotMessage] = useState('');

  // Load snapshots when component mounts or projectId changes
  useEffect(() => {
    if (projectId) {
      loadSnapshots();
    }
  }, [projectId]);

  // Handle escape key to close panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        onClose();
        return false;
      }
    };

    if (isOpen) {
      // Add event listener with capture = true to handle before other listeners
      document.addEventListener('keydown', handleKeyDown, { capture: true });
    }

    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  const loadSnapshots = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const fetchedSnapshots = await window.electronAPI.snapshotList({ projectId });
      setSnapshots(fetchedSnapshots);
    } catch (error) {
      console.error('Failed to load snapshots:', error);
      alert('Failed to load snapshots: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const createSnapshot = async () => {
    if (!projectId) return;

    setCreating(true);
    try {
      await window.electronAPI.snapshotCreate({
        projectId,
        message: newSnapshotMessage.trim() || undefined
      });
      
      setNewSnapshotMessage('');
      await loadSnapshots(); // Reload to show new snapshot
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      alert('Failed to create snapshot: ' + (error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const restoreSnapshot = async (snapshotId: string, message?: string) => {
    // Prevent multiple restore operations
    if (restoring) {
      console.log('Restore already in progress, ignoring click');
      return;
    }

    const confirmMessage = message 
      ? `Are you sure you want to restore this snapshot?\n\n"${message}"\n\nThis will overwrite all current files (a backup will be created automatically).`
      : 'Are you sure you want to restore this snapshot?\n\nThis will overwrite all current files (a backup will be created automatically).';
      
    if (!window.confirm(confirmMessage)) {
      return;
    }

    console.log(`Starting restore of snapshot: ${snapshotId}`);
    setRestoring(snapshotId);
    onRestoreStart?.(); // Signal start of restore operation
    
    try {
      console.log('Calling snapshotRestore API...');
      const result = await window.electronAPI.snapshotRestore({ snapshotId });
      console.log('Restore API result:', result);
      
      // Wait longer for file operations to complete and settle
      console.log('Waiting for file operations to complete...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Restore completed successfully');
      alert('Snapshot restored successfully! The project has been updated.');
      onClose(); // Close panel after successful restore
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      alert('Failed to restore snapshot: ' + (error as Error).message);
    } finally {
      console.log('Cleaning up restore operation');
      setRestoring(null);
      onRestoreEnd?.(); // Signal end of restore operation
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  if (!projectId) {
    return (
      <>
        {/* Overlay */}
        <div 
          className={`history-panel-overlay ${isOpen ? 'open' : ''}`}
          onClick={onClose}
        />
        {/* Panel Container */}
        <div className={`history-panel-container ${isOpen ? 'open' : ''}`}>
          <div className={`history-panel h-full ${className}`}>
            <div className="p-4 text-center text-gray-500">
              <p>No project selected</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div 
        className={`history-panel-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      {/* Panel Container */}
      <div className={`history-panel-container ${isOpen ? 'open' : ''}`}>
        <div className={`history-panel h-full ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 flex items-center">
            <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Project History
          </h3>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
            title="Close history panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Create New Snapshot */}
      <div className="border-b border-gray-200 p-4 bg-white">
        <div className="space-y-3">
          <div>
            <label htmlFor="snapshot-message" className="block text-xs font-medium text-gray-700 mb-1">
              Create New Snapshot
            </label>
            <input
              id="snapshot-message"
              type="text"
              value={newSnapshotMessage}
              onChange={(e) => setNewSnapshotMessage(e.target.value)}
              placeholder="Optional description (e.g., 'Before major refactor')"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={creating || restoring !== null}
            />
          </div>
          <button
            onClick={createSnapshot}
            disabled={creating || restoring !== null}
            className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {creating ? (
              <>
                <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Snapshot
              </>
            )}
          </button>
        </div>
      </div>

      {/* Auto-snapshot Settings */}
      {autoSnapshotSettings && onAutoSnapshotSettingsChange && (
        <div className="border-b border-gray-200 p-4 bg-gray-50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700">Auto-Snapshot Settings</label>
            </div>
            
            <div className="space-y-2">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={autoSnapshotSettings.onAppClose}
                  onChange={(e) => onAutoSnapshotSettingsChange({
                    ...autoSnapshotSettings,
                    onAppClose: e.target.checked
                  })}
                  className="mr-2 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-gray-600">Auto-snapshot on app close</span>
              </label>
              
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={autoSnapshotSettings.onProjectSwitch}
                  onChange={(e) => onAutoSnapshotSettingsChange({
                    ...autoSnapshotSettings,
                    onProjectSwitch: e.target.checked
                  })}
                  className="mr-2 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-gray-600">Auto-snapshot on project switch</span>
              </label>
              
              <div className="space-y-1">
                <label className="flex items-center text-xs">
                  <input
                    type="checkbox"
                    checked={autoSnapshotSettings.periodic}
                    onChange={(e) => onAutoSnapshotSettingsChange({
                      ...autoSnapshotSettings,
                      periodic: e.target.checked
                    })}
                    className="mr-2 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-600">Periodic auto-snapshots</span>
                </label>
                
                {autoSnapshotSettings.periodic && (
                  <div className="ml-5 flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Every</span>
                    <input
                      type="number"
                      min="5"
                      max="180"
                      value={autoSnapshotSettings.periodicIntervalMinutes}
                      onChange={(e) => onAutoSnapshotSettingsChange({
                        ...autoSnapshotSettings,
                        periodicIntervalMinutes: Math.max(5, parseInt(e.target.value) || 30)
                      })}
                      className="w-12 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">minutes</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Snapshots List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin mx-auto h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            <p className="mt-2 text-sm text-gray-500">Loading snapshots...</p>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium">No snapshots yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first snapshot to save the current state</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {snapshots.map((snapshot) => {
              const isAutoSnapshot = snapshot.message?.includes('Auto-') || snapshot.message?.includes('auto-');
              
              return (
                <div key={snapshot.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isAutoSnapshot ? 'bg-green-500' : 'bg-blue-500'
                        }`}></div>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {snapshot.message || 'Untitled Snapshot'}
                        </p>
                        {isAutoSnapshot && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Auto
                          </span>
                        )}
                      </div>
                    <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatRelativeTime(snapshot.timestamp)}
                      </span>
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        {snapshot.formattedSize || `${Math.round(snapshot.sizeBytes / 1024)} KB`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {snapshot.formattedDate || new Date(snapshot.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => restoreSnapshot(snapshot.id, snapshot.message)}
                    disabled={restoring !== null}
                    className="ml-3 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {restoring === snapshot.id ? (
                      <>
                        <div className="animate-spin -ml-1 mr-1 h-3 w-3 border border-white border-t-transparent rounded-full"></div>
                        Restoring...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Restore
                      </>
                    )}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}</span>
          <button
            onClick={loadSnapshots}
            className="text-blue-600 hover:text-blue-700 flex items-center"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
        </div>
      </div>
    </>
  );
};
