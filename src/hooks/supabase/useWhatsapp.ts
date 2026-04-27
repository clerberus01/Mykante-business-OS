import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Client, WhatsappConversation, WhatsappMessage } from '../../types';
import { createWhatsappRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';
import { useAuth } from '../../contexts/AuthContext';

function getQueryError(error: unknown, fallbackMessage: string) {
  return error ? toDataLayerError(error, fallbackMessage) : null;
}

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
  const queryClient = useQueryClient();
  const repository = useMemo(
    () => (organizationId ? createWhatsappRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, WhatsappMessage[]>>({});
  const [sending, setSending] = useState(false);
  const conversationsQueryKey = ['whatsapp', organizationId, 'conversations'] as const;
  const conversationsQuery = useQuery({
    queryKey: conversationsQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listConversations();
    },
  });

  const loadConversations = useCallback(async () => {
    if (!repository) {
      return [];
    }

    try {
      return await queryClient.fetchQuery({
        queryKey: conversationsQueryKey,
        queryFn: () => repository.listConversations(),
      });
    } catch (error) {
      console.warn('Supabase WhatsApp conversations load failed:', toDataLayerError(error, 'Falha ao carregar WhatsApp.'));
      return [];
    }
  }, [conversationsQueryKey, queryClient, repository]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (!repository) return;

      try {
        const messages = await queryClient.fetchQuery({
          queryKey: ['whatsapp', organizationId, 'messages', conversationId],
          queryFn: () => repository.listMessages(conversationId),
        });
        setMessagesByConversation((current) => ({
          ...current,
          [conversationId]: messages,
        }));
      } catch (error) {
        console.warn('Supabase WhatsApp messages load failed:', toDataLayerError(error, 'Falha ao carregar mensagens.'));
      }
    },
    [organizationId, queryClient, repository],
  );

  useEffect(() => {
    for (const conversation of conversationsQuery.data ?? []) {
      const cachedMessages = queryClient.getQueryData<WhatsappMessage[]>([
        'whatsapp',
        organizationId,
        'messages',
        conversation.id,
      ]);

      if (cachedMessages) {
        setMessagesByConversation((current) => ({
          ...current,
          [conversation.id]: cachedMessages,
        }));
      }
    }
  }, [conversationsQuery.data, organizationId, queryClient]);

  const openClientConversationMutation = useMutation({
    mutationFn: async (client: Client) => {
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

      await loadMessages(conversation.id);
      return conversation;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  const markConversationReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!repository) return;
      await repository.markConversationRead(conversationId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  const sendMessage = useCallback(
    async (conversationId: string, body: string) => {
      const trimmedBody = body.trim();

      if (!session?.access_token) {
        throw new Error('Sessao invalida para envio de WhatsApp.');
      }

      if (!organizationId) {
        throw new Error('Organizacao invalida para envio de WhatsApp.');
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
            'X-Organization-Id': organizationId,
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

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: conversationsQueryKey }),
          queryClient.invalidateQueries({ queryKey: ['whatsapp', organizationId, 'messages', conversationId] }),
        ]);
        await loadMessages(conversationId);
      } finally {
        setSending(false);
      }
    },
    [conversationsQueryKey, loadMessages, organizationId, queryClient, session?.access_token],
  );

  const conversationsError = getQueryError(conversationsQuery.error, 'Falha ao carregar WhatsApp.');

  if (conversationsError) {
    console.warn(
      'Supabase WhatsApp conversations load failed:',
      conversationsError,
    );
  }

  return {
    conversations: conversationsQuery.data ?? [],
    messagesByConversation,
    loading: conversationsQuery.isLoading,
    error: conversationsError,
    hasError: Boolean(conversationsError),
    sending,
    openClientConversation: openClientConversationMutation.mutateAsync,
    loadMessages,
    markConversationRead: markConversationReadMutation.mutateAsync,
    sendMessage,
    refreshWhatsapp: loadConversations,
  };
}
