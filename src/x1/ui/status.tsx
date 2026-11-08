import { useState, useEffect, useMemo } from "react";
import { useLang } from "../LanguageContext";

/* ════════════════ STATUS BAR ════════════════
   Honest device metrics. We never invent numbers:
   • cores        → navigator.hardwareConcurrency   (real, when available)
   • memory       → navigator.deviceMemory          (real, when available)
   • battery      → navigator.getBattery()          (real, when available)
   • JS heap load → performance.memory (Chrome)     (real, when available)
   • FPS estimate → requestAnimationFrame delta     (real, when tab visible)
   • temperature  → NOT available in any browser API. We render the chip only when
                     a value was supplied (e.g. via a future deviceChannel sensor)
                     and otherwise show N/A instead of fake numbers. */
interface DeviceMetrics {
  cores: number | null;
  memoryGB: number | null;
  batteryLevel: number | null;       // 0..100
  batteryCharging: boolean | null;
  heapUsedMB: number | null;
  heapLimitMB: number | null;
  fps: number | null;
  tempC: number | null;
}

function useDeviceMetrics(): DeviceMetrics {
  const [m, setM] = useState<DeviceMetrics>(() => {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & {
      hardwareConcurrency?: number;
      deviceMemory?: number;
    }) : undefined;
    return {
      cores: typeof nav?.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
      memoryGB: typeof nav?.deviceMemory === "number" ? nav.deviceMemory : null,
      batteryLevel: null,
      batteryCharging: null,
      heapUsedMB: null,
      heapLimitMB: null,
      fps: null,
      tempC: null,
    };
  });

  useEffect(() => {
    const nav = navigator as Navigator & {
      hardwareConcurrency?: number;
      deviceMemory?: number;
      getBattery?: () => Promise<{
        level: number; charging: boolean;
        addEventListener: (t: string, cb: () => void) => void;
        removeEventListener: (t: string, cb: () => void) => void;
      }>;
    };

    // Battery — real when available (mobile supports it, desktop/iOS often don't)
    let battery: { level: number; charging: boolean; addEventListener: (t: string, cb: () => void) => void; removeEventListener: (t: string, cb: () => void) => void } | null = null;
    let batteryTimer: number | undefined;
    const updateBattery = () => {
      if (!battery) return;
      const level = Math.round(battery.level * 100);
      setM((cur) => ({ ...cur, batteryLevel: level, batteryCharging: battery!.charging }));
    };
    if (typeof nav.getBattery === "function") {
      nav.getBattery().then((b) => {
        battery = b;
        updateBattery();
        b.addEventListener("levelchange", updateBattery);
        b.addEventListener("chargingchange", updateBattery);
        batteryTimer = window.setInterval(updateBattery, 60000);
      }).catch(() => { /* Battery API present but blocked — leave null */ });
    }

    // Heap — performance.memory is non-standard but exists in Chromium-based browsers
    type MemInfo = { usedJSHeapSize?: number; totalJSHeapSize?: number; jsHeapSizeLimit?: number };
    const perf = performance as Performance & { memory?: MemInfo };

    // FPS — sample with requestAnimationFrame over a moving window
    let raf = 0; let last = performance.now(); const samples: number[] = [];
    const tick = (now: number) => {
      const dt = now - last; last = now;
      if (dt > 0 && dt < 200) {
        samples.push(1000 / dt);
        if (samples.length > 30) samples.shift();
      }
      if (samples.length >= 6) {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        setM((cur) => ({ ...cur, fps: Math.round(avg), heapUsedMB: perf.memory?.usedJSHeapSize ? Math.round(perf.memory.usedJSHeapSize / 1048576) : cur.heapUsedMB,
          heapLimitMB: perf.memory?.jsHeapSizeLimit ? Math.round(perf.memory.jsHeapSizeLimit / 1048576) : cur.heapLimitMB }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (batteryTimer) window.clearInterval(batteryTimer);
      if (battery) {
        battery.removeEventListener("levelchange", updateBattery);
        battery.removeEventListener("chargingchange", updateBattery);
      }
    };
  }, []);

  return m;
}

export function StatusBar() {
  const { lang } = useLang();
  const [now, setNow] = useState(new Date());
  const m = useDeviceMetrics();
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const locale = lang === "ar" ? "ar-JO" : lang === "tr" ? "tr-TR" : lang === "ru" ? "ru-RU" : lang === "es" ? "es-ES" : "en-US";
  const timeStr = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Battery colour ramp — green above 50%, amber at 20–50%, red below.
  const batteryColor = m.batteryLevel === null ? "" : m.batteryLevel >= 50 ? "text-emerald-300" : m.batteryLevel >= 20 ? "text-amber-300" : "text-red-300";
  // FPS — green ≥ 55, amber 30–55, red below.
  const fpsColor = m.fps === null ? "text-white/50" : m.fps >= 55 ? "text-emerald-300" : m.fps >= 30 ? "text-amber-300" : "text-red-300";
  // Heap % — derived when both numbers exist; same ramp.
  const heapPct = m.heapUsedMB !== null && m.heapLimitMB && m.heapLimitMB > 0 ? Math.min(100, Math.round((m.heapUsedMB / m.heapLimitMB) * 100)) : null;
  const heapColor = heapPct === null ? "" : heapPct < 70 ? "text-emerald-300" : heapPct < 90 ? "text-amber-300" : "text-red-300";

  return (
    <div className="fixed right-0 left-0 top-[61px] z-40 border-b border-white/5 bg-[#05070c]/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 overflow-x-auto px-5 py-1.5 text-[11px]">
        <div className="flex items-center gap-3 text-white/70">
          <div className="flex items-center gap-1.5"><span className="text-orange-400">🕐</span><span className="font-display font-bold tabular-nums text-white">{timeStr}</span></div>
          <span className="hidden text-white/20 sm:inline">|</span>
          <div className="hidden items-center gap-1.5 sm:flex"><span className="text-orange-400">📅</span><span className="text-white/80">{dateStr}</span></div>
        </div>
        <div className="flex items-center gap-2">
          {m.cores !== null && (
            <div className="hidden items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 sm:flex">
              <span className="text-[10px]">🧠</span>
              <span className="font-display font-bold tabular-nums text-white/80">{m.cores} cores</span>
            </div>
          )}
          {m.memoryGB !== null && (
            <div className="hidden items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 sm:flex">
              <span className="text-[10px]">💾</span>
              <span className="font-display font-bold tabular-nums text-white/80">{m.memoryGB} GB</span>
            </div>
          )}
          {m.fps !== null && (
            <div className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5">
              <span className="text-[10px]">🎬</span>
              <span className={`font-display font-bold tabular-nums ${fpsColor}`}>{m.fps} fps</span>
            </div>
          )}
          {heapPct !== null && m.heapUsedMB !== null && (
            <div className="hidden items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 sm:flex">
              <span className="text-[10px]">📦</span>
              <span className={`font-display font-bold tabular-nums ${heapColor}`}>{m.heapUsedMB} MB · {heapPct}%</span>
            </div>
          )}
          {m.batteryLevel !== null && (
            <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${m.batteryCharging ? "border-emerald-400/30 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}>
              <span className="text-[10px]">{m.batteryCharging ? "⚡" : "🔋"}</span>
              <span className={`font-display font-bold tabular-nums ${batteryColor}`}>{m.batteryLevel}%</span>
            </div>
          )}
          {/* CPU temperature has no browser API — we don't fake it. The chip is
              only rendered when an actual value is available (future sensor). */}
          {m.tempC !== null && (
            <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-gradient-to-r from-orange-500/20 to-red-500/10 px-2 py-0.5 sm:flex">
              <span className="text-[10px]">🌡️</span>
              <span className="font-display font-bold tabular-nums text-orange-300">{m.tempC}°C</span>
            </div>
          )}
          <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /><span className="hidden text-[9px] uppercase tracking-widest text-emerald-300/70 sm:inline">LIVE</span></div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════ DPI CALCULATOR ════════════════ */
const PRO_PRESETS = [
  { name: "Paraboy", dpi: 320, sens: 200, style: "Spray" },
  { name: "Jonathan", dpi: 280, sens: 180, style: "Headshot" },
  { name: "Levinho", dpi: 300, sens: 160, style: "Balanced" },
  { name: "Mortal", dpi: 260, sens: 170, style: "Aggressive" },
  { name: "Athena", dpi: 300, sens: 190, style: "CQC" },
];

export function DPICalculator() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [dpi, setDpi] = useState(300);
  const [sensitivity, setSensitivity] = useState(150);
  const [screenWidth, setScreenWidth] = useState(6.5);
  const results = useMemo(() => {
    const eDPI = dpi * sensitivity;
    const screenWidthCm = screenWidth * 2.54;
    const cmPer360 = screenWidthCm * (100 / sensitivity);
    const cmPer180 = cmPer360 / 2;
    const cmPer90 = cmPer360 / 4;
    const closestPro = PRO_PRESETS.reduce((closest, pro) => {
      const diff = Math.abs(pro.dpi * pro.sens - eDPI);
      const closestDiff = Math.abs(closest.dpi * closest.sens - eDPI);
      return diff < closestDiff ? pro : closest;
    }, PRO_PRESETS[0]);
    const speedCategory =
      cmPer360 > 30 ? { label: isAr ? "بطيء جداً — دقة عالية" : "Very Slow — High Precision", color: "text-sky-300", icon: "🎯" } :
      cmPer360 > 20 ? { label: isAr ? "بطيء — دقة جيدة" : "Slow — Good Precision", color: "text-cyan-300", icon: "🏹" } :
      cmPer360 > 12 ? { label: isAr ? "متوسط — متوازن" : "Medium — Balanced", color: "text-emerald-300", icon: "⚖️" } :
      cmPer360 > 6 ? { label: isAr ? "سريع — عدواني" : "Fast — Aggressive", color: "text-orange-300", icon: "⚡" } :
      { label: isAr ? "سريع جداً — محترف" : "Very Fast — Pro", color: "text-red-300", icon: "🔥" };
    return { eDPI, cmPer360, cmPer180, cmPer90, closestPro, speedCategory };
  }, [dpi, sensitivity, screenWidth, isAr]);
  return (
    <div className="card neon-box rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2"><span className="text-xl">🖱️</span><h3 className="font-display text-sm font-bold tracking-widest text-white">{isAr ? "حاسبة DPI" : "DPI Calculator"}</h3></div>
      <div className="space-y-3">
        {([["DPI", dpi, setDpi, 100, 800], ["Sensitivity", sensitivity, setSensitivity, 50, 400], ["Screen\"", screenWidth, setScreenWidth, 4, 14]] as const).map(([label, value, setter, min, max]) => (
          <label key={label} className="block text-xs text-white/60">
            <span className="flex justify-between"><span>{label}</span><span className="font-display font-bold text-white">{value}</span></span>
            <input type="range" min={min} max={max} step={label === "Screen\"" ? 0.1 : 5} value={value}
              onChange={(e) => setter(Number(e.target.value))} className="mt-1 w-full accent-orange-500" />
          </label>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        {([["eDPI", results.eDPI], ["cm/360°", Math.round(results.cmPer360)], ["cm/180°", Math.round(results.cmPer180)], ["cm/90°", Math.round(results.cmPer90)]] as const).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/5 bg-black/30 p-2.5">
            <div className="font-display text-lg font-black text-orange-300 tabular-nums">{v}</div>
            <div className="text-[10px] text-white/40">{k}</div>
          </div>
        ))}
      </div>
      <div className={`mt-3 rounded-xl border border-white/5 bg-black/30 p-3 text-center text-xs font-bold ${results.speedCategory.color}`}>
        {results.speedCategory.icon} {results.speedCategory.label}
      </div>
      <div className="mt-2 text-center text-[11px] text-white/50">
        {isAr ? "أقرب محترف:" : "Closest pro:"} <b className="text-white/80">{results.closestPro.name}</b> · {results.closestPro.dpi} DPI · {results.closestPro.style}
      </div>
    </div>
  );
}
