import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BankStatementLine, CostCenter, FinanceCategory, Transaction } from '../../types';
import { createTransactionRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';

function getQueryError(error: unknown, fallbackMessage: string) {
  return error ? toDataLayerError(error, fallbackMessage) : null;
}

export function useSupabaseTransactions() {
  const { supabase, organizationId } = useRepositoryContext();
  const queryClient = useQueryClient();
  const repository = useMemo(
    () => (organizationId ? createTransactionRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );

  const transactionsQueryKey = ['crm', organizationId, 'transactions'] as const;
  const categoriesQueryKey = ['finance', organizationId, 'categories'] as const;
  const costCentersQueryKey = ['finance', organizationId, 'cost-centers'] as const;
  const bankLinesQueryKey = ['finance', organizationId, 'bank-lines'] as const;
  const transactionsQuery = useQuery({
    queryKey: transactionsQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listTransactions();
    },
  });
  const categoriesQuery = useQuery({
    queryKey: categoriesQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => repository ? repository.listCategories() : [] as FinanceCategory[],
  });
  const costCentersQuery = useQuery({
    queryKey: costCentersQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => repository ? repository.listCostCenters() : [] as CostCenter[],
  });
  const bankLinesQuery = useQuery({
    queryKey: bankLinesQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => repository ? repository.listBankStatementLines() : [] as BankStatementLine[],
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
  const createCategoryMutation = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: FinanceCategory['type'] }) => {
      if (!repository) return;
      await repository.createCategory(name, type);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
  });
  const createCostCenterMutation = useMutation({
    mutationFn: async ({ name, code }: { name: string; code?: string }) => {
      if (!repository) return;
      await repository.createCostCenter(name, code);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: costCentersQueryKey }),
  });
  const generatePaymentMutation = useMutation({
    mutationFn: async ({ transaction, method }: { transaction: Transaction; method: 'pix' | 'boleto' }) => {
      if (!repository) return undefined;
      return repository.generatePaymentRequest(transaction, method);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: transactionsQueryKey }),
  });
  const importStatementMutation = useMutation({
    mutationFn: async ({ fileName, content, userId }: { fileName: string; content: string; userId?: string }) => {
      if (!repository) return 0;
      return repository.importBankStatement(fileName, content, transactionsQuery.data ?? [], userId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: transactionsQueryKey }),
        queryClient.invalidateQueries({ queryKey: bankLinesQueryKey }),
      ]);
    },
  });

  const transactionsError = getQueryError(transactionsQuery.error, 'Falha ao carregar lancamentos financeiros.');
  const categoriesError = getQueryError(categoriesQuery.error, 'Falha ao carregar categorias financeiras.');
  const costCentersError = getQueryError(costCentersQuery.error, 'Falha ao carregar centros de custo.');
  const bankLinesError = getQueryError(bankLinesQuery.error, 'Falha ao carregar conciliacao bancaria.');
  const financeError = transactionsError ?? categoriesError ?? costCentersError ?? bankLinesError;

  if (transactionsError) {
    console.warn(
      'Supabase transactions load failed:',
      transactionsError,
    );
  }

  if (categoriesError) {
    console.warn('Supabase finance categories load failed:', categoriesError);
  }

  if (costCentersError) {
    console.warn('Supabase cost centers load failed:', costCentersError);
  }

  if (bankLinesError) {
    console.warn('Supabase bank statement lines load failed:', bankLinesError);
  }

  return {
    transactions: transactionsQuery.data ?? [],
    categories: categoriesQuery.data ?? [],
    costCenters: costCentersQuery.data ?? [],
    bankStatementLines: bankLinesQuery.data ?? [],
    loading: transactionsQuery.isLoading,
    error: financeError,
    hasError: Boolean(financeError),
    addTransaction: addTransactionMutation.mutateAsync,
    updateTransaction: (id: string, data: Partial<Transaction>) => updateTransactionMutation.mutateAsync({ id, data }),
    createCategory: (name: string, type: FinanceCategory['type']) => createCategoryMutation.mutateAsync({ name, type }),
    createCostCenter: (name: string, code?: string) => createCostCenterMutation.mutateAsync({ name, code }),
    generatePaymentRequest: (transaction: Transaction, method: 'pix' | 'boleto') =>
      generatePaymentMutation.mutateAsync({ transaction, method }),
    importBankStatement: (fileName: string, content: string, userId?: string) =>
      importStatementMutation.mutateAsync({ fileName, content, userId }),
    refreshTransactions: loadTransactions,
  };
}
