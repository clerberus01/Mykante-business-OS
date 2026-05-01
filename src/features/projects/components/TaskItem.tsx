import React from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { Task } from '@/src/types';
import { cn, formatDate } from '@/src/lib/utils';

const PRIORITY_COLORS = {
  low: 'border-slate-200 text-slate-400',
  medium: 'border-blue-200 text-blue-500',
  high: 'border-orange-200 text-orange-500',
  urgent: 'border-red-200 text-red-500',
};

const PRIORITY_LABELS = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export default function TaskItem({ task }: { task: Task }) {
  const isDone = task.status === 'done';

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 bg-white rounded border border-gray-100 group hover:border-gray-200 transition-all duration-200",
      isDone && "opacity-50"
    )}>
      <button className="shrink-0 transition-transform active:scale-90">
        {isDone ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <Circle className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        <h4 className={cn(
          "font-bold text-[11px] truncate leading-tight",
          isDone ? "text-gray-400 line-through" : "text-os-text"
        )}>
          {task.title}
        </h4>
        <div className="flex items-center gap-2 mt-0.5">
          {task.dueDate && (
            <div className="flex items-center gap-1 text-[9px] text-gray-400 font-mono">
              <Clock className="w-2.5 h-2.5" />
              {formatDate(task.dueDate)}
            </div>
          )}
          <span className={cn(
            "px-1.5 py-0.5 rounded-[2px] border text-[8px] font-bold uppercase tracking-wider",
            PRIORITY_COLORS[task.priority]
          )}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1 px-2 text-gray-400 hover:text-os-text hover:bg-gray-50 rounded text-[9px] font-bold uppercase">Editar</button>
      </div>
    </div>
  );
}
