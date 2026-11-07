// ════════════════════════════════════════════════════════════════
// DNS GAMING INTELLIGENCE — Analysis Engine
// Pure functions: dedupe → metrics → gaming score → compatibility →
// grade → ranking → best pair → ISP profiles. Deterministic.
// All numbers come ONLY from real probe samples (no invention).
// ════════════════════════════════════════════════════════════════
import { MASTER_DNS, inferIspAny, searchDomainAny, prefixOf, JORDAN_ISPS, knownDnsEntry } from "./dataset";
import { SAUDI_DNS, saudiIspOf, saudiDomainOf, SAUDI_ISPS } from "./saudiDataset";
import { routeEstimate, saudiRouteEstimate } from "./routeModel";
import type { DnsCountry } from "./types";
import type { DnsRecord, DnsMetrics, DnsAnalysis, DnsPair, IspBest, SampleSet, Compatibility, StabilityGrade, DnsStatus } from "./types";

const round = (n: number, d = 0): number => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** Deduplicate the master dataset — IP is the unique key. Returns unique list (stable order). */
export function dedupeMaster(raw: string[]): { unique: string[]; duplicates: number } {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const ip of raw) {
    if (!seen.has(ip)) { seen.add(ip); unique.push(ip); }
  }
  return { unique, duplicates: raw.length - unique.length };
}

/** Compute full metrics from real RTT samples + attempt count. */
export function computeMetrics(rtts: number[], attempts: number): DnsMetrics {
  const sorted = [...rtts].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = count ? sum / count : 0;
  const median = count ? sorted[Math.floor(count / 2)] : 0;
  const percentile = (p: number): number => (count ? sorted[Math.min(count - 1, Math.floor((p / 100) * count))] : 0);
  // jitter = mean absolute successive difference in ORIGINAL temporal order (not sorted!)
  // Sorting would erase the real timing variation, making jitter meaningless.
  let jsum = 0;
  for (let i = 1; i < rtts.length; i++) jsum += Math.abs(rtts[i] - rtts[i - 1]);
  const jitter = count > 1 ? jsum / (rtts.length - 1) : 0;
  const variance = count ? sorted.reduce((a, b) => a + (b - avg) ** 2, 0) / count : 0;
  return {
    count, attempts,
    min: count ? round(sorted[0], 1) : 0,
    avg: round(avg, 1),
    median: round(median, 1),
    max: count ? round(sorted[count - 1], 1) : 0,
    p95: round(percentile(95), 1),
    p99: round(percentile(99), 1),
    jitter: round(jitter, 1),
    stddev: round(Math.sqrt(variance), 1),
    packetLoss: attempts ? round(1 - count / attempts, 3) : 1,
    successRate: attempts ? round(count / attempts, 3) : 0,
  };
}

/** Gaming Score (0–100). Priority: jitter → reliability → latency → loss → consistency. NOT "lowest ping wins". */
export function gamingScore(m: DnsMetrics): number | null {
  if (m.count === 0) return null;
  let s = 100;
  s -= clamp(m.jitter * 3, 0, 30);              // jitter up to -30
  s -= (1 - m.successRate) * 35;                // reliability up to -35
  s -= clamp((m.avg - 20) * 0.4, 0, 25);        // latency over 20 ms up to -25
  s -= m.packetLoss * 20;                       // packet loss
  s -= clamp(m.stddev * 2, 0, 15);              // consistency
  return round(clamp(s, 0, 100));
}

export function stabilityGrade(score: number | null): StabilityGrade {
  if (score === null) return "F";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function compatibilityOf(m: DnsMetrics): Compatibility {
  if (m.count === 0) return "NOT_RECOMMENDED";
  if (m.successRate >= 0.95 && m.avg < 40 && m.jitter < 8) return "EXCELLENT";
  if (m.successRate >= 0.9 && m.avg < 70 && m.jitter < 15) return "VERY_GOOD";
  if (m.successRate >= 0.8) return "GOOD";
  if (m.successRate >= 0.6) return "ACCEPTABLE";
  if (m.successRate >= 0.4) return "POOR";
  return "NOT_RECOMMENDED";
}

/** Confidence from sample count + success rate. */
export function confidenceOf(m: DnsMetrics): number {
  return round(clamp(30 + Math.min(m.count, 6) * 7 + m.successRate * 30, 0, 99));
}

/** Classify DNS status — strict RCODE semantics (spec):
 *  VALID-DNS  = RCODE 0 (NOERROR) OR a 2xx answer on the DoH path (server resolves).
 *  DNS-RCODE3 = NXDOMAIN — the server answered but said the domain doesn't exist.
 *               For a query to a REAL test domain this is an inappropriate RCODE,
 *               so it is NOT counted as a gaming-valid success (it may be misconfigured
 *               or hijacked), only flagged and shown with its real measurements.
 *  DNS-RCODE2 = SERVFAIL (failure), DNS-RCODE5 = REFUSED (will not answer us),
 *  RESPONSIVE  = reachable via TCP/TLS with honest RTT data (RCODE unknown),
 *  UNREACHABLE = nothing — hidden. */
function classifyStatus(hasData: boolean, rcode: number | null, dohOk: boolean, attempts: number): DnsStatus {
  if (!attempts) return "NO_DATA";
  if (rcode !== null) {
    if (rcode === 0) return "VALID-DNS";
    if (rcode === 2) return "DNS-RCODE2";
    if (rcode === 3) return "DNS-RCODE3";
    if (rcode === 5) return "DNS-RCODE5";
    return "DNS-RCODE2"; // unknown RCODE = unreliable, not success
  }
  // 2xx answer on the DNS query path → a resolver service accepted the query.
  if (dohOk) return "VALID-DNS";
  if (hasData) return "RESPONSIVE";
  return "UNREACHABLE";
}

export function buildRecord(ip: string, samples: SampleSet, country: DnsCountry = "Jordan"): DnsRecord {
  const metrics = computeMetrics(samples.rtts, samples.attempts);
  const hasData = metrics.count > 0;
  const known = country === "Jordan" ? knownDnsEntry(ip) : null;
  const isSaudi = country === "Saudi Arabia";
  // Catalogue verification can confirm the DNS role only when the host also
  // responds on the user's current network. It never fabricates live metrics.
  const probedStatus = classifyStatus(hasData, samples.rcode, samples.dohOk, samples.attempts);
  const status = hasData && known?.role === "recursive" && probedStatus === "RESPONSIVE"
    ? "VALID-DNS"
    : probedStatus;
  // responded → shown in the results table (any server that answered network/DNS level).
  const responded =
    status === "VALID-DNS" || status === "DNS-RCODE3" || status === "DNS-RCODE2" ||
    status === "DNS-RCODE5" || status === "RESPONSIVE";
  // Tiering logic:
  //  • VALID-DNS  → verified resolver → full score, eligible for best/pair.
  //  • RESPONSIVE → host alive at network level, DNS role on :53 NOT verifiable
  //    from a browser → ranks by real RTT/jitter/packet-loss but with a −20%
  //    "unverified-role" penalty so verified VALID-DNS always wins over it.
  //  • RCODE3/2/5 → inappropriate RCODE ≠ success → flagged, shown, NEVER scored.
  //  • Catalogue state now factors into scoring:
  //      - confirmed recursive → no penalty
  //      - historical candidate → −15% penalty (evidence is weaker)
  //      - authoritative/infrastructure → excluded from gaming scoring & ranking
  const scoreBase = gamingScore(metrics);
  const unver = (samples.rcode === null) && status === "RESPONSIVE";
  const isHistorical = known?.catalogState === "historical";
  const isAuthOrInfra = known?.role === "authoritative" || known?.role === "infrastructure";
  const scoreable = (status === "VALID-DNS" || status === "RESPONSIVE") && !isAuthOrInfra;
  let finalScore = scoreable && scoreBase !== null ? scoreBase : null;
  if (finalScore !== null && unver) finalScore = Math.round(finalScore * 0.8);
  if (finalScore !== null && isHistorical) finalScore = Math.round(finalScore * 0.85);
  return {
    ip,
    isp: isSaudi ? saudiIspOf(ip) : inferIspAny(ip),
    prefix: prefixOf(ip),
    country,
    searchDomain: isSaudi ? saudiDomainOf(ip) : searchDomainAny(ip),
    status,
    metrics,
    gamingScore: finalScore,
    confidence: scoreable ? (unver ? Math.min(confidenceOf(metrics), 68) : confidenceOf(metrics)) : confidenceOf(metrics),
    grade: scoreable ? stabilityGrade(finalScore) : "F",
    compatibility: scoreable ? compatibilityOf(metrics) : "NOT_RECOMMENDED",
    hasData,
    responsive: responded,   // shown in results list
    ...((): { jordanPct: number; saudiPct: number } => {
      const rec = { hasData, ip, isp: isSaudi ? saudiIspOf(ip) : inferIspAny(ip), metrics } as DnsRecord;
      const est = isSaudi ? saudiRouteEstimate(rec, samples) : routeEstimate(rec, samples);
      return { jordanPct: est.jordan, saudiPct: est.saudi };
    })(),
    verification: {
      verified: known !== null,
      hostname: known?.hostname ?? null,
      historicalReliability: known?.historicalReliability ?? null,
      source: known?.source ?? null,
      role: known?.role ?? "unknown",
      asn: known?.asn ?? null,
      catalogPrefix: known?.catalogPrefix ?? null,
      catalogState: known?.catalogState ?? null,
    },
    io: {
      tx: samples.txCount,
      rx: samples.rxCount,
      txRate: samples.attempts > 0 ? round(samples.txCount / samples.attempts, 3) : 0,
      rxRate: samples.txCount > 0 ? round(samples.rxCount / samples.txCount, 3) : 0,
      bidirectional: samples.txCount > 0 && samples.rxCount > 0,
    },
  };
}

/** Choose the best pair: top score = primary; secondary = best on a DIFFERENT prefix (path diversity) if available. */
export function bestPair(ranked: DnsRecord[]): DnsPair | null {
  const scored = ranked.filter((r) => r.gamingScore !== null);
  if (scored.length === 0) return null;
  const primary = scored[0];
  let secondary: DnsRecord | null = scored.find((r) => r.prefix !== primary.prefix) ?? scored[1] ?? null;
  if (!secondary || secondary === primary) secondary = null;
  if (!secondary) return null;
  const p = primary.gamingScore ?? 0;
  const s = secondary.gamingScore ?? 0;
  // pair score rewards combined quality + redundancy + reliability
  const pairScore = round(clamp((p * 0.55 + s * 0.45) + (primary.prefix !== secondary.prefix ? 6 : 0) + (primary.metrics.successRate + secondary.metrics.successRate) * 4, 0, 100));
  return { primary, secondary, pairScore, redundant: primary.prefix !== secondary.prefix };
}

/** Best DNS per ISP (only among scored records). */
export function ispBests(records: DnsRecord[], country: DnsCountry = "Jordan"): IspBest[] {
  const isps = country === "Saudi Arabia" ? SAUDI_ISPS : JORDAN_ISPS;
  const pool = isps as string[];
  return pool.map((isp) => {
    const ofIsp = records.filter((r) => r.isp === isp && r.gamingScore !== null).sort((a, b) => (b.gamingScore ?? 0) - (a.gamingScore ?? 0));
    return { isp, best: ofIsp[0] ?? null, count: records.filter((r) => r.isp === isp).length };
  });
}

/** Full analysis from raw master list + real samples map. */
export function analyze(master: string[], samples: Map<string, SampleSet>, country: DnsCountry = "Jordan"): DnsAnalysis {
  const { unique, duplicates } = dedupeMaster(master);
  const records = unique.map((ip) => buildRecord(ip, samples.get(ip) ?? {
    rtts: [], attempts: 0, rcode: null, dohOk: false, txCount: 0, rxCount: 0,
  }, country));
  const responded = records.filter((r) => r.responsive);
  // Tier: VALID-DNS (verified) = 0, RESPONSIVE (alive, DNS role unverified) = 1.
  // Verified resolvers ALWAYS outrank merely-alive hosts regardless of their raw score.
  const tierOf = (r: DnsRecord): number => (r.status === "VALID-DNS" ? 0 : 1);
  const ranked = responded
    .filter((r) => r.gamingScore !== null)
    .sort((a, b) =>
      tierOf(a) - tierOf(b) ||
      (b.gamingScore ?? 0) - (a.gamingScore ?? 0) ||
      a.metrics.avg - b.metrics.avg ||
      a.metrics.jitter - b.metrics.jitter);
  // Table shows every responder: tier 0 (VALID), tier 1 (RESPONSIVE), then flagged
  // RCODE3/2/5 rows (score = null) at the bottom.
  const displayOrder = (r: DnsRecord): number =>
    r.status === "VALID-DNS" ? 0 : r.status === "RESPONSIVE" ? 1 : 2;
  const display = [...responded].sort((a, b) =>
    displayOrder(a) - displayOrder(b) ||
    (b.gamingScore ?? -1) - (a.gamingScore ?? -1) ||
    a.metrics.avg - b.metrics.avg);
  // Shortest network path = lowest average latency among scoreable DNS.
  const shortestPath = [...ranked].sort((a, b) => a.metrics.avg - b.metrics.avg || a.metrics.jitter - b.metrics.jitter)[0] ?? null;
  return {
    totalRaw: master.length,
    unique: unique.length,
    duplicatesMerged: duplicates,
    analyzed: ranked.length,
    reachable: records.filter((r) => r.hasData).length,
    duplex: records.filter((r) => r.io.bidirectional).length,
    txOnly: records.filter((r) => r.io.tx > 0 && r.io.rx === 0).length,
    records: responded,
    ranked,
    display,
    top: ranked[0] ?? null,
    second: ranked[1] ?? null,
    pair: bestPair(ranked),
    shortestPath,
    ispBests: ispBests(ranked, country),
    jordanMode: country === "Jordan",
  };
}

export { MASTER_DNS, SAUDI_DNS };
