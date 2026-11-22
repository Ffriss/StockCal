import { calculate } from "@/lib/calculator/calculate";
import type { CalculatorInput } from "@/lib/calculator/types";

export interface CsvRow {
  name: string;
  savedAt?: string;
  input: CalculatorInput;
}

const HEADERS = [
  "ชื่อรายการ",
  "ประเภท",
  "ชื่อย่อหุ้น",
  "จำนวนหุ้นเดิม",
  "ต้นทุนเฉลี่ยเดิม (USD)",
  "ต้นทุนเดิม (USD)",
  "จำนวนรายการซื้อ",
  "รายละเอียดการซื้อ (ราคา USD x จำนวนเงิน USD)",
  "เงินลงทุนเพิ่ม (USD)",
  "ค่าธรรมเนียม (USD)",
  "จำนวนหุ้นที่ซื้อเพิ่ม",
  "จำนวนหุ้นรวม",
  "เงินลงทุนรวม (USD)",
  "ต้นทุนเฉลี่ยใหม่ (USD)",
  "ต้นทุนเฉลี่ยลดลง (%)",
  "ราคาตลาด (USD)",
  "มูลค่าตลาด (USD)",
  "กำไร/ขาดทุนที่ยังไม่รับรู้ (USD)",
  "กำไร/ขาดทุนที่ยังไม่รับรู้ (%)",
  "สกุลเงินที่กรอก",
  "อัตราแลกเปลี่ยน (บาท/USD)",
  "วันที่บันทึก",
  "สถานะ",
];

/** Up to 6 decimals, no thousands separators, no trailing zeros. */
function num(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return String(Number(v.toFixed(6)));
}

/**
 * Quote a cell per RFC 4180 and neutralise spreadsheet formula injection
 * for free-text cells (names/symbols starting with = + - @).
 */
export function csvCell(value: string, { text = false } = {}): string {
  let v = value;
  if (text && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: CsvRow[]): string {
  const lines = [HEADERS.map((h) => csvCell(h)).join(",")];
  for (const row of rows) {
    const r = calculate(row.input);
    const details = r.purchases.map((p) => `${num(p.priceUsd)} x ${num(p.amountUsd)}`).join("; ");
    const cells: [string, boolean][] = [
      [row.name, true],
      [row.input.kind === "actual" ? "ซื้อจริง" : "จำลอง", false],
      [row.input.symbol, true],
      [num(r.existingShares), false],
      [num(r.oldAvgCostUsd), false],
      [num(r.originalCostUsd), false],
      [String(r.purchases.length), false],
      [details, false],
      [num(r.additionalInvestmentUsd), false],
      [num(r.totalFeesUsd), false],
      [num(r.additionalShares), false],
      [num(r.ok ? r.totalShares : null), false],
      [num(r.ok ? r.totalInvestmentUsd : null), false],
      [num(r.newAvgCostUsd), false],
      [num(r.avgCostReductionPct), false],
      [num(r.marketPriceUsd), false],
      [num(r.marketValueUsd), false],
      [num(r.unrealizedPnlUsd), false],
      [num(r.unrealizedPnlPct), false],
      [row.input.investmentCurrency, false],
      [num(r.exchangeRate), false],
      [row.savedAt ?? "", false],
      [r.ok ? "สมบูรณ์" : "ข้อมูลไม่ครบหรือไม่ถูกต้อง", false],
    ];
    lines.push(cells.map(([v, text]) => csvCell(v, { text })).join(","));
  }
  return lines.join("\r\n");
}

/** Trigger a browser download. UTF-8 BOM so Excel opens it correctly. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
