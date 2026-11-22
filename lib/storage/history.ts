import { createEmptyInput, newId } from "@/lib/calculator/defaults";
import type { CalculatorInput, Currency, PurchaseInput } from "@/lib/calculator/types";

/** Bump the version suffix if the stored shape ever changes incompatibly. */
export const STORAGE_KEYS = {
  history: "stock-avg-calc:v1:history",
  draft: "stock-avg-calc:v1:draft",
  displayCurrency: "stock-avg-calc:v1:display-currency",
} as const;

export interface SavedCalculation {
  id: string;
  /** User-facing name; defaults to the symbol. */
  name: string;
  input: CalculatorInput;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * Rebuild a CalculatorInput from untrusted JSON. Unknown/missing fields fall
 * back to defaults so older or hand-edited data never crashes the app.
 */
export function sanitizeInput(raw: unknown): CalculatorInput {
  const d = createEmptyInput();
  if (!isObj(raw)) return d;

  const purchases: PurchaseInput[] = Array.isArray(raw.purchases)
    ? raw.purchases.filter(isObj).map((p) => ({
        id: str(p.id) || newId(),
        price: str(p.price),
        amount: str(p.amount),
      }))
    : [];

  const fees = isObj(raw.fees) ? raw.fees : {};

  return {
    symbol: str(raw.symbol),
    existingShares: str(raw.existingShares),
    existingAvgCost: str(raw.existingAvgCost),
    purchases: purchases.length ? purchases : d.purchases,
    investmentCurrency: raw.investmentCurrency === "THB" ? "THB" : "USD",
    exchangeRate: str(raw.exchangeRate),
    fees: {
      enabled: fees.enabled === true,
      percent: str(fees.percent),
      fixed: str(fees.fixed),
    },
    marketPrice: str(raw.marketPrice),
    priceMode: raw.priceMode === "auto" ? "auto" : "manual",
    kind: raw.kind === "actual" ? "actual" : "simulation",
  };
}

export function sanitizeHistory(raw: unknown): SavedCalculation[] {
  if (!Array.isArray(raw)) return [];
  const now = new Date().toISOString();
  const seen = new Set<string>();
  const out: SavedCalculation[] = [];
  for (const item of raw) {
    if (!isObj(item)) continue;
    const id = str(item.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const input = sanitizeInput(item.input);
    out.push({
      id,
      name: str(item.name) || input.symbol || "ไม่มีชื่อ",
      input,
      createdAt: str(item.createdAt, now),
      updatedAt: str(item.updatedAt, str(item.createdAt, now)),
    });
  }
  return out;
}

export function sanitizeCurrency(raw: unknown): Currency {
  return raw === "THB" ? "THB" : "USD";
}
