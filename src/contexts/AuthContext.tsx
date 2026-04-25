import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../lib/supabase';
import { logoutOneSignalUser, syncOneSignalUser } from '../lib/onesignal';

type AuthRole = 'owner' | 'admin' | 'manager' | 'operator';

interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface OrganizationSummary {
  id: string;
  name: string | null;
  membershipId: string;
  role: AuthRole;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  createInitialAdminAccess: (input: {
    fullName: string;
    email: string;
    password: string;
  }) => Promise<{ requiresEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  role: AuthRole | null;
  organization: OrganizationSummary | null;
  canCreateInitialAdmin: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const supabase = getSupabaseBrowserClient();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [canCreateInitialAdmin, setCanCreateInitialAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const resetState = () => {
    setSession(null);
    setUser(null);
    setRole(null);
    setOrganization(null);
  };

  const loadBootstrapStatus = async () => {
    const { data, error } = await supabase.rpc('get_auth_bootstrap_status');

    if (error) {
      console.error('Supabase bootstrap status error:', error);
      return false;
    }

    const status = (!data
      ? null
      : Array.isArray(data)
        ? data[0]
        : data) as { can_create_initial_admin?: boolean } | null;
    const canCreate = Boolean(status?.can_create_initial_admin);
    setCanCreateInitialAdmin(canCreate);
    return canCreate;
  };

  const hydrateAuthState = async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      resetState();
      await loadBootstrapStatus();
      setLoading(false);
      return;
    }

    try {
      setSession(nextSession);

      await supabase.rpc('bootstrap_current_user_organization');

      const [profileResult, membershipResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('email, full_name, avatar_url')
          .eq('id', nextSession.user.id)
          .maybeSingle(),
        supabase
          .from('organization_members')
          .select('id, organization_id, role, organizations(name)')
          .eq('user_id', nextSession.user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1),
      ]);

      const profile = (profileResult.data as {
        email: string | null;
        full_name: string | null;
        avatar_url: string | null;
      } | null) ?? null;
      const membership = membershipResult.data?.[0] as
        | {
            id: string;
            organization_id: string;
            role: AuthRole;
            organizations?: { name: string | null } | { name: string | null }[] | null;
          }
        | undefined;

      const organizationRecord = Array.isArray(membership?.organizations)
        ? membership?.organizations[0]
        : membership?.organizations;

      setUser({
        id: nextSession.user.id,
        email: profile?.email ?? nextSession.user.email ?? null,
        displayName:
          profile?.full_name ??
          nextSession.user.user_metadata.full_name ??
          nextSession.user.user_metadata.name ??
          nextSession.user.email?.split('@')[0] ??
          null,
        avatarUrl: profile?.avatar_url ?? nextSession.user.user_metadata.avatar_url ?? null,
      });

      setRole(membership?.role ?? null);
      setOrganization(
        membership
          ? {
              id: membership.organization_id,
              name: organizationRecord?.name ?? null,
              membershipId: membership.id,
              role: membership.role,
            }
          : null,
      );
      setCanCreateInitialAdmin(false);

      try {
        await syncOneSignalUser({
          userId: nextSession.user.id,
          organizationId: membership?.organization_id ?? null,
          role: membership?.role ?? null,
        });
      } catch (oneSignalError) {
        console.warn('OneSignal sync unavailable:', oneSignalError);
      }
    } catch (error) {
      console.error('Supabase auth bootstrap error:', error);
      resetState();
      await loadBootstrapStatus();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      await hydrateAuthState(currentSession);
    };

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }

      void hydrateAuthState(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  };

  const createInitialAdminAccess = async ({
    fullName,
    email,
    password,
  }: {
    fullName: string;
    email: string;
    password: string;
  }) => {
    const canCreate = await loadBootstrapStatus();

    if (!canCreate) {
      throw new Error('O acesso ADM inicial já foi configurado.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          name: fullName,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      throw error;
    }

    return {
      requiresEmailConfirmation: !data.session,
    };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    try {
      await logoutOneSignalUser();
    } catch (oneSignalError) {
      console.warn('OneSignal logout unavailable:', oneSignalError);
    }
    resetState();
  };

  const isAdmin = role === 'owner' || role === 'admin';

  const value = {
    user,
    session,
    loading,
    signIn,
    createInitialAdminAccess,
    logout,
    signOut: logout,
    isAdmin,
    role,
    organization,
    canCreateInitialAdmin,
    refreshAuth: async () => {
      setLoading(true);
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      await hydrateAuthState(currentSession);
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
