import { useCallback, useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Client, WhatsappMessage } from '@/src/types';
import { createWhatsappRepository, toDataLayerError } from '@/src/services';
import { useRepositoryContext } from '@/src/hooks/supabase/useRepositoryContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { queryKeys } from '@/src/hooks/supabase/queryKeys';

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
  const conversationsQueryKey = useMemo(() => queryKeys.whatsapp.conversations(organizationId), [organizationId]);
  const templatesQueryKey = useMemo(() => queryKeys.whatsapp.templates(organizationId), [organizationId]);
  const conversationsQuery = useQuery({
    queryKey: conversationsQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listConversations();
    },
  });
  const templatesQuery = useQuery({
    queryKey: templatesQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listTemplates();
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
          queryKey: queryKeys.whatsapp.messages(organizationId, conversationId),
          queryFn: () => repository.listMessages(conversationId),
        });
        return messages;
      } catch (error) {
        console.warn('Supabase WhatsApp messages load failed:', toDataLayerError(error, 'Falha ao carregar mensagens.'));
        return [];
      }
    },
    [organizationId, queryClient, repository],
  );

  const messageQueries = useQueries({
    queries: (conversationsQuery.data ?? []).map((conversation) => ({
      queryKey: queryKeys.whatsapp.messages(organizationId, conversation.id),
      enabled: false,
      queryFn: async () => {
        if (!repository) return [];
        return repository.listMessages(conversation.id);
      },
      initialData:
        queryClient.getQueryData<WhatsappMessage[]>(queryKeys.whatsapp.messages(organizationId, conversation.id)) ?? [],
    })),
  });

  const messagesByConversation = useMemo(() => {
    const nextMessages: Record<string, WhatsappMessage[]> = {};

    (conversationsQuery.data ?? []).forEach((conversation, index) => {
      nextMessages[conversation.id] = (messageQueries[index]?.data as WhatsappMessage[] | undefined) ?? [];
    });

    return nextMessages;
  }, [conversationsQuery.data, messageQueries]);

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

  const linkConversationClientMutation = useMutation({
    mutationFn: async ({ conversationId, clientId }: { conversationId: string; clientId: string }) => {
      if (!repository) return;
      await repository.linkConversationClient(conversationId, clientId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({
      conversationId,
      body,
      templateKey,
    }: {
      conversationId: string;
      body?: string;
      templateKey?: string;
    }) => {
      const trimmedBody = body?.trim() ?? '';

      if (!session?.access_token) {
        throw new Error('Sessao invalida para envio de WhatsApp.');
      }

      if (!organizationId) {
        throw new Error('Organizacao invalida para envio de WhatsApp.');
      }

      if (!trimmedBody && !templateKey) {
        throw new Error('Mensagem vazia.');
      }

      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          'X-Organization-Id': organizationId,
        },
        body: JSON.stringify({
          conversationId,
          body: trimmedBody || undefined,
          templateKey,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Falha ao enviar WhatsApp.');
      }

      return conversationId;
    },
    onSuccess: async (conversationId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: conversationsQueryKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.messages(organizationId, conversationId) }),
      ]);
      await loadMessages(conversationId);
    },
  });

  const sendMessage = useCallback(
    (conversationId: string, body: string, templateKey?: string) =>
      sendMessageMutation.mutateAsync({ conversationId, body, templateKey }),
    [sendMessageMutation],
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
    templates: templatesQuery.data ?? [],
    messagesByConversation,
    loading: conversationsQuery.isLoading,
    error: conversationsError,
    hasError: Boolean(conversationsError),
    sending: sendMessageMutation.isPending,
    openClientConversation: openClientConversationMutation.mutateAsync,
    loadMessages,
    markConversationRead: markConversationReadMutation.mutateAsync,
    linkConversationClient: linkConversationClientMutation.mutateAsync,
    sendMessage,
    refreshWhatsapp: loadConversations,
  };
}
