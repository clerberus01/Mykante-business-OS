import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Transaction } from '../../types';
import { createTransactionRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';

export function useSupabaseTransactions() {
  const { supabase, organizationId } = useRepositoryContext();
  const queryClient = useQueryClient();
  const repository = useMemo(
    () => (organizationId ? createTransactionRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );

  const transactionsQueryKey = ['crm', organizationId, 'transactions'] as const;
  const transactionsQuery = useQuery({
    queryKey: transactionsQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listTransactions();
    },
  });

  const loadTransactions = useCallback(async () => {
    if (!repository) {
      return [];
    }

    try {
      return await queryClient.fetchQuery({
        queryKey: transactionsQueryKey,
        queryFn: () => repository.listTransactions(),
      });
    } catch (error) {
      console.warn(
        'Supabase transactions load failed:',
        toDataLayerError(error, 'Falha ao carregar lancamentos financeiros.'),
      );
      return [];
    }
  }, [queryClient, repository, transactionsQueryKey]);

  const addTransactionMutation = useMutation({
    mutationFn: async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
      if (!repository) return;
      await repository.createTransaction(transaction);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Transaction> }) => {
      if (!repository) return;
      await repository.updateTransaction(id, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });

  if (transactionsQuery.error) {
    console.warn(
      'Supabase transactions load failed:',
      toDataLayerError(transactionsQuery.error, 'Falha ao carregar lancamentos financeiros.'),
    );
  }

  return {
    transactions: transactionsQuery.error ? [] : transactionsQuery.data ?? [],
    loading: transactionsQuery.isLoading,
    addTransaction: addTransactionMutation.mutateAsync,
    updateTransaction: (id: string, data: Partial<Transaction>) => updateTransactionMutation.mutateAsync({ id, data }),
    refreshTransactions: loadTransactions,
  };
}
