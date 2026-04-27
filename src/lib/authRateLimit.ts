type AuthAttemptKind = 'sign-in' | 'initial-admin';

const LIMITS: Record<AuthAttemptKind, { maxAttempts: number; windowMs: number }> = {
  'sign-in': { maxAttempts: 5, windowMs: 60_000 },
  'initial-admin': { maxAttempts: 3, windowMs: 10 * 60_000 },
};

const attempts = new Map<string, { count: number; resetAt: number }>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase() || 'unknown';
}

function getAttemptKey(kind: AuthAttemptKind, email: string) {
  return `${kind}:${normalizeEmail(email)}`;
}

function getActiveAttempt(kind: AuthAttemptKind, email: string, now: number) {
  const key = getAttemptKey(kind, email);
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.delete(key);
    return { key, current: null };
  }

  return { key, current };
}

export function assertAuthAttemptAllowed(kind: AuthAttemptKind, email: string, now = Date.now()) {
  const limit = LIMITS[kind];
  const { current } = getActiveAttempt(kind, email, now);

  if (!current || current.count < limit.maxAttempts) {
    return;
  }

  const retryInSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  throw new Error(`Muitas tentativas. Tente novamente em ${retryInSeconds} segundos.`);
}

export function recordAuthAttemptFailure(kind: AuthAttemptKind, email: string, now = Date.now()) {
  const limit = LIMITS[kind];
  const { key, current } = getActiveAttempt(kind, email, now);

  attempts.set(key, {
    count: (current?.count ?? 0) + 1,
    resetAt: current?.resetAt ?? now + limit.windowMs,
  });
}

export function recordAuthAttemptSuccess(kind: AuthAttemptKind, email: string) {
  attempts.delete(getAttemptKey(kind, email));
}

export function resetAuthRateLimitForTests() {
  attempts.clear();
}
