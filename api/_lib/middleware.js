import { getAuthenticatedContext, sendJson } from './auth.js';

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 120;
const memoryBuckets = new Map();

function getHeader(request, name) {
  return request.headers?.[name] || request.headers?.[name.toLowerCase()] || request.headers?.[name.toUpperCase()];
}

function shouldTrustProxyHeaders() {
  return process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV) || process.env.TRUST_PROXY_HEADERS === 'true';
}

function getClientIp(request) {
  if (shouldTrustProxyHeaders()) {
    const forwardedFor = getHeader(request, 'x-forwarded-for');

    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = getHeader(request, 'x-real-ip');

    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim();
    }
  }

  return request.socket?.remoteAddress || 'unknown';
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ''),
    token,
  };
}

function cleanupMemoryBuckets(now) {
  for (const [key, bucket] of memoryBuckets.entries()) {
    if (bucket.resetAt <= now) {
      memoryBuckets.delete(key);
    }
  }
}

function rateLimitInMemory(key, limit, windowMs, now) {
  cleanupMemoryBuckets(now);

  const existing = memoryBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryBuckets.set(key, { count: 1, resetAt });
    return { allowed: true, limit, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    limit,
    remaining: Math.max(limit - existing.count, 0),
    resetAt: existing.resetAt,
  };
}

async function rateLimitInRedis(key, limit, windowMs, now, redisConfig) {
  const windowSeconds = Math.ceil(windowMs / 1000);
  const resetAt = Math.ceil(now / windowMs) * windowMs + windowMs;
  const response = await fetch(`${redisConfig.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisConfig.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, windowSeconds + 5, 'NX'],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Rate limit store request failed with ${response.status}.`);
  }

  const payload = await response.json();
  const count = Number(payload?.[0]?.result || 0);

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(limit - count, 0),
    resetAt,
  };
}

async function checkRateLimit(request, options = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const identity = options.identity || getClientIp(request);
  const prefix = options.keyPrefix || 'api';
  const key = `ratelimit:${prefix}:${bucket}:${identity}`;
  const redisConfig = getRedisConfig();

  if (!redisConfig) {
    return rateLimitInMemory(key, limit, windowMs, now);
  }

  try {
    return await rateLimitInRedis(key, limit, windowMs, now, redisConfig);
  } catch (error) {
    console.error('Rate limit store unavailable, falling back to in-memory limiter:', error);
    return rateLimitInMemory(key, limit, windowMs, now);
  }
}

function applyRateLimitHeaders(response, result) {
  response.setHeader('X-RateLimit-Limit', String(result.limit));
  response.setHeader('X-RateLimit-Remaining', String(result.remaining));
  response.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
}

export function withApiMiddleware(handler, options = {}) {
  return async function middlewareHandler(request, response) {
    const rateLimitOptions = options.rateLimit ?? {};
    const rateLimit = await checkRateLimit(request, rateLimitOptions);
    applyRateLimitHeaders(response, rateLimit);

    if (!rateLimit.allowed) {
      response.setHeader('Retry-After', String(Math.max(Math.ceil((rateLimit.resetAt - Date.now()) / 1000), 1)));
      return sendJson(response, 429, { error: 'Too many requests. Try again shortly.' });
    }

    let context = null;

    if (options.auth) {
      try {
        context = await getAuthenticatedContext(request);
      } catch (error) {
        return sendJson(response, error?.statusCode || 401, {
          error: error instanceof Error ? error.message : 'Unauthorized.',
        });
      }

      if (rateLimitOptions.authenticated !== false) {
        const authenticatedRateLimit = await checkRateLimit(request, {
          ...rateLimitOptions,
          keyPrefix: `${rateLimitOptions.keyPrefix || 'api'}:user`,
          identity: `user:${context.user.id}`,
        });
        applyRateLimitHeaders(response, authenticatedRateLimit);

        if (!authenticatedRateLimit.allowed) {
          response.setHeader(
            'Retry-After',
            String(Math.max(Math.ceil((authenticatedRateLimit.resetAt - Date.now()) / 1000), 1)),
          );
          return sendJson(response, 429, { error: 'Too many requests. Try again shortly.' });
        }
      }
    }

    return handler(request, response, context);
  };
}

export const __rateLimitTestUtils = {
  checkRateLimit,
  memoryBuckets,
};
