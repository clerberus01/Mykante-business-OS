import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Proposal } from '../../types';
import { createProposalRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';

export function useSupabaseProposals() {
  const { supabase, organizationId } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createProposalRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(Boolean(organizationId));

  const loadProposals = useCallback(async () => {
    if (!repository) {
      setProposals([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setProposals(await repository.listProposals());
    } catch (error) {
      console.warn('Supabase proposals load failed:', toDataLayerError(error, 'Falha ao carregar propostas.'));
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  const addProposal = useCallback(
    async (proposal: Omit<Proposal, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!repository) return;
      await repository.createProposal(proposal);
      await loadProposals();
    },
    [loadProposals, repository],
  );

  const updateProposal = useCallback(
    async (id: string, data: Partial<Proposal>) => {
      if (!repository) return;
      await repository.updateProposal(id, data);
      await loadProposals();
    },
    [loadProposals, repository],
  );

  return { proposals, loading, addProposal, updateProposal, refreshProposals: loadProposals };
}
