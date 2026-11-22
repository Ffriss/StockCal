"use client";

import { useMemo, useState } from "react";
import { Copy, Download, HardDrive, Pencil, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Segmented } from "@/components/form/segmented";
import { calculate } from "@/lib/calculator/calculate";
import type { Currency, RecordKind } from "@/lib/calculator/types";
import { formatDateTime, formatPercent, formatPrice, formatShares } from "@/lib/format";
import type { SavedCalculation } from "@/lib/storage/history";
import { cn } from "@/lib/utils";

interface HistoryPanelProps {
  items: SavedCalculation[];
  editingId: string | null;
  displayCurrency: Currency;
  onEdit: (item: SavedCalculation) => void;
  onDuplicate: (item: SavedCalculation) => void;
  onDelete: (item: SavedCalculation) => void;
  onExport: (items: SavedCalculation[]) => void;
}

type KindFilter = "all" | RecordKind;

export function HistoryPanel({
  items,
  editingId,
  displayCurrency,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
}: HistoryPanelProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<SavedCalculation | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return items.filter(
      (it) =>
        (kind === "all" || it.input.kind === kind) &&
        (!q || it.input.symbol.includes(q) || it.name.toUpperCase().includes(q)),
    );
  }, [items, query, kind]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>รายการที่บันทึกไว้</CardTitle>
        <CardDescription>
          บันทึกไว้ {items.length} รายการ · เก็บในเบราว์เซอร์นี้เท่านั้น
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={filtered.length === 0}
            onClick={() => onExport(filtered)}
          >
            <Download /> ส่งออก CSV
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-3">
        {items.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาตามชื่อย่อหุ้นหรือชื่อรายการ"
                aria-label="ค้นหารายการที่บันทึกไว้"
                className="h-9 pl-8"
              />
            </div>
            <Segmented<KindFilter>
              ariaLabel="กรองตามประเภท"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "ทั้งหมด" },
                { value: "actual", label: "ซื้อจริง" },
                { value: "simulation", label: "จำลอง" },
              ]}
            />
          </div>
        )}

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีรายการที่บันทึกไว้ กด <strong>บันทึก</strong> เพื่อเก็บรายการคำนวณไว้ดูภายหลัง
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">ไม่พบรายการที่ตรงกัน</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {filtered.map((item) => (
              <HistoryItem
                key={item.id}
                item={item}
                active={item.id === editingId}
                displayCurrency={displayCurrency}
                onEdit={() => onEdit(item)}
                onDuplicate={() => onDuplicate(item)}
                onDelete={() => setPendingDelete(item)}
              />
            ))}
          </ul>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <HardDrive className="mt-0.5 size-3.5 shrink-0" />
          ข้อมูลที่บันทึกจะเก็บใน LocalStorage ของเบราว์เซอร์นี้บนอุปกรณ์นี้เท่านั้น ไม่ซิงก์ไปยังอุปกรณ์หรือเบราว์เซอร์อื่น
          และจะหายไปหากล้างข้อมูลเว็บไซต์ แนะนำให้ส่งออก CSV เพื่อสำรองข้อมูล
        </p>
      </CardContent>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบรายการที่บันทึกไว้?</DialogTitle>
            <DialogDescription>
              &ldquo;{pendingDelete?.name}&rdquo; จะถูกลบออกจากเบราว์เซอร์นี้ และไม่สามารถกู้คืนได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>ยกเลิก</DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete);
                setPendingDelete(null);
              }}
            >
              <Trash2 /> ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function HistoryItem({
  item,
  active,
  displayCurrency,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  item: SavedCalculation;
  active: boolean;
  displayCurrency: Currency;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const r = useMemo(() => calculate(item.input), [item.input]);
  const thbOk = displayCurrency === "THB" && r.exchangeRate !== null;
  const cur: Currency = thbOk ? "THB" : "USD";

  return (
    <li
      className={cn(
        "grid gap-2 rounded-lg border p-3 transition-colors",
        active && "border-primary/60 bg-muted/40 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">อัปเดต {formatDateTime(item.updatedAt)}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {item.input.symbol && <Badge variant="secondary">{item.input.symbol}</Badge>}
          <Badge variant={item.input.kind === "actual" ? "default" : "outline"}>
            {item.input.kind === "actual" ? "ซื้อจริง" : "จำลอง"}
          </Badge>
        </div>
      </div>

      {r.ok ? (
        <dl className="tabular grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">ต้นทุนเฉลี่ยใหม่</dt>
            <dd className="font-semibold">{formatPrice(r.newAvgCostUsd, cur, r.exchangeRate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">จำนวนหุ้น</dt>
            <dd className="font-semibold">{formatShares(r.totalShares)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ลดลง</dt>
            <dd className="font-semibold">{formatPercent(r.avgCostReductionPct)}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">ข้อมูลยังไม่ครบ</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant={active ? "secondary" : "outline"} onClick={onEdit}>
          <Pencil /> {active ? "กำลังแก้ไข" : "แก้ไข"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDuplicate} title="โหลดเป็นรายการคำนวณใหม่">
          <Copy /> ทำสำเนา
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={onDelete}>
          <Trash2 /> ลบ
        </Button>
      </div>
    </li>
  );
}
