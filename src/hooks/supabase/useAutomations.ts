import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AutomationRule, AutomationRun } from '../../types';
import { useRepositoryContext } from './useRepositoryContext';
import { queryKeys } from './queryKeys';

type AutomationRuleRecord = {
  id: string;
  rule_key: AutomationRule['ruleKey'];
  name: string;
  description: string | null;
  trigger_key: string;
  is_active: boolean;
  actions: AutomationRule['actions'] | null;
  created_at: string;
  updated_at: string;
};

type AutomationRunRecord = {
  id: string;
  rule_key: AutomationRun['ruleKey'];
  event_source: string;
  event_id: string;
  status: AutomationRun['status'];
  details: Record<string, unknown> | null;
  created_at: string;
};

function mapAutomationRule(record: AutomationRuleRecord): AutomationRule {
  return {
    id: record.id,
    ruleKey: record.rule_key,
    name: record.name,
    description: record.description ?? undefined,
    triggerKey: record.trigger_key,
    isActive: record.is_active,
    actions: Array.isArray(record.actions) ? record.actions : [],
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function mapAutomationRun(record: AutomationRunRecord): AutomationRun {
  return {
    id: record.id,
    ruleKey: record.rule_key,
    eventSource: record.event_source,
    eventId: record.event_id,
    status: record.status,
    details: record.details ?? {},
    createdAt: record.created_at,
  };
}

export function useSupabaseAutomations() {
  const { supabase, organizationId } = useRepositoryContext();
  const queryClient = useQueryClient();
  const rulesQueryKey = useMemo(() => queryKeys.automations.rules(organizationId), [organizationId]);
  const runsQueryKey = useMemo(() => queryKeys.automations.runs(organizationId), [organizationId]);

  const rulesQuery = useQuery({
    queryKey: rulesQueryKey,
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('automation_rules')
        .select('id, rule_key, name, description, trigger_key, is_active, actions, created_at, updated_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as AutomationRuleRecord[]).map(mapAutomationRule);
    },
  });

  const runsQuery = useQuery({
    queryKey: runsQueryKey,
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('automation_runs')
        .select('id, rule_key, event_source, event_id, status, details, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      return ((data ?? []) as AutomationRunRecord[]).map(mapAutomationRun);
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      if (!organizationId) {
        throw new Error('Organizacao nao carregada.');
      }

      const { error } = await supabase
        .from('automation_rules')
        .update({ is_active: isActive })
        .eq('organization_id', organizationId)
        .eq('id', ruleId);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rulesQueryKey });
    },
  });

  const runOverdueScanMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) {
        throw new Error('Organizacao nao carregada.');
      }

      const { data, error } = await supabase.rpc('run_overdue_task_automations', {
        org_id: organizationId,
      });

      if (error) {
        throw error;
      }

      return Number(data ?? 0);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: runsQueryKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.root(organizationId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.crm.deals(organizationId) }),
      ]);
    },
  });

  return {
    rules: rulesQuery.data ?? [],
    runs: runsQuery.data ?? [],
    loading: rulesQuery.isLoading || runsQuery.isLoading,
    error: rulesQuery.error || runsQuery.error,
    toggleRule: toggleRuleMutation.mutateAsync,
    togglingRule: toggleRuleMutation.isPending,
    runOverdueScan: runOverdueScanMutation.mutateAsync,
    runningOverdueScan: runOverdueScanMutation.isPending,
    lastOverdueScanCount: runOverdueScanMutation.data,
    refreshAutomations: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: rulesQueryKey }),
        queryClient.invalidateQueries({ queryKey: runsQueryKey }),
      ]);
    },
  };
}
