import { describe, expect, it, vi } from "vitest";
import { RateLimiter, TtlCache } from "./server/cache";
import { createFinnhubProvider } from "./server/finnhub";
import { getProvider, getProviderStatus } from "./server/registry";
import { isValidSymbol } from "./symbol";
import { QuoteError } from "./types";

/**
 * These tests exercise our adapter's parsing and error mapping using
 * stubbed HTTP responses. They never present stubbed data as market data.
 */
function stubFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(QuoteError);
  await expect(p).rejects.toMatchObject({ code });
}

describe("Finnhub adapter", () => {
  it("maps a quote response and sends the key as a header", async () => {
    const f = stubFetch(200, { c: 123.45, t: 1_700_000_000 });
    const q = await createFinnhubProvider("secret", f).getQuote("NVDA");
    expect(q).toMatchObject({ symbol: "NVDA", price: 123.45, currency: "USD", provider: "Finnhub" });
    expect(q.asOf).toBe(new Date(1_700_000_000_000).toISOString());
    expect(q.dataNote).toMatch(/ไม่รับประกันว่าเป็นราคาแบบเรียลไทม์/);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain("secret");
    expect((init as RequestInit).headers).toMatchObject({ "X-Finnhub-Token": "secret" });
  });

  it("treats a zero price as unknown symbol", async () => {
    await expectCode(createFinnhubProvider("k", stubFetch(200, { c: 0, t: 0 })).getQuote("ZZZZ"), "NOT_FOUND");
  });

  it("maps 429 to RATE_LIMITED with retry-after", async () => {
    const p = createFinnhubProvider("k", stubFetch(429, {}, { "retry-after": "30" })).getQuote("AAPL");
    await expect(p).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSec: 30 });
  });

  it("maps 401/403 and 5xx to UPSTREAM_ERROR", async () => {
    await expectCode(createFinnhubProvider("k", stubFetch(401, {})).getQuote("AAPL"), "UPSTREAM_ERROR");
    await expectCode(createFinnhubProvider("k", stubFetch(500, {})).getQuote("AAPL"), "UPSTREAM_ERROR");
  });

  it("maps network failure and timeouts", async () => {
    const netFail = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expectCode(createFinnhubProvider("k", netFail).getQuote("AAPL"), "UPSTREAM_ERROR");
    const timeout = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    }) as unknown as typeof fetch;
    await expectCode(createFinnhubProvider("k", timeout).getQuote("AAPL"), "TIMEOUT");
  });
});

describe("provider registry", () => {
  it("is disabled unless explicitly configured", () => {
    expect(getProvider({} as NodeJS.ProcessEnv)).toBeNull();
    expect(getProvider({ FINNHUB_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(getProviderStatus({} as NodeJS.ProcessEnv).enabled).toBe(false);
  });

  it("explains a missing key", () => {
    const s = getProviderStatus({ STOCK_PRICE_PROVIDER: "finnhub" } as unknown as NodeJS.ProcessEnv);
    expect(s.enabled).toBe(false);
    expect(s.reason).toMatch(/API key/);
  });

  it("enables Finnhub with provider + key, without leaking the key in status", () => {
    const env = { STOCK_PRICE_PROVIDER: "finnhub", FINNHUB_API_KEY: "secret" } as unknown as NodeJS.ProcessEnv;
    expect(getProvider(env)?.id).toBe("finnhub");
    const s = getProviderStatus(env);
    expect(s.enabled).toBe(true);
    expect(JSON.stringify(s)).not.toContain("secret");
  });
});

describe("cache and rate limiter", () => {
  it("expires cache entries after the TTL", () => {
    let now = 0;
    const c = new TtlCache<number>(1000, 10, () => now);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    now = 1000;
    expect(c.get("a")).toBeUndefined();
  });

  it("limits calls per window", () => {
    let now = 0;
    const r = new RateLimiter(2, 60_000, () => now);
    expect(r.tryAcquire()).toBe(0);
    expect(r.tryAcquire()).toBe(0);
    expect(r.tryAcquire()).toBe(60);
    now = 60_000;
    expect(r.tryAcquire()).toBe(0);
  });
});

describe("isValidSymbol", () => {
  it.each(["SNDK", "NVDA", "TSLA", "AVGO", "ASML", "AAPL", "MSFT", "BRK.B", "BF-B"])("accepts %s", (s) =>
    expect(isValidSymbol(s)).toBe(true),
  );
  it.each(["", "TOOLONGSYM", "A..B", ".A", "nvda"])("rejects %j", (s) => expect(isValidSymbol(s)).toBe(false));
});
