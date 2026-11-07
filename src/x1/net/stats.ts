// ════════════════════════════════════════════════════════════════
// STATISTICAL ENGINE — latency, jitter, percentiles, outliers,
// reliability, confidence, decomposable scoring.
// ════════════════════════════════════════════════════════════════
import type {
  RawSample, DerivedMetrics, ConfidenceInfo, ConfidenceLevel,
  Scores, VerificationEvidence, Freshness,
} from "./types";
import { CACHE_TTL } from "./types";

const round = (n: number, d = 1): number => (d === 0 ? Math.round(n) : Math.round(n * 10 ** d) / 10 ** d);

/* ── Percentile (nearest-rank) ────────────────────────────────── */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

/* ── Outlier detection (IQR fence) ───────────────────────────── */
export function detectOutliers(values: number[]): { clean: number[]; outliers: number[] } {
  if (values.length < 4) return { clean: [...values], outliers: [] };
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const clean: number[] = [];
  const outliers: number[] = [];
  for (const v of values) {
    if (v >= lo && v <= hi) clean.push(v);
    else outliers.push(v);
  }
  return { clean, outliers };
}

/* ── Derive full metrics from raw samples ─────────────────────── */
export function deriveMetrics(samples: RawSample[]): DerivedMetrics {
  const successes = samples.filter((s) => s.ok).map((s) => s.ms);
  const timeouts = samples.filter((s) => !s.ok && s.detail === "TIMEOUT").length;
  const fails = samples.filter((s) => !s.ok && s.detail !== "TIMEOUT").length;
  const count = samples.length;
  if (count === 0) {
    return {
      sampleCount: 0, successCount: 0, failCount: 0, timeoutCount: 0,
      min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0,
      jitter: 0, variance: 0, stdDev: 0,
      successRate: 0, timeoutRate: 0, outliers: [], filteredMean: 0,
    };
  }
  const sorted = [...successes].sort((a, b) => a - b);
  const mean = successes.length > 0 ? successes.reduce((a, b) => a + b, 0) / successes.length : 0;

  // Jitter = mean absolute successive difference (successful samples only, in temporal order).
  let jitterSum = 0;
  for (let i = 1; i < successes.length; i++) jitterSum += Math.abs(successes[i] - successes[i - 1]);
  const jitter = successes.length > 1 ? jitterSum / (successes.length - 1) : 0;

  const variance = successes.length > 0 ? successes.reduce((a, b) => a + (b - mean) ** 2, 0) / successes.length : 0;

  const { clean, outliers } = detectOutliers(successes);
  const filteredMean = clean.length > 0 ? clean.reduce((a, b) => a + b, 0) / clean.length : mean;

  return {
    sampleCount: count,
    successCount: successes.length,
    failCount: fails,
    timeoutCount: timeouts,
    min: sorted.length > 0 ? round(sorted[0]) : 0,
    max: sorted.length > 0 ? round(sorted[sorted.length - 1]) : 0,
    mean: round(mean),
    p50: round(percentile(sorted, 50)),
    p90: round(percentile(sorted, 90)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    jitter: round(jitter, 2),
    variance: round(variance, 2),
    stdDev: round(Math.sqrt(variance), 2),
    successRate: count > 0 ? round(successes.length / count * 100, 1) : 0,
    timeoutRate: count > 0 ? round(timeouts / count * 100, 1) : 0,
    outliers: outliers.map((v) => round(v)),
    filteredMean: round(filteredMean),
  };
}

/* ── Confidence (§10) — independent from performance ─────────── */
export function computeConfidence(
  metrics: DerivedMetrics,
  verification: VerificationEvidence,
  ageMs: number,
): ConfidenceInfo {
  const factors: ConfidenceInfo["factors"] = [];

  // Factor 1: sample count (max 30)
  const sampleScore = Math.min(30, metrics.sampleCount * 3);
  factors.push({
    label: "Sample count",
    weight: sampleScore,
    reason: `${metrics.sampleCount} samples collected`,
  });

  // Factor 2: verification coverage (max 30)
  const checks = [
    verification.dnsUdp === "PASS", verification.dnsTcp === "PASS",
    verification.nxdomain === "PASS", verification.dnssec === "VALIDATED" || verification.dnssec === "SUPPORTED",
  ];
  const passed = checks.filter(Boolean).length;
  const verifyScore = (passed / checks.length) * 30;
  factors.push({
    label: "Verification coverage",
    weight: verifyScore,
    reason: `${passed}/${checks.length} protocol checks passed`,
  });

  // Factor 3: consistency (max 20)
  const consistency = metrics.successRate >= 90 ? 20 : metrics.successRate >= 70 ? 14 : metrics.successRate >= 50 ? 8 : 3;
  factors.push({
    label: "Consistency",
    weight: consistency,
    reason: `${metrics.successRate}% success rate`,
  });

  // Factor 4: freshness (max 20)
  let freshness = 20;
  let freshnessLabel = "live";
  if (ageMs > CACHE_TTL.STALE) { freshness = 5; freshnessLabel = "expired"; }
  else if (ageMs > CACHE_TTL.RECENT) { freshness = 10; freshnessLabel = "stale"; }
  else if (ageMs > CACHE_TTL.LIVE) { freshness = 15; freshnessLabel = "aging"; }
  factors.push({ label: "Freshness", weight: freshness, reason: freshnessLabel });

  const total = factors.reduce((a, f) => a + f.weight, 0);
  const level: ConfidenceLevel = total >= 75 ? "HIGH" : total >= 50 ? "MEDIUM" : total >= 25 ? "LOW" : "INSUFFICIENT";
  return { level, score: Math.round(Math.min(99, total)), factors };
}

/* ── Decomposable scoring (§34, §35) ──────────────────────────── */
export function computeScores(metrics: DerivedMetrics, verification: VerificationEvidence): Scores {
  const perf = Math.max(0, Math.min(100,
    100 - Math.max(0, metrics.p50 - 10) * 0.8 - metrics.jitter * 3 - (metrics.successRate < 80 ? 15 : 0),
  ));
  const reliability = Math.max(0, Math.min(100,
    metrics.successRate * 0.7 + (verification.nxdomain === "PASS" ? 15 : 0) + (verification.dnsUdp === "PASS" ? 15 : 0),
  ));
  const checks = [verification.dnsUdp === "PASS", verification.dnsTcp === "PASS", verification.nxdomain === "PASS", verification.dnssec === "VALIDATED" || verification.dnssec === "SUPPORTED"];
  const compatibility = (checks.filter(Boolean).length / checks.length) * 100;
  const confidenceScore = Math.min(100, metrics.sampleCount * 8 + checks.filter(Boolean).length * 12);
  const overall = Math.round(perf * 0.3 + reliability * 0.3 + compatibility * 0.2 + confidenceScore * 0.2);
  return {
    performance: Math.round(perf),
    reliability: Math.round(reliability),
    compatibility: Math.round(compatibility),
    confidence: Math.round(confidenceScore),
    overall,
  };
}

/* ── Freshness (§23) ─────────────────────────────────────────── */
export function freshnessOf(updatedAt: number, now: number = Date.now()): Freshness {
  const age = now - updatedAt;
  if (age <= CACHE_TTL.LIVE) return "LIVE";
  if (age <= CACHE_TTL.RECENT) return "RECENT";
  if (age <= CACHE_TTL.STALE) return "STALE";
  return "EXPIRED";
}

/* ── Network behavior classification (§33) ───────────────────── */
export function classifyBehavior(metrics: DerivedMetrics): "STABLE" | "MOSTLY_STABLE" | "VARIABLE" | "UNSTABLE" | "INSUFFICIENT_DATA" {
  if (metrics.sampleCount < 3) return "INSUFFICIENT_DATA";
  const cv = metrics.mean > 0 ? metrics.stdDev / metrics.mean : 0;
  if (metrics.successRate >= 95 && cv < 0.15) return "STABLE";
  if (metrics.successRate >= 85 && cv < 0.30) return "MOSTLY_STABLE";
  if (metrics.successRate >= 60 && cv < 0.60) return "VARIABLE";
  return "UNSTABLE";
}

/* ── Pre-flight validation (§3) ──────────────────────────────── */
export function validateIp(ip: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (!v4.test(ip)) return false;
  return ip.split(".").every((o) => { const n = +o; return n >= 0 && n <= 255; });
}

export function validateIpv6(ip: string): boolean {
  if (!ip.includes(":")) return false;
  return /^[0-9a-fA-F:]+$/.test(ip) && (ip.match(/:/g) || []).length >= 2;
}

export function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function validateEndpoint(endpoint: { host: string; port: number; protocol: string }): { valid: boolean; reason?: string } {
  if (!validateIp(endpoint.host) && !validateIpv6(endpoint.host)) return { valid: false, reason: "INVALID_IP" };
  if (!validatePort(endpoint.port)) return { valid: false, reason: "INVALID_PORT" };
  if (!["dns", "tcp", "http", "https", "dns-tcp"].includes(endpoint.protocol)) return { valid: false, reason: "INVALID_PROTOCOL" };
  return { valid: true };
}

/** Stable endpoint ID: normalizedIP:port:protocol */
export function endpointId(host: string, port: number, protocol: string): string {
  return `${host}:${port}:${protocol}`;
}

/** Deterministic result fingerprint (§41) */
export function resultFingerprint(endpointId: string, policyVersion: string, timestampBucket: number): string {
  return `${endpointId}|${policyVersion}|${timestampBucket}`;
}

/** Timestamp bucket (5-minute granularity) for dedup */
export function timestampBucket(at: number): number {
  return Math.floor(at / (5 * 60_000));
}
