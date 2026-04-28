const DEFAULT_GRAPH_VERSION = 'v21.0';

function getWhatsappConfig() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    graphVersion: process.env.WHATSAPP_API_VERSION || DEFAULT_GRAPH_VERSION,
  };
}

function buildTemplateComponents(templatePayload) {
  const parameters = Array.isArray(templatePayload?.parameters) ? templatePayload.parameters : [];

  if (parameters.length === 0) {
    return undefined;
  }

  return [
    {
      type: 'body',
      parameters: parameters.map((value) => ({ type: 'text', text: String(value) })),
    },
  ];
}

function buildWhatsappPayload(message) {
  const phone = message.whatsapp_conversations?.phone_e164?.replace(/^\+/, '');
  const template = message.whatsapp_message_templates;

  if (!phone) {
    throw new Error('Conversation phone number is missing.');
  }

  if (template?.meta_template_name) {
    const components = buildTemplateComponents(message.template_payload);

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'template',
      template: {
        name: template.meta_template_name,
        language: {
          code: template.language_code || 'pt_BR',
        },
        ...(components ? { components } : {}),
      },
    };
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: {
      preview_url: true,
      body: message.body,
    },
  };
}

async function markConversationSummary(supabase, message) {
  await supabase
    .from('whatsapp_conversations')
    .update({
      last_message_body: message.body,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', message.conversation_id)
    .eq('organization_id', message.organization_id);
}

async function markMessageFailed(supabase, message, error) {
  const retryCount = Number(message.retry_count ?? 0) + 1;
  const maxRetries = Number(message.max_retries ?? 3);
  const canRetry = retryCount < maxRetries;
  const delayMinutes = Math.min(60, 2 ** Math.max(retryCount - 1, 0));
  const nextAttemptAt = new Date(Date.now() + delayMinutes * 60_000).toISOString();

  await supabase
    .from('whatsapp_messages')
    .update({
      status: 'failed',
      retry_count: retryCount,
      last_attempt_at: new Date().toISOString(),
      next_attempt_at: canRetry ? nextAttemptAt : new Date('2999-12-31T00:00:00.000Z').toISOString(),
      error_message: error instanceof Error ? error.message : 'WhatsApp send failed.',
    })
    .eq('id', message.id)
    .eq('organization_id', message.organization_id);
}

export async function processQueuedWhatsappMessages(supabase, organizationId, limit = 10) {
  const config = getWhatsappConfig();

  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error('WhatsApp Cloud API is not configured.');
  }

  const { data: messages, error } = await supabase
    .from('whatsapp_messages')
    .select(`
      id,
      organization_id,
      conversation_id,
      body,
      status,
      retry_count,
      max_retries,
      template_payload,
      whatsapp_conversations!inner(phone_e164),
      whatsapp_message_templates(meta_template_name, language_code)
    `)
    .eq('organization_id', organizationId)
    .eq('direction', 'outbound')
    .in('status', ['queued', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const results = [];

  for (const message of (messages ?? []).filter((item) => Number(item.retry_count ?? 0) < Number(item.max_retries ?? 3))) {
    try {
      const whatsappResponse = await fetch(
        `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildWhatsappPayload(message)),
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
          error_message: null,
          sent_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', message.id)
        .eq('organization_id', message.organization_id);

      await markConversationSummary(supabase, message);
      results.push({ id: message.id, status: 'sent', providerMessageId });
    } catch (sendError) {
      await markMessageFailed(supabase, message, sendError);
      results.push({
        id: message.id,
        status: 'failed',
        error: sendError instanceof Error ? sendError.message : 'WhatsApp send failed.',
      });
    }
  }

  return results;
}
