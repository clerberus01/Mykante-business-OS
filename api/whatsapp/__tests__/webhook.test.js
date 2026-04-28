import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { isValidWhatsappSignature } from '../webhook.js';

vi.mock('../../_lib/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function createPostRequest(body, headers = {}) {
  const request = Readable.from([Buffer.from(body)]);
  request.method = 'POST';
  request.headers = headers;
  request.query = {};
  return request;
}

function signBody(body, secret) {
  return `sha256=${crypto.createHmac('sha256', secret).update(Buffer.from(body)).digest('hex')}`;
}

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    end(body) {
      this.body = body;
      return this;
    },
  };
}

describe('WhatsApp webhook signature validation', () => {
  const originalSecret = process.env.WHATSAPP_APP_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.WHATSAPP_APP_SECRET;
    } else {
      process.env.WHATSAPP_APP_SECRET = originalSecret;
    }
  });

  it('rejects POST webhooks when the app secret is not configured', async () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const response = createResponse();

    await handler(createPostRequest('{}'), response);

    expect(response.statusCode).toBe(403);
    expect(response.body).toBe('Invalid signature.');
  });

  it('rejects malformed signatures without throwing', async () => {
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    const response = createResponse();

    await handler(
      createPostRequest('{}', {
        'x-hub-signature-256': 'sha256=short',
      }),
      response,
    );

    expect(response.statusCode).toBe(403);
    expect(response.body).toBe('Invalid signature.');
  });

  it('accepts a valid sha256 HMAC signature over the raw body', () => {
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    const body = '{"entry":[{"changes":[]}]}';
    const request = createPostRequest(body, {
      'x-hub-signature-256': signBody(body, 'test-secret'),
    });

    expect(isValidWhatsappSignature(request, Buffer.from(body))).toBe(true);
  });

  it('rejects signatures generated for a different body', () => {
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    const request = createPostRequest('{"entry":[]}', {
      'x-hub-signature-256': signBody('{"entry":[]}', 'test-secret'),
    });

    expect(isValidWhatsappSignature(request, Buffer.from('{"entry":[{"changes":[]}]}'))).toBe(false);
  });

  it('rejects legacy sha1 signatures', () => {
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    const body = '{}';
    const request = createPostRequest(body, {
      'x-hub-signature': `sha1=${crypto.createHmac('sha1', 'test-secret').update(Buffer.from(body)).digest('hex')}`,
    });

    expect(isValidWhatsappSignature(request, Buffer.from(body))).toBe(false);
  });
});
