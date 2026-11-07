// DNS Gaming Intelligence — types
/** Full DNS status classification (RCODE-aware). */
export type DnsStatus =
  | "VALID-DNS"      // RCODE 0 (NOERROR) — server resolved the query
  | "DNS-RCODE2"     // SERVFAIL — server error
  | "DNS-RCODE3"     // NXDOMAIN — domain not found (still a valid resolver)
  | "DNS-RCODE5"     // REFUSED — server refused (common for ISP resolvers)
  | "RESPONSIVE"     // reachable (TCP/TLS) but not confirmed as DNS
  | "TIMEOUT"        // no response within timeout
  | "UNREACHABLE"    // connection refused / no route
  | "NO_DATA";       // not probed yet
export type Compatibility = "EXCELLENT" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE" | "POOR" | "NOT_RECOMMENDED";
export type StabilityGrade = "A" | "B" | "C" | "D" | "F";

export interface DnsCatalogVerification {
  verified: boolean;
  hostname: string | null;
  historicalReliability: number | null;
  source: string | null;
  role: "recursive" | "authoritative" | "infrastructure" | "unknown";
  asn: string | null;
  catalogPrefix: string | null;
  catalogState: "confirmed" | "historical" | null;
}

export interface DnsMetrics {
  count: number;        // successful samples
  attempts: number;     // total probes
  min: number;
  avg: number;
  median: number;
  max: number;
  p95: number;
  p99: number;
  jitter: number;       // mean abs successive difference
  stddev: number;
  packetLoss: number;   // 0..1
  successRate: number;  // 0..1
}

export type DnsCountry = "Jordan" | "Saudi Arabia";

export interface DnsRecord {
  ip: string;
  isp: string;
  prefix: string;
  country: DnsCountry;
  searchDomain: string;
  status: DnsStatus;
  metrics: DnsMetrics;
  gamingScore: number | null;
  confidence: number;     // 0..100
  grade: StabilityGrade;
  compatibility: Compatibility;
  hasData: boolean;
  /** responsive = had at least one successful probe sample. */
  responsive: boolean;
  /** Estimated path distribution (%) — Jordanian network vs Saudi transit. */
  jordanPct: number;   // % of modeled path through Jordanian network
  saudiPct: number;    // % of modeled path through Saudi transit
  /** External catalogue evidence; separate from the current-network probe. */
  verification: DnsCatalogVerification;
  /** Confirmed browser-level send/receive evidence. */
  io: {
    tx: number;
    rx: number;
    txRate: number;
    rxRate: number;
    bidirectional: boolean;
  };
}

export interface DnsPair {
  primary: DnsRecord;
  secondary: DnsRecord;
  pairScore: number;
  redundant: boolean;     // different prefix (path diversity)
}

export interface IspBest { isp: string; best: DnsRecord | null; count: number; }

export interface DnsAnalysis {
  totalRaw: number;       // master dataset size
  unique: number;         // after dedup
  duplicatesMerged: number;
  analyzed: number;       // with data
  reachable: number;
  duplex: number;
  txOnly: number;
  records: DnsRecord[];   // all unique
  ranked: DnsRecord[];    // only scoreable, sorted desc
  display: DnsRecord[];   // every server that responded (incl. flagged RCODE rows)
  top: DnsRecord | null;
  second: DnsRecord | null;
  pair: DnsPair | null;
  /** responsive DNS with the shortest network path (lowest avg latency). */
  shortestPath: DnsRecord | null;
  ispBests: IspBest[];
  jordanMode: boolean;
}

export interface SampleSet {
  rtts: number[];
  attempts: number;
  rcode: number | null;   // DNS RCODE from DoH (0=NOERROR, 2=SERVFAIL, 3=NXDOMAIN, 5=REFUSED)
  dohOk: boolean;         // DoH path responded (server is likely a DNS resolver)
  txCount: number;        // requests dispatched by the browser
  rxCount: number;        // confirmed HTTP/DoH responses received
}
