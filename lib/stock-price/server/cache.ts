/**
 * Tiny in-memory helpers for the quote route.
 *
 * On Vercel each serverless instance has its own memory, so these are
 * best-effort: they reduce upstream calls but are not a global guarantee.
 */

export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();
  constructor(
    private ttlMs: number,
    private maxEntries = 500,
    private now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: this.now() + this.ttlMs });
  }
}

/** Sliding-window limiter: at most `limit` calls per `windowMs`. */
export class RateLimiter {
  private calls: number[] = [];
  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** Returns 0 if allowed (and records the call), else seconds to wait. */
  tryAcquire(): number {
    const t = this.now();
    this.calls = this.calls.filter((c) => t - c < this.windowMs);
    if (this.calls.length >= this.limit) {
      return Math.max(1, Math.ceil((this.calls[0] + this.windowMs - t) / 1000));
    }
    this.calls.push(t);
    return 0;
  }
}
