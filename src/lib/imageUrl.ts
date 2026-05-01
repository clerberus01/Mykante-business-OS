const MAX_IMAGE_URL_LENGTH = 2048;
const ALLOWED_IMAGE_PROTOCOL = 'https:';

function getNormalizedHostname(url: URL) {
  return url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname.endsWith('.localhost');
}

function isBlockedIpv4(hostname: string) {
  const parts = hostname.split('.').map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isBlockedIpv6(hostname: string) {
  return (
    hostname === '::' ||
    hostname === '::1' ||
    hostname.startsWith('fc') ||
    hostname.startsWith('fd') ||
    hostname.startsWith('fe80:')
  );
}

export function normalizeOptionalImageUrl(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.length > MAX_IMAGE_URL_LENGTH) {
    return '';
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return '';
  }

  const hostname = getNormalizedHostname(url);

  if (
    url.protocol !== ALLOWED_IMAGE_PROTOCOL ||
    url.username ||
    url.password ||
    !hostname ||
    isLocalHostname(hostname) ||
    isBlockedIpv4(hostname) ||
    isBlockedIpv6(hostname)
  ) {
    return '';
  }

  return url.toString();
}

export function assertOptionalImageUrl(value: string, fieldLabel: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const normalized = normalizeOptionalImageUrl(trimmed);

  if (!normalized) {
    throw new Error(`${fieldLabel} deve ser uma URL HTTPS publica valida.`);
  }

  return normalized;
}
