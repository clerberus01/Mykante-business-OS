import { sendJson } from '../../_lib/auth.js';
import { withApiMiddleware } from '../../_lib/middleware.js';
import { getValidationErrorPayload, mobileQrConsumeSchema, readValidatedJsonBody } from '../../_lib/validation.js';
import { getClientIp, sanitizeLocation } from '../../_lib/mobileQr.js';
import { getSupabaseAdminClient } from '../../_lib/supabaseAdmin.js';

export async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  let input;

  try {
    input = await readValidatedJsonBody(request, mobileQrConsumeSchema);
  } catch (error) {
    return sendJson(response, error?.statusCode || 400, getValidationErrorPayload(error));
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: consumedChallenge, error: updateError } = await supabase
    .from('mobile_qr_login_challenges')
    .update({
      consumed_at: now,
      consumed_location: sanitizeLocation(input.location),
      consumed_ip: getClientIp(request),
    })
    .eq('code', input.code)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('token_hash')
    .maybeSingle();

  if (updateError) {
    console.error('Mobile QR challenge consume failed:', updateError);
    return sendJson(response, 500, { error: 'Unable to validate mobile login challenge.' });
  }

  if (!consumedChallenge) {
    return sendJson(response, 410, { error: 'QR code expired or already used.' });
  }

  return sendJson(response, 200, {
    success: true,
    type: 'magiclink',
    tokenHash: consumedChallenge.token_hash,
  });
}

export default withApiMiddleware(handler, {
  rateLimit: {
    keyPrefix: 'mobile-qr-consume',
    limit: 20,
    windowMs: 60_000,
  },
});
