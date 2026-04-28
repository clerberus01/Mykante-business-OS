import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/src/lib/supabase';

type DomainEventRecord = {
  id: string;
  organization_id: string;
  event_type: string;
  source_table: string;
  source_operation: 'INSERT' | 'UPDATE' | 'DELETE';
  aggregate_type: string;
  aggregate_id: string | null;
  occurred_at: string;
};

const tableQueryPrefixes: Record<string, string[]> = {
  clients: ['crm', 'dashboard'],
  client_events: ['crm', 'dashboard'],
  crm_deals: ['crm', 'dashboard'],
  proposals: ['crm', 'dashboard', 'automations'],
  projects: ['projects', 'dashboard'],
  tasks: ['projects', 'dashboard', 'automations'],
  transactions: ['finance', 'crm', 'dashboard', 'automations'],
  payment_requests: ['finance', 'dashboard'],
  documents: ['documents', 'dashboard'],
  contracts: ['contracts', 'dashboard'],
  calendar_events: ['calendar', 'dashboard'],
  whatsapp_conversations: ['whatsapp', 'crm', 'dashboard'],
  whatsapp_messages: ['whatsapp', 'crm', 'dashboard'],
  automation_runs: ['automations', 'dashboard'],
};

export function useDomainEventsRealtime() {
  const { organization, user, loading } = useAuth();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (loading || !user || !organization?.id) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`domain-events:${organization.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'domain_events',
          filter: `organization_id=eq.${organization.id}`,
        },
        (payload) => {
          const event = payload.new as DomainEventRecord;
          const prefixes = tableQueryPrefixes[event.source_table] ?? ['dashboard'];

          for (const prefix of prefixes) {
            void queryClient.invalidateQueries({ queryKey: [prefix, organization.id] });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loading, organization?.id, queryClient, user]);
}
