"use client";

import { useCallback, useSyncExternalStore } from "react";
import { newId } from "@/lib/calculator/defaults";
import type { CalculatorInput } from "@/lib/calculator/types";
import { sanitizeHistory, STORAGE_KEYS, type SavedCalculation } from "@/lib/storage/history";
import { writeJson } from "@/lib/storage/local-store";

/**
 * Saved calculations persisted in this browser's LocalStorage, exposed as an
 * external store. Data is per device + per browser; nothing is sent to a server.
 */

const EMPTY: SavedCalculation[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedItems: SavedCalculation[] = EMPTY;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.history);
  } catch {
    return null;
  }
}

function getSnapshot(): SavedCalculation[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      /* corrupt data → treated as empty */
    }
    cachedItems = sanitizeHistory(parsed);
  }
  return cachedItems;
}

function getServerSnapshot(): SavedCalculation[] {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // `storage` fires when another tab changes LocalStorage.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEYS.history) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function commit(next: SavedCalculation[]): boolean {
  const ok = writeJson(STORAGE_KEYS.history, next);
  if (ok) listeners.forEach((l) => l());
  return ok;
}

export function useSavedCalculations() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((name: string, input: CalculatorInput): SavedCalculation | null => {
    const now = new Date().toISOString();
    const record: SavedCalculation = {
      id: newId(),
      name: name.trim() || input.symbol || "ไม่มีชื่อ",
      input: structuredClone(input),
      createdAt: now,
      updatedAt: now,
    };
    return commit([record, ...getSnapshot()]) ? record : null;
  }, []);

  const update = useCallback((id: string, name: string, input: CalculatorInput): boolean => {
    const now = new Date().toISOString();
    return commit(
      getSnapshot().map((r) =>
        r.id === id
          ? { ...r, name: name.trim() || input.symbol || "ไม่มีชื่อ", input: structuredClone(input), updatedAt: now }
          : r,
      ),
    );
  }, []);

  const remove = useCallback((id: string): boolean => commit(getSnapshot().filter((r) => r.id !== id)), []);

  return { items, add, update, remove };
}
