// ════════════════════════════════════════════════════════════════
// NETWORK INTELLIGENCE UI COMPONENTS — StatusBadge, MetricCard,
// EvidenceDrawer, ActivityFeed, FilterBar, ScanControls, ExportPanel
// ════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useLang } from "../LanguageContext";
import type { EndpointRecord, HealthState, ScanProgress, Freshness } from "./types";

/* ── Status Badge (§10, §45) ─────────────────────────────────── */
const STATUS_MAP: Record<string, { icon: string; cls: string }> = {
  VERIFIED:    { icon: "✓", cls: "st-verified" },
  DNS_PASS:    { icon: "✓", cls: "st-verified" },
  DNSSEC_PASS: { icon: "✓", cls: "st-verified" },
  NXDOMAIN_PASS: { icon: "✓", cls: "st-verified" },
  TCP_PASS:    { icon: "✓", cls: "st-verified" },
  STABLE:      { icon: "✓", cls: "st-verified" },
  DNS_PARTIAL: { icon: "◐", cls: "st-partial" },
  REACHABLE:   { icon: "◐", cls: "st-partial" },
  TESTING:     { icon: "◌", cls: "st-testing" },
  QUEUED:      { icon: "◌", cls: "st-testing" },
  NEW:         { icon: "◌", cls: "st-testing" },
  VALIDATING:  { icon: "◌", cls: "st-testing" },
  UNSTABLE:    { icon: "△", cls: "st-partial" },
  DNS_FAILED:  { icon: "×", cls: "st-failed" },
  TCP_FAILED:  { icon: "×", cls: "st-failed" },
  NXDOMAIN_FAILED: { icon: "×", cls: "st-failed" },
  DNSSEC_UNKNOWN: { icon: "?", cls: "st-testing" },
  STALE:       { icon: "◷", cls: "st-stale" },
  EXPIRED:     { icon: "◷", cls: "st-stale" },
};

export function StatusBadge({ state, size = "sm" }: { state: HealthState; size?: "xs" | "sm" | "md" }) {
  const map = STATUS_MAP[state] ?? { icon: "◌", cls: "st-testing" };
  const sizeCls = size === "xs" ? "text-[8px] px-1.5 py-0.5" : size === "md" ? "text-[11px] px-3 py-1.5" : "text-[9px] px-2 py-1";
  return (
    <span className={`ni-st-badge ${map.cls} ${sizeCls}`}>
      <span className="ni-st-icon">{map.icon}</span>
      <span className="ni-st-label">{state.replace(/_/g, " ")}</span>
    </span>
  );
}

/* ── Freshness Badge (§29) ───────────────────────────────────── */
const FRESHNESS_CLS: Record<Freshness, string> = {
  LIVE: "text-emerald-300", RECENT: "text-sky-300",
  STALE: "text-amber-300", EXPIRED: "text-red-300",
};

export function FreshnessBadge({ freshness, ageMs }: { freshness: Freshness; ageMs?: number }) {
  const label = freshness === "LIVE" ? "live" : freshness === "RECENT" ? "recent" : freshness === "STALE" ? "stale" : "expired";
  const age = ageMs !== undefined ? (ageMs < 60_000 ? `${Math.round(ageMs / 1000)}s` : `${Math.round(ageMs / 60_000)}m`) : "";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[9px] ${FRESHNESS_CLS[freshness]}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full currentColor" style={{ opacity: freshness === "LIVE" ? 1 : 0.5 }} />
      {label}{age ? ` ${age}` : ""}
    </span>
  );
}

/* ── Metric Card (§11) ───────────────────────────────────────── */
export function MetricCard({ value, label, context, status, timestamp }: {
  value: string; label: string; context?: string; status?: "good" | "warn" | "bad" | "info"; timestamp?: string;
}) {
  const statusCls = status === "good" ? "text-emerald-300" : status === "warn" ? "text-amber-300" : status === "bad" ? "text-red-300" : "text-white";
  return (
    <div className="ni-metric">
      <div className={`ni-metric-value ${statusCls}`}>{value}</div>
      <div className="ni-metric-label">{label}</div>
      {context && <div className="ni-metric-context">{context}</div>}
      {timestamp && <div className="ni-metric-time">{timestamp}</div>}
    </div>
  );
}

/* ── Sparkline ────────────────────────────────────────────────── */
export function Sparkline({ data, width = 60, height = 16, color = "#ff9e2e" }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── Latency Distribution Bar (§24) ──────────────────────────── */
export function LatencyDist({ p50, p90, p95, p99, max }: { p50: number; p90: number; p95: number; p99: number; max: number }) {
  const scale = max > 0 ? 100 / max : 0;
  return (
    <div className="ni-dist" title={`P50 ${p50} · P90 ${p90} · P95 ${p95} · P99 ${p99} ms`}>
      <div className="ni-dist-bar" style={{ width: `${Math.min(100, p50 * scale)}%`, background: "#34d399" }} />
      <div className="ni-dist-bar" style={{ width: `${Math.min(100, (p90 - p50) * scale)}%`, background: "#60a5fa" }} />
      <div className="ni-dist-bar" style={{ width: `${Math.min(100, (p95 - p90) * scale)}%`, background: "#fbbf24" }} />
      <div className="ni-dist-bar" style={{ width: `${Math.min(100, (p99 - p95) * scale)}%`, background: "#f87171" }} />
    </div>
  );
}

/* ── Score Bar (§28, §35) ────────────────────────────────────── */
export function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[9px] text-white/50">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-7 text-right font-mono text-[10px] font-bold text-white/80 tabular-nums">{value}</span>
    </div>
  );
}

/* ── Verification Chips ───────────────────────────────────────── */
export function VerifyChip({ label, status }: { label: string; status: string }) {
  const cls = status === "PASS" || status === "VALIDATED" ? "st-verified" : status === "FAIL" || status === "NOT_VALIDATED" ? "st-failed" : status === "UNSUPPORTED" ? "st-unsupported" : "st-testing";
  return <span className={`ni-st-badge ${cls} text-[8px] px-1.5 py-0.5`}>{label}</span>;
}

/* ── Activity Feed (§15) ─────────────────────────────────────── */
export interface ActivityEntry { at: number; icon: string; text: string; detail?: string; ok: boolean; }

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  if (entries.length === 0) {
    return <div className="py-6 text-center text-[10px] text-white/30">{isAr ? "لا يوجد نشاط بعد" : "No activity yet"}</div>;
  }
  return (
    <div className="space-y-1">
      {entries.slice(0, 12).map((e, i) => (
        <div key={`${e.at}-${i}`} className={`ni-activity-entry ${i === 0 ? "ni-activity-new" : ""}`}>
          <span className="ni-activity-time">{new Date(e.at).toLocaleTimeString("en-GB", { hour12: false })}</span>
          <span className={`ni-activity-icon ${e.ok ? "text-emerald-300" : "text-red-300"}`}>{e.icon}</span>
          <span className="flex-1 truncate text-[10px] text-white/70">{e.text}</span>
          {e.detail && <span className="font-mono text-[9px] text-white/40" dir="ltr">{e.detail}</span>}
        </div>
      ))}
    </div>
  );
}

/* ── Scan Progress Bar (§14, §46) ────────────────────────────── */
export function ScanProgressBar({ progress }: { progress: ScanProgress }) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const phaseLabel = progress.phase === "pass1" ? (isAr ? "فحص سريع" : "FAST DISCOVERY") : progress.phase === "pass2" ? (isAr ? "تحقق عميق" : "DEEP VERIFICATION") : progress.phase === "complete" ? (isAr ? "مكتمل" : "COMPLETE") : progress.phase === "paused" ? (isAr ? "متوقف" : "PAUSED") : progress.phase === "stopped" ? (isAr ? "أوقف" : "STOPPED") : "";
  return (
    <div className="ni-scan-progress">
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="font-display font-bold text-white">{phaseLabel}</span>
        <span className="font-mono text-white/60 tabular-nums">{progress.processed}/{progress.total}</span>
        <span className="font-mono text-orange-300 tabular-nums">{pct}%</span>
        <span className="font-mono text-sky-300 tabular-nums">{progress.endpointsPerSecond}/s</span>
        <span className="text-white/40">⚡{progress.activeWorkers}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-200" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-[9px]">
        <span className="text-emerald-300">✓{progress.verified}</span>
        <span className="text-amber-300">◐{progress.partial}</span>
        <span className="text-red-300">×{progress.failed}</span>
        <span className="text-white/40">⌛{progress.timeout}</span>
        <span className="text-white/40">◦{progress.queued}</span>
      </div>
    </div>
  );
}

/* ── Empty State (§41) ───────────────────────────────────────── */
export function EmptyState({ title, description, action, onAction }: {
  title: string; description: string; action?: string; onAction?: () => void;
}) {
  return (
    <div className="ni-empty">
      <div className="text-3xl opacity-30">📡</div>
      <div className="ni-empty-title">{title}</div>
      <div className="ni-empty-desc">{description}</div>
      {action && onAction && <button onClick={onAction} className="btn-primary mt-3 rounded-xl px-4 py-2 text-xs">{action}</button>}
    </div>
  );
}

/* ── Export Panel (§42) ──────────────────────────────────────── */
export function ExportPanel({ records, kind }: { records: Map<string, EndpointRecord>; kind: "dns" | "proxy" }) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [copied, setCopied] = useState("");

  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setCopied(filename);
    setTimeout(() => setCopied(""), 2500);
  };

  const toCSV = (): string => {
    const rows = [...records.values()].filter((r) => r.metrics);
    if (rows.length === 0) return "";
    const header = "ip,port,protocol,state,p50_ms,p90_ms,p95_ms,p99_ms,jitter_ms,success_rate,samples,performance,reliability,compatibility,confidence,overall,isp,country";
    return [header, ...rows.map((r) => [
      r.endpoint.host, r.endpoint.port, r.endpoint.protocol, r.state,
      r.metrics?.p50, r.metrics?.p90, r.metrics?.p95, r.metrics?.p99,
      r.metrics?.jitter, r.metrics?.successRate, r.metrics?.sampleCount,
      r.scores?.performance, r.scores?.reliability, r.scores?.compatibility, r.scores?.confidence, r.scores?.overall,
      r.endpoint.isp, r.endpoint.country,
    ].join(","))].join("\n");
  };

  const toJSON = (): string => JSON.stringify({
    game: "PUBG MOBILE GLOBAL",
    engine: "ALYAZOURI NETWORK INTELLIGENCE",
    kind, exportedAt: new Date().toISOString(),
    policyVersion: kind === "dns" ? "DNS-POLICY-v3.2" : "PROXY-POLICY-v2.1",
    total: records.size,
    endpoints: [...records.values()].map((r) => ({
      endpoint: r.endpoint.host, port: r.endpoint.port, protocol: r.endpoint.protocol,
      state: r.state, metrics: r.metrics, scores: r.scores, verification: r.verification,
      raw: r.raw, updatedAt: new Date(r.updatedAt).toISOString(),
    })),
  }, null, 2);

  const n = records.size;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => download(`ALYAZOURI-${kind.toUpperCase()}.csv`, toCSV(), "text/csv")} disabled={n === 0} className="ni-export-btn disabled:opacity-40">
        📊 CSV
      </button>
      <button onClick={() => download(`ALYAZOURI-${kind.toUpperCase()}.json`, toJSON(), "application/json")} disabled={n === 0} className="ni-export-btn disabled:opacity-40">
        📋 JSON
      </button>
      {copied && <span className="self-center text-[9px] text-emerald-300">✓ {isAr ? "تم التصدير" : "Exported"}</span>}
    </div>
  );
}
