import { AUTO_REFRESH_MINUTES, type ProviderStatus, type StockPriceProvider } from "../types";
import { createFinnhubProvider } from "./finnhub";

/**
 * Chooses the stock price provider from server-side environment variables.
 *
 * Auto Price is OFF unless explicitly enabled:
 *   STOCK_PRICE_PROVIDER=finnhub
 *   FINNHUB_API_KEY=your-key
 *
 * These are read only on the server (no NEXT_PUBLIC_ prefix), so the key is
 * never bundled into frontend code.
 *
 * To add a provider: implement StockPriceProvider and add a case below.
 */
export function getProvider(env: NodeJS.ProcessEnv = process.env): StockPriceProvider | null {
  const id = (env.STOCK_PRICE_PROVIDER ?? "").trim().toLowerCase();
  switch (id) {
    case "finnhub": {
      const key = env.FINNHUB_API_KEY?.trim();
      return key ? createFinnhubProvider(key) : null;
    }
    default:
      return null;
  }
}

export function getProviderStatus(env: NodeJS.ProcessEnv = process.env): ProviderStatus {
  const provider = getProvider(env);
  if (provider) {
    return {
      enabled: true,
      providerName: provider.name,
      attributionUrl: provider.attributionUrl,
      dataNote: provider.dataNote,
      autoRefreshMinutes: AUTO_REFRESH_MINUTES,
    };
  }
  const id = (env.STOCK_PRICE_PROVIDER ?? "").trim();
  return {
    enabled: false,
    reason: !id
      ? "เว็บไซต์นี้ยังไม่ได้ตั้งค่าผู้ให้บริการราคาหุ้น"
      : id.toLowerCase() === "finnhub"
        ? "เลือกผู้ให้บริการ Finnhub แล้ว แต่ยังไม่ได้ตั้งค่า API key บนเซิร์ฟเวอร์"
        : `ไม่รู้จักผู้ให้บริการราคาหุ้น "${id}"`,
    autoRefreshMinutes: AUTO_REFRESH_MINUTES,
  };
}
