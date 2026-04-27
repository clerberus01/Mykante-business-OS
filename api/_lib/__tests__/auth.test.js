import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthenticatedContext } from '../auth.js';
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
        authorization: 'Bearer session-token',
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
        authorization: 'Bearer session-token',
      },
    });

    expect(context.organizationId).toBe('org-first');
    expect(membershipQuery.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });
});
