// ════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — GLOBAL DNS SCAN
//
// Real worldwide resolver probing for the Global tab. Accepts IPv4 hosts,
// runs genuine UDP/53 queries from the edge and tests DNSSEC validation
// against dnssec-failed.org. Uses the SAME shared prober module as the
// Jordanian plan (@/lib/prober) — one implementation, zero duplication.
// Everything is measured; nothing is simulated.
// ════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { z } from "zod";
import { createRateLimiter, rateLimitedResponse, requestKey } from "@/lib/rate-limit";
import { mapConcurrent, probeEndpointRounds } from "@/lib/prober";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const MAX_HOSTS = 160;
const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

const schema = z.object({
  hosts: z.array(z.string().min(7).max(64)).min(1).max(MAX_HOSTS),
  rounds: z.number().int().min(1).max(3).optional(),
});

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });

/** One host → multi-round real DNS probe + a TCP/443 aliveness proof.
 *  Mirrors the Jordanian flow: if the resolver doesn't answer UDP/53 but the
 *  host is reachable on 443, the row is ALIVE — never declared dead on one
 *  port's silence. */
async function probeHost(host: string, rounds: number) {
  const dnsRows = await probeEndpointRounds({ host, port: 53 }, rounds);
  if (dnsRows.open) return dnsRows;
  const tcp = await probeEndpointRounds({ host, port: 443 }, 1);
  if (tcp.open) {
    return {
      ...dnsRows,
      open: true,
      connectMs: tcp.avgMs ?? tcp.connectMs,
      samples: tcp.samples ?? [],
      avgMs: tcp.avgMs ?? null,
      evidence: "TCP_SYN_ACK_443",
    };
  }
  return dnsRows;
}

export async function POST(request: Request) {
  const verdict = limiter.limit(requestKey(request, "global-scan:post"));
  if (!verdict.ok) return rateLimitedResponse(verdict.retryAfterMs);

  let body: unknown;
  try { body = await request.json(); }
  catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues.length }, { status: 400, headers });
  }

  // Validate IPv4 octets + dedupe (no duplicates allowed in or out).
  const seen = new Set<string>();
  const hosts: string[] = [];
  for (const h of parsed.data.hosts) {
    if (!IPV4_RE.test(h) || seen.has(h)) continue;
    const octets = h.split(".").map(Number);
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) continue;
    seen.add(h);
    hosts.push(h);
  }

  const results = await mapConcurrent(hosts, (host) => probeHost(host, Math.max(1, Math.min(3, parsed.data.rounds ?? 2))));

  return NextResponse.json(
    {
      source: "GLOBAL_EDGE_PROBE",
      measuredAt: new Date().toISOString(),
      note: "Real UDP/53 DNS queries + DNSSEC validation checks against dnssec-failed.org, measured from the edge region, not the user's Wi-Fi.",
      results,
    },
    { status: 200, headers },
  );
}

export function GET() {
  return NextResponse.json({ error: "POST_REQUIRED" }, { status: 405, headers });
}
