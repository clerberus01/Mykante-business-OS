import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../webhook.js';

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
});
