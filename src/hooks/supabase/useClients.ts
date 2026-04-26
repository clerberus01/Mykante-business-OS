import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Client, CrmDeal, CrmPipelineStage, TimelineEvent } from '../../types';
import { createClientRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';

export function useSupabaseClients() {
  const { supabase, organizationId } = useRepositoryContext();
  const queryClient = useQueryClient();
  const repository = useMemo(
    () => (organizationId ? createClientRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );

  const clientsQueryKey = ['crm', organizationId, 'clients'] as const;
  const clientsQuery = useQuery({
    queryKey: clientsQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listClients();
    },
  });

  const loadClients = useCallback(async () => {
    if (!repository) {
      return [];
    }

    try {
      return await queryClient.fetchQuery({
        queryKey: clientsQueryKey,
        queryFn: () => repository.listClients(),
      });
    } catch (error) {
      console.warn('Supabase clients load failed:', toDataLayerError(error, 'Falha ao carregar clientes.'));
      return [];
    }
  }, [clientsQueryKey, queryClient, repository]);

  const addClientMutation = useMutation({
    mutationFn: async (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!repository) return;
      await repository.createClient(client);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['crm', organizationId] });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!repository) return;
      if (!window.confirm('Deseja realmente excluir este cliente?')) return;
      await repository.softDeleteClient(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['crm', organizationId] });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Client> }) => {
      if (!repository) return;
      await repository.updateClient(id, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['crm', organizationId] });
    },
  });

  const clients = clientsQuery.error
    ? []
    : clientsQuery.data ?? [];

  if (clientsQuery.error) {
    console.warn('Supabase clients load failed:', toDataLayerError(clientsQuery.error, 'Falha ao carregar clientes.'));
  }

  return {
    clients,
    loading: clientsQuery.isLoading,
    addClient: addClientMutation.mutateAsync,
    deleteClient: deleteClientMutation.mutateAsync,
    updateClient: (id: string, data: Partial<Client>) => updateClientMutation.mutateAsync({ id, data }),
    refreshClients: loadClients,
  };
}

export function useSupabaseEvents(clientId: string | null) {
  const { supabase, organizationId, currentUserName } = useRepositoryContext();
  const queryClient = useQueryClient();
  const repository = useMemo(
    () => (organizationId ? createClientRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const eventsQueryKey = ['crm', organizationId, 'clients', clientId, 'events'] as const;

  const eventsQuery = useQuery({
    queryKey: eventsQueryKey,
    enabled: Boolean(repository && clientId),
    queryFn: async () => {
      if (!repository || !clientId) return [];
      return repository.listEvents(clientId);
    },
  });

  const loadEvents = useCallback(async () => {
    if (!repository || !clientId) {
      return [];
    }

    try {
      return await queryClient.fetchQuery({
        queryKey: eventsQueryKey,
        queryFn: () => repository.listEvents(clientId),
      });
    } catch (error) {
      console.warn('Supabase client events load failed:', toDataLayerError(error, 'Falha ao carregar eventos.'));
      return [];
    }
  }, [clientId, eventsQueryKey, queryClient, repository]);

  const addEventMutation = useMutation({
    mutationFn: async (event: Omit<TimelineEvent, 'id' | 'createdAt' | 'createdBy'>) => {
      if (!repository || !clientId) return;
      await repository.createEvent(clientId, event, currentUserName);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: eventsQueryKey });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!repository || !clientId) return;
      await repository.deleteEvent(clientId, eventId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: eventsQueryKey });
    },
  });

  if (eventsQuery.error) {
    console.warn('Supabase client events load failed:', toDataLayerError(eventsQuery.error, 'Falha ao carregar eventos.'));
  }

  return {
    events: eventsQuery.error ? [] : eventsQuery.data ?? [],
    loading: eventsQuery.isLoading,
    addEvent: addEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
    refreshEvents: loadEvents,
  };
}

export function useSupabasePipeline() {
  const { supabase, organizationId, currentUserName } = useRepositoryContext();
  const queryClient = useQueryClient();
  const repository = useMemo(
    () => (organizationId ? createClientRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );

  const stagesQuery = useQuery({
    queryKey: ['crm', organizationId, 'pipeline-stages'],
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listPipelineStages();
    },
  });

  const dealsQuery = useQuery({
    queryKey: ['crm', organizationId, 'deals'],
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listDeals();
    },
  });

  const moveDealMutation = useMutation({
    mutationFn: async ({
      deal,
      nextStage,
      previousStageName,
    }: {
      deal: CrmDeal;
      nextStage: CrmPipelineStage;
      previousStageName: string;
    }) => {
      if (!repository) return;
      await repository.moveDeal(deal, nextStage, previousStageName, currentUserName);
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['crm', organizationId, 'deals'] }),
        queryClient.invalidateQueries({ queryKey: ['crm', organizationId, 'clients', variables.deal.clientId, 'events'] }),
      ]);
    },
  });

  if (stagesQuery.error) {
    console.warn('Supabase pipeline stages load failed:', toDataLayerError(stagesQuery.error, 'Falha ao carregar estagios.'));
  }

  if (dealsQuery.error) {
    console.warn('Supabase deals load failed:', toDataLayerError(dealsQuery.error, 'Falha ao carregar oportunidades.'));
  }

  return {
    stages: stagesQuery.error ? [] : stagesQuery.data ?? [],
    deals: dealsQuery.error ? [] : dealsQuery.data ?? [],
    loading: stagesQuery.isLoading || dealsQuery.isLoading,
    moveDeal: moveDealMutation.mutateAsync,
    movingDealId: moveDealMutation.variables?.deal.id ?? null,
  };
}
