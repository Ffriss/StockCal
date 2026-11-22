import { QuoteError, type StockPriceProvider, type StockQuote } from "../types";

/**
 * Finnhub adapter using the documented REST endpoint
 *   GET https://finnhub.io/api/v1/quote?symbol=AAPL
 * Docs: https://finnhub.io/docs/api/quote
 *
 * Response fields used: c = current/latest price, t = UNIX timestamp (seconds).
 * Finnhub returns c = 0 and t = 0 for unknown symbols.
 *
 * The API key is sent as a header from the server only; it never reaches the browser.
 */

interface FinnhubQuote {
  c?: number | null;
  t?: number | null;
}

type FetchFn = typeof fetch;

export function createFinnhubProvider(apiKey: string, fetchFn: FetchFn = fetch): StockPriceProvider {
  const name = "Finnhub";
  const dataNote =
    "ราคาล่าสุดที่มีจาก Finnhub ซึ่งอาจล่าช้า และไม่รับประกันว่าเป็นราคาแบบเรียลไทม์";

  return {
    id: "finnhub",
    name,
    attributionUrl: "https://finnhub.io",
    dataNote,

    async getQuote(symbol: string): Promise<StockQuote> {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`;
      let res: Response;
      try {
        res = await fetchFn(url, {
          headers: { "X-Finnhub-Token": apiKey, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
      } catch (err) {
        if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
          throw new QuoteError("TIMEOUT", "ผู้ให้บริการราคาตอบสนองช้าเกินไป กรุณาลองใหม่อีกครั้ง");
        }
        throw new QuoteError("UPSTREAM_ERROR", "ไม่สามารถเชื่อมต่อผู้ให้บริการราคาได้");
      }

      if (res.status === 429) {
        const retry = Number(res.headers.get("retry-after"));
        throw new QuoteError(
          "RATE_LIMITED",
          "เรียกใช้ผู้ให้บริการราคาเกินโควตา กรุณารอสักครู่แล้วลองใหม่",
          Number.isFinite(retry) && retry > 0 ? retry : 60,
        );
      }
      if (res.status === 401 || res.status === 403) {
        throw new QuoteError(
          "UPSTREAM_ERROR",
          "ผู้ให้บริการราคาปฏิเสธคำขอ (API key ไม่ถูกต้อง หรือแพ็กเกจปัจจุบันไม่รองรับหุ้นตัวนี้)",
        );
      }
      if (!res.ok) {
        throw new QuoteError("UPSTREAM_ERROR", `ผู้ให้บริการราคาแจ้งข้อผิดพลาด (HTTP ${res.status})`);
      }

      let body: FinnhubQuote;
      try {
        body = (await res.json()) as FinnhubQuote;
      } catch {
        throw new QuoteError("UPSTREAM_ERROR", "ไม่สามารถอ่านข้อมูลจากผู้ให้บริการราคาได้");
      }

      const price = typeof body.c === "number" ? body.c : 0;
      const ts = typeof body.t === "number" ? body.t : 0;
      if (!(price > 0) || !Number.isFinite(price)) {
        throw new QuoteError("NOT_FOUND", `ไม่พบราคาของ "${symbol}" กรุณาตรวจสอบชื่อย่อหุ้น`);
      }

      return {
        symbol,
        price,
        currency: "USD",
        asOf: ts > 0 ? new Date(ts * 1000).toISOString() : null,
        fetchedAt: new Date().toISOString(),
        provider: name,
        dataNote,
      };
    },
  };
}
