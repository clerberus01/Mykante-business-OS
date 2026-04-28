import { sendJson } from '../_lib/auth.js';
import { withApiMiddleware } from '../_lib/middleware.js';
import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';
import { deliverWebhook } from '../_lib/eventWebhooks.js';

function isAuthorizedCronRequest(request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers?.authorization || request.headers?.Authorization;

  return Boolean(expected && authorization === `Bearer ${expected}`);
}

async function claimDelivery(supabase, delivery) {
  const { data, error } = await supabase
    .from('event_webhook_deliveries')
    .update({
      status: 'delivering',
      last_attempt_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', delivery.id)
    .in('status', ['pending', 'failed'])
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  if (!isAuthorizedCronRequest(request)) {
    return sendJson(response, 401, { error: 'Unauthorized.' });
  }

  const limit = Math.min(Number(request.query?.limit ?? 25) || 25, 100);
  const supabase = getSupabaseAdminClient();

  try {
    const { data: deliveries, error } = await supabase
      .from('event_webhook_deliveries')
      .select(`
        id,
        organization_id,
        attempts,
        event_webhook_endpoints!inner(id, url, secret),
        domain_events!inner(
          id,
          organization_id,
          event_type,
          source_table,
          source_operation,
          aggregate_type,
          aggregate_id,
          actor_user_id,
          payload,
          occurred_at
        )
      `)
      .in('status', ['pending', 'failed'])
      .lte('next_attempt_at', new Date().toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    const results = [];

    for (const delivery of deliveries ?? []) {
      const claimed = await claimDelivery(supabase, delivery);

      if (!claimed) {
        continue;
      }

      const result = await deliverWebhook({ delivery });
      const { error: updateError } = await supabase
        .from('event_webhook_deliveries')
        .update(result)
        .eq('id', delivery.id);

      if (updateError) {
        throw updateError;
      }

      results.push({
        id: delivery.id,
        eventId: delivery.domain_events.id,
        endpointId: delivery.event_webhook_endpoints.id,
        status: result.status,
        attempts: result.attempts,
        responseStatus: result.response_status,
      });
    }

    return sendJson(response, 200, {
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Event webhook processing error:', error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Failed to process event webhooks.',
    });
  }
}

export default withApiMiddleware(handler, {
  rateLimit: { keyPrefix: 'events:process-webhooks', limit: 30, windowMs: 60_000 },
});
