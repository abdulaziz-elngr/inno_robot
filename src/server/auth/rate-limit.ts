/**
 * In-memory sliding-window limiter.
 *
 * Suitable for a single Node.js instance / local development. On Vercel serverless
 * instances are not shared, so production deployments that need cluster-wide limits
 * should point `createRateLimiter` at a shared store (Redis / Upstash) — the interface
 * below is the single integration point for that swap (see docs/SECURITY.md).
 */
export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

type Bucket = number[];

const store = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, hits] of store) {
    if (hits.length === 0 || (now - (hits[hits.length - 1] ?? 0)) > windowMs * 2) store.delete(key);
  }
}

export function createRateLimiter(opts: { windowMs: number; max: number; name: string }) {
  return {
    name: opts.name,
    check(key: string): RateLimitResult {
      const now = Date.now();
      sweep(now, opts.windowMs);
      const bucketKey = `${opts.name}:${key}`;
      const bucket = (store.get(bucketKey) ?? []).filter((t) => now - t < opts.windowMs);
      if (bucket.length >= opts.max) {
        const oldest = bucket[0] ?? now;
        return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000)) };
      }
      bucket.push(now);
      store.set(bucketKey, bucket);
      return { ok: true, remaining: opts.max - bucket.length, retryAfterSeconds: 0 };
    },
    reset(key?: string) {
      if (key) {
        for (const k of [...store.keys()]) if (k.endsWith(`:${key}`)) store.delete(k);
      } else store.clear();
    },
  };
}

/** Login attempts per email+IP. */
export const loginLimiter = createRateLimiter({ name: "login", windowMs: 15 * 60_000, max: 8 });
/** Assistant chat requests per IP. */
export const chatLimiter = createRateLimiter({ name: "chat", windowMs: 60_000, max: 20 });
/** NFC ingestion per device (duplicate protection additionally covers retries). */
export const nfcLimiter = createRateLimiter({ name: "nfc", windowMs: 60_000, max: 120 });
/** Password reset requests per IP. */
export const resetLimiter = createRateLimiter({ name: "reset", windowMs: 60 * 60_000, max: 5 });
