// ════════════════════════════════════════════════════════════════
// ALYAZOURI ADAPTIVE FEEDBACK ENGINE — map player feedback to
// specific parameters, iterate V1→FINAL with preservation of
// correct changes, no oscillation, one-problem/one-adjustment.
// ════════════════════════════════════════════════════════════════
import {
  SCOPES, type EngineId, type ScopeId, type SensitivityProfile,
} from "./types";
import {
  problemGroups, transitionScore, validateAndRepair,
  type ChangeEntry, type ReasonKey,
} from "./model";

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const round = (n: number, d = 1): number => (10 ** d === 1 ? Math.round(n) : Math.round(n * 10 ** d) / 10 ** d);

/* ── Player feedback taxonomy (spec §24) ─────────────────────── */
export type FeedbackCode =
  | "TOO_FAST" | "TOO_SLOW" | "OVERSHOOT" | "UNDERSHOOT" | "SHAKY" | "HEAVY"
  | "RECOIL_UP" | "RECOIL_LEFT" | "RECOIL_RIGHT"
  | "X3_FAST" | "X3_SLOW" | "X4_FAST" | "X4_SLOW"
  | "RED_FAST" | "RED_SLOW" | "TURN180_SLOW" | "TRACKING_BAD" | "MICRO_BAD";

export const FEEDBACK_CODES: FeedbackCode[] = [
  "TOO_FAST", "TOO_SLOW", "OVERSHOOT", "UNDERSHOOT", "SHAKY", "HEAVY",
  "RECOIL_UP", "RECOIL_LEFT", "RECOIL_RIGHT",
  "X3_FAST", "X3_SLOW", "X4_FAST", "X4_SLOW",
  "RED_FAST", "RED_SLOW", "TURN180_SLOW", "TRACKING_BAD", "MICRO_BAD",
];

const NO_SCOPE: ScopeId[] = ["tpp", "fpp"];
const PRECISION_SCOPES: ScopeId[] = ["scope2", "scope3", "scope4"];
const HI_MAG: ScopeId[] = ["scope4", "scope6", "scope8"];
const SPRAY_SCOPES: ScopeId[] = ["scope2", "scope3", "scope4", "scope6"];
const TRACK_SCOPES: ScopeId[] = ["red", "scope2", "scope3"];
const ALL_SCOPES: ScopeId[] = [...SCOPES];
const TOUCH: EngineId[] = ["cam", "ads"];
const GYRO: EngineId[] = ["gyroCam", "gyroAds"];

interface FeedbackRule {
  groups: { engines: EngineId[]; scopes: ScopeId[]; scale: number }[];
  reasonKey: ReasonKey;
  label: string;
}

const FEEDBACK_RULES: Record<FeedbackCode, FeedbackRule> = {
  TOO_FAST:      { groups: [{ engines: TOUCH, scopes: ["red", ...PRECISION_SCOPES, ...HI_MAG.filter((s) => s !== "scope4")], scale: -0.035 }], reasonKey: "fix_overshoot", label: "global fast" },
  TOO_SLOW:      { groups: [{ engines: [...TOUCH, ...GYRO], scopes: [...NO_SCOPE, "red"], scale: +0.04 }], reasonKey: "boost_turn", label: "global slow" },
  OVERSHOOT:     { groups: [{ engines: TOUCH, scopes: PRECISION_SCOPES, scale: -0.045 }, { engines: GYRO, scopes: PRECISION_SCOPES, scale: -0.025 }], reasonKey: "fix_overshoot", label: "overshoot" },
  UNDERSHOOT:    { groups: [{ engines: TOUCH, scopes: NO_SCOPE, scale: +0.045 }, { engines: GYRO, scopes: NO_SCOPE, scale: +0.045 }, { engines: TOUCH, scopes: ["red"], scale: +0.03 }], reasonKey: "boost_turn", label: "undershoot" },
  SHAKY:         { groups: [{ engines: GYRO, scopes: ALL_SCOPES, scale: -0.035 }], reasonKey: "fix_shake", label: "shaky gyro" },
  HEAVY:         { groups: [{ engines: TOUCH, scopes: NO_SCOPE, scale: +0.03 }, { engines: GYRO, scopes: NO_SCOPE, scale: +0.03 }, { engines: TOUCH, scopes: ["red"], scale: +0.015 }], reasonKey: "boost_turn", label: "heavy" },
  RECOIL_UP:     { groups: [{ engines: ["gyroAds"], scopes: SPRAY_SCOPES, scale: +0.045 }, { engines: ["gyroCam"], scopes: PRECISION_SCOPES, scale: +0.03 }], reasonKey: "pull_head", label: "recoil up" },
  RECOIL_LEFT:   { groups: [{ engines: ["gyroAds"], scopes: PRECISION_SCOPES, scale: +0.03 }, { engines: ["ads"], scopes: ["scope2", "scope3"], scale: -0.02 }], reasonKey: "hw_track", label: "recoil left" },
  RECOIL_RIGHT:  { groups: [{ engines: ["gyroAds"], scopes: PRECISION_SCOPES, scale: +0.03 }, { engines: ["ads"], scopes: ["scope2", "scope3"], scale: -0.02 }], reasonKey: "hw_track", label: "recoil right" },
  X3_FAST:       { groups: [{ engines: [...TOUCH, ...GYRO], scopes: ["scope3"], scale: -0.035 }], reasonKey: "tighten_stability", label: "3x fast" },
  X3_SLOW:       { groups: [{ engines: [...TOUCH, ...GYRO], scopes: ["scope3"], scale: +0.035 }], reasonKey: "boost_turn", label: "3x slow" },
  X4_FAST:       { groups: [{ engines: [...TOUCH, ...GYRO], scopes: ["scope4"], scale: -0.035 }], reasonKey: "tighten_stability", label: "4x fast" },
  X4_SLOW:       { groups: [{ engines: [...TOUCH, ...GYRO], scopes: ["scope4"], scale: +0.035 }], reasonKey: "boost_turn", label: "4x slow" },
  RED_FAST:      { groups: [{ engines: [...TOUCH, ...GYRO], scopes: ["red"], scale: -0.035 }], reasonKey: "fix_overshoot", label: "red fast" },
  RED_SLOW:      { groups: [{ engines: [...TOUCH, ...GYRO], scopes: ["red"], scale: +0.035 }], reasonKey: "boost_turn", label: "red slow" },
  TURN180_SLOW:  { groups: [{ engines: [...TOUCH, ...GYRO], scopes: NO_SCOPE, scale: +0.04 }], reasonKey: "boost_turn", label: "180 slow" },
  TRACKING_BAD:  { groups: [{ engines: TOUCH, scopes: TRACK_SCOPES, scale: +0.03 }, { engines: GYRO, scopes: ["red", "scope2"], scale: +0.03 }], reasonKey: "boost_turn", label: "tracking bad" },
  MICRO_BAD:     { groups: [{ engines: TOUCH, scopes: HI_MAG, scale: -0.035 }], reasonKey: "micro_reduce", label: "micro aim bad" },
};

/* ── Feedback label dictionary (ar/en) ───────────────────────── */
export const FEEDBACK_LABELS: Record<FeedbackCode, { ar: string; en: string }> = {
  TOO_FAST:     { ar: "سريع جداً", en: "Too fast" },
  TOO_SLOW:     { ar: "بطيء جداً", en: "Too slow" },
  OVERSHOOT:    { ar: "تجاوز الهدف", en: "Overshoot" },
  UNDERSHOOT:   { ar: "لا أصل للهدف", en: "Undershoot" },
  SHAKY:        { ar: "اهتزاز", en: "Shaky" },
  HEAVY:        { ar: "ثقيل", en: "Heavy" },
  RECOIL_UP:    { ar: "الارتداد للأعلى", en: "Recoil up" },
  RECOIL_LEFT:  { ar: "الارتداد لليسار", en: "Recoil left" },
  RECOIL_RIGHT: { ar: "الارتداد لليمين", en: "Recoil right" },
  X3_FAST:      { ar: "3× سريع", en: "3X fast" },
  X3_SLOW:      { ar: "3× بطيء", en: "3X slow" },
  X4_FAST:      { ar: "4× سريع", en: "4X fast" },
  X4_SLOW:      { ar: "4× بطيء", en: "4X slow" },
  RED_FAST:     { ar: "Red Dot سريع", en: "Red Dot fast" },
  RED_SLOW:     { ar: "Red Dot بطيء", en: "Red Dot slow" },
  TURN180_SLOW: { ar: "180° بطيء", en: "180° slow" },
  TRACKING_BAD: { ar: "تتبع ضعيف", en: "Tracking bad" },
  MICRO_BAD:    { ar: "مايكرو ضعيف", en: "Micro aim bad" },
};

/* ── Iteration state ─────────────────────────────────────────── */

export interface IterationRun {
  version: number;              // 1..5  (5 = FINAL/locked)
  profile: SensitivityProfile;
  history: ChangeEntry[];
  changes: ChangeEntry[];       // changes from previous version only
  locked: boolean;
  transitionScores: Record<EngineId, number>;
}

const maxFor = (engine: EngineId): number => engine === "gyroCam" || engine === "gyroAds" ? 400 : 300;
const FINE = 0.03;
const MODERATE = 0.10;
const SIGNIFICANT = 0.20;

/** Total accumulated magnitude for an engine×scope across history (absolute). */
function cumulativeDelta(baseline: number, current: number): number {
  return baseline > 0 ? Math.abs(current - baseline) / baseline : 0;
}

/** Same-direction change count for one engine×scope in history. */
function sameDirectionChanges(history: ChangeEntry[], engine: EngineId, scope: ScopeId, dirSign: number): number {
  return history.filter((c) => c.engine === engine && c.scope === scope && (dirSign >= 0 ? c.to > c.from : c.to < c.from)).length;
}

function applyGroups(
  profile: SensitivityProfile,
  baseline: SensitivityProfile,
  history: ChangeEntry[],
  groups: FeedbackRule["groups"],
  reasonKey: ReasonKey,
  label: string,
): { profile: SensitivityProfile; changes: ChangeEntry[] } {
  const next: SensitivityProfile = {
    cam: { ...profile.cam }, ads: { ...profile.ads },
    gyroCam: { ...profile.gyroCam }, gyroAds: { ...profile.gyroAds },
  };
  const changes: ChangeEntry[] = [];

  for (const group of groups) {
    for (const engine of group.engines) {
      for (const scope of group.scopes) {
        const cur = next[engine][scope];
        const base = baseline[engine][scope];
        const priorSame = sameDirectionChanges(history, engine, scope, group.scale);
        let scale = group.scale;

        // Repeat-consciousness: after a same-direction significant move, allow only fine steps.
        if (priorSame >= 1 && Math.abs(scale) > FINE) {
          scale = Math.sign(scale) * FINE;
        }
        // Per-iteration magnitude cap (moderate) unless the rule provides smaller steps.
        if (Math.abs(scale) > MODERATE) scale = Math.sign(scale) * MODERATE;

        let target = Math.round(cur * (1 + scale));

        // Cumulative cap vs baseline (major correction only for explicit major rules).
        const cumulative = cumulativeDelta(base, target);
        const cumulativeCap = SIGNIFICANT;
        if (cumulative > cumulativeCap) {
          if (target > base) target = Math.min(target, Math.round(base * (1 + cumulativeCap)));
          else target = Math.max(target, Math.round(base * (1 - cumulativeCap)));
        }
        target = Math.round(clamp(target, 1, maxFor(engine)));
        if (target !== cur) {
          next[engine][scope] = target;
          changes.push({
            engine, scope, from: cur, to: target,
            pct: round((target - cur) / cur * 100, 1),
            reasonKey,
            reason: `${label} → ${engine}.${scope}`,
          });
        }
      }
    }
  }
  return { profile: next, changes };
}

/* ── Iteration API ───────────────────────────────────────────── */
export function startIteration(baseline: SensitivityProfile): IterationRun {
  return {
    version: 1,
    profile: {
      cam: { ...baseline.cam }, ads: { ...baseline.ads },
      gyroCam: { ...baseline.gyroCam }, gyroAds: { ...baseline.gyroAds },
    },
    history: [],
    changes: [],
    locked: false,
    transitionScores: {
      cam: transitionScore(baseline.cam, "cam"),
      ads: transitionScore(baseline.ads, "ads"),
      gyroCam: transitionScore(baseline.gyroCam, "gyroCam"),
      gyroAds: transitionScore(baseline.gyroAds, "gyroAds"),
    },
  };
}

export function applyFeedback(
  run: IterationRun,
  baseline: SensitivityProfile,
  feedback: FeedbackCode,
): IterationRun {
  if (run.locked) return run;
  const rule = FEEDBACK_RULES[feedback];
  const { profile: stepped, changes } = applyGroups(run.profile, baseline, run.history, rule.groups, rule.reasonKey, rule.label);

  // Validate + repair coherence after every iteration (spec §27).
  const report = validateAndRepair(stepped);
  const profile = report.repaired;
  const allChanges = [...changes, ...report.repairs];

  const nextVersion = Math.min(run.version + 1, 5);
  const locked = nextVersion === 5;

  return {
    version: nextVersion,
    profile,
    history: [...run.history, ...allChanges],
    changes: allChanges,
    locked,
    transitionScores: {
      cam: transitionScore(profile.cam, "cam"),
      ads: transitionScore(profile.ads, "ads"),
      gyroCam: transitionScore(profile.gyroCam, "gyroCam"),
      gyroAds: transitionScore(profile.gyroAds, "gyroAds"),
    },
  };
}

/** Problem-driven strategy: apply all selected problems in one strategic pass.
 *  One-problem/one-adjustment is enforced by stacking rule groups. */
export function applyProblems(
  run: IterationRun,
  baseline: SensitivityProfile,
  problems: import("./model").ProblemCode[],
  problemIndex: Record<string, { reasonKey: ReasonKey; label: string }>,
): IterationRun {
  let current = run;
  for (const p of problems) {
    const meta = problemIndex[p];
    const groups = problemGroups(p);
    const { profile: stepped, changes } = applyGroups(current.profile, baseline, current.history, groups, meta.reasonKey, meta.label);
    const report = validateAndRepair(stepped);
    current = {
      ...current,
      profile: report.repaired,
      history: [...current.history, ...changes, ...report.repairs],
      changes: [...changes, ...report.repairs],
      transitionScores: {
        cam: transitionScore(report.repaired.cam, "cam"),
        ads: transitionScore(report.repaired.ads, "ads"),
        gyroCam: transitionScore(report.repaired.gyroCam, "gyroCam"),
        gyroAds: transitionScore(report.repaired.gyroAds, "gyroAds"),
      },
    };
  }
  return current;
}
