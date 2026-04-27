import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Proposal } from '../../types';
import { createProposalRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';

function getQueryError(error: unknown, fallbackMessage: string) {
  return error ? toDataLayerError(error, fallbackMessage) : null;
}

export function useSupabaseProposals() {
  const { supabase, organizationId } = useRepositoryContext();
  const queryClient = useQueryClient();
  const repository = useMemo(
    () => (organizationId ? createProposalRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );

  const proposalsQueryKey = ['crm', organizationId, 'proposals'] as const;
  const proposalsQuery = useQuery({
    queryKey: proposalsQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listProposals();
    },
  });

  const loadProposals = useCallback(async () => {
    if (!repository) {
      return [];
    }

    try {
      return await queryClient.fetchQuery({
        queryKey: proposalsQueryKey,
        queryFn: () => repository.listProposals(),
      });
    } catch (error) {
      console.warn('Supabase proposals load failed:', toDataLayerError(error, 'Falha ao carregar propostas.'));
      return [];
    }
  }, [proposalsQueryKey, queryClient, repository]);

  const addProposalMutation = useMutation({
    mutationFn: async (proposal: Omit<Proposal, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!repository) return;
      await repository.createProposal(proposal);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['crm', organizationId] });
    },
  });

  const updateProposalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Proposal> }) => {
      if (!repository) return;
      await repository.updateProposal(id, data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: proposalsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['crm', organizationId, 'transactions'] }),
      ]);
    },
  });

  const proposalsError = getQueryError(proposalsQuery.error, 'Falha ao carregar propostas.');

  if (proposalsError) {
    console.warn('Supabase proposals load failed:', proposalsError);
  }

  return {
    proposals: proposalsQuery.data ?? [],
    loading: proposalsQuery.isLoading,
    error: proposalsError,
    hasError: Boolean(proposalsError),
    addProposal: addProposalMutation.mutateAsync,
    updateProposal: (id: string, data: Partial<Proposal>) => updateProposalMutation.mutateAsync({ id, data }),
    refreshProposals: loadProposals,
  };
}
