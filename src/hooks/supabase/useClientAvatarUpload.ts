import { useMutation } from '@tanstack/react-query';
import { useRepositoryContext } from './useRepositoryContext';

const CLIENT_AVATAR_BUCKET = 'client-avatars';

export function useClientAvatarUpload() {
  const { supabase, organizationId } = useRepositoryContext();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!organizationId) {
        throw new Error('Selecione uma organizacao antes de enviar a imagem do cliente.');
      }

      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeName =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const storagePath = `${organizationId}/${safeName}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(CLIENT_AVATAR_BUCKET).upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from(CLIENT_AVATAR_BUCKET).getPublicUrl(storagePath);
      return data.publicUrl;
    },
  });

  return {
    uploadClientAvatar: uploadMutation.mutateAsync,
    uploadingAvatar: uploadMutation.isPending,
  };
}
