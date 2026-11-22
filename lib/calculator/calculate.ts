import { parseDecimal } from "./parse";
import type {
  CalculationResult,
  CalculatorInput,
  FieldErrors,
  FieldKey,
  PurchaseResult,
} from "./types";

/**
 * Core formulas (all values in USD):
 *
 *   Original Cost        = Existing Shares × Existing Average Cost
 *   Amount (USD)         = Amount (THB) ÷ Exchange Rate        (if entered in THB)
 *   Additional Shares    = Σ  Amount_i (USD) ÷ Purchase Price_i
 *   Fees (optional)      = Σ  Amount_i × Fee% + Fixed Fee
 *   New Total Shares     = Existing Shares + Additional Shares
 *   Total Investment     = Original Cost + Σ Amount_i (USD) + Fees
 *   New Average Cost     = Total Investment ÷ New Total Shares
 *   Avg Cost Reduction % = (Old Avg − New Avg) ÷ Old Avg × 100
 *   Market Value         = New Total Shares × Market Price
 *   Unrealized P/L       = Market Value − Total Investment
 *   Unrealized P/L %     = Unrealized P/L ÷ Total Investment × 100
 *
 * Full floating-point precision is kept throughout; rounding happens only in
 * the display formatters (lib/format.ts).
 */
export function calculate(input: CalculatorInput): CalculationResult {
  const errors: FieldErrors = {};
  const setError = (key: FieldKey, msg: string) => {
    if (!errors[key]) errors[key] = msg;
  };

  /** Parse an optional non-negative number. Empty → `fallback`. */
  const readNonNegative = (key: FieldKey, raw: string, label: string, fallback: number | null) => {
    const p = parseDecimal(raw);
    if (p.kind === "empty") return fallback;
    if (p.kind === "invalid") {
      setError(key, `${label}ต้องเป็นตัวเลขที่ถูกต้อง`);
      return null;
    }
    if (p.value < 0) {
      setError(key, `${label}ต้องไม่ติดลบ`);
      return null;
    }
    return p.value;
  };

  // --- Exchange rate -------------------------------------------------------
  const usesThb = input.investmentCurrency === "THB";
  const rateParsed = parseDecimal(input.exchangeRate);
  let exchangeRate: number | null = null;
  if (rateParsed.kind === "empty") {
    if (usesThb) setError("exchangeRate", "กรุณากรอกอัตราแลกเปลี่ยน (บาทต่อ 1 USD) เพื่อแปลงจำนวนเงินบาท");
  } else if (rateParsed.kind === "invalid") {
    setError("exchangeRate", "อัตราแลกเปลี่ยนต้องเป็นตัวเลขที่ถูกต้อง");
  } else if (rateParsed.value <= 0) {
    setError("exchangeRate", "อัตราแลกเปลี่ยนต้องมากกว่า 0");
  } else {
    exchangeRate = rateParsed.value;
  }

  const toUsd = (amount: number): number => {
    if (!usesThb) return amount;
    // exchangeRate is validated above; if invalid an error is already recorded.
    return exchangeRate ? amount / exchangeRate : 0;
  };

  // --- Existing position ---------------------------------------------------
  const existingShares = readNonNegative("existingShares", input.existingShares, "จำนวนหุ้นที่ถืออยู่", 0) ?? 0;
  let oldAvgCostUsd = readNonNegative("existingAvgCost", input.existingAvgCost, "ต้นทุนเฉลี่ย", null);
  if (existingShares > 0 && oldAvgCostUsd === null && !errors.existingAvgCost) {
    setError("existingAvgCost", "กรุณากรอกต้นทุนเฉลี่ยต่อหุ้นปัจจุบัน");
  }
  if (existingShares === 0) oldAvgCostUsd = null; // An average of zero shares is undefined.
  const originalCostUsd = existingShares * (oldAvgCostUsd ?? 0);

  // --- Fees ----------------------------------------------------------------
  let feePercent = 0;
  let feeFixed = 0;
  if (input.fees.enabled) {
    feePercent = readNonNegative("feePercent", input.fees.percent, "ค่าธรรมเนียม (%)", 0) ?? 0;
    if (feePercent > 100) setError("feePercent", "ค่าธรรมเนียมต้องไม่เกิน 100%");
    feeFixed = readNonNegative("feeFixed", input.fees.fixed, "ค่าธรรมเนียมคงที่", 0) ?? 0;
  }

  // --- Additional purchases ------------------------------------------------
  const purchases: PurchaseResult[] = [];
  input.purchases.forEach((row, index) => {
    const priceKey = `purchase.${row.id}.price` as const;
    const amountKey = `purchase.${row.id}.amount` as const;
    const amount = readNonNegative(amountKey, row.amount, "จำนวนเงินลงทุน", null);
    const priceParsed = parseDecimal(row.price);

    let price: number | null = null;
    if (priceParsed.kind === "invalid") setError(priceKey, "ราคาซื้อต้องเป็นตัวเลขที่ถูกต้อง");
    else if (priceParsed.kind === "number") {
      if (priceParsed.value <= 0) setError(priceKey, "ราคาซื้อต้องมากกว่า 0");
      else price = priceParsed.value;
    }

    // A row without an amount is treated as "not filled in yet" and ignored.
    if (amount === null || amount === 0) return;
    if (price === null) {
      if (priceParsed.kind === "empty") setError(priceKey, "กรุณากรอกราคาซื้อต่อหุ้น");
      return;
    }

    const amountUsd = toUsd(amount);
    const feeUsd = input.fees.enabled ? (amountUsd * feePercent) / 100 + toUsd(feeFixed) : 0;
    purchases.push({ id: row.id, index, priceUsd: price, amountUsd, feeUsd, shares: amountUsd / price });
  });

  // --- Market price (optional) ---------------------------------------------
  const marketParsed = parseDecimal(input.marketPrice);
  let marketPriceUsd: number | null = null;
  if (marketParsed.kind === "invalid") setError("marketPrice", "ราคาตลาดต้องเป็นตัวเลขที่ถูกต้อง");
  else if (marketParsed.kind === "number") {
    if (marketParsed.value <= 0) setError("marketPrice", "ราคาตลาดต้องมากกว่า 0");
    else marketPriceUsd = marketParsed.value;
  }

  const empty: CalculationResult = {
    ok: false,
    errors,
    existingShares,
    oldAvgCostUsd,
    originalCostUsd,
    purchases: [],
    additionalShares: 0,
    additionalInvestmentUsd: 0,
    totalFeesUsd: 0,
    totalShares: 0,
    totalInvestmentUsd: 0,
    newAvgCostUsd: null,
    avgCostReductionPct: null,
    marketPriceUsd,
    marketValueUsd: null,
    unrealizedPnlUsd: null,
    unrealizedPnlPct: null,
    exchangeRate,
  };

  if (Object.keys(errors).length > 0) return empty;

  // --- Totals --------------------------------------------------------------
  const additionalShares = sum(purchases.map((p) => p.shares));
  const additionalInvestmentUsd = sum(purchases.map((p) => p.amountUsd));
  const totalFeesUsd = sum(purchases.map((p) => p.feeUsd));
  const totalShares = existingShares + additionalShares;

  if (totalShares <= 0) {
    return { ...empty, purchases, additionalShares, additionalInvestmentUsd, totalFeesUsd };
  }

  const totalInvestmentUsd = originalCostUsd + additionalInvestmentUsd + totalFeesUsd;
  const newAvgCostUsd = totalInvestmentUsd / totalShares;
  const avgCostReductionPct =
    oldAvgCostUsd !== null && oldAvgCostUsd > 0
      ? ((oldAvgCostUsd - newAvgCostUsd) / oldAvgCostUsd) * 100
      : null;

  let marketValueUsd: number | null = null;
  let unrealizedPnlUsd: number | null = null;
  let unrealizedPnlPct: number | null = null;
  if (marketPriceUsd !== null) {
    marketValueUsd = totalShares * marketPriceUsd;
    unrealizedPnlUsd = marketValueUsd - totalInvestmentUsd;
    unrealizedPnlPct = totalInvestmentUsd > 0 ? (unrealizedPnlUsd / totalInvestmentUsd) * 100 : null;
  }

  return {
    ok: true,
    errors,
    existingShares,
    oldAvgCostUsd,
    originalCostUsd,
    purchases,
    additionalShares,
    additionalInvestmentUsd,
    totalFeesUsd,
    totalShares,
    totalInvestmentUsd,
    newAvgCostUsd,
    avgCostReductionPct,
    marketPriceUsd,
    marketValueUsd,
    unrealizedPnlUsd,
    unrealizedPnlPct,
    exchangeRate,
  };
}

/** Kahan summation — avoids drift when adding many fractional values. */
function sum(values: number[]): number {
  let total = 0;
  let c = 0;
  for (const v of values) {
    const y = v - c;
    const t = total + y;
    c = t - total - y;
    total = t;
  }
  return total;
}
