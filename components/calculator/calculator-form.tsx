"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumberField } from "@/components/form/number-field";
import { Segmented } from "@/components/form/segmented";
import { normalizeSymbol } from "@/lib/calculator/parse";
import type {
  CalculationResult,
  CalculatorInput,
  Currency,
  PriceMode,
  PurchaseInput,
  RecordKind,
} from "@/lib/calculator/types";
import { formatShares } from "@/lib/format";

export interface CalculatorFormProps {
  input: CalculatorInput;
  result: CalculationResult;
  onChange: (patch: Partial<CalculatorInput>) => void;
  onPurchaseChange: (id: string, patch: Partial<PurchaseInput>) => void;
  onAddPurchase: () => void;
  onRemovePurchase: (id: string) => void;
  /** Rendered inside the "Auto price" tab. */
  autoPricePanel: ReactNode;
}

export function CalculatorForm({
  input,
  result,
  onChange,
  onPurchaseChange,
  onAddPurchase,
  onRemovePurchase,
  autoPricePanel,
}: CalculatorFormProps) {
  const { errors } = result;
  const amountUnit = input.investmentCurrency;

  return (
    <div className="grid gap-4">
      {/* ---------------- Stock + record type ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>หุ้น</CardTitle>
          <CardDescription>
            รายการนี้เป็นการจำลองสถานการณ์ หรือเป็นการซื้อที่เกิดขึ้นจริง?
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="symbol">ชื่อย่อหุ้น (Ticker)</Label>
            <Input
              id="symbol"
              value={input.symbol}
              placeholder="เช่น NVDA"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) =>
                onChange({
                  symbol: normalizeSymbol(e.target.value),
                  // An auto-fetched price belongs to the old symbol; drop it.
                  ...(input.priceMode === "auto" ? { marketPrice: "" } : {}),
                })
              }
              className="h-10 text-base font-medium tracking-wide uppercase placeholder:font-normal placeholder:tracking-normal placeholder:normal-case sm:text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">ประเภทรายการ</span>
            <Segmented<RecordKind>
              ariaLabel="ประเภทรายการ"
              value={input.kind}
              onChange={(kind) => onChange({ kind })}
              options={[
                { value: "simulation", label: "จำลอง", title: "สมมติว่าซื้อเพิ่ม (ยังไม่ได้ซื้อจริง)" },
                { value: "actual", label: "ซื้อจริง", title: "รายการที่ซื้อไปแล้วจริง" },
              ]}
              className="h-10 w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Existing position ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>หุ้นที่ถืออยู่</CardTitle>
          <CardDescription>เว้นว่างได้ หากเป็นการซื้อหุ้นตัวนี้ครั้งแรก</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="จำนวนหุ้นที่ถืออยู่"
            value={input.existingShares}
            onChange={(existingShares) => onChange({ existingShares })}
            error={errors.existingShares}
            hint="รองรับหุ้นแบบเศษส่วน (Fractional shares)"
          />
          <NumberField
            label="ต้นทุนเฉลี่ยต่อหุ้น"
            value={input.existingAvgCost}
            onChange={(existingAvgCost) => onChange({ existingAvgCost })}
            error={errors.existingAvgCost}
            prefix="$"
            suffix="USD"
          />
        </CardContent>
      </Card>

      {/* ---------------- Additional purchases ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>ซื้อเพิ่ม</CardTitle>
          <CardDescription>ราคาหุ้นเป็น USD ต่อหุ้น ส่วนจำนวนเงินลงทุนกรอกได้ทั้ง USD และบาท</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {/* Price source */}
          <Tabs
            value={input.priceMode}
            onValueChange={(v) => onChange({ priceMode: v as PriceMode })}
          >
            <TabsList className="w-full sm:w-fit">
              <TabsTrigger value="manual">กรอกราคาเอง</TabsTrigger>
              <TabsTrigger value="auto">ราคาอัตโนมัติ</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="pt-2">
              <NumberField
                label="ราคาตลาดปัจจุบัน (ไม่บังคับ)"
                value={input.marketPrice}
                onChange={(marketPrice) => onChange({ marketPrice })}
                error={errors.marketPrice}
                prefix="$"
                suffix="USD"
                placeholder="ใช้คำนวณมูลค่าตลาดและกำไร/ขาดทุน"
                hint="กรอกเพื่อดูมูลค่าตลาดและกำไร/ขาดทุนที่ยังไม่รับรู้"
              />
            </TabsContent>
            <TabsContent value="auto" className="pt-2">
              {autoPricePanel}
            </TabsContent>
          </Tabs>

          {/* Currency */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">สกุลเงินของจำนวนเงินลงทุน</span>
              <Segmented<Currency>
                ariaLabel="สกุลเงินของจำนวนเงินลงทุน"
                value={input.investmentCurrency}
                onChange={(investmentCurrency) => onChange({ investmentCurrency })}
                options={[
                  { value: "USD", label: "ดอลลาร์ (USD)" },
                  { value: "THB", label: "บาท (THB)" },
                ]}
                className="h-10 w-full"
              />
            </div>
            <NumberField
              label="อัตราแลกเปลี่ยน"
              value={input.exchangeRate}
              onChange={(exchangeRate) => onChange({ exchangeRate })}
              error={errors.exchangeRate}
              suffix="บาท/USD"
              placeholder="เช่น 32.50"
              hint={
                input.investmentCurrency === "THB"
                  ? "จำเป็น: ใช้แปลงจำนวนเงินบาทเป็น USD"
                  : "ไม่บังคับ: ใช้เมื่อต้องการดูผลลัพธ์เป็นเงินบาท"
              }
            />
          </div>

          {/* Purchase rows */}
          <div className="grid gap-3">
            {input.purchases.map((p, i) => {
              const computed = result.purchases.find((r) => r.id === p.id);
              return (
                <fieldset key={p.id} className="grid gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <legend className="text-sm font-medium">
                      {input.purchases.length > 1 ? `การซื้อครั้งที่ ${i + 1}` : "การซื้อ"}
                    </legend>
                    <div className="flex items-center gap-2">
                      {computed && (
                        <span className="tabular text-xs text-muted-foreground">
                          ≈ {formatShares(computed.shares)} หุ้น
                        </span>
                      )}
                      {input.purchases.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`ลบการซื้อครั้งที่ ${i + 1}`}
                          onClick={() => onRemovePurchase(p.id)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NumberField
                      label="ราคาซื้อต่อหุ้น"
                      value={p.price}
                      onChange={(price) => onPurchaseChange(p.id, { price })}
                      error={errors[`purchase.${p.id}.price`]}
                      prefix="$"
                      suffix="USD"
                    />
                    <NumberField
                      label="จำนวนเงินลงทุน"
                      value={p.amount}
                      onChange={(amount) => onPurchaseChange(p.id, { amount })}
                      error={errors[`purchase.${p.id}.amount`]}
                      prefix={amountUnit === "USD" ? "$" : "฿"}
                      suffix={amountUnit}
                    />
                  </div>
                </fieldset>
              );
            })}
            <Button type="button" variant="outline" onClick={onAddPurchase} className="h-9 w-full sm:w-fit">
              <Plus /> เพิ่มการซื้ออีกรายการ
            </Button>
          </div>

          {/* Fees */}
          <div className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="fees-enabled">รวมค่าธรรมเนียมการซื้อขาย</Label>
                <p className="text-xs text-muted-foreground">
                  ปิดไว้เป็นค่าเริ่มต้น ค่าธรรมเนียมจะบวกเข้าต้นทุน ไม่ได้เพิ่มจำนวนหุ้น
                </p>
              </div>
              <Switch
                id="fees-enabled"
                checked={input.fees.enabled}
                onCheckedChange={(enabled) => onChange({ fees: { ...input.fees, enabled } })}
              />
            </div>
            {input.fees.enabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  label="ค่าธรรมเนียม (% ของแต่ละรายการ)"
                  value={input.fees.percent}
                  onChange={(percent) => onChange({ fees: { ...input.fees, percent } })}
                  error={errors.feePercent}
                  suffix="%"
                  placeholder="เช่น 0.15"
                />
                <NumberField
                  label="ค่าธรรมเนียมคงที่ต่อรายการ"
                  value={input.fees.fixed}
                  onChange={(fixed) => onChange({ fees: { ...input.fees, fixed } })}
                  error={errors.feeFixed}
                  prefix={amountUnit === "USD" ? "$" : "฿"}
                  suffix={amountUnit}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
