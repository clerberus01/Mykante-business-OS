import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../lib/supabase';
import { logoutOneSignalUser, syncOneSignalUser } from '../lib/onesignal';
import type { OrganizationBranding } from '../lib/branding';
import {
  assertAuthAttemptAllowed,
  recordAuthAttemptFailure,
  recordAuthAttemptSuccess,
} from '../lib/authRateLimit';

type AuthRole = 'owner' | 'admin' | 'manager' | 'operator';
type MfaStatus = 'unknown' | 'verified' | 'enrollment_required' | 'challenge_required';

interface MfaEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

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
  branding?: OrganizationBranding;
  defaultLocale?: string;
  defaultCurrency?: string;
  portalEnabled?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  mfaStatus: MfaStatus;
  mfaRequired: boolean;
  enrollMfa: () => Promise<MfaEnrollment>;
  verifyMfaEnrollment: (factorId: string, code: string) => Promise<void>;
  verifyMfaChallenge: (code: string) => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (input: {
    identifier: string;
    password: string;
  }) => Promise<{ requiresConfirmation: boolean }>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  canClaimInitialPlatformAdmin: boolean;
  claimInitialPlatformAdmin: () => Promise<void>;
  role: AuthRole | null;
  organization: OrganizationSummary | null;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const supabase = getSupabaseBrowserClient();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [canClaimInitialPlatformAdmin, setCanClaimInitialPlatformAdmin] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>('unknown');
  const [loading, setLoading] = useState(true);

  const resetState = () => {
    setSession(null);
    setUser(null);
    setRole(null);
    setOrganization(null);
    setIsPlatformAdmin(false);
    setCanClaimInitialPlatformAdmin(false);
    setMfaStatus('unknown');
  };

  const clearOrganizationState = () => {
    setRole(null);
    setOrganization(null);
    setIsPlatformAdmin(false);
    setCanClaimInitialPlatformAdmin(false);
  };

  const getVerifiedTotpFactorId = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      throw error;
    }

    const verifiedTotpFactor = data.totp?.find((factor) => factor.status === 'verified');
    return verifiedTotpFactor?.id ?? null;
  };

  const resolveMfaStatus = async () => {
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (assuranceError) {
      throw assuranceError;
    }

    if (assurance.currentLevel === 'aal2') {
      return 'verified' satisfies MfaStatus;
    }

    const verifiedTotpFactorId = await getVerifiedTotpFactorId();
    return verifiedTotpFactorId ? 'challenge_required' : 'enrollment_required';
  };

  const hydrateAuthState = async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      resetState();
      setLoading(false);
      return;
    }

    try {
      setSession(nextSession);

      setUser({
        id: nextSession.user.id,
        email: nextSession.user.email ?? null,
        displayName:
          nextSession.user.user_metadata.full_name ??
          nextSession.user.user_metadata.name ??
          nextSession.user.email?.split('@')[0] ??
          null,
        avatarUrl: nextSession.user.user_metadata.avatar_url ?? null,
      });

      const nextMfaStatus = await resolveMfaStatus();
      setMfaStatus(nextMfaStatus);

      if (nextMfaStatus !== 'verified') {
        clearOrganizationState();
        return;
      }

      await supabase.rpc('bootstrap_current_user_organization');

      const [platformAdminResult, platformAdminClaimResult] = await Promise.all([
        supabase.rpc('is_platform_admin'),
        supabase.rpc('can_claim_initial_platform_admin'),
      ]);

      if (platformAdminResult.error) {
        console.warn('Platform admin status unavailable:', platformAdminResult.error);
        setIsPlatformAdmin(false);
      } else {
        setIsPlatformAdmin(Boolean(platformAdminResult.data));
      }

      if (platformAdminClaimResult.error) {
        console.warn('Platform admin claim status unavailable:', platformAdminClaimResult.error);
        setCanClaimInitialPlatformAdmin(false);
      } else {
        setCanClaimInitialPlatformAdmin(Boolean(platformAdminClaimResult.data));
      }

      const [profileResult, membershipResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('email, full_name, avatar_url')
          .eq('id', nextSession.user.id)
          .maybeSingle(),
        supabase
          .from('organization_members')
          .select('id, organization_id, role, organizations(name, metadata, default_locale, default_currency, portal_enabled)')
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
            organizations?: {
              name: string | null;
              metadata?: Record<string, unknown> | null;
              default_locale?: string | null;
              default_currency?: string | null;
              portal_enabled?: boolean | null;
            } | Array<{
              name: string | null;
              metadata?: Record<string, unknown> | null;
              default_locale?: string | null;
              default_currency?: string | null;
              portal_enabled?: boolean | null;
            }> | null;
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
              branding: (organizationRecord?.metadata?.branding ?? undefined) as OrganizationBranding | undefined,
              defaultLocale: organizationRecord?.default_locale ?? undefined,
              defaultCurrency: organizationRecord?.default_currency ?? undefined,
              portalEnabled: organizationRecord?.portal_enabled ?? undefined,
            }
          : null,
      );

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

  const getAuthCredentials = (identifier: string) => {
    const normalizedIdentifier = identifier.trim();
    const normalizedEmail = normalizedIdentifier.toLowerCase();
    const phoneDigits = normalizedIdentifier.replace(/\D/g, '');

    if (normalizedIdentifier.includes('@')) {
      return {
        attemptKey: normalizedEmail,
        credentials: { email: normalizedEmail } as { email: string } | { phone: string },
      };
    }

    if (phoneDigits.length < 8) {
      throw new Error('Informe um e-mail ou telefone valido.');
    }

    const phone = normalizedIdentifier.startsWith('+')
      ? `+${phoneDigits}`
      : phoneDigits.length === 10 || phoneDigits.length === 11
        ? `+55${phoneDigits}`
        : `+${phoneDigits}`;

    return {
      attemptKey: phone,
      credentials: { phone } as { email: string } | { phone: string },
    };
  };

  const signIn = async (identifier: string, password: string) => {
    const { attemptKey, credentials } = getAuthCredentials(identifier);

    assertAuthAttemptAllowed('sign-in', attemptKey);

    const { error } = await supabase.auth.signInWithPassword({
      ...credentials,
      password,
    });

    if (error) {
      recordAuthAttemptFailure('sign-in', attemptKey);
      throw error;
    }

    recordAuthAttemptSuccess('sign-in', attemptKey);
  };

  const signUp = async ({ identifier, password }: { identifier: string; password: string }) => {
    const { attemptKey, credentials } = getAuthCredentials(identifier);

    assertAuthAttemptAllowed('sign-up', attemptKey);

    const { data, error } = await supabase.auth.signUp({
      ...credentials,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      recordAuthAttemptFailure('sign-up', attemptKey);
      throw error;
    }

    recordAuthAttemptSuccess('sign-up', attemptKey);

    return {
      requiresConfirmation: !data.session,
    };
  };

  const logout = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    try {
      await logoutOneSignalUser();
    } catch (oneSignalError) {
      console.warn('OneSignal logout unavailable:', oneSignalError);
    }
    resetState();
  };

  const isAdmin = role === 'owner' || role === 'admin';
  const mfaRequired = Boolean(session && user && mfaStatus !== 'verified');

  const claimInitialPlatformAdmin = async () => {
    const { error } = await supabase.rpc('claim_initial_platform_admin');

    if (error) {
      throw error;
    }

    setLoading(true);
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    await hydrateAuthState(currentSession);
  };

  const enrollMfa = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'Mykante Business OS',
      friendlyName: 'Mykante Business OS',
    });

    if (error) {
      throw error;
    }

    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  };

  const verifyMfaEnrollment = async (factorId: string, code: string) => {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) {
      throw challengeError;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    if (verifyError) {
      throw verifyError;
    }

    setLoading(true);
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    await hydrateAuthState(currentSession);
  };

  const verifyMfaChallenge = async (code: string) => {
    const factorId = await getVerifiedTotpFactorId();

    if (!factorId) {
      setMfaStatus('enrollment_required');
      throw new Error('Nenhum fator MFA verificado foi encontrado para esta conta.');
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) {
      throw challengeError;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    if (verifyError) {
      throw verifyError;
    }

    setLoading(true);
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    await hydrateAuthState(currentSession);
  };

  const value = {
    user,
    session,
    loading,
    mfaStatus,
    mfaRequired,
    enrollMfa,
    verifyMfaEnrollment,
    verifyMfaChallenge,
    signIn,
    signUp,
    logout,
    signOut: logout,
    isAdmin,
    isPlatformAdmin,
    canClaimInitialPlatformAdmin,
    claimInitialPlatformAdmin,
    role,
    organization,
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
      {children}
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
