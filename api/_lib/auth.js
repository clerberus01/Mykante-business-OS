import { getSupabaseAdminClient } from './supabaseAdmin.js';

function getBearerToken(request) {
  const header = request.headers.authorization || request.headers.Authorization;

  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim();
}

function getRequestedOrganizationId(request) {
  const header = request.headers['x-organization-id'] || request.headers['X-Organization-Id'];

  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }

  return null;
}

export async function getAuthenticatedContext(request) {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error('Missing bearer token.');
  }

  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error('Invalid Supabase session.');
  }

  const requestedOrganizationId = getRequestedOrganizationId(request);
  let membershipQuery = supabase
    .from('organization_members')
    .select('organization_id, role, status')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (requestedOrganizationId) {
    membershipQuery = membershipQuery.eq('organization_id', requestedOrganizationId);
  } else {
    membershipQuery = membershipQuery.order('created_at', { ascending: true });
  }

  const [{ data: memberships, error: membershipError }, { data: profile, error: profileError }] =
    await Promise.all([
      membershipQuery.limit(1),
      supabase.from('profiles').select('email, full_name').eq('id', user.id).maybeSingle(),
    ]);

  if (membershipError) {
    throw membershipError;
  }

  if (profileError) {
    throw profileError;
  }

  const membership = memberships?.[0];

  if (!membership) {
    throw new Error(
      requestedOrganizationId
        ? 'No active membership found for the requested organization.'
        : 'No active organization membership found.',
    );
  }

  return {
    supabase,
    user,
    profile,
    organizationId: membership.organization_id,
    role: membership.role,
  };
}

export function sendJson(response, status, body) {
  response
    .status(status)
    .setHeader('Content-Type', 'application/json; charset=utf-8')
    .setHeader('Cache-Control', 'no-store, max-age=0');
  response.end(JSON.stringify(body));
}
