import { connection } from "next/server";
import { getProviderStatus } from "@/lib/stock-price/server/registry";

export async function GET() {
  // Read env at request time (not build time) so changing env vars on Vercel
  // takes effect after a redeploy/restart without stale prerendered output.
  await connection();
  return Response.json(getProviderStatus(), { headers: { "Cache-Control": "no-store" } });
}
