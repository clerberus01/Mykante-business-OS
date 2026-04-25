import React from 'react';
import { TrendingUp, Users, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import ProjectCard from '../components/ProjectCard';
import TaskItem from '../components/TaskItem';
import { cn, formatCurrency } from '../lib/utils';
import { useSupabaseDashboard } from '../hooks/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard({ onOpenProject }: { onOpenProject?: (projectId: string) => void }) {
  const { user } = useAuth();
  const { loading, summary, featuredProjects, backlogTasks } = useSupabaseDashboard();

  const stats = [
    {
      label: 'Receita Mensal',
      value: formatCurrency(summary.monthlyIncome),
      icon: TrendingUp,
      delta: summary.monthlyIncome > 0 ? 'SUPABASE_LIVE' : 'SEM_BAIXAS',
      color: 'text-brand',
      deltaClassName:
        summary.monthlyIncome > 0
          ? 'text-green-500 bg-green-50 border-green-100'
          : 'text-gray-500 bg-gray-50 border-gray-100',
    },
    {
      label: 'Clientes Ativos',
      value: String(summary.activeClients).padStart(2, '0'),
      icon: Users,
      delta: `${summary.activeClients}_NA_BASE`,
      color: 'text-os-text',
      deltaClassName: 'text-os-text bg-gray-50 border-gray-100',
    },
    {
      label: 'Projetos Ativos',
      value: String(summary.activeProjects).padStart(2, '0'),
      icon: CheckCircle2,
      delta: `${summary.overdueProjects}_ATRASADO${summary.overdueProjects === 1 ? '' : 'S'}`,
      color: summary.overdueProjects > 0 ? 'text-amber-500' : 'text-green-500',
      deltaClassName:
        summary.overdueProjects > 0
          ? 'text-amber-600 bg-amber-50 border-amber-100'
          : 'text-green-500 bg-green-50 border-green-100',
    },
    {
      label: 'Acoes Pendentes',
      value: String(summary.pendingTasks).padStart(2, '0'),
      icon: Clock,
      delta: `${summary.urgentTasks}_URGENTE${summary.urgentTasks === 1 ? '' : 'S'}`,
      color: summary.urgentTasks > 0 ? 'text-orange-500' : 'text-os-text',
      deltaClassName:
        summary.urgentTasks > 0
          ? 'text-orange-500 bg-orange-50 border-orange-100'
          : 'text-gray-500 bg-gray-50 border-gray-100',
    },
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase opacity-40">
            Loading Dashboard...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">
            Sistema Operacional
          </span>
          <span className="text-[10px] font-mono text-gray-400">SESSAO_ESTAVEL: 100%</span>
        </div>
        <h2 className="text-2xl font-bold text-os-text tracking-tight">
          Bom dia, {user?.displayName || user?.email?.split('@')[0] || 'Operador'}.{' '}
          <span className="text-brand font-black">!</span>
        </h2>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-white p-4 rounded border border-gray-100 shadow-sm hover:border-gray-200 transition-all group overflow-hidden relative"
          >
            <div className="flex items-start justify-between mb-3 relative z-10">
              <div className={cn('p-1.5 rounded bg-gray-50', stat.color)}>
                <stat.icon className="w-4 h-4" />
              </div>
              <span className={cn('text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border', stat.deltaClassName)}>
                {stat.delta}
              </span>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5 relative z-10">
              {stat.label}
            </p>
            <p className="text-xl font-mono font-bold text-os-text tracking-tighter relative z-10">{stat.value}</p>
            <div className="absolute bottom-[-10px] right-[-10px] opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
              <stat.icon className="w-20 h-20 rotate-[-15deg]" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Projetos em Destaque</h3>
            <button
              type="button"
              className="text-[10px] font-bold text-brand hover:underline transition-all uppercase tracking-widest"
            >
              Visualizar Registros
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredProjects.map((project) => (
              <div key={project.id}>
                <ProjectCard project={project} onClick={() => onOpenProject?.(project.id)} />
              </div>
            ))}
            {featuredProjects.length === 0 && (
              <div className="md:col-span-2 bg-white p-6 rounded border border-gray-100 text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
                Nenhum projeto disponivel na base.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Sprint Backlog</h3>
            <button
              type="button"
              className="text-[10px] font-bold text-brand hover:underline transition-all uppercase tracking-widest"
            >
              Quadro
            </button>
          </div>
          <div className="space-y-2">
            {backlogTasks.map((task) => (
              <div key={task.id}>
                <TaskItem task={task} />
              </div>
            ))}
            {backlogTasks.length === 0 && (
              <div className="bg-white p-6 rounded border border-gray-100 text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
                Nenhuma tarefa pendente no backlog.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
