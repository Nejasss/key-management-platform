/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * NOTE: On Vercel serverless, each function instance has its own memory,
 * so this provides best-effort protection per-instance. For strict,
 * globally-consistent rate limiting across all instances, back this with
 * Vercel KV / Upstash Redis (swap the Map below for a Redis client using
 * the same interface). The interface is kept intentionally simple so
 * that swap is a drop-in change.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { success: true, remaining: limit - 1, limit, resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return {
      success: false,
      remaining: 0,
      limit,
      resetAt: existing.windowStart + windowMs,
    };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    limit,
    resetAt: existing.windowStart + windowMs,
  };
}

// Periodically clean stale buckets so memory doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.windowStart > 10 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000).unref?.();

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') || 'unknown';
}
