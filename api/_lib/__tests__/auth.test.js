import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthenticatedContext, hasOrganizationRole, requireOrganizationRole } from '../auth.js';
import { getSupabaseAdminClient } from '../supabaseAdmin.js';

vi.mock('../supabaseAdmin.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function createMembershipQuery(result) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => result),
  };

  return query;
}

function createProfileQuery(result) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
  };

  return query;
}

function createSupabaseMock({ membershipResult, profileResult }) {
  const membershipQuery = createMembershipQuery(membershipResult);
  const profileQuery = createProfileQuery(profileResult);
  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: 'user-1',
            email: 'user@example.com',
          },
        },
        error: null,
      })),
    },
    from: vi.fn((table) => {
      if (table === 'organization_members') return membershipQuery;
      if (table === 'profiles') return profileQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { supabase, membershipQuery };
}

function createSessionToken(payload = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ aal: 'aal2', sub: 'user-1', ...payload })).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('getAuthenticatedContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the requested organization id when present', async () => {
    const { supabase, membershipQuery } = createSupabaseMock({
      membershipResult: {
        data: [{ organization_id: 'org-requested', role: 'admin', status: 'active' }],
        error: null,
      },
      profileResult: {
        data: { email: 'user@example.com', full_name: 'User' },
        error: null,
      },
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const context = await getAuthenticatedContext({
      headers: {
        authorization: `Bearer ${createSessionToken()}`,
        'x-organization-id': 'org-requested',
      },
    });

    expect(context.organizationId).toBe('org-requested');
    expect(membershipQuery.eq).toHaveBeenCalledWith('organization_id', 'org-requested');
    expect(membershipQuery.order).not.toHaveBeenCalled();
  });

  it('keeps the legacy first-membership fallback when no organization id is sent', async () => {
    const { supabase, membershipQuery } = createSupabaseMock({
      membershipResult: {
        data: [{ organization_id: 'org-first', role: 'owner', status: 'active' }],
        error: null,
      },
      profileResult: {
        data: { email: 'user@example.com', full_name: 'User' },
        error: null,
      },
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase);

    const context = await getAuthenticatedContext({
      headers: {
        authorization: `Bearer ${createSessionToken()}`,
      },
    });

    expect(context.organizationId).toBe('org-first');
    expect(membershipQuery.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('rejects authenticated API access when the Supabase session is not aal2', async () => {
    await expect(
      getAuthenticatedContext({
        headers: {
          authorization: `Bearer ${createSessionToken({ aal: 'aal1' })}`,
        },
      }),
    ).rejects.toMatchObject({
      message: 'Multi-factor authentication is required.',
      statusCode: 403,
    });
  });
});

describe('organization RBAC helpers', () => {
  it('checks whether the authenticated context has an allowed organization role', () => {
    expect(hasOrganizationRole({ role: 'admin' }, ['owner', 'admin'])).toBe(true);
    expect(hasOrganizationRole({ role: 'operator' }, ['owner', 'admin'])).toBe(false);
    expect(hasOrganizationRole({ role: null }, ['owner'])).toBe(false);
  });

  it('throws a 403 error when the organization role is not allowed', () => {
    expect(() => requireOrganizationRole({ role: 'manager' }, ['owner', 'admin'])).toThrow(
      'Insufficient organization role.',
    );

    try {
      requireOrganizationRole({ role: 'manager' }, ['owner', 'admin']);
    } catch (error) {
      expect(error.statusCode).toBe(403);
    }
  });

  it('returns the context when the organization role is allowed', () => {
    const context = { role: 'owner', organizationId: 'org-1' };

    expect(requireOrganizationRole(context, ['owner'])).toBe(context);
  });
});
