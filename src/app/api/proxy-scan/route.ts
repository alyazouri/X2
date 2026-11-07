// ════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — EDGE PROBE (DNS + TCP + HTTP CONNECT)
//
// 1:1 reconstruction of netlify/functions/proxy-scan.mjs as a Next.js
// route handler. Browsers cannot open raw TCP/UDP sockets, so the real
// network test happens HERE, on the server.
//
// All probing logic lives in @/lib/prober (shared with the global DNS scan).
// Everything is measured with performance.now() — nothing is simulated.
// ════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { scanInputSchema } from "@/lib/validation";
import { createRateLimiter, rateLimitedResponse, requestKey } from "@/lib/rate-limit";
import {
  mapConcurrent, probeEndpointRounds,
  PROXY_TEST_PORTS,
} from "@/lib/prober";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Serverless hosts cap function time (10s on Netlify free tier); where the
// plan allows more, give large scans headroom. When the cap is hit, the
// client treats it as "edge unavailable" and falls back to browser probes.
export const maxDuration = 60;

// NOTE: no runtime early-exit here. Function runtimes (Netlify/Lambda) DO
// open TCP sockets (real TCP/CONNECT evidence), and UDP DNS probes simply
// resolve to honest TIMEOUT evidence where the platform blocks UDP. The
// per-probe deadlines keep every endpoint bounded either way.

const ALLOWED_PREFIXES = new Set([
  "5.198", "31.214", "37.75", "37.152", "37.202", "37.220",
  "46.23", "46.32", "46.185",
  "77.245", "79.134", "79.173",
  "80.10", "80.90", "81.21", "81.28", "82.212",
  "85.159", "86.108", "87.236", "89.28", "89.38",
  "91.106", "92.253", "93.95", "94.142", "94.249",
  "109.107", "109.237", "149.200",
  "176.28", "176.29", "176.241", "178.20",
  "185.51", "185.96", "185.98", "185.176", "185.180", "188.123", "188.247", "193.188", "194.165",
  "212.34", "212.35", "212.118", "213.139", "213.186",
  "217.23", "217.144",
]);
const ALLOWED_PORTS = new Set([53, 80, 443, 853, 1080, 8080, 8888, 10010, 20001, 20002]);
const MAX_ENDPOINTS = 220;
/** Scans are the most expensive route (real sockets): strict per-IP budget. */
const scanLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });
const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function isAllowed(host: string, port: number): boolean {
  if (typeof host !== "string" || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  const octets = host.split(".").map(Number);
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  if (!ALLOWED_PREFIXES.has(`${octets[0]}.${octets[1]}`)) return false;
  return ALLOWED_PORTS.has(port);
}

export async function POST(request: Request) {
  // Scans open real sockets — bound the blast radius per client IP.
  const verdict = scanLimiter.limit(requestKey(request, "proxy-scan:post"));
  if (!verdict.ok) return rateLimitedResponse(verdict.retryAfterMs);

  let body: unknown;
  try { body = await request.json(); }
  catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers });
  }
  const parsed = scanInputSchema.safeParse(body);
  if (!parsed.success || parsed.data.endpoints.length > MAX_ENDPOINTS) {
    return NextResponse.json({ error: "INVALID_ENDPOINTS" }, { status: 400, headers });
  }
  // Multi-round sampling for real per-address jitter (bounded 1..5 by schema).
  const rounds = Math.max(1, Math.min(5, Math.floor(parsed.data.rounds ?? 1)));
  const unique: { host: string; port: number }[] = [];
  const seen = new Set<string>();
  for (const item of parsed.data.endpoints) {
    const host = item.host;
    const port = item.port;
    const key = `${host}:${port}`;
    if (!isAllowed(host, port) || seen.has(key)) continue;
    seen.add(key);
    unique.push({ host, port });
  }
  const results = await mapConcurrent(unique, (ep) => probeEndpointRounds(ep, rounds));
  return NextResponse.json(
    {
      source: "NETLIFY_EDGE_PROBE",
      measuredAt: new Date().toISOString(),
      note: "DNS (UDP/53) queries, TCP connects and HTTP CONNECT handshakes are measured from the Netlify function region, not from the user's Wi-Fi.",
      results,
    },
    { status: 200, headers },
  );
}

export function GET() {
  return NextResponse.json({ error: "POST_REQUIRED" }, { status: 405, headers });
}
export function PUT() {
  return NextResponse.json({ error: "POST_REQUIRED" }, { status: 405, headers });
}
export function DELETE() {
  return NextResponse.json({ error: "POST_REQUIRED" }, { status: 405, headers });
}
export function PATCH() {
  return NextResponse.json({ error: "POST_REQUIRED" }, { status: 405, headers });
}
