import type { CalculatorInput, PurchaseInput } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPurchase(partial: Partial<PurchaseInput> = {}): PurchaseInput {
  return { id: newId(), price: "", amount: "", ...partial };
}

export function createEmptyInput(): CalculatorInput {
  return {
    symbol: "",
    existingShares: "",
    existingAvgCost: "",
    purchases: [createPurchase()],
    investmentCurrency: "USD",
    exchangeRate: "",
    fees: { enabled: false, percent: "", fixed: "" },
    marketPrice: "",
    priceMode: "manual",
    kind: "simulation",
  };
}
