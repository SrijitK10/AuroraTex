import React, { useState, useEffect, useCallback, useRef } from 'react';

interface BibEntry {
  id: string;
  type: string;
  key: string;
  fields: Record<string, string>;
}

interface BibManagerProps {
  projectId: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const BibManager: React.FC<BibManagerProps> = ({
  projectId,
  fileName,
  isOpen,
  onClose,
  className = '',
}) => {
  const [entries, setEntries] = useState<BibEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<BibEntry | null>(null);
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [entryTypes, setEntryTypes] = useState<Array<{ type: string; description: string; fields: string[] }>>([]);
  const [selectedEntryType, setSelectedEntryType] = useState('article');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isOpen) {
      loadEntries();
      loadEntryTypes();
      setHasUnsavedChanges(false);
    }
  }, [isOpen, projectId, fileName]);

  const loadEntries = async () => {
    try {
      const bibEntries = await window.electronAPI.bibTexParse({ projectId, fileName });
      setEntries(bibEntries);
    } catch (error) {
      console.error('Failed to load bibliography entries:', error);
      setEntries([]);
    }
  };

  const loadEntryTypes = async () => {
    try {
      const types = await window.electronAPI.bibTexGetEntryTypes();
      setEntryTypes(types);
    } catch (error) {
      console.error('Failed to load entry types:', error);
    }
  };

  // Debounced auto-save function
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      if (hasUnsavedChanges) {
        setIsAutoSaving(true);
        try {
          await window.electronAPI.bibTexWrite({ projectId, fileName, entries });
          setHasUnsavedChanges(false);
        } catch (error) {
          console.error('Failed to auto-save bibliography:', error);
        } finally {
          setIsAutoSaving(false);
        }
      }
    }, 1500); // Save after 1.5 seconds of inactivity
  }, [hasUnsavedChanges, entries, projectId, fileName]);

  // Auto-save when entries change
  useEffect(() => {
    if (hasUnsavedChanges) {
      debouncedSave();
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, debouncedSave]);

  // Handle Escape key to close bibliography manager
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

  const saveEntries = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    try {
      await window.electronAPI.bibTexWrite({ projectId, fileName, entries });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save bibliography:', error);
    }
  };

  const createNewEntry = async () => {
    try {
      const newEntry = await window.electronAPI.bibTexCreateEntry({ type: selectedEntryType });
      setEntries(prev => [...prev, newEntry]);
      setEditingEntry(newEntry);
      setShowNewEntryModal(false);
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Failed to create new entry:', error);
    }
  };

  const updateEntry = (updatedEntry: BibEntry) => {
    setEntries(prev => prev.map(entry => 
      entry.id === updatedEntry.id ? updatedEntry : entry
    ));
    setHasUnsavedChanges(true);
  };

  const deleteEntry = (entryId: string) => {
    setEntries(prev => prev.filter(entry => entry.id !== entryId));
    if (editingEntry?.id === entryId) {
      setEditingEntry(null);
    }
    setHasUnsavedChanges(true);
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = searchQuery === '' || 
      entry.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Object.values(entry.fields).some(field => 
        field.toLowerCase().includes(searchQuery.toLowerCase())
      );
    
    const matchesType = selectedType === 'All' || entry.type === selectedType.toLowerCase();
    
    return matchesSearch && matchesType;
  });

  const availableTypes = ['All', ...Array.from(new Set(entries.map(e => e.type)))];

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Bibliography Manager</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Editing: {fileName}</span>
              {hasUnsavedChanges && (
                <span className="inline-flex items-center space-x-1">
                  <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                  <span>Unsaved changes</span>
                </span>
              )}
              {isAutoSaving && (
                <span className="inline-flex items-center space-x-1 text-blue-600">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                  <span>Auto-saving...</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                saveEntries();
                onClose();
              }}
              disabled={isAutoSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Save & Close
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Entry List */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col">
            {/* Search and Filters */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex space-x-3 mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search entries..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {availableTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowNewEntryModal(true)}
                className="w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
              >
                + Add New Entry
              </button>
            </div>

            {/* Entry List */}
            <div className="flex-1 overflow-y-auto">
              {filteredEntries.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {entries.length === 0 ? (
                    <>
                      <p className="mb-2">No bibliography entries found.</p>
                      <p className="text-sm">Create a new entry to get started.</p>
                    </>
                  ) : (
                    `No entries match your search "${searchQuery}"`
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredEntries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => setEditingEntry(entry)}
                      className={`p-3 cursor-pointer transition-colors ${
                        editingEntry?.id === entry.id 
                          ? 'bg-blue-50 border-l-4 border-blue-500' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900 text-sm">{entry.key}</h4>
                          <p className="text-xs text-gray-600 mb-1">
                            {entry.fields.title || entry.fields.author || 'No title/author'}
                          </p>
                          <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                            {entry.type}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEntry(entry.id);
                          }}
                          className="text-red-400 hover:text-red-600 text-sm p-1"
                          title="Delete entry"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Entry Editor */}
          <div className="w-1/2 flex flex-col">
            {editingEntry ? (
              <EntryEditor
                entry={editingEntry}
                onUpdate={updateEntry}
                entryTypes={entryTypes}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="mb-2">Select an entry to edit</p>
                  <p className="text-sm">or create a new one to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* New Entry Modal */}
        {showNewEntryModal && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Create New Entry</h4>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entry Type
                </label>
                <select
                  value={selectedEntryType}
                  onChange={(e) => setSelectedEntryType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {entryTypes.map((type) => (
                    <option key={type.type} value={type.type}>
                      {type.type} - {type.description}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowNewEntryModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createNewEntry}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Entry Editor Component
interface EntryEditorProps {
  entry: BibEntry;
  onUpdate: (entry: BibEntry) => void;
  entryTypes: Array<{ type: string; description: string; fields: string[] }>;
}

const EntryEditor: React.FC<EntryEditorProps> = ({ entry, onUpdate, entryTypes }) => {
  const [localEntry, setLocalEntry] = useState<BibEntry>(entry);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalEntry(entry);
  }, [entry]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const debouncedUpdate = useCallback((updatedEntry: BibEntry) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      onUpdate(updatedEntry);
    }, 300); // Update after 300ms of inactivity
  }, [onUpdate]);

  const updateField = (field: string, value: string) => {
    const updatedEntry = {
      ...localEntry,
      [field === 'key' ? 'key' : 'type']: field === 'key' || field === 'type' ? value : localEntry[field as keyof BibEntry],
      fields: field === 'key' || field === 'type' ? localEntry.fields : {
        ...localEntry.fields,
        [field]: value
      }
    };
    setLocalEntry(updatedEntry);
    debouncedUpdate(updatedEntry);
  };

  const addField = () => {
    const fieldName = prompt('Enter field name:');
    if (fieldName && !localEntry.fields[fieldName]) {
      updateField(fieldName, '');
    }
  };

  const removeField = (fieldName: string) => {
    const updatedFields = { ...localEntry.fields };
    delete updatedFields[fieldName];
    const updatedEntry = { ...localEntry, fields: updatedFields };
    setLocalEntry(updatedEntry);
    debouncedUpdate(updatedEntry);
  };

  const entryType = entryTypes.find(t => t.type === localEntry.type);
  const recommendedFields = entryType?.fields || [];
  const currentFields = Object.keys(localEntry.fields);
  const allFields = Array.from(new Set([...recommendedFields, ...currentFields]));

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3">Edit Entry</h4>
        
        {/* Key and Type */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Citation Key *
            </label>
            <input
              type="text"
              value={localEntry.key}
              onChange={(e) => updateField('key', e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Entry Type *
            </label>
            <select
              value={localEntry.type}
              onChange={(e) => updateField('type', e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {entryTypes.map((type) => (
                <option key={type.type} value={type.type}>
                  {type.type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {allFields.map((fieldName) => (
            <div key={fieldName} className="flex items-start space-x-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {fieldName}
                  {recommendedFields.includes(fieldName) && (
                    <span className="text-blue-600">*</span>
                  )}
                </label>
                <textarea
                  value={localEntry.fields[fieldName] || ''}
                  onChange={(e) => updateField(fieldName, e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={fieldName === 'abstract' ? 3 : 1}
                />
              </div>
              {!recommendedFields.includes(fieldName) && (
                <button
                  onClick={() => removeField(fieldName)}
                  className="text-red-400 hover:text-red-600 text-xs p-1 mt-5"
                  title="Remove field"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addField}
          className="mt-4 w-full px-3 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-md hover:border-gray-400 transition-colors text-sm"
        >
          + Add Custom Field
        </button>
      </div>
    </div>
  );
};
