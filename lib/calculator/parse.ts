export type ParsedNumber =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "number"; value: number };

/**
 * Parse a user-entered decimal. Accepts thousands separators ("1,250.50"),
 * surrounding whitespace, and a leading minus sign (so we can report
 * "must not be negative" instead of a confusing "invalid number").
 */
export function parseDecimal(raw: string | undefined | null): ParsedNumber {
  const trimmed = (raw ?? "").replace(/[,\s_]/g, "");
  if (trimmed === "") return { kind: "empty" };
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(trimmed)) return { kind: "invalid" };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { kind: "invalid" };
  return { kind: "number", value };
}

/** Uppercase, strip spaces; keep only characters valid in a ticker. */
export function normalizeSymbol(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);
}
