import type { SupabaseClient } from '@supabase/supabase-js';
import type { WhatsappConversation, WhatsappMessage } from '../../types';
import { SupabaseRepository } from '../shared/supabaseRepository';
import { toIsoString } from '../shared/mappers';

type ConversationRecord = {
  id: string;
  client_id: string | null;
  contact_name: string;
  phone_e164: string;
  status: WhatsappConversation['status'];
  unread_count: number;
  last_message_body: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRecord = {
  id: string;
  conversation_id: string;
  direction: WhatsappMessage['direction'];
  body: string;
  status: WhatsappMessage['status'];
  provider_message_id: string | null;
  error_message: string | null;
  sent_by: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
};

function mapConversation(record: ConversationRecord): WhatsappConversation {
  return {
    id: record.id,
    clientId: record.client_id ?? undefined,
    contactName: record.contact_name,
    phoneE164: record.phone_e164,
    status: record.status,
    unreadCount: record.unread_count,
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
    direction: record.direction,
    body: record.body,
    status: record.status,
    providerMessageId: record.provider_message_id ?? undefined,
    errorMessage: record.error_message ?? undefined,
    sentBy: record.sent_by ?? undefined,
    createdAt: toIsoString(record.created_at),
    sentAt: record.sent_at ? toIsoString(record.sent_at) : undefined,
    deliveredAt: record.delivered_at ? toIsoString(record.delivered_at) : undefined,
    readAt: record.read_at ? toIsoString(record.read_at) : undefined,
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
}

export function createWhatsappRepository(supabase: SupabaseClient, organizationId: string) {
  return new SupabaseWhatsappRepository(supabase, organizationId);
}
