import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCheck,
  Info,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Search,
  Send,
  Smartphone,
  Tags,
  UserPlus,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useSupabaseClients, useSupabaseWhatsapp } from '../hooks/supabase';
import type { Client, WhatsappMessage } from '../types';

function formatMessageTime(timestamp?: number) {
  if (!timestamp) return '--:--';

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatConversationTime(timestamp?: number) {
  if (!timestamp) return 'Sem mensagens';

  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return formatMessageTime(timestamp);
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function getClientLabel(client?: Client) {
  if (!client) return 'Contato WhatsApp';
  return client.company || client.contactName || client.name;
}

function getMessageStatusLabel(message: WhatsappMessage) {
  if (message.status === 'failed') return 'Falhou';
  if (message.status === 'read') return 'Lida';
  if (message.status === 'delivered') return 'Entregue';
  if (message.status === 'sent') return 'Enviada';
  if (message.status === 'queued') return 'Na fila';
  return 'Recebida';
}

const conversationCategoryLabel = {
  opportunity: 'Oportunidade',
  support: 'Suporte',
  billing: 'Cobranca',
} as const;

const conversationCategoryClassName = {
  opportunity: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  support: 'bg-blue-50 text-blue-700 border-blue-100',
  billing: 'bg-amber-50 text-amber-700 border-amber-100',
} as const;

export default function Communications() {
  const { clients, loading: clientsLoading, addClient, refreshClients } = useSupabaseClients();
  const {
    conversations,
    messagesByConversation,
    loading,
    sending,
    templates,
    openClientConversation,
    loadMessages,
    markConversationRead,
    sendMessage,
    linkConversationClient,
  } = useSupabaseWhatsapp();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientsById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (!normalizedQuery) return true;

      const client = conversation.clientId ? clientsById.get(conversation.clientId) : undefined;

      return (
        conversation.contactName.toLowerCase().includes(normalizedQuery) ||
        conversation.phoneE164.includes(normalizedQuery) ||
        getClientLabel(client).toLowerCase().includes(normalizedQuery)
      );
    });
  }, [clientsById, conversations, searchQuery]);

  const clientsWithoutConversation = useMemo(() => {
    const conversationPhones = new Set(conversations.map((conversation) => conversation.phoneE164.replace(/\D/g, '')));
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return clients
      .filter((client) => {
        const phone = (client.contactPhone || client.phone || '').replace(/\D/g, '');
        if (!phone || conversationPhones.has(phone) || conversationPhones.has(`55${phone}`)) return false;
        if (!normalizedQuery) return true;

        return (
          client.name.toLowerCase().includes(normalizedQuery) ||
          (client.company ?? '').toLowerCase().includes(normalizedQuery) ||
          phone.includes(normalizedQuery)
        );
      })
      .slice(0, 8);
  }, [clients, conversations, searchQuery]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? filteredConversations[0] ?? null,
    [activeConversationId, conversations, filteredConversations],
  );

  const activeClient = activeConversation?.clientId ? clientsById.get(activeConversation.clientId) : undefined;
  const activeMessages = activeConversation ? messagesByConversation[activeConversation.id] ?? [] : [];

  useEffect(() => {
    if (!activeConversation && filteredConversations[0]) {
      setActiveConversationId(filteredConversations[0].id);
    }
  }, [activeConversation, filteredConversations]);

  useEffect(() => {
    if (!activeConversation) return;

    setActiveConversationId(activeConversation.id);
    void loadMessages(activeConversation.id);

    if (activeConversation.unreadCount > 0) {
      void markConversationRead(activeConversation.id);
    }
  }, [activeConversation?.id]);

  const handleOpenClient = async (client: Client) => {
    setErrorMessage(null);

    try {
      const conversation = await openClientConversation(client);
      if (conversation) {
        setActiveConversationId(conversation.id);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel abrir a conversa.');
    }
  };

  const handleSendMessage = async () => {
    if (!activeConversation || !message.trim()) return;

    const nextMessage = message.trim();
    setMessage('');
    setErrorMessage(null);

    try {
      await sendMessage(activeConversation.id, nextMessage, selectedTemplateKey || undefined);
      setSelectedTemplateKey('');
    } catch (error) {
      setMessage(nextMessage);
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar WhatsApp.');
    }
  };

  const handleCreateClientFromConversation = async () => {
    if (!activeConversation) return;

    setErrorMessage(null);

    try {
      const clientId = await addClient({
        personType: 'Física',
        name: activeConversation.suggestedClientPayload?.name || activeConversation.contactName || activeConversation.phoneE164,
        taxId: '',
        email: '',
        phone: activeConversation.suggestedClientPayload?.phone || activeConversation.phoneE164,
        status: 'lead',
        source: 'whatsapp',
        whatsappOptIn: true,
        address: {
          street: '',
          number: '',
          complement: '',
          zipCode: '',
          neighborhood: '',
          city: '',
          state: '',
        },
        dueDay: 10,
        tags: ['whatsapp'],
        attention: activeConversation.suggestedClientPayload?.lastMessageBody
          ? `Primeira mensagem WhatsApp: ${activeConversation.suggestedClientPayload.lastMessageBody}`
          : '',
        origin: 'WhatsApp',
        customFields: {
          whatsappConversationId: activeConversation.id,
        },
      });

      if (clientId) {
        await linkConversationClient({ conversationId: activeConversation.id, clientId });
      }

      await refreshClients();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel criar o cliente pela conversa.');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <div className="h-full flex gap-1 bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
      <div className="w-80 flex flex-col border-r border-gray-100">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Chat Unificado</h3>
            <div className="p-1.5 text-brand bg-brand/10 rounded">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Pesquisar conversas..."
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-100 rounded text-[10px] focus:ring-1 focus:ring-brand outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-brand animate-spin" />
            </div>
          ) : (
            <>
              {filteredConversations.map((conversation) => {
                const client = conversation.clientId ? clientsById.get(conversation.clientId) : undefined;
                const isActive = activeConversation?.id === conversation.id;

                return (
                  <button
                    type="button"
                    key={conversation.id}
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={cn(
                      'w-full p-4 flex items-center gap-3 transition-all text-left border-b border-gray-50 relative',
                      isActive ? 'bg-gray-100/50' : 'hover:bg-gray-50',
                    )}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm bg-brand">
                        {conversation.contactName.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="text-xs font-bold text-os-text truncate">{conversation.contactName}</h4>
                        <span className="text-[9px] font-mono text-gray-400">
                          {formatConversationTime(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">
                        {conversation.lastMessageBody || getClientLabel(client)}
                      </p>
                      <span
                        className={cn(
                          'mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-[0.12em]',
                          conversationCategoryClassName[conversation.category ?? 'opportunity'],
                        )}
                      >
                        <Tags className="w-2.5 h-2.5" />
                        {conversationCategoryLabel[conversation.category ?? 'opportunity']}
                      </span>
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div className="w-4 h-4 rounded-full bg-brand text-white text-[8px] font-bold flex items-center justify-center">
                        {conversation.unreadCount}
                      </div>
                    )}
                  </button>
                );
              })}

              {clientsWithoutConversation.length > 0 && (
                <div className="p-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300 mb-2">Iniciar conversa</p>
                  <div className="space-y-1">
                    {clientsWithoutConversation.map((client) => (
                      <button
                        type="button"
                        key={client.id}
                        onClick={() => void handleOpenClient(client)}
                        className="w-full px-3 py-2 flex items-center gap-2 text-left rounded hover:bg-gray-50 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-brand" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-os-text truncate">{client.contactName || client.name}</p>
                          <p className="text-[9px] text-gray-400 truncate">{client.contactPhone || client.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!filteredConversations.length && !clientsWithoutConversation.length && (
                <div className="h-48 flex flex-col items-center justify-center text-center px-8">
                  <MessageSquare className="w-8 h-8 text-gray-200 mb-3" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300">
                    Nenhum contato WhatsApp
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {activeConversation ? (
          <>
            <div className="p-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/20">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white font-bold text-xs uppercase shrink-0">
                  {activeConversation.contactName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-os-text leading-tight truncate">
                    {activeConversation.contactName}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-medium truncate">
                    {activeConversation.phoneE164} - {getClientLabel(activeClient)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={`https://wa.me/${activeConversation.phoneE164.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-gray-400 hover:text-os-text rounded transition-colors"
                  title="Abrir no WhatsApp"
                >
                  <Phone className="w-4 h-4" />
                </a>
                <button type="button" className="p-2 text-gray-400 hover:text-os-text rounded transition-colors">
                  <Info className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-4 bg-gray-200 mx-1" />
                <button type="button" className="p-2 text-gray-400 hover:text-os-text rounded transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
              <div className="flex items-center justify-center">
                <span className="px-3 py-1 bg-white border border-gray-100 rounded-full text-[9px] font-bold text-gray-300 uppercase tracking-widest shadow-sm">
                  Canal {activeConversation.channel ?? 'whatsapp'} - {conversationCategoryLabel[activeConversation.category ?? 'opportunity']}
                </span>
              </div>

              {!activeConversation.clientId && activeConversation.suggestedClientStatus === 'pending' && (
                <div className="mx-auto max-w-lg bg-white border border-brand/10 rounded-lg shadow-sm p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-os-text">
                      Novo contato sem cadastro
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 truncate">
                      {activeConversation.suggestedClientPayload?.phone || activeConversation.phoneE164}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateClientFromConversation()}
                    className="px-3 py-2 bg-os-dark text-white rounded text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shrink-0"
                  >
                    <UserPlus className="w-3 h-3" />
                    Criar cliente
                  </button>
                </div>
              )}

              {activeMessages.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex flex-col max-w-[70%]',
                    item.direction === 'outbound' ? 'ml-auto items-end' : 'items-start',
                  )}
                >
                  <div
                    className={cn(
                      'p-3 rounded-lg text-xs leading-relaxed shadow-sm whitespace-pre-wrap',
                      item.direction === 'outbound'
                        ? 'bg-os-dark text-white rounded-br-none'
                        : 'bg-white border border-gray-100 text-os-text rounded-bl-none',
                    )}
                  >
                    {item.body}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-gray-300">{formatMessageTime(item.createdAt)}</span>
                    {item.direction === 'outbound' && (
                      <>
                        <CheckCheck
                          className={cn(
                            'w-3 h-3',
                            item.status === 'failed' ? 'text-red-400' : item.status === 'read' ? 'text-brand' : 'text-gray-300',
                          )}
                        />
                        <span className="text-[9px] font-mono text-gray-300">{getMessageStatusLabel(item)}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {!activeMessages.length && (
                <div className="py-20 text-center flex flex-col items-center opacity-30">
                  <MessageSquare className="w-10 h-10 mb-3" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Sem mensagens</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-50">
              {errorMessage && (
                <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded text-[10px] font-bold text-red-600">
                  {errorMessage}
                </div>
              )}
              <div className="mb-2 flex items-center gap-2">
                <select
                  value={selectedTemplateKey}
                  onChange={(event) => {
                    const templateKey = event.target.value;
                    setSelectedTemplateKey(templateKey);
                    const template = templates.find((item) => item.templateKey === templateKey);
                    if (template) setMessage(template.bodyPreview);
                  }}
                  className="h-8 rounded border border-gray-100 bg-gray-50 px-3 text-[10px] font-bold outline-none"
                >
                  <option value="">Texto livre</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.templateKey}>
                      {template.templateKey}
                    </option>
                  ))}
                </select>
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-gray-300">
                  Templates oficiais aprovados pela Meta
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 flex items-end gap-2 focus-within:border-brand focus-within:bg-white transition-all">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite uma mensagem WhatsApp..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-xs font-medium resize-none max-h-32 p-2 outline-none"
                  rows={1}
                />
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  className="p-2 bg-brand text-white rounded shadow-sm hover:bg-os-dark transition-all disabled:opacity-50"
                  disabled={!message.trim() || sending}
                  title="Enviar WhatsApp"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-4 text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                <span>META CLOUD API</span>
                <span>JANELA 24H PARA TEXTO LIVRE</span>
                <span>{clientsLoading ? 'CLIENTES...' : `${clients.length} CLIENTES`}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-gray-50/30">
            <MessageSquare className="w-10 h-10 text-gray-200 mb-4" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-300">
              Selecione ou inicie uma conversa
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
