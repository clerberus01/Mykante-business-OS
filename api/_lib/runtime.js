export function normalizeAppUrl(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = new URL(rawValue);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    parsed.hash = '';
    parsed.search = '';

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function getPublicAppUrl() {
  const appUrl = normalizeAppUrl(process.env.APP_URL);

  if (appUrl) {
    return appUrl;
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

  if (!vercelUrl) {
    return null;
  }

  return normalizeAppUrl(
    vercelUrl.startsWith('http://') || vercelUrl.startsWith('https://')
      ? vercelUrl
      : `https://${vercelUrl}`,
  );
}
