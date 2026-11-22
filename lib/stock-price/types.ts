/**
 * Provider-agnostic stock price types. The calculator only ever sees
 * `StockQuote`; swapping providers means writing a new `StockPriceProvider`
 * and registering it in `server/registry.ts`.
 */

export interface StockQuote {
  symbol: string;
  /** Latest available price in `currency`. */
  price: number;
  currency: "USD";
  /** Timestamp of the price as reported by the provider (ISO), if provided. */
  asOf: string | null;
  /** When our server fetched it (ISO). */
  fetchedAt: string;
  /** Human-readable provider name, e.g. "Finnhub". */
  provider: string;
  /** Honest description of freshness, e.g. "May be delayed". Never claims real-time. */
  dataNote: string;
}

export type QuoteErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_SYMBOL"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UPSTREAM_ERROR";

export class QuoteError extends Error {
  constructor(
    public readonly code: QuoteErrorCode,
    message: string,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "QuoteError";
  }
}

export interface StockPriceProvider {
  readonly id: string;
  readonly name: string;
  /** Link shown next to prices for attribution. */
  readonly attributionUrl: string;
  readonly dataNote: string;
  getQuote(symbol: string): Promise<StockQuote>;
}

/** Response of GET /api/quote/status */
export interface ProviderStatus {
  enabled: boolean;
  providerName?: string;
  attributionUrl?: string;
  dataNote?: string;
  /** Explanation shown when disabled. */
  reason?: string;
  autoRefreshMinutes: number;
}

/** Response of GET /api/quote?symbol=XYZ */
export type QuoteApiResponse =
  | { ok: true; quote: StockQuote; cached: boolean }
  | { ok: false; error: { code: QuoteErrorCode; message: string; retryAfterSec?: number } };

export const AUTO_REFRESH_MINUTES = 5;
