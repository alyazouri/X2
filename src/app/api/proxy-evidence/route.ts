// Community-verified endpoints — scans report their successful evidence here,
// and every client can read what the community has already confirmed.
// Hardened: Zod validation + rate limiting; optimized: one dedupe query and
// one bulk insert per request instead of per-row round-trips.
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { proxyEvidence } from "@/db/schema";
import { evidenceInputSchema, SCANNABLE_PORTS, zodErrorBody } from "@/lib/validation";
import { createRateLimiter, rateLimitedResponse, requestKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const writeLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

const SCANNABLE_PORT_SET = new Set<number>(SCANNABLE_PORTS);

export async function GET(request: Request) {
  const verdict = readLimiter.limit(requestKey(request, "proxy-evidence:get"));
  if (!verdict.ok) return rateLimitedResponse(verdict.retryAfterMs);
  try {
    const rows = await db.execute<{
      host: string; port: number; confirmations: number; lastSeen: string; bestMs: number | null;
    }>(
      sql`select host, port, count(*)::int as confirmations, max(created_at) as last_seen,
                 coalesce(min(connect_ms), null)::float4 as best_ms
          from proxy_evidence
          group by host, port
          order by confirmations desc, last_seen desc
          limit 20`,
    );
    return Response.json({
      ok: true,
      rows: rows.rows.map((r) => ({
        host: r.host, port: r.port, confirmations: r.confirmations,
        lastSeen: r.lastSeen, bestMs: r.bestMs,
      })),
    });
  } catch {
    return Response.json({ ok: false, error: "DB_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const verdict = writeLimiter.limit(requestKey(request, "proxy-evidence:post"));
  if (!verdict.ok) return rateLimitedResponse(verdict.retryAfterMs);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = evidenceInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(zodErrorBody(parsed.error.issues.length), { status: 400 });
  }

  // Business filter on top of schema validation: only scannable ports.
  const clean = parsed.data.rows
    .filter((row) => SCANNABLE_PORT_SET.has(row.port))
    .map((row) => ({
      host: row.host,
      port: row.port,
      status: row.status,
      evidence: row.evidence,
      source: row.source,
      connectMs: row.connectMs == null ? null : Math.round(row.connectMs * 10) / 10,
    }));
  if (!clean.length) {
    return Response.json({ ok: false, error: "NO_VALID_ROWS" }, { status: 400 });
  }

  try {
    // One dedupe query for the whole batch (24h window), then one bulk insert.
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const pairTuples = clean.map((row) => sql`(${row.host}, ${row.port})`);
    const existing = await db.execute<{ host: string; port: number }>(
      sql`select distinct host, port from proxy_evidence
          where (host, port) in (${sql.join(pairTuples, sql`, `)})
            and created_at > ${dayAgo}`,
    );
    const seen = new Set(existing.rows.map((r) => `${r.host}:${r.port}`));
    const toInsert = clean.filter((row) => !seen.has(`${row.host}:${row.port}`));
    if (toInsert.length) {
      await db.insert(proxyEvidence).values(toInsert);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "DB_UNAVAILABLE" }, { status: 503 });
  }
}
