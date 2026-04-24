import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  Calendar as CalendarIcon,
  Video,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Calendar() {
  const days = Array.from({ length: 35 }, (_, i) => i - 3); // Mock calendar days
  const today = 18;

  const events = [
    { day: 18, title: 'Reunião de Alinhamento', time: '10:00', type: 'meeting' },
    { day: 18, title: 'Revisão de Design - Mykante', time: '14:30', type: 'review' },
    { day: 20, title: 'Entrega Sprint 1', time: '09:00', type: 'deadline' },
    { day: 22, title: 'Workshop Branding', time: '16:00', type: 'meeting' },
  ];

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">Schedule</span>
              <span className="text-[10px] font-mono text-gray-400">UPCOMING_EVENTS: 12</span>
           </div>
           <h2 className="text-2xl font-bold text-os-text tracking-tight">Calendário de Atividades</h2>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex items-center bg-white border border-gray-100 rounded px-3 py-1 shadow-sm">
              <button className="p-1 hover:bg-gray-50 rounded transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-400" />
              </button>
              <span className="text-xs font-bold text-os-text px-4 uppercase tracking-widest">Abril 2026</span>
              <button className="p-1 hover:bg-gray-50 rounded transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
           </div>
           <button className="bg-brand text-white text-[10px] px-4 py-2 rounded font-bold hover:bg-os-dark transition-all uppercase tracking-wider flex items-center gap-2 shadow-sm shadow-brand/20">
             <Plus className="w-3.5 h-3.5" />
             Novo Evento
           </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-7 border-t border-l border-gray-100 bg-white">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
          <div key={day} className="p-3 border-r border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
            {day}
          </div>
        ))}
        {days.map((day, i) => {
          const isToday = day === today;
          const dayEvents = events.filter(e => e.day === day);
          
          return (
            <div 
              key={i} 
              className={cn(
                "min-h-[120px] p-2 border-r border-b border-gray-100 transition-colors hover:bg-gray-50/50 relative group",
                day < 1 || day > 30 ? "bg-gray-50/20 opacity-30 pointer-events-none" : ""
              )}
            >
              <span className={cn(
                "text-[10px] font-mono font-bold w-6 h-6 flex items-center justify-center rounded-full mb-2 transition-all",
                isToday ? "bg-brand text-white shadow-lg shadow-brand/20" : "text-gray-400 group-hover:text-os-text"
              )}>
                {day > 0 && day <= 30 ? day : ''}
              </span>
              
              <div className="space-y-1">
                {dayEvents.map((event, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "p-1.5 rounded-[2px] border text-[9px] font-bold truncate leading-tight transition-transform hover:scale-[1.02] cursor-pointer",
                      event.type === 'meeting' ? "bg-blue-50 border-blue-100 text-blue-600" :
                      event.type === 'deadline' ? "bg-red-50 border-red-100 text-red-600" :
                      "bg-amber-50 border-amber-100 text-amber-600"
                    )}
                  >
                    <span className="opacity-60 mr-1">{event.time}</span>
                    {event.title}
                  </div>
                ))}
              </div>

              {day > 0 && day <= 30 && (
                <button className="absolute bottom-2 right-2 p-1 bg-white border border-gray-100 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-brand hover:border-brand shadow-sm transition-all">
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar de Eventos Próximos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
         {[
           { time: '10:00 AM', title: 'Daily Sync - Squad Alpha', type: 'meeting', icon: Video },
           { time: '02:00 PM', title: 'Aprovação de Proposta #421', type: 'review', icon: FileText },
           { time: '05:30 PM', title: 'Review Semanal', type: 'meeting', icon: Clock },
         ].map((item, i) => (
           <div key={i} className="bg-white p-4 rounded border border-gray-100 shadow-sm flex items-center gap-4 group hover:border-brand transition-all cursor-pointer">
              <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-brand transition-colors">
                 <item.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                 <p className="text-[10px] font-mono text-gray-400 font-bold mb-0.5">{item.time}</p>
                 <h4 className="text-xs font-bold text-os-text leading-tight">{item.title}</h4>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-os-text transform group-hover:translate-x-1 transition-all" />
           </div>
         ))}
      </div>
    </div>
  );
}
