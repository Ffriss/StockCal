"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProviderStatus, fetchQuote } from "@/lib/stock-price/client";
import { isValidSymbol } from "@/lib/stock-price/symbol";
import type { ProviderStatus, QuoteApiResponse, StockQuote } from "@/lib/stock-price/types";

type QuoteError = Extract<QuoteApiResponse, { ok: false }>["error"];

export interface StockQuoteState {
  status: ProviderStatus | null; // null while checking
  quote: StockQuote | null;
  error: QuoteError | null;
  loading: boolean;
  autoRefresh: boolean;
  setAutoRefresh: (on: boolean) => void;
  refresh: () => void;
}

/**
 * Fetch quotes for `symbol` through our API route.
 * - `active` = Auto Price mode is selected. Nothing is fetched otherwise.
 * - Optional auto-refresh every N minutes (from the server status), paused
 *   while the browser tab is hidden.
 */
export function useStockQuote(symbol: string, active: boolean, onQuote: (q: StockQuote) => void): StockQuoteState {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  // Errors are tagged with the symbol they belong to, so a stale one is never shown.
  const [errorState, setErrorState] = useState<{ symbol: string; error: QuoteError } | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const onQuoteRef = useRef(onQuote);
  useEffect(() => {
    onQuoteRef.current = onQuote;
  }, [onQuote]);

  // Provider status: checked once, the first time Auto Price is opened.
  useEffect(() => {
    if (!active || status) return;
    const ac = new AbortController();
    fetchProviderStatus(ac.signal).then(setStatus, () => {});
    return () => ac.abort();
  }, [active, status]);

  const load = useCallback(async () => {
    if (!isValidSymbol(symbol)) {
      setErrorState({ symbol, error: { code: "INVALID_SYMBOL", message: "กรุณากรอกชื่อย่อหุ้นด้านบนให้ถูกต้อง เช่น NVDA" } });
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const res = await fetchQuote(symbol, ac.signal);
      if (res.ok) {
        setQuote(res.quote);
        setErrorState(null);
        onQuoteRef.current(res.quote);
      } else {
        setErrorState({ symbol, error: res.error });
        // Keep showing the last good quote for the same symbol (labelled with its timestamp).
      }
    } catch {
      /* aborted */
    } finally {
      if (abortRef.current === ac) setLoading(false);
    }
  }, [symbol]);

  // Fetch automatically when the symbol changes (debounced) in Auto mode.
  useEffect(() => {
    if (!active || !status?.enabled || !isValidSymbol(symbol)) return;
    const t = setTimeout(load, 600); // debounce typing
    return () => clearTimeout(t);
  }, [symbol, active, status?.enabled, load]);

  // Optional periodic refresh.
  useEffect(() => {
    if (!active || !autoRefresh || !status?.enabled) return;
    const ms = status.autoRefreshMinutes * 60_000;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, ms);
    return () => clearInterval(id);
  }, [active, autoRefresh, status, load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Only expose data that belongs to the current symbol.
  const currentQuote = quote && quote.symbol === symbol ? quote : null;
  const error = errorState && errorState.symbol === symbol ? errorState.error : null;

  return { status, quote: currentQuote, error, loading, autoRefresh, setAutoRefresh, refresh: load };
}
