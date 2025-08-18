import React, { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  root: string;
  mainFile: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectExplorerProps {
  onProjectSelect: (project: Project) => void;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({ onProjectSelect }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const projectList = await window.electronAPI.projectList();
      setProjects(projectList);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      const project = await window.electronAPI.projectCreate({
        name: newProjectName.trim(),
      });
      
      setProjects(prev => [project, ...prev]);
      setShowCreateModal(false);
      setNewProjectName('');
      onProjectSelect(project);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const openProject = async () => {
    try {
      const result = await window.electronAPI.dialogShowOpenDialog();
      
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }
      
      const projectPath = result.filePaths[0];
      
      // Open the project
      const project = await window.electronAPI.projectOpen({ path: projectPath });
      onProjectSelect(project);
      
      // Refresh project list to include the newly opened project
      await loadProjects();
    } catch (error) {
      console.error('Failed to open project:', error);
      // You might want to show a user-friendly error message here
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-4xl w-full mx-auto p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Offline Overleaf</h1>
          <p className="text-lg text-gray-600">
            Your personal LaTeX editor with full offline support
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div 
            onClick={() => setShowCreateModal(true)}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-100 transition-colors"
          >
            <div className="text-3xl text-gray-400 mb-2">+</div>
            <div className="text-lg font-medium text-gray-700">New Project</div>
            <div className="text-sm text-gray-500">Create a new LaTeX document</div>
          </div>

          <div 
            onClick={openProject}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-100 transition-colors"
          >
            <div className="text-3xl text-gray-400 mb-2">📂</div>
            <div className="text-lg font-medium text-gray-700">Open Project</div>
            <div className="text-sm text-gray-500">Open an existing project</div>
          </div>
        </div>

        {projects.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Recent Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => onProjectSelect(project)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <h3 className="font-medium text-gray-900 mb-2">{project.name}</h3>
                  <p className="text-sm text-gray-500 mb-1">
                    Main: {project.mainFile}
                  </p>
                  <p className="text-xs text-gray-400">
                    Updated: {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Project</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createProject()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My LaTeX Document"
                  autoFocus
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewProjectName('');
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createProject}
                  disabled={!newProjectName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
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
