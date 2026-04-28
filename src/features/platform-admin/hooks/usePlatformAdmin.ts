import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

type PlatformMetrics = {
  organizations: number;
  activeMembers: number;
  profiles: number;
  platformAdmins: number;
  events24h: number;
  pendingWebhooks: number;
};

type PlatformOrganization = {
  id: string;
  name: string | null;
  slug: string | null;
  createdAt: string;
  memberCount: number;
  activeMemberCount: number;
};

type PlatformAdmin = {
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
  status: string;
  createdAt: string;
  revokedAt: string | null;
};

type PlatformEvent = {
  id: string;
  organizationId: string | null;
  eventType: string;
  sourceTable: string;
  sourceOperation: string;
  aggregateId: string | null;
  occurredAt: string;
};

type PlatformWebhookDelivery = {
  id: string;
  organizationId: string;
  eventId: string;
  endpointId: string;
  status: string;
  attempts: number;
  nextAttemptAt: string;
  responseStatus: number | null;
  updatedAt: string;
};

export type PlatformAdminConsole = {
  metrics: PlatformMetrics;
  organizations: PlatformOrganization[];
  platformAdmins: PlatformAdmin[];
  recentEvents: PlatformEvent[];
  webhookDeliveries: PlatformWebhookDelivery[];
};

const EMPTY_CONSOLE: PlatformAdminConsole = {
  metrics: {
    organizations: 0,
    activeMembers: 0,
    profiles: 0,
    platformAdmins: 0,
    events24h: 0,
    pendingWebhooks: 0,
  },
  organizations: [],
  platformAdmins: [],
  recentEvents: [],
  webhookDeliveries: [],
};

export function usePlatformAdminConsole() {
  const { isPlatformAdmin, refreshAuth } = useAuth();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const queryKey = useMemo(() => ['platform-admin', 'console'] as const, []);

  const consoleQuery = useQuery({
    queryKey,
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_platform_admin_console');

      if (error) {
        throw error;
      }

      return (data ?? EMPTY_CONSOLE) as PlatformAdminConsole;
    },
    placeholderData: EMPTY_CONSOLE,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const revokeMyPlatformAccess = useCallback(async () => {
    const { error } = await supabase.rpc('revoke_current_platform_admin');

    if (error) {
      throw error;
    }

    await refreshAuth();
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey, refreshAuth, supabase]);

  return {
    console: consoleQuery.data ?? EMPTY_CONSOLE,
    loading: consoleQuery.isLoading,
    error: consoleQuery.error instanceof Error ? consoleQuery.error.message : null,
    refresh,
    revokeMyPlatformAccess,
  };
}
