// ════════════════════════════════════════════════════════════════
// ALYAZOURI GG — APEX ENGINE control panel (flagship generator panel)
// ════════════════════════════════════════════════════════════════
import { useLang } from "./LanguageContext";
import { t } from "./i18n";
import type { AimPriority, CombatRange, GGModeId, OptimizationResult, TargetStyle } from "./apex";
import type { GyroMode } from "./apex";

type Setter<T> = (value: T) => void;

const MODES: { id: GGModeId; key: "gg_mode_aggressive" | "gg_mode_balanced" | "gg_mode_control" | "gg_mode_precision" | "gg_mode_competitive" | "gg_mode_head" | "gg_mode_spray" }[] = [
  { id: "aggressive", key: "gg_mode_aggressive" },
  { id: "balanced", key: "gg_mode_balanced" },
  { id: "control", key: "gg_mode_control" },
  { id: "precision", key: "gg_mode_precision" },
  { id: "competitive", key: "gg_mode_competitive" },
  { id: "head", key: "gg_mode_head" },
  { id: "spray", key: "gg_mode_spray" },
];

const TARGETS: { id: TargetStyle; key: "gg_target_static" | "gg_target_strafe" | "gg_target_fast" | "gg_target_mixed" }[] = [
  { id: "static", key: "gg_target_static" },
  { id: "strafe", key: "gg_target_strafe" },
  { id: "fast", key: "gg_target_fast" },
  { id: "mixed", key: "gg_target_mixed" },
];

const RANGES: { id: CombatRange; key: "gg_range_close" | "gg_range_mid" | "gg_range_long" | "gg_range_mixed" }[] = [
  { id: "close", key: "gg_range_close" },
  { id: "mid", key: "gg_range_mid" },
  { id: "long", key: "gg_range_long" },
  { id: "mixed", key: "gg_range_mixed" },
];

const PRIORITIES: { id: AimPriority; key: "gg_aim_head" | "gg_aim_balanced" | "gg_aim_recoil" | "gg_aim_precision" }[] = [
  { id: "head", key: "gg_aim_head" },
  { id: "balanced", key: "gg_aim_balanced" },
  { id: "recoil", key: "gg_aim_recoil" },
  { id: "precision", key: "gg_aim_precision" },
];

function ChipRow<T extends string>({ items, value, onChange }: {
  items: { id: T; key: Parameters<typeof t>[0] }[];
  value: T;
  onChange: Setter<T>;
}) {
  const { lang } = useLang();
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <button
          key={i.id}
          onClick={() => onChange(i.id)}
          aria-pressed={value === i.id}
          className={`chip rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${value === i.id ? "active" : "text-white/60"}`}
        >
          {t(i.key, lang)}
        </button>
      ))}
    </div>
  );
}

export function ApexPanel({
  active, onToggle,
  mode, setMode,
  targetStyle, setTargetStyle,
  range, setRange,
  aimPriority, setAimPriority,
  gyroMode, setGyroMode,
  result,
}: {
  active: boolean;
  onToggle: () => void;
  mode: GGModeId;
  setMode: Setter<GGModeId>;
  targetStyle: TargetStyle;
  setTargetStyle: Setter<TargetStyle>;
  range: CombatRange;
  setRange: Setter<CombatRange>;
  aimPriority: AimPriority;
  setAimPriority: Setter<AimPriority>;
  gyroMode: GyroMode;
  setGyroMode: Setter<GyroMode>;
  result: OptimizationResult | null;
}) {
  const { lang } = useLang();
  const scores = result?.scores;

  return (
    <div className="card relative overflow-hidden rounded-2xl p-5">
      <div className="absolute inset-0 bg-grid opacity-[0.12]" />
      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <span className="mb-1 inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 font-display text-[9px] font-bold tracking-[0.2em] text-orange-300">
              {t("gg_eyebrow", lang)}
            </span>
            <h3 className="font-display text-base font-black tracking-wide text-white">{t("gg_title", lang)}</h3>
            <p className="mt-1 max-w-md text-[11px] leading-relaxed text-white/45">{t("gg_sub", lang)}</p>
          </div>
          <button
            onClick={onToggle}
            className={`shrink-0 rounded-full px-3 py-1.5 font-display text-[10px] font-bold tracking-widest transition-colors ${
              active
                ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/25"
                : "border border-white/10 bg-white/[0.03] text-white/50"
            }`}
          >
            {active ? t("gg_on", lang) : t("gg_off", lang)}
          </button>
        </div>

        <div className={`space-y-3 transition-all ${active ? "opacity-100" : "pointer-events-none opacity-35"}`}>
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">{t("gg_mode", lang)}</p>
            <ChipRow items={MODES} value={mode} onChange={setMode} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">{t("gg_target_style", lang)}</p>
              <ChipRow items={TARGETS} value={targetStyle} onChange={setTargetStyle} />
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">{t("gg_range", lang)}</p>
              <ChipRow items={RANGES} value={range} onChange={setRange} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">{t("gg_aim_priority", lang)}</p>
              <ChipRow items={PRIORITIES} value={aimPriority} onChange={setAimPriority} />
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">{t("gyro_title", lang)}</p>
              <div className="flex flex-wrap gap-1.5">
                {(["off", "scope", "always"] as GyroMode[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGyroMode(g)}
                    className={`chip rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${gyroMode === g ? "active" : "text-white/60"}`}
                  >
                    {g === "off" ? t("gyro_off", lang) : g === "scope" ? t("gyro_scope", lang) : t("gyro_always", lang)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {result && scores && (
            <div className="mt-3 rounded-xl border border-orange-500/20 bg-black/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-[10px] font-bold tracking-widest text-orange-300">{t("gg_supreme", lang)}</span>
                <span className="font-display text-2xl font-black text-white tabular-nums">{scores.supreme}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {([
                  ["gg_feat_tracking", scores.tracking],
                  ["gg_feat_recoil", scores.recoil],
                  ["gg_feat_micro", scores.micro],
                  ["gg_feat_stability", scores.stability],
                  ["gg_feat_rotation", scores.rotation],
                ] as const).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-white/5 bg-white/[0.02] p-2 text-center">
                    <p className="font-display text-sm font-black text-orange-200 tabular-nums">{value}</p>
                    <p className="mt-0.5 text-[8px] leading-tight text-white/35">{t(key, lang)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-white/45">
                <span>{t("gg_candidates", lang)}: <b className="text-white/80 tabular-nums">{result.candidatesEvaluated.toLocaleString("en-US")}</b></span>
                <span>{t("gg_input_lag", lang)}: <b className="text-white/80 tabular-nums">{result.inputLagMs.toFixed(1)}ms</b></span>
                <span>{t("gg_recoil_comp", lang)}: <b className="text-white/80 tabular-nums">×{result.recoilCompFactor.toFixed(2)}</b></span>
                <span>{t("gg_confidence", lang)}: <b className="text-white/80 uppercase">{result.confidence.level}</b></span>
              </div>
              {result.explanations.length > 0 && (
                <div className="mt-2 border-t border-white/5 pt-2">
                  <p className="mb-1 text-[10px] font-bold text-orange-300">{t("gg_explanations", lang)}</p>
                  <ul className="space-y-1" dir="ltr">
                    {result.explanations.map((e) => (
                      <li key={e.label} className="text-[10px] leading-relaxed text-white/45">
                        <b className="text-white/70">{e.label}:</b> {e.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
