import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StoredDocument } from '../../types';
import { createDocumentRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';
import { queryKeys } from './queryKeys';

const DOCUMENT_BUCKET = 'documents';

function getQueryError(error: unknown, fallbackMessage: string) {
  return error ? toDataLayerError(error, fallbackMessage) : null;
}

function guessFolder(file: File) {
  const mime = file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (mime.includes('pdf')) return 'Propostas';
  if (mime.includes('word') || ['doc', 'docx'].includes(extension)) return 'Briefings';
  if (mime.includes('zip') || ['zip', 'rar', '7z'].includes(extension)) return 'Assets';
  if (mime.includes('sheet') || mime.includes('csv') || ['xls', 'xlsx', 'csv'].includes(extension)) {
    return 'Relatórios';
  }

  return 'Contratos';
}

export function useSupabaseDocuments() {
  const { supabase, organizationId } = useRepositoryContext();
  const queryClient = useQueryClient();
  const repository = useMemo(
    () => (organizationId ? createDocumentRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const documentsQueryKey = useMemo(() => queryKeys.documents.root(organizationId), [organizationId]);
  const documentsQuery = useQuery({
    queryKey: documentsQueryKey,
    enabled: Boolean(repository),
    queryFn: async () => {
      if (!repository) return [];
      return repository.listDocuments();
    },
  });

  const loadDocuments = useCallback(async () => {
    if (!repository) {
      return [];
    }

    try {
      return await queryClient.fetchQuery({
        queryKey: documentsQueryKey,
        queryFn: () => repository.listDocuments(),
      });
    } catch (error) {
      console.warn('Supabase documents load failed:', toDataLayerError(error, 'Falha ao carregar documentos.'));
      return [];
    }
  }, [documentsQueryKey, queryClient, repository]);

  const uploadDocumentMutation = useMutation({
    mutationFn: async ({
      file,
      options,
    }: {
      file: File;
      options?: {
        folder?: string;
        clientId?: string | null;
        projectId?: string | null;
        proposalId?: string | null;
        displayName?: string;
      };
    }) => {
      if (!repository || !organizationId) return;

      const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const folder = options?.folder ?? guessFolder(file);
      const storagePath = `${organizationId}/${folder}/${safeName}`;

      const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });

      if (error) {
        throw error;
      }

      try {
        await repository.createDocument({
          bucketId: DOCUMENT_BUCKET,
          storagePath,
          fileName: file.name,
          displayName: options?.displayName ?? file.name,
          fileExtension: extension || null,
          mimeType: file.type || null,
          sizeBytes: file.size,
          folder,
          clientId: options?.clientId ?? null,
          projectId: options?.projectId ?? null,
          proposalId: options?.proposalId ?? null,
        });
      } catch (error) {
        await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsQueryKey });
    },
  });

  const uploadDocument = useCallback(
    (
      file: File,
      options?: {
        folder?: string;
        clientId?: string | null;
        projectId?: string | null;
        proposalId?: string | null;
        displayName?: string;
      },
    ) => uploadDocumentMutation.mutateAsync({ file, options }),
    [uploadDocumentMutation],
  );

  const deleteDocumentMutation = useMutation({
    mutationFn: async (document: StoredDocument) => {
      if (!repository) return;

      await repository.softDeleteDocument(document.id);

      const { error } = await supabase.storage.from(document.bucketId).remove([document.storagePath]);

      if (error) {
        console.warn('Supabase document storage cleanup failed:', error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsQueryKey });
    },
  });

  const deleteDocument = useCallback(
    (document: StoredDocument) => deleteDocumentMutation.mutateAsync(document),
    [deleteDocumentMutation],
  );

  const downloadDocument = useCallback(
    async (document: StoredDocument) => {
      const { data, error } = await supabase.storage.from(document.bucketId).createSignedUrl(document.storagePath, 60);

      if (error) {
        throw error;
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    },
    [supabase],
  );

  const documentsError = getQueryError(documentsQuery.error, 'Falha ao carregar documentos.');

  if (documentsError) {
    console.warn('Supabase documents load failed:', documentsError);
  }

  return {
    documents: documentsQuery.data ?? [],
    loading: documentsQuery.isLoading,
    error: documentsError,
    hasError: Boolean(documentsError),
    uploadDocument,
    deleteDocument,
    downloadDocument,
    refreshDocuments: loadDocuments,
  };
}
