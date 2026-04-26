import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Client, WhatsappConversation, WhatsappMessage } from '../../types';
import { createWhatsappRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';
import { useAuth } from '../../contexts/AuthContext';

function normalizeWhatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('55')) {
    return `+${digits}`;
  }

  if (digits.length >= 10 && digits.length <= 11) {
    return `+55${digits}`;
  }

  return `+${digits}`;
}

export function useSupabaseWhatsapp() {
  const { supabase, organizationId, currentUserId } = useRepositoryContext();
  const { session } = useAuth();
  const repository = useMemo(
    () => (organizationId ? createWhatsappRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const [conversations, setConversations] = useState<WhatsappConversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, WhatsappMessage[]>>({});
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!repository) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setConversations(await repository.listConversations());
    } catch (error) {
      console.warn('Supabase WhatsApp conversations load failed:', toDataLayerError(error, 'Falha ao carregar WhatsApp.'));
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [repository]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (!repository) return;

      try {
        const messages = await repository.listMessages(conversationId);
        setMessagesByConversation((current) => ({
          ...current,
          [conversationId]: messages,
        }));
      } catch (error) {
        console.warn('Supabase WhatsApp messages load failed:', toDataLayerError(error, 'Falha ao carregar mensagens.'));
      }
    },
    [repository],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const openClientConversation = useCallback(
    async (client: Client) => {
      if (!repository) return null;

      const phoneE164 = normalizeWhatsappPhone(client.contactPhone || client.phone);

      if (!phoneE164) {
        throw new Error('Cliente sem telefone valido para WhatsApp.');
      }

      const conversation = await repository.upsertConversation({
        clientId: client.id,
        contactName: client.contactName || client.name,
        phoneE164,
        userId: currentUserId,
      });

      await loadConversations();
      await loadMessages(conversation.id);
      return conversation;
    },
    [currentUserId, loadConversations, loadMessages, repository],
  );

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!repository) return;
      await repository.markConversationRead(conversationId);
      await loadConversations();
    },
    [loadConversations, repository],
  );

  const sendMessage = useCallback(
    async (conversationId: string, body: string) => {
      const trimmedBody = body.trim();

      if (!session?.access_token) {
        throw new Error('Sessao invalida para envio de WhatsApp.');
      }

      if (!trimmedBody) {
        throw new Error('Mensagem vazia.');
      }

      setSending(true);

      try {
        const response = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            conversationId,
            body: trimmedBody,
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || 'Falha ao enviar WhatsApp.');
        }

        await Promise.all([loadConversations(), loadMessages(conversationId)]);
      } finally {
        setSending(false);
      }
    },
    [loadConversations, loadMessages, session?.access_token],
  );

  return {
    conversations,
    messagesByConversation,
    loading,
    sending,
    openClientConversation,
    loadMessages,
    markConversationRead,
    sendMessage,
    refreshWhatsapp: loadConversations,
  };
}
