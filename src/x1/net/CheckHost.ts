// ════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — CHECK-HOST INTEGRATION (real distributed probing)
//
// check-host.net exposes a public JSON API (Accept: application/json) that runs
// REAL network checks from dozens of physical nodes worldwide:
//   /check-tcp?host=IP:PORT  → real TCP connect + timing from each node
//   /check-dns?host=DOMAIN   → real A / AAAA / PTR + TTL from each node
//   /nodes/hosts             → the node list (country, city, IP, ASN)
//   /trace                   → real traceroute (hops)
//
// This is what makes a browser-only build able to test proxy ports and compare
// DNS routing per region — the checks genuinely happen on real remote machines.
// Docs: https://check-host.net/about/api
// ════════════════════════════════════════════════════════════════

// Same-origin proxy (src/app/api/checkhost). check-host.net sends no CORS
// headers, so the browser cannot call it directly — the proxy relays the REAL
// API server-side. Every byte is genuine check-host data; nothing is simulated.
const API = "/api/checkhost";
const JSON_HEADERS = { accept: "application/json" } as const;

/** Real request budgets — when the upstream is unreachable the call must fail
 *  fast into the existing fallbacks instead of hanging the whole scan. */
const NODES_TIMEOUT_MS = 9000;
const SUBMIT_TIMEOUT_MS = 9000;
const RESULT_TIMEOUT_MS = 9000;

function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { headers: JSON_HEADERS, cache: "no-store", signal: ctrl.signal, ...init })
    .finally(() => clearTimeout(timer));
}

export interface CheckHostNode {
  id: string;        // e.g. "eg1.node.check-host.net"
  country: string;   // "eg"
  countryName: string; // "Egypt"
  city: string;      // "Cairo"
  ip: string;
  asn: string;
}

export interface TcpNodeResult {
  nodeId: string;
  ok: boolean;
  timeMs: number | null;
  address: string | null;
  error: string | null;
}

export interface DnsNodeResult {
  nodeId: string;
  a: string[];
  aaaa: string[];
  ttl: number | null;
  ptr: string[] | null;
}

/** Legacy node tuple: [country, countryName, city, ip, asn]. */
type NodeTuple = [string, string, string, string, string];
/** Object shape the live API now returns: { asn, ip, location: [country, countryName, city] }. */
type NodeObject = { asn?: string; ip?: string; location?: string[] };

/** Fetch the live node list so regions can be selected from real nodes. */
export async function fetchNodes(): Promise<CheckHostNode[]> {
  const res = await fetchWithTimeout(`${API}?action=nodes`, NODES_TIMEOUT_MS);
  if (!res.ok) throw new Error(`NODES_${res.status}`);
  const json = (await res.json()) as { nodes?: Record<string, NodeTuple | NodeObject> } | Record<string, NodeTuple | NodeObject>;
  const raw = (json as { nodes?: Record<string, NodeTuple | NodeObject> }).nodes
    ?? (json as Record<string, NodeTuple | NodeObject>);
  if (!raw) return [];
  return Object.entries(raw).map(([id, meta]) => {
    if (Array.isArray(meta)) {
      return {
        id,
        country: meta[0] ?? "",
        countryName: meta[1] ?? "",
        city: meta[2] ?? "",
        ip: meta[3] ?? "",
        asn: meta[4] ?? "",
      };
    }
    const loc = meta.location ?? [];
    return {
      id,
      country: loc[0] ?? "",
      countryName: loc[1] ?? "",
      city: loc[2] ?? "",
      ip: meta.ip ?? "",
      asn: meta.asn ?? "",
    };
  });
}

/** Submit a check; returns the request_id used for polling. */
async function submit(
  type: "tcp" | "dns" | "ping" | "http",
  host: string,
  nodes: string[],
): Promise<string> {
  const res = await fetchWithTimeout(API, SUBMIT_TIMEOUT_MS, {
    method: "POST",
    headers: { ...JSON_HEADERS, "content-type": "application/json" },
    body: JSON.stringify({ type, host, nodes }),
  });
  if (!res.ok) throw new Error(`SUBMIT_${res.status}`);
  const json = (await res.json()) as { ok?: number; request_id?: string };
  if (!json.request_id) throw new Error("NO_REQUEST_ID");
  return json.request_id;
}

/** Poll a submitted check until the requested nodes have reported (or timeout). */
async function poll<T>(
  requestId: string,
  expected: number,
  parse: (nodeId: string, raw: unknown) => T | null,
  timeoutMs: number,
): Promise<T[]> {
  const deadline = performance.now() + timeoutMs;
  const seen = new Map<string, T>();
  while (performance.now() < deadline) {
    await new Promise((r) => setTimeout(r, 900));
    let json: unknown;
    try {
      const res = await fetchWithTimeout(`${API}?action=result&id=${encodeURIComponent(requestId)}`, RESULT_TIMEOUT_MS);
      if (!res.ok) continue;
      json = await res.json();
    } catch { continue; }
    const map = json as Record<string, unknown>;
    for (const [nodeId, value] of Object.entries(map ?? {})) {
      if (value === null || value === undefined) continue;   // node not done yet
      const parsed = parse(nodeId, value);
      if (parsed) seen.set(nodeId, parsed);
    }
    if (seen.size >= expected) break;
  }
  return [...seen.values()];
}

/**
 * REAL TCP port check from specific global nodes.
 * `host` must be "ip:port". Returns one result per node with real connect time.
 */
export async function checkTcp(host: string, port: number, nodes: string[], timeoutMs = 12000): Promise<TcpNodeResult[]> {
  const requestId = await submit("tcp", `${host}:${port}`, nodes);
  return poll<TcpNodeResult>(requestId, nodes.length, (nodeId, raw) => {
    const rows = raw as { time?: number; address?: string; error?: string }[];
    const first = Array.isArray(rows) ? rows[0] : (raw as { time?: number; address?: string; error?: string });
    if (!first) return { nodeId, ok: false, timeMs: null, address: null, error: "NO_RESULT" };
    if (typeof first.error === "string") {
      return { nodeId, ok: false, timeMs: null, address: null, error: first.error };
    }
    return {
      nodeId,
      ok: true,
      timeMs: typeof first.time === "number" ? Math.round(first.time * 1000) / 1000 : null,
      address: first.address ?? null,
      error: null,
    };
  }, timeoutMs);
}

export interface PingNodeResult {
  nodeId: string;
  ok: boolean;
  /** All sample times reported by the node, in milliseconds. */
  samplesMs: number[];
  error: string | null;
}

/**
 * REAL ICMP ping executed BY each node. check-host answers with 4 samples per
 * node shaped `[["OK", seconds, ip?], ...]` (verified live against the API),
 * so genuine per-region RTT + jitter can be computed without simulating.
 */
export async function checkPing(host: string, nodes: string[], timeoutMs = 12000): Promise<PingNodeResult[]> {
  const requestId = await submit("ping", host, nodes);
  return poll<PingNodeResult>(requestId, nodes.length, (nodeId, raw) => {
    const rows = Array.isArray(raw) ? raw : [];
    const samplesMs: number[] = [];
    let failed = 0;

    // check-host ping shape can be either:
    //   [ [ ["OK", 0.05, "ip"], ["OK", 0.049] ... ] ]
    // or already flattened sample tuples.
    // Normalize by walking both levels and extracting every tuple-like row.
    const tuples: unknown[] = [];
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      if (row.length > 0 && Array.isArray(row[0])) {
        for (const inner of row) tuples.push(inner);
      } else {
        tuples.push(row);
      }
    }

    for (const tuple of tuples) {
      const cells = Array.isArray(tuple) ? tuple : [];
      const status = cells.find((c): c is string => typeof c === "string");
      const timeSec = cells.find((c): c is number => typeof c === "number");
      if (typeof timeSec === "number" && Number.isFinite(timeSec) && timeSec >= 0) {
        samplesMs.push(Math.round(timeSec * 1000 * 10) / 10);
      } else if (typeof status === "string" && status.toUpperCase() !== "OK") {
        failed += 1;
      }
    }

    if (!samplesMs.length && !failed) return null; // node not done yet
    return {
      nodeId,
      ok: samplesMs.length > 0,
      samplesMs,
      error: samplesMs.length ? null : "PING_FAILED",
    };
  }, timeoutMs);
}

/**
 * REAL DNS lookup performed BY each node (so the answer reflects that region's
 * routing). Returns the A records that region actually receives.
 */
export async function checkDns(domain: string, nodes: string[], timeoutMs = 12000): Promise<DnsNodeResult[]> {
  const requestId = await submit("dns", domain, nodes);
  return poll<DnsNodeResult>(requestId, nodes.length, (nodeId, raw) => {
    const rows = raw as { A?: string[]; AAAA?: string[]; TTL?: number | null; PTR?: string[] | null }[];
    const first = Array.isArray(rows) ? rows[0] : (raw as { A?: string[]; AAAA?: string[]; TTL?: number | null; PTR?: string[] | null });
    if (!first) return null;
    return {
      nodeId,
      a: first.A ?? [],
      aaaa: first.AAAA ?? [],
      ttl: first.TTL ?? null,
      ptr: first.PTR ?? null,
    };
  }, timeoutMs);
}
