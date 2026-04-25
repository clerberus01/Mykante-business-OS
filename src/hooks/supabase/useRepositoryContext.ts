import { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getSupabaseBrowserClient } from '../../lib/supabase';

export function useRepositoryContext() {
  const { organization, user, role } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  return {
    supabase,
    organizationId: organization?.id ?? null,
    currentUserName: user?.displayName ?? user?.email ?? 'system',
    currentUserId: user?.id ?? 'system',
    currentUserRole: role ?? null,
  };
}
