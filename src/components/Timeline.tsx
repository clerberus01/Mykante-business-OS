import React from 'react';
import { Mail, Phone, FileText, StickyNote, MoreVertical, Clock } from 'lucide-react';
import { TimelineEvent } from '../types';
import { formatDate, cn } from '../lib/utils';

const ICON_MAP = {
  email: Mail,
  whatsapp: Phone,
  note: StickyNote,
  file: FileText,
  system: Clock,
};

const COLOR_MAP = {
  email: 'text-blue-500 bg-blue-50',
  whatsapp: 'text-green-500 bg-green-50',
  note: 'text-amber-500 bg-amber-50',
  file: 'text-purple-500 bg-purple-50',
  system: 'text-slate-400 bg-slate-50',
};

export default function Timeline({ events, onDelete }: { events: TimelineEvent[], onDelete?: (id: string) => void }) {
  const handleDeleteClick = (eventId: string) => {
    if (!onDelete) {
      return;
    }

    if (!window.confirm('Deseja realmente excluir este evento da timeline?')) {
      return;
    }

    onDelete(eventId);
  };

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Clock className="w-10 h-10 mb-4 opacity-10" />
        <p className="text-xs font-bold uppercase tracking-widest">Nenhum histórico de atividade.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px before:h-full before:w-[1px] before:bg-gray-100">
      {events.map((event) => {
        const Icon = ICON_MAP[event.type] || Clock;
        return (
          <div key={event.id} className="relative pl-8 group">
            <div className={cn(
              "absolute left-[-2px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 transition-transform group-hover:scale-125",
              event.type === 'email' ? 'bg-blue-500' :
              event.type === 'whatsapp' ? 'bg-green-500' :
              event.type === 'note' ? 'bg-brand' :
              'bg-gray-300'
            )}></div>
            
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter">
                    {formatDate(event.createdAt)} • {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest border",
                    COLOR_MAP[event.type].replace('text-', 'border-').split(' ')[1] || 'border-gray-100'
                  )}>
                    {event.type}
                  </span>
                </div>
                {onDelete && (
                  <button 
                    type="button"
                    onClick={() => handleDeleteClick(event.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all"
                    title="Excluir evento"
                    aria-label="Excluir evento"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              <div className="bg-white p-3 rounded border border-gray-100 shadow-sm hover:border-gray-200 transition-all">
                <h4 className="font-bold text-os-text text-xs mb-1">{event.title}</h4>
                <p className="text-gray-500 text-[11px] leading-relaxed whitespace-pre-wrap">
                  {event.content}
                </p>
                {event.metadata && (
                  <div className="mt-2 pt-2 border-t border-gray-50 flex flex-wrap gap-1">
                    {Object.entries(event.metadata).map(([key, value]) => (
                      <span key={key} className="px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded-[2px] text-[9px] font-mono border border-gray-100 uppercase">
                        {key}:{String(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
