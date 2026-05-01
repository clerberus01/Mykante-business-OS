import React, { useState } from 'react';
import { X, Loader2, Calendar, Target, DollarSign, Users, Info } from 'lucide-react';
import { Project, ProjectStatus, PaymentStatus, ProjectTemplate } from '@/src/types';
import { useSupabaseClients as useClients } from '@/src/hooks/supabase';
import { projectFormSchema } from '@/src/schemas';

interface ProjectModalProps {
  onClose: () => void;
  onSave: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'progress'>, templateId?: string) => Promise<void>;
  initialData?: Project;
  onDelete?: () => Promise<void>;
  templates?: ProjectTemplate[];
}

export default function ProjectModal({ onClose, onSave, initialData, onDelete, templates = [] }: ProjectModalProps) {
  const { clients } = useClients();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    clientId: initialData?.clientId || '',
    description: initialData?.description || '',
    status: initialData?.status || 'draft' as ProjectStatus,
    startDate: initialData?.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    deadline: initialData?.deadline ? new Date(initialData.deadline).toISOString().split('T')[0] : '',
    budget: initialData?.budget || 0,
    paymentStatus: initialData?.paymentStatus || 'pending' as PaymentStatus,
    templateId: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId) {
      alert('Selecione um cliente para vincular ao projeto.');
      return;
    }
    
    setLoading(true);
    try {
      const parsedForm = projectFormSchema.parse(formData);
      const { templateId, ...projectData } = parsedForm;
      await onSave({
        ...projectData,
        startDate: new Date(parsedForm.startDate).toISOString(),
        deadline: new Date(parsedForm.deadline).toISOString(),
      }, templateId || undefined);
      onClose();
    } catch (error) {
      console.error('Error saving project:', error);
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel salvar o projeto.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData || !onDelete) return;
    if (!window.confirm(`Deseja realmente excluir o projeto "${initialData.name}"?`)) {
      return;
    }

    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Error deleting project:', error);
      window.alert('Nao foi possivel excluir o projeto.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-os-dark/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-os-text tracking-tight uppercase">
              {initialData ? 'Editar Projeto' : 'Novo Projeto_Setup'}
            </h2>
            <p className="text-[10px] font-mono text-gray-400 font-bold uppercase mt-1">Configuração de camada estrutural</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <Target className="w-3 h-3" /> Nome do Projeto
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-bold text-os-text focus:bg-white focus:border-brand outline-none transition-all"
                  placeholder="Ex: Redesign E-commerce 2024"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <Users className="w-3 h-3" /> Cliente Vinculado
                </label>
                <select
                  required
                  value={formData.clientId}
                  onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-bold text-os-text focus:bg-white focus:border-brand outline-none transition-all"
                >
                  <option value="">Selecionar Cliente...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <Info className="w-3 h-3" /> Descrição Curta
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-bold text-os-text focus:bg-white focus:border-brand outline-none transition-all resize-none"
                  placeholder="Escopo resumido do projeto..."
                />
              </div>
            </div>

            {/* Project Meta Info */}
            <div className="space-y-4">
              {!initialData && templates.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <Target className="w-3 h-3" /> Template de Projeto
                  </label>
                  <select
                    value={formData.templateId}
                    onChange={e => {
                      const template = templates.find(item => item.id === e.target.value);
                      setFormData({
                        ...formData,
                        templateId: e.target.value,
                        budget: template?.defaultBudget ?? formData.budget,
                      });
                    }}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-[10px] font-bold uppercase text-os-text outline-none"
                  >
                    <option value="">Projeto em branco</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Início
                  </label>
                  <input
                    required
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded text-[10px] font-mono font-bold text-os-text focus:bg-white focus:border-brand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Prazo (Deadline)
                  </label>
                  <input
                    required
                    type="date"
                    value={formData.deadline}
                    onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded text-[10px] font-mono font-bold text-os-text focus:bg-white focus:border-brand outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <DollarSign className="w-3 h-3" /> Orçamento Total (R$)
                </label>
                <input
                  required
                  type="number"
                  value={formData.budget}
                  onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-mono font-bold text-os-text focus:bg-white focus:border-brand outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-[10px] font-bold uppercase text-os-text outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Financeiro</label>
                  <select
                    value={formData.paymentStatus}
                    onChange={e => setFormData({ ...formData, paymentStatus: e.target.value as PaymentStatus })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-[10px] font-bold uppercase text-os-text outline-none"
                  >
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Atrasado</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex gap-3">
            {initialData && onDelete && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={loading || deleting}
                className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-all disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Excluir Projeto'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-os-text transition-all"
            >
              Descartar
            </button>
            <button
              type="submit"
              disabled={loading || deleting}
              className="flex-[2] py-3 bg-brand text-white rounded text-[10px] font-black uppercase tracking-[0.2em] hover:bg-os-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : initialData ? 'Salvar Alterações' : 'Configurar Projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
