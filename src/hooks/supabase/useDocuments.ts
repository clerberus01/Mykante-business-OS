import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StoredDocument } from '../../types';
import { createDocumentRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';

const DOCUMENT_BUCKET = 'documents';

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
  const repository = useMemo(
    () => (organizationId ? createDocumentRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(Boolean(organizationId));

  const loadDocuments = useCallback(async () => {
    if (!repository) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setDocuments(await repository.listDocuments());
    } catch (error) {
      console.warn('Supabase documents load failed:', toDataLayerError(error, 'Falha ao carregar documentos.'));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const uploadDocument = useCallback(
    async (file: File) => {
      if (!repository || !organizationId) return;

      const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const folder = guessFolder(file);
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
          displayName: file.name,
          fileExtension: extension || null,
          mimeType: file.type || null,
          sizeBytes: file.size,
          folder,
        });
      } catch (error) {
        await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
        throw error;
      }

      await loadDocuments();
    },
    [loadDocuments, organizationId, repository, supabase],
  );

  const deleteDocument = useCallback(
    async (document: StoredDocument) => {
      if (!repository) return;

      const { error } = await supabase.storage.from(document.bucketId).remove([document.storagePath]);

      if (error) {
        throw error;
      }

      await repository.softDeleteDocument(document.id);
      await loadDocuments();
    },
    [loadDocuments, repository, supabase],
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

  return {
    documents,
    loading,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    refreshDocuments: loadDocuments,
  };
}
