import { createHmac, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_RESPONSE_BODY_LENGTH = 2000;
const ALLOWED_WEBHOOK_PROTOCOL = 'https:';

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

function isPrivateIpv4(address) {
  const parts = address.split('.').map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase();
  const ipv4MappedAddress = normalized.startsWith('::ffff:') ? normalized.slice('::ffff:'.length) : null;

  if (ipv4MappedAddress && isIP(ipv4MappedAddress) === 4) {
    return isPrivateIpv4(ipv4MappedAddress);
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:0:')
  );
}

function isBlockedIpAddress(address) {
  const version = isIP(address);

  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

function assertAllowedWebhookUrlShape(rawUrl) {
  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Webhook endpoint URL is invalid.');
  }

  if (url.protocol !== ALLOWED_WEBHOOK_PROTOCOL) {
    throw new Error('Webhook endpoint URL must use HTTPS.');
  }

  if (url.username || url.password) {
    throw new Error('Webhook endpoint URL must not include credentials.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Webhook endpoint URL host is not allowed.');
  }

  if (url.port && url.port !== '443') {
    throw new Error('Webhook endpoint URL port is not allowed.');
  }

  if (isIP(hostname) && isBlockedIpAddress(hostname)) {
    throw new Error('Webhook endpoint URL resolves to a blocked address.');
  }

  return url;
}

export async function assertSafeWebhookEndpointUrl(rawUrl, resolveHost = lookup) {
  const url = assertAllowedWebhookUrlShape(rawUrl);

  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  if (isIP(hostname)) {
    return url;
  }

  let addresses;

  try {
    addresses = await resolveHost(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('Webhook endpoint URL host could not be resolved.');
  }

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('Webhook endpoint URL host could not be resolved.');
  }

  if (addresses.some((entry) => isBlockedIpAddress(entry.address))) {
    throw new Error('Webhook endpoint URL resolves to a blocked address.');
  }

  return url;
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
    await assertSafeWebhookEndpointUrl(endpoint.url);

    const response = await fetch(endpoint.url, {
      method: 'POST',
      redirect: 'manual',
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
