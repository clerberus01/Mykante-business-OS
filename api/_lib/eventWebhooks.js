import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_RESPONSE_BODY_LENGTH = 2000;

export function buildWebhookPayload(event) {
  return {
    id: event.id,
    organizationId: event.organization_id,
    type: event.event_type,
    source: {
      table: event.source_table,
      operation: event.source_operation,
    },
    aggregate: {
      type: event.aggregate_type,
      id: event.aggregate_id,
    },
    actorUserId: event.actor_user_id,
    payload: event.payload ?? {},
    occurredAt: event.occurred_at,
  };
}

export function signWebhookPayload({ secret, timestamp, body }) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function buildWebhookSignatureHeader({ secret, timestamp, body }) {
  return `t=${timestamp},v1=${signWebhookPayload({ secret, timestamp, body })}`;
}

export function verifyWebhookSignature({ secret, timestamp, body, signature }) {
  const expected = signWebhookPayload({ secret, timestamp, body });
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

function truncateResponseBody(value) {
  if (!value) return null;
  return value.length > MAX_RESPONSE_BODY_LENGTH ? value.slice(0, MAX_RESPONSE_BODY_LENGTH) : value;
}

function getBackoffTimestamp(attempts) {
  const delaySeconds = Math.min(2 ** Math.max(attempts, 1) * 60, 3600);
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

export async function deliverWebhook({ delivery, timeoutMs = 10_000 }) {
  const endpoint = delivery.event_webhook_endpoints;
  const event = delivery.domain_events;
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = buildWebhookPayload(event);
  const body = JSON.stringify(payload);
  const signature = buildWebhookSignatureHeader({
    secret: endpoint.secret,
    timestamp,
    body,
  });

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mykante-Business-OS-Webhooks/1.0',
        'X-Mykante-Event': event.event_type,
        'X-Mykante-Event-Id': event.id,
        'X-Mykante-Delivery-Id': delivery.id,
        'X-Mykante-Signature': signature,
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const responseText = truncateResponseBody(await response.text().catch(() => ''));

    if (!response.ok) {
      return {
        status: 'failed',
        attempts: delivery.attempts + 1,
        response_status: response.status,
        response_body: responseText,
        error_message: `Webhook endpoint returned HTTP ${response.status}.`,
        next_attempt_at: getBackoffTimestamp(delivery.attempts + 1),
      };
    }

    return {
      status: 'delivered',
      attempts: delivery.attempts + 1,
      response_status: response.status,
      response_body: responseText,
      error_message: null,
      delivered_at: new Date().toISOString(),
      next_attempt_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'failed',
      attempts: delivery.attempts + 1,
      response_status: null,
      response_body: null,
      error_message: error instanceof Error ? error.message : 'Webhook delivery failed.',
      next_attempt_at: getBackoffTimestamp(delivery.attempts + 1),
    };
  }
}
