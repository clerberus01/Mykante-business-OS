import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../health.js';
import { getAuthenticatedContext } from '../_lib/auth.js';
import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';

vi.mock('../_lib/auth.js', async () => {
  const actual = await vi.importActual('../_lib/auth.js');

  return {
    ...actual,
    getAuthenticatedContext: vi.fn(),
  };
});

vi.mock('../_lib/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

const REQUIRED_ENV_KEYS = [
  'SUPABASE_PROJECT_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'ONESIGNAL_APP_ID',
  'ONESIGNAL_API_KEY',
  'APP_URL',
];

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

describe('health handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of REQUIRED_ENV_KEYS) {
      delete process.env[key];
    }
  });

  it('returns a minimal public health response without checking private dependencies', async () => {
    const response = createResponse();

    await handler({ method: 'GET', query: {}, headers: {} }, response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      success: true,
      status: 'ok',
    });
    expect(getAuthenticatedContext).not.toHaveBeenCalled();
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('requires an authenticated admin context for detailed diagnostics', async () => {
    vi.mocked(getAuthenticatedContext).mockResolvedValue({
      role: 'operator',
    });
    const response = createResponse();

    await handler({ method: 'GET', query: { detail: 'true' }, headers: {} }, response);

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Insufficient organization role.',
    });
  });

  it('runs detailed diagnostics for organization admins', async () => {
    for (const key of REQUIRED_ENV_KEYS) {
      process.env[key] = 'configured';
    }
    vi.mocked(getAuthenticatedContext).mockResolvedValue({
      role: 'admin',
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(async () => ({ error: null })),
      })),
    });
    const response = createResponse();

    await handler({ method: 'GET', query: { detail: 'true' }, headers: {} }, response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      success: true,
      checks: {
        database: 'ok',
        env: 'ok',
      },
      missingEnvCount: 0,
    });
  });
});
