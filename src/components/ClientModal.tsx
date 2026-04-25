import React, { useState } from 'react';
import { X, Loader2, User, Landmark, Info, Tag, MapPin, CreditCard, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { Client } from '../types';
import { cn } from '../lib/utils';

interface ClientModalProps {
  onClose: () => void;
  onSave: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  initialData?: Client;
}

type TabType = 'registration' | 'financial' | 'context';

export default function ClientModal({ onClose, onSave, initialData }: ClientModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('registration');
  const [formData, setFormData] = useState({
    personType: initialData?.personType || 'Física' as 'Física' | 'Jurídica',
    name: initialData?.name || '',
    taxId: initialData?.taxId || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    company: initialData?.company || '',
    status: initialData?.status || 'lead' as Client['status'],
    address: {
      street: initialData?.address?.street || '',
      number: initialData?.address?.number || '',
      complement: initialData?.address?.complement || '',
      zipCode: initialData?.address?.zipCode || '',
      neighborhood: initialData?.address?.neighborhood || '',
      city: initialData?.address?.city || '',
      state: initialData?.address?.state || '',
    },
    dueDay: initialData?.dueDay || 10,
    pixKey: initialData?.pixKey || '',
    bankingInfo: initialData?.bankingInfo || '',
    tags: initialData?.tags || [] as string[],
    attention: initialData?.attention || '',
    origin: initialData?.origin || '',
  });

  const [tagInput, setTagInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'registration', label: 'Cadastro', icon: User },
    { id: 'financial', label: 'Financeiro', icon: CreditCard },
    { id: 'context', label: 'Contexto', icon: Info },
  ];

  return (
    <div className="fixed inset-0 bg-os-dark/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-os-text">
              {initialData ? 'Atualizar Perfil Operacional' : 'Novo Registro de Entidade'}
            </h3>
            <p className="text-[10px] font-mono text-gray-400 mt-1 uppercase tracking-widest">
              {initialData ? `ID: ${initialData.id}` : 'Sequenciamento de novo cliente'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex bg-gray-50/50 border-b border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2",
                activeTab === tab.id ? "border-brand text-brand bg-white" : "border-transparent text-gray-400 hover:text-os-text hover:bg-gray-100/50"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-hidden flex flex-col max-h-[70vh]">
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            
            {/* --- REGISTRATION SECTION --- */}
            {activeTab === 'registration' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <User className="w-3 h-3 text-brand" /> Natureza do Registro
                  </label>
                  <div className="flex p-1 bg-gray-100 rounded-lg w-fit">
                    {(['Física', 'Jurídica'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, personType: type })}
                        className={cn(
                          "px-6 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                          formData.personType === type ? "bg-white text-os-text shadow-sm" : "text-gray-400 hover:text-os-text"
                        )}
                      >
                        Pessoa {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {formData.personType === 'Física' ? 'Nome Completo' : 'Razão Social'}
                    </label>
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                      placeholder={formData.personType === 'Física' ? "Ex: João Silva" : "Ex: Tech Corp Solutions LTDA"}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {formData.personType === 'Física' ? 'CPF' : 'CNPJ'}
                    </label>
                    <input 
                      required
                      type="text" 
                      value={formData.taxId}
                      onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                      placeholder={formData.personType === 'Física' ? "000.000.000-00" : "00.000.000/0001-00"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">E-mail Principal</label>
                    <input 
                      required
                      type="email" 
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                      placeholder="email@nucleo.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">WhatsApp / Terminal</label>
                    <input 
                      required
                      type="tel" 
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                      placeholder="+55 (11) 99999-9999"
                    />
                  </div>
                </div>

                {formData.personType === 'Jurídica' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Nome Fantasia (Opcional)</label>
                    <input 
                      type="text" 
                      value={formData.company}
                      onChange={e => setFormData({ ...formData, company: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                      placeholder="Ex: Nucleo Tech"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Status Operacional</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as Client['status'] })}
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                  >
                    <option value="lead">Lead (Prospecção)</option>
                    <option value="active">Ativo (Operacional)</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>
            )}

            {/* --- FINANCIAL SECTION --- */}
            {activeTab === 'financial' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-brand" /> Localização Tributária
                  </label>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1 space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">CEP</label>
                      <input 
                        type="text" 
                        value={formData.address.zipCode}
                        onChange={e => setFormData({ ...formData, address: { ...formData.address, zipCode: e.target.value } })}
                        className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 font-mono text-xs focus:bg-white outline-none transition-all"
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Logradouro</label>
                      <input 
                        type="text" 
                        value={formData.address.street}
                        onChange={e => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                        className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Número</label>
                      <input 
                        type="text" 
                        value={formData.address.number}
                        onChange={e => setFormData({ ...formData, address: { ...formData.address, number: e.target.value } })}
                        className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs focus:bg-white outline-none transition-all"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Complemento / Bairro</label>
                      <input 
                        type="text" 
                        value={`${formData.address.complement}${formData.address.neighborhood ? ' - ' + formData.address.neighborhood : ''}`}
                        onChange={e => {
                          const parts = e.target.value.split(' - ');
                          setFormData({ 
                            ...formData, 
                            address: { 
                              ...formData.address, 
                              complement: parts[0] || '',
                              neighborhood: parts[1] || '' 
                            } 
                          });
                        }}
                        className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Cidade</label>
                      <input 
                        type="text" 
                        value={formData.address.city}
                        onChange={e => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                        className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs focus:bg-white outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Estado (UF)</label>
                      <input 
                        type="text" 
                        maxLength={2}
                        value={formData.address.state}
                        onChange={e => setFormData({ ...formData, address: { ...formData.address, state: e.target.value.toUpperCase() } })}
                        className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs focus:bg-white outline-none transition-all"
                        placeholder="SP"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-50 space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Landmark className="w-3 h-3 text-brand" /> Parâmetros Contratuais
                  </label>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Dia de Vencimento</label>
                      <input 
                        type="number" 
                        min={1} 
                        max={31}
                        value={formData.dueDay}
                        onChange={e => setFormData({ ...formData, dueDay: parseInt(e.target.value) })}
                        className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs focus:bg-white outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Chave PIX</label>
                      <input 
                        type="text" 
                        value={formData.pixKey}
                        onChange={e => setFormData({ ...formData, pixKey: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs focus:bg-white outline-none transition-all font-mono"
                        placeholder="E-mail, CPF ou Aleatória"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-gray-400">Dados Bancários / Instruções</label>
                    <textarea 
                      value={formData.bankingInfo}
                      onChange={e => setFormData({ ...formData, bankingInfo: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs focus:bg-white outline-none transition-all min-h-[80px]"
                      placeholder="Agência, Conta, Banco..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* --- CONTEXT SECTION --- */}
            {activeTab === 'context' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Tag className="w-3 h-3 text-brand" /> Categorização e Tags
                  </label>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-4 py-2 text-xs outline-none focus:bg-white transition-all"
                      placeholder="Nova tag (Ex: VIP, Inadimplente...)"
                    />
                    <button 
                      type="button" 
                      onClick={handleAddTag}
                      className="px-4 py-2 bg-os-dark text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-brand/5 border border-brand/10 text-brand rounded-md text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-os-dark"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                    {formData.tags.length === 0 && <span className="text-[10px] italic text-gray-300">Nenhuma tag atribuída.</span>}
                  </div>
                </div>

                <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" /> Atenção Crítica (Aviso TDAH)
                  </label>
                  <textarea 
                    value={formData.attention}
                    onChange={e => setFormData({ ...formData, attention: e.target.value })}
                    className="w-full bg-white border border-amber-100 rounded-lg px-4 py-2.5 text-xs text-amber-900 font-medium focus:ring-2 focus:ring-amber-200 outline-none transition-all min-h-[80px]"
                    placeholder="Ex: Cliente prefere áudio, Só ligar após às 14h..."
                  />
                  <p className="text-[9px] text-amber-600/70 font-medium italic">Este aviso aparecerá em destaque no topo do perfil do cliente.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Origem do Cliente</label>
                  <input 
                    type="text" 
                    value={formData.origin}
                    onChange={e => setFormData({ ...formData, origin: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs font-medium focus:bg-white outline-none transition-all"
                    placeholder="Ex: Indicação, Mídia Paga, Evento..."
                  />
                </div>
              </div>
            )}

          </div>

          {/* Pagination/Submit Footer */}
          <div className="p-6 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
            <div className="flex gap-2">
              {activeTab !== 'registration' && (
                <button 
                  type="button" 
                  onClick={() => setActiveTab(activeTab === 'context' ? 'financial' : 'registration')}
                  className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </button>
              )}
              {activeTab !== 'context' && (
                <button 
                  type="button" 
                  onClick={() => setActiveTab(activeTab === 'registration' ? 'financial' : 'context')}
                  className="px-4 py-2.5 bg-white border border-gray-200 text-os-text rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                  Seguinte <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="px-6 py-2.5 text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:text-os-text transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="px-8 py-2.5 bg-os-dark text-white rounded-lg text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-os-dark/10 ring-4 ring-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? 'Sincronizar' : 'Finalizar Registro')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper icon not imported
// (removed duplicate)
