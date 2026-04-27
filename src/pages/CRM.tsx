import React, { useState } from 'react';
import { 
  Users,
  Search, 
  UserPlus, 
  Mail, 
  Phone, 
  MoreHorizontal, 
  Plus, 
  Send,
  Paperclip,
  StickyNote,
  Loader2,
  MessageSquare,
  Trash2,
  AlertCircle,
  Link2,
  Lock,
  MapPin,
  Landmark,
  Compass as Origin
} from 'lucide-react';
import { Client, CrmDeal, TimelineEvent, TimelineEventType, Transaction, Proposal } from '../types';
import Timeline from '../components/Timeline';
import ClientModal from '../components/ClientModal';
import { cn, formatDate, formatCurrency } from '../lib/utils';
import {
  useSupabaseClients as useClients,
  useSupabaseEvents as useEvents,
  useSupabasePipeline as usePipeline,
  useSupabaseTransactions as useTransactions,
  useSupabaseProposals as useProposals,
} from '../hooks/supabase';
import { useAuth } from '../contexts/AuthContext';
import { clearPendingNavigationIntent, getPendingNavigationIntent } from '../lib/navigation';
import { filterByClientId } from './crmFilters';

export default function CRM() {
  const { clients, loading: loadingClients, addClient, deleteClient, updateClient } = useClients();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const { events, loading: loadingEvents, addEvent, deleteEvent } = useEvents(selectedClientId);
  const { stages, deals, loading: loadingPipeline, moveDeal, movingDealId } = usePipeline();
  const { transactions } = useTransactions();
  const { proposals, updateProposal } = useProposals();
  const { isAdmin } = useAuth();
  
  const [activeTab, setActiveTab ] = useState<'timeline' | 'pipeline' | 'proposals'>('timeline');
  const [activeAction, setActiveAction] = useState<TimelineEventType | null>(null);
  const [actionContent, setActionContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.contactName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.contactEmail ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedClient = clients.find(c => c.id === selectedClientId) || filteredClients[0];
  const selectedClientScopedId = selectedClient?.id ?? selectedClientId;
  const clientTransactions: Transaction[] = filterByClientId<Transaction>(transactions, selectedClientScopedId);
  const clientBalance = clientTransactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
  const clientProposals: Proposal[] = filterByClientId<Proposal>(proposals, selectedClientScopedId);
  const clientDeals: CrmDeal[] = filterByClientId<CrmDeal>(deals, selectedClientScopedId);
  const clientsById = React.useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  
  // Set initial selected client if none selected
  React.useEffect(() => {
    if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  React.useEffect(() => {
    const pendingIntent = getPendingNavigationIntent();

    if (!pendingIntent) {
      return;
    }

    if (pendingIntent.kind === 'open-client') {
      setSelectedClientId(pendingIntent.clientId);
      clearPendingNavigationIntent();
    }

    if (pendingIntent.kind === 'create-client') {
      setEditingClient(undefined);
      setShowClientModal(true);
      clearPendingNavigationIntent();
    }
  }, []);

  const handleAddEvent = async () => {
    if (!selectedClientId || !activeAction || !actionContent.trim()) return;
    
    setIsSubmitting(true);
    try {
      await addEvent({
        clientId: selectedClientId,
        type: activeAction,
        title: activeAction === 'note' ? 'Nova Anotação' : 
               activeAction === 'email' ? 'Integração de E-mail' : 'WhatsApp Outreach',
        content: actionContent,
      });
      setActionContent('');
      setActiveAction(null);
    } catch (error) {
      console.error('CRM event creation failed:', error);
      window.alert('Nao foi possivel registrar a acao na timeline.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveClient = async (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingClient) {
        await updateClient(editingClient.id, data);
      } else {
        await addClient(data);
      }
      setEditingClient(undefined);
    } catch (error) {
      console.error('CRM client save failed:', error);
      window.alert('Nao foi possivel salvar o cliente.');
    }
  };

  const handleDeleteClient = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      await deleteClient(id);
      if (selectedClientId === id) setSelectedClientId(null);
    } catch (error) {
      console.error('CRM client deletion failed:', error);
      window.alert('Nao foi possivel excluir o cliente.');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEvent(eventId);
    } catch (error) {
      console.error('CRM event deletion failed:', error);
      window.alert('Nao foi possivel excluir o evento.');
    }
  };

  const handleMoveDeal = async (dealId: string, direction: -1 | 1) => {
    const deal = deals.find((item) => item.id === dealId);

    if (!deal) return;

    const currentStageIndex = stages.findIndex((stage) => stage.id === deal.stageId);
    const nextStage = stages[currentStageIndex + direction];
    const currentStage = stages[currentStageIndex];

    if (!nextStage || !currentStage) return;

    try {
      await moveDeal({
        deal,
        nextStage,
        previousStageName: currentStage.name,
      });
    } catch (error) {
      console.error('CRM pipeline update failed:', error);
      window.alert('Nao foi possivel mover a oportunidade.');
    }
  };

  const copyProposalStatusLink = async (proposal: Proposal) => {
    if (!proposal.publicToken) {
      window.alert('Esta proposta ainda nao possui link publico. Atualize a proposta ou gere uma nova.');
      return;
    }

    const publicUrl = `${window.location.origin}/proposal/${proposal.publicToken}`;

    try {
      await navigator.clipboard.writeText(publicUrl);
      window.alert('Link de acompanhamento copiado.');
    } catch {
      window.prompt('Copie o link de acompanhamento:', publicUrl);
    }
  };

  const copyClientStatusLink = async () => {
    if (!selectedClient?.publicToken) {
      window.alert('Este cliente ainda nao possui link de acompanhamento. Atualize o cadastro ou aplique a migration mais recente.');
      return;
    }

    const publicUrl = `${window.location.origin}/status/${selectedClient.publicToken}`;

    try {
      await navigator.clipboard.writeText(publicUrl);
      window.alert('Link de acompanhamento copiado.');
    } catch {
      window.prompt('Copie o link de acompanhamento:', publicUrl);
    }
  };

  const closeClientStatusLink = async () => {
    if (!selectedClient?.id) return;
    if (!window.confirm('Encerrar o acompanhamento publico deste cliente? O link deixara de funcionar.')) {
      return;
    }

    try {
      await updateClient(selectedClient.id, {
        publicStatusEnabled: false,
        publicStatusClosedAt: new Date().toISOString(),
      });
      window.alert('Acompanhamento encerrado.');
    } catch (error) {
      console.error('CRM public status close failed:', error);
      window.alert('Nao foi possivel encerrar o acompanhamento.');
    }
  };

  if (loadingClients) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase opacity-40">Initializing Nodes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-0 -m-6 overflow-hidden">
      {/* Client List */}
      <div className="w-72 flex flex-col border-r border-gray-100 bg-white shrink-0">
        <div className="p-4 border-b border-gray-50 bg-gray-50/30">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Pesquisar registros..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-100 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-brand transition-all shadow-sm font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-0.5 p-2 scrollbar-hide">
          <div className="flex items-center justify-between mb-3 px-2 pt-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Registros</h3>
            {isAdmin && (
              <button 
                type="button"
                onClick={() => {
                  setEditingClient(undefined);
                  setShowClientModal(true);
                }}
                className="p-1 text-brand hover:bg-brand/5 rounded transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className={cn(
                "w-full p-3 rounded flex flex-col gap-0.5 transition-all duration-150 text-left border border-transparent group relative",
                selectedClientId === client.id 
                  ? "bg-gray-100 border-gray-200" 
                  : "hover:bg-gray-50"
              )}
            >
              <button
                type="button"
                onClick={() => setSelectedClientId(client.id)}
                className="w-full pr-12 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-os-text text-[11px] leading-tight">{client.name}</span>
                  <span className={cn(
                     "w-1.5 h-1.5 rounded-full shadow-sm",
                     client.status === 'active' ? "bg-green-500" : "bg-gray-300"
                   )} />
                </div>
                <span className="text-[10px] text-gray-400 font-mono truncate block">{client.company || 'Cliente Particular'}</span>
              </button>
              
              {isAdmin && (
                <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    type="button"
                    onClick={() => { setEditingClient(client); setShowClientModal(true); }}
                    className="p-1 text-gray-400 hover:text-os-text"
                  >
                    <Plus className="w-3 h-3 rotate-45" />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => handleDeleteClient(client.id, e)}
                    className="p-1 text-gray-300 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredClients.length === 0 && (
            <div className="py-20 text-center px-4">
               <Users className="w-8 h-8 text-gray-100 mx-auto mb-2" />
               <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest leading-relaxed">Nenhum registro encontrado neste nó.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Context Area */}
      <div className="flex-1 flex flex-col bg-os-bg overflow-hidden relative">
        {selectedClient ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-white z-10">
              <div className="flex gap-4 w-full">
                <div className="w-12 h-12 rounded border border-gray-100 bg-os-dark flex items-center justify-center text-white text-lg font-bold shadow-sm shrink-0">
                  {selectedClient.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-lg font-bold text-os-text tracking-tight">{selectedClient.name}</h2>
                      <span className="text-[10px] font-mono text-gray-400">ID:{selectedClient.id.slice(0, 8)}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest",
                        selectedClient.personType === 'Física' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                      )}>
                        {selectedClient.personType}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void copyClientStatusLink()}
                        className="p-2 text-gray-400 hover:text-brand rounded hover:bg-gray-50 transition-all"
                        title="Copiar link de acompanhamento"
                      >
                        <Link2 className="w-4 h-4" />
                      </button>
                      {selectedClient.publicStatusEnabled !== false && (
                        <button
                          type="button"
                          onClick={() => void closeClientStatusLink()}
                          className="p-2 text-gray-400 hover:text-red-500 rounded hover:bg-gray-50 transition-all"
                          title="Encerrar acompanhamento"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={() => { setEditingClient(selectedClient); setShowClientModal(true); }}
                        className="p-2 text-gray-400 hover:text-os-text rounded hover:bg-gray-50 transition-all"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="font-bold text-[10px] text-brand uppercase tracking-widest mb-2">
                    {selectedClient.company || (selectedClient.personType === 'Física' ? 'Individual' : 'Empresa')} 
                    <span className="mx-2 text-gray-200">|</span> 
                    {selectedClient.taxId}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-100 rounded text-[10px] font-mono text-gray-500 hover:bg-gray-100 transition-colors">
                      <Mail className="w-3 h-3 text-gray-300" />
                      {selectedClient.email}
                    </button>
                    <button type="button" className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-100 rounded text-[10px] font-mono text-gray-500 hover:bg-gray-100 transition-colors">
                      <Phone className="w-3 h-3 text-gray-300" />
                      {selectedClient.phone}
                    </button>
                    {selectedClient.contactName && (
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-100 rounded text-[10px] font-mono text-gray-500">
                        <Users className="w-3 h-3 text-gray-300" />
                        {selectedClient.contactName}
                        {selectedClient.contactRole ? ` . ${selectedClient.contactRole}` : ''}
                      </span>
                    )}
                    {selectedClient.tags?.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-white border border-brand/10 text-[9px] font-bold uppercase tracking-widest text-brand rounded shadow-sm">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* TDAH Attention Box */}
            {selectedClient.attention && (
              <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-100 rounded-lg flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                   <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Nota de Atenção Crítica</p>
                   <p className="text-xs text-amber-900 font-medium leading-relaxed">{selectedClient.attention}</p>
                </div>
              </div>
            )}

            {/* Content & Actions */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Navigation Tabs (Specific to Client) */}
              <div className="px-6 border-b border-gray-100 bg-white/50 backdrop-blur-sm flex">
                 <button 
                  type="button"
                  onClick={() => setActiveTab('timeline')}
                  className={cn(
                    "px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all",
                    activeTab === 'timeline' ? "border-brand text-brand" : "border-transparent text-gray-400 hover:text-os-text"
                  )}
                 >Timeline</button>
                 <button 
                  type="button"
                  onClick={() => setActiveTab('pipeline')}
                  className={cn(
                    "px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all",
                    activeTab === 'pipeline' ? "border-brand text-brand" : "border-transparent text-gray-400 hover:text-os-text"
                  )}
                 >Pipeline ({clientDeals.length})</button>
                 <button 
                  type="button"
                  onClick={() => setActiveTab('proposals')}
                  className={cn(
                    "px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all",
                    activeTab === 'proposals' ? "border-brand text-brand" : "border-transparent text-gray-400 hover:text-os-text"
                  )}
                 >Propostas ({clientProposals.length})</button>
              </div>

              {activeTab === 'timeline' && (
                <div className="contents">
                  {/* Action Toolbar */}
                  <div className="px-6 py-3 border-b border-gray-100 flex gap-2 bg-white/50 backdrop-blur-sm z-10">
                <button 
                  type="button"
                  onClick={() => setActiveAction(activeAction === 'note' ? null : 'note')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                    activeAction === 'note' ? "bg-os-dark text-white shadow-md shadow-black/10" : "bg-white border border-gray-100 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  <StickyNote className="w-3 h-3" />
                  Adicionar Nota
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveAction(activeAction === 'email' ? null : 'email')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                    activeAction === 'email' ? "bg-os-dark text-white shadow-md shadow-black/10" : "bg-white border border-gray-100 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  <Mail className="w-3 h-3" />
                  Reenviar Integração
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveAction(activeAction === 'whatsapp' ? null : 'whatsapp')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                    activeAction === 'whatsapp' ? "bg-os-dark text-white shadow-md shadow-black/10" : "bg-white border border-gray-100 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  <MessageSquare className="w-3 h-3" />
                  WhatsApp
                </button>
              </div>

              {activeAction && (
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 backdrop-blur-sm">
                  <div className="bg-white rounded border border-gray-200 p-3 shadow-sm max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Compor: {activeAction}</span>
                       <div className="w-2 h-2 rounded-full bg-brand animate-pulse"></div>
                    </div>
                    <textarea 
                      value={actionContent}
                      onChange={(e) => setActionContent(e.target.value)}
                      placeholder={
                        activeAction === 'note' ? "Digite uma nota técnica..." :
                        activeAction === 'email' ? "Escreva sua mensagem de e-mail..." :
                        "Digite uma mensagem de WhatsApp..."
                      }
                      className="w-full resize-none border-none focus:ring-0 text-[11px] font-medium min-h-[80px] p-0 placeholder:text-gray-300"
                    />
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-2">
                      <button type="button" className="p-1 px-2 text-gray-400 hover:text-os-text rounded text-[10px] font-bold uppercase flex items-center gap-1 group">
                        <Paperclip className="w-3 h-3 group-hover:rotate-45 transition-transform" />
                        Anexar
                      </button>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => {
                            setActiveAction(null);
                            setActionContent('');
                          }}
                          className="px-3 py-1.5 text-[10px] font-bold text-gray-400 hover:text-os-text uppercase"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="button"
                          onClick={handleAddEvent}
                          disabled={isSubmitting || !actionContent.trim()}
                          className="px-4 py-1.5 rounded bg-brand text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-os-dark transition-all disabled:opacity-50 shadow-sm"
                        >
                          {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Executar Ação
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

              {/* Bottom Logic for Tabs */}
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-y-auto p-12 scrollbar-hide scroll-smooth">
                  {activeTab === 'timeline' ? (
                    loadingEvents ? (
                      <div className="flex flex-col items-center justify-center p-20 grayscale opacity-20">
                        <Loader2 className="w-8 h-8 animate-spin mb-4" />
                        <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Buscando Logs...</span>
                      </div>
                    ) : (
                      <div className="max-w-2xl mx-auto">
                        <div className="mb-8 border-b border-gray-100 pb-4 flex items-center justify-between">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Log de Histórico</h3>
                            <span className="text-[10px] font-mono text-gray-300">{events.length} EVENTOS_REGISTRADOS</span>
                        </div>
                        <Timeline events={events} onDelete={handleDeleteEvent} />
                      </div>
                    )
                  ) : activeTab === 'pipeline' ? (
                    loadingPipeline ? (
                      <div className="flex flex-col items-center justify-center p-20 grayscale opacity-20">
                        <Loader2 className="w-8 h-8 animate-spin mb-4" />
                        <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Carregando Pipeline...</span>
                      </div>
                    ) : (
                      <div className="min-w-[900px]">
                        <div className="mb-8 border-b border-gray-100 pb-4 flex items-center justify-between">
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Pipeline Comercial</h3>
                          <span className="text-[10px] font-mono text-gray-300">{clientDeals.length} OPORTUNIDADES_ABERTAS</span>
                        </div>
                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(180px, 1fr))` }}>
                          {stages.map((stage, stageIndex) => {
                            const stageDeals = clientDeals.filter((deal) => deal.stageId === stage.id);

                            return (
                              <div key={stage.id} className="bg-white border border-gray-100 rounded shadow-sm min-h-[360px] flex flex-col">
                                <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-os-text">{stage.name}</span>
                                  <span className="text-[10px] font-mono text-gray-300">{stageDeals.length}</span>
                                </div>
                                <div className="flex-1 p-2 space-y-2">
                                  {stageDeals.map((deal) => {
                                    const dealClient = clientsById.get(deal.clientId);
                                    const isMoving = movingDealId === deal.id;

                                    return (
                                      <div key={deal.id} className="border border-gray-100 rounded bg-gray-50/60 p-3 shadow-sm">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedClientId(deal.clientId);
                                              setActiveTab('timeline');
                                            }}
                                            className="text-left min-w-0"
                                          >
                                            <p className="text-[11px] font-black text-os-text leading-tight truncate">{deal.title}</p>
                                            <p className="text-[10px] font-mono text-gray-400 truncate">{dealClient?.name || 'Cliente vinculado'}</p>
                                          </button>
                                          <span className="text-[9px] font-mono text-gray-400">{deal.probability}%</span>
                                        </div>
                                        <p className="text-[11px] font-mono font-bold text-brand mb-3">{formatCurrency(deal.value)}</p>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            disabled={stageIndex === 0 || isMoving}
                                            onClick={() => handleMoveDeal(deal.id, -1)}
                                            className="flex-1 py-1 rounded bg-white border border-gray-100 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-os-text disabled:opacity-30"
                                          >
                                            Voltar
                                          </button>
                                          <button
                                            type="button"
                                            disabled={stageIndex === stages.length - 1 || isMoving}
                                            onClick={() => handleMoveDeal(deal.id, 1)}
                                            className="flex-1 py-1 rounded bg-os-dark text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-30"
                                          >
                                            Avancar
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {stageDeals.length === 0 && (
                                    <div className="py-12 text-center text-[10px] font-bold uppercase tracking-widest text-gray-200">
                                      Sem oportunidades
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="max-w-4xl mx-auto space-y-6">
                       <div className="flex items-center justify-between mb-8">
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Propostas Comerciais</h3>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {clientProposals.map(proposal => (
                            <div key={proposal.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-brand transition-all">
                               <div>
                                  <div className="flex items-center justify-between mb-2">
                                     <span className={cn(
                                       "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                       proposal.status === 'accepted' ? "bg-green-50 text-green-600" : 
                                       proposal.status === 'rejected' ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"
                                     )}>{proposal.status}</span>
                                     <span className="text-[10px] font-mono font-bold text-os-text">{formatCurrency(proposal.value)}</span>
                                  </div>
                                  <h4 className="text-sm font-bold text-os-text mb-1">{proposal.title}</h4>
                                  <p className="text-[10px] text-gray-400 mb-4">Válida até: {formatDate(proposal.validUntil)}</p>
                               </div>
                               <div className="flex gap-2">
                                  {proposal.status !== 'accepted' && (
                                    <button 
                                      type="button"
                                      onClick={() => updateProposal(proposal.id, { status: 'accepted' })}
                                      className="flex-1 py-2 bg-green-500 text-white rounded text-[9px] font-black uppercase tracking-widest hover:bg-green-600 transition-all shadow-sm shadow-green-200"
                                    >Aceitar</button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void copyProposalStatusLink(proposal)}
                                    className="flex-1 py-2 bg-gray-50 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-100 rounded flex items-center justify-center gap-1"
                                  >
                                    <Link2 className="w-3 h-3" />
                                    Link
                                  </button>
                               </div>
                            </div>
                          ))}
                          {clientProposals.length === 0 && (
                            <div className="col-span-2 py-20 text-center text-gray-300 font-bold uppercase text-[10px] tracking-widest italic opacity-40">Nenhuma proposta vinculada.</div>
                          )}
                       </div>
                    </div>
                  )}
                </div>

                {/* Right Context Sidebar (Optional for detail density) */}
                <div className="w-64 border-l border-gray-100 bg-white/30 hidden xl:flex flex-col p-6 overflow-y-auto">
                   <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Meta do Cliente</h3>
                   <div className="space-y-6">
                      <div>
                         <p className="text-[9px] font-bold text-gray-300 uppercase mb-1">Status Financeiro</p>
                         <p className={cn(
                            "text-xs font-black uppercase flex items-center gap-2",
                            clientBalance >= 0 ? "text-green-500" : "text-red-500"
                         )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", clientBalance >= 0 ? "bg-green-500" : "bg-red-500")}></span>
                            {clientBalance >= 0 ? 'ADIMPLENTE' : 'INADIMPLENTE'}
                         </p>
                      </div>
                      <div>
                         <p className="text-[9px] font-bold text-gray-300 uppercase mb-1">Saldo em Aberto</p>
                         <p className="text-xs font-mono font-bold text-os-text">{formatCurrency(clientBalance)}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-bold text-gray-300 uppercase mb-1">Status Operacional</p>
                         <p className="text-xs font-bold text-blue-500 uppercase flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            Nó Ativo
                         </p>
                      </div>
                      <div>
                         <p className="text-[9px] font-bold text-gray-300 uppercase mb-1">Criado em</p>
                         <p className="text-xs font-mono text-gray-600">{formatDate(selectedClient.createdAt)}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-bold text-gray-300 uppercase mb-1">Força do Canal</p>
                         <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div className="w-[85%] h-full bg-brand"></div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-12">
            <Users className="w-12 h-12 mb-4 opacity-[0.05]" />
            <p className="font-bold text-[10px] uppercase tracking-[0.3em]">Nenhum nó de registro selecionado.</p>
          </div>
        )}
      </div>

      {(showClientModal || editingClient) && (
        <ClientModal 
          onClose={() => { setShowClientModal(false); setEditingClient(undefined); }}
          onSave={handleSaveClient}
          initialData={editingClient}
        />
      )}
    </div>
  );
}
