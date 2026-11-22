"use client";

import { Calculator } from "lucide-react";
import { Segmented } from "@/components/form/segmented";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Currency } from "@/lib/calculator/types";

export function AppHeader({
  displayCurrency,
  onDisplayCurrencyChange,
}: {
  displayCurrency: Currency;
  onDisplayCurrencyChange: (c: Currency) => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Calculator className="size-4" />
          </span>
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
            คำนวณต้นทุนเฉลี่ยหุ้น
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Segmented<Currency>
            ariaLabel="แสดงผลลัพธ์เป็นสกุลเงิน"
            size="sm"
            value={displayCurrency}
            onChange={onDisplayCurrencyChange}
            options={[
              { value: "USD", label: "USD", title: "แสดงผลเป็นดอลลาร์สหรัฐ" },
              { value: "THB", label: "THB", title: "แสดงผลเป็นเงินบาท (ต้องกรอกอัตราแลกเปลี่ยน)" },
            ]}
          />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
