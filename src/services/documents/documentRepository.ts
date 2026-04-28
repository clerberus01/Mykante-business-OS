import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentVersion, StoredDocument } from '../../types';
import { SupabaseRepository } from '../shared/supabaseRepository';
import { toIsoString } from '../shared/mappers';

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
  signature_status?: StoredDocument['signatureStatus'] | null;
  signature_provider?: string | null;
  signature_request_id?: string | null;
  signature_url?: string | null;
  signature_requested_at?: string | null;
  signature_completed_at?: string | null;
  ocr_status?: StoredDocument['ocrStatus'] | null;
  ocr_text?: string | null;
  ocr_data?: Record<string, unknown> | null;
  ocr_processed_at?: string | null;
  current_version?: number | null;
  created_at: string;
  updated_at: string;
};

type DocumentVersionRecord = {
  id: string;
  document_id: string;
  version_number: number;
  bucket_id: string;
  storage_path: string;
  file_name: string;
  file_extension: string | null;
  mime_type: string | null;
  size_bytes: number;
  checksum: string | null;
  change_summary: string | null;
  created_at: string;
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
    signatureStatus: record.signature_status ?? 'not_requested',
    signatureProvider: record.signature_provider ?? undefined,
    signatureRequestId: record.signature_request_id ?? undefined,
    signatureUrl: record.signature_url ?? undefined,
    signatureRequestedAt: record.signature_requested_at ? toIsoString(record.signature_requested_at) : undefined,
    signatureCompletedAt: record.signature_completed_at ? toIsoString(record.signature_completed_at) : undefined,
    ocrStatus: record.ocr_status ?? 'not_requested',
    ocrText: record.ocr_text ?? undefined,
    ocrData: record.ocr_data ?? undefined,
    ocrProcessedAt: record.ocr_processed_at ? toIsoString(record.ocr_processed_at) : undefined,
    currentVersion: record.current_version ?? 1,
    createdAt: toIsoString(record.created_at),
    updatedAt: toIsoString(record.updated_at),
  };
}

function mapDocumentVersionRecord(record: DocumentVersionRecord): DocumentVersion {
  return {
    id: record.id,
    documentId: record.document_id,
    versionNumber: record.version_number,
    bucketId: record.bucket_id,
    storagePath: record.storage_path,
    fileName: record.file_name,
    fileExtension: record.file_extension ?? undefined,
    mimeType: record.mime_type ?? undefined,
    sizeBytes: Number(record.size_bytes ?? 0),
    checksum: record.checksum ?? undefined,
    changeSummary: record.change_summary ?? undefined,
    createdAt: toIsoString(record.created_at),
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
    const rows = await this.unwrap(
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
        .select('id, organization_id, bucket_id, storage_path, file_name, file_extension, mime_type, size_bytes, created_by, created_at')
        .limit(1),
      'Nao foi possivel registrar o documento.',
    );

    const document = (rows as Array<{
      id: string;
      organization_id: string;
      bucket_id: string;
      storage_path: string;
      file_name: string;
      file_extension: string | null;
      mime_type: string | null;
      size_bytes: number;
      created_by: string | null;
      created_at: string;
    }>)[0];

    if (document) {
      await this.unwrap(
        this.supabase
          .from('document_versions')
          .insert({
            organization_id: document.organization_id,
            document_id: document.id,
            version_number: 1,
            bucket_id: document.bucket_id,
            storage_path: document.storage_path,
            file_name: document.file_name,
            file_extension: document.file_extension,
            mime_type: document.mime_type,
            size_bytes: document.size_bytes,
            created_by: document.created_by,
            created_at: document.created_at,
          })
          .select('id'),
        'Nao foi possivel registrar a versao inicial do documento.',
      );
    }
  }

  async listVersions(documentId: string) {
    const rows = await this.unwrap(
      this.supabase
        .from('document_versions')
        .select('*')
        .eq('organization_id', this.organizationId)
        .eq('document_id', documentId)
        .order('version_number', { ascending: false }),
      'Nao foi possivel carregar as versoes do documento.',
    );

    return (rows as DocumentVersionRecord[]).map(mapDocumentVersionRecord);
  }

  async addVersion(input: {
    documentId: string;
    bucketId: string;
    storagePath: string;
    fileName: string;
    fileExtension?: string | null;
    mimeType?: string | null;
    sizeBytes: number;
    changeSummary?: string | null;
  }) {
    const versions = await this.listVersions(input.documentId);
    const nextVersion = Math.max(0, ...versions.map((version) => version.versionNumber)) + 1;

    await this.unwrap(
      this.supabase
        .from('document_versions')
        .insert({
          organization_id: this.organizationId,
          document_id: input.documentId,
          version_number: nextVersion,
          bucket_id: input.bucketId,
          storage_path: input.storagePath,
          file_name: input.fileName,
          file_extension: input.fileExtension ?? null,
          mime_type: input.mimeType ?? null,
          size_bytes: input.sizeBytes,
          change_summary: input.changeSummary ?? null,
        })
        .select('id'),
      'Nao foi possivel registrar nova versao do documento.',
    );

    await this.unwrap(
      this.supabase
        .from('documents')
        .update({
          bucket_id: input.bucketId,
          storage_path: input.storagePath,
          file_name: input.fileName,
          display_name: input.fileName,
          file_extension: input.fileExtension ?? null,
          mime_type: input.mimeType ?? null,
          size_bytes: input.sizeBytes,
          current_version: nextVersion,
        })
        .eq('organization_id', this.organizationId)
        .eq('id', input.documentId)
        .select('id'),
      'Nao foi possivel atualizar o documento para a nova versao.',
    );
  }

  async requestSignature(input: {
    documentId: string;
    provider: string;
    signerEmail: string;
    signerName?: string | null;
    signingUrl?: string | null;
  }) {
    await this.unwrap(
      this.supabase
        .from('document_signature_requests')
        .insert({
          organization_id: this.organizationId,
          document_id: input.documentId,
          provider: input.provider,
          signer_email: input.signerEmail,
          signer_name: input.signerName ?? null,
          signing_url: input.signingUrl ?? null,
        })
        .select('id'),
      'Nao foi possivel solicitar assinatura do documento.',
    );
  }

  async updateOcrResult(
    documentId: string,
    status: NonNullable<StoredDocument['ocrStatus']>,
    text?: string | null,
    data?: Record<string, unknown>,
  ) {
    await this.unwrap(
      this.supabase
        .from('documents')
        .update({
          ocr_status: status,
          ocr_text: text ?? null,
          ocr_data: data ?? {},
          ocr_processed_at: ['completed', 'failed', 'provider_required'].includes(status) ? new Date().toISOString() : null,
        })
        .eq('organization_id', this.organizationId)
        .eq('id', documentId)
        .select('id'),
      'Nao foi possivel atualizar o OCR do documento.',
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
