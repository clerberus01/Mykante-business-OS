import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Transaction } from '../../types';
import { createTransactionRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';

export function useSupabaseTransactions() {
  const { supabase, organizationId } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createTransactionRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(Boolean(organizationId));

  const loadTransactions = useCallback(async () => {
    if (!repository) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setTransactions(await repository.listTransactions());
    } catch (error) {
      console.warn(
        'Supabase transactions load failed:',
        toDataLayerError(error, 'Falha ao carregar lancamentos financeiros.'),
      );
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const addTransaction = useCallback(
    async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
      if (!repository) return;
      await repository.createTransaction(transaction);
      await loadTransactions();
    },
    [loadTransactions, repository],
  );

  const updateTransaction = useCallback(
    async (id: string, data: Partial<Transaction>) => {
      if (!repository) return;
      await repository.updateTransaction(id, data);
      await loadTransactions();
    },
    [loadTransactions, repository],
  );

  return {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    refreshTransactions: loadTransactions,
  };
}
