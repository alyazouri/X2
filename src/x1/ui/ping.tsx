import { useState, useEffect, useRef, useCallback } from "react";
import { useLang } from "../LanguageContext";
import { t } from "../i18n";
import { checkPing, fetchNodes, type CheckHostNode } from "../net/CheckHost";
import { measureFetchRtt } from "../../lib/network-rtt";

/* ════════════════ PING MONITOR ════════════════
   REAL measurement: check-host.net nodes execute genuine ICMP pings toward
   the game's own domain from a node inside each region. No simulated
   numbers — when a region has no node or the API is unreachable the cell
   shows "—" (or an honest local fallback), never a fabricated value. */
const SERVERS = [
  { id: "jordan", name: "Jordan · Amman", flag: "🇯🇴" },
  { id: "ksa", name: "Saudi · Riyadh", flag: "🇸🇦" },
  { id: "uae", name: "UAE · Dubai", flag: "🇦🇪" },
  { id: "egypt", name: "Egypt · Cairo", flag: "🇪🇬" },
  { id: "tr", name: "Turkey · Istanbul", flag: "🇹🇷" },
  { id: "eu", name: "Europe · Frankfurt", flag: "🇪🇺" },
  { id: "us", name: "USA · Ashburn", flag: "🇺🇸" },
];
/**
 * Ordered node preference per region: exact country first, then the
 * geographically nearest countries that check-host actually covers.
 * Verified live (2026): check-host has NO nodes in jo/sa/ae/eg, so those
 * regions are measured from the nearest available node and the card says so.
 */
const REGION_COUNTRIES: Record<string, string[]> = {
  jordan: ["jo", "cy", "il", "tr"],
  ksa: ["sa", "cy", "il", "tr", "in"],
  uae: ["ae", "ir", "in", "sg"],
  egypt: ["eg", "cy", "il", "it"],
  tr: ["tr"],
  eu: ["de", "fr", "nl", "gb", "at", "ch", "it", "es", "pl"],
  us: ["us", "ca"],
};
const PING_TARGET = "pubg.com";
const PING_ROUNDS = 3;

/** First available node following the region's preference order. */
function pickRegionNode(codes: string[], nodes: CheckHostNode[]): { node: CheckHostNode | null; fallback: boolean } {
  for (let i = 0; i < codes.length; i += 1) {
    const n = nodes.find((x) => x.country === codes[i]);
    if (n) return { node: n, fallback: i > 0 };
  }
  return { node: null, fallback: false };
}

/** Median of a sample list (more robust than taking only the first sample). */
function medianMs(samples: number[]): number {
  const s = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10;
}

/** Average ping per region from collected sample sets. */
const pingsOf = (sets: Record<string, number[]>): Record<string, number | null> => {
  const out: Record<string, number | null> = {};
  for (const [id, arr] of Object.entries(sets)) {
    out[id] = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  }
  return out;
};

/** REAL browser-side fallback target (actual PUBG domain, opaque fetch timing). */
const DIRECT_TARGET = "https://pubg.com/";
async function measureDirectRtt(): Promise<{ avg: number; jitter: number; loss: number; got: number }> {
  const stats = await measureFetchRtt({ url: DIRECT_TARGET, attempts: 6, timeoutMs: 4000, mode: "no-cors" });
  return {
    avg: stats.average == null ? 0 : Math.round(stats.average),
    jitter: stats.jitter == null ? 0 : Math.round(stats.jitter),
    loss: stats.loss,
    got: stats.samples.length,
  };
}

export function PingMonitor() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [pings, setPings] = useState<Record<string, number | null>>({});
  const [jitter, setJitter] = useState<Record<string, number | null>>({});
  const [loss, setLoss] = useState<Record<string, number | null>>({});
  const [measuring, setMeasuring] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [bestServer, setBestServer] = useState<typeof SERVERS[number] | null>(null);
  /** When a region had no native node: the city of the nearest node actually used. */
  const [origins, setOrigins] = useState<Record<string, string | null>>({});
  /** Real browser-side RTT to the game domain, used when check-host yields nothing. */
  const [direct, setDirect] = useState<{ avg: number; jitter: number; loss: number } | null>(null);
  const measureBusyRef = useRef(false);
  const autoRanRef = useRef(false);
  const measure = useCallback(async () => {
    if (measureBusyRef.current) return; // no concurrent or duplicate runs
    measureBusyRef.current = true;
    try {
    setMeasuring(true); setDone(false); setPings({}); setJitter({}); setLoss({}); setNote(null); setBestServer(null); setOrigins({}); setDirect(null);

    let nodes: CheckHostNode[] = [];
    try { nodes = await fetchNodes(); } catch { nodes = []; }

    // Honest fallback: no global nodes → real RTT to THIS app server only.
    if (!nodes.length) {
      const stats = await measureFetchRtt({ url: "/api/health", attempts: 5, timeoutMs: 4000 });
      if (stats.average != null) {
        const d = {
          avg: Math.round(stats.average),
          jitter: stats.jitter == null ? 0 : Math.round(stats.jitter),
          loss: stats.loss,
        };
        setDirect(d);
        setNote(isAr
          ? `عقد القياس العالمية غير متاحة — القيم أدناه قياس حقيقي من جهازك إلى خادم التطبيق: ${d.avg}ms (تذبذب ±${d.jitter} · فقدان ${d.loss}%).`
          : `Global probe nodes unavailable — below is a REAL measurement from your device to the app server: ${d.avg}ms (jitter ±${d.jitter} · loss ${d.loss}%).`);
      } else {
        setNote(isAr ? "تعذر القياس الحقيقي — تحقق من اتصالك." : "Real measurement failed — check your connection.");
      }
      setMeasuring(false); setDone(true);
      return;
    }

    const picks = SERVERS.map((s) => {
      const { node, fallback } = pickRegionNode(REGION_COUNTRIES[s.id] ?? [], nodes);
      return { s, node, fallback };
    });
    // Transparent labeling: say which city actually measured a region that has
    // no native probe node (never silently pretend it came from that country).
    const originMap: Record<string, string | null> = {};
    for (const { s, node, fallback } of picks) originMap[s.id] = node && fallback ? node.city : null;
    setOrigins(originMap);
    const sampleSets: Record<string, number[]> = {};
    for (let round = 0; round < PING_ROUNDS; round += 1) {
      const results = await Promise.all(picks.map(async ({ s, node }) => {
        if (!node) return { id: s.id, ms: null as number | null };
        try {
          const rows = await checkPing(PING_TARGET, [node.id], 12000);
          const samples = rows[0]?.samplesMs ?? [];
          return { id: s.id, ms: samples.length ? Math.round(medianMs(samples)) : null };
        } catch { return { id: s.id, ms: null }; }
      }));
      for (const res of results) {
        if (res.ms === null) continue;
        (sampleSets[res.id] ??= []).push(res.ms);
      }
      // Progressive, real stats after every round.
      const p: Record<string, number | null> = {};
      const j: Record<string, number | null> = {};
      const l: Record<string, number | null> = {};
      for (const s of SERVERS) {
        const arr = sampleSets[s.id] ?? [];
        if (!arr.length) { p[s.id] = null; j[s.id] = null; l[s.id] = null; continue; }
        p[s.id] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
        j[s.id] = arr.length > 1 ? Math.round(Math.max(...arr) - Math.min(...arr)) : 0;
        l[s.id] = Math.round(((round + 1 - arr.length) / (round + 1)) * 100);
      }
      setPings(p); setJitter(j); setLoss(l);

      // Early exit: if the very first round yielded nothing across ALL regions,
      // the provider is degraded/rate-limited — don't burn two more 12s rounds.
      if (round === 0 && Object.keys(sampleSets).length === 0) break;
    }

    const anyRegionalSample = Object.values(sampleSets).some((a) => a.length > 0);

    if (anyRegionalSample) {
      const ranked = SERVERS.filter((s) => pingsOf(sampleSets)[s.id] != null)
        .sort((a, b) => (pingsOf(sampleSets)[a.id] ?? 0) - (pingsOf(sampleSets)[b.id] ?? 0));
      setBestServer(ranked[0] ?? null);
    } else {
      // Honest fallback: check-host returned no data → measure the user's REAL
      // latency to the actual game domain from their own device. Real numbers,
      // clearly labeled — never fabricated per-region values.
      const d = await measureDirectRtt();
      if (d.got > 0) {
        setDirect({ avg: d.avg, jitter: d.jitter, loss: d.loss });
        setNote(isAr
          ? `عقد القياس لكل منطقة لم تُرجع بيانات الآن (مزوّد measurement مزدحم/مقيّد). القيم أدناه قياس حقيقي مباشر من جهازك إلى ${PING_TARGET}: ${d.avg}ms (تذبذب ±${d.jitter} · فقدان ${d.loss}%).`
          : `Per-region probe nodes returned no data right now (measurement provider busy/limited). Below is a REAL direct measurement from your device to ${PING_TARGET}: ${d.avg}ms (jitter ±${d.jitter} · loss ${d.loss}%).`);
      } else {
        setNote(isAr ? "تعذر القياس الحقيقي — تحقق من اتصالك." : "Real measurement failed — check your connection.");
      }
    }
    setMeasuring(false); setDone(true);
    } finally {
      measureBusyRef.current = false;
    }
  }, [isAr]);
  useEffect(() => {
    if (autoRanRef.current) return; // StrictMode double-mount guard
    autoRanRef.current = true;
    measure();
  }, [measure]);
  return (
    <div className="card relative overflow-hidden rounded-2xl p-5">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-xs font-bold tracking-widest text-orange-400">{t("ping_live", lang)}</div>
          <h3 className="mt-1 text-xl font-bold text-white">{t("ping_live_title", lang)}</h3>
          <p className="mt-1 text-sm text-white/60">{t("ping_live_desc", lang)}</p>
          <p className="mt-1 text-[10px] text-white/40">
            {isAr ? "قياس ICMP حقيقي من أقرب عقدة متاحة لكل منطقة نحو" : "Real ICMP ping from the nearest available node of each region toward"}{" "}
            <span dir="ltr" className="font-mono text-orange-300/80">{PING_TARGET}</span>
            {isAr ? " · 3 جولات" : " · 3 rounds"}
          </p>
        </div>
        <button onClick={measure} disabled={measuring} className="btn-primary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50">
          {measuring ? t("ping_measuring", lang) : t("ping_measure", lang)}
        </button>
      </div>
      {note && (
        <div className="relative mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200/90">⚠️ {note}</div>
      )}
      {direct && (
        <div className="relative mt-4 rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent p-4">
          <p className="mb-3 font-display text-xs font-bold text-orange-300">
            📶 {isAr ? `قياس حقيقي مباشر من جهازك إلى ${PING_TARGET}` : `Real direct measurement from your device to ${PING_TARGET}`}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-white/5 bg-black/30 p-3">
              <p className="font-display text-2xl font-black text-white tabular-nums">{direct.avg}</p>
              <p className="text-[9px] text-white/40">{t("ping_ping", lang)} (ms)</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/30 p-3">
              <p className="font-display text-2xl font-black text-white tabular-nums">±{direct.jitter}</p>
              <p className="text-[9px] text-white/40">{t("ping_jitter", lang)} (ms)</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/30 p-3">
              <p className="font-display text-2xl font-black text-white tabular-nums">{direct.loss}%</p>
              <p className="text-[9px] text-white/40">{t("ping_loss", lang)}</p>
            </div>
          </div>
        </div>
      )}
      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVERS.map((s) => {
          const pv = pings[s.id]; const jv = jitter[s.id]; const lv = loss[s.id];
          const isBest = bestServer?.id === s.id && done;
          const quality = pv == null ? "" : pv < 60 ? t("ping_quality_excellent", lang) : pv < 120 ? t("ping_quality_good", lang) : pv < 200 ? t("ping_quality_medium", lang) : t("ping_quality_poor", lang);
          const color = pv == null ? "bg-white/10" : pv < 60 ? "bg-emerald-500" : pv < 120 ? "bg-amber-400" : pv < 200 ? "bg-orange-500" : "bg-red-500";
          return (
            <div key={s.id} className={`relative overflow-hidden rounded-xl border p-4 transition-all ${isBest ? "border-orange-400 bg-gradient-to-br from-orange-500/20 to-red-500/10 shadow-[0_0_30px_-10px_rgba(255,122,0,0.6)]" : "border-white/10 bg-white/[0.02]"}`}>
              {isBest && <span className="absolute right-2 top-2 rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-bold text-white">{t("ping_best", lang)}</span>}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="text-2xl">{s.flag}</span><div><div className="text-sm font-bold text-white">{s.name}</div><div className="text-[10px] text-white/50">{quality}</div></div></div>
                <div className="text-right"><div className="font-display text-xl font-black text-white tabular-nums">{pv == null ? <span className="text-white/30">—</span> : pv}</div><div className="text-[10px] text-white/40">ms</div></div>
              </div>
              {origins[s.id] && (
                <div className="mt-1.5 rounded bg-white/[0.03] px-1.5 py-1 text-[8px] leading-tight text-white/40">
                  {isAr ? `قياس من أقرب عقدة متاحة: ${origins[s.id]}` : `measured from nearest available node: ${origins[s.id]}`}
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                {[["ping_ping", pv], ["ping_jitter", jv], ["ping_loss", lv]].map(([k, val]) => (
                  <div key={k as string} className="rounded bg-black/30 p-1.5 text-center"><div className="text-white/40">{t(k as never, lang)}</div><div className="font-display font-bold text-white/80 tabular-nums">{(val as number | null) ?? "—"}{k === "ping_loss" ? "%" : ""}</div></div>
                ))}
              </div>
              <div className={`mt-2 h-1 rounded-full ${color}`} style={{ width: `${pv == null ? 0 : Math.max(8, Math.min(100, 100 - (pv / 2)))}%` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
