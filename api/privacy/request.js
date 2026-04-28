import { sendJson } from '../_lib/auth.js';
import { withApiMiddleware } from '../_lib/middleware.js';
import { getValidationErrorPayload, privacyRequestSchema, readValidatedJsonBody } from '../_lib/validation.js';

async function handler(request, response, authContext) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const { supabase, user, organizationId } = authContext;
    const { requestType, requestDetails } = await readValidatedJsonBody(request, privacyRequestSchema);

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
    if (error?.statusCode === 400) {
      return sendJson(response, 400, getValidationErrorPayload(error));
    }

    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Failed to create privacy request.',
    });
  }
}

export default withApiMiddleware(handler, {
  auth: true,
  rateLimit: { keyPrefix: 'privacy:request', limit: 20, windowMs: 60_000 },
});
