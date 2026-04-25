import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Plus,
  Video,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useSupabaseProjects, useSupabaseTransactions } from '../hooks/supabase';
import { useRepositoryContext } from '../hooks/supabase/useRepositoryContext';

type CalendarEventType = 'meeting' | 'review' | 'deadline';

type CalendarEvent = {
  id: string;
  dayKey: string;
  timestamp: number;
  title: string;
  subtitle: string;
  time: string;
  type: CalendarEventType;
  projectId?: string;
  target: 'project' | 'finance';
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  status: 'todo' | 'doing' | 'done';
  due_date: string | null;
};

function startOfDayTimestamp(value: number) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatDayKey(value: number) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMonthLabel(value: Date) {
  return value.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

function getCalendarGrid(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - firstWeekday);

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function getEventIcon(type: CalendarEventType) {
  if (type === 'meeting') return Video;
  if (type === 'deadline') return Clock;
  return FileText;
}

interface CalendarProps {
  onOpenProject: (projectId: string) => void;
  onOpenFinance: () => void;
  onCreateTransaction: (timestamp: number) => void;
}

export default function Calendar({ onOpenProject, onOpenFinance, onCreateTransaction }: CalendarProps) {
  const { projects, loading: loadingProjects } = useSupabaseProjects();
  const { transactions, loading: loadingTransactions } = useSupabaseTransactions();
  const { supabase, organizationId } = useRepositoryContext();
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [taskRows, setTaskRows] = React.useState<TaskRow[]>([]);
  const [loadingTasks, setLoadingTasks] = React.useState(Boolean(organizationId));
  const today = React.useMemo(() => startOfDayTimestamp(Date.now()), []);

  React.useEffect(() => {
    const loadTasks = async () => {
      if (!organizationId) {
        setTaskRows([]);
        setLoadingTasks(false);
        return;
      }

      setLoadingTasks(true);

      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, project_id, title, status, due_date')
          .eq('organization_id', organizationId)
          .not('due_date', 'is', null)
          .order('due_date', { ascending: true });

        if (error) {
          throw error;
        }

        setTaskRows((data as TaskRow[] | null) ?? []);
      } catch (error) {
        console.warn('Supabase calendar tasks load failed:', error);
        setTaskRows([]);
      } finally {
        setLoadingTasks(false);
      }
    };

    void loadTasks();
  }, [organizationId, supabase]);

  const projectMap = React.useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const events = React.useMemo(() => {
    const nextEvents: CalendarEvent[] = [];

    projects.forEach((project) => {
      nextEvents.push({
        id: `project-${project.id}`,
        dayKey: formatDayKey(project.deadline),
        timestamp: project.deadline,
        title: project.name,
        subtitle: 'Prazo do projeto',
        time: formatTime(project.deadline),
        type: 'deadline',
        projectId: project.id,
        target: 'project',
      });
    });

    taskRows
      .filter((task) => task.status !== 'done' && task.due_date)
      .forEach((task) => {
        const dueDate = new Date(task.due_date as string).getTime();
        const project = projectMap.get(task.project_id);

        nextEvents.push({
          id: `task-${task.id}`,
          dayKey: formatDayKey(dueDate),
          timestamp: dueDate,
          title: task.title,
          subtitle: project ? `Tarefa - ${project.name}` : 'Tarefa pendente',
          time: formatTime(dueDate),
          type: 'review',
          projectId: task.project_id,
          target: project ? 'project' : 'finance',
        });
      });

    transactions
      .filter((transaction) => transaction.status !== 'liquidated')
      .forEach((transaction) => {
        nextEvents.push({
          id: `transaction-${transaction.id}`,
          dayKey: formatDayKey(transaction.dueDate),
          timestamp: transaction.dueDate,
          title: transaction.description,
          subtitle: transaction.type === 'income' ? 'Recebimento previsto' : 'Pagamento previsto',
          time: formatTime(transaction.dueDate),
          type: 'meeting',
          target: 'finance',
        });
      });

    return nextEvents.sort((left, right) => left.timestamp - right.timestamp);
  }, [projectMap, projects, taskRows, transactions]);

  const monthDays = React.useMemo(() => getCalendarGrid(currentMonth), [currentMonth]);

  const visibleMonthEvents = React.useMemo(
    () =>
      events.filter((event) => {
        const eventDate = new Date(event.timestamp);
        return (
          eventDate.getFullYear() === currentMonth.getFullYear() &&
          eventDate.getMonth() === currentMonth.getMonth()
        );
      }),
    [currentMonth, events],
  );

  const upcomingEvents = React.useMemo(
    () => events.filter((event) => event.timestamp >= today).slice(0, 3),
    [events, today],
  );

  const loading = loadingProjects || loadingTransactions || loadingTasks;

  const handleOpenEvent = React.useCallback(
    (event: CalendarEvent) => {
      if (event.target === 'project' && event.projectId) {
        onOpenProject(event.projectId);
        return;
      }

      onOpenFinance();
    },
    [onOpenFinance, onOpenProject],
  );

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">
              Schedule
            </span>
            <span className="text-[10px] font-mono text-gray-400">
              UPCOMING_EVENTS: {visibleMonthEvents.length}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-os-text tracking-tight">Calendario de Atividades</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white border border-gray-100 rounded px-3 py-1 shadow-sm">
            <button
              type="button"
              onClick={() =>
                setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))
              }
              className="p-1 hover:bg-gray-50 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <span className="text-xs font-bold text-os-text px-4 uppercase tracking-widest">
              {formatMonthLabel(currentMonth)}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))
              }
              className="p-1 hover:bg-gray-50 rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
            className="bg-brand text-white text-[10px] px-4 py-2 rounded font-bold hover:bg-os-dark transition-all uppercase tracking-wider flex items-center gap-2 shadow-sm shadow-brand/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Hoje
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-7 border-t border-l border-gray-100 bg-white">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((day) => (
          <div
            key={day}
            className="p-3 border-r border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center"
          >
            {day}
          </div>
        ))}
        {monthDays.map((day, index) => {
          const dayTimestamp = startOfDayTimestamp(day.getTime());
          const isToday = dayTimestamp === today;
          const isOutOfMonth = day.getMonth() !== currentMonth.getMonth();
          const dayEvents = visibleMonthEvents.filter((event) => event.dayKey === formatDayKey(dayTimestamp));

          return (
            <div
              key={`${day.toISOString()}-${index}`}
              className={cn(
                'min-h-[120px] p-2 border-r border-b border-gray-100 transition-colors hover:bg-gray-50/50 relative group',
                isOutOfMonth ? 'bg-gray-50/20 opacity-30 pointer-events-none' : '',
              )}
            >
              <span
                className={cn(
                  'text-[10px] font-mono font-bold w-6 h-6 flex items-center justify-center rounded-full mb-2 transition-all',
                  isToday ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-400 group-hover:text-os-text',
                )}
              >
                {day.getDate()}
              </span>

              <div className="space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    title={`${event.subtitle} • ${event.time}`}
                    onClick={() => handleOpenEvent(event)}
                    className={cn(
                      'p-1.5 rounded-[2px] border text-[9px] font-bold truncate leading-tight transition-transform hover:scale-[1.02] cursor-pointer',
                      event.type === 'meeting'
                        ? 'bg-blue-50 border-blue-100 text-blue-600'
                        : event.type === 'deadline'
                          ? 'bg-red-50 border-red-100 text-red-600'
                          : 'bg-amber-50 border-amber-100 text-amber-600',
                    )}
                  >
                    <span className="opacity-60 mr-1">{event.time}</span>
                    {event.title}
                  </div>
                ))}
              </div>

              {!isOutOfMonth && (
                <button
                  type="button"
                  onClick={() => onCreateTransaction(dayTimestamp)}
                  className="absolute bottom-2 right-2 p-1 bg-white border border-gray-100 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-brand hover:border-brand shadow-sm transition-all"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {loading && (
          <div className="md:col-span-3 bg-white p-6 rounded border border-gray-100 shadow-sm text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
            Carregando agenda operacional...
          </div>
        )}
        {!loading &&
          upcomingEvents.map((item) => {
            const Icon = getEventIcon(item.type);

            return (
              <div
                key={item.id}
                onClick={() => handleOpenEvent(item)}
                className="bg-white p-4 rounded border border-gray-100 shadow-sm flex items-center gap-4 group hover:border-brand transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-brand transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-mono text-gray-400 font-bold mb-0.5">{item.time}</p>
                  <h4 className="text-xs font-bold text-os-text leading-tight">{item.title}</h4>
                  <p className="text-[9px] font-mono text-gray-300 uppercase mt-1">{item.subtitle}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-os-text transform group-hover:translate-x-1 transition-all" />
              </div>
            );
          })}
        {!loading && upcomingEvents.length === 0 && (
          <div className="md:col-span-3 bg-white p-6 rounded border border-gray-100 shadow-sm text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
            Nenhum compromisso futuro encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
