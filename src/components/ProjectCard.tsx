import React from 'react';
import { Target, Calendar, BarChart2 } from 'lucide-react';
import { Project } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';

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

export default function ProjectCard({ project, onClick }: { project: Project, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white p-4 rounded border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col cursor-pointer hover:border-brand/20",
        project.status === 'completed' && "opacity-80"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider",
          STATUS_COLORS[project.status]
        )}>
          {STATUS_LABELS[project.status]}
        </span>
        <span className="text-[10px] font-mono text-gray-400">#{project.id.slice(0, 5)}</span>
      </div>
      
      <h3 className="font-bold text-os-text text-sm mb-1 leading-tight">{project.name}</h3>
      <p className="text-gray-500 text-[11px] mb-4 line-clamp-2 leading-normal flex-1">
        {project.description}
      </p>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1.5 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
          <Calendar className="w-3 h-3 text-brand" />
          <span className="text-[10px] font-mono font-medium text-gray-600">{formatDate(project.startDate)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-right justify-end grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
          <Target className="w-3 h-3 text-brand" />
          <span className="text-[10px] font-mono font-bold text-gray-800">{formatCurrency(project.budget)}</span>
        </div>
      </div>
    </div>
  );
}

import { Briefcase } from 'lucide-react';
