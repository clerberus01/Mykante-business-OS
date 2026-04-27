import { beforeEach, describe, expect, it } from 'vitest';
import {
  assertAuthAttemptAllowed,
  recordAuthAttemptFailure,
  recordAuthAttemptSuccess,
  resetAuthRateLimitForTests,
} from '../authRateLimit';

describe('auth rate limit guard', () => {
  beforeEach(() => {
    resetAuthRateLimitForTests();
  });

  it('blocks repeated login failures during the configured window', () => {
    const now = 1_000;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      assertAuthAttemptAllowed('sign-in', 'Admin@Example.com', now);
      recordAuthAttemptFailure('sign-in', 'admin@example.com', now);
    }

    expect(() => assertAuthAttemptAllowed('sign-in', 'admin@example.com', now + 1_000)).toThrow(
      'Muitas tentativas.',
    );
  });

  it('clears failed attempts after a successful login', () => {
    const now = 1_000;

    recordAuthAttemptFailure('sign-in', 'admin@example.com', now);
    recordAuthAttemptSuccess('sign-in', 'admin@example.com');

    expect(() => assertAuthAttemptAllowed('sign-in', 'admin@example.com', now + 1_000)).not.toThrow();
  });
});
