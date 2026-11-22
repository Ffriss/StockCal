import type { ProviderStatus, QuoteApiResponse } from "./types";

/** Browser-side calls to our own API routes (never to the provider directly). */

export async function fetchProviderStatus(signal?: AbortSignal): Promise<ProviderStatus> {
  try {
    const res = await fetch("/api/quote/status", { cache: "no-store", signal });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as ProviderStatus;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return { enabled: false, reason: "ไม่สามารถตรวจสอบได้ว่าราคาอัตโนมัติพร้อมใช้งานหรือไม่", autoRefreshMinutes: 5 };
  }
}

export async function fetchQuote(symbol: string, signal?: AbortSignal): Promise<QuoteApiResponse> {
  try {
    const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store", signal });
    const body = (await res.json().catch(() => null)) as QuoteApiResponse | null;
    if (body && typeof body === "object" && "ok" in body) return body;
    return { ok: false, error: { code: "UPSTREAM_ERROR", message: `ได้รับข้อมูลที่ไม่คาดคิด (HTTP ${res.status})` } };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return { ok: false, error: { code: "UPSTREAM_ERROR", message: "เครือข่ายขัดข้อง กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต" } };
  }
}
