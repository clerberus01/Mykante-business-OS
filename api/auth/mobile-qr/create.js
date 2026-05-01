import QRCode from 'qrcode';
import { sendJson } from '../../_lib/auth.js';
import { withApiMiddleware } from '../../_lib/middleware.js';
import {
  createMobileQrCode,
  getClientIp,
  getMobileQrExpiresAt,
  getMobileQrPayload,
} from '../../_lib/mobileQr.js';

async function handler(request, response, authContext) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  const email = authContext.user.email || authContext.profile?.email;

  if (!email) {
    return sendJson(response, 400, { error: 'Authenticated user does not have an email address.' });
  }

  const { data: linkData, error: linkError } = await authContext.supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  const tokenHash = linkData?.properties?.hashed_token;

  if (linkError || !tokenHash) {
    console.error('Mobile QR magic link generation failed:', linkError);
    return sendJson(response, 500, { error: 'Unable to create mobile login challenge.' });
  }

  const code = createMobileQrCode();
  const expiresAt = getMobileQrExpiresAt();
  const payload = getMobileQrPayload(code);
  const qrSvg = await QRCode.toString(payload, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  const { error: insertError } = await authContext.supabase.from('mobile_qr_login_challenges').insert({
    code,
    user_id: authContext.user.id,
    organization_id: authContext.organizationId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_ip: getClientIp(request),
  });

  if (insertError) {
    console.error('Mobile QR challenge insert failed:', insertError);
    return sendJson(response, 500, { error: 'Unable to create mobile login challenge.' });
  }

  return sendJson(response, 200, {
    success: true,
    payload,
    qrSvg,
    expiresAt,
  });
}

export default withApiMiddleware(handler, {
  auth: true,
  rateLimit: {
    keyPrefix: 'mobile-qr-create',
    limit: 12,
    windowMs: 60_000,
  },
});
