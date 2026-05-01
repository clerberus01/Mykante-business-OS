import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../consume.js';
import { getSupabaseAdminClient } from '../../../_lib/supabaseAdmin.js';

vi.mock('../../../_lib/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    end(body) {
      this.body = body;
      return this;
    },
  };
}

function createRequest(body) {
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.10' },
    body,
    socket: {},
  };
}

function createConsumeQuery(result) {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    gt: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
  };

  return query;
}

describe('mobile QR consume handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('atomically consumes an active challenge and returns the token hash', async () => {
    const query = createConsumeQuery({
      data: { token_hash: 'hashed-token' },
      error: null,
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => query),
    });
    const response = createResponse();

    await handler(createRequest({ code: 'a'.repeat(32), location: { city: 'Sao Paulo' } }), response);

    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      consumed_at: expect.any(String),
      consumed_location: { city: 'Sao Paulo' },
      consumed_ip: '203.0.113.10',
    }));
    expect(query.eq).toHaveBeenCalledWith('code', 'a'.repeat(32));
    expect(query.is).toHaveBeenCalledWith('consumed_at', null);
    expect(query.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
    expect(query.select).toHaveBeenCalledWith('token_hash');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      success: true,
      tokenHash: 'hashed-token',
    });
  });

  it('does not return a token hash when the atomic update finds no active challenge', async () => {
    const query = createConsumeQuery({
      data: null,
      error: null,
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => query),
    });
    const response = createResponse();

    await handler(createRequest({ code: 'b'.repeat(32) }), response);

    expect(response.statusCode).toBe(410);
    expect(JSON.parse(response.body)).toEqual({
      error: 'QR code expired or already used.',
    });
  });
});
