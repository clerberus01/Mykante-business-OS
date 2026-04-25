import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoredDocument } from '../../types';
import { SupabaseRepository } from '../shared/supabaseRepository';
import { toUnixTimestamp } from '../shared/mappers';

type DocumentRecord = {
  id: string;
  organization_id: string;
  bucket_id: string;
  storage_path: string;
  file_name: string;
  display_name: string;
  file_extension: string | null;
  mime_type: string | null;
  size_bytes: number;
  folder: string;
  client_id: string | null;
  project_id: string | null;
  proposal_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapDocumentRecord(record: DocumentRecord): StoredDocument {
  return {
    id: record.id,
    bucketId: record.bucket_id,
    storagePath: record.storage_path,
    fileName: record.file_name,
    displayName: record.display_name,
    fileExtension: record.file_extension ?? undefined,
    mimeType: record.mime_type ?? undefined,
    sizeBytes: Number(record.size_bytes ?? 0),
    folder: record.folder,
    clientId: record.client_id ?? undefined,
    projectId: record.project_id ?? undefined,
    proposalId: record.proposal_id ?? undefined,
    createdAt: toUnixTimestamp(record.created_at),
    updatedAt: toUnixTimestamp(record.updated_at),
  };
}

export class SupabaseDocumentRepository extends SupabaseRepository {
  constructor(supabase: SupabaseClient, organizationId: string) {
    super(supabase, organizationId);
  }

  async listDocuments() {
    const rows = await this.unwrap(
      this.supabase
        .from('documents')
        .select('*')
        .eq('organization_id', this.organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      'Nao foi possivel carregar os documentos.',
    );

    return (rows as DocumentRecord[]).map(mapDocumentRecord);
  }

  async createDocument(input: {
    bucketId: string;
    storagePath: string;
    fileName: string;
    displayName: string;
    fileExtension?: string | null;
    mimeType?: string | null;
    sizeBytes: number;
    folder: string;
    clientId?: string | null;
    projectId?: string | null;
    proposalId?: string | null;
  }) {
    await this.unwrap(
      this.supabase
        .from('documents')
        .insert({
          organization_id: this.organizationId,
          bucket_id: input.bucketId,
          storage_path: input.storagePath,
          file_name: input.fileName,
          display_name: input.displayName,
          file_extension: input.fileExtension ?? null,
          mime_type: input.mimeType ?? null,
          size_bytes: input.sizeBytes,
          folder: input.folder,
          client_id: input.clientId ?? null,
          project_id: input.projectId ?? null,
          proposal_id: input.proposalId ?? null,
        })
        .select('id'),
      'Nao foi possivel registrar o documento.',
    );
  }

  async softDeleteDocument(id: string) {
    await this.unwrap(
      this.supabase
        .from('documents')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('organization_id', this.organizationId)
        .eq('id', id)
        .select('id'),
      'Nao foi possivel excluir o documento.',
    );
  }
}

export function createDocumentRepository(supabase: SupabaseClient, organizationId: string) {
  return new SupabaseDocumentRepository(supabase, organizationId);
}
