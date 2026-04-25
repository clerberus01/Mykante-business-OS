import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  MoreHorizontal,
} from 'lucide-react';
import { Project } from '../types';
import ProjectCard from '../components/ProjectCard';
import { cn } from '../lib/utils';
import { useSupabaseProjects as useProjects } from '../hooks/supabase';
import ProjectDetail from './ProjectDetail';
import ProjectModal from '../components/ProjectModal';

export default function Projects() {
  const { projects, loading, addProject, updateProject } = useProjects();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);

  const normalizedProjects = projects.filter((project): project is Project => Boolean(project && project.id)).map((project) => ({
    ...project,
    id: typeof project.id === 'string' ? project.id : String(project.id),
    name: project.name || 'Projeto sem nome',
    description: project.description || '',
    status: project.status || 'draft',
    startDate: typeof project.startDate === 'number' ? project.startDate : Date.now(),
    deadline: typeof project.deadline === 'number' ? project.deadline : Date.now(),
    budget: typeof project.budget === 'number' && Number.isFinite(project.budget) ? project.budget : 0,
  }));

  const selectedProject = normalizedProjects.find(p => p.id === selectedProjectId);

  if (selectedProject) {
    return <ProjectDetail project={selectedProject} onBack={() => setSelectedProjectId(null)} />;
  }

  const filteredProjects = normalizedProjects.filter(p => 
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase opacity-40">
            Loading Projects...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">Workspace</span>
              <span className="text-[10px] font-mono text-gray-400">ACTIVE_PROJECTS: {filteredProjects.length}</span>
           </div>
           <h2 className="text-2xl font-bold text-os-text tracking-tight">Gerenciamento de Projetos</h2>
        </div>

        <div className="flex items-center gap-2">
           <div className="flex bg-white border border-gray-100 rounded p-1 shadow-sm">
              <button 
                type="button"
                onClick={() => setView('grid')}
                className={cn(
                  "p-1.5 rounded transition-all",
                  view === 'grid' ? "bg-gray-100 text-os-text" : "text-gray-400 hover:text-os-text"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => setView('list')}
                className={cn(
                  "p-1.5 rounded transition-all",
                  view === 'list' ? "bg-gray-100 text-os-text" : "text-gray-400 hover:text-os-text"
                )}
              >
                <List className="w-4 h-4" />
              </button>
           </div>
            <button 
              type="button"
              onClick={() => { setEditingProject(undefined); setShowModal(true); }}
              className="bg-brand text-white text-[10px] px-4 py-2 rounded font-bold hover:bg-os-dark transition-all uppercase tracking-wider flex items-center gap-2 shadow-sm shadow-brand/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Projeto
            </button>
        </div>
      </header>

      <div className="flex items-center gap-3 bg-white p-2 rounded border border-gray-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Pesquisar projetos, tags ou clientes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded text-xs focus:bg-white focus:border-gray-200 outline-none transition-all"
          />
        </div>
        <button type="button" className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-os-text text-[10px] font-bold uppercase tracking-widest border border-transparent hover:bg-gray-50 rounded transition-all">
          <Filter className="w-3.5 h-3.5" />
          Filtros
        </button>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => (
            <div key={project.id}>
               <ProjectCard project={project} onClick={() => setSelectedProjectId(project.id)} />
            </div>
          ))}
          <button 
            type="button"
            onClick={() => { setEditingProject(undefined); setShowModal(true); }}
            className="border-2 border-dashed border-gray-200 rounded p-12 flex flex-col items-center justify-center gap-3 grayscale opacity-30 hover:opacity-100 hover:border-brand hover:grayscale-0 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-brand/10">
               <Plus className="w-5 h-5 text-gray-400 group-hover:text-brand" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 group-hover:text-brand">Deploy New Project</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Projeto</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prazo</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Orçamento</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProjects.map(project => (
                <tr key={project.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-os-text">{project.name}</span>
                      <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{project.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                      {project.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] font-mono text-gray-500">
                    {new Date(project.startDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-[10px] font-mono font-bold text-os-text">
                    R$ {project.budget.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button type="button" className="text-gray-300 hover:text-os-text opacity-0 group-hover:opacity-100 transition-all">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <ProjectModal 
          onClose={() => setShowModal(false)}
          initialData={editingProject}
          onSave={async (data) => {
            if (editingProject) {
              await updateProject(editingProject.id, data);
            } else {
              await addProject(data);
            }
          }}
        />
      )}
    </div>
  );
}
