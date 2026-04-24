import React, { useState } from 'react';
import { 
  X, 
  Loader2, 
  DollarSign, 
  Calendar, 
  FileText, 
  Paperclip,
  Recycle,
  Tag,
  Link2
} from 'lucide-react';
import { Transaction, TransactionType, TransactionStatus } from '../types';
import { useClients, useProjects } from '../hooks/useFirebase';
import { cn } from '../lib/utils';

interface TransactionModalProps {
  onClose: () => void;
  onSave: (data: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  initialData?: Transaction;
}

export default function TransactionModal({ onClose, onSave, initialData }: TransactionModalProps) {
  const { clients } = useClients();
  const { projects } = useProjects();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    type: initialData?.type || 'expense' as TransactionType,
    amount: initialData?.amount || 0,
    description: initialData?.description || '',
    date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    dueDate: initialData?.dueDate ? new Date(initialData.dueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    status: initialData?.status || 'pending' as TransactionStatus,
    categoryId: initialData?.categoryId || 'Outros',
    clientId: initialData?.clientId || '',
    projectId: initialData?.projectId || '',
    isRecurring: initialData?.isRecurring || false,
    recurrenceInterval: initialData?.recurrenceInterval || 'monthly' as any,
  });

  const categories = [
    'Impostos', 'Salários', 'Ferramentas', 'Marketing', 'Aluguel', 'Serviços', 'Hardware', 'Software', 'Outros'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...formData,
        amount: Number(formData.amount),
        date: new Date(formData.date).getTime(),
        dueDate: new Date(formData.dueDate).getTime(),
      });
      onClose();
    } catch (error) {
      console.error('Save error', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-os-dark/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-os-text tracking-tight uppercase">
              {initialData ? 'Editar Lançamento' : 'Novo Registro Financeiro'}
            </h2>
            <p className="text-[10px] font-mono text-gray-400 font-bold uppercase mt-1">Controle de regime de caixa</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
               <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <DollarSign className="w-3 h-3" /> Tipo & Valor
                </label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-2">
                   <button 
                     type="button"
                     onClick={() => setFormData({...formData, type: 'income'})}
                     className={cn(
                       "flex-1 py-2 text-[10px] font-black uppercase rounded transition-all",
                       formData.type === 'income' ? "bg-white text-green-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                     )}
                   >Entrada</button>
                   <button 
                     type="button"
                     onClick={() => setFormData({...formData, type: 'expense'})}
                     className={cn(
                       "flex-1 py-2 text-[10px] font-black uppercase rounded transition-all",
                       formData.type === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                     )}
                   >Saída</button>
                </div>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xl font-black text-os-text focus:bg-white focus:border-brand outline-none"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <FileText className="w-3 h-3" /> Descrição
                </label>
                <input
                  required
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-bold text-os-text focus:bg-white focus:border-brand outline-none"
                  placeholder="Ex: Pagamento Servidor AWS"
                />
              </div>

               <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <Tag className="w-3 h-3" /> Categoria
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-xs font-bold text-os-text outline-none focus:border-brand"
                >
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Data
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded text-[10px] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Vencimento
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded text-[10px] font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <Link2 className="w-3 h-3" /> Cliente / Projeto (Opcional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                   <select
                     value={formData.clientId}
                     onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                     className="px-2 py-2 bg-gray-50 border border-gray-100 rounded text-[9px] font-bold uppercase"
                   >
                     <option value="">Cliente...</option>
                     {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                   <select
                     value={formData.projectId}
                     onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                     className="px-2 py-2 bg-gray-50 border border-gray-100 rounded text-[9px] font-bold uppercase"
                   >
                     <option value="">Projeto...</option>
                     {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                </div>
              </div>

               <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                     <Recycle className="w-4 h-4 text-gray-400" />
                     <div>
                        <p className="text-[10px] font-black uppercase text-os-text">Recorrência Mensal</p>
                        <p className="text-[9px] font-medium text-gray-400 uppercase">Auto-gerar lançamento todo mês</p>
                     </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, isRecurring: !formData.isRecurring})}
                    className={cn(
                      "w-10 h-5 rounded-full relative transition-all duration-300",
                      formData.isRecurring ? "bg-brand" : "bg-gray-200"
                    )}
                  >
                     <div className={cn(
                       "absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300",
                       formData.isRecurring ? "left-6" : "left-1"
                     )}></div>
                  </button>
               </div>
               
               <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Liquidação</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded text-[10px] font-bold uppercase text-os-text outline-none"
                  >
                    <option value="pending">Promessa (Pendente)</option>
                    <option value="liquidated">No Bolso (Liquidado)</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
               </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-os-text transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-3 bg-brand text-white rounded text-[10px] font-black uppercase tracking-[0.2em] hover:bg-os-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : initialData ? 'Atualizar Registro' : 'Efetivar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
