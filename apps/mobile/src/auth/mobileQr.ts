export function getCodeFromQrPayload(payload: string) {
  const trimmed = payload.trim();

  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get('code');
    return code?.trim() || null;
  } catch {
    return trimmed.length >= 32 ? trimmed : null;
  }
}
