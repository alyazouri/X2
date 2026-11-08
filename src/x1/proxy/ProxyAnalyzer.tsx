import { useState } from "react";
import { useLang } from "../LanguageContext";
import { t } from "../i18n";
import { PROXY_POOL, PROXY_DUPLICATES_REMOVED } from "./pool";
import { analyzeProxies, probeProxy, type ProxyAnalysis, type ProxyRecord, type ProxySample } from "./engine";
import { matchDnsProxy, type MatchResult } from "./match";
import { dnsScanStore } from "../dns/store";
import { useGeolocation } from "../geo/useGeolocation";
import { useNetworkDetection } from "../network/useNetwork";
import { DeviceAgentPanel } from "./DeviceAgentPanel";
import { scanViaServer } from "./serverScanner";

const STATUS_LABEL: Record<string, string> = {
  "TLS-OK": "✅ TLS-OK",
  "SERVER-VERIFIED": "🌐 SERVER-VERIFIED",
  REACHABLE: "🟠 REACHABLE",
  CONNECTED: "🟢 CONNECTED",
  "BROWSER-BLOCKED": "🔒 BROWSER-BLOCKED",
  TIMEOUT: "⏱️ TIMEOUT",
  UNREACHABLE: "❌ UNREACHABLE",
};
const STATUS_COLOR: Record<string, string> = {
  "TLS-OK": "text-emerald-300", "SERVER-VERIFIED": "text-sky-300", REACHABLE: "text-orange-300", CONNECTED: "text-emerald-300",
  "BROWSER-BLOCKED": "text-fuchsia-300", TIMEOUT: "text-white/40", UNREACHABLE: "text-red-400",
};

function IoBadge({ tx, rx, bidirectional }: { tx: number; rx: number; bidirectional: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[8px] font-bold ${
        bidirectional ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
      }`}
      title={`Confirmed transport evidence: TX ${tx}, RX ${rx}`}
    >
      <span>↑ TX {tx}</span><span>↓ RX {rx}</span><span>{bidirectional ? "↕" : "→"}</span>
    </span>
  );
}

export function ProxyAnalyzer() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<ProxyAnalysis | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const geo = useGeolocation();
  const net = useNetworkDetection();

  const runMatch = async () => {
    setMatchError(null);
    const dns = dnsScanStore.get();
    if (!dns || dnsScanStore.ageMs() > 5 * 60 * 1000) {
      setMatch(null);
      setMatchError(isAr ? "نتيجة DNS غير موجودة أو قديمة. أعد فحص DNS أولاً." : "DNS result is missing or stale. Re-scan DNS first.");
      return;
    }
    if (!analysis || analysis.ranked.length === 0 || dns.ranked.length === 0) {
      setMatch(null);
      setMatchError(t("proxy_match_need_both", lang));
      return;
    }

    // Fresh pre-match validation: every candidate that enters matching is
    // probed again immediately. Stale/unresponsive endpoints are removed.
    setRevalidating(true);
    const candidateKeys = new Set(analysis.ranked.slice(0, 24).map((r) => r.endpoint));
    const fresh = new Map<string, ProxySample>();
    await Promise.all(PROXY_POOL.filter((p) => candidateKeys.has(`${p.host}:${p.port}`)).map(async (p) => {
      const endpoint = `${p.host}:${p.port}`;
      const rounds: ProxySample[] = [];
      for (let i = 0; i < 2; i++) rounds.push(await probeProxy(p));
      fresh.set(endpoint, {
        rtts: rounds.flatMap((r) => r.rtts),
        attempts: rounds.reduce((s, r) => s + r.attempts, 0),
        tlsOk: rounds.some((r) => r.tlsOk),
        connected: rounds.some((r) => r.connected),
        txCount: rounds.reduce((s, r) => s + r.txCount, 0),
        rxCount: rounds.reduce((s, r) => s + r.rxCount, 0),
        browserBlocked: rounds.every((r) => r.browserBlocked),
        serverVerified: rounds.some((r) => r.serverVerified),
      });
    }));
    const unresolved = PROXY_POOL.filter((p) => {
      const sample = fresh.get(`${p.host}:${p.port}`);
      return candidateKeys.has(`${p.host}:${p.port}`) && (!sample || !sample.connected);
    });
    const serverFresh = await scanViaServer(unresolved);
    for (const [endpoint, sample] of serverFresh) fresh.set(endpoint, sample);
    const freshAnalysis = analyzeProxies(fresh);
    setAnalysis(freshAnalysis);
    setRevalidating(false);
    if (freshAnalysis.ranked.length === 0) {
      setMatch(null);
      setMatchError(isAr ? "فشل اختبار البروكسيات مباشرة قبل المطابقة. لا يوجد مسار مستجيب حالياً." : "Pre-match proxy validation failed. No endpoint is currently responsive.");
      return;
    }
    // Only trust real/high-accuracy GPS for distance matching; a coarse
    // network/IP estimate can be the wrong city and must not skew proximity.
    const user = geo.status === "granted" && geo.precision !== "coarse"
      ? { lat: geo.coords.lat, lng: geo.coords.lng }
      : null;
    // The user's live network (detected from their public IP) drives ISP affinity.
    const liveNetwork = net.status === "detected"
      ? { asn: net.info.asn, isp: net.friendlyIsp ?? net.info.isp }
      : null;
    setMatch(matchDnsProxy(dns, freshAnalysis, 8, user, liveNetwork));
  };

  const run = async () => {
    setScanning(true); setProgress(0); setAnalysis(null);
    const samples = new Map<string, ProxySample>();
    const ROUNDS = 5;
    let done = 0;
    for (let round = 0; round < ROUNDS; round++) {
      await Promise.all(PROXY_POOL.map(async (p) => {
        const s = await probeProxy(p);
        const endpoint = `${p.host}:${p.port}`;
        const prev = samples.get(endpoint) ?? {
          rtts: [], attempts: 0, tlsOk: false, connected: false,
          txCount: 0, rxCount: 0, browserBlocked: false, serverVerified: false,
        };
        samples.set(endpoint, {
          rtts: s.rtts.length ? [...prev.rtts, ...s.rtts] : prev.rtts,
          attempts: prev.attempts + s.attempts,
          tlsOk: prev.tlsOk || s.tlsOk,
          connected: prev.connected || s.connected,
          txCount: prev.txCount + s.txCount,
          rxCount: prev.rxCount + s.rxCount,
          browserBlocked: prev.browserBlocked || s.browserBlocked,
          serverVerified: prev.serverVerified || s.serverVerified,
        });
        done++; setProgress(Math.round((done / (ROUNDS * PROXY_POOL.length)) * 100));
      }));
    }
    // Browser-blocked/unresolved ports are checked by a same-origin Netlify
    // Function using raw TCP. This produces SERVER-VERIFIED evidence.
    const blocked = PROXY_POOL.filter((p) => {
      const sample = samples.get(`${p.host}:${p.port}`);
      return !sample || sample.browserBlocked || !sample.connected;
    });
    const serverSamples = await scanViaServer(blocked);
    for (const [endpoint, sample] of serverSamples) samples.set(endpoint, sample);
    setAnalysis(analyzeProxies(samples));
    setScanning(false);
  };

  const a = analysis;
  const allProxyRows = a
    ? [...a.records].sort((left, right) => {
        const order = (record: ProxyRecord): number =>
          record.io.bidirectional ? 0
            : record.responsive ? 1
              : record.io.browserBlocked ? 2 : 3;
        return order(left) - order(right) ||
          left.port - right.port ||
          left.endpoint.localeCompare(right.endpoint);
      })
    : [];

  return (
    <div className="card relative overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-7">
            <Stat label={isAr ? "البروكسيات" : "Proxies"} value={`${PROXY_POOL.length}`} />
            <Stat label={isAr ? "مكرر محذوف" : "Dupes removed"} value={`${PROXY_DUPLICATES_REMOVED}`} />
            <Stat label={isAr ? "إرسال + استقبال" : "TX + RX"} value={`${a?.duplex ?? 0}`} />
            <Stat label={isAr ? "إرسال فقط" : "TX only"} value={`${a?.txOnly ?? 0}`} />
            <Stat label={isAr ? "محجوب بالمتصفح" : "Browser blocked"} value={`${a?.browserBlocked ?? 0}`} />
            <Stat label={isAr ? "مؤكد من الخادم" : "Server verified"} value={`${a?.serverVerified ?? 0}`} />
            <Stat label={isAr ? "مُرتّبة" : "Ranked"} value={`${a?.ranked.length ?? 0}`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => void runMatch()} disabled={revalidating || scanning} className="btn-ghost rounded-xl px-4 py-2.5 text-xs disabled:opacity-50">
              {revalidating ? (isAr ? "جاري إعادة التحقق…" : "Revalidating…") : t("proxy_match_btn", lang)}
            </button>
            <button onClick={run} disabled={scanning} className="btn-primary rounded-xl px-4 py-2.5 text-xs disabled:opacity-50">
              {scanning ? `${t("dns_scanning", lang)} ${progress}%` : isAr ? "🔍 فحص البروكسيات" : "🔍 Scan Proxies"}
            </button>
          </div>
        </div>

        {scanning && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5">
            <span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Disclaimer */}
        <p className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3 text-[10px] leading-relaxed text-cyan-200/80">
          ⚠️ {isAr
            ? "الفحص الدقيق: المنافذ التي يمنعها المتصفح تُرسل إلى Netlify TCP Scanner آمن، فتظهر SERVER-VERIFIED عند فتح المنفذ. زمن SERVER-VERIFIED من منطقة خادم Netlify وليس من واي فاي المستخدم؛ TX/RX المحلي يبقى منفصلاً."
            : "Precision probe: browser-blocked ports are sent to a secured Netlify TCP Scanner and show SERVER-VERIFIED when open. SERVER-VERIFIED latency is from the Netlify region, not the user's Wi-Fi; local TX/RX remains separate."}
        </p>

        {/* Network (Wi-Fi ISP) detection banner */}
        <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-[10px] ${
          net.status === "detected"
            ? "border-sky-400/25 bg-sky-500/5 text-sky-200/90"
            : "border-white/10 bg-white/[0.03] text-white/60"
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-sm">{net.status === "detected" ? "📶" : "📡"}</span>
            {net.status === "detected" ? (
              <span>
                {isAr ? "شبكتك الحالية" : "Your current network"}:{" "}
                <b className="text-sky-300">{net.friendlyIsp ?? net.info.isp ?? (isAr ? "غير معروف" : "Unknown")}</b>
                {net.info.asn && <span className="font-display text-white/60" dir="ltr"> · {net.info.asn}</span>}
                {net.info.ip && <span className="text-white/40" dir="ltr"> · IP {net.info.ip}</span>}
                <span className="text-white/50">
                  {" "}{isAr ? "— سيتم اختيار DNS والبروكسي من نفس شبكتك أولاً" : "— DNS & proxy on YOUR network are matched first"}
                </span>
              </span>
            ) : net.status === "detecting" ? (
              <span>{isAr ? "جاري كشف شبكتك (IP → ISP)…" : "Detecting your network (IP → ISP)…"}</span>
            ) : net.status === "failed" ? (
              <span>{isAr ? "تعذّر كشف الشبكة — ستُستخدم مطابقة الشبكة العامة" : "Network detection failed — generic affinity matching will be used"}</span>
            ) : (
              <span>{isAr ? "سيتم كشف شبكتك تلقائياً" : "Your network will be detected automatically"}</span>
            )}
          </div>
          {net.status !== "detected" && net.status !== "detecting" && (
            <button onClick={net.redetect} className="btn-ghost rounded-lg px-2.5 py-1 text-[9px]">📡 {isAr ? "إعادة الكشف" : "Redetect"}</button>
          )}
        </div>

        {/* GPS location banner */}
        <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-[10px] ${
          geo.status === "granted"
            ? geo.precision === "coarse"
              ? "border-amber-400/25 bg-amber-500/5 text-amber-200/90"
              : "border-emerald-400/25 bg-emerald-500/5 text-emerald-200/90"
            : "border-white/10 bg-white/[0.03] text-white/60"
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-sm">{geo.status === "granted" && geo.precision === "coarse" ? "⚠️" : "📍"}</span>
            {geo.status === "granted" ? (
              <span>
                {geo.precision === "coarse"
                  ? (isAr ? "⚠️ موقع تقديري (شبكة/IP — قد يختلف عن موقعك الفعلي)" : "⚠️ Estimated location (network/IP — may differ from your real position)")
                  : isAr ? "موقعك" : "Your location"}
                :{" "}
                <b className="font-display tabular-nums" dir="ltr">
                  {geo.coords.lat.toFixed(4)}, {geo.coords.lng.toFixed(4)}
                </b>
                {geo.coords.accuracy !== null && (
                  <span className={geo.precision === "coarse" ? "text-amber-300" : "text-white/40"}>
                    {" "}· {geo.precision === "precise" ? "🎯 دقيق" : geo.precision === "approximate" ? "⚡ تقريبي" : "⚠️ شبكة"} ±
                    {geo.coords.accuracy >= 1000 ? `${(geo.coords.accuracy / 1000).toFixed(1)}km` : `${Math.round(geo.coords.accuracy)}m`}
                  </span>
                )}
                {geo.precision !== "coarse" && (isAr ? " — القرب يُحسب نحو كل خادم" : " — proximity computed to each server")}
              </span>
            ) : geo.status === "prompting" ? (
              <span>{isAr ? "جاري طلب إذن الموقع بدقة عالية…" : "Requesting high-accuracy location…"}</span>
            ) : geo.status === "denied" ? (
              <span>{isAr ? "تم رفض إذن الموقع — القرب يُقدّر من الرقم الفيزيائي للمسار" : "Location denied — proximity inferred from route latency"}</span>
            ) : geo.status === "unsupported" ? (
              <span>{isAr ? "المتصفح لا يدعم GPS" : "GPS unsupported in this browser"}</span>
            ) : geo.status === "error" ? (
              <span>{isAr ? "خطأ في تحديد الموقع" : "Location error"}: {geo.message}</span>
            ) : (
              <span>{isAr ? "موقعك يُستخدم لإيجاد الأقرب اتصالاً" : "Your location will find the nearest endpoint"}</span>
            )}
          </div>
          {geo.status !== "granted" && geo.status !== "prompting" && (
            <button onClick={geo.requestAgain} className="btn-ghost rounded-lg px-2.5 py-1 text-[9px]">📍 {isAr ? "تفعيل الموقع" : "Enable GPS"}</button>
          )}
        </div>

        {/* DNS ↔ Proxy match */}
        {matchError && (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">⚠️ {matchError}</p>
        )}
        {match && match.best && (
          <div className="mt-5 rounded-xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/5 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="font-display text-[11px] font-bold tracking-widest text-violet-300">{t("proxy_match_title", lang)}</div>
              <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${match.best.sameAsn ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300"}`}>
                {match.best.sameAsn ? `🤝 ${t("proxy_match_same_asn", lang)}` : `🔀 ${t("proxy_match_cross", lang)}`}
              </span>
            </div>
            <p className="mb-3 text-[10px] text-white/50">{t("proxy_match_sub", lang)}</p>

            {/* Best pair */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-orange-400/20 bg-orange-500/5 p-3">
                <div className="text-[9px] uppercase tracking-widest text-orange-400">🛰️ DNS</div>
                <div className="font-display text-base font-black text-white tabular-nums" dir="ltr">{match.best.dns.ip}</div>
                <div className="text-[10px] text-white/50" dir="ltr">{match.best.dns.isp}{match.best.dns.verification.asn ? ` · ${match.best.dns.verification.asn}` : ""}</div>
                <div className="mt-1 text-[10px] text-orange-300">{t("dns_gscore", lang)}: {match.best.dns.gamingScore} · {match.best.dns.metrics.avg} ms</div>
              </div>
              <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3">
                <div className="text-[9px] uppercase tracking-widest text-cyan-400">🛡️ Proxy</div>
                <div className="font-display text-base font-black text-white tabular-nums" dir="ltr">{match.best.proxy.endpoint}</div>
                <div className="text-[10px] text-white/50" dir="ltr">{match.best.proxy.isp} · {match.best.proxy.asn}</div>
                <div className="mt-1 text-[10px] text-cyan-300">{t("dns_gscore", lang)}: {match.best.proxy.gamingScore} · {match.best.proxy.metrics.avg} ms</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg bg-black/30 px-3 py-2">
              <span className="text-[10px] text-white/60">{match.best.rationale}</span>
              <span className="ms-3 shrink-0 rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[10px] font-bold text-violet-300">Match {match.best.matchScore}</span>
            </div>

            <DeviceAgentPanel match={match.best} />

            {/* Pair fully inside the user's own Wi-Fi/ISP network */}
            {match.onUserNetwork && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2">
                <div className="flex items-center gap-2 text-[10px] text-sky-200/90">
                  <span>📶</span>
                  <span>
                    {isAr ? "متوافق مع شبكتك" : "Matches YOUR network"}:
                    <b className="ms-1 text-orange-300" dir="ltr">{match.onUserNetwork.dns.ip}</b>
                    <b className="mx-1 text-white/30">↔</b>
                    <b className="text-cyan-300" dir="ltr">{match.onUserNetwork.proxy.endpoint}</b>
                    <span className="text-white/40" dir="ltr"> · {match.onUserNetwork.proxy.asn}</span>
                  </span>
                </div>
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[9px] font-bold text-sky-300">YOUR ISP</span>
              </div>
            )}

            {/* Geographically closest pair (only when GPS granted) */}
            {match.usedGeo && match.closest && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-3 py-2">
                <div className="flex items-center gap-2 text-[10px] text-emerald-200/80">
                  <span>📍</span>
                  <span>
                    {isAr ? "أقرب زوج جغرافياً" : "Geographically closest pair"}:
                    <b className="ms-1 text-orange-300" dir="ltr">{match.closest.dns.ip}</b>
                    <b className="mx-1 text-white/30">↔</b>
                    <b className="text-cyan-300" dir="ltr">{match.closest.proxy.endpoint}</b>
                    <span className="text-white/40"> · ~{match.closest.geoKm} km</span>
                  </span>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">CLOSEST</span>
              </div>
            )}

            {/* Top matches table */}
            <div className="mt-3">
              <div className="mb-2 font-display text-[10px] font-bold tracking-widest text-white/60">{t("dns_results", lang)} ({match.matches.length})</div>
              <div className="dns-scroll max-h-[240px] overflow-auto rounded-xl border border-white/5">
                <table className="w-full min-w-[600px] border-separate border-spacing-0 text-left text-[11px]">
                  <thead className="sticky top-0 z-10 bg-[#0c0700]/95 text-white/50 backdrop-blur">
                    <tr><th className="px-2 py-1.5">#</th><th className="px-2 py-1.5">DNS</th><th className="px-2 py-1.5">Proxy</th><th className="px-2 py-1.5">{isAr ? "الشبكة" : "Network"}</th><th className="px-2 py-1.5">Match</th></tr>
                  </thead>
                  <tbody>
                    {match.matches.map((m, i) => (
                      <tr key={`${m.dns.ip}-${m.proxy.endpoint}`} className="border-t border-white/5">
                        <td className="px-2 py-1.5 text-white/40">{i + 1}</td>
                        <td className="px-2 py-1.5 font-display font-bold text-orange-300 tabular-nums" dir="ltr">{m.dns.ip}</td>
                        <td className="px-2 py-1.5 font-display font-bold text-cyan-300 tabular-nums" dir="ltr">{m.proxy.endpoint}</td>
                        <td className="px-2 py-1.5 text-white/60" dir="ltr">{m.sameAsn ? `🤝 ${m.proxy.asn}` : `🔀 ${m.dns.verification.asn ?? "?"} ↔ ${m.proxy.asn}`}</td>
                        <td className="px-2 py-1.5 font-display font-bold text-violet-300 tabular-nums">{m.matchScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {match && !match.best && (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">⚠️ {t("proxy_match_empty", lang)}</p>
        )}

        {!a && !scanning && (
          <p className="mt-6 text-center text-sm text-white/50">{isAr ? "اضغط «فحص البروكسيات» لقياس كل بروكسي حيّاً واختيار الأفضل للألعاب." : "Press Scan to live-probe every proxy and pick the best for gaming."}</p>
        )}

        {a && a.ranked.length === 0 && (
          <div className="mt-6 rounded-xl border border-white/5 bg-black/30 p-6 text-center">
            <div className="text-3xl">🛡️</div>
            <p className="mt-2 text-sm text-white/60">{isAr ? "لا توجد استجابة مؤكدة حالياً؛ كل البروكسيات وحالاتها معروضة أدناه." : "No confirmed response yet; every proxy and its status is listed below."}</p>
          </div>
        )}

        {/* Complete proxy inventory — always show every endpoint after scan. */}
        {a && (
          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-[10px] font-bold tracking-widest text-white/60">
                {isAr ? "كل البروكسيات" : "ALL PROXIES"} ({allProxyRows.length})
              </span>
              <div className="flex flex-wrap gap-1.5 text-[9px]">
                <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-300">↕ {a.duplex} TX+RX</span>
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-300">→ {a.txOnly} TX only</span>
                <span className="rounded bg-fuchsia-500/15 px-2 py-0.5 text-fuchsia-300">🔒 {a.browserBlocked} Blocked</span>
              </div>
            </div>
            <p className="mb-2 rounded-lg border border-white/5 bg-black/30 p-2 text-[9px] leading-relaxed text-white/50">
              {isAr
                ? "كل IP:Port يظهر هنا. منافذ 80/8080/8888/10010/20001 لا تختفي؛ على موقع HTTPS قد يمنع المتصفح طلب HTTP أو socket الخام، فتظهر BROWSER-BLOCKED أو TX only. هذا لا يثبت أن البروكسي نفسه متوقف."
                : "Every IP:Port is shown here. Ports 80/8080/8888/10010/20001 are not hidden; on HTTPS the browser may block HTTP or raw sockets, so they show BROWSER-BLOCKED or TX only. That does not prove the proxy itself is offline."}
            </p>
            <div className="dns-scroll max-h-[460px] overflow-auto rounded-xl border border-white/5">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-[11px]">
                <thead className="sticky top-0 z-10 bg-[#0c0700]/95 text-white/50 backdrop-blur">
                  <tr>
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Endpoint</th>
                    <th className="px-2 py-1.5">Port</th>
                    <th className="px-2 py-1.5">{t("dns_status", lang)}</th>
                    <th className="px-2 py-1.5">TX / RX</th>
                    <th className="px-2 py-1.5">{t("dns_gscore", lang)}</th>
                    <th className="px-2 py-1.5">{t("dns_avg", lang)}</th>
                    <th className="px-2 py-1.5">{t("dns_jitter", lang)}</th>
                    <th className="px-2 py-1.5">{t("dns_isp", lang)}</th>
                    <th className="px-2 py-1.5">Catalog</th>
                  </tr>
                </thead>
                <tbody>
                  {allProxyRows.map((record, index) => (
                    <tr
                      key={record.endpoint}
                      className={`border-t border-white/5 ${record.responsive ? "" : "opacity-70"}`}
                    >
                      <td className="px-2 py-1.5 text-white/40">{index + 1}</td>
                      <td className="px-2 py-1.5 font-display font-bold text-white tabular-nums" dir="ltr">🇯🇴 {record.endpoint}</td>
                      <td className="px-2 py-1.5 font-display text-cyan-300 tabular-nums">{record.port}</td>
                      <td className={`px-2 py-1.5 font-bold ${STATUS_COLOR[record.status]}`}>
                        <div>{STATUS_LABEL[record.status]}</div>
                        <div className="mt-0.5 text-[8px] text-white/40" dir="ltr">{record.asn}{record.catalogPrefix ? ` · ${record.catalogPrefix}` : ""}</div>
                      </td>
                      <td className="px-2 py-1.5"><IoBadge tx={record.io.tx} rx={record.io.rx} bidirectional={record.io.bidirectional} /></td>
                      <td className="px-2 py-1.5 font-display font-bold tabular-nums">
                        {record.gamingScore !== null ? <span className="text-cyan-300">{record.gamingScore}</span> : <span className="text-white/30">—</span>}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums text-white/80">{record.metrics.count ? `${record.metrics.avg} ms` : "—"}</td>
                      <td className="px-2 py-1.5 tabular-nums text-white/80">{record.metrics.count > 1 ? `${record.metrics.jitter} ms` : "—"}</td>
                      <td className="px-2 py-1.5 text-white/60">{record.isp}</td>
                      <td className={`px-2 py-1.5 text-[9px] font-bold ${record.state === "confirmed" ? "text-emerald-300" : "text-amber-300"}`}>
                        {record.state.toUpperCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {a && a.top && (
          <>
            {/* Best proxy */}
            <div className="mt-5 rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 to-blue-500/5 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="font-display text-[11px] font-bold tracking-widest text-cyan-300">🥇 {isAr ? "أفضل بروكسي" : "BEST PROXY"}</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">🇯🇴 Jordan</span>
                  <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold text-sky-300">⚡ {a.top.metrics.avg} ms</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-xl font-black text-white tabular-nums" dir="ltr">{a.top.endpoint}</div>
                  <div className="mt-0.5 text-[10px] text-white/50" dir="ltr">{a.top.isp} · {a.top.asn}{a.top.catalogPrefix ? ` · ${a.top.catalogPrefix}` : ""}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[9px]">
                    <span className={`rounded px-2 py-0.5 font-bold ${a.top.state === "confirmed" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                      ✓ {a.top.state === "confirmed" ? "CONFIRMED" : "CANDIDATE"}
                    </span>
                    <span className={`rounded bg-white/5 px-2 py-0.5 font-bold ${STATUS_COLOR[a.top.status]}`}>{STATUS_LABEL[a.top.status]}</span>
                    <IoBadge tx={a.top.io.tx} rx={a.top.io.rx} bidirectional={a.top.io.bidirectional} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl font-black text-cyan-300">{a.top.gamingScore}</div>
                  <div className="text-[9px] text-white/40">{t("dns_gscore", lang)}</div>
                </div>
              </div>
            </div>

            {/* Second + fastest */}
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {a.second && <ProxyCard rec={a.second} label={isAr ? "ثاني أفضل بروكسي" : "SECOND BEST"} />}
              {a.fastest && a.fastest.endpoint !== a.top.endpoint && (
                <div className="card rounded-2xl border-sky-400/30 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-sky-400">⚡ {isAr ? "أسرع مسار" : "Fastest Path"} · 🇯🇴</div>
                      <div className="font-display text-lg font-black text-white tabular-nums" dir="ltr">{a.fastest.endpoint}</div>
                      <div className="text-[10px] text-white/50" dir="ltr">{a.fastest.isp} · {a.fastest.asn}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-3xl font-black text-sky-300">{a.fastest.metrics.avg}<span className="text-xs text-white/40"> ms</span></div>
                      <div className="text-[9px] text-white/40">{t("dns_avg", lang)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Best pair */}
            {a.pair && a.pair.secondary && (
              <div className="mt-3 rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-4">
                <div className="mb-2 font-display text-[11px] font-bold tracking-widest text-cyan-300">🔗 {isAr ? "أفضل زوج بروكسي" : "BEST PROXY PAIR"}</div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-white/50">{t("dns_primary", lang)}:</span>
                  <span className="font-display font-black text-white tabular-nums" dir="ltr">{a.pair.primary.endpoint}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/50">{t("dns_secondary", lang)}:</span>
                  <span className="font-display font-black text-white tabular-nums" dir="ltr">{a.pair.secondary.endpoint}</span>
                  <span className="ms-auto rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">Pair Score {a.pair.pairScore}</span>
                </div>
                <p className="mt-2 text-[10px] text-white/55">{isAr
                  ? `الاحتياطي من ${a.pair.redundant ? "شبكة مختلفة (تنوّع مسار)" : "نفس الشبكة"} للموثوقية.`
                  : `Secondary from ${a.pair.redundant ? "a different network (path diversity)" : "the same network"} for reliability.`}</p>
              </div>
            )}

            {/* ISP bests */}
            <div className="mt-5">
              <div className="mb-2 font-display text-[10px] font-bold tracking-widest text-white/60">📡 ISP Profiles</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {a.ispBests.map((ib) => (
                  <div key={ib.isp} className="rounded-lg border border-white/5 bg-black/30 p-2.5 text-center">
                    <div className="text-[10px] font-bold text-white/70">{ib.isp}</div>
                    <div className="font-display text-xs font-bold text-cyan-300 tabular-nums" dir="ltr">{ib.best ? ib.best.endpoint : "—"}</div>
                    <div className="text-[9px] text-white/40">{ib.count} {isAr ? "بروكسي" : "proxies"}{ib.best ? ` · ${ib.best.gamingScore}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}

function ProxyCard({ rec, label }: { rec: ProxyRecord; label: string }) {
  const { lang } = useLang();
  return (
    <div className="card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/40">🥈 {label}</div>
          <div className="font-display text-lg font-black text-white tabular-nums" dir="ltr">🇯🇴 {rec.endpoint}</div>
          <div className="text-[10px] text-white/50" dir="ltr">{rec.isp} · {rec.asn}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl font-black text-cyan-300">{rec.gamingScore}</div>
          <div className="text-[9px] text-white/40">{t("dns_gscore", lang)}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <Metric k="dns_avg" v={`${rec.metrics.avg}`} unit="ms" />
        <Metric k="dns_median" v={`${rec.metrics.median}`} unit="ms" />
        <Metric k="dns_jitter" v={`${rec.metrics.jitter}`} unit="ms" />
        <Metric k="dns_success" v={`${(rec.metrics.successRate * 100).toFixed(0)}`} unit="%" />
      </div>
      <div className="mt-2"><IoBadge tx={rec.io.tx} rx={rec.io.rx} bidirectional={rec.io.bidirectional} /></div>
    </div>
  );
}

function Metric({ k, v, unit }: { k: string; v: string; unit: string }) {
  const { lang } = useLang();
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-2">
      <div className="text-[9px] uppercase tracking-widest text-white/40">{t(k as never, lang)}</div>
      <div className="font-display text-sm font-bold text-white tabular-nums">{v}<span className="text-[9px] text-white/40"> {unit}</span></div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">
      <div className="font-display text-lg font-black text-cyan-300 tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-white/40">{label}</div>
    </div>
  );
}
