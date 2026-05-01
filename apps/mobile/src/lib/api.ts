const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export function getApiUrl(path: string) {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL nao configurada.');
  }

  return `${apiBaseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
