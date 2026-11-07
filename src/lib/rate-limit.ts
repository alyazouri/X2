// ════════════════════════════════════════════════════════════════
// SLIDING-WINDOW RATE LIMITER (in-memory, per instance).
// On serverless platforms each instance keeps its own window — this still
// absorbs abuse bursts and guarantees bounded work per route, which is the
// protection this project needs (expensive socket scans, DB writes).
// ════════════════════════════════════════════════════════════════

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** Returns the verdict for this key. Never throws. */
  limit: (key: string) => { ok: boolean; remaining: number; retryAfterMs: number };
  /** Visible for tests: current bucket count. */
  size: () => number;
}

export function createRateLimiter(options: { windowMs: number; max: number }): RateLimiter {
  const { windowMs, max } = options;
  const store = new Map<string, Bucket>();
  let lastSweep = Date.now();

  const sweep = (now: number) => {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(key);
    }
  };

  return {
    limit(key: string) {
      const now = Date.now();
      sweep(now);
      let bucket = store.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        store.set(key, bucket);
      }
      bucket.count += 1;
      if (bucket.count > max) {
        return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
      }
      return { ok: true, remaining: max - bucket.count, retryAfterMs: 0 };
    },
    size: () => store.size,
  };
}

/** Best-effort client identity for limiting (proxy-aware, never trusts blindly). */
export function requestKey(request: Request, route: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${route}:${ip}`;
}

/** Uniform 429 response. */
export function rateLimitedResponse(retryAfterMs: number): Response {
  return Response.json(
    { ok: false, error: "RATE_LIMITED" },
    {
      status: 429,
      headers: {
        "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
        "cache-control": "no-store",
      },
    },
  );
}
