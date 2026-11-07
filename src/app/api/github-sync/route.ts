// ════════════════════════════════════════════════════════════════
// GITHUB SYNC — fetch live public resolver lists server-side.
//
// The GitHub raw CDN allows CORS from nowhere (raw.githubusercontent.com has
// no Access-Control-Allow-Origin), so the browser cannot fetch it directly.
// This relay does the fetch on the server and returns only real content.
// SSFR-safe: the upstream base is hardcoded; only the allowlisted repos and
// their recorded paths are ever requested.
// ════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { createRateLimiter, rateLimitedResponse, requestKey } from "@/lib/rate-limit";
import { extractIpv4, mergeSources, parseContinentJson, parseProviderJson, mergeEntries, RESOLVER_SOURCES, type SourceResult } from "@/lib/github-resolvers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UPSTREAM = "https://raw.githubusercontent.com";
const UPSTREAM_TIMEOUT_MS = 8000;
const limiter = createRateLimiter({ windowMs: 60_000, max: 12 });

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

/** Fetch one raw file; returns null on any failure (honest: never fake). */
async function fetchRaw(path: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(`${UPSTREAM}/${path}`, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** One source result: plain IPs + rich entries (country metadata when the
 *  source document carries it, e.g. the per-continent JSON directory). */
interface RichSourceResult extends SourceResult {
  entries: import("@/lib/github-resolvers").ResolverEntry[];
}

/** Read ALL of a repo's known paths and merge (multi-file sources like the
 *  per-continent JSON directory must not stop at the first file). */
async function readSource(repo: string, paths: string[]): Promise<RichSourceResult> {
  const merged = new Set<string>();
  const usedPaths: string[] = [];
  const entries: RichSourceResult["entries"] = [];
  for (const path of paths) {
    const text = await fetchRaw(`${repo}/${path}`);
    if (text == null) continue;
    const isJson = path.endsWith(".json");
    if (isJson) {
      const rich = parseContinentJson(text);
      if (rich.length) {
        usedPaths.push(path);
        for (const e of rich) { merged.add(e.ip); entries.push(e); }
        continue;
      }
      const provider = parseProviderJson(text);
      if (provider.length) {
        usedPaths.push(path);
        for (const e of provider) { merged.add(e.ip); entries.push(e); }
        continue;
      }
    }
    const ips = extractIpv4(text);
    if (ips.length) {
      usedPaths.push(path);
      for (const ip of ips) merged.add(ip);
    }
  }
  return { repo, ips: [...merged], entries, path: usedPaths.length ? usedPaths.join("+") : null };
}

export async function GET(request: Request) {
  const verdict = limiter.limit(requestKey(request, "github-sync:get"));
  if (!verdict.ok) return rateLimitedResponse(verdict.retryAfterMs);

  const parts = await Promise.all(
    RESOLVER_SOURCES.map((s) => readSource(s.repo, s.paths).catch((): RichSourceResult => ({ repo: s.repo, ips: [], entries: [], path: null }))),
  );
  const ips = mergeSources(parts);
  // Return rich objects ONLY where the source actually carries country/org
  // metadata. Plain lists stay in compact `ips`; returning every plain IP as
  // a five-field null object would exceed serverless response limits after
  // adding large repositories.
  const entries = mergeEntries(parts.map((p) => ({ ips: [], entries: p.entries })));
  const reacted = parts.filter((p) => p.ips.length > 0);

  if (!ips.length) {
    return NextResponse.json(
      { error: "NO_DATA_FROM_SOURCES", sources: parts.map((p) => ({ repo: p.repo, path: p.path, ips: p.ips.length })) },
      { status: 502, headers },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      fetchedAt: new Date().toISOString(),
      sources: parts.map((p) => ({ repo: p.repo, path: p.path, ips: p.ips.length, entries: p.entries.length })),
      ips,
      entries,
      totalFromSources: reacted.length,
    },
    { status: 200, headers },
  );
}
