import React, { useState, useEffect } from 'react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (name: string, templateId?: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [projectName, setProjectName] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setProjectName('');
      setSelectedTemplateId('');
      setSearchQuery('');
      setSelectedCategory('All');
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      const templateList = await window.electronAPI.templateList();
      setTemplates(templateList);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleCreate = () => {
    if (!projectName.trim()) return;
    onCreateProject(projectName.trim(), selectedTemplateId || undefined);
    onClose();
  };

  const categories = ['All', ...Array.from(new Set(templates.map(t => t.category)))];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-semibold text-gray-900">Create New Project</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-semibold"
          >
            ×
          </button>
        </div>

        {/* Project Name Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project Name *
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="My LaTeX Document"
            autoFocus
          />
        </div>

        {/* Template Selection */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-medium text-gray-900">Choose a Template (Optional)</h4>
            <div className="flex space-x-4">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              {/* Search */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>
          </div>

          {/* Template Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Blank Project Option */}
              <div
                onClick={() => setSelectedTemplateId('')}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedTemplateId === '' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center mr-3">
                    📄
                  </div>
                  <h5 className="font-medium text-gray-900">Blank Project</h5>
                </div>
                <p className="text-sm text-gray-600">Start with a basic LaTeX document</p>
                <div className="mt-2">
                  <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                    Basic
                  </span>
                </div>
              </div>

              {/* Template Options */}
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedTemplateId === template.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center mr-3">
                      <span className="text-white text-sm font-bold">
                        {template.name.charAt(0)}
                      </span>
                    </div>
                    <h5 className="font-medium text-gray-900">{template.name}</h5>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                  <div className="mt-2">
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">
                      {template.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {filteredTemplates.length === 0 && searchQuery && (
              <div className="text-center py-8 text-gray-500">
                No templates found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!projectName.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
};
