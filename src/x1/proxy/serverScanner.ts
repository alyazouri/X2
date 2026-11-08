// Same-origin server scanner client. Solves HTTPS Mixed Content by delegating
// raw TCP port checks to a Netlify Function. Results are explicitly marked as
// server-region measurements, not the user's local Wi-Fi RTT.
import type { ProxyEntry } from "./pool";
import type { ProxySample } from "./engine";
import { fetchWithHardTimeout } from "../../lib/fetch-timeout";

interface ScanResult {
  endpoint: string;
  open: boolean;
  connectMs: number | null;
  evidence: string;
}

interface ScanResponse { results?: ScanResult[]; }

export async function scanViaServer(entries: ProxyEntry[]): Promise<Map<string, ProxySample>> {
  const out = new Map<string, ProxySample>();
  if (!entries.length) return out;
  try {
    const response = await fetchWithHardTimeout("/api/proxy-scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoints: entries.map(({ host, port }) => ({ host, port })) }),
      cache: "no-store",
    }, 15_000);
    if (!response.ok) return out;
    const data = await response.json() as ScanResponse;
    for (const result of data.results ?? []) {
      out.set(result.endpoint, {
        rtts: result.open && result.connectMs !== null ? [result.connectMs] : [],
        attempts: 1,
        tlsOk: false,
        connected: result.open,
        txCount: 1,
        rxCount: result.open ? 1 : 0,
        browserBlocked: false,
        serverVerified: result.open,
      });
    }
  } catch {
    // Function unavailable (e.g. local Vite without Netlify dev). Keep browser state.
  }
  return out;
}