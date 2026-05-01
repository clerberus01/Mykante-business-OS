import net from 'node:net';

export const defaultBranding = {
  appName: 'Mykante Business OS',
  logoUrl: '',
  primaryColor: '#FF6321',
  darkColor: '#141414',
  backgroundColor: '#F8F9FA',
  textColor: '#1A1A1A',
  portalTitle: 'Acompanhamento do pedido',
  portalSubtitle: 'Consulta segura por email',
};

const hexColorPattern = /^#[0-9a-f]{6}$/i;

function isPrivateIPv4(hostname) {
  const parts = hostname.split('.').map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first === 0
  );
}

function isPrivateIPv6(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}

function normalizeOptionalPublicImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  const rawValue = value.trim();

  if (rawValue.length > 2048) {
    return '';
  }

  try {
    const url = new URL(rawValue);
    const hostname = url.hostname.toLowerCase().replace(/^\[(.*)]$/, '$1');

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      (net.isIP(hostname) === 4 && isPrivateIPv4(hostname)) ||
      (net.isIP(hostname) === 6 && isPrivateIPv6(hostname))
    ) {
      return '';
    }

    return url.toString();
  } catch {
    return '';
  }
}

function validColor(value, fallback) {
  return typeof value === 'string' && hexColorPattern.test(value.trim()) ? value.trim() : fallback;
}

function validText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function normalizePublicBranding(metadata) {
  const branding = metadata?.branding && typeof metadata.branding === 'object' ? metadata.branding : {};

  return {
    appName: validText(branding.appName, defaultBranding.appName),
    logoUrl: normalizeOptionalPublicImageUrl(branding.logoUrl),
    primaryColor: validColor(branding.primaryColor, defaultBranding.primaryColor),
    darkColor: validColor(branding.darkColor, defaultBranding.darkColor),
    backgroundColor: validColor(branding.backgroundColor, defaultBranding.backgroundColor),
    textColor: validColor(branding.textColor, defaultBranding.textColor),
    portalTitle: validText(branding.portalTitle, defaultBranding.portalTitle),
    portalSubtitle: validText(branding.portalSubtitle, defaultBranding.portalSubtitle),
  };
}
