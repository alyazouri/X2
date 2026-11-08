// ════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — SENSITIVITY LAB
// Post-generation control layer over the sensitivity engines:
//   • FineTunePanel → manual per-engine scaling of the FINAL tables
//     (the engines themselves stay deterministic and pinned by tests)
//   • ComparePanel  → live delta view against a saved profile snapshot
//   • ApplyGuide    → worksheet + in-game settings path per table
// All transforms clamp to the real PUBG Mobile bounds (cam/ads 1–300,
// gyro 1–400) with the same rounding the engines use.
// ════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { useLang } from "./LanguageContext";
import { t, type TranslationKey } from "./i18n";
import { SCOPE_LABELS, type Sens, type SensObj, type ScopeKey } from "./sensitivity";
import { WEAPONS } from "./data";

/* ─────────────────── Fine-tune model ─────────────────── */
export type FineTune = { cam: number; ads: number; gyroCam: number; gyroAds: number };
export const DEFAULT_FINE_TUNE: FineTune = { cam: 100, ads: 100, gyroCam: 100, gyroAds: 100 };
export const isDefaultFineTune = (ft: FineTune): boolean =>
  ft.cam === 100 && ft.ads === 100 && ft.gyroCam === 100 && ft.gyroAds === 100;

const SENS_MAX = 300;
const GYRO_MAX = 400;
const SENS_MIN = 1;

const clampScale = (value: number, pct: number, max: number): number =>
  Math.max(SENS_MIN, Math.min(max, Math.round((value * pct) / 100)));

const scaleTable = (obj: SensObj, pct: number, max: number): SensObj => ({
  tpp: clampScale(obj.tpp, pct, max),
  fpp: clampScale(obj.fpp, pct, max),
  red: clampScale(obj.red, pct, max),
  scope2: clampScale(obj.scope2, pct, max),
  scope3: clampScale(obj.scope3, pct, max),
  scope4: clampScale(obj.scope4, pct, max),
  scope6: clampScale(obj.scope6, pct, max),
  scope8: clampScale(obj.scope8, pct, max),
});

/** Apply the user's per-engine scaling on top of the engine output. */
export function applyFineTune(sens: Sens, ft: FineTune): Sens {
  if (isDefaultFineTune(ft)) return sens;
  return {
    ...sens,
    cam: scaleTable(sens.cam, ft.cam, SENS_MAX),
    ads: scaleTable(sens.ads, ft.ads, SENS_MAX),
    gyroCam: scaleTable(sens.gyroCam, ft.gyroCam, GYRO_MAX),
    gyroAds: scaleTable(sens.gyroAds, ft.gyroAds, GYRO_MAX),
  };
}

/* ─────────────────── Saved snapshots (compare/restore) ─────────────────── */
export interface SavedTables {
  cam: SensObj; ads: SensObj; gyroCam: SensObj; gyroAds: SensObj;
  freeLook: Sens["freeLook"];
}
export function snapshotOf(sens: Sens): SavedTables {
  return { cam: sens.cam, ads: sens.ads, gyroCam: sens.gyroCam, gyroAds: sens.gyroAds, freeLook: sens.freeLook };
}

/* ════════════════ FINE-TUNE PANEL ════════════════ */
const FT_ROWS: { key: keyof FineTune; ar: string; en: string; gyro: boolean }[] = [
  { key: "cam", ar: "الكاميرا", en: "Camera", gyro: false },
  { key: "ads", ar: "التصويب (ADS)", en: "ADS", gyro: false },
  { key: "gyroCam", ar: "جايرو الكاميرا", en: "Gyro Camera", gyro: true },
  { key: "gyroAds", ar: "جايرو التصويب", en: "Gyro ADS", gyro: true },
];

export function FineTunePanel({ value, onChange, gyroOff }: {
  value: FineTune;
  onChange: (ft: FineTune) => void;
  gyroOff: boolean;
}) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const dirty = !isDefaultFineTune(value);
  const rows = FT_ROWS.filter((r) => !gyroOff || !r.gyro);
  return (
    <div className="card rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎚️</span>
          <h3 className="font-display text-sm font-bold tracking-widest text-white">{isAr ? "الضبط الدقيق" : "Fine-Tune"}</h3>
          {dirty && <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[9px] font-bold text-orange-300">{isAr ? "معدّل" : "tuned"}</span>}
        </div>
        <button onClick={() => onChange(DEFAULT_FINE_TUNE)} disabled={!dirty}
          className="btn-ghost rounded-lg px-3 py-1.5 text-[10px] font-semibold disabled:opacity-30">
          {isAr ? "↺ إعادة الضبط" : "↺ Reset"}
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const pct = value[r.key];
          return (
            <label key={r.key} className="block text-xs">
              <span className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-white/70">{isAr ? r.ar : r.en}</span>
                <span dir="ltr" className={`font-display font-bold tabular-nums ${pct === 100 ? "text-white/50" : "text-orange-300"}`}>
                  {pct}%{pct !== 100 ? ` (${pct > 100 ? "+" : ""}${pct - 100}%)` : ""}
                </span>
              </span>
              <input type="range" min={50} max={150} step={1} value={pct} dir="ltr"
                onChange={(e) => onChange({ ...value, [r.key]: Number(e.target.value) })}
                className="w-full accent-orange-500" />
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-white/40">
        {isAr
          ? "تطبيق نسبي على نتائج المحرك بعد توليدها — تُقرَّب القيم وتُقصّ ضمن حدود اللعبة (كاميرا/تصويب 1–300، جايرو 1–400)."
          : "Relative scaling applied after generation — values are rounded and clamped to game bounds (camera/ADS 1–300, gyro 1–400)."}
      </p>
    </div>
  );
}

/* ════════════════ COMPARE PANEL ════════════════ */
export function ComparePanel({ current, profiles }: {
  current: Sens;
  profiles: { id: string; name: string; tables?: SavedTables }[];
}) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [sel, setSel] = useState("");
  const usable = profiles.filter((p) => p.tables);
  const target = usable.find((p) => p.id === sel);

  const delta = (cur: number, saved: number | undefined) => {
    if (saved == null) return null;
    const d = cur - saved;
    const pct = saved > 0 ? Math.round((d / saved) * 100) : 0;
    return { d, pct };
  };

  const tableRows = (cur: SensObj, saved: SensObj | undefined) =>
    SCOPE_LABELS.map((s) => ({ key: s.key as ScopeKey, label: t(s.labelKey as TranslationKey, lang), cur: cur[s.key as keyof SensObj], saved: saved?.[s.key as keyof SensObj] }));

  const renderTable = (title: string, cur: SensObj, saved: SensObj | undefined) => (
    <div className="rounded-xl border border-white/5 bg-black/30 p-3">
      <p className="mb-2 font-display text-[10px] font-bold tracking-widest text-orange-300">{title}</p>
      <div className="space-y-1">
        {tableRows(cur, saved).map((r) => {
          const dd = delta(r.cur, r.saved);
          return (
            <div key={String(r.key)} className="flex items-center gap-2 text-[10px]">
              <span className="w-12 shrink-0 text-white/50">{r.label}</span>
              <span dir="ltr" className="w-9 font-display font-bold tabular-nums text-white">{r.cur}</span>
              <span className="text-white/25">{isAr ? "مقابل" : "vs"}</span>
              <span dir="ltr" className="w-9 font-display tabular-nums text-white/60">{r.saved ?? "—"}</span>
              {dd && dd.d !== 0 && (
                <span dir="ltr" className={`ms-auto font-mono font-bold ${dd.d > 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {dd.d > 0 ? "▲" : "▼"} {Math.abs(dd.d)} ({dd.pct > 0 ? "+" : ""}{dd.pct}%)
                </span>
              )}
              {dd && dd.d === 0 && <span className="ms-auto text-white/25">=</span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="card rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">⚖️</span>
        <h3 className="font-display text-sm font-bold tracking-widest text-white">{isAr ? "مقارنة مع بروفايل محفوظ" : "Compare with a saved profile"}</h3>
      </div>
      {usable.length === 0 ? (
        <p className="rounded-xl border border-white/5 bg-black/30 p-4 text-center text-xs text-white/45">
          {isAr ? "احفظ بروفايلاً أولاً لتتمكن من مقارنة الفروقات معه." : "Save a profile first to compare against it."}
        </p>
      ) : (
        <>
          <select value={sel} onChange={(e) => setSel(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-white focus:border-orange-400/50 focus:outline-none">
            <option value="">{isAr ? "— اختر بروفايلاً —" : "— pick a profile —"}</option>
            {usable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {target?.tables && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {renderTable(isAr ? "الكاميرا" : "Camera", current.cam, target.tables.cam)}
              {renderTable(isAr ? "التصويب (ADS)" : "ADS", current.ads, target.tables.ads)}
            </div>
          )}
          {!target && <p className="mt-3 text-center text-[10px] text-white/35">{isAr ? "الفروقات تظهر لكل سكوب مع نسبتها المئوية." : "Per-scope deltas appear with their percentage."}</p>}
        </>
      )}
    </div>
  );
}

/* ════════════════ IN-GAME APPLY GUIDE ════════════════ */
const GUIDE_SECTIONS: { table: "cam" | "ads" | "gyroCam" | "gyroAds"; ar: string; en: string; pathAr: string; pathEn: string }[] = [
  { table: "cam", ar: "الكاميرا", en: "Camera", pathAr: "الإعدادات ← الحساسية ← الكاميرا", pathEn: "Settings → Sensitivity → Camera" },
  { table: "ads", ar: "التصويب", en: "ADS", pathAr: "الإعدادات ← الحساسية ← التصويب", pathEn: "Settings → Sensitivity → ADS" },
  { table: "gyroCam", ar: "الجيروسكوب (كاميرا)", en: "Gyroscope (camera)", pathAr: "الإعدادات ← الحساسية ← الجيروسكوب", pathEn: "Settings → Sensitivity → Gyroscope" },
  { table: "gyroAds", ar: "الجيروسكوب (تصويب)", en: "Gyroscope (ADS)", pathAr: "الإعدادات ← الحساسية ← الجيروسكوب", pathEn: "Settings → Sensitivity → Gyroscope" },
];

export function ApplyGuide({ sens, gyroOff }: { sens: Sens; gyroOff: boolean }) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [open, setOpen] = useState(false);
  const sections = GUIDE_SECTIONS.filter((s) => !gyroOff || (s.table !== "gyroCam" && s.table !== "gyroAds"));
  return (
    <div className="card rounded-2xl p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-lg">📲</span>
          <h3 className="font-display text-sm font-bold tracking-widest text-white">{isAr ? "دليل التطبيق داخل اللعبة" : "In-game apply guide"}</h3>
        </span>
        <span className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-[10px] leading-relaxed text-sky-200/80">
            {isAr
              ? "انسخ كل قيمة إلى الخانة المقابلة لها في إعدادات الحساسية داخل ببجي موبايل. قد تختلف تسميات المسارات قليلاً بين إصدارات اللعبة."
              : "Copy each value into its matching field in PUBG Mobile's sensitivity settings. Menu names may vary slightly between game versions."}
          </p>
          {sections.map((sec) => (
            <div key={sec.table} className="rounded-xl border border-white/5 bg-black/30 p-3">
              <p className="mb-1 font-display text-[10px] font-bold tracking-widest text-orange-300">{isAr ? sec.ar : sec.en}</p>
              <p dir={isAr ? "rtl" : "ltr"} className="mb-2 text-[10px] text-white/45">{isAr ? sec.pathAr : sec.pathEn}</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {SCOPE_LABELS.map((s) => (
                  <div key={s.key} className="rounded-lg border border-white/5 bg-white/[0.03] p-2 text-center">
                    <p className="text-[9px] text-white/45">{t(s.labelKey as TranslationKey, lang)}</p>
                    <p dir="ltr" className="mt-0.5 font-display text-sm font-black tabular-nums text-orange-200">
                      {sens[sec.table][s.key as keyof SensObj]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!gyroOff && (
            <div className="rounded-xl border border-white/5 bg-black/30 p-3">
              <p className="mb-1 font-display text-[10px] font-bold tracking-widest text-orange-300">{isAr ? "النظر الحر" : "Free Look"}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(sens.freeLook).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-white/5 bg-white/[0.03] p-2 text-center">
                    <p className="text-[9px] text-white/45">{k === "cam" ? (isAr ? "الكاميرا" : "Camera") : k === "parashoot" ? (isAr ? "الهبوط" : "Parachute") : (isAr ? "المركبة" : "Vehicle")}</p>
                    <p dir="ltr" className="mt-0.5 font-display text-sm font-black tabular-nums text-orange-200">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════ WEAPON COMPARE ════════════════
   Pick any two weapons and see the exact per-scope difference under the
   SAME device/config. Both sides come from the same deterministic engine
   (App passes `compute`), so the delta is reproducible and never estimated. */
type WeaponRef = { name: string; recoil: number; range: number; type: string };

const ALL_WEAPONS: WeaponRef[] = WEAPONS.flatMap((c) => c.weapons.map((w) => ({
  name: w.name, recoil: w.recoil, range: w.range, type: w.type,
})));

export function WeaponComparePanel({ currentWeapon, compute }: {
  currentWeapon: string;
  compute: (w: WeaponRef) => Sens;
}) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [aName, setAName] = useState(currentWeapon);
  const [bName, setBName] = useState<string>(() => {
    const other = ALL_WEAPONS.find((w) => w.name !== currentWeapon);
    return other ? other.name : currentWeapon;
  });
  const [engine, setEngine] = useState<"cam" | "ads" | "gyroCam" | "gyroAds">("cam");

  const a = useMemo(() => {
    const w = ALL_WEAPONS.find((x) => x.name === aName);
    return w ? compute(w) : null;
  }, [aName, compute]);
  const b = useMemo(() => {
    const w = ALL_WEAPONS.find((x) => x.name === bName);
    return w ? compute(w) : null;
  }, [bName, compute]);

  const ENGINES: { id: typeof engine; ar: string; en: string }[] = [
    { id: "cam", ar: "الكاميرا", en: "Camera" },
    { id: "ads", ar: "التصويب", en: "ADS" },
    { id: "gyroCam", ar: "جايرو كاميرا", en: "Gyro Cam" },
    { id: "gyroAds", ar: "جايرو تصويب", en: "Gyro ADS" },
  ];

  return (
    <div className="card rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">⚔️</span>
        <h3 className="font-display text-sm font-bold tracking-widest text-white">
          {isAr ? "مقارنة سلاحين" : "Compare two weapons"}
        </h3>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {([["A", aName, setAName], ["B", bName, setBName]] as const).map(([tag, value, setter]) => (
          <label key={tag} className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/40">{isAr ? `السلاح ${tag}` : `Weapon ${tag}`}</span>
            <select value={value} onChange={(e) => setter(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-white focus:border-orange-400/50 focus:outline-none">
              {ALL_WEAPONS.map((w) => <option key={`${tag}-${w.name}`} value={w.name}>{w.name} · {w.type}</option>)}
            </select>
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ENGINES.map((e) => (
          <button key={e.id} onClick={() => setEngine(e.id)}
            className={`chip rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${engine === e.id ? "active" : "text-white/60"}`}>
            {isAr ? e.ar : e.en}
          </button>
        ))}
      </div>

      {a && b ? (
        <div className="mt-3 space-y-1">
          <div className="mb-1 flex items-center gap-2 text-[9px] uppercase tracking-wider text-white/35">
            <span className="w-12 shrink-0">{isAr ? "السكوب" : "Scope"}</span>
            <span className="w-10 shrink-0 text-center text-orange-300">A</span>
            <span className="w-10 shrink-0 text-center text-sky-300">B</span>
            <span className="ms-auto">{isAr ? "الفرق (B−A)" : "Δ (B−A)"}</span>
          </div>
          {SCOPE_LABELS.map((s) => {
            const av = a[engine][s.key as keyof SensObj];
            const bv = b[engine][s.key as keyof SensObj];
            const d = bv - av;
            return (
              <div key={s.key} className="flex items-center gap-2 text-[11px]">
                <span className="w-12 shrink-0 text-white/50">{t(s.labelKey as TranslationKey, lang)}</span>
                <span dir="ltr" className="w-10 shrink-0 text-center font-display font-bold tabular-nums text-orange-200">{av}</span>
                <span dir="ltr" className="w-10 shrink-0 text-center font-display font-bold tabular-nums text-sky-200">{bv}</span>
                <span dir="ltr" className={`ms-auto font-mono font-bold tabular-nums ${d > 0 ? "text-emerald-300" : d < 0 ? "text-red-300" : "text-white/25"}`}>
                  {d > 0 ? "▲" : d < 0 ? "▼" : "="} {Math.abs(d) || ""}
                </span>
              </div>
            );
          })}
          <div className="mt-2 flex items-center justify-between rounded-lg border border-white/5 bg-black/30 p-2 text-[11px]">
            <span className="text-white/50">{isAr ? "فرق تقييم AI" : "AI score Δ"}</span>
            <span dir="ltr" className="font-display font-bold text-orange-300">
              {a.aiScore} → {b.aiScore} ({b.aiScore - a.aiScore >= 0 ? "+" : ""}{b.aiScore - a.aiScore})
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-center text-[11px] text-white/40">{isAr ? "اختر سلاحين للمقارنة." : "Pick two weapons to compare."}</p>
      )}
    </div>
  );
}
