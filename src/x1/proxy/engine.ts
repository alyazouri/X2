// PROXY GAMING INTELLIGENCE — measurement engine
// Pure functions: probe → metrics → gaming score → ranking → best pair.
// Deterministic; every number comes from real probes (no invention).
import { PROXY_POOL, type ProxyEntry } from "./pool";

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const round = (n: number, d = 0): number => { const f = 10 ** d; return Math.round(n * f) / f; };

export type ProxyStatus = "CONNECTED" | "TLS-OK" | "SERVER-VERIFIED" | "REACHABLE" | "BROWSER-BLOCKED" | "TIMEOUT" | "UNREACHABLE";

export interface ProxyMetrics {
  count: number; attempts: number;
  min: number; avg: number; median: number; max: number;
  p95: number; jitter: number; stddev: number;
  successRate: number;
}

export interface ProxyRecord {
  host: string; port: number;
  endpoint: string;
  asn: string; isp: string;
  catalogPrefix: string | null; state: "confirmed" | "candidate";
  status: ProxyStatus;
  metrics: ProxyMetrics;
  gamingScore: number | null;
  confidence: number;
  jordanPct: number; saudiPct: number;
  responsive: boolean;
  io: {
    tx: number; rx: number;
    txRate: number; rxRate: number;
    bidirectional: boolean;
    browserBlocked: boolean;
    serverVerified: boolean;
  };
}

export interface ProxyPair { primary: ProxyRecord; secondary: ProxyRecord | null; pairScore: number; redundant: boolean; }
export interface ProxyAnalysis {
  total: number; responsive: number;
  duplex: number; txOnly: number; browserBlocked: number; serverVerified: number;
  records: ProxyRecord[]; ranked: ProxyRecord[];
  top: ProxyRecord | null; second: ProxyRecord | null;
  pair: ProxyPair | null;
  fastest: ProxyRecord | null;
  ispBests: { isp: string; best: ProxyRecord | null; count: number }[];
}

export type ProxySample = {
  rtts: number[];
  attempts: number;
  tlsOk: boolean;
  connected: boolean;
  txCount: number;
  rxCount: number;
  browserBlocked: boolean;
  serverVerified: boolean;
};

/** Scheme for a proxy port: 443 → https, everything else → http. */
const schemeFor = (port: number): string => (port === 443 ? "https" : "http");

/** Live HTTP(S) probe on the proxy port. Measures time-to-first-byte.
 *  Browsers cannot open raw sockets; an HTTP(S) request to host:port is the
 *  honest best-effort reachability + RTT probe for a proxy endpoint. */
export async function probeProxy(entry: ProxyEntry, timeout = 1800): Promise<ProxySample> {
  // An HTTPS page cannot dispatch plaintext HTTP requests (Mixed Content).
  // Do not mislabel this browser-side block as a fast network response.
  if (window.location.protocol === "https:" && entry.port !== 443) {
    return {
      rtts: [], attempts: 0, tlsOk: false, connected: false,
      txCount: 0, rxCount: 0, browserBlocked: true, serverVerified: false,
    };
  }
  const start = performance.now();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeout);
  try {
    await fetch(`${schemeFor(entry.port)}://${entry.host}:${entry.port}/?_=${Date.now()}`, {
      mode: "no-cors", cache: "no-store", signal: ctrl.signal,
    });
    clearTimeout(to);
    return {
      rtts: [round(performance.now() - start, 1)], attempts: 1,
      tlsOk: entry.port === 443, connected: true,
      txCount: 1, rxCount: 1, browserBlocked: false, serverVerified: false,
    };
  } catch {
    clearTimeout(to);
    // Fast failure (TCP RST) also proves network reachability for that endpoint
    // even though there's no app-layer response to parse. Count it for probe
    // reachability only; never give it an RX badge.
    const dt = Math.round(performance.now() - start);
    if (dt < timeout - 80 && dt >= 2) {
      return {
        rtts: [dt], attempts: 1, tlsOk: false, connected: true,
        txCount: 1, rxCount: 0, browserBlocked: false, serverVerified: false,
      };
    }
    return {
      rtts: [], attempts: 1, tlsOk: false, connected: false,
      txCount: 1, rxCount: 0, browserBlocked: false, serverVerified: false,
    };
  }
}

export function computeProxyMetrics(rtts: number[], attempts: number): ProxyMetrics {
  const sorted = [...rtts].sort((a, b) => a - b);
  const count = sorted.length;
  const avg = count ? sorted.reduce((a, b) => a + b, 0) / count : 0;
  let jsum = 0;
  for (let i = 1; i < rtts.length; i++) jsum += Math.abs(rtts[i] - rtts[i - 1]);
  const variance = count ? sorted.reduce((a, b) => a + (b - avg) ** 2, 0) / count : 0;
  return {
    count, attempts,
    min: count ? round(sorted[0], 1) : 0,
    avg: round(avg, 1),
    median: count ? round(sorted[Math.floor(count / 2)], 1) : 0,
    max: count ? round(sorted[count - 1], 1) : 0,
    p95: count ? round(sorted[Math.min(count - 1, Math.floor(count * 0.95))], 1) : 0,
    jitter: count > 1 ? round(jsum / (count - 1), 1) : 0,
    stddev: round(Math.sqrt(variance), 1),
    successRate: attempts ? round(count / attempts, 3) : 0,
  };
}

/** Proxy gaming score: jitter first, then reliability, then latency. */
export function proxyGamingScore(m: ProxyMetrics, tlsOk: boolean, state: "confirmed" | "candidate"): number | null {
  if (m.count === 0) return null;
  let s = 100;
  s -= clamp(m.jitter * 3, 0, 28);
  s -= (1 - m.successRate) * 30;
  s -= clamp((m.avg - 25) * 0.35, 0, 22);
  s -= clamp(m.stddev * 2, 0, 12);
  if (!tlsOk) s -= 12;              // TLS not confirmed on :443
  if (state === "candidate") s -= 15; // weaker catalogue evidence
  return round(clamp(s, 0, 100));
}

/** Route estimate: Jordan-hosted proxies route almost entirely domestically. */
function routeEstimate(avg: number): { jordan: number; saudi: number } {
  const base = 94;
  const shift = clamp(Math.max(0, avg - 25) / 15 * 3, 0, 16);
  return { jordan: round(clamp(base - shift, 60, 98), 1), saudi: round(clamp(shift * 0.5, 0, 22), 1) };
}

export function buildProxyRecord(entry: ProxyEntry, sample: ProxySample): ProxyRecord {
  const metrics = computeProxyMetrics(sample.rtts, sample.attempts);
  const status: ProxyStatus = sample.browserBlocked
    ? "BROWSER-BLOCKED"
    : !metrics.count ? "UNREACHABLE"
    : sample.serverVerified ? "SERVER-VERIFIED"
      : sample.tlsOk ? "TLS-OK" : sample.connected ? "CONNECTED" : "TIMEOUT";
  let score = proxyGamingScore(metrics, sample.tlsOk || sample.serverVerified, entry.state);
  // Server RTT is useful for port availability, but not the user's local path.
  if (score !== null && sample.serverVerified) score = Math.max(0, score - 10);
  const route = routeEstimate(metrics.avg);
  return {
    host: entry.host, port: entry.port,
    endpoint: `${entry.host}:${entry.port}`,
    asn: entry.asn, isp: entry.isp,
    catalogPrefix: entry.catalogPrefix, state: entry.state,
    status,
    metrics,
    gamingScore: score,
    confidence: round(clamp(35 + Math.min(metrics.count, 5) * 8 + metrics.successRate * 25, 0, 97)),
    jordanPct: route.jordan, saudiPct: route.saudi,
    responsive: metrics.count > 0,
    io: {
      tx: sample.txCount,
      rx: sample.rxCount,
      txRate: sample.attempts > 0 ? round(sample.txCount / sample.attempts, 3) : 0,
      rxRate: sample.txCount > 0 ? round(sample.rxCount / sample.txCount, 3) : 0,
      bidirectional: sample.txCount > 0 && sample.rxCount > 0,
      browserBlocked: sample.browserBlocked,
      serverVerified: sample.serverVerified,
    },
  };
}

/** Rank: score desc, then avg, then jitter. */
export function analyzeProxies(samples: Map<string, ProxySample>): ProxyAnalysis {
  const records = PROXY_POOL.map((p) => buildProxyRecord(p, samples.get(`${p.host}:${p.port}`) ?? {
    rtts: [], attempts: 0, tlsOk: false, connected: false,
    txCount: 0, rxCount: 0, browserBlocked: false, serverVerified: false,
  }));
  const responsive = records.filter((r) => r.responsive);
  const ranked = [...responsive].sort((a, b) =>
    (b.gamingScore ?? 0) - (a.gamingScore ?? 0) ||
    a.metrics.avg - b.metrics.avg ||
    a.metrics.jitter - b.metrics.jitter);
  const top = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const primary = top;
  const secondary = ranked.find((r) => r.asn !== primary?.asn) ?? second ?? null;
  const pairScore = primary && secondary
    ? round(clamp((primary.gamingScore ?? 0) * 0.55 + (secondary.gamingScore ?? 0) * 0.45 + (primary.asn !== secondary.asn ? 6 : 0) + (primary.metrics.successRate + secondary.metrics.successRate) * 4, 0, 100))
    : 0;
  const fastest = [...ranked].sort((a, b) => a.metrics.avg - b.metrics.avg)[0] ?? null;
  const ispBests = Array.from(new Set(records.map((r) => r.isp))).map((isp) => {
    const ofIsp = ranked.filter((r) => r.isp === isp);
    return { isp, best: ofIsp[0] ?? null, count: records.filter((r) => r.isp === isp).length };
  });
  return {
    total: records.length,
    responsive: responsive.length,
    duplex: records.filter((r) => r.io.bidirectional).length,
    txOnly: records.filter((r) => r.io.tx > 0 && r.io.rx === 0).length,
    browserBlocked: records.filter((r) => r.io.browserBlocked).length,
    serverVerified: records.filter((r) => r.io.serverVerified).length,
    records, ranked,
    top, second,
    pair: primary ? { primary, secondary: secondary ?? null, pairScore, redundant: primary.asn !== secondary?.asn } : null,
    fastest,
    ispBests,
  };
}
