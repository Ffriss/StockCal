import type { Currency } from "./calculator/types";

/**
 * Display-only formatting. Values are rounded here and nowhere else.
 */

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: Currency, maxFractionDigits: number) {
  const key = `${currency}:${maxFractionDigits}`;
  let f = moneyFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      style: "currency",
      currencyDisplay: "narrowSymbol",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: maxFractionDigits,
    });
    moneyFormatters.set(key, f);
  }
  return f;
}

/** Convert a USD value to the display currency. Returns null if THB is requested without a valid rate. */
export function convertFromUsd(usd: number, currency: Currency, rate: number | null): number | null {
  if (currency === "USD") return usd;
  return rate && rate > 0 ? usd * rate : null;
}

/** Totals: 2 decimals. */
export function formatMoney(usd: number | null, currency: Currency = "USD", rate: number | null = null): string {
  if (usd === null || !Number.isFinite(usd)) return "—";
  const v = convertFromUsd(usd, currency, rate);
  if (v === null) return "—";
  return moneyFormatter(currency, 2).format(v);
}

/** Per-share prices: 2–4 decimals so small differences in average cost stay visible. */
export function formatPrice(usd: number | null, currency: Currency = "USD", rate: number | null = null): string {
  if (usd === null || !Number.isFinite(usd)) return "—";
  const v = convertFromUsd(usd, currency, rate);
  if (v === null) return "—";
  return moneyFormatter(currency, 4).format(v);
}

const sharesFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });
export function formatShares(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return sharesFormatter.format(n);
}

export function formatPercent(n: number | null, { signed = false } = {}): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const s = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(n);
  return `${s}%`;
}

export function formatSignedMoney(usd: number | null, currency: Currency = "USD", rate: number | null = null): string {
  if (usd === null || !Number.isFinite(usd)) return "—";
  const v = convertFromUsd(usd, currency, rate);
  if (v === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
      currencyDisplay: "narrowSymbol",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(v);
}

export function formatDateTime(iso: string | number | Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
