// ════════════════════════════════════════════════════════════════
// ALYAZOURI NETWORK INTELLIGENCE ENGINE — Core Types
// PUBG MOBILE GLOBAL · Network Measurement & Verification
// ════════════════════════════════════════════════════════════════

export type Protocol = "dns" | "tcp" | "http" | "https" | "dns-tcp";
export type EndpointKind = "dns" | "proxy";

/** Stable endpoint identity: normalizedIP:port:protocol */
export interface Endpoint {
  id: string;
  host: string;
  port: number;
  protocol: Protocol;
  kind: EndpointKind;
  label?: string;
  isp?: string;
  asn?: string;
  country?: string;
  catalogPrefix?: string | null;
}

/* ── Health State Machine (§11) ─────────────────────────────── */
export type HealthState =
  | "NEW" | "QUEUED" | "TESTING" | "REACHABLE"
  | "DNS_PASS" | "DNS_PARTIAL" | "DNS_FAILED"
  | "TCP_PASS" | "TCP_FAILED"
  | "DNSSEC_PASS" | "DNSSEC_UNKNOWN"
  | "NXDOMAIN_PASS" | "NXDOMAIN_FAILED"
  | "STABLE" | "UNSTABLE"
  | "VERIFIED" | "STALE" | "EXPIRED";

export const HEALTH_STATES: HealthState[] = [
  "NEW", "QUEUED", "TESTING", "REACHABLE",
  "DNS_PASS", "DNS_PARTIAL", "DNS_FAILED",
  "TCP_PASS", "TCP_FAILED",
  "DNSSEC_PASS", "DNSSEC_UNKNOWN",
  "NXDOMAIN_PASS", "NXDOMAIN_FAILED",
  "STABLE", "UNSTABLE",
  "VERIFIED", "STALE", "EXPIRED",
];

/* ── Failure reasons (§44) ───────────────────────────────────── */
export type FailureReason =
  | "INVALID_IP" | "INVALID_PORT" | "INVALID_PROTOCOL"
  | "TIMEOUT" | "CONNECTION_REFUSED"
  | "DNS_SERVFAIL" | "DNS_REFUSED" | "NXDOMAIN"
  | "CORS_BLOCKED" | "BROWSER_UNSUPPORTED"
  | "BACKEND_UNAVAILABLE" | "TLS_FAILURE" | "PROTOCOL_UNSUPPORTED"
  | "CIRCUIT_OPEN" | "UNKNOWN";

/* ── Raw measurement (§39) ───────────────────────────────────── */
export interface RawSample {
  ms: number;
  at: number;
  ok: boolean;
  stage: "quick" | "deep" | "stability";
  detail?: string;
}

/* ── Derived metrics (§5, §8) ─────────────────────────────────── */
export interface DerivedMetrics {
  sampleCount: number;
  successCount: number;
  failCount: number;
  timeoutCount: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  jitter: number;
  variance: number;
  stdDev: number;
  successRate: number;
  timeoutRate: number;
  outliers: number[];
  filteredMean: number;
}

/* ── Verification evidence (§38) ─────────────────────────────── */
export interface VerificationEvidence {
  dnsUdp: "PASS" | "FAIL" | "UNKNOWN" | "UNSUPPORTED";
  dnsTcp: "PASS" | "FAIL" | "UNKNOWN" | "UNSUPPORTED";
  dnssec: "VALIDATED" | "SUPPORTED" | "NOT_VALIDATED" | "UNSUPPORTED" | "UNKNOWN";
  nxdomain: "PASS" | "FAIL" | "UNKNOWN";
  httpConnect: "PASS" | "FAIL" | "UNKNOWN" | "UNSUPPORTED";
  tlsHandshake: "PASS" | "FAIL" | "UNKNOWN" | "UNSUPPORTED";
}

/* ── Confidence (§10) ────────────────────────────────────────── */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export interface ConfidenceInfo {
  level: ConfidenceLevel;
  score: number;
  factors: { label: string; weight: number; reason: string }[];
}

/* ── Decomposable scores (§34, §35) ──────────────────────────── */
export interface Scores {
  performance: number;
  reliability: number;
  compatibility: number;
  confidence: number;
  overall: number;
}

/* ── Freshness (§23) ─────────────────────────────────────────── */
export type Freshness = "LIVE" | "RECENT" | "STALE" | "EXPIRED";

/* ── Network behavior classification (§33) ───────────────────── */
export type NetworkBehavior = "STABLE" | "MOSTLY_STABLE" | "VARIABLE" | "UNSTABLE" | "INSUFFICIENT_DATA";

/* ── Proxy classification (§13) ──────────────────────────────── */
export type ProxyProtocol = "TCP_ONLY" | "HTTP" | "HTTPS" | "HTTP_CONNECT" | "SOCKS" | "UNKNOWN" | "FAILED" | "TIMEOUT" | "REFUSED" | "UNSUPPORTED";

/* ── Complete endpoint record ─────────────────────────────────── */
export interface EndpointRecord {
  endpoint: Endpoint;
  state: HealthState;
  failureReason?: FailureReason;
  raw: RawSample[];
  metrics: DerivedMetrics | null;
  verification: VerificationEvidence;
  scores: Scores | null;
  confidence: ConfidenceInfo | null;
  networkBehavior: NetworkBehavior;
  proxyProtocol?: ProxyProtocol;
  updatedAt: number;
  policyVersion: string;
}

/* ── Scan lifecycle ──────────────────────────────────────────── */
export type ScanPhase = "idle" | "pass1" | "pass2" | "complete" | "paused" | "stopped" | "error";

export interface ScanProgress {
  phase: ScanPhase;
  total: number;
  processed: number;
  queued: number;
  active: number;
  verified: number;
  partial: number;
  failed: number;
  timeout: number;
  endpointsPerSecond: number;
  elapsedMs: number;
  activeWorkers: number;
}

export interface ScanEvent {
  type: "row" | "progress" | "phase" | "error" | "complete";
  at: number;
  data: unknown;
}

/* ── Ranking profiles (§36) ──────────────────────────────────── */
export type RankingProfile =
  | "FASTEST" | "MOST_STABLE" | "MOST_RELIABLE"
  | "LOWEST_P95" | "LOWEST_JITTER"
  | "BEST_VERIFIED" | "BEST_COMPATIBILITY";

/* ── Test policy versioning (§40) ────────────────────────────── */
export const TEST_POLICY_VERSION = {
  dns: "DNS-POLICY-v3.2",
  proxy: "PROXY-POLICY-v2.1",
} as const;

/* ── Cache constants (§22) ───────────────────────────────────── */
export const CACHE_TTL = {
  LIVE: 60_000,
  RECENT: 10 * 60_000,
  STALE: 60 * 60_000,
} as const;

/* ── Resource limits (§43) ───────────────────────────────────── */
export const LIMITS = {
  MAX_ENDPOINTS: 5000,
  MAX_WORKERS: 64,
  MAX_RETRIES: 3,
  MAX_QUEUE: 5000,
  MAX_SAMPLES: 20,
  MAX_SCAN_MS: 10 * 60_000,
  CIRCUIT_THRESHOLD: 3,
  CIRCUIT_COOLDOWN_MS: 15_000,
} as const;

/* ── DNS test domains ────────────────────────────────────────── */
export const DNS_TEST_DOMAINS = ["google.com", "cloudflare.com", "github.com"] as const;
export const DNS_NXDOMAIN_SUFFIX = ".nonexistent-alyazouri-test" as const;
