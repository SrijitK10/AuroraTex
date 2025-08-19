import React, { useState, useEffect } from 'react';
import { NewProjectModal } from './NewProjectModal';
import texlabBanner from '../assets/texlab.png';

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

  const createProject = async (name: string, templateId?: string) => {
    try {
      const project = await window.electronAPI.projectCreate({
        name,
        templateId,
      });
      
      setProjects(prev => [project, ...prev]);
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
          <div className="mb-6">
            <img 
              src={texlabBanner} 
              alt="TexLab" 
              className="mx-auto h-32 w-auto"
            />
          </div>
          <p className="text-lg text-gray-600">
            Your personal LaTeX editor with full offline support
          </p>
        </div>

        <div className="flex justify-center items-center mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl">
            <div 
              onClick={() => setShowCreateModal(true)}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-100 transition-colors min-w-[200px]"
            >
              <div className="text-4xl text-gray-400 mb-3">+</div>
              <div className="text-xl font-medium text-gray-700 mb-2">New Project</div>
              <div className="text-sm text-gray-500">Create a new LaTeX document</div>
            </div>

            <div 
              onClick={openProject}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-100 transition-colors min-w-[200px]"
            >
              <div className="text-4xl text-gray-400 mb-3">📂</div>
              <div className="text-xl font-medium text-gray-700 mb-2">Open Project</div>
              <div className="text-sm text-gray-500">Open an existing project</div>
            </div>
          </div>
        </div>

        {projects.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Recent Projects</h2>
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

        {/* New Project Modal */}
        <NewProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateProject={createProject}
        />
      </div>
    </div>
  );
};
