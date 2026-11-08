// ════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — EXPERT SECTION (adaptive aim engineering V1→FINAL)
// Uses the exact expert aim model in ./apex/model.ts
// ════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { useLang } from "./LanguageContext";
import { t } from "./i18n";
import type { Sens } from "./sensitivity";
import { ENGINES, SCOPES, type SensitivityProfile } from "./apex";
import {
  analyzeCurrent, buildExpertResult, deviceClassOf, profileCoherence,
  validateAndRepair, type ExpertContext,
} from "./apex/model";

const toProfile = (sens: Sens): SensitivityProfile => ({
  cam: { ...sens.cam }, ads: { ...sens.ads },
  gyroCam: { ...sens.gyroCam }, gyroAds: { ...sens.gyroAds },
});

export function ExpertSection({
  sens, baseline, ctx, onApply,
}: {
  sens: Sens;
  /** The non-optimized (weapon-database) profile used as the "current" reference. */
  baseline?: Sens;
  ctx: Omit<ExpertContext, "deviceClass" | "playStyle"> & { styleId: string };
  onApply: (profile: SensitivityProfile) => void;
}) {
  const { lang } = useLang();
  const [version, setVersion] = useState(1);
  const [applied, setApplied] = useState(false);
  const [repaired, setRepaired] = useState(false);

  const expertCtx: ExpertContext = useMemo(() => ({
    ...ctx,
    deviceClass: deviceClassOf(ctx.screenSize),
    playStyle: ctx.styleId,
  } as ExpertContext), [ctx]);

  const active = useMemo(() => toProfile(sens), [sens]);
  const reference = useMemo(() => toProfile(baseline ?? sens), [baseline, sens]);
  const report = useMemo(() => validateAndRepair(active), [active]);
  const analysis = useMemo(() => analyzeCurrent(reference, active), [reference, active]);
  const working = repaired ? report.repaired : active;
  const coherence = profileCoherence(working);
  const structured = useMemo(() => buildExpertResult(
    expertCtx, working, sens.freeLook, report.repairs, report.issues, version,
  ), [expertCtx, working, sens.freeLook, report, version]);

  return (
    <div className="card rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="mb-1 inline-block rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 font-display text-[9px] font-bold tracking-[0.2em] text-purple-300">
            {t("expert_eyebrow", lang)}
          </span>
          <h3 className="font-display text-base font-black tracking-wide text-white">{t("expert_title", lang)}</h3>
          <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-white/45">{t("expert_sub", lang)}</p>
        </div>
        <span className="rounded-full bg-purple-500/15 px-2.5 py-1 font-display text-[10px] font-bold text-purple-300">
          {t("expert_version", lang)} V{version} · FINAL
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
          <p className="text-[10px] text-white/40">{t("expert_coherence", lang)}</p>
          <p className="font-display text-2xl font-black text-emerald-300 tabular-nums">{coherence}</p>
          <div className="stat-bar mt-1.5 h-1">
            <span className="block h-full" style={{ width: `${coherence}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
          <p className="text-[10px] text-white/40">{t("expert_issues", lang)}</p>
          <p className="font-display text-2xl font-black text-orange-300 tabular-nums">{report.issues.length}</p>
          <p className="mt-1 line-clamp-2 text-[9px] leading-tight text-white/35">
            {report.issues.length === 0 ? t("expert_no_issues", lang) : report.issues[0]}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
          <p className="text-[10px] text-white/40">{t("expert_repair", lang)}</p>
          <p className="font-display text-2xl font-black text-sky-300 tabular-nums">{report.repairs.length}</p>
          <button
            onClick={() => setRepaired((v) => !v)}
            className={`mt-1 w-full rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
              repaired ? "bg-emerald-500/20 text-emerald-300" : "border border-white/10 bg-white/[0.03] text-white/60"
            }`}
          >
            {repaired ? "✅ " : "🔧 "}V{version} → V{version + 1}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-400/10 bg-emerald-500/5 p-3">
          <p className="mb-1.5 text-[10px] font-bold text-emerald-300">
            ✅ {t("expert_coherence", lang)} · {analysis.strengths.length}
          </p>
          <div className="max-h-28 space-y-1 overflow-y-auto" dir="ltr">
            {ENGINES.map((engine) => (
              <div key={engine} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-16 shrink-0 text-white/40">{engine}</span>
                <span className="font-mono text-white/55">
                  {SCOPES.map((s) => working[engine][s]).join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-amber-400/10 bg-amber-500/5 p-3">
          <p className="mb-1.5 text-[10px] font-bold text-amber-300">⚠️ {t("expert_issues", lang)}</p>
          <div className="max-h-28 space-y-1 overflow-y-auto">
            {report.issues.length === 0
              ? <p className="text-[10px] text-white/40">{t("expert_no_issues", lang)}</p>
              : report.issues.map((i) => (
                <p key={i} className="font-mono text-[10px] leading-relaxed text-white/50">{i}</p>
              ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => {
            onApply(working);
            setVersion((v) => v + 1);
            setApplied(true);
            setTimeout(() => setApplied(false), 1600);
          }}
          className="btn-primary rounded-xl px-4 py-2 text-xs"
        >
          {applied ? t("expert_applied", lang) : t("expert_apply", lang)}
        </button>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(structured, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `alyazouri-expert-v${version}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold"
        >
          {t("expert_export", lang)}
        </button>
      </div>
    </div>
  );
}
