import React from 'react';
import { Target, Calendar, MoreHorizontal } from 'lucide-react';
import { Project } from '@/src/types';
import { formatCurrency, formatDate, cn } from '@/src/lib/utils';

const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-500',
  ongoing: 'bg-blue-50 text-blue-500',
  paused: 'bg-amber-50 text-amber-500',
  completed: 'bg-green-50 text-green-500',
  cancelled: 'bg-red-50 text-red-500',
};

const STATUS_LABELS = {
  draft: 'Rascunho',
  ongoing: 'Em Andamento',
  paused: 'Pausado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export default function ProjectCard({
  project,
  onClick,
  onEdit,
}: {
  project: Project;
  onClick?: () => void;
  onEdit?: () => void;
}) {
  const projectStatus = Object.hasOwn(STATUS_COLORS, project.status) ? project.status : 'draft';
  const projectId = typeof project.id === 'string' ? project.id : 'sem-id';
  const projectName = project.name || 'Projeto sem nome';
  const projectDescription = project.description || 'Sem descrição cadastrada.';
  const projectStartDate =
    typeof project.startDate === 'number' || typeof project.startDate === 'string'
      ? formatDate(project.startDate)
      : '--/--/----';
  const projectBudget =
    typeof project.budget === 'number' && Number.isFinite(project.budget)
      ? formatCurrency(project.budget)
      : formatCurrency(0);

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white p-4 rounded border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col cursor-pointer hover:border-brand/20",
        projectStatus === 'completed' && "opacity-80"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider",
          STATUS_COLORS[projectStatus]
        )}>
          {STATUS_LABELS[projectStatus]}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-400">#{projectId.slice(0, 5)}</span>
          {onEdit && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="p-1 rounded text-gray-300 hover:text-os-text hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-all"
              title="Editar projeto"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      
      <h3 className="font-bold text-os-text text-sm mb-1 leading-tight">{projectName}</h3>
      <p className="text-gray-500 text-[11px] mb-4 line-clamp-2 leading-normal flex-1">
        {projectDescription}
      </p>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1.5 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
          <Calendar className="w-3 h-3 text-brand" />
          <span className="text-[10px] font-mono font-medium text-gray-600">{projectStartDate}</span>
        </div>
        <div className="flex items-center gap-1.5 text-right justify-end grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
          <Target className="w-3 h-3 text-brand" />
          <span className="text-[10px] font-mono font-bold text-gray-800">{projectBudget}</span>
        </div>
      </div>
    </div>
  );
}
