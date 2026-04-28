import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';
import { withApiMiddleware } from '../_lib/middleware.js';

function sendText(response, status, body) {
  response.status(status).setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.end(body);
}

function isValidSignature(request, rawBody) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret) {
    return false;
  }

  const signature = request.headers['x-hub-signature-256'];

  if (!signature || typeof signature !== 'string' || !signature.startsWith('sha256=')) {
    return false;
  }

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

async function readRawBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

async function upsertInboundMessage(supabase, organizationId, message, contact) {
  const phone = message.from ? `+${String(message.from).replace(/\D/g, '')}` : null;
  const body = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || '';

  if (!phone || !body) {
    return;
  }

  const { data: conversation, error: conversationError } = await supabase
    .from('whatsapp_conversations')
    .upsert(
      {
        organization_id: organizationId,
        contact_name: contact?.profile?.name || phone,
        phone_e164: phone,
        status: 'open',
        last_message_body: body,
        last_message_at: new Date(Number(message.timestamp || Date.now() / 1000) * 1000).toISOString(),
      },
      {
        onConflict: 'organization_id,phone_e164',
      },
    )
    .select('id, unread_count')
    .single();

  if (conversationError) {
    throw conversationError;
  }

  const createdAt = new Date(Number(message.timestamp || Date.now() / 1000) * 1000).toISOString();

  const { error: messageError } = await supabase.from('whatsapp_messages').insert({
    organization_id: organizationId,
    conversation_id: conversation.id,
    direction: 'inbound',
    body,
    status: 'received',
    provider_message_id: message.id ?? null,
    created_at: createdAt,
  });

  if (messageError && messageError.code !== '23505') {
    throw messageError;
  }

  await supabase
    .from('whatsapp_conversations')
    .update({
      unread_count: (conversation.unread_count ?? 0) + 1,
      last_message_body: body,
      last_message_at: createdAt,
    })
    .eq('id', conversation.id)
    .eq('organization_id', organizationId);
}

async function updateStatus(supabase, organizationId, status) {
  if (!status.id) {
    return;
  }

  const nextStatus =
    status.status === 'read'
      ? { status: 'read', read_at: new Date().toISOString() }
      : status.status === 'delivered'
        ? { status: 'delivered', delivered_at: new Date().toISOString() }
        : status.status === 'sent'
          ? { status: 'sent' }
          : status.status === 'failed'
            ? { status: 'failed', error_message: status.errors?.[0]?.message ?? 'WhatsApp delivery failed.' }
            : null;

  if (!nextStatus) {
    return;
  }

  await supabase
    .from('whatsapp_messages')
    .update(nextStatus)
    .eq('organization_id', organizationId)
    .eq('provider_message_id', status.id);
}

async function handler(request, response) {
  if (request.method === 'GET') {
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return sendText(response, 200, String(challenge || ''));
    }

    return sendText(response, 403, 'Forbidden');
  }

  if (request.method !== 'POST') {
    return sendText(response, 405, 'Method not allowed.');
  }

  const rawBody = await readRawBody(request);

  if (!isValidSignature(request, rawBody)) {
    return sendText(response, 403, 'Invalid signature.');
  }

  try {
    const payload = JSON.parse(rawBody.toString('utf8') || '{}');
    const organizationId = process.env.WHATSAPP_ORGANIZATION_ID;

    if (!organizationId) {
      throw new Error('Missing WHATSAPP_ORGANIZATION_ID.');
    }

    const supabase = getSupabaseAdminClient();
    const entries = Array.isArray(payload.entry) ? payload.entry : [];

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const contacts = value.contacts ?? [];

        for (const message of value.messages ?? []) {
          const contact = contacts.find((item) => item.wa_id === message.from);
          await upsertInboundMessage(supabase, organizationId, message, contact);
        }

        for (const status of value.statuses ?? []) {
          await updateStatus(supabase, organizationId, status);
        }
      }
    }

    return sendText(response, 200, 'OK');
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return sendText(response, 500, 'Webhook error.');
  }
}

export default withApiMiddleware(handler, {
  rateLimit: { keyPrefix: 'whatsapp:webhook', limit: 300, windowMs: 60_000 },
});
