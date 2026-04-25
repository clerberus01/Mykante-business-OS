import { getAuthenticatedContext, sendJson } from '../_lib/auth.js';
import { readJsonBody } from '../_lib/request.js';

const ALLOWED_TYPES = new Set([
  'confirm',
  'access',
  'correction',
  'portability',
  'anonymization',
  'deletion',
  'revocation',
]);

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const { supabase, user, organizationId } = await getAuthenticatedContext(request);
    const { requestType, requestDetails } = await readJsonBody(request);

    if (!ALLOWED_TYPES.has(requestType)) {
      return sendJson(response, 400, { error: 'Invalid request type.' });
    }

    const { data, error } = await supabase
      .from('data_subject_requests')
      .insert({
        organization_id: organizationId,
        requester_user_id: user.id,
        subject_type: 'user',
        subject_id: user.id,
        request_type: requestType,
        request_details: typeof requestDetails === 'string' ? requestDetails : null,
      })
      .select('id, due_at')
      .single();

    if (error) {
      throw error;
    }

    return sendJson(response, 200, {
      success: true,
      requestId: data.id,
      dueAt: data.due_at,
    });
  } catch (error) {
    console.error('Privacy request error:', error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Failed to create privacy request.',
    });
  }
}
