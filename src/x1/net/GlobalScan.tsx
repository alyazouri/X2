// ═════════════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — GLOBAL DNS SCAN
//
// Shows the ENTIRE directory (no arbitrary cap): the seed list from public
// GitHub repos + every entry a live GitHub sync pulls in. Filterable by
// continent AND by specific country (real metadata carried by the sources).
// Scanning measures the currently filtered batch via the edge (real UDP/53
// + DNSSEC validation); only responders appear in results.
// ═════════════════════════════════════════════════════════════════════════
import { useMemo, useRef, useState } from "react";
import { useLang } from "../LanguageContext";
import { CopyValue } from "./copy";
import { FavoriteToggle, useFavorites } from "./favorites";
import { favoritesFirst } from "../../lib/favorites";
import { fetchJsonWithHardTimeout } from "../../lib/fetch-timeout";
import { GLOBAL_DNS_SEED, GLOBAL_DNS_SOURCES, type GlobalDnsEntry } from "../dns/globalDirectory";
import { MASTER_DNS, inferIspAny, knownDnsEntry } from "../dns/dataset";
import type { DnssecState } from "./NetworkCenter";
import { playerDensityEstimate } from "../../lib/player-density";
import type { ResolverEntry } from "../../lib/github-resolvers";

/** Country name derived from the source label text when it states one. */
function countryFromLabel(label: string, region: GlobalDnsEntry["region"]): string | null {
  if (/Japan/i.test(label)) return "Japan";
  if (/Singapore/i.test(label)) return "Singapore";
  if (/Korea/i.test(label)) return "South Korea";
  if (/China|Baidu|Alibaba|Telecom|Unicom/i.test(label)) return "China";
  if (/Taiwan|CHT|HiNet/i.test(label)) return "Taiwan";
  if (/India|BSNL|MTNL/i.test(label)) return "India";
  if (/\(IR\)|Iran|Shecan|Begzar|403|Electro|Shelter|Radar DNS/i.test(label)) return "Iran";
  if (/UAE|Etisalat/i.test(label)) return "United Arab Emirates";
  if (/Saudi/i.test(label)) return "Saudi Arabia";
  if (/Egypt/i.test(label)) return "Egypt";
  if (/South Africa/i.test(label)) return "South Africa";
  if (/Maroc/i.test(label)) return "Morocco";
  if (/Brazil|Claro|Vivo/i.test(label)) return "Brazil";
  if (/Mexico|Telmex/i.test(label)) return "Mexico";
  if (/Argentina/i.test(label)) return "Argentina";
  if (/Uruguay|Antel/i.test(label)) return "Uruguay";
  if (/Australia/i.test(label)) return "Australia";
  if (/New Zealand/i.test(label)) return "New Zealand";
  const m = label.match(/\((DE|SE|DK|EU|RU|CZ|NL|US)\)/i);
  if (m) {
    const c = m[1].toUpperCase();
    const names: Record<string, string> = { DE: "Germany", SE: "Sweden", DK: "Denmark", EU: "Europe", RU: "Russia", CZ: "Czechia", NL: "Netherlands", US: "United States" };
    return names[c] ?? null;
  }
  return region === "Global" ? null : region;
}

/** One directory row (seed or entry from a live sync). */
export interface DirRow {
  ip: string;
  label: string;                    // provider/source label (never fabricated)
  continent: string | null;         // real continent when the source carries it
  country: string | null;           // real country when the source carries it
  source: string;                   // which repo supplied it
  scanned: boolean;                 // has a real probe result?
  open: boolean;
  rcode: number | null;
  dnssec: DnssecState;
  avg: number | null;
  jitter: number | null;
}

const PAGE = 200;
const SCAN_CHUNK = 50;

/** Country for the local GitHub Jordan dataset. Three intentionally-added
 * foreign addresses are preserved with their verified real countries. */
function localCountry(ip: string, isp: string): string {
  if (isp.includes("Kuwait")) return "Kuwait";
  if (isp.includes("France")) return "France";
  if (isp.includes("HU") || isp.includes("Magyar")) return "Hungary";
  return "Jordan";
}

/** Build the complete initial directory: global curated seeds + the project's
 * full Jordan DNS dataset (originating from github.com/alyazouri/X1). */
function buildBaseRows(): DirRow[] {
  const map = new Map<string, DirRow>();
  for (const e of GLOBAL_DNS_SEED) {
    map.set(e.host, {
      ip: e.host, label: e.label, continent: e.region,
      country: countryFromLabel(e.label, e.region), source: e.source,
      scanned: false, open: false, rcode: null, dnssec: "UNVERIFIED", avg: null, jitter: null,
    });
  }
  for (const ip of MASTER_DNS) {
    const isp = inferIspAny(ip);
    const country = localCountry(ip, isp);
    map.set(ip, {
      ip, label: isp,
      continent: country === "Jordan" || country === "Kuwait" ? "Middle East & Africa" : country === "France" || country === "Hungary" ? "Europe" : null,
      country,
      source: "alyazouri/X1",
      scanned: false, open: false, rcode: null, dnssec: "UNVERIFIED", avg: null, jitter: null,
    });
  }
  return [...map.values()];
}

const jitterOf = (v: number[]): number => {
  if (v.length < 2) return 0;
  let s = 0;
  for (let i = 1; i < v.length; i += 1) s += Math.abs(v[i] - v[i - 1]);
  return Math.round((s / (v.length - 1)) * 10) / 10;
};

export function GlobalScan() {
  const { lang } = useLang();
  const isAr = lang === "ar";

  const [rows, setRows] = useState<DirRow[]>(buildBaseRows);
  const [continent, setContinent] = useState<string>("*");
  const [country, setCountry] = useState<string>("*");
  // Show the whole directory initially; responders-only becomes useful after
  // a scan. This fixes the "only 160 / no addresses visible" experience.
  const [onlyLive, setOnlyLive] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const [scanning, setScanning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [status, setStatus] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<{ added: number; sources: number } | null>(null);
  const stopRef = useRef(false);
  const { isDnsFav, toggleDns, favorites } = useFavorites();
  // Jordan local hour (UTC+3 year-round — the same canonical step the project
  // already uses in JordanMatchmaking). Drives the real hourly density model.
  const joHour = useMemo(() => {
    const now = new Date();
    return Math.floor(((now.getUTCHours() + 3) % 24));
  }, []);
  // Live estimate per row: real hourly density × measured stability × catalog
  // reliability. Unknown catalogues are neutral (never invented).
  const densityOf = useMemo(() => (r: DirRow): number => {
    const rel = knownDnsEntry(r.ip)?.historicalReliability ?? null;
    return playerDensityEstimate({
      hour: joHour,
      historicalReliability: rel,
      measuredJitter: r.scanned ? r.jitter : null,
    });
  }, [joHour]);

  // All continents/countries that actually exist in the data (no invented ones).
  const continents = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.continent) set.add(r.continent);
    return [...set].sort();
  }, [rows]);
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.country) set.add(r.country);
    return [...set].sort();
  }, [rows]);

  // Display pool: continent/country filters; "responders only" is a DISPLAY
  // filter only — the scan MUST target unscanned rows as well, otherwise the
  // very first scan has nothing to probe (no responders exist yet).
  const filtered = useMemo(() => {
    let pool = rows;
    if (continent !== "*") pool = pool.filter((r) => r.continent === continent);
    if (country !== "*") pool = pool.filter((r) => r.country === country);
    if (onlyLive) pool = pool.filter((r) => r.scanned && r.open);
    // Order: favorites first → responding first → jitter ascending.
    const sorted = [...pool].sort((a, b) => {
      if (a.open !== b.open) return a.open ? -1 : 1;
      if (a.jitter == null && b.jitter == null) return 0;
      if (a.jitter == null) return 1;
      if (b.jitter == null) return -1;
      return a.jitter - b.jitter;
    });
    return favoritesFirst(sorted, favorites.dns, (r) => r.ip);
  }, [rows, continent, country, onlyLive, favorites.dns]);

  // Scan targets: same continent/country filter, NEVER the onlyLive filter —
  // a scan must cover unscanned entries or it can never produce responders.
  const scanPool = useMemo(() => {
    let pool = rows;
    if (continent !== "*") pool = pool.filter((r) => r.continent === continent);
    if (country !== "*") pool = pool.filter((r) => r.country === country);
    return pool;
  }, [rows, continent, country]);

  const shown = filtered.slice(0, visible);
  const liveCount = useMemo(() => rows.filter((r) => r.open).length, [rows]);

  const syncGitHub = async () => {
    setSyncing(true); setStatus(null);
    setRows([]);
    try {
      const data = await fetchJsonWithHardTimeout<{
        ok?: boolean; entries?: ResolverEntry[]; ips?: string[];
        sources?: { repo: string; ips: number; entries: number }[];
      }>("/api/github-sync", {}, 90000);
      if (!data.ok) throw new Error("SYNC_FAILED");
      const byIp = new Map<string, ResolverEntry>();
      for (const e of data.entries ?? []) byIp.set(e.ip, e);
      const base = buildBaseRows();
      const byRow = new Map(base.map((r) => [r.ip, r]));
      // Enrich existing seeds/Jordan records with real synced country metadata.
      for (const e of data.entries ?? []) {
        const prev = byRow.get(e.ip);
        if (prev) {
          byRow.set(e.ip, { ...prev, country: prev.country ?? e.country, continent: prev.continent ?? e.continent, label: prev.label || e.organization || "GitHub directory" });
          continue;
        }
        byRow.set(e.ip, {
          ip: e.ip, label: e.organization ?? "GitHub directory",
          continent: e.continent, country: e.country, source: "github-sync",
          scanned: false, open: false, rcode: null, dnssec: "UNVERIFIED", avg: null, jitter: null,
        });
      }
      for (const ip of data.ips ?? []) {
        if (byRow.has(ip)) continue;
        const rich = byIp.get(ip);
        byRow.set(ip, { ip, label: rich?.organization ?? "GitHub live", continent: rich?.continent ?? null, country: rich?.country ?? null, source: "github-sync", scanned: false, open: false, rcode: null, dnssec: "UNVERIFIED", avg: null, jitter: null });
      }
      const merged = [...byRow.values()];
      setRows(merged);
      const added = merged.length - base.length;
      setSyncInfo({ added, sources: data.sources?.length ?? 0 });
      setStatus(isAr ? `تُزامن: ${merged.length.toLocaleString()} عنوان في الدليل (${added} من مصادر جديدة)` : `Synced: ${merged.length.toLocaleString()} addresses in the directory (${added} newly from sources)`);
    } catch {
      setStatus(isAr ? "فشلت المزامنة — لم تصل أي بيانات حقيقية." : "Sync failed — no real data arrived.");
    } finally {
      setSyncing(false);
    }
  };

  const scan = async () => {
    if (scanning) return;
    stopRef.current = false;
    // Progress through unscanned rows first. When the whole filter has already
    // been scanned, a later click deliberately re-tests all rows (freshness).
    // This avoids re-testing dead rows forever while never reaching page 2.
    const unscanned = scanPool.filter((r) => !r.scanned);
    const targets = (unscanned.length ? unscanned : scanPool).map((r) => r.ip);
    if (!targets.length) { setStatus(isAr ? "لا يوجد ما يُفحص في هذه التصفية" : "Nothing to scan under this filter"); return; }
    setScanning(true); setStatus(null);
    setProgress({ done: 0, total: Math.min(targets.length, 1500) });
    const limit = Math.min(targets.length, 1500);
    const t0 = performance.now();
    try {
      for (let i = 0; i < limit; i += SCAN_CHUNK) {
        if (stopRef.current) break;
        const hosts = targets.slice(i, i + SCAN_CHUNK);
        try {
          const data = await fetchJsonWithHardTimeout<{
            results?: { host: string; open: boolean; rcode?: number | null; dnssec?: DnssecState; samples?: number[] }[];
          }>("/api/global-scan", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ hosts, rounds: 2 }),
          }, 90000);
          if (!data.results) throw new Error("NO_RESULTS");
          const map = new Map(data.results.map((r) => [r.host, r]));
          setRows((prev) => {
            const next = new Map(prev.map((r) => [r.ip, r]));
            for (const host of hosts) {
              const r = map.get(host);
              if (!r) continue;
              const samples = (r.samples ?? []).filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0);
              const cur = next.get(host);
              if (!cur) continue;
              next.set(host, {
                ...cur,
                scanned: true, open: r.open, rcode: r.rcode ?? null, dnssec: r.dnssec ?? "UNVERIFIED",
                avg: samples.length ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null,
                jitter: samples.length > 1 ? jitterOf(samples) : null,
              });
            }
            setProgress((p) => ({ ...p, done: Math.min(p.total, i + hosts.length) }));
            return [...next.values()];
          });
        } catch { /* chunk failed → keep going */ }
      }
      const ms = Math.round(performance.now() - t0);
      const remaining = Math.max(0, targets.length - limit);
      setStatus(isAr
        ? `اكتملت دفعة ${limit.toLocaleString()} عنوان في ${ms}ms${remaining ? ` · بقي ${remaining.toLocaleString()} غير مفحوص — اضغط مرة أخرى` : ""}`
        : `Scanned a batch of ${limit.toLocaleString()} in ${ms}ms${remaining ? ` · ${remaining.toLocaleString()} remain — press again` : ""}`);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => void scan()} disabled={scanning} className="btn-primary rounded-xl px-4 py-2.5 text-xs disabled:opacity-60">
          {scanning ? (isAr ? "جاري الفحص…" : "Scanning…") : (isAr ? "🌍 افحص المدرجة المعروضة" : "🌍 Scan filtered listing")}
        </button>
        <button onClick={() => void syncGitHub()} disabled={syncing || scanning}
          className="btn-ghost rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-40">
          {syncing ? (isAr ? "…مزامنة" : "Syncing…") : (isAr ? "🔄 مزامنة GitHub" : "🔄 Sync GitHub")}
        </button>
        {scanning && (
          <button onClick={() => { stopRef.current = true; }} className="btn-ghost rounded-xl px-4 py-2.5 text-xs font-semibold text-red-300">
            ⏹ {isAr ? "إيقاف" : "Stop"}
          </button>
        )}
        <label className="ms-auto flex items-center gap-2 text-[10px] text-white/50">
          <input type="checkbox" checked={onlyLive} onChange={(e) => { setOnlyLive(e.target.checked); setVisible(PAGE); }} className="accent-orange-500" />
          {isAr ? "المستجيبة فقط" : "Responders only"}
        </label>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{isAr ? "القارة" : "Continent"}</span>
        <button onClick={() => { setContinent("*"); setCountry("*"); setVisible(PAGE); }}
          className={`chip rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${continent === "*" && country === "*" ? "active" : "text-white/60"}`}>{isAr ? "الكل" : "All"}</button>
        <button onClick={() => { setContinent("Middle East & Africa"); setCountry("Jordan"); setVisible(PAGE); }}
          className={`chip rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${country === "Jordan" ? "active" : "text-white/60"}`}>
          🇯🇴 {isAr ? "الأردن" : "Jordan"}
        </button>
        {continents.map((c) => (
          <button key={c} onClick={() => { setContinent(c); setCountry("*"); setVisible(PAGE); }}
            className={`chip rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${continent === c && country === "*" ? "active" : "text-white/60"}`}>{c}</button>
        ))}
        {countries.length > 0 && (
          <select value={country} onChange={(e) => { setCountry(e.target.value); setContinent("*"); setVisible(PAGE); }}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[10px] text-white focus:border-orange-400/50 focus:outline-none">
            <option value="*">{isAr ? "كل الدول" : "All countries"}</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* status line */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/45">
        <span>{isAr ? "المجلد" : "Directory"}: <b className="text-white/80 tabular-nums">{rows.length.toLocaleString()}</b></span>
        <span>{isAr ? "المعروض" : "Shown"}: <b className="text-white/80 tabular-nums">{shown.length}</b>/<b className="text-white/80 tabular-nums">{filtered.length}</b></span>
        <span>{isAr ? "المستجيبة" : "Live"}: <b className="text-emerald-300 tabular-nums">{liveCount}</b></span>
        {scanning && <span className="text-orange-300">{progress.done}/{progress.total}</span>}
        {syncInfo && <span className="text-sky-300">{isAr ? `آخر مزامنة: +${syncInfo.added} (${syncInfo.sources} مصدر)` : `Last sync: +${syncInfo.added} (${syncInfo.sources} sources)`}</span>}
      </div>
      {status && <p className="text-[10px] text-sky-200/80">{status}</p>}

      {/* progress */}
      {scanning && (
        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
          <div className="stat-bar h-1.5"><span className="block h-full" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`, transition: "width .25s ease" }} /></div>
        </div>
      )}

      {/* table */}
      <div className="max-h-[26rem] overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-[#0c0700]">
            <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-white/35">
              <th className="p-2">#</th><th className="p-2">IP</th><th className="p-2">{isAr ? "البلد" : "Country"}</th>
              <th className="p-2">{isAr ? "المزود" : "Provider"}</th>
              <th className="p-2" title={isAr ? "تقدير نموذجي من الكثافة بالساعة + استقرار العنوان" : "Model estimate from hourly density + address stability"}>{isAr ? "لاعبين %" : "Players %"}</th>
              <th className="p-2">{isAr ? "الحالة" : "State"}</th>
              <th className="p-2">DNSSEC</th><th className="p-2">{isAr ? "المتوسط" : "Avg"}</th><th className="p-2">{isAr ? "التذبذب" : "Jitter"}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.ip} className="border-b border-white/5">
                <td className="p-2 font-display font-bold text-white/50">{i + 1}</td>
                <td className="p-2">
                  <span className="inline-flex items-center gap-1.5">
                    <FavoriteToggle active={isDnsFav(r.ip)} onToggle={() => toggleDns(r.ip)} label={r.ip} />
                    <span className="font-mono text-white/90">{r.ip}</span>
                    <CopyValue value={r.ip} />
                  </span>
                </td>
                <td className="p-2 text-white/60">
                  {r.country ?? (r.continent ?? "—")}
                  {r.continent && r.country ? <span className="text-white/30"> · {r.continent}</span> : null}
                </td>
                <td className="p-2 text-white/50">{r.label}</td>
                <td className="p-2 tabular-nums" title={isAr ? `نموذج تقديري من الكثافة الزمنية + الموثوقية الموثقة + التذبذب المقاس` : "Model projection from hourly density + catalogued reliability + measured jitter"}>
                  {(() => { const d = densityOf(r); const color = d >= 70 ? "text-orange-300" : d >= 40 ? "text-amber-300" : "text-white/55"; return <span className={`font-display text-xs font-bold ${color}`}>{d}%</span>; })()}
                </td>
                <td className="p-2">
                  {!r.scanned ? <span className="text-white/30">—</span>
                    : r.open ? <span className="inline-flex items-center gap-1 text-emerald-300">✅ {r.rcode != null ? `RCODE_${r.rcode}` : ""}</span>
                    : <span className="text-slate-300">⏱️ TIMEOUT</span>}
                </td>
                <td className="p-2">
                  {r.dnssec === "VALIDATING" ? <span className="inline-flex items-center gap-1 rounded border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">🛡️ {isAr ? "محقق" : "valid"}</span>
                    : r.dnssec === "NOT_VALIDATING" ? <span className="inline-flex items-center gap-1 rounded border border-amber-400/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">⚠️ {isAr ? "بدون" : "none"}</span>
                    : <span className="text-white/30">—</span>}
                </td>
                <td className="p-2 tabular-nums text-white/80">{r.avg ?? "—"}</td>
                <td className="p-2 tabular-nums text-white/60">{r.jitter ?? "—"}</td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={9} className="p-6 text-center text-white/35">
                {isAr ? "لا نتائج تحت هذه التصفية." : "No results under this filter."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > shown.length && (
        <button onClick={() => setVisible((v) => v + PAGE)}
          className="btn-ghost w-full rounded-xl px-4 py-2.5 text-xs">
          {isAr ? `عرض المزيد (${shown.length}/${filtered.length})` : `Show more (${shown.length}/${filtered.length})`}
        </button>
      )}

      <details className="rounded-xl border border-white/5 bg-black/25 p-3">
        <summary className="cursor-pointer text-[10px] font-bold tracking-widest text-white/50">
          {isAr ? "المصادر (GitHub) — تُزامَّن حية عبر الزر" : "Sources (GitHub) — synced live via the button"}
        </summary>
        <ul className="mt-2 grid gap-1 text-[9px] text-white/40 sm:grid-cols-2">
          {GLOBAL_DNS_SOURCES.map((s) => (
            <li key={s} className="font-mono" dir="ltr">github.com/{s}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
