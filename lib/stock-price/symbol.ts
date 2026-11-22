/** US-style tickers: letters/digits, optional class suffix (BRK.B, BF-B). */
const SYMBOL_RE = /^[A-Z0-9]{1,6}([.\-][A-Z0-9]{1,3})?$/;

export function isValidSymbol(symbol: string): boolean {
  return SYMBOL_RE.test(symbol);
}
