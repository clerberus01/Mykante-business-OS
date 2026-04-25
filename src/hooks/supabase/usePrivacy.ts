import { useCallback, useEffect, useState } from 'react';
import { useRepositoryContext } from './useRepositoryContext';
import { toDataLayerError } from '../../services';

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
  const [requests, setRequests] = useState<DataSubjectRequest[]>([]);
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicy[]>([]);
  const [organizationPrivacy, setOrganizationPrivacy] = useState<OrganizationPrivacy | null>(null);
  const [loading, setLoading] = useState(Boolean(organizationId));

  const loadPrivacyState = useCallback(async () => {
    if (!organizationId) {
      setRequests([]);
      setRetentionPolicies([]);
      setOrganizationPrivacy(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
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

      setRequests((requestsResult.data ?? []).map(mapRequestRow));
      setRetentionPolicies((retentionResult.data ?? []).map(mapRetentionRow));
      setOrganizationPrivacy(
        organizationResult.data
          ? {
              name: organizationResult.data.name ?? null,
              lgpdContactEmail: organizationResult.data.lgpd_contact_email ?? null,
            }
          : null,
      );
    } catch (error) {
      console.warn('Supabase privacy load failed:', toDataLayerError(error, 'Falha ao carregar dados de privacidade.'));
      setRequests([]);
      setRetentionPolicies([]);
      setOrganizationPrivacy(null);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, organizationId, supabase]);

  useEffect(() => {
    void loadPrivacyState();
  }, [loadPrivacyState]);

  const createDataRequest = useCallback(
    async (requestType: DataSubjectRequestType, requestDetails: string | null) => {
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

      await loadPrivacyState();
    },
    [currentUserId, loadPrivacyState, organizationId, supabase],
  );

  return {
    requests,
    retentionPolicies,
    organizationPrivacy,
    loading,
    createDataRequest,
    refreshPrivacy: loadPrivacyState,
  };
}
