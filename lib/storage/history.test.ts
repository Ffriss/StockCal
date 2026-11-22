import { describe, expect, it } from "vitest";
import { sanitizeHistory, sanitizeInput } from "./history";

describe("sanitizeInput", () => {
  it("returns defaults for garbage", () => {
    for (const bad of [null, 42, "x", [], undefined]) {
      const r = sanitizeInput(bad);
      expect(r.investmentCurrency).toBe("USD");
      expect(r.kind).toBe("simulation");
      expect(r.purchases).toHaveLength(1);
    }
  });

  it("keeps valid fields and coerces invalid ones", () => {
    const r = sanitizeInput({
      symbol: "NVDA",
      existingShares: 10, // number, not string → dropped
      existingAvgCost: "120.5",
      investmentCurrency: "EUR",
      kind: "actual",
      priceMode: "auto",
      fees: { enabled: true, percent: "0.1" },
      purchases: [{ id: "a", price: "100", amount: "500" }, "junk", { price: "1" }],
    });
    expect(r.symbol).toBe("NVDA");
    expect(r.existingShares).toBe("");
    expect(r.existingAvgCost).toBe("120.5");
    expect(r.investmentCurrency).toBe("USD");
    expect(r.kind).toBe("actual");
    expect(r.priceMode).toBe("auto");
    expect(r.fees).toEqual({ enabled: true, percent: "0.1", fixed: "" });
    expect(r.purchases).toHaveLength(2);
    expect(r.purchases[0]).toEqual({ id: "a", price: "100", amount: "500" });
    expect(r.purchases[1].id).toBeTruthy();
  });
});

describe("sanitizeHistory", () => {
  it("drops invalid and duplicate records", () => {
    const list = sanitizeHistory([
      { id: "1", name: "A", input: { symbol: "AAPL" }, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "1", name: "dup" },
      { name: "no id" },
      null,
      { id: "2", input: { symbol: "TSLA" } },
    ]);
    expect(list.map((r) => r.id)).toEqual(["1", "2"]);
    expect(list[0].updatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(list[1].name).toBe("TSLA");
  });

  it("returns [] for non-arrays", () => {
    expect(sanitizeHistory({})).toEqual([]);
    expect(sanitizeHistory(null)).toEqual([]);
  });
});
