import { describe, expect, it } from "vitest";
import { createEmptyInput } from "./calculator/defaults";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell("plain")).toBe("plain");
  });

  it("neutralises formula injection in text cells only", () => {
    expect(csvCell("=HYPERLINK(1)", { text: true })).toBe("'=HYPERLINK(1)");
    expect(csvCell("-5")).toBe("-5");
  });
});

describe("toCsv", () => {
  it("exports calculated values in USD", () => {
    const input = {
      ...createEmptyInput(),
      symbol: "NVDA",
      existingShares: "100",
      existingAvgCost: "50",
      marketPrice: "45",
      purchases: [{ id: "p1", price: "40", amount: "1000" }],
    };
    const lines = toCsv([{ name: "Test, one", input, savedAt: "2026-11-22T00:00:00.000Z" }]).split("\r\n");
    expect(lines).toHaveLength(2);
    const cells = lines[1];
    expect(cells.startsWith('"Test, one",จำลอง,NVDA,100,50,5000,1,40 x 1000,1000,0,25,125,6000,48,4,45,5625,-375,-6.25,USD,')).toBe(true);
    expect(cells.endsWith("2026-11-22T00:00:00.000Z,สมบูรณ์")).toBe(true);
  });
});
