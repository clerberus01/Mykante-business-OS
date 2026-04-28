import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/contexts/AuthContext';
import { useRepositoryContext } from '@/src/hooks/supabase/useRepositoryContext';
import { queryKeys } from '@/src/hooks/supabase/queryKeys';
import type { OrganizationBranding } from '@/src/lib/branding';

type ApiHealthResult = {
  status: 'ok' | 'error';
  message: string;
};

export function useSupabaseSettings() {
  const { user, organization, isAdmin, refreshAuth } = useAuth();
  const { supabase, organizationId, currentUserId } = useRepositoryContext();
  const queryClient = useQueryClient();
  const mfaQueryKey = queryKeys.settings.mfa(currentUserId);
  const apiHealthQueryKey = queryKeys.settings.apiHealth(organizationId);

  const loadMfaFactorCount = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      throw error;
    }

    return data.all?.filter((factor) => factor.status === 'verified').length ?? 0;
  }, [supabase.auth.mfa]);

  const loadApiHealth = useCallback(async (): Promise<ApiHealthResult> => {
    const { error } = await supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    return {
      status: 'ok',
      message: 'Serviço de dados operacional para a sessão atual.',
    };
  }, [supabase]);

  const mfaQuery = useQuery({
    queryKey: mfaQueryKey,
    enabled: false,
    queryFn: loadMfaFactorCount,
  });
  const apiHealthQuery = useQuery({
    queryKey: apiHealthQueryKey,
    enabled: false,
    queryFn: loadApiHealth,
  });

  const saveProfileMutation = useMutation({
    mutationFn: async ({
      fullName,
      avatarUrl,
      organizationName,
      lgpdContactEmail,
      branding,
    }: {
      fullName: string;
      avatarUrl: string;
      organizationName: string;
      lgpdContactEmail: string;
      branding?: OrganizationBranding;
    }) => {
      if (!user) return;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      if (organization?.id && isAdmin) {
        const { data: organizationRecord, error: metadataError } = await supabase
          .from('organizations')
          .select('metadata')
          .eq('id', organization.id)
          .maybeSingle();

        if (metadataError) {
          throw metadataError;
        }

        const currentMetadata =
          organizationRecord?.metadata && typeof organizationRecord.metadata === 'object'
            ? organizationRecord.metadata as Record<string, unknown>
            : {};
        const metadata = branding ? { ...currentMetadata, branding } : currentMetadata;

        const { error: organizationError } = await supabase
          .from('organizations')
          .update({
            name: organizationName.trim() || organization.name || 'Mykante Workspace',
            lgpd_contact_email: lgpdContactEmail.trim() || null,
            metadata,
          })
          .eq('id', organization.id);

        if (organizationError) {
          throw organizationError;
        }
      }

      await refreshAuth();
    },
  });

  const uploadProfileAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) return '';

      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const storagePath = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(storagePath, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('profile-avatars').getPublicUrl(storagePath);
      const publicUrl = data.publicUrl;
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      await refreshAuth();
      return publicUrl;
    },
  });

  const passwordResetMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) {
        throw new Error('Usuario sem e-mail valido.');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin,
      });

      if (error) {
        throw error;
      }
    },
  });

  const loadMfaStatus = useCallback(async () => {
    await queryClient.fetchQuery({ queryKey: mfaQueryKey, queryFn: loadMfaFactorCount });
  }, [loadMfaFactorCount, mfaQueryKey, queryClient]);

  const checkApiHealth = useCallback(async () => (
    queryClient.fetchQuery({ queryKey: apiHealthQueryKey, queryFn: loadApiHealth })
  ), [apiHealthQueryKey, loadApiHealth, queryClient]);

  return {
    mfaFactorCount: mfaQuery.data ?? null,
    securityLoading: mfaQuery.isFetching || apiHealthQuery.isFetching || passwordResetMutation.isPending,
    savingProfile: saveProfileMutation.isPending,
    uploadingAvatar: uploadProfileAvatarMutation.isPending,
    saveProfile: saveProfileMutation.mutateAsync,
    uploadProfileAvatar: uploadProfileAvatarMutation.mutateAsync,
    loadMfaStatus,
    requestPasswordReset: passwordResetMutation.mutateAsync,
    checkApiHealth,
  };
}
