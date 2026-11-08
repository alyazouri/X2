import { useState, useEffect } from "react";
import { useLang } from "../LanguageContext";
import { t } from "../i18n";
import { BRANDS, WEAPONS } from "../data";
import { RevealSection } from "./core";
import { measureFetchRtt, type RttStats } from "../../lib/network-rtt";

/* ════════════════ PROJECT MARK ════════════════
   The ALYAZOURI "A" monogram: a six-pointed star burst (aim reticle) with an
   aurora gradient matching the interactive background, plus a bright core dot.
   Used as the hero divider, and (as a favicon variant) as the site icon. */
export function AuroraMark({ className = "h-6 w-auto" }: { className?: string }) {
  const rays = 6;
  const points: string[] = [];
  for (let i = 0; i < rays; i += 1) {
    const a = (i * 360) / rays - 90;
    const rad = (a * Math.PI) / 180;
    const outer = 96; const inner = 40;
    const ox = 100 + outer * Math.cos(rad); const oy = 100 + outer * Math.sin(rad);
    const ia = ((i + 0.5) * 360) / rays - 90;
    const irad = (ia * Math.PI) / 180;
    const ix = 100 + inner * Math.cos(irad); const iy = 100 + inner * Math.sin(irad);
    points.push(`${i === 0 ? "M" : "L"}${ox.toFixed(1)},${oy.toFixed(1)} L${ix.toFixed(1)},${iy.toFixed(1)}`);
  }
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="ALYAZOURI" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="markAurora" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd166" />
          <stop offset="38%" stopColor="#ff9e2e" />
          <stop offset="70%" stopColor="#e03e00" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <radialGradient id="markCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff8e1" />
          <stop offset="55%" stopColor="#ffd166" />
          <stop offset="100%" stopColor="#ff7a00" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* star burst / reticle */}
      <path d={`${points.join(" ")} Z`} fill="url(#markAurora)" opacity="0.92" />
      {/* orbit ring */}
      <circle cx="100" cy="100" r="88" fill="none" stroke="url(#markAurora)" strokeWidth="4" opacity="0.45" />
      {/* bright core */}
      <circle cx="100" cy="100" r="26" fill="url(#markCore)" />
    </svg>
  );
}

/* ════════════════ HERO ════════════════ */
/**
 * Authentic Jordanian flag as inline SVG.
 * Geometry follows the official 2:1 construction:
 * - Three horizontal bands (black, white, green) each 1/3 height.
 * - Red isosceles triangle from hoist, base = 1/4 length.
 * - White seven-pointed star centered in the triangle.
 * Natural flat colors only — no glow, no gradient, no effects.
 * NOTE: no longer rendered in the hero — exported in case it is needed again.
 */
export function JordanFlag({ className = "h-6 w-auto" }: { className?: string }) {
  // Seven-pointed star: radius 38, centered at (105, 210) inside the triangle.
  const starPath = Array.from({ length: 7 }, (_, i) => {
    const outer = (i * 360) / 7 - 90;
    const inner = outer + 360 / 14;
    const ox = 105 + 38 * Math.cos((outer * Math.PI) / 180);
    const oy = 210 + 38 * Math.sin((outer * Math.PI) / 180);
    const ix = 105 + 15 * Math.cos((inner * Math.PI) / 180);
    const iy = 210 + 15 * Math.sin((inner * Math.PI) / 180);
    return `${i === 0 ? "M" : "L"}${ox.toFixed(1)},${oy.toFixed(1)} L${ix.toFixed(1)},${iy.toFixed(1)}`;
  }).join(" ") + " Z";
  return (
    <svg viewBox="0 0 840 420" className={className} aria-label="Flag of Jordan" role="img" preserveAspectRatio="xMidYMid meet">
      <rect width="840" height="140" fill="#000000" />
      <rect y="140" width="840" height="140" fill="#FFFFFF" />
      <rect y="280" width="840" height="140" fill="#007A3D" />
      <polygon points="0,0 210,210 0,420" fill="#CE1126" />
      <path d={starPath} fill="#FFFFFF" />
    </svg>
  );
}

/** Real battery level via the Battery Status API. Returns null when unavailable. */
function useRealBattery() {
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  useEffect(() => {
    type BatteryManager = { level: number; charging: boolean; addEventListener: (t: string, cb: () => void) => void; removeEventListener: (t: string, cb: () => void) => void };
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (typeof nav.getBattery !== "function") return;
    let mgr: BatteryManager | null = null;
    const update = () => {
      if (!mgr) return;
      setBattery({ level: Math.round(mgr.level * 100), charging: mgr.charging });
    };
    nav.getBattery().then((m: BatteryManager) => {
      mgr = m;
      update();
      m.addEventListener("levelchange", update);
      m.addEventListener("chargingchange", update);
    }).catch(() => {
      // Battery API present but failed — treat as unavailable.
    });
    return () => {
      if (!mgr) return;
      mgr.removeEventListener("levelchange", update);
      mgr.removeEventListener("chargingchange", update);
    };
  }, []);
  return battery;
}

type NetworkInformationLike = {
  effectiveType?: string;
  type?: string;
  downlink?: number;
};

export function Hero() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const battery = useRealBattery();
  const [status, setStatus] = useState<"measuring" | "connected" | "failed">("measuring");
  const [rtt, setRtt] = useState<RttStats | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [connection] = useState<NetworkInformationLike | null>(() => {
    if (typeof navigator === "undefined") return null;
    return (navigator as Navigator & { connection?: NetworkInformationLike }).connection ?? null;
  });

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const measure = async () => {
      if (!alive) return;
      setStatus("measuring");
      const stats = await measureFetchRtt({ url: "/api/health", attempts: 4, timeoutMs: 4000 });
      if (!alive) return;
      setRtt(stats);
      setStatus(stats.average == null ? "failed" : "connected");
      timer = setTimeout(measure, 30_000);
    };
    void measure();
    const onOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
    };
  }, []);

  const ping = rtt?.average == null ? null : Math.round(rtt.average);
  const and = isAr ? "و" : lang === "es" ? "y" : lang === "ru" ? "и" : lang === "tr" ? "ve" : "and";
  const qualityLabel = ping == null ? "—" : ping < 100 ? t("hero_excellent", lang) : ping < 220 ? t("hero_good", lang) : t("hero_medium", lang);
  const qualityColor = ping == null ? "text-white/35" : ping < 100 ? "text-emerald-300" : ping < 220 ? "text-amber-300" : "text-orange-300";
  const connectionLabel = connection?.effectiveType ?? connection?.type ?? (isAr ? "غير متاح" : "N/A");
  return (
    <section className="relative px-5 pb-10 pt-32 sm:pt-36">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <RevealSection>
            <div className="float inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
              <span className="font-display text-[10px] font-bold tracking-[0.25em] text-orange-300">{t("hero_badge", lang)}</span>
              {/* Real battery — from device Battery API, null when unavailable (iOS/iPadOS) */}
              {battery ? (
                <span className="flex items-center gap-1 font-display text-[10px] font-bold text-emerald-300">
                  🔋 {battery.level}%{battery.charging ? " ⚡" : ""}
                </span>
              ) : (
                <span className="font-display text-[10px] text-white/30">🔋 N/A</span>
              )}
            </div>
            {/* Title block — two lines only, no mark between them */}
            <div className="mt-5 flex flex-col items-center text-center">
              <h1 className="font-display text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                <span className="shimmer-text">{t("hero_title1", lang)}</span>
              </h1>
              <h1 className="mt-2 font-display text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                <span className="neon-text">{t("hero_title2", lang)}</span>
              </h1>
            </div>
            <p className="mt-5 max-w-xl text-base text-white/70 sm:text-lg">
              {t("hero_desc", lang)} <b className="text-orange-300">{t("hero_devices", lang)}</b> {and} <b className="text-orange-300">{t("hero_weapons", lang)}</b>.
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[{ k: t("hero_stats_devices", lang), v: String(BRANDS.flatMap((b) => b.devices).length), sub: t("hero_devices_sub", lang) },
              { k: t("hero_stats_weapons", lang), v: String(WEAPONS.flatMap((c) => c.weapons).length), sub: t("hero_weapons_sub", lang) },
              { k: t("hero_stats_servers", lang), v: "7", sub: t("hero_servers_sub", lang) }].map((s) => (
                <div key={s.k} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur">
                  <div className="font-display text-2xl font-black text-orange-300">{s.v}</div>
                  <div className="text-[11px] font-semibold text-white/80">{s.k}</div>
                  <div className="text-[9px] text-white/40">{s.sub}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => document.getElementById("generator")?.scrollIntoView({ behavior: "smooth" })} className="btn-primary pulse-glow rounded-xl px-6 py-3.5 text-sm">{t("hero_cta1", lang)}</button>
              <button onClick={() => document.getElementById("dns")?.scrollIntoView({ behavior: "smooth" })} className="btn-ghost rounded-xl px-6 py-3.5 text-sm">{t("hero_cta2", lang)}</button>
              <button onClick={() => document.getElementById("dns")?.scrollIntoView({ behavior: "smooth" })} className="btn-ghost rounded-xl px-6 py-3.5 text-sm">{t("hero_cta3", lang)}</button>
              <a
                href="https://serverpubgjor.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost rounded-xl px-6 py-3.5 text-sm"
              >
                {t("hero_cta4", lang)}
              </a>
            </div>
          </RevealSection>
          <RevealSection delay={1}>
            <div className="card neon-box rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <div className="font-display text-[10px] font-bold tracking-[0.25em] text-white/50">{t("hero_live_status", lang)}</div>
                <span className={`flex items-center gap-1 text-[10px] font-bold ${status === "connected" ? "text-emerald-300" : status === "failed" ? "text-red-300" : "text-amber-300"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status === "connected" ? "bg-emerald-400" : status === "failed" ? "bg-red-400" : "animate-pulse bg-amber-400"}`} />
                  {status === "connected" ? t("hero_connected", lang) : status === "failed" ? (isAr ? "تعذّر القياس" : "Measurement failed") : t("hero_measuring", lang)}
                </span>
              </div>
              <div className="mt-4 flex items-end gap-3">
                <span className="font-display text-6xl font-black text-white tabular-nums">{ping ?? "—"}</span>
                <span className="mb-2 text-white/50">ms</span>
                <span className={`mb-2 text-sm font-bold ${qualityColor}`}>{qualityLabel}</span>
              </div>
              <p className="mt-1 text-[9px] text-white/35">
                {isAr ? "RTT حقيقي من متصفحك إلى خادم التطبيق (4 عينات، يُحدّث كل 30 ثانية)" : "Real browser RTT to the app server (4 samples, refreshes every 30s)"}
              </p>
              <div className="mt-4 space-y-2 border-t border-white/5 pt-4 text-xs">
                <div className="flex justify-between"><span className="text-white/50">{isAr ? "حالة الاتصال" : "Connection status"}</span><span className={`font-semibold ${online ? "text-emerald-300" : "text-red-300"}`}>{online ? (isAr ? "متصل" : "Online") : (isAr ? "غير متصل" : "Offline")}</span></div>
                <div className="flex justify-between"><span className="text-white/50">{isAr ? "نوع الشبكة" : "Connection type"}</span><span dir="ltr" className="font-semibold text-white">{connectionLabel}</span></div>
                <div className="flex justify-between"><span className="text-white/50">{isAr ? "التذبذب / الفقدان" : "Jitter / loss"}</span><span dir="ltr" className="font-semibold text-white">{rtt?.jitter == null ? "—" : `±${Math.round(rtt.jitter)}ms`} · {rtt ? `${rtt.loss}%` : "—"}</span></div>
              </div>
            </div>
          </RevealSection>
        </div>
      </div>
    </section>
  );
}

/* ════════════════ PWA BANNER ════════════════ */
const PWA_KEY = "alyazouri_pwa_dismissed";
/** Minimal shape of the Chromium beforeinstallprompt event. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export function PWABanner() {
  const { lang } = useLang();
  const [show, setShow] = useState(false);
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    try { if (localStorage.getItem(PWA_KEY) === "true") return; } catch { /* */ }
    const before = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent); setShow(true); };
    window.addEventListener("beforeinstallprompt", before);
    return () => window.removeEventListener("beforeinstallprompt", before);
  }, []);
  if (!show) return null;
  const install = async () => { if (evt) { evt.prompt(); await evt.userChoice; } setShow(false); };
  const dismiss = () => { setShow(false); try { localStorage.setItem(PWA_KEY, "true"); } catch { /* */ } };
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-4">
      <div className="card mx-auto flex max-w-3xl items-center gap-3 rounded-2xl p-4">
        <span className="text-2xl">📲</span>
        <div className="flex-1"><div className="text-sm font-bold text-white">{t("pwa_title", lang)}</div><div className="text-xs text-white/60">{t("pwa_desc", lang)}</div></div>
        <button onClick={install} className="btn-primary rounded-xl px-4 py-2 text-sm">{t("pwa_install", lang)}</button>
        <button onClick={dismiss} className="btn-ghost rounded-xl px-3 py-2 text-sm">{t("pwa_dismiss", lang)}</button>
      </div>
    </div>
  );
}

/* ════════════════ QUICK SEARCH ════════════════ */
export function QuickSearch({ onPickDevice, onPickWeapon }: { onPickDevice: (name: string) => void; onPickWeapon: (catId: string, weaponName: string) => void }) {
  const { lang } = useLang();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const lower = q.trim().toLowerCase();
  const devMatches = !lower ? [] : BRANDS.flatMap((b) => b.devices).filter((d) => d.name.toLowerCase().includes(lower)).slice(0, 6);
  const wpnMatches = !lower ? [] : WEAPONS.flatMap((c) => c.weapons.map((w) => ({ cat: c.id, ...w }))).filter((w) => w.name.toLowerCase().includes(lower)).slice(0, 6);
  return (
    <div className="relative w-full max-w-sm">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
        <span className="text-white/40">🔍</span>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder={t("qs_placeholder", lang)} className="w-full bg-transparent text-sm text-white placeholder-white/30 focus:outline-none" />
        {q && <button onClick={() => { setQ(""); setOpen(false); }} className="text-white/40 hover:text-white">✕</button>}
      </div>
      {open && lower && (devMatches.length > 0 || wpnMatches.length > 0) && (
        <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#0a0a14]/95 p-1 shadow-2xl backdrop-blur-lg">
          {devMatches.map((d) => (
            <button key={d.name} onClick={() => { onPickDevice(d.name); setOpen(false); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-white/80 hover:bg-white/5">
              <span>📱</span><span className="flex-1">{d.name}</span>
            </button>
          ))}
          {wpnMatches.map((w) => (
            <button key={w.name} onClick={() => { onPickWeapon(w.cat, w.name); setOpen(false); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-white/80 hover:bg-white/5">
              <span>🔫</span><span className="flex-1">{w.name}</span><span className="text-[10px] text-white/40">{w.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
