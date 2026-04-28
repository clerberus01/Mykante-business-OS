import type { SupabaseClient } from '@supabase/supabase-js';
import type { WhatsappConversation, WhatsappMessage, WhatsappTemplate } from '@/src/types';
import { SupabaseRepository } from '@/src/services/shared/supabaseRepository';
import { toIsoString } from '@/src/services/shared/mappers';

type ConversationRecord = {
  id: string;
  channel: WhatsappConversation['channel'] | null;
  client_id: string | null;
  project_id: string | null;
  contact_name: string;
  phone_e164: string;
  status: WhatsappConversation['status'];
  category: WhatsappConversation['category'] | null;
  classification_confidence: number | null;
  unread_count: number;
  suggested_client_status: WhatsappConversation['suggestedClientStatus'] | null;
  suggested_client_payload: WhatsappConversation['suggestedClientPayload'] | null;
  last_message_body: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRecord = {
  id: string;
  conversation_id: string;
  channel: WhatsappMessage['channel'] | null;
  direction: WhatsappMessage['direction'];
  body: string;
  status: WhatsappMessage['status'];
  provider_message_id: string | null;
  error_message: string | null;
  sent_by: string | null;
  retry_count: number | null;
  max_retries: number | null;
  next_attempt_at: string | null;
  template_id: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
};

type TemplateRecord = {
  id: string;
  template_key: string;
  meta_template_name: string;
  language_code: string;
  category: WhatsappTemplate['category'];
  body_preview: string;
  status: WhatsappTemplate['status'];
};

function mapConversation(record: ConversationRecord): WhatsappConversation {
  return {
    id: record.id,
    channel: record.channel ?? 'whatsapp',
    clientId: record.client_id ?? undefined,
    projectId: record.project_id ?? undefined,
    contactName: record.contact_name,
    phoneE164: record.phone_e164,
    status: record.status,
    category: record.category ?? 'opportunity',
    classificationConfidence: record.classification_confidence ?? undefined,
    unreadCount: record.unread_count,
    suggestedClientStatus: record.suggested_client_status ?? 'none',
    suggestedClientPayload: record.suggested_client_payload ?? undefined,
    lastMessageBody: record.last_message_body ?? undefined,
    lastMessageAt: record.last_message_at ? toIsoString(record.last_message_at) : undefined,
    createdAt: toIsoString(record.created_at),
    updatedAt: toIsoString(record.updated_at),
  };
}

function mapMessage(record: MessageRecord): WhatsappMessage {
  return {
    id: record.id,
    conversationId: record.conversation_id,
    channel: record.channel ?? 'whatsapp',
    direction: record.direction,
    body: record.body,
    status: record.status,
    providerMessageId: record.provider_message_id ?? undefined,
    errorMessage: record.error_message ?? undefined,
    sentBy: record.sent_by ?? undefined,
    retryCount: record.retry_count ?? undefined,
    maxRetries: record.max_retries ?? undefined,
    nextAttemptAt: record.next_attempt_at ? toIsoString(record.next_attempt_at) : undefined,
    templateId: record.template_id ?? undefined,
    createdAt: toIsoString(record.created_at),
    sentAt: record.sent_at ? toIsoString(record.sent_at) : undefined,
    deliveredAt: record.delivered_at ? toIsoString(record.delivered_at) : undefined,
    readAt: record.read_at ? toIsoString(record.read_at) : undefined,
  };
}

function mapTemplate(record: TemplateRecord): WhatsappTemplate {
  return {
    id: record.id,
    templateKey: record.template_key,
    metaTemplateName: record.meta_template_name,
    languageCode: record.language_code,
    category: record.category,
    bodyPreview: record.body_preview,
    status: record.status,
  };
}

export class SupabaseWhatsappRepository extends SupabaseRepository {
  constructor(supabase: SupabaseClient, organizationId: string) {
    super(supabase, organizationId);
  }

  async listConversations() {
    const rows = await this.unwrap(
      this.supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('organization_id', this.organizationId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      'Nao foi possivel carregar as conversas do WhatsApp.',
    );

    return (rows as ConversationRecord[]).map(mapConversation);
  }

  async listMessages(conversationId: string) {
    const rows = await this.unwrap(
      this.supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('organization_id', this.organizationId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
      'Nao foi possivel carregar as mensagens do WhatsApp.',
    );

    return (rows as MessageRecord[]).map(mapMessage);
  }

  async listTemplates() {
    const rows = await this.unwrap(
      this.supabase
        .from('whatsapp_message_templates')
        .select('id, template_key, meta_template_name, language_code, category, body_preview, status')
        .eq('organization_id', this.organizationId)
        .eq('status', 'approved')
        .order('template_key', { ascending: true }),
      'Nao foi possivel carregar os templates do WhatsApp.',
    );

    return (rows as TemplateRecord[]).map(mapTemplate);
  }

  async upsertConversation(input: {
    clientId?: string | null;
    contactName: string;
    phoneE164: string;
    userId: string;
  }) {
    const rows = await this.unwrap(
      this.supabase
        .from('whatsapp_conversations')
        .upsert(
          {
            organization_id: this.organizationId,
            client_id: input.clientId ?? null,
            channel: 'whatsapp',
            contact_name: input.contactName,
            phone_e164: input.phoneE164,
            status: 'open',
            created_by: input.userId,
          },
          {
            onConflict: 'organization_id,phone_e164',
          },
        )
        .select('*')
        .limit(1),
      'Nao foi possivel preparar a conversa do WhatsApp.',
    );

    return mapConversation((rows as ConversationRecord[])[0]);
  }

  async markConversationRead(conversationId: string) {
    await this.unwrap(
      this.supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('organization_id', this.organizationId)
        .eq('id', conversationId)
        .select('id'),
      'Nao foi possivel marcar a conversa como lida.',
    );
  }

  async linkConversationClient(conversationId: string, clientId: string) {
    await this.unwrap(
      this.supabase
        .from('whatsapp_conversations')
        .update({
          client_id: clientId,
          suggested_client_status: 'created',
        })
        .eq('organization_id', this.organizationId)
        .eq('id', conversationId)
        .select('id'),
      'Nao foi possivel vincular a conversa ao cliente.',
    );
  }
}

export function createWhatsappRepository(supabase: SupabaseClient, organizationId: string) {
  return new SupabaseWhatsappRepository(supabase, organizationId);
}
