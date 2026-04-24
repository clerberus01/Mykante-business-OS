import React from 'react';
import { TrendingUp, Users, CheckCircle2, Clock } from 'lucide-react';
import { Project, Task } from '../types';
import ProjectCard from '../components/ProjectCard';
import TaskItem from '../components/TaskItem';
import { mockProjects, mockTasks } from '../constants';
import { cn } from '../lib/utils';

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">Sistema Operacional</span>
           <span className="text-[10px] font-mono text-gray-400">SESSÃO_ESTÁVEL: 100%</span>
        </div>
        <h2 className="text-2xl font-bold text-os-text tracking-tight">Bom dia, Clerberus. <span className="text-brand font-black">!</span></h2>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Receita Mensal', value: 'R$ 12.450', icon: TrendingUp, delta: '+12%', color: 'text-brand' },
          { label: 'Clientes Ativos', value: '18', icon: Users, delta: '+2', color: 'text-os-text' },
          { label: 'Projetos Ativos', value: '06', icon: CheckCircle2, delta: '0 ATRASADO', color: 'text-green-500' },
          { label: 'Ações Pendentes', value: '12', icon: Clock, delta: '4 URGENTE', color: 'text-orange-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded border border-gray-100 shadow-sm hover:border-gray-200 transition-all group overflow-hidden relative">
            <div className="flex items-start justify-between mb-3 relative z-10">
              <div className={cn("p-1.5 rounded bg-gray-50", stat.color)}>
                <stat.icon className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-mono font-bold text-green-500 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">{stat.delta}</span>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5 relative z-10">{stat.label}</p>
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
            <button className="text-[10px] font-bold text-brand hover:underline transition-all uppercase tracking-widest">Visualizar Registros</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockProjects.map(project => (
              <div key={project.id}>
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Sprint Backlog</h3>
            <button className="text-[10px] font-bold text-brand hover:underline transition-all uppercase tracking-widest">Quadro</button>
          </div>
          <div className="space-y-2">
            {mockTasks.map(task => (
              <div key={task.id}>
                <TaskItem task={task} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
