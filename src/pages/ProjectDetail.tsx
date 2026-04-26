import React, { useRef, useState } from 'react';
import { 
  BarChart3, 
  Calendar, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  CreditCard, 
  FileText, 
  History, 
  LayoutDashboard, 
  MoreVertical, 
  Plus, 
  Send, 
  Users,
  AlertCircle,
  FolderOpen,
  DollarSign,
  TrendingUp,
  TrendingDown,
  X
} from 'lucide-react';
import { Project, Milestone, TaskStatus, Task, Transaction } from '../types';
import { cn, formatDate, formatCurrency } from '../lib/utils';
import {
  useSupabaseMilestones as useMilestones,
  useSupabaseTasks as useTasks,
  useSupabaseProjectActivity as useProjectActivity,
  useSupabaseClients as useClients,
  useSupabaseTransactions as useTransactions,
  useSupabaseDocuments as useDocuments,
} from '../hooks/supabase';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onEdit: (project: Project) => void;
}

export default function ProjectDetail({ project, onBack, onEdit }: ProjectDetailProps) {
  const { milestones, loading: loadingMilestones, updateMilestone, addMilestone } = useMilestones(project.id);
  const { tasks, loading: loadingTasks, updateTask, addTask } = useTasks(project.id);
  const { activities, addActivity } = useProjectActivity(project.id);
  const { clients } = useClients();
  const { transactions } = useTransactions();
  const { documents, uploadDocument, downloadDocument } = useDocuments();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const client = clients.find(c => c.id === project.clientId);
  const projectTransactions = transactions.filter(t => t.projectId === project.id);
  const projectBalance = projectTransactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
  const projectDocuments = documents.filter(document => document.projectId === project.id);

  const [activeTab, setActiveTab ] = useState<'kanban' | 'milestones' | 'files' | 'finance' | 'activity'>('kanban');

  const [showNewMilestone, setShowNewMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('');

  const progress = project.progress || 0;

  const handleAddMilestone = async () => {
    if (!newMilestoneTitle) return;
    await addMilestone({
      projectId: project.id,
      title: newMilestoneTitle,
      order: milestones.length,
      status: 'pending'
    });
    setNewMilestoneTitle('');
    setShowNewMilestone(false);
    addActivity('Etapa Criada', `Nova etapa "${newMilestoneTitle}" adicionada ao projeto.`, 'Operador');
  };

  const handleAddTask = async () => {
    if (!newTaskTitle || !selectedMilestoneId) return;
    await addTask({
      projectId: project.id,
      milestoneId: selectedMilestoneId,
      title: newTaskTitle,
      status: 'todo',
      priority: 'medium',
      responsible: 'Operador',
      checklist: []
    });
    setNewTaskTitle('');
    setShowNewTask(false);
    addActivity('Tarefa Criada', `Nova tarefa "${newTaskTitle}" criada.`, 'Operador');
  };

  const handleMilestoneToggle = async (milestone: Milestone) => {
    const newStatus = milestone.status === 'completed' ? 'pending' : 'completed';
    await updateMilestone(milestone.id, { status: newStatus });
    addActivity(
      newStatus === 'completed' ? 'Etapa Concluída' : 'Etapa Reaberta',
      `O marco "${milestone.title}" foi marcado como ${newStatus === 'completed' ? 'concluído' : 'pendente'}.`,
      'Operador'
    );

  };

  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    await updateTask(taskId, { status: newStatus });
    addActivity(
      'Movimentação de Tarefa',
      `Tarefa "${task.title}" movida para ${newStatus}.`,
      'Operador'
    );
  };

  const handleProjectFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    try {
      await uploadDocument(selectedFile, {
        folder: 'Projetos',
        projectId: project.id,
        clientId: project.clientId || null,
      });
      addActivity('Arquivo Enviado', `Arquivo "${selectedFile.name}" vinculado ao projeto.`, 'Operador');
    } catch (error) {
      console.error('Project document upload failed:', error);
      window.alert('Nao foi possivel enviar o arquivo do projeto.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-os-bg overflow-hidden animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-100 p-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <button type="button" onClick={onBack} className="p-2 hover:bg-gray-50 rounded-full text-gray-400">
                <ChevronRight className="w-5 h-5 rotate-180" />
             </button>
             <div>
                <div className="flex items-center gap-2 mb-1">
                   <h2 className="text-2xl font-black text-os-text tracking-tight uppercase">{project.name}</h2>
                   <span className={cn(
                     "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest",
                     project.status === 'ongoing' ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                   )}>{project.status}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-gray-400 font-bold uppercase">
                   <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Termina em {formatDate(project.deadline)}</span>
                   <span className="flex items-center gap-1.5"><Users className="w-3 h-3" /> Cliente: {client?.name || 'Não vinculado'}</span>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <button
               type="button"
               onClick={() => onEdit(project)}
               className="px-4 py-2 border border-gray-200 rounded text-[10px] font-black uppercase tracking-widest text-os-text hover:border-brand hover:text-brand transition-all"
             >
               Editar Projeto
             </button>
             <div className="text-right">
                <div className="flex items-center justify-end gap-2 mb-1">
                   {project.paymentStatus === 'paid' ? (
                     <CheckCircle2 className="w-4 h-4 text-green-500" />
                   ) : (
                     <AlertCircle className="w-4 h-4 text-amber-500" />
                   )}
                   <span className="text-[10px] font-black uppercase tracking-widest text-os-text">Status Financeiro</span>
                </div>
                <p className={cn(
                  "text-lg font-black",
                  project.paymentStatus === 'paid' ? "text-green-500" : "text-amber-500"
                )}>
                  {project.paymentStatus === 'paid' ? 'DOCUMENTADO_PAGO' : 'PAGAMENTO_PENDENTE'}
                </p>
             </div>
          </div>
        </div>

        {/* Progress Bar (TDAH Friendly) */}
        <div className="max-w-7xl mx-auto mt-8">
           <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Progresso do Sistema</span>
              <span className="text-xs font-mono font-black text-brand">{progress}% COMPLETADO</span>
           </div>
           <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner flex">
              <div 
                className="h-full bg-brand transition-all duration-1000 ease-out relative"
                style={{ width: `${progress}%` }}
              >
                 <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
           </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-8">
          {[
            { id: 'kanban', label: 'Quadro Kanban', icon: LayoutDashboard },
            { id: 'milestones', label: 'Etapas de Entrega', icon: CheckCircle2 },
            { id: 'finance', label: 'Financeiro', icon: CreditCard },
            { id: 'files', label: 'Repositório Central', icon: FolderOpen },
            { id: 'activity', label: 'Log Técnico', icon: History },
          ].map(tab => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "py-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2",
                activeTab === tab.id ? "border-brand text-brand" : "border-transparent text-gray-400 hover:text-os-text"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto p-8">
           
           {activeTab === 'kanban' && (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-full min-h-[500px]">
                {/* Column structure */}
                {(['todo', 'doing', 'done'] as TaskStatus[]).map(status => (
                  <div key={status} className="flex flex-col gap-4">
                     <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                           <div className={cn(
                             "w-2 h-2 rounded-full",
                             status === 'todo' ? "bg-gray-300" : status === 'doing' ? "bg-brand" : "bg-green-500"
                           )}></div>
                           <h3 className="text-[10px] font-black uppercase tracking-widest text-os-text">
                              {status === 'todo' ? 'A Fazer' : status === 'doing' ? 'Executando' : 'Concluído'}
                           </h3>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">{tasks.filter(t => t.status === status).length}</span>
                     </div>
                     
                     <div className="flex-1 bg-gray-100/50 rounded-xl p-3 space-y-3 min-h-[400px]">
                        {tasks.filter(t => t.status === status).map(task => (
                          <div 
                            key={task.id} 
                            className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all group cursor-grab active:cursor-grabbing"
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                               e.preventDefault();
                               const droppedTaskId = e.dataTransfer.getData('taskId');
                               moveTask(droppedTaskId, status);
                            }}
                          >
                             <div className="flex items-start justify-between mb-2">
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded-[2px] text-[8px] font-bold uppercase",
                                  task.priority === 'urgent' ? "bg-red-50 text-red-600" :
                                  task.priority === 'high' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                                )}>{task.priority}</span>
                                <MoreVertical className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100" />
                             </div>
                             <h4 className="text-xs font-bold text-os-text leading-tight mb-2">{task.title}</h4>
                             <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                <span className="text-[9px] font-mono text-gray-400 uppercase">{task.responsible}</span>
                                {task.checklist.length > 0 && (
                                  <span className="text-[9px] font-mono font-bold text-brand">
                                     {task.checklist.filter(c => c.completed).length}/{task.checklist.length}
                                  </span>
                                )}
                             </div>
                          </div>
                        ))}
                        {status === 'todo' && (
                           <div className="space-y-2">
                              {showNewTask ? (
                                 <div className="bg-white p-4 rounded-lg border border-brand/20 shadow-lg animate-in slide-in-from-top-2 duration-200">
                                    <input 
                                       autoFocus
                                       type="text"
                                       value={newTaskTitle}
                                       onChange={(e) => setNewTaskTitle(e.target.value)}
                                       placeholder="Título da tarefa..."
                                       className="w-full text-xs font-bold text-os-text outline-none mb-3"
                                    />
                                    <select 
                                       value={selectedMilestoneId}
                                       onChange={(e) => setSelectedMilestoneId(e.target.value)}
                                       className="w-full text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-gray-50 px-2 py-1.5 rounded mb-4 outline-none"
                                    >
                                       <option value="">Vincular Etapa...</option>
                                       {milestones.map(m => (
                                          <option key={m.id} value={m.id}>{m.title}</option>
                                       ))}
                                    </select>
                                    <div className="flex gap-2">
                                       <button 
                                          type="button"
                                          onClick={() => setShowNewTask(false)}
                                          className="flex-1 py-2 text-[8px] font-black uppercase text-gray-400"
                                       >Cancelar</button>
                                       <button 
                                          type="button"
                                          onClick={handleAddTask}
                                          disabled={!newTaskTitle || !selectedMilestoneId}
                                          className="flex-[2] py-2 bg-brand text-white text-[8px] font-black uppercase rounded shadow-sm disabled:opacity-50"
                                       >Criar</button>
                                    </div>
                                 </div>
                              ) : (
                                 <button 
                                    type="button"
                                    onClick={() => setShowNewTask(true)}
                                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center gap-2 text-gray-300 hover:text-brand hover:border-brand transition-all"
                                 >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-black uppercase">Adicionar Tarefa</span>
                                 </button>
                              )}
                           </div>
                        )}
                     </div>
                  </div>
                ))}
             </div>
           )}

           {activeTab === 'milestones' && (
             <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-os-text">Estrutura de Macros</h3>
                   {showNewMilestone ? (
                      <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                         <input 
                           autoFocus
                           type="text"
                           value={newMilestoneTitle}
                           onChange={(e) => setNewMilestoneTitle(e.target.value)}
                           className="px-3 py-1.5 bg-white border border-gray-200 rounded text-[10px] font-bold outline-none focus:border-brand"
                           placeholder="Título da etapa..."
                         />
                         <button type="button" onClick={handleAddMilestone} className="px-3 py-1.5 bg-brand text-white rounded text-[9px] font-bold uppercase">Confirmar</button>
                         <button type="button" onClick={() => setShowNewMilestone(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
                      </div>
                   ) : (
                      <button 
                        type="button"
                        onClick={() => setShowNewMilestone(true)}
                        className="px-3 py-1.5 bg-os-dark text-white rounded text-[9px] font-bold uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                      >
                         <Plus className="w-3 h-3" /> Adicionar Etapa
                      </button>
                   )}
                </div>
                <div className="divide-y divide-gray-50">
                   {milestones.map((milestone, idx) => (
                     <div key={milestone.id} className="p-6 flex items-center justify-between group hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-6">
                           <div className="text-[10px] font-mono font-black text-gray-300">0{idx + 1}</div>
                           <div>
                              <h4 className={cn(
                                "text-sm font-bold tracking-tight",
                                milestone.status === 'completed' ? "text-gray-400 line-through" : "text-os-text"
                              )}>{milestone.title}</h4>
                              <p className="text-[10px] font-mono text-gray-400 uppercase mt-0.5">
                                 {tasks.filter(t => t.milestoneId === milestone.id).length} TAREFAS_VINCULADAS
                              </p>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <button 
                             type="button"
                             onClick={() => handleMilestoneToggle(milestone)}
                             className={cn(
                               "px-4 py-2 rounded text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                               milestone.status === 'completed' 
                                 ? "bg-green-50 text-green-600 border border-green-100" 
                                 : "bg-gray-100 text-gray-500 border border-transparent hover:bg-os-dark hover:text-white"
                             )}
                           >
                              {milestone.status === 'completed' ? 'CONCLUÍDO' : 'MARCAR_CONCLUÍDO'}
                           </button>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           )}

            {activeTab === 'finance' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                 <div className="md:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Resumo do Projeto</h3>
                       <div className="space-y-4">
                          <div className="flex justify-between">
                             <span className="text-[10px] font-bold text-gray-400 uppercase">Orçamento Total</span>
                             <span className="text-sm font-black text-os-text">{formatCurrency(project.budget)}</span>
                          </div>
                          <div className="flex justify-between">
                             <span className="text-[10px] font-bold text-gray-400 uppercase">Total Recebido</span>
                             <span className="text-sm font-black text-green-600">
                                {formatCurrency(projectTransactions.filter(t => t.type === 'income' && t.status === 'liquidated').reduce((a,b)=>a+b.amount,0))}
                             </span>
                          </div>
                          <div className="flex justify-between">
                             <span className="text-[10px] font-bold text-gray-400 uppercase">Total Despesas</span>
                             <span className="text-sm font-black text-red-600">
                                {formatCurrency(projectTransactions.filter(t => t.type === 'expense' && t.status === 'liquidated').reduce((a,b)=>a+b.amount,0))}
                             </span>
                          </div>
                          <div className="pt-4 border-t border-gray-100 flex justify-between">
                             <span className="text-[10px] font-black uppercase text-os-text">Margem Atual</span>
                             <span className="text-sm font-black text-os-text">{formatCurrency(projectBalance)}</span>
                          </div>
                       </div>
                    </div>

                    <div className="bg-os-dark text-white p-6 rounded-xl shadow-lg relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-all"><Plus className="w-24 h-24" /></div>
                       <h3 className="text-[10px] font-black uppercase tracking-widest mb-2 relative z-10">Solicitar Adiantamento</h3>
                       <p className="text-[10px] text-gray-400 mb-6 relative z-10">Gere um link de pagamento rápido para o cliente com um clique.</p>
                       <button type="button" className="w-full py-2.5 bg-brand text-white rounded text-[10px] font-black uppercase tracking-widest relative z-10">Gerar Link PIX</button>
                    </div>
                 </div>

                 <div className="md:col-span-8 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Fluxo de Caixa do Projeto</h3>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full text-left">
                          <thead>
                             <tr className="bg-gray-50/30 border-b border-gray-50">
                                <th className="px-6 py-3 text-[8px] font-black text-gray-400 uppercase">Data</th>
                                <th className="px-6 py-3 text-[8px] font-black text-gray-400 uppercase">Descrição</th>
                                <th className="px-6 py-3 text-[8px] font-black text-gray-400 uppercase">Status</th>
                                <th className="px-6 py-3 text-[8px] font-black text-gray-400 uppercase">Valor</th>
                             </tr>
                          </thead>
                          <tbody>
                             {projectTransactions.map(tx => (
                               <tr key={tx.id} className="border-b border-gray-50 text-[10px]">
                                  <td className="px-6 py-4 font-mono text-gray-400">{formatDate(tx.date)}</td>
                                  <td className="px-6 py-4 font-bold text-os-text">{tx.description}</td>
                                  <td className="px-6 py-4">
                                     <span className={cn(
                                       "px-2 py-0.5 rounded-[2px] text-[8px] font-black uppercase tracking-widest",
                                       tx.status === 'liquidated' ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                                     )}>{tx.status}</span>
                                  </td>
                                  <td className={cn("px-6 py-4 font-black", tx.type === 'income' ? "text-green-600" : "text-red-500")}>
                                     {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                                  </td>
                               </tr>
                             ))}
                             {projectTransactions.length === 0 && (
                               <tr>
                                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-[10px] font-bold uppercase italic">Nenhum lançamento vinculado a este projeto.</td>
                               </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'files' && (
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => void handleProjectFileSelection(event)}
                />
                {projectDocuments.length === 0 && (
                  <div className="md:col-span-4 bg-white p-8 rounded-xl border border-gray-100 shadow-sm text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
                    Nenhum arquivo vinculado a este projeto.
                  </div>
                )}
                {projectDocuments.map((file) => (
                  <div key={file.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4 group hover:border-brand transition-all cursor-pointer">
                     <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center text-gray-300 group-hover:text-brand bg-brand/5">
                        <FileText className="w-5 h-5 text-brand" />
                     </div>
                     <div>
                        <h4 className="text-xs font-bold text-os-text truncate">{file.displayName}</h4>
                        <p className="text-[9px] font-mono text-gray-400 uppercase mt-1">
                          {Math.max(1, Math.round(file.sizeBytes / 1024))} KB • {(file.fileExtension || 'file').toUpperCase()}
                        </p>
                     </div>
                     <div className="flex gap-2">
                        <button type="button" onClick={() => void downloadDocument(file)} className="flex-1 py-1.5 bg-gray-50 text-[8px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-100 rounded">DOWNLOAD</button>
                        <button type="button" onClick={() => void downloadDocument(file)} className="flex-1 py-1.5 bg-gray-50 text-[8px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-100 rounded">VISUALIZAR</button>
                     </div>
                  </div>
                ))}
                {false && [
                  { name: 'Proposta Comercial.pdf', size: '2.4 MB', type: 'PDF' },
                  { name: 'Contrato Assinado.pdf', size: '1.1 MB', type: 'PDF' },
                  { name: 'Manual da Marca.zip', size: '42 MB', type: 'ZIP' },
                ].map((file, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4 group hover:border-brand transition-all cursor-pointer">
                     <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center text-gray-300 group-hover:text-brand bg-brand/5">
                        <FileText className="w-5 h-5 text-brand" />
                     </div>
                     <div>
                        <h4 className="text-xs font-bold text-os-text truncate">{file.name}</h4>
                        <p className="text-[9px] font-mono text-gray-400 uppercase mt-1">{file.size} • {file.type}</p>
                     </div>
                     <div className="flex gap-2">
                        <button type="button" className="flex-1 py-1.5 bg-gray-50 text-[8px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-100 rounded">DOWNLOAD</button>
                        <button type="button" className="flex-1 py-1.5 bg-gray-50 text-[8px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-100 rounded">VISUALIZAR</button>
                     </div>
                  </div>
                ))}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 opacity-30 hover:opacity-100 hover:border-brand transition-all">
                   <Plus className="w-6 h-6 text-gray-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Upload Mídia</span>
                </button>
             </div>
           )}

           {activeTab === 'activity' && (
             <div className="max-w-2xl mx-auto space-y-6">
                {activities.map((log) => (
                  <div key={log.id} className="flex gap-4 relative">
                     <div className="w-[1px] h-full bg-gray-100 absolute left-[15px] top-8"></div>
                     <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 relative z-10">
                        <Clock className="w-3.5 h-3.5 text-gray-300" />
                     </div>
                     <div className="flex-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                           <h4 className="text-xs font-black text-os-text uppercase tracking-widest">{log.action}</h4>
                           <span className="text-[9px] font-mono text-gray-300">{formatDate(log.timestamp)}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{log.details}</p>
                        <p className="text-[9px] font-bold text-brand uppercase tracking-tighter mt-2">POR: {log.userName}</p>
                     </div>
                  </div>
                ))}
             </div>
           )}

        </div>
      </div>
    </div>
  );
}
