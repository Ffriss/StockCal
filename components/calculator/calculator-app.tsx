"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { HistoryPanel } from "@/components/history/history-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSavedCalculations } from "@/hooks/use-saved-calculations";
import { useStockQuote } from "@/hooks/use-stock-quote";
import { calculate } from "@/lib/calculator/calculate";
import { createEmptyInput, createPurchase, newId } from "@/lib/calculator/defaults";
import type { CalculatorInput, Currency, PurchaseInput } from "@/lib/calculator/types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { sanitizeCurrency, sanitizeInput, STORAGE_KEYS, type SavedCalculation } from "@/lib/storage/history";
import { readJson, writeJson } from "@/lib/storage/local-store";
import type { StockQuote } from "@/lib/stock-price/types";
import { AutoPricePanel } from "./auto-price-panel";
import { CalculatorForm } from "./calculator-form";
import { ResultsPanel } from "./results-panel";

interface Draft {
  input: CalculatorInput;
  editingId: string | null;
}

function loadDraft(): Draft {
  const draft = readJson<Partial<Draft>>(STORAGE_KEYS.draft);
  return {
    input: draft?.input ? sanitizeInput(draft.input) : createEmptyInput(),
    editingId: typeof draft?.editingId === "string" ? draft.editingId : null,
  };
}

/**
 * Everything on this page depends on browser-only state (LocalStorage), so the
 * interactive workspace mounts right after hydration. The server renders a
 * lightweight shell to avoid layout shift.
 */
export function CalculatorApp() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <>
        <AppHeader displayCurrency="USD" onDisplayCurrencyChange={() => {}} />
        <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6" aria-busy="true">
          <div className="h-8" />
          <div className="grid items-start gap-6 lg:grid-cols-12">
            <div className="h-[36rem] animate-pulse rounded-xl bg-muted/50 lg:col-span-7" />
            <div className="h-80 animate-pulse rounded-xl bg-muted/50 lg:col-span-5" />
          </div>
        </main>
      </>
    );
  }
  return <CalculatorWorkspace initialDraft={loadDraft()} />;
}

function CalculatorWorkspace({ initialDraft }: { initialDraft: Draft }) {
  const [input, setInput] = useState<CalculatorInput>(initialDraft.input);
  const [editingId, setEditingId] = useState<string | null>(initialDraft.editingId);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(() =>
    sanitizeCurrency(readJson(STORAGE_KEYS.displayCurrency)),
  );
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const history = useSavedCalculations();
  const result = useMemo(() => calculate(input), [input]);
  // If the record was deleted (here or in another tab) we are simply no longer editing it.
  const editingItem = editingId ? (history.items.find((i) => i.id === editingId) ?? null) : null;

  // ---- Auto Price: a fetched quote becomes the market price for P/L --------
  const onQuote = useCallback(
    (q: StockQuote) => setInput((prev) => (prev.symbol === q.symbol ? { ...prev, marketPrice: String(q.price) } : prev)),
    [],
  );
  const quoteState = useStockQuote(input.symbol, input.priceMode === "auto", onQuote);

  /** Fill the first purchase row without a price (or the last row). */
  const applyQuoteAsPurchasePrice = (price: number) => {
    setInput((prev) => {
      const target = prev.purchases.find((p) => !p.price.trim()) ?? prev.purchases[prev.purchases.length - 1];
      return {
        ...prev,
        purchases: prev.purchases.map((p) => (p.id === target.id ? { ...p, price: String(price) } : p)),
      };
    });
    toast("ใส่ราคาซื้อจากราคาล่าสุดที่มีแล้ว");
  };

  // ---- Persist the in-progress draft (debounced) --------------------------
  useEffect(() => {
    const t = setTimeout(() => writeJson(STORAGE_KEYS.draft, { input, editingId } satisfies Draft), 300);
    return () => clearTimeout(t);
  }, [input, editingId]);

  const changeDisplayCurrency = (c: Currency) => {
    setDisplayCurrency(c);
    writeJson(STORAGE_KEYS.displayCurrency, c);
  };

  // ---- Form updates --------------------------------------------------------
  const onChange = useCallback((patch: Partial<CalculatorInput>) => setInput((prev) => ({ ...prev, ...patch })), []);
  const onPurchaseChange = useCallback(
    (id: string, patch: Partial<PurchaseInput>) =>
      setInput((prev) => ({
        ...prev,
        purchases: prev.purchases.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      })),
    [],
  );
  const onAddPurchase = useCallback(
    () => setInput((prev) => ({ ...prev, purchases: [...prev.purchases, createPurchase()] })),
    [],
  );
  const onRemovePurchase = useCallback(
    (id: string) =>
      setInput((prev) => ({
        ...prev,
        purchases: prev.purchases.length > 1 ? prev.purchases.filter((p) => p.id !== id) : prev.purchases,
      })),
    [],
  );

  // ---- Actions -------------------------------------------------------------
  const reset = () => {
    setInput(createEmptyInput());
    setEditingId(null);
    toast("ล้างค่าเครื่องคำนวณแล้ว");
  };

  const openSaveDialog = () => {
    const date = new Date().toLocaleDateString("th-TH", { month: "short", day: "numeric" });
    const kind = input.kind === "actual" ? "ซื้อจริง" : "จำลอง";
    setSaveName(`${input.symbol || "ไม่มีชื่อ"} · ${kind} · ${date}`);
    setSaveOpen(true);
  };

  const saveAsNew = () => {
    const rec = history.add(saveName, input);
    setSaveOpen(false);
    if (!rec) return toast.error("บันทึกไม่สำเร็จ พื้นที่จัดเก็บของเบราว์เซอร์อาจเต็มหรือถูกปิดใช้งาน");
    setEditingId(rec.id);
    toast.success(`บันทึก “${rec.name}” แล้ว`);
  };

  const updateExisting = () => {
    if (!editingItem) return;
    if (history.update(editingItem.id, editingItem.name, input)) toast.success(`อัปเดต “${editingItem.name}” แล้ว`);
    else toast.error("บันทึกไม่สำเร็จ พื้นที่จัดเก็บของเบราว์เซอร์อาจเต็มหรือถูกปิดใช้งาน");
  };

  const loadForEdit = (item: SavedCalculation) => {
    setInput(sanitizeInput(structuredClone(item.input)));
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast(`กำลังแก้ไข “${item.name}”`);
  };

  const duplicate = (item: SavedCalculation) => {
    const copy = sanitizeInput(structuredClone(item.input));
    copy.purchases = copy.purchases.map((p) => ({ ...p, id: newId() }));
    setInput(copy);
    setEditingId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast(`โหลดสำเนาของ “${item.name}” เป็นรายการใหม่แล้ว`);
  };

  const remove = (item: SavedCalculation) => {
    if (!history.remove(item.id)) return toast.error("ลบออกจากพื้นที่จัดเก็บของเบราว์เซอร์ไม่สำเร็จ");
    if (item.id === editingId) setEditingId(null);
    toast(`ลบ “${item.name}” แล้ว`);
  };

  const exportCsv = (items: SavedCalculation[]) => {
    const csv = toCsv(items.map((i) => ({ name: i.name, input: i.input, savedAt: i.updatedAt })));
    downloadCsv(`stock-average-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const exportCurrent = () => {
    const csv = toCsv([{ name: editingItem?.name ?? (input.symbol || "รายการปัจจุบัน"), input }]);
    downloadCsv(`${input.symbol || "calculation"}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <>
      <AppHeader displayCurrency={displayCurrency} onDisplayCurrencyChange={changeDisplayCurrency} />

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2">
          {editingItem ? (
            <p className="mr-auto min-w-0 text-sm text-muted-foreground">
              กำลังแก้ไข <span className="font-medium text-foreground">&ldquo;{editingItem.name}&rdquo;</span>
            </p>
          ) : (
            <p className="mr-auto text-sm text-muted-foreground">รายการคำนวณใหม่</p>
          )}
          {editingItem && (
            <Button onClick={updateExisting}>
              <Save /> อัปเดตรายการ
            </Button>
          )}
          <Button variant={editingItem ? "outline" : "default"} onClick={openSaveDialog}>
            {editingItem ? <FilePlus2 /> : <Save />} {editingItem ? "บันทึกเป็นรายการใหม่" : "บันทึก"}
          </Button>
          <Button variant="outline" onClick={exportCurrent} disabled={!result.ok}>
            ส่งออก CSV
          </Button>
          <Button variant="ghost" onClick={reset}>
            <RotateCcw /> ล้างค่า
          </Button>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <section aria-label="ข้อมูลสำหรับคำนวณ" className="lg:col-span-7">
            <CalculatorForm
              input={input}
              result={result}
              onChange={onChange}
              onPurchaseChange={onPurchaseChange}
              onAddPurchase={onAddPurchase}
              onRemovePurchase={onRemovePurchase}
              autoPricePanel={
                <AutoPricePanel
                  input={input}
                  quoteState={quoteState}
                  onSwitchToManual={() => onChange({ priceMode: "manual" })}
                  onUseAsPurchasePrice={applyQuoteAsPurchasePrice}
                />
              }
            />
          </section>
          <section aria-label="ผลลัพธ์" className="lg:sticky lg:top-20 lg:col-span-5">
            <ResultsPanel input={input} result={result} displayCurrency={displayCurrency} />
          </section>
        </div>

        <HistoryPanel
          items={history.items}
          editingId={editingItem?.id ?? null}
          displayCurrency={displayCurrency}
          onEdit={loadForEdit}
          onDuplicate={duplicate}
          onDelete={remove}
          onExport={exportCsv}
        />
      </main>

      <footer className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          ใช้สำหรับวางแผนส่วนตัวเท่านั้น ไม่ใช่คำแนะนำการลงทุน การคำนวณทั้งหมดทำในเบราว์เซอร์ของคุณ
        </p>
      </footer>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveAsNew();
            }}
          >
            <DialogHeader>
              <DialogTitle>บันทึกรายการคำนวณ</DialogTitle>
              <DialogDescription>
                บันทึกไว้ในเบราว์เซอร์นี้เท่านั้น ({input.kind === "actual" ? "ซื้อจริง" : "จำลอง"})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="save-name">ชื่อรายการ</Label>
              <Input id="save-name" value={saveName} onChange={(e) => setSaveName(e.target.value)} autoFocus />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
              <Button type="submit">
                <Save /> บันทึก
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
