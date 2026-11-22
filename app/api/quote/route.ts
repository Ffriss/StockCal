import type { NextRequest } from "next/server";
import { normalizeSymbol } from "@/lib/calculator/parse";
import { RateLimiter, TtlCache } from "@/lib/stock-price/server/cache";
import { getProvider } from "@/lib/stock-price/server/registry";
import { isValidSymbol } from "@/lib/stock-price/symbol";
import { QuoteError, type QuoteApiResponse, type QuoteErrorCode, type StockQuote } from "@/lib/stock-price/types";

// Module-level state persists for the lifetime of a server instance.
const cache = new TtlCache<StockQuote>(60_000);
// Stay well under typical free-tier limits (e.g. Finnhub free: 60 calls/min).
const limiter = new RateLimiter(30, 60_000);

const STATUS: Record<QuoteErrorCode, number> = {
  NOT_CONFIGURED: 503,
  INVALID_SYMBOL: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
};

function fail(code: QuoteErrorCode, message: string, retryAfterSec?: number) {
  const body: QuoteApiResponse = { ok: false, error: { code, message, retryAfterSec } };
  const headers: HeadersInit = { "Cache-Control": "no-store" };
  if (retryAfterSec) headers["Retry-After"] = String(retryAfterSec);
  return Response.json(body, { status: STATUS[code], headers });
}

export async function GET(request: NextRequest) {
  const provider = getProvider();
  if (!provider) {
    return fail("NOT_CONFIGURED", "เว็บไซต์นี้ยังไม่ได้ตั้งค่าราคาอัตโนมัติ กรุณากรอกราคาเอง");
  }

  const symbol = normalizeSymbol(request.nextUrl.searchParams.get("symbol") ?? "");
  if (!isValidSymbol(symbol)) {
    return fail("INVALID_SYMBOL", "กรุณากรอกชื่อย่อหุ้นให้ถูกต้อง เช่น NVDA หรือ BRK.B");
  }

  const cached = cache.get(symbol);
  if (cached) {
    const body: QuoteApiResponse = { ok: true, quote: cached, cached: true };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  }

  const wait = limiter.tryAcquire();
  if (wait > 0) {
    return fail("RATE_LIMITED", "มีการขอราคามากเกินไป กรุณารอสักครู่แล้วลองใหม่", wait);
  }

  try {
    const quote = await provider.getQuote(symbol);
    cache.set(symbol, quote);
    const body: QuoteApiResponse = { ok: true, quote, cached: false };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof QuoteError) return fail(err.code, err.message, err.retryAfterSec);
    console.error("[api/quote] unexpected error", err);
    return fail("UPSTREAM_ERROR", "เกิดข้อผิดพลาดที่ไม่คาดคิดระหว่างดึงราคา");
  }
}
