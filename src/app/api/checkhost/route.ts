// ════════════════════════════════════════════════════════════════
// CHECK-HOST PROXY — same-origin relay for the browser.
//
// WHY: check-host.net sends NO CORS headers (verified: OPTIONS → 403), so a
// browser fetch to it is blocked → the Ping Monitor and Region Router showed
// "—" forever. This route relays the REAL check-host API server-side (Node has
// no CORS), so the browser only ever talks to our own origin.
//
// SECURITY (constitution: SSRF protection):
//   • Upstream base is hardcoded — this is NOT an open proxy.
//   • `type` is allowlisted (tcp/dns/ping/http).
//   • `nodes` must match the check-host node-id pattern.
//   • Hard upstream timeout + per-IP rate limit.
//   • Real payloads are relayed verbatim (no fabrication).
// ════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { z } from "zod";
import { createRateLimiter, rateLimitedResponse, requestKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = "https://check-host.net";
const JSON_HEADERS = { accept: "application/json" } as const;
const UPSTREAM_TIMEOUT_MS = 8000;

const limiter = createRateLimiter({ windowMs: 60_000, max: 240 });

const NODE_ID_RE = /^[a-z]{2}\d{1,2}\.node\.check-host\.net$/i;
const REQUEST_ID_RE = /^[a-zA-Z0-9]+$/;

const submitSchema = z.object({
  type: z.enum(["tcp", "dns", "ping", "http"]),
  host: z.string().min(1).max(253),
  nodes: z.array(z.string().regex(NODE_ID_RE)).min(1).max(8),
});

/** Upstream GET with a hard deadline; never hangs the function. */
async function upstreamGet(path: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(`${UPSTREAM}${path}`, {
      headers: JSON_HEADERS,
      cache: "no-store",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function relay(res: Response) {
  // Pass the real check-host JSON straight through (real data, no rewrite).
  return res.json()
    .then((body) => NextResponse.json(body, {
      status: res.ok ? 200 : 502,
      headers: { "cache-control": "no-store" },
    }))
    .catch(() => NextResponse.json({ error: "UPSTREAM_INVALID_JSON" }, { status: 502 }));
}

export async function GET(request: Request) {
  const verdict = limiter.limit(requestKey(request, "checkhost:get"));
  if (!verdict.ok) return rateLimitedResponse(verdict.retryAfterMs);

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "nodes") {
    try {
      return relay(await upstreamGet("/nodes/hosts"));
    } catch {
      return NextResponse.json({ error: "UPSTREAM_UNAVAILABLE" }, { status: 502 });
    }
  }

  if (action === "result") {
    const id = url.searchParams.get("id") ?? "";
    if (!REQUEST_ID_RE.test(id) || id.length > 40) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    try {
      return relay(await upstreamGet(`/check-result/${id}`));
    } catch {
      return NextResponse.json({ error: "UPSTREAM_UNAVAILABLE" }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
}

export async function POST(request: Request) {
  const verdict = limiter.limit(requestKey(request, "checkhost:post"));
  if (!verdict.ok) return rateLimitedResponse(verdict.retryAfterMs);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const { type, host, nodes } = parsed.data;

  const params = new URLSearchParams({ host });
  for (const n of nodes) params.append("node", n);

  try {
    return relay(await upstreamGet(`/check-${type}?${params.toString()}`));
  } catch {
    return NextResponse.json({ error: "UPSTREAM_UNAVAILABLE" }, { status: 502 });
  }
}
