"use client";

import { ChevronDown } from "lucide-react";
import type { CalculationResult, CalculatorInput } from "@/lib/calculator/types";
import { formatMoney, formatPercent, formatPrice, formatShares } from "@/lib/format";

/**
 * Step-by-step breakdown with the user's own numbers plugged in.
 * Always shown in USD because that is the currency the math is done in.
 */
export function CalculationExplanation({
  input,
  result: r,
}: {
  input: CalculatorInput;
  result: CalculationResult;
}) {
  const thb = input.investmentCurrency === "THB";

  return (
    <details className="group rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-medium select-none">
        วิธีคำนวณ
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t p-3 text-xs leading-relaxed">
        <p className="text-muted-foreground">
          คำนวณทั้งหมดเป็น USD ด้วยความละเอียดเต็ม และปัดเศษเฉพาะตอนแสดงผลเท่านั้น
          {thb && r.exchangeRate !== null && (
            <> จำนวนเงินบาทถูกแปลงเป็น USD ก่อนคำนวณ ที่อัตรา {r.exchangeRate} บาท = 1 USD</>
          )}
        </p>

        <Step title="1. ต้นทุนเดิม">
          {formatShares(r.existingShares)} หุ้น × {formatPrice(r.oldAvgCostUsd ?? 0)} ={" "}
          <b>{formatMoney(r.originalCostUsd)}</b>
        </Step>

        <Step title="2. จำนวนหุ้นที่ซื้อเพิ่ม">
          {r.purchases.length === 0 ? (
            "ยังไม่มีรายการซื้อเพิ่ม"
          ) : (
            <ul className="grid gap-0.5">
              {r.purchases.map((p) => (
                <li key={p.id}>
                  {r.purchases.length > 1 && <>#{p.index + 1}: </>}
                  {formatMoney(p.amountUsd)} ÷ {formatPrice(p.priceUsd)} = <b>{formatShares(p.shares)} หุ้น</b>
                </li>
              ))}
            </ul>
          )}
        </Step>

        {r.totalFeesUsd > 0 && (
          <Step title="ค่าธรรมเนียม">
            ค่าธรรมเนียมรวม = <b>{formatMoney(r.totalFeesUsd)}</b> (บวกเข้าต้นทุน ไม่เพิ่มจำนวนหุ้น)
          </Step>
        )}

        <Step title="3. จำนวนหุ้นรวมใหม่">
          {formatShares(r.existingShares)} + {formatShares(r.additionalShares)} ={" "}
          <b>{formatShares(r.totalShares)}</b>
        </Step>

        <Step title="4. ต้นทุนเฉลี่ยใหม่">
          ({formatMoney(r.originalCostUsd)} + {formatMoney(r.additionalInvestmentUsd)}
          {r.totalFeesUsd > 0 && <> + ค่าธรรมเนียม {formatMoney(r.totalFeesUsd)}</>}) ÷ {formatShares(r.totalShares)} ={" "}
          <b>{formatPrice(r.newAvgCostUsd)}</b>
        </Step>

        {r.avgCostReductionPct !== null && (
          <Step title="5. ต้นทุนเฉลี่ยลดลง">
            ({formatPrice(r.oldAvgCostUsd)} − {formatPrice(r.newAvgCostUsd)}) ÷ {formatPrice(r.oldAvgCostUsd)} ={" "}
            <b>{formatPercent(r.avgCostReductionPct)}</b>
          </Step>
        )}

        {r.marketPriceUsd !== null && (
          <Step title="6. กำไร/ขาดทุนที่ยังไม่รับรู้">
            {formatShares(r.totalShares)} × {formatPrice(r.marketPriceUsd)} − {formatMoney(r.totalInvestmentUsd)} ={" "}
            <b>{formatMoney(r.unrealizedPnlUsd)}</b>
          </Step>
        )}
      </div>
    </details>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <div className="tabular text-muted-foreground">{children}</div>
    </div>
  );
}
