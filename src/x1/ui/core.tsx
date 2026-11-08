import { useState, useEffect, useRef, type ReactNode } from "react";
import { useLang } from "../LanguageContext";
import { t } from "../i18n";
import { type Sens } from "../sensitivity";
import { SCOPE_LABELS } from "../sensitivity";

/* ════════════════ SCROLL REVEAL ════════════════ */
export function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add("visible"); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export function RevealSection({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: 0 | 1 | 2 | 3 }) {
  const ref = useReveal();
  const dc = delay === 1 ? "reveal-delay-1" : delay === 2 ? "reveal-delay-2" : delay === 3 ? "reveal-delay-3" : "";
  return <div ref={ref} className={`reveal ${dc} ${className}`}>{children}</div>;
}

/* ════════════════ SECTION HEADER ════════════════ */
export function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6 text-center">
      <div className="font-display text-[11px] font-bold tracking-[0.3em] text-orange-400">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">{title}</h2>
      {subtitle && <p className="mx-auto mt-2 max-w-2xl text-sm text-white/60">{subtitle}</p>}
    </div>
  );
}

/* ════════════════ GAMING NIGHT MODE ════════════════ */
const NIGHT_KEY = "alyazouri_night_mode";
export function useNightMode() {
  const [night, setNight] = useState(() => { try { return localStorage.getItem(NIGHT_KEY) === "true"; } catch { return false; } });
  useEffect(() => {
    document.body.classList.toggle("gaming-mode", night);
    try { localStorage.setItem(NIGHT_KEY, String(night)); } catch { /* */ }
  }, [night]);
  return { night, toggleNight: () => setNight((n) => !n) };
}

export function NightModeToggle() {
  const { lang } = useLang();
  const { night, toggleNight } = useNightMode();
  return (
    <button onClick={toggleNight}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${night ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/30" : "btn-ghost"}`}
      title={lang === "ar" ? "وضع الألعاب الليلي" : "Gaming Night Mode"}>
      <span className="text-lg">{night ? "🌙" : "☀️"}</span>
    </button>
  );
}

/* ════════════════ SENSITIVITY TABLE ════════════════ */
export function SensitivityTable({ label, data, color = "orange", showTppFpp = true }: {
  label: string; data: Sens["cam"]; color?: "orange" | "sky"; showFpp?: boolean; showTppFpp?: boolean;
}) {
  const { lang } = useLang();
  const accent = color === "sky" ? "text-sky-300" : "text-orange-300";
  const barColor = color === "sky" ? "from-sky-500 to-cyan-400" : "from-orange-500 to-red-500";
  const rows = SCOPE_LABELS.filter((s) => showTppFpp ? true : s.key !== "fpp");
  return (
    <div className="card rounded-2xl p-5">
      <h4 className={`mb-3 font-display text-sm font-bold tracking-widest ${accent}`}>{label}</h4>
      <div className="space-y-1.5">
        {rows.map((s) => {
          const v = data[s.key];
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[10px] text-white/50">{t(s.labelKey, lang)}</span>
              <div className="stat-bar h-1.5 flex-1"><span style={{ width: `${Math.min(100, (v / 300) * 100)}%` }} className={`!bg-gradient-to-r ${barColor}`} /></div>
              <span className="w-9 shrink-0 text-right font-display text-xs font-bold text-white tabular-nums">{v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
