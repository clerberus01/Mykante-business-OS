import { sendJson } from '../_lib/auth.js';
import { withApiMiddleware } from '../_lib/middleware.js';
import { getValidationErrorPayload, readValidatedJsonBody, whatsappSendSchema } from '../_lib/validation.js';
import { processQueuedWhatsappMessages } from './_sender.js';

async function handler(request, response, authContext) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  let messageId = null;
  try {
    const { supabase, user, organizationId } = authContext;
    const { conversationId, body, templateKey } = await readValidatedJsonBody(request, whatsappSendSchema);

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

    let template = null;

    if (templateKey) {
      const { data: templateRow, error: templateError } = await supabase
        .from('whatsapp_message_templates')
        .select('id, body_preview, status')
        .eq('organization_id', organizationId)
        .eq('template_key', templateKey)
        .eq('status', 'approved')
        .maybeSingle();

      if (templateError) {
        throw templateError;
      }

      if (!templateRow) {
        return sendJson(response, 404, { error: 'Template oficial aprovado nao encontrado.' });
      }

      template = templateRow;
    }

    const messageBody = body?.trim() || template?.body_preview;

    const { data: insertedMessage, error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        organization_id: organizationId,
        conversation_id: conversation.id,
        direction: 'outbound',
        body: messageBody,
        status: 'queued',
        sent_by: user.id,
        template_id: template?.id ?? null,
        template_payload: templateKey ? { templateKey } : null,
        queued_at: new Date().toISOString(),
        next_attempt_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    messageId = insertedMessage.id;
    const processed = await processQueuedWhatsappMessages(supabase, organizationId, 1);
    const processedMessage = processed.find((item) => item.id === messageId);

    return sendJson(response, 200, {
      success: true,
      messageId,
      status: processedMessage?.status ?? 'queued',
      providerMessageId: processedMessage?.providerMessageId ?? null,
    });
  } catch (error) {
    console.error('WhatsApp send error:', error);

    if (error?.statusCode === 400) {
      return sendJson(response, 400, getValidationErrorPayload(error));
    }

    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Falha ao enviar WhatsApp.',
    });
  }
}

export default withApiMiddleware(handler, {
  auth: true,
  rateLimit: { keyPrefix: 'whatsapp:send', limit: 60, windowMs: 60_000 },
});
