import React, { useEffect, useState } from 'react';
import { Project, User } from '../types';
import { StorageService } from '../services/storage';
import { Calendar, Trash2, PlayCircle, FileText, ChevronRight } from 'lucide-react';

interface DashboardProps {
  user: User;
  onOpenProject: (project: Project) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onOpenProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    setProjects(StorageService.getProjects(user.id));
  }, [user.id]);

  const handleDelete = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      StorageService.deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-serif font-bold text-emerald-900">Your Projects</h2>
          <p className="text-slate-500">Manage your saved lectures, summaries, and audio.</p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No projects yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2">
            Use the Summarizer to analyze a lecture and save it to your dashboard.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div 
              key={project.id}
              onClick={() => onOpenProject(project)}
              className="group bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
                  <FileText className="w-6 h-6" />
                </div>
                <button 
                  onClick={(e) => handleDelete(e, project.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <h3 className="font-semibold text-slate-900 mb-2 line-clamp-1" title={project.title}>
                {project.title}
              </h3>
              
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                <Calendar className="w-3 h-3" />
                {new Date(project.createdAt).toLocaleDateString()}
              </div>

              <p className="text-sm text-slate-600 line-clamp-3 mb-6 h-16">
                {project.summary?.summary_short || "No summary available."}
              </p>

              <div className="flex items-center text-emerald-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                View Project <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};