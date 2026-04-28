import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Contract, TemplateMarketplaceItem } from '@/src/types';
import { toDataLayerError } from '@/src/services';
import { toIsoString } from '@/src/services/shared/mappers';
import { useRepositoryContext } from '@/src/hooks/supabase/useRepositoryContext';
import { queryKeys } from '@/src/hooks/supabase/queryKeys';

type ContractRecord = {
  id: string;
  client_id: string | null;
  project_id: string | null;
  document_id: string | null;
  title: string;
  status: Contract['status'];
  contract_type: string;
  amount: number | null;
  currency: string;
  starts_at: string;
  ends_at: string | null;
  renewal_interval: Contract['renewalInterval'];
  auto_renew: boolean;
  renewal_notice_days: number;
  next_renewal_at: string | null;
  last_renewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type MarketplaceRecord = {
  id: string;
  template_type: TemplateMarketplaceItem['templateType'];
  name: string;
  description: string | null;
  payload: Record<string, unknown>;
  locale: string;
  currency: string;
  is_public: boolean;
  install_count: number;
  created_at: string;
};

function mapContract(record: ContractRecord): Contract {
  return {
    id: record.id,
    clientId: record.client_id ?? undefined,
    projectId: record.project_id ?? undefined,
    documentId: record.document_id ?? undefined,
    title: record.title,
    status: record.status,
    contractType: record.contract_type,
    amount: Number(record.amount ?? 0),
    currency: record.currency,
    startsAt: toIsoString(record.starts_at),
    endsAt: record.ends_at ? toIsoString(record.ends_at) : undefined,
    renewalInterval: record.renewal_interval,
    autoRenew: record.auto_renew,
    renewalNoticeDays: record.renewal_notice_days,
    nextRenewalAt: record.next_renewal_at ? toIsoString(record.next_renewal_at) : undefined,
    lastRenewedAt: record.last_renewed_at ? toIsoString(record.last_renewed_at) : undefined,
    notes: record.notes ?? undefined,
    createdAt: toIsoString(record.created_at),
    updatedAt: toIsoString(record.updated_at),
  };
}

function mapMarketplaceItem(record: MarketplaceRecord): TemplateMarketplaceItem {
  return {
    id: record.id,
    templateType: record.template_type,
    name: record.name,
    description: record.description ?? undefined,
    payload: record.payload ?? {},
    locale: record.locale,
    currency: record.currency,
    isPublic: record.is_public,
    installCount: record.install_count,
    createdAt: toIsoString(record.created_at),
  };
}

export function useSupabaseContracts() {
  const { supabase, organizationId } = useRepositoryContext();
  const queryClient = useQueryClient();
  const contractsQueryKey = useMemo(() => queryKeys.contracts.root(organizationId), [organizationId]);
  const marketplaceQueryKey = useMemo(() => queryKeys.contracts.marketplace(organizationId), [organizationId]);
  const loadContracts = async () => {
    if (!organizationId) return [];

    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return ((data as ContractRecord[] | null) ?? []).map(mapContract);
  };
  const loadMarketplace = async () => {
    if (!organizationId) return [];

    const { data, error } = await supabase
      .from('template_marketplace_items')
      .select('*')
      .or(`is_public.eq.true,organization_id.eq.${organizationId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data as MarketplaceRecord[] | null) ?? []).map(mapMarketplaceItem);
  };

  const contractsQuery = useQuery({
    queryKey: contractsQueryKey,
    enabled: Boolean(organizationId),
    queryFn: loadContracts,
  });

  const marketplaceQuery = useQuery({
    queryKey: marketplaceQueryKey,
    enabled: Boolean(organizationId),
    queryFn: loadMarketplace,
  });

  const createContractMutation = useMutation({
    mutationFn: async (contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!organizationId) return;

      const { error } = await supabase.from('contracts').insert({
        organization_id: organizationId,
        client_id: contract.clientId ?? null,
        project_id: contract.projectId ?? null,
        document_id: contract.documentId ?? null,
        title: contract.title,
        status: contract.status,
        contract_type: contract.contractType,
        amount: contract.amount,
        currency: contract.currency,
        starts_at: contract.startsAt.slice(0, 10),
        ends_at: contract.endsAt ? contract.endsAt.slice(0, 10) : null,
        renewal_interval: contract.renewalInterval,
        auto_renew: contract.autoRenew,
        renewal_notice_days: contract.renewalNoticeDays,
        notes: contract.notes ?? null,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contractsQueryKey });
    },
  });

  const contractError = contractsQuery.error
    ? toDataLayerError(contractsQuery.error, 'Falha ao carregar contratos.')
    : null;
  const marketplaceError = marketplaceQuery.error
    ? toDataLayerError(marketplaceQuery.error, 'Falha ao carregar marketplace de templates.')
    : null;

  return {
    contracts: contractsQuery.data ?? [],
    marketplaceItems: marketplaceQuery.data ?? [],
    loading: contractsQuery.isLoading || marketplaceQuery.isLoading,
    error: contractError ?? marketplaceError,
    hasError: Boolean(contractError ?? marketplaceError),
    createContract: createContractMutation.mutateAsync,
    creatingContract: createContractMutation.isPending,
    refreshContracts: async () => {
      await Promise.all([
        queryClient.fetchQuery({ queryKey: contractsQueryKey, queryFn: loadContracts }),
        queryClient.fetchQuery({ queryKey: marketplaceQueryKey, queryFn: loadMarketplace }),
      ]);
    },
  };
}
