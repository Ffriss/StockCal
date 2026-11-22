/**
 * Calculator domain types.
 *
 * Form values are kept as strings (exactly what the user typed) so that
 * partially typed numbers such as "12." are never lost. They are parsed and
 * validated in one place: `calculate()`.
 *
 * Currency rules:
 * - Stock prices (existing average cost, purchase price, market price) are USD per share.
 * - Investment amounts and fixed fees are entered in `investmentCurrency`.
 * - All arithmetic happens in USD. THB is only an input/display currency.
 */

export type Currency = "USD" | "THB";

/** "actual" = purchases that really happened; "simulation" = what-if scenario. */
export type RecordKind = "simulation" | "actual";

export type PriceMode = "manual" | "auto";

export interface PurchaseInput {
  id: string;
  /** USD per share. */
  price: string;
  /** Cash spent on shares, in `investmentCurrency`. */
  amount: string;
}

export interface FeeSettings {
  enabled: boolean;
  /** Percentage of each purchase amount, e.g. "0.15" means 0.15 %. */
  percent: string;
  /** Fixed fee per purchase, in `investmentCurrency`. */
  fixed: string;
}

export interface CalculatorInput {
  symbol: string;
  existingShares: string;
  /** USD per share. */
  existingAvgCost: string;
  purchases: PurchaseInput[];
  investmentCurrency: Currency;
  /** THB per 1 USD. */
  exchangeRate: string;
  fees: FeeSettings;
  /** Optional current market price, USD per share. */
  marketPrice: string;
  priceMode: PriceMode;
  kind: RecordKind;
}

export type FieldKey =
  | "existingShares"
  | "existingAvgCost"
  | "exchangeRate"
  | "feePercent"
  | "feeFixed"
  | "marketPrice"
  | `purchase.${string}.price`
  | `purchase.${string}.amount`
  | "form";

export type FieldErrors = Partial<Record<FieldKey, string>>;

export interface PurchaseResult {
  id: string;
  index: number;
  priceUsd: number;
  amountUsd: number;
  feeUsd: number;
  shares: number;
}

export interface CalculationResult {
  /** True when there is a position with shares > 0 and no validation errors. */
  ok: boolean;
  errors: FieldErrors;

  existingShares: number;
  oldAvgCostUsd: number | null;
  originalCostUsd: number;

  purchases: PurchaseResult[];
  additionalShares: number;
  additionalInvestmentUsd: number;
  totalFeesUsd: number;

  totalShares: number;
  /** Original cost + additional investment + fees. */
  totalInvestmentUsd: number;
  newAvgCostUsd: number | null;
  /** (old − new) ÷ old × 100. Positive = average went down. Null when no old average. */
  avgCostReductionPct: number | null;

  marketPriceUsd: number | null;
  marketValueUsd: number | null;
  unrealizedPnlUsd: number | null;
  unrealizedPnlPct: number | null;

  /** THB per USD if valid, else null. */
  exchangeRate: number | null;
}
