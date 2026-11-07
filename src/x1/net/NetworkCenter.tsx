// ════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — NETWORK INTELLIGENCE CENTER
//
// The REAL test runs on the edge (netlify/functions/proxy-scan.mjs):
//   • DNS  → a genuine DNS query over UDP/53 to the resolver (node:dns) with the
//            real answer/RCODE, or a real TCP connect on 443 as ALIVE proof.
//   • PROXY→ a genuine HTTP CONNECT handshake through the proxy.
// The browser probes add a second, real signal (DoH + HTTPS RTT).
//
// Status vocabulary = the project's own (i18n dns_st_*). "UNSUPPORTED" is never
// shown: when no evidence could be gathered in time the row is a TIMEOUT.
// ════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../LanguageContext";
import { t } from "../i18n";
import { useNetworkDetection } from "../network/useNetwork";
import { endpointCity, distanceTo } from "../geo/distances";
import { useGeolocation } from "../geo/useGeolocation";
import {
  MASTER_DNS, MASTER_DNS_V6, fetchHost, inferIspAny, knownDnsEntry, searchDomainAny,
} from "../dns/dataset";
import { PROXY_POOL, PROXY_DUPLICATES_REMOVED, PROXY_RAW_COUNT, type ProxyEntry } from "../proxy/pool";
import { fetchNodes, checkTcp } from "./CheckHost";
import { GlobalScan } from "./GlobalScan";
import { CopyValue } from "./copy";
import { FavoriteToggle, useFavorites } from "./favorites";
import { favoritesFirst } from "../../lib/favorites";
import { fetchJsonWithHardTimeout } from "../../lib/fetch-timeout";

/* ─────────────────── Tuning ─────────────────── */
const SCREEN_DEADLINE_MS = 1100;
const SCREEN_BATCH = 48;
const REFINE_TOP = 10;
const REFINE_ROUNDS = 3;
const EDGE_CHUNK = 200;
/** Server-side sampling rounds per endpoint → real jitter for every address. */
const EDGE_ROUNDS = 3;
/** Hard client cap on the edge-probe POST so the scan can never freeze on it.
 *  The edge side finishes in ~one probe-deadline wave; if the hosting plan's
 *  function cap kills it (10s on the free tier), fall back quickly. */
const EDGE_FETCH_TIMEOUT_MS = 15000;

/* ─────────────────── Pipeline statuses (internal, never shown raw) ─────────────────── */
export type EndpointStatus =
  | "WORKING" | "PARTIAL" | "REACHABLE" | "TIMEOUT"
  | "FAILED" | "UNSUPPORTED" | "UNAVAILABLE" | "AUTH_REQUIRED" | "UNKNOWN";

/** What the user actually sees — "UNSUPPORTED" is never displayed. */
const displayStatus = (status: EndpointStatus): EndpointStatus =>
  status === "UNSUPPORTED" ? "TIMEOUT" : status;

export const STATUS_META: Record<EndpointStatus, { icon: string; label: string; className: string }> = {
  WORKING: { icon: "✅", label: "WORKING", className: "text-emerald-300 bg-emerald-500/10 border-emerald-400/25" },
  PARTIAL: { icon: "🟡", label: "PARTIAL", className: "text-amber-300 bg-amber-500/10 border-amber-400/25" },
  REACHABLE: { icon: "🔵", label: "REACHABLE", className: "text-sky-300 bg-sky-500/10 border-sky-400/25" },
  TIMEOUT: { icon: "⏱️", label: "TIMEOUT", className: "text-slate-300 bg-slate-500/10 border-slate-400/25" },
  FAILED: { icon: "❌", label: "FAILED", className: "text-red-300 bg-red-500/10 border-red-400/25" },
  UNSUPPORTED: { icon: "⏱️", label: "TIMEOUT", className: "text-slate-300 bg-slate-500/10 border-slate-400/25" },
  UNAVAILABLE: { icon: "❓", label: "UNKNOWN", className: "text-white/60 bg-white/5 border-white/10" },
  AUTH_REQUIRED: { icon: "🔐", label: "AUTH_REQUIRED", className: "text-orange-300 bg-orange-500/10 border-orange-400/25" },
  UNKNOWN: { icon: "❓", label: "UNKNOWN", className: "text-white/60 bg-white/5 border-white/10" },
};

/* ─────────────────── The project's DNS vocabulary ─────────────────── */
export type DnsLabel = "VALID-DNS" | "NXDOMAIN" | "SERVFAIL" | "REFUSED" | "ALIVE" | "TIMEOUT" | "UNREACHABLE";
type DnsLabelKey = "dns_st_valid" | "dns_st_rcode3" | "dns_st_rcode2" | "dns_st_rcode5" | "dns_st_responsive" | "dns_st_timeout" | "dns_st_unreachable";
interface DnsLabelMeta { key: DnsLabelKey | null; icon: string; className: string; factor: number | null; dim: boolean }

const DNS_LABEL_META: Record<DnsLabel, DnsLabelMeta> = {
  "VALID-DNS": { key: "dns_st_valid", icon: "✅", className: "text-emerald-300 bg-emerald-500/10 border-emerald-400/25", factor: 1, dim: false },
  NXDOMAIN: { key: "dns_st_rcode3", icon: "🔵", className: "text-sky-300 bg-sky-500/10 border-sky-400/25", factor: 0.6, dim: true },
  SERVFAIL: { key: "dns_st_rcode2", icon: "⚠️", className: "text-amber-300 bg-amber-500/10 border-amber-400/25", factor: 0.6, dim: true },
  REFUSED: { key: "dns_st_rcode5", icon: "🟡", className: "text-yellow-300 bg-yellow-500/10 border-yellow-400/25", factor: 0.6, dim: true },
  ALIVE: { key: "dns_st_responsive", icon: "🟠", className: "text-orange-300 bg-orange-500/10 border-orange-400/25", factor: 0.8, dim: false }, // −20%
  TIMEOUT: { key: "dns_st_timeout", icon: "⏱️", className: "text-slate-300 bg-slate-500/10 border-slate-400/25", factor: 0, dim: true },
  UNREACHABLE: { key: "dns_st_unreachable", icon: "❌", className: "text-red-300 bg-red-500/10 border-red-400/25", factor: 0, dim: true },
};

/** A real DNS answer (RCODE) or a real aliveness proof → the project's label. */
export function dnsLabelOf(rcode: number | null, alive: boolean, timeout: boolean, refused: boolean): DnsLabel {
  if (rcode === 0) return "VALID-DNS";
  if (rcode === 3) return "NXDOMAIN";
  if (rcode === 2) return "SERVFAIL";
  if (rcode === 5) return "REFUSED";
  if (rcode !== null) return "VALID-DNS";
  if (alive) return "ALIVE";
  if (refused) return "UNREACHABLE";
  if (timeout) return "TIMEOUT";
  return "TIMEOUT";
}

/* ─────────────────── Filtering classification ───────────────────
   Derived ONLY from real RCODE evidence against a known-good domain
   (pubg.com, which always exists globally). Nothing is guessed:
     • OPEN     → RCODE 0: resolves correctly → works, unfiltered
     • FILTERED → REFUSED (refuses queries) or NXDOMAIN for a domain that
                  DOES exist → the resolver blocks/censors/filters
     • BROKEN   → SERVFAIL, or ALIVE (host up on 443 but port 53 gave no
                  usable DNS answer) → not usable as a resolver
     • OFFLINE  → TIMEOUT / UNREACHABLE → dead on this scan                */
export type FilterState = "OPEN" | "FILTERED" | "BROKEN" | "OFFLINE";

export function filterStateOf(label: DnsLabel): FilterState {
  switch (label) {
    case "VALID-DNS": return "OPEN";
    case "REFUSED":
    case "NXDOMAIN": return "FILTERED";
    case "SERVFAIL":
    case "ALIVE": return "BROKEN";
    case "TIMEOUT":
    case "UNREACHABLE":
    default: return "OFFLINE";
  }
}

interface FilterMeta { ar: string; en: string; icon: string; className: string }
const FILTER_META: Record<FilterState, FilterMeta> = {
  OPEN: { ar: "غير مفلتر", en: "Unfiltered", icon: "🟢", className: "text-emerald-300 bg-emerald-500/10 border-emerald-400/25" },
  FILTERED: { ar: "مفلتر", en: "Filtered", icon: "🚫", className: "text-yellow-300 bg-yellow-500/10 border-yellow-400/25" },
  BROKEN: { ar: "معطّل", en: "Broken", icon: "⚠️", className: "text-amber-300 bg-amber-500/10 border-amber-400/25" },
  OFFLINE: { ar: "غير متصل", en: "Offline", icon: "⏱️", className: "text-slate-300 bg-slate-500/10 border-slate-400/25" },
};

/* ─────────────────── Host records from the real datasets ─────────────────── */
export interface DnsHost {
  ip: string; isp: string; asn: string | null;
  role: "recursive" | "authoritative" | "infrastructure" | "unknown";
  catalogState: "confirmed" | "historical" | null; catalogPrefix: string | null;
  reliability: number | null; hostname: string | null; searchDomain: string;
}

export const DNS_HOSTS: DnsHost[] = [...MASTER_DNS, ...MASTER_DNS_V6].map((ip) => {
  const known = knownDnsEntry(ip);
  return {
    ip, isp: inferIspAny(ip), asn: known?.asn ?? null, role: known?.role ?? "unknown",
    catalogState: known?.catalogState ?? null, catalogPrefix: known?.catalogPrefix ?? null,
    reliability: known?.historicalReliability ?? null, hostname: known?.hostname ?? null,
    searchDomain: searchDomainAny(ip),
  };
});
const SELECTABLE = DNS_HOSTS.filter((h) => h.role !== "authoritative" && h.role !== "infrastructure");

/* ─────────────────── Results ─────────────────── */
export type DnssecState = "VALIDATING" | "NOT_VALIDATING" | "UNVERIFIED";
/** Lower rank = preferred for security-aware recommendations. */
export function dnssecRankOf(state: DnssecState): number {
  return state === "VALIDATING" ? 0 : state === "UNVERIFIED" ? 1 : 2;
}
export interface DnsResult {
  host: DnsHost; label: DnsLabel; evidence: string; rcode: number | null;
  /** Real DNSSEC capability evidence from dnssec-failed.org. */
  dnssec: DnssecState; dnssecEvidence: string; dnssecMs: number | null;
  samples: number[]; avg: number | null; jitter: number | null; p95: number | null;
  score: number | null; km: number | null; city: string;
}
export interface ProxyResult {
  entry: ProxyEntry; status: EndpointStatus; evidence: string;
  samples: number[]; avg: number | null; jitter: number | null; p95: number | null;
  score: number | null; km: number | null; city: string; source: string;
}

/* ─────────────────── Helpers ─────────────────── */
const jitterOf = (v: number[]): number => {
  if (v.length < 2) return 0;
  let s = 0;
  for (let i = 1; i < v.length; i += 1) s += Math.abs(v[i] - v[i - 1]);
  return Math.round((s / (v.length - 1)) * 10) / 10;
};
const median = (v: number[]): number => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const p95Of = (v: number[]): number => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
};
const isFiniteRtt = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0;
const isSecurePage = (): boolean => typeof window !== "undefined" && window.location.protocol === "https:";
const scoreFrom = (samples: number[], factor: number | null, jitter: number | null): number | null =>
  factor === null || !samples.length ? null
    : Math.max(0, Math.round(factor * (100 - Math.min(60, (samples.reduce((a, b) => a + b, 0) / samples.length) / 6) - Math.min(20, (jitter ?? 0) * 1.5))));

/* ════════════════ STAGE 1 — REAL TESTS ════════════════ */
export type ProbeKind = "answered" | "timeout" | "network-error" | "unavailable";
export interface ProbeOutcome { kind: ProbeKind; rttMs: number | null; httpStatus: number | null; dnsRcode: number | null; evidence: string }
const outcome = (p: Partial<ProbeOutcome> & { kind: ProbeKind }): ProbeOutcome => ({
  rttMs: null, httpStatus: null, dnsRcode: null, evidence: p.evidence ?? p.kind.toUpperCase(), ...p,
});

function firstAnswered(promises: Promise<ProbeOutcome>[]): Promise<ProbeOutcome | null> {
  return new Promise((resolve) => {
    let pending = promises.length, settled = false;
    const done = (v: ProbeOutcome | null) => { if (!settled) { settled = true; resolve(v); } };
    for (const p of promises) {
      void p.then((out) => {
        pending -= 1;
        if (settled) return;
        if (out.kind === "answered") done(out);
        else if (pending === 0) done(null);
      });
    }
  });
}

export interface HostProbe { best: ProbeOutcome; all: ProbeOutcome[] }

/** Browser probes (DoH + HTTPS/HTTP) racing on one shared deadline. */
async function probeHost(host: string, deadlineMs: number, waitForAll: boolean): Promise<HostProbe> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), deadlineMs);
  const started = performance.now();
  const run = (url: string, doh: boolean): Promise<ProbeOutcome> =>
    fetch(url, {
      mode: doh ? "cors" : "no-cors", cache: "no-store", signal: ctrl.signal,
      ...(doh ? { headers: { accept: "application/dns-json" } } : {}),
    })
      .then(async (res): Promise<ProbeOutcome> => {
        const rttMs = Math.round(performance.now() - started);
        if (!doh) return outcome({ kind: "answered", rttMs, httpStatus: res.type === "opaque" ? null : res.status, evidence: res.type === "opaque" ? "OPAQUE_ANSWERED" : `HTTP_${res.status}` });
        if (res.status === 407) return outcome({ kind: "answered", rttMs, httpStatus: 407, evidence: "HTTP_407" });
        if (!res.ok) return outcome({ kind: "answered", rttMs, httpStatus: res.status, evidence: `HTTP_${res.status}` });
        const json = (await res.json().catch(() => null)) as { Status?: number } | null;
        if (!json || typeof json.Status !== "number") return outcome({ kind: "answered", rttMs, dnsRcode: null, evidence: "DOH_JSON_INVALID" });
        return outcome({ kind: "answered", rttMs, dnsRcode: json.Status, evidence: `RCODE_${json.Status}` });
      })
      .catch((error: unknown): ProbeOutcome => {
        const err = error as { name?: string };
        if (err?.name === "AbortError") return outcome({ kind: "timeout", evidence: `ABORT_AFTER_${deadlineMs}MS` });
        return outcome({ kind: "network-error", evidence: `FETCH_${err?.name ?? "ERROR"}` });
      });

  const base = `https://${fetchHost(host)}`;
  const probes = [
    run(`${base}/resolve?name=pubg.com&type=A`, true),
    run(`${base}/dns-query?name=pubg.com&type=A`, true),
    run(`${base}/`, false),
    ...(isSecurePage() ? [] : [run(`http://${fetchHost(host)}/`, false)]),
  ];

  if (!waitForAll) {
    const first = await firstAnswered(probes);
    if (first) { clearTimeout(timer); ctrl.abort(); return { best: first, all: [first] }; }
  }
  const all = await Promise.all(probes);
  clearTimeout(timer);
  const answered = all.filter((o) => o.kind === "answered");
  const best = answered[0] ?? all.find((o) => o.kind === "timeout") ?? all[0] ?? outcome({ kind: "timeout", evidence: "NO_PROBE" });
  return { best, all };
}

/**
 * Legacy helper kept for reference. The active proxy probing path is `probeOne()`,
 * which races check-host.net + edge + browser HTTP/80 + HTTPS/443 + the proxy
 * port itself on one shared deadline.
 */
export function _legacyProbeOrigin(): void { /* deprecated */ }

/* ── Edge probe results (real DNS / TCP / HTTP CONNECT) ── */
interface EdgeRow {
  endpoint: string; host: string; port: number;
  open: boolean; connectMs: number | null; evidence: string;
  dns?: boolean; rcode?: number | null; answers?: string[]; dnsError?: string;
  dnssec?: DnssecState; dnssecEvidence?: string; dnssecMs?: number | null;
  proxy?: boolean; httpStatus?: number | null;
  /** Real per-round timings + aggregates (edge multi-round sampling). */
  samples?: number[]; avgMs?: number | null; jitterMs?: number | null;
}
interface EdgeScan { rows: Map<string, EdgeRow>; source: string }

/** Chunked batched call to the edge probe function.
 *  `rounds` asks the edge to sample every endpoint multiple times so each
 *  address gets a REAL jitter (never simulated). */
async function edgeScan(endpoints: { host: string; port: number }[], rounds = 1): Promise<EdgeScan | null> {
  const rows = new Map<string, EdgeRow>();
  const chunks: { host: string; port: number }[][] = [];
  for (let i = 0; i < endpoints.length; i += EDGE_CHUNK) chunks.push(endpoints.slice(i, i + EDGE_CHUNK));
  try {
    await Promise.all(chunks.map(async (chunk) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), EDGE_FETCH_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch("/api/proxy-scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoints: chunk, rounds }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { results?: EdgeRow[] } | null;
      if (!json?.results) throw new Error("NO_RESULTS");
      for (const row of json.results) rows.set(row.endpoint, row);
    }));
    return { rows, source: "NETLIFY_EDGE_PROBE" };
  } catch {
    return null;
  }
}

/* ─────────────────── Orchestration ─────────────────── */
interface Progress { phase: "idle" | "dns" | "proxy" | "refine" | "done"; done: number; total: number }

async function inBatches<T, R>(
  items: T[], size: number, worker: (item: T) => Promise<R>,
  onBatch: (results: R[], done: number, total: number) => void, shouldStop: () => boolean,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    if (shouldStop()) break;
    const batch = await Promise.all(items.slice(i, i + size).map(worker));
    out.push(...batch);
    onBatch(batch, out.length, items.length);
  }
  return out;
}

function DnsChip({ label }: { label: DnsLabel }) {
  const meta = DNS_LABEL_META[label];
  const { lang } = useLang();
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${meta.className}`}>
      {meta.icon} {meta.key ? t(meta.key, lang) : label}
    </span>
  );
}
/** Shows whether a resolver is filtered/blocked (derived from real RCODE evidence). */
function FilterChip({ state }: { state: FilterState }) {
  const meta = FILTER_META[state];
  const { lang } = useLang();
  const isAr = lang === "ar";
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${meta.className}`}>
      {meta.icon} {isAr ? meta.ar : meta.en}
    </span>
  );
}

function DnssecChip({ state }: { state: DnssecState }) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const meta = state === "VALIDATING"
    ? { icon: "🛡️", ar: "DNSSEC محقق", en: "DNSSEC Validating", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-400/25" }
    : state === "NOT_VALIDATING"
      ? { icon: "⚠️", ar: "بدون تحقق DNSSEC", en: "No DNSSEC validation", cls: "text-amber-300 bg-amber-500/10 border-amber-400/25" }
      : { icon: "❓", ar: "DNSSEC غير مؤكد", en: "DNSSEC unverified", cls: "text-white/50 bg-white/5 border-white/10" };
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${meta.cls}`} title={state}>
      {meta.icon} {isAr ? meta.ar : meta.en}
    </span>
  );
}
function StatusChip({ status }: { status: EndpointStatus }) {
  const meta = STATUS_META[displayStatus(status)];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${meta.className}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

export function NetworkCenter() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const network = useNetworkDetection();
  const geo = useGeolocation();
  const [tab, setTab] = useState<"dns" | "proxy" | "global">("dns");
  const [dns, setDns] = useState<DnsResult[]>([]);
  const [proxy, setProxy] = useState<ProxyResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<Progress>({ phase: "idle", done: 0, total: 0 });
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [edgeSource, setEdgeSource] = useState<string | null>(null);
  const [matched, setMatched] = useState<{ dns: DnsResult; proxy: ProxyResult; sameAsn: boolean } | null>(null);
  const [community, setCommunity] = useState<{ host: string; port: number; confirmations: number }[]>([]);
  const { isDnsFav, isProxyFav, toggleDns, toggleProxy, favorites } = useFavorites();
  /** Default: only DNS that actually WORKS (unfiltered) is listed. Toggle to
   *  reveal filtered/broken/offline ones for diagnosis (nothing is removed). */
  const [showAllDns, setShowAllDns] = useState(false);
  const stopRef = useRef(false);

  // Community-confirmed endpoints (shared by all users' successful scans).
  useEffect(() => {
    fetchJsonWithHardTimeout<{ ok?: boolean; rows?: { host: string; port: number; confirmations: number }[] }>("/api/proxy-evidence", {}, 8000)
      .then((d) => { if (d?.ok && Array.isArray(d.rows)) setCommunity(d.rows.slice(0, 6)); })
      .catch(() => { /* no backend → silently skip */ });
  }, []);

  const withDistance = useMemo(() => {
    if (geo.status !== "granted") return null;
    return (host: string) => distanceTo(host, geo.coords.lat, geo.coords.lng);
  }, [geo]);

  const rankBy = <T extends { score: number | null }>(rows: T[]): T[] =>
    [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  /** Table order: ASCENDING jitter — the most stable address first.
   *  Rows without real jitter evidence go last (never fabricate stability);
   *  equal jitter keeps the score order (sort is stable). */
  const byJitterAsc = <T extends { jitter: number | null }>(rows: T[]): T[] =>
    [...rows].sort((a, b) => {
      if (a.jitter == null && b.jitter == null) return 0;
      if (a.jitter == null) return 1;
      if (b.jitter == null) return -1;
      return a.jitter - b.jitter;
    });

  // Offline DNS (timeout / unreachable) never appears in the results.
  const onlineDns = useMemo(
    () => dns.filter((r) => r.label !== "TIMEOUT" && r.label !== "UNREACHABLE"),
    [dns],
  );
  // DNS that actually WORKS on the network = unfiltered (real RCODE 0 answer).
  // Filtered / broken / offline resolvers are excluded from every recommendation
  // and from the default results list — "any DNS that doesn't work is hidden".
  const workingDns = useMemo(
    () => onlineDns.filter((r) => filterStateOf(r.label) === "OPEN"),
    [onlineDns],
  );
  // What the table shows: working-only by default, or everything when toggled.
  const visibleDns = useMemo(
    () => (showAllDns ? onlineDns : workingDns),
    [showAllDns, onlineDns, workingDns],
  );
  // Filter-state breakdown for the census (full transparency of hidden rows).
  const filterCensus = useMemo(() => {
    const counts: Record<FilterState, number> = { OPEN: 0, FILTERED: 0, BROKEN: 0, OFFLINE: 0 };
    for (const r of dns) counts[filterStateOf(r.label)] += 1;
    return counts;
  }, [dns]);
  /** Security-aware recommendation order:
   *  1) DNSSEC validating  2) DNSSEC unverified  3) known non-validating
   *  then lowest real jitter, then highest gaming score. */
  const secureDnsRank = useMemo(() => [...workingDns].sort((a, b) => {
    const sd = dnssecRankOf(a.dnssec) - dnssecRankOf(b.dnssec);
    if (sd !== 0) return sd;
    if (a.jitter != null || b.jitter != null) {
      if (a.jitter == null) return 1;
      if (b.jitter == null) return -1;
      if (a.jitter !== b.jitter) return a.jitter - b.jitter;
    }
    return (b.score ?? -1) - (a.score ?? -1);
  }), [workingDns]);
  const best = secureDnsRank;
  const bestProxy = useMemo(() => rankBy(proxy), [proxy]);
  // Table order: favorites first (user-pinned), then ascending jitter
  // (most stable first). Rows without jitter evidence still sort last.
  // The table lists `visibleDns` (working-only by default; all when toggled).
  const dnsByJitter = useMemo(
    () => favoritesFirst(byJitterAsc(visibleDns), favorites.dns, (r) => r.host.ip),
    [visibleDns, favorites.dns],
  );
  const proxyByJitter = useMemo(
    () => favoritesFirst(byJitterAsc(bestProxy), favorites.proxy, (r) => `${r.entry.host}:${r.entry.port}`),
    [bestProxy, favorites.proxy],
  );

  // Recommendations draw only from WORKING (unfiltered) resolvers and inherit
  // security-aware rank. Secondary prefers a different ASN for path diversity.
  const pair = useMemo(() => {
    const s = secureDnsRank.filter((r) => r.host.role !== "authoritative" && r.host.role !== "infrastructure");
    if (!s.length) return null;
    return { primary: s[0], secondary: s.find((r) => r !== s[0] && r.host.asn && r.host.asn !== s[0].host.asn) ?? s[1] ?? null };
  }, [secureDnsRank]);

  const yourNetworkDns = useMemo(() => {
    const isp = network.status === "detected" ? network.friendlyIsp : null;
    // Same product rule as the tables: ascending jitter, most stable first.
    return isp ? byJitterAsc(best.filter((r) => r.host.isp === isp)) : [];
  }, [best, network]);

  /** Single best DNS pick for the user's own network — a decision, not a list.
   *  Prefers the most stable DNS on the detected ISP; falls back to the global
   *  best when no ISP is known or none of its servers answered. Never fabricated:
   *  only live (online) rows are eligible. */
  const recommended = useMemo(() => {
    const isp = network.status === "detected" ? (network.friendlyIsp ?? network.info.isp) : null;
    const fromIsp = yourNetworkDns[0];
    if (fromIsp) return { row: fromIsp, isp, scope: "isp" as const };
    if (best[0]) return { row: best[0], isp, scope: "global" as const };
    return null;
  }, [yourNetworkDns, best, network]);

  const run = async () => {
    const t0 = performance.now();
    stopRef.current = false;
    setScanning(true); setMatched(null); setDns([]); setProxy([]); setElapsed(null);

    /* ── DNS: REAL DNS query (UDP/53) + TCP/443 aliveness from the edge ──
       Multi-round sampling → every address gets real avg + jitter. */
    const dnsEndpoints = DNS_HOSTS.flatMap((h) => [{ host: h.ip, port: 53 }, { host: h.ip, port: 443 }]);
    const edge = await edgeScan(dnsEndpoints, EDGE_ROUNDS);
    setEdgeSource(edge?.source ?? null);

    setProgress({ phase: "dns", done: 0, total: DNS_HOSTS.length });
    const rows: DnsResult[] = await inBatches(
      DNS_HOSTS, SCREEN_BATCH,
      async (host) => {
        const dnsRow = edge?.rows.get(`${host.ip}:53`) ?? null;
        const tcpRow = edge?.rows.get(`${host.ip}:443`) ?? null;
        const probe = await probeHost(host.ip, SCREEN_DEADLINE_MS, false);
        const doh = probe.all.find((o) => o.dnsRcode !== null) ?? null;
        const browserAnswer = probe.all.find((o) => o.kind === "answered");

        // REAL evidence: the edge DNS answer wins, then the browser DoH answer.
        const rcode = dnsRow?.dns && dnsRow.rcode != null ? dnsRow.rcode : doh?.dnsRcode ?? null;
        const samples: number[] = [];
        // Every real edge round counts (multi-round sampling → real jitter).
        const edgeSamplesOf = (row: EdgeRow | null): number[] => {
          if (!row) return [];
          if (Array.isArray(row.samples) && row.samples.some(isFiniteRtt)) {
            return row.samples.filter(isFiniteRtt);
          }
          return isFiniteRtt(row.connectMs) ? [row.connectMs as number] : [];
        };
        samples.push(...edgeSamplesOf(dnsRow));
        if (tcpRow?.open) samples.push(...edgeSamplesOf(tcpRow));
        if (browserAnswer && isFiniteRtt(browserAnswer.rttMs)) samples.push(browserAnswer.rttMs);
        if (doh && isFiniteRtt(doh.rttMs)) samples.push(doh.rttMs);

        const alive = Boolean(dnsRow?.open || tcpRow?.open || browserAnswer);
        const timeout = Boolean(dnsRow?.evidence === "TIMEOUT" || tcpRow?.evidence === "TIMEOUT" || probe.best.kind === "timeout");
        const refused = Boolean(dnsRow?.evidence === "TCP_RST" && tcpRow?.evidence === "TCP_RST");
        const label = dnsLabelOf(rcode, alive, timeout, refused);
        const jitter = samples.length > 1 ? jitterOf(samples) : null;

        return {
          host, label,
          evidence: dnsRow?.dns ? dnsRow.evidence : (doh?.evidence ?? (tcpRow?.open ? tcpRow.evidence : probe.best.evidence)),
          rcode,
          dnssec: dnsRow?.dnssec ?? "UNVERIFIED" as DnssecState,
          dnssecEvidence: dnsRow?.dnssecEvidence ?? "DNSSEC_NO_EDGE_EVIDENCE",
          dnssecMs: dnsRow?.dnssecMs ?? null,
          samples,
          avg: samples.length ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null,
          jitter, p95: samples.length > 1 ? p95Of(samples) : null,
          score: scoreFrom(samples, DNS_LABEL_META[label].factor, jitter),
          km: null, city: endpointCity(host.ip).city,
        };
      },
      (results, done, total) => { setProgress({ phase: "dns", done, total }); setDns((p) => [...p, ...results]); },
      () => stopRef.current,
    );

    /* ── PROXY: REAL TCP checks via check-host.net nodes (no backend needed) ── */
    if (!stopRef.current) {
      setProgress({ phase: "proxy", done: 0, total: PROXY_POOL.length });

      // Both real paths race IN PARALLEL — the proxy phase never waits on one
      // provider after the other anymore; the first usable signal wins.
      // Multi-round sampling → every proxy gets real avg + jitter.
      const edgePromise = edgeScan(PROXY_POOL.map((p) => ({ host: p.host, port: p.port })), EDGE_ROUNDS).catch(() => null);

      // Real distributed TCP checks: check-host.net runs genuine connect tests
      // from real nodes. This works from a static build with no backend at all.
      let probeRows: Map<string, { open: boolean; ms: number | null; evidence: string }> | null = null;
      let probeSource: string | null = null;
      try {
        const nodeSample = await fetchNodes();
        const probeNodes = nodeSample.slice(0, 2).map((n) => n.id);
        if (probeNodes.length) {
          probeRows = new Map();
          probeSource = "CHECK-HOST.NET_NODES";
          // check-host runs many hosts per request — batch endpoints by host:port.
          // Hard-bounded by the project's own 12s per-check budget: whatever has not
          // arrived by then is left unmapped and falls through to the other signals
          // (identical to the catch path), so the scan can never freeze at 0/N.
          await Promise.race([
            Promise.all(PROXY_POOL.map(async (entry) => {
              try {
                const rows = await checkTcp(entry.host, entry.port, probeNodes, 12000);
                const r = rows[0];
                if (r) {
                  probeRows!.set(`${entry.host}:${entry.port}`, {
                    open: r.ok,
                    ms: r.timeMs,
                    evidence: r.ok ? "TCP_SYN_ACK" : (r.error ?? "TIMEOUT"),
                  });
                }
              } catch { /* leave unmapped — falls through to other signals */ }
            })),
            new Promise<void>((r) => setTimeout(r, 12000)),
          ]);
        }
      } catch { /* check-host unavailable → fall back to the edge probe */ }

      const pEdge = probeRows && probeRows.size > 0 ? null : await edgePromise;
      const sourceName = probeSource ?? pEdge?.source ?? "BROWSER_HTTPS_ONLY";
      if (!edgeSource) setEdgeSource(sourceName);
      /* Probe a proxy entry. Four signals race in parallel:
         1. check-host.net  → real TCP from a global node
         2. edge (if deployed) → CONNECT probe on the proxy port
         3. browser fetch  → HTTP on port 80 first (no TLS → no retries → fast),
                            then HTTPS on 443 for aliveness, plus the proxy port
         4. timing dedupe  → real answers only, never from a default                */
      const probeOne = async (entry: ProxyEntry): Promise<ProxyResult> => {
        const key = `${entry.host}:${entry.port}`;
        const edgeRow = pEdge?.rows.get(key);
        const chRow = probeRows?.get(key);

        // Build a tight race: 4 real signals, each with its own short deadline.
        const dl = 1800;
        const signals: Promise<ProbeOutcome>[] = [];
        // One shared abort for ALL browser probes: nothing may outlive the
        // deadline, so the batch can never freeze on a dropped connection.
        const probeCtrl = new AbortController();
        setTimeout(() => probeCtrl.abort(), dl);

        // 1. check-host.net  (real TCP from a global node — fast and authoritative)
        if (chRow) {
          if (chRow.open) {
            signals.push(Promise.resolve(outcome({
              kind: "answered", rttMs: chRow.ms,
              evidence: chRow.evidence === "TCP_SYN_ACK" ? `CHECK_HOST_TCP_SYN_ACK:${entry.port}` : chRow.evidence,
            })));
          } else {
            signals.push(Promise.resolve(outcome({
              kind: chRow.evidence === "TIMEOUT" ? "timeout" : "network-error",
              evidence: `CHECK_HOST_${chRow.evidence ?? "FAILED"}`,
            })));
          }
        }

        // 2. edge probe (when the edge function is deployed) — every real
        //    round becomes its own answered signal, so the row's samples
        //    (and therefore its jitter) come from genuine measurements.
        if (edgeRow) {
          if (edgeRow.open) {
            const edgeEvidence = edgeRow.evidence === "PROXY_CONNECT_OK" ? "EDGE_PROXY_CONNECT_OK"
                    : edgeRow.evidence === "TCP_SYN_ACK" ? `EDGE_TCP_SYN_ACK:${entry.port}`
                    : edgeRow.evidence;
            const msList = (Array.isArray(edgeRow.samples) ? edgeRow.samples.filter(isFiniteRtt) : []);
            if (msList.length) {
              for (const ms of msList) {
                signals.push(Promise.resolve(outcome({ kind: "answered", rttMs: ms, evidence: edgeEvidence })));
              }
            } else {
              signals.push(Promise.resolve(outcome({
                kind: "answered",
                rttMs: isFiniteRtt(edgeRow.connectMs) ? edgeRow.connectMs : null,
                evidence: edgeEvidence,
              })));
            }
          } else if (edgeRow.evidence === "TCP_RST") {
            signals.push(Promise.resolve(outcome({ kind: "network-error", evidence: "EDGE_TCP_RST" })));
          }
        }

        // 3. browser probes — parallel, racing on a shared deadline.
        //    Port 80 first (no TLS, no retry), then 443, then the proxy port.
        const hostBase = fetchHost(entry.host);
        // On HTTPS pages the browser blocks plain-http probes (mixed content);
        // report it honestly instead of firing a request that is rejected and
        // logged as a console error.
        const http80 = isSecurePage()
          ? Promise.resolve(outcome({ kind: "timeout", evidence: "HTTP_80_MIXED_BLOCKED" }))
          : fetch(`http://${hostBase}:80/`, { mode: "no-cors", cache: "no-store", signal: probeCtrl.signal })
            .then((res): ProbeOutcome => outcome({
              kind: "answered", rttMs: 0,
              evidence: res.type === "opaque" ? "HTTP_80_ANSWERED" : `HTTP_${res.status}`,
            })).catch(() => outcome({ kind: "timeout", evidence: "HTTP_80_FAIL" }));
        const https443 = fetch(`https://${hostBase}/`, { mode: "no-cors", cache: "no-store", signal: probeCtrl.signal })
          .then((res): ProbeOutcome => outcome({
            kind: "answered", rttMs: 0,
            evidence: res.type === "opaque" ? "HTTPS_443_ANSWERED" : `HTTPS_${res.status}`,
          })).catch(() => outcome({ kind: "timeout", evidence: "HTTPS_443_FAIL" }));
        signals.push(http80, https443);

        // 4. proxy port (HTTP — plain, no TLS, no cert retry)
        if (entry.port !== 80 && entry.port !== 443) {
          const scheme = entry.port === 443 ? "https" : "http";
          if (scheme === "http" && isSecurePage()) {
            signals.push(Promise.resolve(outcome({ kind: "timeout", evidence: `PORT_${entry.port}_MIXED_BLOCKED` })));
          } else {
            signals.push(fetch(`${scheme}://${hostBase}:${entry.port}/`, { mode: "no-cors", cache: "no-store", signal: probeCtrl.signal })
              .then((res): ProbeOutcome => outcome({
                kind: "answered", rttMs: 0,
                evidence: res.type === "opaque" ? `PORT_${entry.port}_ANSWERED` : `PORT_${entry.port}_HTTP_${res.status}`,
              })).catch(() => outcome({ kind: "timeout", evidence: `PORT_${entry.port}_FAIL` })));
          }
        }

        // Race — first answered wins, OR a tight shared deadline collects all.
        // `first` itself is deadline-bounded: an unanswered race must resolve
        // as null within the deadline, never after browser TCP timeouts.
        const first = await Promise.race([
          firstAnswered(signals),
          new Promise<ProbeOutcome | null>((r) => setTimeout(() => r(null), dl + 250)),
        ]);
        const all = await Promise.race([
          Promise.all(signals),
          new Promise<ProbeOutcome[]>((r) => setTimeout(() => r([]), dl)),
        ]);
        const settled = (all as ProbeOutcome[]).filter((o) => o.rttMs != null || o.kind === "answered" || o.kind === "timeout" || o.kind === "network-error");

        // Score every settled answer — the *median* of its real RTT is the
        // truth; we never accept a single slow retry as the answer.
        const realRtt = (o: ProbeOutcome): number | null => {
          if (o.kind !== "answered") return null;
          if (typeof o.rttMs !== "number") return null;
          if (!isFiniteRtt(o.rttMs)) return null;
          if (o.rttMs < 1 || o.rttMs > 4000) return null;     // filter browser retries
          return Math.round(o.rttMs);
        };
        const rtts = settled.map(realRtt).filter((x): x is number => x !== null);
        const medianRtt = rtts.length ? median(rtts) : null;

        // Pick the strongest evidence — check-host > edge > browser
        const ordered = [
          ...(chRow ? [{
            source: "check-host.net" as const,
            kind: chRow.open ? "ok" : "bad",
            evidence: chRow.open ? `CHECK_HOST_TCP_SYN_ACK:${entry.port}` : `CHECK_HOST_${chRow.evidence}`,
            ms: chRow.ms ?? medianRtt,
            httpStatus: null as number | null,
          }] : []),
          ...(edgeRow ? [{
            source: "edge" as const,
            kind: edgeRow.open ? "ok" : "bad",
            evidence: edgeRow.evidence ?? "",
            ms: edgeRow.avgMs ?? edgeRow.connectMs ?? medianRtt,
            httpStatus: edgeRow.httpStatus ?? null,
          }] : []),
          ...settled.map((o) => ({
            source: "browser" as const,
            kind: o.kind === "answered" ? "ok" : "bad",
            evidence: o.evidence,
            ms: realRtt(o),
            httpStatus: null as number | null,
          })),
        ];
        const good = ordered.filter((s) => s.kind === "ok");
        const firstOk = good[0];

        let status: EndpointStatus;
        let evidence = firstOk?.evidence ?? ordered[0]?.evidence ?? "NO_EVIDENCE";
        if (firstOk?.httpStatus === 407) status = "AUTH_REQUIRED";
        else if (firstOk?.evidence?.includes("PROXY_CONNECT_OK")) status = "WORKING";
        else if (firstOk?.evidence?.startsWith("HTTP_407")) status = "AUTH_REQUIRED";
        else if (firstOk?.evidence?.startsWith("PROXY_HTTP_") || firstOk?.evidence?.includes("PROXY_CONNECT_OK")) status = "PARTIAL";
        else if (firstOk?.evidence?.includes("TCP_SYN_ACK")) status = "REACHABLE";
        else if (firstOk?.evidence?.includes("ANSWERED")) status = "PARTIAL";
        else if (ordered.some((s) => s.kind === "bad" && s.evidence.includes("TCP_RST"))) status = "FAILED";
        else if (first === null && settled.length > 0) status = "TIMEOUT";
        else status = "TIMEOUT";

        const samples = rtts;
        const jitter = samples.length > 1 ? jitterOf(samples) : null;
        const factor = status === "WORKING" ? 1 : status === "PARTIAL" ? 0.7 : status === "REACHABLE" ? 0.55 : 0;
        return {
          entry, status, evidence,
          samples,
          avg: medianRtt,
          jitter, p95: samples.length > 1 ? p95Of(samples) : null,
          score: factor && medianRtt
            ? Math.max(0, Math.round(factor * (100 - Math.min(60, medianRtt / 6) - Math.min(20, (jitter ?? 0) * 1.5))))
            : null,
          km: null, city: endpointCity(entry.host).city,
          source: firstOk?.source === "check-host.net" ? "CHECK-HOST.NET_NODES"
                : firstOk?.source === "edge" ? "NETLIFY_EDGE_PROBE"
                : "BROWSER_HTTP",
        };
      };

      const proxyRows = await inBatches(
        PROXY_POOL, SCREEN_BATCH,
        probeOne,
        (results, done, total) => { setProgress({ phase: "proxy", done, total }); setProxy((p) => [...p, ...results]); },
        () => stopRef.current,
      );
      setProxy(proxyRows);

      // Community verification: report successful evidence so everyone
      // benefits from rare confirmed endpoints (bounded, fire-and-forget).
      const hits = proxyRows
        .filter((r) => r.status === "WORKING" || r.status === "REACHABLE" || r.evidence.includes("PROXY_CONNECT_OK"))
        .slice(0, 10);
      if (hits.length) {
        fetchJsonWithHardTimeout("/api/proxy-evidence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            rows: hits.map((r) => ({
              host: r.entry.host, port: r.entry.port, status: r.status,
              evidence: r.evidence, source: r.source, connectMs: r.avg,
            })),
          }),
        }, 8000).catch(() => { /* no backend → silently skip */ });
      }

      /* ── REFINE the top candidates with extra real rounds ── */
      if (!stopRef.current) {
        const topDns = rankBy(rows.filter((r) => r.samples.length)).slice(0, REFINE_TOP);
        const topProxy = rankBy(proxyRows.filter((r) => r.samples.length)).slice(0, REFINE_TOP);
        const totalRefine = topDns.length + topProxy.length;
        if (totalRefine) setProgress({ phase: "refine", done: 0, total: totalRefine });
        let refined = 0;
        const refine = async (host: string, samples: number[]) => {
          for (let k = 0; k < REFINE_ROUNDS; k += 1) {
            if (stopRef.current) break;
            const p = await probeHost(host, SCREEN_DEADLINE_MS, false);
            const a = p.all.find((o) => o.kind === "answered" && isFiniteRtt(o.rttMs));
            if (a) samples.push(a.rttMs as number);
          }
        };
        await Promise.all([
          ...topDns.map(async (r) => {
            await refine(r.host.ip, r.samples);
            r.jitter = r.samples.length > 1 ? jitterOf(r.samples) : null;
            r.avg = r.samples.length ? Math.round(r.samples.reduce((a, b) => a + b, 0) / r.samples.length) : null;
            r.p95 = r.samples.length > 1 ? p95Of(r.samples) : null;
            r.score = scoreFrom(r.samples, DNS_LABEL_META[r.label].factor, r.jitter);
            refined += 1; setProgress({ phase: "refine", done: refined, total: totalRefine });
          }),
          ...topProxy.map(async (r) => {
            await refine(r.entry.host, r.samples);
            r.jitter = r.samples.length > 1 ? jitterOf(r.samples) : null;
            r.avg = r.samples.length ? Math.round(r.samples.reduce((a, b) => a + b, 0) / r.samples.length) : null;
            r.p95 = r.samples.length > 1 ? p95Of(r.samples) : null;
            const factor = r.status === "WORKING" ? 1 : r.status === "PARTIAL" ? 0.7 : r.status === "REACHABLE" ? 0.55 : 0;
            r.score = factor && r.samples.length
              ? Math.max(0, Math.round(factor * (100 - Math.min(60, (r.samples.reduce((a, b) => a + b, 0) / r.samples.length) / 6) - Math.min(20, (r.jitter ?? 0) * 1.5))))
              : null;
            refined += 1; setProgress({ phase: "refine", done: refined, total: totalRefine });
          }),
        ]);
        setDns([...rows]);
        setProxy([...proxyRows]);
      }
    }

    setProgress({ phase: "done", done: 1, total: 1 });
    setElapsed(Math.round(performance.now() - t0));
    setScanning(false);
  };

  const match = () => {
    const s = best.filter((r) => r.host.role !== "authoritative" && r.host.role !== "infrastructure");
    if (!s.length || !bestProxy.length) return;
    const sameAsn = bestProxy.filter((p) => p.entry.asn === s[0].host.asn && p.score !== null);
    const pool = sameAsn.length ? sameAsn : bestProxy.filter((p) => p.score !== null);
    setMatched({ dns: s[0], proxy: pool[0] ?? bestProxy[0], sameAsn: sameAsn.length > 0 });
  };

  const census = useMemo(() => {
    const counts = new Map<string, number>();
    if (tab === "dns") for (const r of dns) counts.set(r.label, (counts.get(r.label) ?? 0) + 1);
    else for (const r of proxy) { const k = STATUS_META[displayStatus(r.status)].label; counts.set(k, (counts.get(k) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [dns, proxy, tab]);

  const yourIsp = network.status === "detected" ? (network.friendlyIsp ?? network.info.isp) : null;
  const phaseLabel = isAr
    ? { idle: "جاهز", dns: "فحص DNS حقيقي (UDP/53)", proxy: "فحص البروكسي (HTTP CONNECT)", refine: "تنقية أفضل النتائج", done: "اكتمل" }
    : { idle: "Ready", dns: "Real DNS probe (UDP/53)", proxy: "Proxy probe (HTTP CONNECT)", refine: "Refining top", done: "Done" };
  const pct = progress.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <div className="card rounded-2xl p-5">
      {/* Network identity */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/30 p-3">
        <div className="text-[11px]">
          <p className="font-bold text-white/80">📶 {t("hero_isp", lang)}: <span className="text-orange-300">{yourIsp ?? "—"}</span></p>
          <p className="text-[10px] text-white/40">
            {network.status === "detected" ? `${network.info.asn ?? "—"} · ${network.info.ip ?? "—"} · ${network.info.source}` : network.status === "detecting" ? "…" : "—"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {(["dns", "proxy", "global"] as const).map((id) => (
            <button key={id} onClick={() => setTab(id)}
              className={`rounded-md px-3 py-1.5 font-display text-[10px] font-bold tracking-widest transition-colors ${tab === id ? "bg-gradient-to-r from-orange-500 to-red-600 text-white" : "text-white/45"}`}>
              {id === "dns" ? "🛰️ DNS" : id === "proxy" ? "🛡️ PROXY" : "🌍 GLOBAL"}
            </button>
          ))}
        </div>
      </div>

      {/* Master dataset stats */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(tab === "global"
          ? null
          : (tab === "dns"
            ? [[t("dns_master", lang), DNS_HOSTS.length], [t("dns_duplicates", lang), DNS_HOSTS.length - new Set(DNS_HOSTS.map((h) => h.ip)).size], [t("dns_analyzed", lang), dns.length || "—"], [t("dns_results", lang), SELECTABLE.length]]
            : [[t("dns_master", lang), PROXY_RAW_COUNT], [t("dns_duplicates", lang), PROXY_DUPLICATES_REMOVED], [t("dns_analyzed", lang), proxy.length || "—"], [t("dns_results", lang), PROXY_POOL.length]])
        )?.map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-white/5 bg-black/30 p-2.5 text-center">
            <p className="font-display text-base font-black text-white tabular-nums">{value}</p>
            <p className="text-[9px] text-white/35">{label}</p>
          </div>
        ))}
      </div>

      {/* Actions (Jordan plan tabs; the global tab owns its controls) */}
      {tab !== "global" && <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => void run()} disabled={scanning} className="btn-primary rounded-xl px-4 py-2.5 text-xs disabled:opacity-60">
          {scanning ? t("dns_scanning", lang) : t("dns_scan", lang)}
        </button>
        <button onClick={match} disabled={!best.length || !bestProxy.length} className="btn-ghost rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-40">
          {t("proxy_match_btn", lang)}
        </button>
        {scanning && (
          <button onClick={() => { stopRef.current = true; }} className="btn-ghost rounded-xl px-4 py-2.5 text-xs font-semibold text-red-300">
            ⏹ {isAr ? "إيقاف" : "Stop"}
          </button>
        )}
        {tab === "dns" && dns.length > 0 && (
          <button onClick={() => setShowAllDns((v) => !v)} aria-pressed={showAllDns}
            className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors ${showAllDns ? "border border-orange-400/40 bg-orange-500/10 text-orange-300" : "btn-ghost"}`}>
            {showAllDns
              ? (isAr ? "🟢Working only" : "🟢 Working only")
              : (isAr ? "👁 إظهار الكل (مفلتر/معطّل)" : "👁 Show all (filtered/broken)")}
          </button>
        )}
      </div>}

      {/* Progress */}
      {scanning && (
        <div className="mb-4 rounded-xl border border-white/5 bg-black/30 p-3">
          <div className="mb-1.5 flex items-center justify-between text-[10px]">
            <span className="font-display font-bold tracking-widest text-orange-300">⚡ {phaseLabel[progress.phase]} · {progress.done}/{progress.total}</span>
            <span className="text-white/40">{pct}%</span>
          </div>
          <div className="stat-bar h-1.5"><span className="block h-full" style={{ width: `${pct}%`, transition: "width .25s ease" }} /></div>
          <p className="mt-1.5 text-[9px] text-white/35">
            {isAr ? "استعلام DNS حقيقي + HTTP CONNECT من الخادم، و٤ اختبارات متوازية من المتصفح." : "Real DNS query + HTTP CONNECT from the edge, plus 4 parallel browser probes."}
          </p>
        </div>
      )}
      {!scanning && elapsed !== null && (
        <p className="mb-3 text-center text-[10px] font-semibold text-emerald-300">
          ⚡ {isAr ? "اكتمل الفحص في" : "Completed in"} {elapsed}ms{edgeSource ? ` · ${edgeSource}` : ""}
        </p>
      )}
      {!scanning && elapsed !== null && !edgeSource && (
        <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-center text-[10px] text-amber-200/80">
          ⚠️ {isAr
            ? "الفحص الكامل (UDP/53 + HTTP CONNECT) يعمل عبر دالة Netlify — انشر المستودع على Netlify لتفعيله. حالياً تُستخدم اختبارات المتصفح الحقيقية فقط."
            : "Full probing (UDP/53 + HTTP CONNECT) runs through the Netlify function — deploy the repo to Netlify to enable it. Only real browser probes are used right now."}
        </p>
      )}

      {/* Status census (DNS/proxy tabs; the global tab has its own progress). */}
      {tab !== "global" && (dns.length || proxy.length) > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/5 bg-black/30 p-2.5">
          <span className="me-1 font-display text-[9px] font-bold tracking-widest text-white/40">STATUS</span>
          {census.map(([key, count]) => (
            <span key={key} className="flex items-center gap-1">
              {tab === "dns" ? <DnsChip label={key as DnsLabel} /> : <StatusChip status={key as EndpointStatus} />}
              <span className="font-display text-[10px] font-bold text-white/70 tabular-nums">×{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Filtering census — how many resolvers are open vs filtered/broken/offline.
          Full transparency: the results list hides non-working ones, this shows why. */}
      {tab === "dns" && dns.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/5 bg-black/30 p-2.5">
          <span className="me-1 font-display text-[9px] font-bold tracking-widest text-white/40">
            {isAr ? "التصفية" : "FILTERING"}
          </span>
          {(["OPEN", "FILTERED", "BROKEN", "OFFLINE"] as FilterState[]).map((state) => (
            <span key={state} className="flex items-center gap-1">
              <FilterChip state={state} />
              <span className="font-display text-[10px] font-bold text-white/70 tabular-nums">×{filterCensus[state]}</span>
            </span>
          ))}
          <span className="ms-auto text-[9px] text-white/35">
            {isAr
              ? `القائمة تعرض ${visibleDns.length} (يعمل${showAllDns ? " + الكل" : ""})`
              : `List shows ${visibleDns.length} (working${showAllDns ? " + all" : ""})`}
          </span>
        </div>
      )}

      {/* Best results — copy & apply (Jordan plan tabs only) */}
      {tab !== "global" && (() => {
        const bestDns = best.find((r) => r.score != null) ?? best[0];
        const bestPrx = bestProxy.find((r) => r.score != null) ?? bestProxy[0];
        if (!bestDns && !bestPrx) return null;
        return (
          <div className="mb-4 rounded-xl border border-orange-500/25 bg-gradient-to-br from-orange-500/10 to-transparent p-4">
            <p className="mb-2 font-display text-xs font-bold text-orange-300">
              🏆 {isAr ? "أفضل النتائج — انسخ وطبّق في إعدادات جهازك" : "Best results — copy & apply in your device settings"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {bestDns && (
                <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/30 p-2.5">
                  <span className="text-[9px] font-bold tracking-widest text-sky-300">DNS</span>
                  <span dir="ltr" className="font-mono text-sm font-bold text-white">{bestDns.host.ip}</span>
                  <span className="text-[10px] text-white/40">{bestDns.avg != null ? `${bestDns.avg}ms` : ""}</span>
                  {bestDns.jitter != null && (
                    <span className="text-[10px] text-white/40" dir="ltr">±{bestDns.jitter} {isAr ? "تذبذب" : "jitter"}</span>
                  )}
                  <span className="ms-auto"><CopyValue value={bestDns.host.ip} /></span>
                </div>
              )}
              {bestPrx && (
                <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/30 p-2.5">
                  <span className="text-[9px] font-bold tracking-widest text-emerald-300">PROXY</span>
                  <span dir="ltr" className="font-mono text-sm font-bold text-white">{bestPrx.entry.host}:{bestPrx.entry.port}</span>
                  <span className="text-[10px] text-white/40">{bestPrx.avg != null ? `${bestPrx.avg}ms` : ""}</span>
                  {bestPrx.jitter != null && (
                    <span className="text-[10px] text-white/40" dir="ltr">±{bestPrx.jitter} {isAr ? "تذبذب" : "jitter"}</span>
                  )}
                  <span className="ms-auto"><CopyValue value={`${bestPrx.entry.host}:${bestPrx.entry.port}`} /></span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Match result (Jordan plan only) */}
      {tab !== "global" && matched && (
        <div className="mb-4 rounded-xl border border-orange-500/25 bg-orange-500/5 p-4">
          <p className="mb-2 font-display text-xs font-bold text-orange-300">{t("proxy_match_title", lang)}</p>
          <p className="mb-3 text-[10px] text-white/45">{t("proxy_match_sub", lang)}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-white/5 bg-black/30 p-3">
              <p className="text-[9px] font-bold tracking-widest text-sky-300">🛰️ DNS · {t("dns_primary", lang)}</p>
              <p className="flex items-center gap-1.5 font-mono text-sm text-white">{matched.dns.host.ip}<CopyValue value={matched.dns.host.ip} /></p>
              <p className="text-[10px] text-white/40">{matched.dns.host.isp} · {matched.dns.host.asn ?? "—"}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2"><DnsChip label={matched.dns.label} /><DnssecChip state={matched.dns.dnssec} /><span className="text-[10px] text-orange-300">{matched.dns.score ?? "—"} pts</span></div>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/30 p-3">
              <p className="text-[9px] font-bold tracking-widest text-emerald-300">🛡️ PROXY</p>
              <p className="flex items-center gap-1.5 font-mono text-sm text-white" dir="ltr">{matched.proxy.entry.host}:{matched.proxy.entry.port}<CopyValue value={`${matched.proxy.entry.host}:${matched.proxy.entry.port}`} /></p>
              <p className="text-[10px] text-white/40">{matched.proxy.entry.isp} · {matched.proxy.entry.asn}</p>
              <div className="mt-1 flex items-center gap-2"><StatusChip status={matched.proxy.status} /><span className="text-[10px] text-orange-300">{matched.proxy.score ?? "—"} pts · {matched.proxy.avg ?? "—"}ms</span></div>
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-white/60">
            {matched.sameAsn ? `✅ ${t("proxy_match_same_asn", lang)}` : `🔀 ${t("proxy_match_cross", lang)}`}
          </p>
        </div>
      )}

      {tab === "global" ? (
        <GlobalScan />
       ) : tab === "dns" ? (
         <>
           {recommended && (
             <div className="mb-4 rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent p-4">
               <p className="mb-2 font-display text-xs font-bold text-orange-300">
                 🏆 {isAr ? "الأنسب لشبكتك الآن" : "Best for your network right now"}
               </p>
               <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-black/30 p-3">
                 <span dir="ltr" className="font-mono text-lg font-bold text-white">{recommended.row.host.ip}</span>
                 <FavoriteToggle active={isDnsFav(recommended.row.host.ip)} onToggle={() => toggleDns(recommended.row.host.ip)} label={recommended.row.host.ip} />
                 <CopyValue value={recommended.row.host.ip} />
                  <span className="ms-auto flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="text-white/50">{recommended.row.host.isp}</span>
                    {recommended.row.avg != null && <span className="font-bold text-emerald-300" dir="ltr">{recommended.row.avg}ms</span>}
                    {recommended.row.jitter != null && <span className="text-white/40" dir="ltr">±{recommended.row.jitter}</span>}
                    <FilterChip state={filterStateOf(recommended.row.label)} />
                    <DnssecChip state={recommended.row.dnssec} />
                    <DnsChip label={recommended.row.label} />
                  </span>
               </div>
               <p className="mt-2 text-[10px] leading-relaxed text-white/45">
                 {recommended.scope === "isp"
                   ? (isAr
                       ? `أقل تذبذباً بين خوادم مزوّدك (${recommended.isp}) المستجيبة في هذا الفحص.`
                       : `Most stable responding server on your ISP (${recommended.isp}) in this scan.`)
                   : (isAr
                       ? "أفضل نتيجة إجمالية مستقرة في هذا الفحص (تعذّر تحديد مزوّدك)."
                       : "Best overall stable result in this scan (your ISP could not be detected).")}
               </p>
             </div>
           )}
           {yourNetworkDns.length > 0 && (
             <div className="mb-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
              <p className="mb-1 text-[11px] font-bold text-sky-300">{t("dns_your_network", lang)}</p>
              <p className="mb-2 text-[10px] text-white/40">{t("dns_your_network_sub", lang)}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {yourNetworkDns.slice(0, 8).map((r) => (
                  <div key={r.host.ip} className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/30 p-2">
                    <span className="font-mono text-xs text-white">{r.host.ip}</span>
                    <CopyValue value={r.host.ip} />
                    <span className="ms-auto text-[10px] text-emerald-300">{r.avg ?? "—"}ms</span>
                    {r.jitter != null && <span className="text-[10px] text-white/40" dir="ltr">±{r.jitter}</span>}
                    <FilterChip state={filterStateOf(r.label)} />
                    <DnssecChip state={r.dnssec} />
                    <DnsChip label={r.label} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {dns.some((r) => r.samples.length > 0) && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(() => {
                const all = dns.flatMap((r) => r.samples);
                return ([[t("dns_avg", lang), all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : "—"], [t("dns_median", lang), all.length ? median(all) : "—"], [t("dns_p95", lang), all.length ? p95Of(all) : "—"], [t("dns_samples", lang), all.length]] as const)
                  .map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/5 bg-black/30 p-2.5 text-center">
                      <p className="font-display text-base font-black text-white tabular-nums">{value}</p>
                      <p className="text-[9px] text-white/35">{label}</p>
                    </div>
                  ));
              })()}
            </div>
          )}

          {pair && (
            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="mb-1 font-display text-[11px] font-bold tracking-widest text-emerald-300">
                🛡️ {isAr ? "أفضل ٢ DNS بعد الفحص" : "Best 2 DNS after the scan"}
              </p>
              <p className="mb-3 text-[9px] leading-relaxed text-white/40">
                {isAr
                  ? "الاختيار: يعمل (RCODE 0) ← DNSSEC محقق أولاً ← أقل تذبذب ← أعلى درجة. الثانوي يفضّل ASN مختلفاً لتنوع المسار."
                  : "Selection: working (RCODE 0) → DNSSEC validating first → lowest jitter → highest score. Secondary prefers a different ASN for path diversity."}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
              {[t("dns_best", lang), t("dns_second", lang)].map((label, i) => {
                const r = i === 0 ? pair.primary : pair.secondary;
                if (!r) return null;
                const d = withDistance ? withDistance(r.host.ip) : null;
                return (
                  <div key={label} className="rounded-xl border border-orange-500/25 bg-gradient-to-br from-orange-500/10 to-transparent p-3">
                    <p className="text-[9px] font-bold tracking-widest text-orange-300">
                      {label}{i === 1 && r.host.asn !== pair.primary.host.asn ? " · 🔀 diverse ASN" : ""}
                    </p>
                    <p className="flex items-center gap-2 font-mono text-lg font-bold text-white">{r.host.ip}<CopyValue value={r.host.ip} /></p>
                    <p className="text-[10px] text-white/45">{r.host.isp} · {r.host.asn ?? "—"} · {r.city}{d ? ` · ${d.km}km` : ""}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><DnsChip label={r.label} /><DnssecChip state={r.dnssec} /><span className="text-[10px] font-bold text-orange-300">{r.score ?? "—"} pts</span></div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                      <div><p className="font-display text-sm font-bold text-white">{r.avg ?? "—"}</p><p className="text-[8px] text-white/35">{t("dns_avg", lang)}</p></div>
                      <div><p className="font-display text-sm font-bold text-white">{r.jitter ?? "—"}</p><p className="text-[8px] text-white/35">{t("dns_jitter", lang)}</p></div>
                      <div><p className="font-display text-sm font-bold text-white">{r.p95 ?? "—"}</p><p className="text-[8px] text-white/35">P95</p></div>
                    </div>
                    <p className="mt-2 text-[10px] text-emerald-300/80">
                      💡 {t("dns_explain", lang)}: {r.avg !== null ? `${r.avg}ms · Jitter ${r.jitter ?? 0}ms · ${r.samples.length} ${isAr ? "قياسات" : "samples"}` : (isAr ? "بدون قياس" : "no measurement")}
                    </p>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          <div className="max-h-[26rem] overflow-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-[#0c0700]">
                <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-white/35">
                  <th className="p-2">#</th><th className="p-2">IP</th><th className="p-2">{t("dns_isp", lang)}</th>
                  <th className="p-2">{isAr ? "التصفية" : "Filter"}</th>
                  <th className="p-2">DNSSEC</th>
                  <th className="p-2">{t("dns_status", lang)}</th><th className="p-2">RCODE</th>
                  <th className="p-2">{t("dns_search_domain", lang)}</th><th className="p-2">{t("dns_avg", lang)}</th>
                  <th className="p-2">{t("dns_jitter", lang)}</th>
                  <th className="p-2">P95</th><th className="p-2">{t("dns_gscore", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {dnsByJitter.map((r, i) => (
                  <tr key={r.host.ip} className={`border-b border-white/5 ${DNS_LABEL_META[r.label].dim ? "opacity-40" : ""}`}>
                    <td className="p-2 font-display font-bold text-white/50">{i + 1}</td>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1.5">
                        <FavoriteToggle active={isDnsFav(r.host.ip)} onToggle={() => toggleDns(r.host.ip)} label={r.host.ip} />
                        <span className="font-mono text-white/90">{r.host.ip}</span>
                        <CopyValue value={r.host.ip} />
                      </span>
                    </td>
                    <td className="p-2 text-white/60">{r.host.isp}</td>
                    <td className="p-2"><FilterChip state={filterStateOf(r.label)} /></td>
                    <td className="p-2"><DnssecChip state={r.dnssec} /></td>
                    <td className="p-2"><DnsChip label={r.label} /></td>
                    <td className="p-2 font-mono text-[10px] text-white/50">{r.rcode ?? "—"}</td>
                    <td className="p-2 font-mono text-[10px] text-white/40">{r.host.searchDomain}</td>
                    <td className="p-2 tabular-nums text-white/80">{r.avg ?? "—"}</td>
                    <td className="p-2 tabular-nums text-white/60">{r.jitter ?? "—"}</td>
                    <td className="p-2 tabular-nums text-white/60">{r.p95 ?? "—"}</td>
                    <td className="p-2 font-display font-bold text-orange-300">{r.score ?? "—"}</td>
                  </tr>
                ))}
                {!visibleDns.length && (
                  <tr><td colSpan={12} className="p-6 text-center text-white/35">
                    {!dns.length
                      ? t("dns_no_data", lang)
                      : workingDns.length === 0 && filterCensus.FILTERED + filterCensus.BROKEN + filterCensus.OFFLINE > 0
                        ? (isAr
                            ? "لا يوجد DNS يعمل على شبكتك الآن — كل الخوادم المفحوصة إما مفلترة أو معطّلة أو غير متصلة، لذلك لا تظهر نتائج. فعّل «إظهار الكل» لتشخيصها."
                            : "No DNS works on your network right now — every scanned server is filtered, broken, or offline, so no results are shown. Enable “Show all” to diagnose them.")
                        : (isAr
                            ? "لا يوجد DNS يعمل حالياً — الخوادم المفحوصة غير متاحة."
                            : "No working DNS right now — the scanned servers are unavailable.")}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {dns.length > 0 && <p className="mt-3 text-[10px] leading-relaxed text-white/35">{t("dns_legend", lang)}</p>}
        </>
      ) : (
        <>
          {community.length > 0 && (
            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="mb-2 text-[11px] font-bold text-emerald-300">
                🌍 {isAr ? "نقاط مؤكدة من فحوصات مجتمع المستخدمين" : "Endpoints confirmed by the community's scans"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {community.map((c) => (
                  <span key={`${c.host}:${c.port}`} className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-black/30 px-2 py-1 font-mono text-[10px] text-white/75" dir="ltr">
                    {c.host}:{c.port}
                    <span className="font-bold text-emerald-300">×{c.confirmations}</span>
                    <CopyValue value={`${c.host}:${c.port}`} />
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="max-h-[26rem] overflow-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-[#0c0700]">
              <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-white/35">
                <th className="p-2">#</th><th className="p-2">ENDPOINT</th><th className="p-2">{t("dns_isp", lang)}</th>
                <th className="p-2">{t("dns_status", lang)}</th><th className="p-2">EVIDENCE</th><th className="p-2">STATE</th>
                <th className="p-2">{t("dns_avg", lang)}</th><th className="p-2">{t("dns_jitter", lang)}</th><th className="p-2">{t("dns_gscore", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {proxyByJitter.map((r, i) => (
                <tr key={`${r.entry.host}:${r.entry.port}`} className={`border-b border-white/5 ${r.status === "FAILED" || r.status === "TIMEOUT" ? "opacity-40" : ""}`}>
                  <td className="p-2 font-display font-bold text-white/50">{i + 1}</td>
                  <td className="p-2">
                    <span className="inline-flex items-center gap-1.5" dir="ltr">
                      <FavoriteToggle active={isProxyFav(`${r.entry.host}:${r.entry.port}`)} onToggle={() => toggleProxy(`${r.entry.host}:${r.entry.port}`)} label={`${r.entry.host}:${r.entry.port}`} />
                      <span className="font-mono text-white/90">{r.entry.host}:{r.entry.port}</span>
                      <CopyValue value={`${r.entry.host}:${r.entry.port}`} />
                    </span>
                  </td>
                  <td className="p-2 text-white/60">{r.entry.isp}</td>
                  <td className="p-2"><StatusChip status={r.status} /></td>
                  <td className="p-2 font-mono text-[9px] text-white/45">{r.evidence}</td>
                  <td className="p-2 text-[9px] font-bold text-white/45">{r.entry.state === "confirmed" ? "✔" : "○"}</td>
                  <td className="p-2 tabular-nums text-white/80">{r.avg ?? "—"}</td>
                  <td className="p-2 tabular-nums text-white/60">{r.jitter ?? "—"}</td>
                  <td className="p-2 font-display font-bold text-orange-300">{r.score ?? "—"}</td>
                </tr>
              ))}
              {!bestProxy.length && <tr><td colSpan={9} className="p-6 text-center text-white/35">{t("dns_no_data", lang)}</td></tr>}
            </tbody>
          </table>
          {bestProxy.length > 0 && (
            <p className="mt-3 text-[10px] leading-relaxed text-white/35">
              {bestProxy[0].source === "NETLIFY_EDGE_PROBE"
                ? "HTTP CONNECT handshakes and TCP connects are measured by the edge probe function; latency is measured from that region, not from the user's Wi-Fi."
                : "Browser-only mode: HTTPS reachability is measured for real. Deploy on Netlify to enable the real HTTP CONNECT / TCP probing."}
            </p>
          )}
          </div>
        </>
      )}

      <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] leading-relaxed text-amber-200/70">
        ⚠️ {t("dns_disclaimer", lang)}
      </p>
    </div>
  );
}
