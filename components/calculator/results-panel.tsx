"use client";

import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CalculationResult, CalculatorInput, Currency } from "@/lib/calculator/types";
import {
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { CalculationExplanation } from "./calculation-explanation";

interface ResultsPanelProps {
  input: CalculatorInput;
  result: CalculationResult;
  displayCurrency: Currency;
}

export function ResultsPanel({ input, result, displayCurrency }: ResultsPanelProps) {
  // THB display needs a valid rate; otherwise fall back to USD and say so.
  const thbUnavailable = displayCurrency === "THB" && result.exchangeRate === null;
  const cur: Currency = thbUnavailable ? "USD" : displayCurrency;
  const rate = result.exchangeRate;
  const hasErrors = Object.keys(result.errors).length > 0;

  const reduction = result.avgCostReductionPct;
  const pnl = result.unrealizedPnlUsd;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              ผลลัพธ์{input.symbol && <span className="text-muted-foreground">· {input.symbol}</span>}
            </CardTitle>
            <CardDescription>คำนวณใหม่ทันทีเมื่อแก้ไขข้อมูล</CardDescription>
          </div>
          <Badge variant={input.kind === "actual" ? "default" : "outline"}>
            {input.kind === "actual" ? "ซื้อจริง" : "จำลอง"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        {thbUnavailable && (
          <Notice>กรอกอัตราแลกเปลี่ยนเพื่อดูผลลัพธ์เป็นเงินบาท ขณะนี้แสดงเป็น USD</Notice>
        )}

        {!result.ok ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {hasErrors
              ? "กรุณาแก้ไขช่องที่แจ้งเตือนเพื่อดูผลลัพธ์"
              : "กรอกหุ้นที่ถืออยู่ และ/หรือ รายการซื้อเพิ่ม (ราคาและจำนวนเงิน) เพื่อคำนวณต้นทุนเฉลี่ย"}
          </div>
        ) : (
          <>
            {/* Headline: new average cost */}
            <div className="rounded-xl border bg-primary/[0.03] p-4 dark:bg-primary/[0.06]">
              <p className="text-xs font-medium text-muted-foreground">
                ต้นทุนเฉลี่ยใหม่ต่อหุ้น
              </p>
              <p className="tabular mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                {formatPrice(result.newAvgCostUsd, cur, rate)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                  เดิม:{" "}
                  <span className="tabular font-medium text-foreground">
                    {result.oldAvgCostUsd === null ? "— (ซื้อครั้งแรก)" : formatPrice(result.oldAvgCostUsd, cur, rate)}
                  </span>
                </span>
                {reduction !== null && <ReductionPill pct={reduction} />}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              <Stat label="จำนวนหุ้นรวมหลังซื้อ" value={formatShares(result.totalShares)}>
                {result.additionalShares > 0 && (
                  <>+{formatShares(result.additionalShares)} หุ้นใหม่</>
                )}
              </Stat>
              <Stat label="เงินลงทุนรวม" value={formatMoney(result.totalInvestmentUsd, cur, rate)}>
                {result.totalFeesUsd > 0 && <>รวมค่าธรรมเนียม {formatMoney(result.totalFeesUsd, cur, rate)}</>}
              </Stat>
              <Stat label="เงินลงทุนเพิ่ม" value={formatMoney(result.additionalInvestmentUsd, cur, rate)} />
              <Stat
                label="ต้นทุนเฉลี่ยลดลง"
                value={formatPercent(reduction)}
                valueClassName={reduction === null ? undefined : reduction > 0 ? "text-gain" : reduction < 0 ? "text-loss" : undefined}
              >
                {reduction !== null && reduction < 0 && <>ต้นทุนเฉลี่ยสูงขึ้น</>}
              </Stat>
            </dl>

            <Separator />

            {/* Market value & P/L */}
            {result.marketPriceUsd === null ? (
              <p className="text-sm text-muted-foreground">
                ใส่ราคาตลาดปัจจุบัน (กรอกเองหรืออัตโนมัติ) เพื่อดูมูลค่าตลาดและกำไร/ขาดทุนที่ยังไม่รับรู้
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-3">
                <Stat label="ราคาตลาด" value={formatPrice(result.marketPriceUsd, cur, rate)} />
                <Stat label="มูลค่าตลาดปัจจุบัน" value={formatMoney(result.marketValueUsd, cur, rate)} />
                <Stat
                  label="กำไร/ขาดทุนที่ยังไม่รับรู้"
                  value={formatSignedMoney(pnl, cur, rate)}
                  valueClassName={pnlClass(pnl)}
                />
                <Stat
                  label="กำไร/ขาดทุน (%)"
                  value={formatPercent(result.unrealizedPnlPct, { signed: true })}
                  valueClassName={pnlClass(pnl)}
                />
              </dl>
            )}

            {input.kind === "simulation" && (
              <p className="text-xs text-muted-foreground">
                รายการนี้เป็น<strong>การจำลองสถานการณ์</strong> ไม่ใช่บันทึกการซื้อขายจริง
              </p>
            )}

            <CalculationExplanation input={input} result={result} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function pnlClass(v: number | null) {
  if (v === null || v === 0) return undefined;
  return v > 0 ? "text-gain" : "text-loss";
}

function ReductionPill({ pct }: { pct: number }) {
  const down = pct > 0;
  const flat = Math.abs(pct) < 1e-9;
  const Icon = flat ? Minus : down ? ArrowDownRight : ArrowUpRight;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        flat ? "bg-muted text-muted-foreground" : down ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss",
      )}
    >
      <Icon className="size-3.5" />
      {flat ? "ไม่เปลี่ยนแปลง" : `${down ? "ลดลง" : "สูงขึ้น"} ${formatPercent(Math.abs(pct))}`}
    </span>
  );
}

function Stat({
  label,
  value,
  valueClassName,
  children,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular mt-1 text-base font-semibold break-all sm:text-lg", valueClassName)}>{value}</dd>
      {children && <dd className="tabular text-xs text-muted-foreground">{children}</dd>}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
