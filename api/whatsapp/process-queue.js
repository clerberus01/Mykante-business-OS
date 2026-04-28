import { sendJson } from '../_lib/auth.js';
import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';
import { withApiMiddleware } from '../_lib/middleware.js';
import { processQueuedWhatsappMessages } from './_sender.js';

function isAuthorizedCronRequest(request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers?.authorization || request.headers?.Authorization;

  return Boolean(expected && authorization === `Bearer ${expected}`);
}

async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  if (!isAuthorizedCronRequest(request)) {
    return sendJson(response, 401, { error: 'Unauthorized.' });
  }

  try {
    const organizationId = process.env.WHATSAPP_ORGANIZATION_ID;

    if (!organizationId) {
      throw new Error('Missing WHATSAPP_ORGANIZATION_ID.');
    }

    const limit = Math.min(Number(request.query?.limit ?? 10) || 10, 50);
    const supabase = getSupabaseAdminClient();
    const results = await processQueuedWhatsappMessages(supabase, organizationId, limit);

    return sendJson(response, 200, {
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('WhatsApp queue processing error:', error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Failed to process WhatsApp queue.',
    });
  }
}

export default withApiMiddleware(handler, {
  rateLimit: { keyPrefix: 'whatsapp:process-queue', limit: 30, windowMs: 60_000 },
});
