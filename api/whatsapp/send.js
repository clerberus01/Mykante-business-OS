import { getAuthenticatedContext, sendJson } from '../_lib/auth.js';
import { readJsonBody } from '../_lib/request.js';

const DEFAULT_GRAPH_VERSION = 'v21.0';

function getWhatsappConfig() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    graphVersion: process.env.WHATSAPP_API_VERSION || DEFAULT_GRAPH_VERSION,
  };
}

function sanitizeBody(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 4096);
}

async function updateConversationSummary(supabase, conversationId, organizationId, body) {
  await supabase
    .from('whatsapp_conversations')
    .update({
      last_message_body: body,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('organization_id', organizationId);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  let messageId = null;
  let dispatchContext = null;

  try {
    const { supabase, user, organizationId } = await getAuthenticatedContext(request);
    const { conversationId, body: rawBody } = await readJsonBody(request);
    const body = sanitizeBody(rawBody);

    if (!conversationId || typeof conversationId !== 'string') {
      return sendJson(response, 400, { error: 'Conversa invalida.' });
    }

    if (!body) {
      return sendJson(response, 400, { error: 'Mensagem vazia.' });
    }

    const { data: conversation, error: conversationError } = await supabase
      .from('whatsapp_conversations')
      .select('id, phone_e164')
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (conversationError) {
      throw conversationError;
    }

    if (!conversation) {
      return sendJson(response, 404, { error: 'Conversa nao encontrada.' });
    }

    const { data: insertedMessage, error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        organization_id: organizationId,
        conversation_id: conversation.id,
        direction: 'outbound',
        body,
        status: 'queued',
        sent_by: user.id,
      })
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    messageId = insertedMessage.id;
    dispatchContext = { supabase, organizationId, conversationId: conversation.id, body };

    const config = getWhatsappConfig();

    if (!config.accessToken || !config.phoneNumberId) {
      throw new Error('WhatsApp Cloud API is not configured.');
    }

    const whatsappResponse = await fetch(
      `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: conversation.phone_e164.replace(/^\+/, ''),
          type: 'text',
          text: {
            preview_url: true,
            body,
          },
        }),
      },
    );

    const payload = await whatsappResponse.json().catch(() => ({}));

    if (!whatsappResponse.ok) {
      throw new Error(payload.error?.message || 'WhatsApp request failed.');
    }

    const providerMessageId = payload.messages?.[0]?.id ?? null;

    await supabase
      .from('whatsapp_messages')
      .update({
        status: 'sent',
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('organization_id', organizationId);

    await updateConversationSummary(supabase, conversation.id, organizationId, body);

    return sendJson(response, 200, {
      success: true,
      messageId,
      providerMessageId,
    });
  } catch (error) {
    console.error('WhatsApp send error:', error);

    if (messageId && dispatchContext) {
      try {
        await dispatchContext.supabase
          .from('whatsapp_messages')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'WhatsApp send failed.',
          })
          .eq('id', messageId)
          .eq('organization_id', dispatchContext.organizationId);

        await updateConversationSummary(
          dispatchContext.supabase,
          dispatchContext.conversationId,
          dispatchContext.organizationId,
          dispatchContext.body,
        );
      } catch (updateError) {
        console.error('WhatsApp failed-message update error:', updateError);
      }
    }

    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Falha ao enviar WhatsApp.',
    });
  }
}
