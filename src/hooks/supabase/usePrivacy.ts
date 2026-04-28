import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepositoryContext } from './useRepositoryContext';
import { toDataLayerError } from '../../services';
import { queryKeys } from './queryKeys';

type DataSubjectRequestType =
  | 'confirm'
  | 'access'
  | 'correction'
  | 'portability'
  | 'anonymization'
  | 'deletion'
  | 'revocation';

type DataSubjectRequestStatus = 'open' | 'in_progress' | 'completed' | 'rejected';

type DataSubjectRequest = {
  id: string;
  requestType: DataSubjectRequestType;
  status: DataSubjectRequestStatus;
  requestDetails: string | null;
  responseSummary: string | null;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
};

type RetentionPolicy = {
  id: string;
  tableName: string;
  legalBasis: string;
  retentionDays: number;
  anonymizeAfterDays: number | null;
  notes: string | null;
};

type OrganizationPrivacy = {
  name: string | null;
  lgpdContactEmail: string | null;
};

type PrivacyState = {
  requests: DataSubjectRequest[];
  retentionPolicies: RetentionPolicy[];
  organizationPrivacy: OrganizationPrivacy | null;
};

function mapRequestRow(row: any): DataSubjectRequest {
  return {
    id: row.id,
    requestType: row.request_type,
    status: row.status,
    requestDetails: row.request_details ?? null,
    responseSummary: row.response_summary ?? null,
    dueAt: row.due_at,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
  };
}

function mapRetentionRow(row: any): RetentionPolicy {
  return {
    id: row.id,
    tableName: row.table_name,
    legalBasis: row.legal_basis,
    retentionDays: row.retention_days,
    anonymizeAfterDays: row.anonymize_after_days ?? null,
    notes: row.notes ?? null,
  };
}

export function useSupabasePrivacy() {
  const { supabase, organizationId, currentUserId } = useRepositoryContext();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.privacy.root(organizationId, currentUserId);

  const loadPrivacyState = useCallback(async (): Promise<PrivacyState> => {
    if (!organizationId) {
      return {
        requests: [],
        retentionPolicies: [],
        organizationPrivacy: null,
      };
    }

    const [requestsResult, retentionResult, organizationResult] = await Promise.all([
      supabase
        .from('data_subject_requests')
        .select('id, request_type, status, request_details, response_summary, due_at, completed_at, created_at')
        .eq('organization_id', organizationId)
        .eq('requester_user_id', currentUserId)
        .order('created_at', { ascending: false }),
      supabase
        .from('data_retention_policies')
        .select('id, table_name, legal_basis, retention_days, anonymize_after_days, notes')
        .eq('organization_id', organizationId)
        .order('table_name', { ascending: true }),
      supabase
        .from('organizations')
        .select('name, lgpd_contact_email')
        .eq('id', organizationId)
        .maybeSingle(),
    ]);

    if (requestsResult.error) throw requestsResult.error;
    if (retentionResult.error) throw retentionResult.error;
    if (organizationResult.error) throw organizationResult.error;

    return {
      requests: (requestsResult.data ?? []).map(mapRequestRow),
      retentionPolicies: (retentionResult.data ?? []).map(mapRetentionRow),
      organizationPrivacy: organizationResult.data
        ? {
            name: organizationResult.data.name ?? null,
            lgpdContactEmail: organizationResult.data.lgpd_contact_email ?? null,
          }
        : null,
    };
  }, [currentUserId, organizationId, supabase]);

  const privacyQuery = useQuery<PrivacyState>({
    queryKey,
    queryFn: loadPrivacyState,
    enabled: Boolean(organizationId),
    initialData: {
      requests: [],
      retentionPolicies: [],
      organizationPrivacy: null,
    },
  });

  if (privacyQuery.error) {
    console.warn(
      'Supabase privacy load failed:',
      toDataLayerError(privacyQuery.error, 'Falha ao carregar dados de privacidade.'),
    );
  }

  const createDataRequestMutation = useMutation({
    mutationFn: async ({
      requestType,
      requestDetails,
    }: {
      requestType: DataSubjectRequestType;
      requestDetails: string | null;
    }) => {
      if (!organizationId) return;

      const { error } = await supabase.from('data_subject_requests').insert({
        organization_id: organizationId,
        requester_user_id: currentUserId,
        subject_type: 'user',
        subject_id: currentUserId,
        request_type: requestType,
        request_details: requestDetails,
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const createDataRequest = useCallback(
    async (requestType: DataSubjectRequestType, requestDetails: string | null) => {
      await createDataRequestMutation.mutateAsync({ requestType, requestDetails });
    },
    [createDataRequestMutation],
  );

  return {
    requests: privacyQuery.data.requests,
    retentionPolicies: privacyQuery.data.retentionPolicies,
    organizationPrivacy: privacyQuery.data.organizationPrivacy,
    loading: privacyQuery.isLoading || privacyQuery.isFetching,
    createDataRequest,
    refreshPrivacy: async () => {
      await privacyQuery.refetch();
    },
  };
}
