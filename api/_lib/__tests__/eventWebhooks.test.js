import { describe, expect, it } from 'vitest';
import {
  assertSafeWebhookEndpointUrl,
  buildWebhookPayload,
  buildWebhookSignatureHeader,
  verifyWebhookSignature,
} from '../eventWebhooks.js';

describe('event webhook helpers', () => {
  it('builds stable webhook payloads from domain events', () => {
    const payload = buildWebhookPayload({
      id: 'event-1',
      organization_id: 'org-1',
      event_type: 'crm.client.INSERT',
      source_table: 'clients',
      source_operation: 'INSERT',
      aggregate_type: 'clients',
      aggregate_id: 'client-1',
      actor_user_id: 'user-1',
      payload: { new: { name: 'Cliente' } },
      occurred_at: '2026-04-28T12:00:00.000Z',
    });

    expect(payload).toEqual({
      id: 'event-1',
      organizationId: 'org-1',
      type: 'crm.client.INSERT',
      source: { table: 'clients', operation: 'INSERT' },
      aggregate: { type: 'clients', id: 'client-1' },
      actorUserId: 'user-1',
      payload: { new: { name: 'Cliente' } },
      occurredAt: '2026-04-28T12:00:00.000Z',
    });
  });

  it('signs and verifies webhook payloads', () => {
    const body = JSON.stringify({ id: 'event-1' });
    const signatureHeader = buildWebhookSignatureHeader({
      secret: 'test-secret',
      timestamp: 1777377600,
      body,
    });
    const signature = signatureHeader.split('v1=')[1];

    expect(signatureHeader).toMatch(/^t=1777377600,v1=[a-f0-9]{64}$/);
    expect(verifyWebhookSignature({
      secret: 'test-secret',
      timestamp: 1777377600,
      body,
      signature,
    })).toBe(true);
    expect(verifyWebhookSignature({
      secret: 'wrong-secret',
      timestamp: 1777377600,
      body,
      signature,
    })).toBe(false);
  });

  it('allows HTTPS webhook URLs that resolve to public addresses', async () => {
    const resolver = async () => [{ address: '203.0.113.10', family: 4 }];

    await expect(assertSafeWebhookEndpointUrl('https://webhooks.example.com/events', resolver))
      .resolves.toMatchObject({
        protocol: 'https:',
        hostname: 'webhooks.example.com',
      });
  });

  it('blocks webhook URLs with unsafe URL shapes', async () => {
    const resolver = async () => [{ address: '203.0.113.10', family: 4 }];

    await expect(assertSafeWebhookEndpointUrl('http://webhooks.example.com/events', resolver))
      .rejects.toThrow('must use HTTPS');
    await expect(assertSafeWebhookEndpointUrl('https://user:pass@webhooks.example.com/events', resolver))
      .rejects.toThrow('must not include credentials');
    await expect(assertSafeWebhookEndpointUrl('https://webhooks.example.com:8443/events', resolver))
      .rejects.toThrow('port is not allowed');
    await expect(assertSafeWebhookEndpointUrl('https://localhost/events', resolver))
      .rejects.toThrow('host is not allowed');
  });

  it('blocks webhook URLs that use or resolve to private addresses', async () => {
    await expect(assertSafeWebhookEndpointUrl('https://127.0.0.1/events'))
      .rejects.toThrow('blocked address');
    await expect(assertSafeWebhookEndpointUrl('https://[::1]/events'))
      .rejects.toThrow('blocked address');
    await expect(assertSafeWebhookEndpointUrl('https://webhooks.example.com/events', async () => [
      { address: '10.0.0.5', family: 4 },
    ])).rejects.toThrow('blocked address');
    await expect(assertSafeWebhookEndpointUrl('https://webhooks.example.com/events', async () => [
      { address: 'fe80::1', family: 6 },
    ])).rejects.toThrow('blocked address');
    await expect(assertSafeWebhookEndpointUrl('https://webhooks.example.com/events', async () => [
      { address: '::ffff:172.16.0.1', family: 6 },
    ])).rejects.toThrow('blocked address');
  });
});
