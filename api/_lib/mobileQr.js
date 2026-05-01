import crypto from 'node:crypto';

const QR_CODE_BYTES = 32;
const DEFAULT_EXPIRES_IN_SECONDS = 120;
const MAX_LOCATION_LENGTH = 120;

export function createMobileQrCode() {
  return crypto.randomBytes(QR_CODE_BYTES).toString('base64url');
}

export function getMobileQrExpiresAt(now = Date.now()) {
  return new Date(now + DEFAULT_EXPIRES_IN_SECONDS * 1000).toISOString();
}

export function getMobileQrPayload(code) {
  return `mykantecrm://auth/qr?code=${encodeURIComponent(code)}`;
}

export function sanitizeLocation(input) {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const output = {};

  for (const key of ['latitude', 'longitude', 'accuracy', 'city', 'region', 'country']) {
    const value = input[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      output[key] = value;
    }

    if (typeof value === 'string' && value.trim()) {
      output[key] = value.trim().slice(0, MAX_LOCATION_LENGTH);
    }
  }

  return output;
}

export function getClientIp(request) {
  const forwardedFor = request.headers?.['x-forwarded-for'] || request.headers?.['X-Forwarded-For'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers?.['x-real-ip'] || request.headers?.['X-Real-Ip'];

  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return request.socket?.remoteAddress || null;
}
