"use client";

import { AlertTriangle, ArrowDownToLine, Clock, Loader2, PlugZap, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { StockQuoteState } from "@/hooks/use-stock-quote";
import type { CalculatorInput } from "@/lib/calculator/types";
import { formatDateTime, formatPrice } from "@/lib/format";

interface AutoPricePanelProps {
  input: CalculatorInput;
  quoteState: StockQuoteState;
  onSwitchToManual: () => void;
  onUseAsPurchasePrice: (price: number) => void;
}

export function AutoPricePanel({ input, quoteState, onSwitchToManual, onUseAsPurchasePrice }: AutoPricePanelProps) {
  const { status, quote, error, loading, autoRefresh, setAutoRefresh, refresh } = quoteState;

  if (!status) {
    return (
      <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> กำลังตรวจสอบผู้ให้บริการราคา…
      </p>
    );
  }

  if (!status.enabled) {
    return (
      <Alert>
        <PlugZap />
        <AlertTitle>ยังไม่เปิดใช้ราคาอัตโนมัติ</AlertTitle>
        <AlertDescription className="grid gap-2">
          <p>
            {status.reason} คุณยังใช้งานได้ครบทุกฟีเจอร์โดยกรอกราคาเอง เครื่องคำนวณนี้ไม่จำเป็นต้องใช้ API ราคาหุ้น
          </p>
          <Button variant="outline" size="sm" className="w-fit" onClick={onSwitchToManual}>
            กรอกราคาเอง
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const symbol = input.symbol;

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">ราคาล่าสุดที่มี{symbol && ` · ${symbol}`}</p>
          <p className="tabular text-2xl font-semibold">
            {quote ? formatPrice(quote.price) : loading ? "…" : "—"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading || !symbol}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} รีเฟรช
        </Button>
      </div>

      {!symbol && <p className="text-sm text-muted-foreground">กรอกชื่อย่อหุ้นด้านบนเพื่อดึงราคา</p>}

      {quote && (
        <div className="grid gap-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            เวลาของราคา: {quote.asOf ? formatDateTime(quote.asOf) : "ไม่ระบุ"} · อัปเดตล่าสุด:{" "}
            {formatDateTime(quote.fetchedAt)}
          </p>
          <p>
            {quote.dataNote} แหล่งข้อมูล:{" "}
            <a href={status.attributionUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {quote.provider}
            </a>
            {" "}· ใช้เป็นราคาตลาดสำหรับคำนวณกำไร/ขาดทุน
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {error.message}
            {quote && " กำลังแสดงราคาล่าสุดที่ดึงได้สำเร็จ"}
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch id="auto-refresh" size="sm" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          <Label htmlFor="auto-refresh" className="text-xs font-normal">
            รีเฟรชอัตโนมัติทุก {status.autoRefreshMinutes} นาที
          </Label>
        </div>
        <Button size="sm" variant="secondary" disabled={!quote} onClick={() => quote && onUseAsPurchasePrice(quote.price)}>
          <ArrowDownToLine /> ใช้เป็นราคาซื้อ
        </Button>
      </div>
    </div>
  );
}
