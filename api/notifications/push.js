import { getAuthenticatedContext, sendJson } from '../_lib/auth.js';
import { readJsonBody } from '../_lib/request.js';

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY || process.env.ONESIGNAL_REST_API_KEY;

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    await readJsonBody(request);

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      throw new Error('Missing OneSignal server credentials.');
    }

    const { supabase, user, profile, organizationId } = await getAuthenticatedContext(request);

    const onesignalResponse = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: 'push',
        include_aliases: {
          external_id: [user.id],
        },
        headings: {
          en: 'Teste de push',
        },
        contents: {
          en: `Canal push ativo para ${profile?.full_name || user.email || 'usuario'}.`,
        },
        data: {
          test: true,
          source: 'settings',
        },
        url: process.env.APP_URL || 'http://localhost:3000',
      }),
    });

    const payload = await onesignalResponse.json().catch(() => ({}));

    if (!onesignalResponse.ok) {
      throw new Error(payload.errors?.[0] || payload.error || 'OneSignal request failed.');
    }

    await supabase.from('notification_dispatches').insert({
      organization_id: organizationId,
      user_id: user.id,
      channel: 'push',
      provider: 'onesignal',
      template_key: 'test_push',
      recipient: user.id,
      status: 'sent',
      external_message_id: payload.id ?? null,
      payload: {
        test: true,
      },
      sent_at: new Date().toISOString(),
    });

    return sendJson(response, 200, { success: true, id: payload.id ?? null });
  } catch (error) {
    console.error('Push notification error:', error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Failed to send push notification.',
    });
  }
}
