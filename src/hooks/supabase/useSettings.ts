import { useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useRepositoryContext } from './useRepositoryContext';
import { queryKeys } from './queryKeys';

type ApiHealthResult = {
  status: 'ok' | 'error';
  message: string;
};

export function useSupabaseSettings() {
  const { user, organization, isAdmin, refreshAuth } = useAuth();
  const { supabase, organizationId, currentUserId } = useRepositoryContext();

  const mfaQuery = useQuery({
    queryKey: queryKeys.calendar.mfa(currentUserId),
    enabled: false,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();

      if (error) {
        throw error;
      }

      return data.all?.filter((factor) => factor.status === 'verified').length ?? 0;
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async ({
      fullName,
      avatarUrl,
      organizationName,
      lgpdContactEmail,
    }: {
      fullName: string;
      avatarUrl: string;
      organizationName: string;
      lgpdContactEmail: string;
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
        const { error: organizationError } = await supabase
          .from('organizations')
          .update({
            name: organizationName.trim() || organization.name || 'Mykante Workspace',
            lgpd_contact_email: lgpdContactEmail.trim() || null,
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

  const apiHealthMutation = useMutation({
    mutationKey: queryKeys.calendar.apiHealth(organizationId),
    mutationFn: async (): Promise<ApiHealthResult> => {
      const { error, count } = await supabase
        .from('organizations')
        .select('id', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      return {
        status: 'ok',
        message: `Supabase operacional. Organizações visíveis: ${count ?? 0}.`,
      };
    },
  });

  const loadMfaStatus = useCallback(async () => {
    await mfaQuery.refetch();
  }, [mfaQuery]);

  return {
    mfaFactorCount: mfaQuery.data ?? null,
    securityLoading: mfaQuery.isFetching || passwordResetMutation.isPending,
    savingProfile: saveProfileMutation.isPending,
    uploadingAvatar: uploadProfileAvatarMutation.isPending,
    saveProfile: saveProfileMutation.mutateAsync,
    uploadProfileAvatar: uploadProfileAvatarMutation.mutateAsync,
    loadMfaStatus,
    requestPasswordReset: passwordResetMutation.mutateAsync,
    checkApiHealth: apiHealthMutation.mutateAsync,
  };
}
