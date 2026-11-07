import { useState } from "react";
import { useLang } from "../LanguageContext";
import { t } from "../i18n";
import { MASTER_DNS, MASTER_DNS_V6, fetchHost, isIPv6 } from "./dataset";
import { SAUDI_DNS } from "./saudiDataset";
import { analyze, dedupeMaster } from "./engine";
import type { DnsCountry } from "./types";
import { dnsScanStore } from "./store";
import { useGeolocation } from "../geo/useGeolocation";
import { distanceTo } from "../geo/distances";
import { useNetworkDetection } from "../network/useNetwork";
import type { DnsAnalysis, DnsRecord, Compatibility, StabilityGrade, DnsStatus, SampleSet } from "./types";

const STATUS_KEY: Record<DnsStatus, string> = {
  "VALID-DNS": "dns_st_valid", "DNS-RCODE2": "dns_st_rcode2", "DNS-RCODE3": "dns_st_rcode3",
  "DNS-RCODE5": "dns_st_rcode5", RESPONSIVE: "dns_st_responsive", TIMEOUT: "dns_st_timeout",
  UNREACHABLE: "dns_st_unreachable", NO_DATA: "dns_st_timeout",
};
const STATUS_COLOR: Record<DnsStatus, string> = {
  "VALID-DNS": "text-emerald-300", "DNS-RCODE2": "text-amber-300", "DNS-RCODE3": "text-sky-300",
  "DNS-RCODE5": "text-yellow-300", RESPONSIVE: "text-orange-300", TIMEOUT: "text-white/40",
  UNREACHABLE: "text-red-400", NO_DATA: "text-white/30",
};

/** All DNS addresses to scan: Jordan (IPv4 + IPv6) or Saudi (IPv4). */
const ALL_DNS = [...MASTER_DNS, ...MASTER_DNS_V6];

type DnsProbe = {
  rtt: number | null;
  rcode: number | null;
  dohOk: boolean;
  tx: number;
  rx: number;
};

/** Probe a DNS server: tries DoH (DNS-over-HTTPS) first for a REAL RCODE,
 *  then falls back to no-cors fetch on the DoH path, then plain HTTPS.
 *  TX counts dispatched requests. RX is counted only when fetch resolves with
 *  an HTTP response. TLS/CORS/network rejection is never treated as RX or RTT. */
async function probeDns(ip: string, timeout = 1600): Promise<DnsProbe> {
  const host = fetchHost(ip);
  const query = `?name=example.com&type=A&_=${Date.now()}`;

  // Strategy 1: DoH with CORS (may read JSON → exact RCODE).
  const start = performance.now();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeout);
  try {
    const resp = await fetch(`https://${host}/dns-query${query}`, {
      headers: { Accept: "application/dns-json" }, mode: "cors", cache: "no-store", signal: ctrl.signal,
    });
    clearTimeout(to);
    const rtt = Math.round(performance.now() - start);
    if (resp.ok) {
      try {
        const data = await resp.json();
        if (typeof data.Status === "number") {
          return { rtt, rcode: data.Status, dohOk: true, tx: 1, rx: 1 };
        }
      } catch { /* not JSON */ }
    }
    // HTTP was received, but the body did not prove a DNS response.
    return { rtt, rcode: null, dohOk: false, tx: 1, rx: 1 };
  } catch {
    clearTimeout(to);
    // CORS error or connection error — try no-cors DoH path
  }

  // Strategy 2: DoH no-cors (detects DoH support without reading response).
  const start2 = performance.now();
  const ctrl2 = new AbortController();
  const to2 = setTimeout(() => ctrl2.abort(), timeout);
  try {
    await fetch(`https://${host}/dns-query${query}`, { mode: "no-cors", cache: "no-store", signal: ctrl2.signal });
    clearTimeout(to2);
    return {
      rtt: Math.round(performance.now() - start2),
      rcode: null,
      dohOk: false,
      tx: 2,
      rx: 1,
    };
  } catch {
    clearTimeout(to2);
    // Rejection does not prove a reply. Do not manufacture RTT from error time.
  }

  // Strategy 3: plain HTTPS reachability probe — a successful TCP connection
  // (or a fast reset) counts as NETWORK reachability for RTT, but is never
  // given the RX badge because there was no application data sent back yet.
  const start3 = performance.now();
  const ctrl3 = new AbortController();
  const to3 = setTimeout(() => ctrl3.abort(), 1200);
  try {
    await fetch(`https://${host}/?_=${Date.now()}`, { mode: "no-cors", cache: "no-store", signal: ctrl3.signal });
    clearTimeout(to3);
    return { rtt: Math.round(performance.now() - start3), rcode: null, dohOk: false, tx: 3, rx: 0 };
  } catch {
    clearTimeout(to3);
    const dt = Math.round(performance.now() - start3);
    if (dt < 1140 && dt >= 2) return { rtt: dt, rcode: null, dohOk: false, tx: 3, rx: 0 };
  }
  return { rtt: null, rcode: null, dohOk: false, tx: 3, rx: 0 };
}

const GRADE_KEY: Record<StabilityGrade, string> = { A: "dns_grade_a", B: "dns_grade_b", C: "dns_grade_c", D: "dns_grade_d", F: "dns_grade_f" };
const GRADE_COLOR: Record<StabilityGrade, string> = { A: "text-emerald-300", B: "text-lime-300", C: "text-amber-300", D: "text-orange-300", F: "text-red-300" };
const COMPAT_KEY: Record<Compatibility, string> = { EXCELLENT: "dns_compat_excellent", VERY_GOOD: "dns_compat_verygood", GOOD: "dns_compat_good", ACCEPTABLE: "dns_compat_acceptable", POOR: "dns_compat_poor", NOT_RECOMMENDED: "dns_compat_notrec" };
const COMPAT_COLOR: Record<Compatibility, string> = { EXCELLENT: "text-emerald-300", VERY_GOOD: "text-lime-300", GOOD: "text-amber-300", ACCEPTABLE: "text-orange-300", POOR: "text-red-300", NOT_RECOMMENDED: "text-red-400" };

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

function DnsCard({ rec, medal, label }: { rec: DnsRecord; medal: string; label: string }) {
  const { lang } = useLang();
  const m = rec.metrics;
  return (
    <div className="card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><span className="text-2xl">{medal}</span><div><div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div><div className="font-display text-lg font-black text-white tabular-nums" dir="ltr">{isIPv6(rec.ip) ? <span className="me-1 rounded bg-violet-500/20 px-1 text-[9px] text-violet-300">v6</span> : "🇯🇴 "}{rec.ip}</div>{rec.verification.hostname && <div className="text-[10px] text-emerald-300/80" dir="ltr">{rec.verification.hostname}</div>}<div className="text-[11px] text-sky-300/90"><span className="text-white/40">{t("dns_search_domain", lang)}:</span> <span dir="ltr">{rec.searchDomain}</span></div></div></div>
        <div className="text-right"><div className="font-display text-3xl font-black text-amber-300">{rec.gamingScore}</div><div className="text-[9px] text-white/40">{t("dns_gscore", lang)}</div></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
        <Metric k="dns_avg" v={`${m.avg}`} unit="ms" />
        <Metric k="dns_median" v={`${m.median}`} unit="ms" />
        <Metric k="dns_p95" v={`${m.p95}`} unit="ms" />
        <Metric k="dns_jitter" v={`${m.jitter}`} unit="ms" />
        <Metric k="dns_loss" v={`${(m.packetLoss * 100).toFixed(0)}`} unit="%" />
        <Metric k="dns_success" v={`${(m.successRate * 100).toFixed(0)}`} unit="%" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className={`rounded bg-white/5 px-2 py-0.5 font-bold ${GRADE_COLOR[rec.grade]}`}>{t(GRADE_KEY[rec.grade] as never, lang)}</span>
        <span className={`rounded bg-white/5 px-2 py-0.5 font-bold ${COMPAT_COLOR[rec.compatibility]}`}>{t(COMPAT_KEY[rec.compatibility] as never, lang)}</span>
        <span className="rounded bg-white/5 px-2 py-0.5 text-white/60">{t("dns_isp", lang)}: {rec.isp}</span>
        <span className="rounded bg-white/5 px-2 py-0.5 text-white/60">{t("dns_confidence", lang)}: {rec.confidence}%</span>
        <IoBadge tx={rec.io.tx} rx={rec.io.rx} bidirectional={rec.io.bidirectional} />
        <VerificationBadge rec={rec} />
      </div>
    </div>
  );
}

function VerificationBadge({ rec }: { rec: DnsRecord }) {
  const { lang } = useLang();
  if (!rec.verification.verified) return null;
  const v = rec.verification;
  const stateKey = v.catalogState === "historical" ? "HISTORICAL" : "CONFIRMED";
  const stateColor =
    v.role === "authoritative" || v.role === "infrastructure"
      ? "bg-fuchsia-500/15 text-fuchsia-300"
      : v.catalogState === "historical"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-emerald-500/15 text-emerald-300";
  const label = v.role === "authoritative"
    ? t("dns_role_authoritative", lang)
    : v.role === "infrastructure"
      ? t("dns_role_infrastructure", lang)
      : t("dns_catalog_verified", lang);
  return (
    <span className={`rounded px-2 py-0.5 font-bold ${stateColor}`} title={v.source ?? undefined}>
      ✓ {label}
      {v.asn ? ` · ${v.asn}` : ""}
      {v.role === "recursive" ? ` · ${stateKey}` : ""}
      {v.historicalReliability !== null ? ` · ${v.historicalReliability}%` : ""}
    </span>
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

export function DnsAnalyzer() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<DnsAnalysis | null>(null);
  const [scanned, setScanned] = useState(false);
  const [country, setCountry] = useState<DnsCountry>("Jordan");
  const geo = useGeolocation();
  const net = useNetworkDetection();
  const pool = country === "Saudi Arabia" ? SAUDI_DNS : ALL_DNS;
  // Static dedupe count (computed once — IP is the unique key).
  const dupCount = pool.length - dedupeMaster(pool).unique.length;
  const v4Count = country === "Saudi Arabia" ? SAUDI_DNS.length : MASTER_DNS.length;
  const v6Count = country === "Saudi Arabia" ? 0 : MASTER_DNS_V6.length;

  const run = async () => {
    setScanning(true); setProgress(0); setAnalysis(null);
    const ips = dedupeMaster(pool).unique;
    const samples = new Map<string, SampleSet>();
    const ATTEMPTS = 4, POOL = 16;
    let idx = 0, done = 0;
    const worker = async () => {
      while (idx < ips.length) {
        const cur = idx++; // capture index before await
        const ip = ips[cur];
        const rtts: number[] = [];
        let rcode: number | null = null;
        let dohOk = false;
        let txCount = 0;
        let rxCount = 0;
        for (let s = 0; s < ATTEMPTS; s++) {
          const r = await probeDns(ip);
          if (r.rtt !== null && r.rtt > 0) rtts.push(r.rtt);
          // Any successful NOERROR response is stronger evidence than a later error.
          if (r.rcode === 0 || (rcode === null && r.rcode !== null)) rcode = r.rcode;
          if (r.dohOk) dohOk = true;
          txCount += r.tx;
          rxCount += r.rx;
        }
        samples.set(ip, { rtts, attempts: txCount, rcode, dohOk, txCount, rxCount });
        done++; setProgress(Math.round((done / ips.length) * 100));
      }
    };
    await Promise.all(Array.from({ length: POOL }, () => worker()));
    const result = analyze(pool, samples, country);
    setAnalysis(result);
    dnsScanStore.set(result);
    setScanned(true);
    setScanning(false);
  };

  const a = analysis;

  return (
    <div className="card relative overflow-hidden rounded-2xl p-5">
      <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="relative">
        {/* Controls + stats */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
            <Stat label={isAr ? "العناوين (v4+v6)" : "Addresses (v4+v6)"} value={`${v4Count}+${v6Count}`} />
            <Stat label={t("dns_duplicates", lang)} value={`${a?.duplicatesMerged ?? dupCount}`} />
            <Stat label={t("dns_analyzed", lang)} value={`${a?.analyzed ?? 0}`} />
            <Stat label={isAr ? "إرسال + استقبال" : "TX + RX"} value={`${a?.duplex ?? 0}`} />
            <Stat label={isAr ? "إرسال فقط" : "TX only"} value={`${a?.txOnly ?? 0}`} />
          </div>
          <div className="flex items-center gap-2">
            {a && <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${country === "Saudi Arabia" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
              {country === "Saudi Arabia" ? (isAr ? "🇸🇦 وضع السعودية" : "🇸🇦 Saudi Mode") : t("dns_jordan_mode", lang)}
            </span>}
            <button onClick={run} disabled={scanning} className="btn-primary rounded-xl px-4 py-2.5 text-xs disabled:opacity-50">
              {scanning ? `${t("dns_scanning", lang)} ${progress}%` : t("dns_scan", lang)}
            </button>
          </div>
        </div>

        {scanning && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all" style={{ width: `${progress}%` }} /></div>
        )}

        {/* Country pool toggle */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[10px] font-bold tracking-widest text-white/50">
              {isAr ? "مجموعة DNS" : "DNS POOL"}
            </span>
            {([["Jordan", "🇯🇴"], ["Saudi Arabia", "🇸🇦"]] as const).map(([id, flag]) => (
              <button
                key={id}
                onClick={() => { setCountry(id); setAnalysis(null); setScanned(false); }}
                disabled={scanning}
                className={`chip flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${country === id ? "active" : ""} disabled:opacity-50`}
              >
                <span className="text-base">{flag}</span>
                {id === "Jordan" ? (isAr ? "الأردن" : "Jordan") : (isAr ? "السعودية" : "Saudi")}
              </button>
            ))}
            <span className="text-[9px] text-white/40">
              {country === "Saudi Arabia"
                ? (isAr ? `${SAUDI_DNS.length} عنوان سعودي` : `${SAUDI_DNS.length} Saudi IPs`)
                : (isAr ? `${ALL_DNS.length} عنوان أردني` : `${ALL_DNS.length} Jordan IPs`)}
            </span>
          </div>
          {country === "Saudi Arabia" && (
            <span className="text-[9px] text-amber-300/70">
              {isAr ? "المسار يُقدّر من داخل السعودية" : "Route estimated from within Saudi Arabia"}
            </span>
          )}
        </div>

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
                {isAr ? "شبكتك" : "Your network"}: <b className="text-sky-300">{net.friendlyIsp ?? net.info.isp ?? (isAr ? "غير معروف" : "Unknown")}</b>
                {net.info.asn && <span className="font-display text-white/60" dir="ltr"> · {net.info.asn}</span>}
                {net.info.ip && <span className="text-white/40" dir="ltr"> · IP {net.info.ip}</span>}
                <span className="text-white/50">{" "}{isAr ? "— DNS الخاص بشبكتك مُشار إليه بشارة 📶" : "— your network's DNS is flagged with 📶"}</span>
              </span>
            ) : net.status === "detecting" ? (
              <span>{isAr ? "جاري كشف شبكتك (IP → ISP)…" : "Detecting your network (IP → ISP)…"}</span>
            ) : net.status === "failed" ? (
              <span>{isAr ? "تعذّر كشف الشبكة" : "Network detection failed"}</span>
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
                : <b className="font-display tabular-nums" dir="ltr">{geo.coords.lat.toFixed(4)}, {geo.coords.lng.toFixed(4)}</b>
                {geo.coords.accuracy !== null && (
                  <span className={geo.precision === "coarse" ? "text-amber-300" : "text-white/40"}>
                    {" "}· {geo.precision === "precise" ? "🎯 دقيق" : geo.precision === "approximate" ? "⚡ تقريبي" : "⚠️ يُقدّر من الشبكة"} ±
                    {geo.coords.accuracy >= 1000 ? `${(geo.coords.accuracy / 1000).toFixed(1)}km` : `${Math.round(geo.coords.accuracy)}m`}
                  </span>
                )}
                {geo.precision !== "coarse" && (isAr ? " — القرب يُحسب نحو كل خادم" : " — proximity computed to each server")}
              </span>
            ) : geo.status === "prompting" ? (
              <span>{isAr ? "جاري طلب إذن الموقع بدقة عالية…" : "Requesting high-accuracy location…"}</span>
            ) : geo.status === "denied" ? (
              <span>{isAr ? "رفضت إذن الموقع — القرب يُقدّر من الرقم الفيزيائي" : "Location denied — proximity inferred from latency"}</span>
            ) : geo.status === "unsupported" ? (
              <span>{isAr ? "المتصفح لا يدعم GPS" : "GPS unsupported"}</span>
            ) : geo.status === "error" ? (
              <span>{isAr ? "خطأ في تحديد الموقع" : "Location error"}: {geo.message}</span>
            ) : (
              <span>{isAr ? "موقعك يُستخدم لإيجاد الأقرب" : "Your location finds the nearest"}</span>
            )}
          </div>
          {geo.status !== "granted" && geo.status !== "prompting" && (
            <button onClick={geo.requestAgain} className="btn-ghost rounded-lg px-2.5 py-1 text-[9px]">📍 {isAr ? "تفعيل الموقع" : "Enable GPS"}</button>
          )}
        </div>

        {/* Disclaimer */}
        <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 text-[10px] leading-relaxed text-amber-200/80">⚠️ {t("dns_disclaimer", lang)}</p>
        <p className="mt-2 rounded-lg border border-sky-400/20 bg-sky-500/5 p-3 text-[10px] leading-relaxed text-sky-200/70">
          ℹ️ {isAr
            ? "دلالات الحالات: VALID-DNS (RCODE 0 = خادم يعمل) · RCODE3 (NXDOMAIN ≠ صالح للألعاب) · RCODE5 (يرفض الاستعلام) · RESPONSIVE (قابل للوصول بقياسات حقيقية). الصفوف المميّزة بشفافية = غير صالحة للألعاب."
            : "Status meanings: VALID-DNS (RCODE 0 = working resolver) · RCODE3 (NXDOMAIN ≠ gaming-valid) · RCODE5 (REFUSED) · RESPONSIVE (reachable, real metrics). Dimmed rows = not gaming-valid."}
        </p>
        <p className="mt-2 rounded-lg border border-emerald-400/15 bg-emerald-500/5 p-3 text-[10px] leading-relaxed text-emerald-200/75">
          ↕ {isAr
            ? "علامة TX/RX خضراء = تم إرسال الطلب واستلام استجابة مؤكدة. TX فقط = خرج الطلب لكن لم تصل استجابة قابلة للإثبات؛ لا تُحسب له latency أو نجاح وهمي."
            : "Green TX/RX = request sent and a confirmed response received. TX only = dispatched but no provable response; no fabricated latency or success is counted."}
        </p>

        {/* IPv6 transparency note */}
        <p className="mt-2 rounded-lg border border-violet-400/15 bg-violet-500/5 p-3 text-[10px] leading-relaxed text-violet-200/70">
          🟣 {isAr
            ? "عناوين IPv6: فقط الأردنية البيور الموثّقة (Orange Jordan + خوادم NITC الرسمية لـ.jo). استُبعدت مرايا anycast الخارجية (AWS/RIPE/PSG) لأنها ليست أردنية. لا نختلق عناوين عشوائية."
            : "IPv6: only verified Jordan-pure addresses (Orange Jordan + official NITC .jo nameservers). External anycast mirrors (AWS/RIPE/PSG) are excluded as non-Jordanian. No random addresses are fabricated."}
        </p>

        {!a && !scanning && !scanned && (
          <p className="mt-6 text-center text-sm text-white/50">{isAr ? "اضغط «بدء التحليل» لفحص جميع عناوين DNS حيّاً واختيار الأفضل للألعاب." : "Press Run to live-probe every DNS address and pick the best for gaming."}</p>
        )}

        {/* Scan completed and nothing responded at all */}
        {a && a.display.length === 0 && (
          <div className="mt-6 rounded-xl border border-white/5 bg-black/30 p-6 text-center">
            <div className="text-3xl">📡</div>
            <p className="mt-2 text-sm text-white/60">{isAr ? "لم يستجب أي عنوان DNS صالح للاختبار على شبكتك." : "No DNS reachable testable servers on your network."}</p>
            <p className="mt-1 text-[11px] text-white/40">{isAr ? "المتصفح لا يمكنه فحص UDP/TCP 53 مباشرة فالـ ISPs المحليون لا يقبلون استعلامات DNS خارجية، DoH أيضاً محدود. القياس يعتمد على مسار HTTPS. أعد المحاولة أو غيّر الشبكة." : "Browsers can't probe UDP/TCP 53 directly; most local ISPs refuse external DNS queries, DoH is also limited. Measurement uses HTTPS path. Retry or switch network."}</p>
          </div>
        )}

        {/* Responders exist but none are gaming-valid (all RCODE3/5): explain, still show table */}
        {a && !a.top && a.display.length > 0 && (
          <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-center">
            <p className="text-xs text-amber-200/80">{isAr ? "⚠️ العناوين التي استجابت تصنّف REFUSED/NXDOMAIN — خادم يرد لكن ليس صالحاً للألعاب. الاستجابة السريعة لا تعني DNS صالح." : "⚠️ Responders classify as REFUSED/NXDOMAIN — servers answered but are not gaming-valid. A fast response ≠ valid DNS."}</p>
          </div>
        )}

        {a && a.display.length > 0 && (
          <>
            {/* Best DNS — Jordan Pure + Shortest Path */}
            {a.top && (
              <div className="mt-5 rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 to-yellow-500/5 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-display text-[11px] font-bold tracking-widest text-amber-300">🥇 {t("dns_best", lang)}</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">🇯🇴 Jordan Pure</span>
                    <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold text-sky-300">⚡ Shortest Path · {a.top.metrics.avg} ms</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-xl font-black text-white tabular-nums" dir="ltr">{isIPv6(a.top.ip) ? <span className="me-1 rounded bg-violet-500/20 px-1 text-[10px] text-violet-300">v6</span> : "🇯🇴 "}{a.top.ip}</div>
                    {a.top.verification.hostname && <div className="text-[10px] text-emerald-300/80" dir="ltr">{a.top.verification.hostname}</div>}
                    <div className="mt-0.5 text-[11px] text-sky-300/90"><span className="text-white/40">{t("dns_search_domain", lang)}:</span> <span dir="ltr">{a.top.searchDomain}</span></div>
                    <div className="mt-1"><IoBadge tx={a.top.io.tx} rx={a.top.io.rx} bidirectional={a.top.io.bidirectional} /></div>
                    {a.top.verification.verified && <div className="mt-1"><VerificationBadge rec={a.top} /></div>}
                  </div>
                  <div className="text-right"><div className="font-display text-2xl font-black text-amber-300">{a.top.gamingScore}</div><div className="text-[9px] text-white/40">{t("dns_gscore", lang)}</div></div>
                </div>
              </div>
            )}

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {a.second && <DnsCard rec={a.second} medal="🥈" label={t("dns_second", lang)} />}
              {a.shortestPath && a.shortestPath.ip !== a.top?.ip && (
                <div className="card rounded-2xl border-sky-400/30 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="text-2xl">⚡</span><div><div className="text-[10px] uppercase tracking-widest text-sky-400">Shortest Path · 🇯🇴 Jordan</div><div className="font-display text-lg font-black text-white tabular-nums" dir="ltr">{isIPv6(a.shortestPath.ip) ? <span className="me-1 rounded bg-violet-500/20 px-1 text-[9px] text-violet-300">v6</span> : "🇯🇴 "}{a.shortestPath.ip}</div></div></div>
                    <div className="text-right"><div className="font-display text-3xl font-black text-sky-300">{a.shortestPath.metrics.avg}<span className="text-xs text-white/40"> ms</span></div><div className="text-[9px] text-white/40">{t("dns_avg", lang)}</div></div>
                  </div>
                </div>
              )}
            </div>

            {/* Best pair */}
            {a.pair && (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-yellow-500/5 p-4">
                <div className="mb-2 font-display text-[11px] font-bold tracking-widest text-amber-300">🔥 {t("dns_pair", lang)}</div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-white/50">{t("dns_primary", lang)}:</span><span className="font-display font-black text-white tabular-nums" dir="ltr">{a.pair.primary.ip}{isIPv6(a.pair.primary.ip) && <span className="ms-1 rounded bg-violet-500/20 px-1 text-[8px] text-violet-300">v6</span>}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/50">{t("dns_secondary", lang)}:</span><span className="font-display font-black text-white tabular-nums" dir="ltr">{a.pair.secondary.ip}{isIPv6(a.pair.secondary.ip) && <span className="ms-1 rounded bg-violet-500/20 px-1 text-[8px] text-violet-300">v6</span>}</span>
                  <span className="ms-auto rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">Pair Score {a.pair.pairScore}</span>
                </div>
                <p className="mt-2 text-[10px] text-white/55">{t("dns_pair_explain", lang)} {isAr
                  ? `اختير الأساسي حسب أعلى Gaming Score، والاحتياطي من ${a.pair.redundant ? "بادئة شبكة مختلفة" : "أعلى نتيجة تالية"} لتنوّع المسار والموثوقية.`
                  : `Primary = highest Gaming Score; Secondary = ${a.pair.redundant ? "a different network prefix" : "next-best score"} for path diversity & reliability.`}</p>
              </div>
            )}

            {/* Why pick */}
            <p className="mt-3 text-[10px] text-white/50">{t("dns_explain", lang)} {isAr
              ? `الترتيب يعتمد على Jitter أولاً ثم الموثوقية ثم Latency ثم الفقدان ثم الاتساق — وليس أقل ping فقط.`
              : `Ranking weights jitter first, then reliability, latency, loss, and consistency — not just lowest ping.`}</p>

            {/* ISP bests */}
            <div className="mt-5">
              <div className="mb-2 font-display text-[10px] font-bold tracking-widest text-white/60">📡 ISP Profiles</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {a.ispBests.map((ib) => (
                  <div key={ib.isp} className="rounded-lg border border-white/5 bg-black/30 p-2.5 text-center">
                    <div className="text-[10px] font-bold text-white/70">{ib.isp}</div>
                    <div className="font-display text-xs font-bold text-amber-300 tabular-nums" dir="ltr">{ib.best ? ib.best.ip : "—"}</div>
                    <div className="text-[9px] text-white/40">{ib.count} {isAr ? "عنوان" : "IPs"}{ib.best ? ` · ${ib.best.gamingScore}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Your Network's DNS — servers on the user's own ISP */}
            {net.status === "detected" && (() => {
              const own = country === "Saudi Arabia"
                ? a.ranked.filter((r) => r.isp === (net.friendlyIsp ?? net.info.isp))
                : a.ranked.filter((r) => r.verification.asn === net.info.asn);
              const ispName = net.friendlyIsp ?? net.info.isp ?? net.info.asn;
              return (
                <div className="mt-5 rounded-xl border border-sky-400/25 bg-sky-500/5 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="font-display text-[11px] font-bold tracking-widest text-sky-300">📶 {t("dns_your_network", lang)}</div>
                    <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[9px] font-bold text-sky-300" dir="ltr">{ispName} · {net.info.asn}</span>
                  </div>
                  <p className="mb-3 text-[10px] text-white/50">{t("dns_your_network_sub", lang)}</p>
                  {own.length === 0 ? (
                    <p className="rounded-lg border border-white/5 bg-black/30 p-3 text-center text-[11px] text-white/50">{t("dns_network_none", lang)}</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {own.slice(0, 6).map((r) => (
                        <div key={r.ip} className="rounded-lg border border-sky-400/20 bg-black/30 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-display text-xs font-bold text-white tabular-nums" dir="ltr">{r.ip}</span>
                            <span className="font-display text-sm font-bold text-amber-300 tabular-nums">{r.gamingScore}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[9px] text-white/50">
                            <span>{r.metrics.avg} ms · {r.metrics.jitter} ms jitter</span>
                            <span className="text-sky-300">{t("dns_on_your_network", lang)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Ranked table */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-[10px] font-bold tracking-widest text-white/60">{t("dns_results", lang)} ({a.display.length}{a.ranked.length !== a.display.length ? ` · ${a.ranked.length} ⚡` : ""})</span>
                <span className="text-[9px] text-emerald-300/70">✓ {isAr ? "يُعرض فقط DNS الذي استجاب على شبكتك" : "Only DNS that responded on your network are shown"}</span>
              </div>
              <p className="mb-2 rounded-lg border border-white/5 bg-black/30 px-2.5 py-1.5 text-[9px] leading-relaxed text-white/50">{t("dns_legend", lang)}</p>
              <div className="dns-scroll max-h-[460px] overflow-auto rounded-xl border border-white/5">
                <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-[11px]">
                  <thead className="sticky top-0 z-10 bg-[#0c0700]/95 backdrop-blur text-white/50">
                    <tr><th className="px-2 py-1.5">#</th><th className="px-2 py-1.5">IP</th><th className="px-2 py-1.5">{t("dns_status", lang)}</th><th className="px-2 py-1.5">{t("dns_search_domain", lang)}</th>{geo.status === "granted" && geo.precision !== "coarse" && <th className="px-2 py-1.5">{isAr ? "المسافة" : "Dist."}</th>}<th className="px-2 py-1.5">{t("dns_jo_route", lang)}</th><th className="px-2 py-1.5">{t("dns_sa_route", lang)}</th><th className="px-2 py-1.5">{t("dns_gscore", lang)}</th><th className="px-2 py-1.5">{t("dns_avg", lang)}</th><th className="px-2 py-1.5">{t("dns_jitter", lang)}</th><th className="px-2 py-1.5">{t("dns_loss", lang)}</th><th className="px-2 py-1.5">{t("dns_success", lang)}</th><th className="px-2 py-1.5">{t("dns_isp", lang)}</th><th className="px-2 py-1.5">{t("dns_compat", lang)}</th></tr>
                  </thead>
                  <tbody>
                    {a.display.map((r, i) => {
                      const flagged = r.gamingScore === null;
                      return (
                        <tr key={r.ip} className={`border-t border-white/5 ${flagged ? "opacity-50" : ""}`}>
                          <td className="px-2 py-1.5 text-white/40">{i + 1}</td>
                          <td className="px-2 py-1.5 font-display font-bold text-white tabular-nums" dir="ltr">{isIPv6(r.ip) ? <span className="me-1 rounded bg-violet-500/20 px-1 text-[8px] text-violet-300">v6</span> : "🇯🇴 "}{r.ip}</td>
                          <td className={`px-2 py-1.5 font-bold ${STATUS_COLOR[r.status]}`}>
                            <div className="flex items-center gap-1">
                              <span>{t(STATUS_KEY[r.status] as never, lang)}</span>
                              {net.status === "detected" && (
                                country === "Saudi Arabia"
                                  ? r.isp === (net.friendlyIsp ?? net.info.isp)
                                  : net.info.asn === r.verification.asn
                              ) && (
                                <span className="rounded bg-sky-500/20 px-1 text-[7px] font-bold text-sky-300" title={t("dns_on_your_network", lang)}>📶</span>
                              )}
                            </div>
                            <div className="mt-1"><IoBadge tx={r.io.tx} rx={r.io.rx} bidirectional={r.io.bidirectional} /></div>
                            {r.verification.asn && (
                              <div className="mt-0.5 text-[8px] text-white/40" dir="ltr">{r.verification.asn}{r.verification.catalogPrefix ? ` · ${r.verification.catalogPrefix}` : ""}</div>
                            )}
                            {r.verification.verified && (
                              <div className={`mt-0.5 text-[8px] font-bold ${r.verification.catalogState === "historical" ? "text-amber-300/90" : "text-emerald-300/80"}`} title={r.verification.source ?? undefined}>
                                ✓ {r.verification.role === "authoritative" ? "AUTH" : r.verification.role === "infrastructure" ? "NITC" : r.verification.catalogState === "historical" ? "HISTORICAL" : `${r.verification.historicalReliability}%`}
                              </div>
                            )}
                          </td>
                        <td className="px-2 py-1.5 text-sky-300/90" dir="ltr">{r.searchDomain}</td>
                        {geo.status === "granted" && geo.precision !== "coarse" && (() => {
                          const d = distanceTo(r.ip, geo.coords.lat, geo.coords.lng);
                          return <td className="px-2 py-1.5 text-sky-300 tabular-nums" title={d.city}>~{d.km} km</td>;
                        })()}
                        <td className="px-2 py-1.5 text-emerald-300 tabular-nums">{r.jordanPct}%</td>
                        <td className="px-2 py-1.5 text-amber-300/90 tabular-nums">{r.saudiPct}%</td>
                        <td className="px-2 py-1.5 font-display font-bold tabular-nums">{r.gamingScore !== null ? <span className="text-amber-300">{r.gamingScore}</span> : <span className="text-white/30">✗</span>}</td>
                          <td className="px-2 py-1.5 tabular-nums text-white/80">{r.metrics.avg}</td>
                          <td className="px-2 py-1.5 tabular-nums text-white/80">{r.metrics.jitter}</td>
                          <td className="px-2 py-1.5 tabular-nums text-white/80">{(r.metrics.packetLoss * 100).toFixed(0)}%</td>
                          <td className="px-2 py-1.5 tabular-nums text-white/80">{(r.metrics.successRate * 100).toFixed(0)}%</td>
                          <td className="px-2 py-1.5 text-white/60">{r.isp}</td>
                          <td className={`px-2 py-1.5 font-bold ${COMPAT_COLOR[r.compatibility]}`}>{t(COMPAT_KEY[r.compatibility] as never, lang)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {a.reachable === 0 && <p className="mt-2 text-center text-[11px] text-white/40">{t("dns_no_data", lang)}</p>}
              <p className="mt-2 text-[9px] text-white/40 leading-relaxed">{t("dns_route_note", lang)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">
      <div className="font-display text-lg font-black text-amber-300 tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-white/40">{label}</div>
    </div>
  );
}
