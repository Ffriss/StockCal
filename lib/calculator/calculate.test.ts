import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";
import { parseDecimal, normalizeSymbol } from "./parse";
import type { CalculatorInput, PurchaseInput } from "./types";

let seq = 0;
const row = (price: string, amount: string): PurchaseInput => ({ id: `r${seq++}`, price, amount });

function input(overrides: Partial<CalculatorInput> = {}): CalculatorInput {
  return {
    symbol: "NVDA",
    existingShares: "",
    existingAvgCost: "",
    purchases: [],
    investmentCurrency: "USD",
    exchangeRate: "",
    fees: { enabled: false, percent: "", fixed: "" },
    marketPrice: "",
    priceMode: "manual",
    kind: "simulation",
    ...overrides,
  };
}

describe("calculate — core formulas", () => {
  it("averages down with a single USD purchase", () => {
    // 100 sh @ $50 = $5,000. Buy $1,000 @ $40 = 25 sh. 125 sh, $6,000 → $48.
    const r = calculate(input({ existingShares: "100", existingAvgCost: "50", purchases: [row("40", "1000")] }));
    expect(r.ok).toBe(true);
    expect(r.originalCostUsd).toBe(5000);
    expect(r.additionalShares).toBe(25);
    expect(r.totalShares).toBe(125);
    expect(r.totalInvestmentUsd).toBe(6000);
    expect(r.newAvgCostUsd).toBe(48);
    expect(r.oldAvgCostUsd).toBe(50);
    expect(r.avgCostReductionPct).toBeCloseTo(4, 10);
  });

  it("averaging up gives a negative reduction", () => {
    // 10 sh @ $100. Buy $1,500 @ $150 = 10 sh. 20 sh, $2,500 → $125. (100-125)/100 = -25 %.
    const r = calculate(input({ existingShares: "10", existingAvgCost: "100", purchases: [row("150", "1500")] }));
    expect(r.newAvgCostUsd).toBe(125);
    expect(r.avgCostReductionPct).toBeCloseTo(-25, 10);
  });

  it("converts THB investment to USD before any calculation", () => {
    // ฿35,000 at 35 THB/USD = $1,000 @ $50 = 20 sh. 10 sh @ $100 = $1,000.
    // 30 sh, $2,000 → $66.6667. Reduction 33.33 %.
    const r = calculate(
      input({
        existingShares: "10",
        existingAvgCost: "100",
        investmentCurrency: "THB",
        exchangeRate: "35",
        purchases: [row("50", "35000")],
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.additionalInvestmentUsd).toBeCloseTo(1000, 10);
    expect(r.additionalShares).toBeCloseTo(20, 10);
    expect(r.totalInvestmentUsd).toBeCloseTo(2000, 10);
    expect(r.newAvgCostUsd).toBeCloseTo(66.666666667, 8);
    expect(r.avgCostReductionPct).toBeCloseTo(33.333333333, 8);
  });

  it("supports multiple purchases and a brand-new position", () => {
    // $100 @ $10 = 10 sh; $100 @ $20 = 5 sh. 15 sh, $200 → $13.3333.
    const r = calculate(input({ purchases: [row("10", "100"), row("20", "100")] }));
    expect(r.ok).toBe(true);
    expect(r.totalShares).toBe(15);
    expect(r.newAvgCostUsd).toBeCloseTo(13.333333333, 8);
    expect(r.oldAvgCostUsd).toBeNull();
    expect(r.avgCostReductionPct).toBeNull();
  });

  it("supports fractional shares", () => {
    // 0.5 sh @ $200 = $100. $50 @ $250 = 0.2 sh. 0.7 sh, $150 → $214.2857.
    const r = calculate(input({ existingShares: "0.5", existingAvgCost: "200", purchases: [row("250", "50")] }));
    expect(r.totalShares).toBeCloseTo(0.7, 12);
    expect(r.newAvgCostUsd).toBeCloseTo(214.285714286, 8);
  });

  it("works with only an existing position (no purchase yet)", () => {
    const r = calculate(input({ existingShares: "12", existingAvgCost: "30", purchases: [row("", "")] }));
    expect(r.ok).toBe(true);
    expect(r.newAvgCostUsd).toBe(30);
    expect(r.avgCostReductionPct).toBe(0);
  });

  it("keeps precision across many small fractional purchases", () => {
    // 10 × $0.10 @ $0.30 → 3.3333… sh for exactly $1.00 → avg $0.30.
    const rows = Array.from({ length: 10 }, () => row("0.3", "0.1"));
    const r = calculate(input({ purchases: rows }));
    expect(r.additionalInvestmentUsd).toBeCloseTo(1, 14);
    expect(r.newAvgCostUsd).toBeCloseTo(0.3, 14);
  });

  it("accepts thousands separators", () => {
    const r = calculate(input({ existingShares: "1,000", existingAvgCost: "1,250.50", purchases: [] }));
    expect(r.originalCostUsd).toBe(1_250_500);
  });
});

describe("calculate — fees", () => {
  it("adds percentage + fixed fees to cost basis, not to share count", () => {
    // $1,000 @ $40 = 25 sh. Fee = 0.1 % × 1,000 + $1 = $2. Total $6,002 / 125 = $48.016.
    const r = calculate(
      input({
        existingShares: "100",
        existingAvgCost: "50",
        purchases: [row("40", "1000")],
        fees: { enabled: true, percent: "0.1", fixed: "1" },
      }),
    );
    expect(r.additionalShares).toBe(25);
    expect(r.totalFeesUsd).toBeCloseTo(2, 12);
    expect(r.newAvgCostUsd).toBeCloseTo(48.016, 12);
  });

  it("converts fixed THB fees with the exchange rate", () => {
    // ฿3,500 / 35 = $100 @ $10 = 10 sh. Fixed fee ฿35 = $1. Total $101 → $10.10.
    const r = calculate(
      input({
        investmentCurrency: "THB",
        exchangeRate: "35",
        purchases: [row("10", "3500")],
        fees: { enabled: true, percent: "", fixed: "35" },
      }),
    );
    expect(r.totalFeesUsd).toBeCloseTo(1, 12);
    expect(r.newAvgCostUsd).toBeCloseTo(10.1, 12);
  });

  it("ignores fee values when fees are disabled", () => {
    const r = calculate(
      input({ purchases: [row("10", "100")], fees: { enabled: false, percent: "5", fixed: "10" } }),
    );
    expect(r.totalFeesUsd).toBe(0);
    expect(r.newAvgCostUsd).toBe(10);
  });
});

describe("calculate — market value and P/L", () => {
  it("computes unrealized P/L against total investment", () => {
    // 125 sh × $45 = $5,625. Cost $6,000. P/L −$375 = −6.25 %.
    const r = calculate(
      input({ existingShares: "100", existingAvgCost: "50", purchases: [row("40", "1000")], marketPrice: "45" }),
    );
    expect(r.marketValueUsd).toBe(5625);
    expect(r.unrealizedPnlUsd).toBe(-375);
    expect(r.unrealizedPnlPct).toBeCloseTo(-6.25, 12);
  });

  it("leaves P/L empty without a market price", () => {
    const r = calculate(input({ existingShares: "1", existingAvgCost: "1" }));
    expect(r.marketValueUsd).toBeNull();
    expect(r.unrealizedPnlUsd).toBeNull();
  });
});

describe("calculate — validation and division by zero", () => {
  it("returns no result (and no crash) for an empty form", () => {
    const r = calculate(input());
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual({});
    expect(r.newAvgCostUsd).toBeNull();
  });

  it("rejects negative numbers", () => {
    const r = calculate(input({ existingShares: "-5", existingAvgCost: "10" }));
    expect(r.ok).toBe(false);
    expect(r.errors.existingShares).toMatch(/ต้องไม่ติดลบ/);
  });

  it("rejects a zero purchase price (division by zero)", () => {
    const p = row("0", "100");
    const r = calculate(input({ purchases: [p] }));
    expect(r.ok).toBe(false);
    expect(r.errors[`purchase.${p.id}.price`]).toBeDefined();
  });

  it("requires a price when an amount is entered", () => {
    const p = row("", "100");
    const r = calculate(input({ purchases: [p] }));
    expect(r.errors[`purchase.${p.id}.price`]).toMatch(/ราคาซื้อ/);
  });

  it("ignores a row that only has a price (amount not entered yet)", () => {
    const r = calculate(input({ existingShares: "10", existingAvgCost: "5", purchases: [row("4", "")] }));
    expect(r.ok).toBe(true);
    expect(r.additionalShares).toBe(0);
  });

  it("requires an exchange rate for THB amounts", () => {
    const r = calculate(input({ investmentCurrency: "THB", purchases: [row("10", "1000")] }));
    expect(r.ok).toBe(false);
    expect(r.errors.exchangeRate).toBeDefined();
  });

  it("rejects a zero exchange rate", () => {
    const r = calculate(input({ investmentCurrency: "THB", exchangeRate: "0", purchases: [row("10", "1000")] }));
    expect(r.errors.exchangeRate).toMatch(/มากกว่า 0/);
  });

  it("requires an average cost when existing shares are entered", () => {
    const r = calculate(input({ existingShares: "10" }));
    expect(r.errors.existingAvgCost).toBeDefined();
  });

  it("rejects non-numeric text", () => {
    const r = calculate(input({ existingShares: "abc" }));
    expect(r.errors.existingShares).toMatch(/ตัวเลขที่ถูกต้อง/);
  });

  it("does not divide by zero when old average cost is 0", () => {
    const r = calculate(input({ existingShares: "10", existingAvgCost: "0", purchases: [row("10", "100")] }));
    expect(r.ok).toBe(true);
    expect(r.newAvgCostUsd).toBe(5);
    expect(r.avgCostReductionPct).toBeNull();
  });
});

describe("parseDecimal / normalizeSymbol", () => {
  it.each([
    ["", { kind: "empty" }],
    ["  ", { kind: "empty" }],
    ["12", { kind: "number", value: 12 }],
    ["12.", { kind: "number", value: 12 }],
    [".5", { kind: "number", value: 0.5 }],
    ["1,000.25", { kind: "number", value: 1000.25 }],
    ["-3", { kind: "number", value: -3 }],
    ["1e5", { kind: "invalid" }],
    ["abc", { kind: "invalid" }],
    [".", { kind: "invalid" }],
    ["1.2.3", { kind: "invalid" }],
  ])("parseDecimal(%j)", (raw, expected) => {
    expect(parseDecimal(raw)).toEqual(expected);
  });

  it("normalizes tickers", () => {
    expect(normalizeSymbol(" nvda ")).toBe("NVDA");
    expect(normalizeSymbol("brk.b")).toBe("BRK.B");
    expect(normalizeSymbol("$tsla!")).toBe("TSLA");
  });
});
