import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withApiMiddleware, __rateLimitTestUtils } from '../middleware.js';
import { getAuthenticatedContext } from '../auth.js';

vi.mock('../auth.js', async () => {
  const actual = await vi.importActual('../auth.js');

  return {
    ...actual,
    getAuthenticatedContext: vi.fn(),
  };
});

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

describe('withApiMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __rateLimitTestUtils.memoryBuckets.clear();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('blocks requests over the configured memory rate limit', async () => {
    const handler = vi.fn(async (_request, response) => {
      response.status(200).end('ok');
    });
    const wrapped = withApiMiddleware(handler, {
      rateLimit: { keyPrefix: 'test', limit: 1, windowMs: 60_000 },
    });
    const request = {
      headers: { 'x-forwarded-for': '203.0.113.10' },
      socket: {},
    };

    const firstResponse = createResponse();
    await wrapped(request, firstResponse);

    const secondResponse = createResponse();
    await wrapped(request, secondResponse);

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(429);
    expect(secondResponse.headers['Retry-After']).toBeDefined();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('requires authenticated context when auth middleware is enabled', async () => {
    vi.mocked(getAuthenticatedContext).mockRejectedValue(new Error('Missing bearer token.'));
    const handler = vi.fn();
    const wrapped = withApiMiddleware(handler, {
      auth: true,
      rateLimit: { keyPrefix: 'auth-test', limit: 10, windowMs: 60_000 },
    });
    const response = createResponse();

    await wrapped({ headers: {}, socket: {} }, response);

    expect(response.statusCode).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});
