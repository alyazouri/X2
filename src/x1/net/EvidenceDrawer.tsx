// ════════════════════════════════════════════════════════════════
// EVIDENCE DRAWER — Premium endpoint investigation panel (§20)
// Opens from the side on row click; table stays visible.
// ════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useLang } from "../LanguageContext";
import type { EndpointRecord } from "./types";
import { StatusBadge, FreshnessBadge, VerifyChip, ScoreBar, LatencyDist, Sparkline } from "./components";
import { freshnessOf } from "./stats";

interface Props {
  record: EndpointRecord;
  onClose: () => void;
  onRetest?: (id: string) => void;
}

export function EvidenceDrawer({ record, onClose, onRetest }: Props) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const ep = record.endpoint;
  const m = record.metrics;
  const s = record.scores;
  const v = record.verification;
  const freshness = freshnessOf(record.updatedAt);
  const [mountedAt] = useState(() => Date.now());
  const ageMs = mountedAt - record.updatedAt;

  const label = (ar: string, en: string) => (isAr ? ar : en);

  return (
    <>
      <div className="fixed inset-0 z-[75] bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="ni-drawer" role="dialog" aria-label={isAr ? "تفاصيل النقطة" : "Endpoint details"}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-lg font-black text-white" dir="ltr">{ep.host}:{ep.port}</div>
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              <StatusBadge state={record.state} size="sm" />
              <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[9px] text-white/50">{ep.protocol.toUpperCase()}</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            {onRetest && (
              <button onClick={() => onRetest(ep.id)} className="btn-ghost rounded-lg px-2.5 py-1.5 text-[10px]" title={isAr ? "إعادة الفحص" : "Retest"}>
                ↻
              </button>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(`${ep.host}:${ep.port}`).catch(() => {})}
              className="btn-ghost rounded-lg px-2.5 py-1.5 text-[10px]"
              title={isAr ? "نسخ" : "Copy"}
            >
              📋
            </button>
            <button onClick={onClose} className="btn-ghost rounded-lg px-2.5 py-1.5 text-[10px]" title={isAr ? "إغلاق" : "Close"}>✕</button>
          </div>
        </div>

        {/* Performance */}
        {m && (
          <div className="ni-drawer-section mt-4">
            <div className="mb-2 font-display text-[9px] font-bold tracking-widest text-orange-300">
              {label("الأداء", "PERFORMANCE")}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { v: `${m.p50}`, l: "P50", u: "ms" },
                { v: `${m.p95}`, l: "P95", u: "ms" },
                { v: `${m.jitter}`, l: label("التذبذب", "Jitter"), u: "ms" },
              ].map((x) => (
                <div key={x.l} className="rounded-lg border border-white/5 bg-black/30 p-2">
                  <div className="font-display text-base font-black text-white tabular-nums">{x.v}</div>
                  <div className="text-[8px] text-white/40">{x.l} <span className="text-white/25">{x.u}</span></div>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <LatencyDist p50={m.p50} p90={m.p90} p95={m.p95} p99={m.p99} max={m.max} />
              <div className="mt-1 flex justify-between text-[8px] text-white/30">
                <span>P50 {m.p50}</span><span>P90 {m.p90}</span><span>P95 {m.p95}</span><span>P99 {m.p99}</span>
              </div>
            </div>
            {m.sampleCount > 1 && (
              <div className="mt-2">
                <div className="mb-1 text-[8px] text-white/40">{label("سلسلة زمن الرد", "Response time")}</div>
                <Sparkline data={record.raw.filter((r) => r.ok).map((r) => r.ms)} width={340} height={24} />
              </div>
            )}
          </div>
        )}

        {/* Verification */}
        <div className="ni-drawer-section">
          <div className="mb-2 font-display text-[9px] font-bold tracking-widest text-orange-300">
            {label("التحقق", "VERIFICATION")}
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            <VerifyChip label="DNS UDP" status={v.dnsUdp} />
            <VerifyChip label="DNS TCP" status={v.dnsTcp} />
            <VerifyChip label="NXDOMAIN" status={v.nxdomain} />
            <VerifyChip label="DNSSEC" status={v.dnssec} />
            <VerifyChip label="HTTP" status={v.httpConnect} />
            <VerifyChip label="TLS" status={v.tlsHandshake} />
          </div>
        </div>

        {/* Reliability */}
        {m && (
          <div className="ni-drawer-section">
            <div className="mb-2 font-display text-[9px] font-bold tracking-widest text-orange-300">
              {label("الموثوقية", "RELIABILITY")}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { v: `${m.successCount}`, l: label("نجاح", "Pass") },
                { v: `${m.failCount}`, l: label("فشل", "Fail") },
                { v: `${m.timeoutCount}`, l: label("مهلة", "Timeout") },
                { v: `${m.sampleCount}`, l: label("إجمالي", "Total") },
              ].map((x) => (
                <div key={x.l} className="rounded-lg border border-white/5 bg-black/30 p-1.5">
                  <div className="font-display text-sm font-bold text-white tabular-nums">{x.v}</div>
                  <div className="text-[7px] text-white/40">{x.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-center font-mono text-[10px] text-white/60">
              {m.successRate}% {label("معدل النجاح", "success rate")}
            </div>
          </div>
        )}

        {/* Decomposable Scores (§35) */}
        {s && (
          <div className="ni-drawer-section">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-[9px] font-bold tracking-widest text-orange-300">
                {label("لماذا هذا التصنيف؟", "WHY THIS RANKING?")}
              </span>
              <span className="font-display text-lg font-black text-orange-300">{s.overall}</span>
            </div>
            <div className="space-y-1.5">
              <ScoreBar label={label("الأداء", "Perf")} value={s.performance} color="#ff9e2e" />
              <ScoreBar label={label("الموثوقية", "Reliab")} value={s.reliability} color="#34d399" />
              <ScoreBar label={label("التوافق", "Compat")} value={s.compatibility} color="#60a5fa" />
              <ScoreBar label={label("الثقة", "Confid")} value={s.confidence} color="#a78bfa" />
            </div>
          </div>
        )}

        {/* Classification */}
        <div className="ni-drawer-section">
          <div className="mb-2 font-display text-[9px] font-bold tracking-widest text-orange-300">
            {label("التصنيف", "CLASSIFICATION")}
          </div>
          <div className="space-y-1 text-[10px]">
            {ep.isp && <div className="flex justify-between"><span className="text-white/50">ISP</span><span className="text-white/80">{ep.isp}</span></div>}
            {ep.asn && <div className="flex justify-between"><span className="text-white/50">ASN</span><span className="font-mono text-white/80" dir="ltr">{ep.asn}</span></div>}
            {ep.country && <div className="flex justify-between"><span className="text-white/50">{label("الدولة", "Country")}</span><span className="text-white/80">{ep.country}</span></div>}
            {record.networkBehavior && <div className="flex justify-between"><span className="text-white/50">{label("السلوك", "Behavior")}</span><span className="text-white/80">{record.networkBehavior}</span></div>}
          </div>
        </div>

        {/* Freshness + Policy */}
        <div className="ni-drawer-section">
          <div className="mb-2 font-display text-[9px] font-bold tracking-widest text-orange-300">
            {label("الحداثة", "FRESHNESS")}
          </div>
          <div className="flex items-center justify-between">
            <FreshnessBadge freshness={freshness} ageMs={ageMs} />
            <span className="font-mono text-[8px] text-white/30">{record.policyVersion}</span>
          </div>
        </div>

        {/* Raw Evidence (§38, §39) */}
        {record.raw.length > 0 && (
          <div className="ni-drawer-section">
            <div className="mb-2 font-display text-[9px] font-bold tracking-widest text-orange-300">
              {label("البيانات الخام", "RAW EVIDENCE")}
            </div>
            <div className="ni-vscroll max-h-[140px] space-y-0.5">
              {record.raw.map((sample, i) => (
                <div key={i} className="flex items-center justify-between rounded px-1.5 py-0.5 font-mono text-[9px]">
                  <span className="text-white/30">#{i + 1}</span>
                  <span className={sample.ok ? "text-emerald-300" : "text-red-300"}>{sample.ms}ms</span>
                  <span className="text-white/40">{sample.stage}</span>
                  <span className="text-white/25">{sample.detail || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
