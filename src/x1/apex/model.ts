// ════════════════════════════════════════════════════════════════
// ALYAZOURI EXPERT AIM MODEL — normalized device/player/aim model,
// current-sensitivity analysis, scope-transition coherence, and
// confidence estimation. PUBG MOBILE GLOBAL only.
// ════════════════════════════════════════════════════════════════
import {
  ENGINES, SCOPES, type EngineId, type ScopeId, type SensitivityProfile, type ScopeSens,
} from "./types";

const round = (n: number, d = 0): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/* ── Device physical classes ─────────────────────────────────── */
export type DeviceClass = "Phone-S" | "Phone-Std" | "Phone-L" | "Tab-S" | "Tab-L";

/** Normalized physical class — screen size decides the class, never a phone multiplier. */
export function deviceClassOf(size: number): DeviceClass {
  if (size < 5.5) return "Phone-S";
  if (size < 6.4) return "Phone-Std";
  if (size < 7.2) return "Phone-L";
  if (size < 9.5) return "Tab-S";
  return "Tab-L";
}

export interface ExpertContext {
  deviceClass: DeviceClass;
  deviceName: string;
  fps: number;
  touchRate: number;
  screenSize: number;
  ppi: number;
  fingers: number;
  gyroMode: "off" | "scope" | "always";
  weaponName: string;
  weaponType: string;
  playStyle: string;
  mode: string;
  targetStyle: string;
  range: string;
  aimPriority: string;
}

/* ── Problem taxonomy ────────────────────────────────────────── */
export type ProblemCode =
  | "overshoot" | "undershoot" | "shakyGyro" | "slowTurning"
  | "poorTracking" | "poorMicro" | "unstableHiMag"
  | "recoilUp" | "recoilLeft" | "recoilRight"
  | "horizontalDrift" | "verticalDrift";

export const PROBLEM_CODES: ProblemCode[] = [
  "overshoot", "undershoot", "shakyGyro", "slowTurning",
  "poorTracking", "poorMicro", "unstableHiMag",
  "recoilUp", "recoilLeft", "recoilRight",
  "horizontalDrift", "verticalDrift",
];

const NO_SCOPE: ScopeId[] = ["tpp", "fpp"];
const SCOPED: ScopeId[] = ["red", "scope2", "scope3", "scope4", "scope6", "scope8"];

/** Problem → affected engine/scope groups with signed scale (+ raise, − reduce). */
export function problemGroups(problem: ProblemCode): { engines: EngineId[]; scopes: ScopeId[]; scale: number }[] {
  const touch: EngineId[] = ["cam", "ads"];
  const gyro: EngineId[] = ["gyroCam", "gyroAds"];
  switch (problem) {
    case "overshoot":
      return [
        { engines: touch, scopes: ["red", "scope2", "scope3", "scope4"], scale: -0.04 },
        { engines: gyro, scopes: ["scope2", "scope3", "scope4"], scale: -0.025 },
      ];
    case "undershoot":
      return [
        { engines: touch, scopes: NO_SCOPE, scale: +0.045 },
        { engines: gyro, scopes: NO_SCOPE, scale: +0.045 },
        { engines: touch, scopes: ["red"], scale: +0.03 },
      ];
    case "shakyGyro":
      return [{ engines: gyro, scopes: SCOPED, scale: -0.035 }];
    case "slowTurning":
      return [
        { engines: touch, scopes: NO_SCOPE, scale: +0.05 },
        { engines: gyro, scopes: NO_SCOPE, scale: +0.05 },
      ];
    case "poorTracking":
      return [
        { engines: touch, scopes: ["red", "scope2"], scale: +0.035 },
        { engines: gyro, scopes: ["red", "scope2"], scale: +0.03 },
      ];
    case "poorMicro":
      return [{ engines: touch, scopes: ["scope4", "scope6", "scope8"], scale: -0.035 }];
    case "unstableHiMag":
      return [{ engines: ["cam", "ads"], scopes: ["scope6", "scope8"], scale: -0.05 }];
    case "recoilUp":
      return [
        { engines: ["gyroAds"], scopes: ["scope2", "scope3", "scope4", "scope6"], scale: +0.045 },
        { engines: ["gyroCam"], scopes: ["scope2", "scope3", "scope4"], scale: +0.03 },
      ];
    case "recoilLeft":
    case "recoilRight":
      return [
        { engines: ["gyroAds"], scopes: ["scope2", "scope3", "scope4"], scale: +0.03 },
        { engines: ["ads"], scopes: ["scope2", "scope3"], scale: -0.02 },
      ];
    case "horizontalDrift":
      return [{ engines: touch, scopes: ["scope2", "scope3", "scope4"], scale: -0.02 }];
    case "verticalDrift":
      return [{ engines: gyro, scopes: ["scope3", "scope4", "scope6"], scale: -0.025 }];
  }
}

/* ── Change log ──────────────────────────────────────────────── */
export type ReasonKey =
  | "tighten_stability" | "pull_head" | "boost_turn" | "fix_overshoot"
  | "fix_shake" | "fix_transition" | "hw_track" | "micro_reduce" | "preserve_strength";

export interface ChangeEntry {
  engine: EngineId;
  scope: ScopeId;
  from: number;
  to: number;
  pct: number;
  reasonKey: ReasonKey;
  reason: string;
}

/* ── Scope transition coherence ──────────────────────────────── */
const SCOPE_PAIRS: [ScopeId, ScopeId][] = [
  ["red", "scope2"], ["scope2", "scope3"], ["scope3", "scope4"], ["scope4", "scope6"], ["scope6", "scope8"],
];
const RATIO_BAND: Record<"touch" | "gyro", [number, number]> = {
  // Touch drag: raising zoom must not make the next scope faster (a 6x above
  // the 4x was the corrupted-calibration symptom fixed in MODEL 3.1). The band
  // keeps a small tolerance for deliberate player quirks.
  touch: [0.42, 1.15],
  gyro: [0.45, 1.7],
};
const laneOf = (engine: EngineId): "touch" | "gyro" =>
  engine === "gyroCam" || engine === "gyroAds" ? "gyro" : "touch";

/** 0–100 coherence score: how predictable the scope curve is for one engine. */
export function transitionScore(channel: ScopeSens, engine: EngineId): number {
  const [lo, hi] = RATIO_BAND[laneOf(engine)];
  let penalty = 0;
  for (const [a, b] of SCOPE_PAIRS) {
    const prev = channel[a], next = channel[b];
    if (prev <= 0 || next <= 0) { penalty += 20; continue; }
    const ratio = next / prev;
    if (ratio < lo) penalty += round((lo - ratio) * 100, 1);
    else if (ratio > hi) penalty += round((ratio - hi) * 100, 1);
  }
  return round(clamp(100 - penalty, 0, 100));
}

/** Whole-profile transition coherence across all engines. */
export function profileCoherence(profile: SensitivityProfile): number {
  const scores = ENGINES.map((e) => transitionScore(profile[e], e));
  return round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/* ── Current sensitivity analysis ────────────────────────────── */
export interface CurrentAnalysis {
  strengths: { engine: EngineId; scope: ScopeId; value: number; deltaPct: number }[];
  outliers: { engine: EngineId; scope: ScopeId; value: number; model: number; deltaPct: number }[];
  transitionIssues: { engine: EngineId; pair: [ScopeId, ScopeId]; ratio: number; band: [number, number] }[];
  coherence: number;
}

/** Compare the player's current profile to the model optimum:
 *  keep values close to the model, adjust only clear outliers. */
export function analyzeCurrent(
  current: SensitivityProfile,
  optimum: SensitivityProfile,
): CurrentAnalysis {
  const strengths: CurrentAnalysis["strengths"] = [];
  const outliers: CurrentAnalysis["outliers"] = [];
  const transitionIssues: CurrentAnalysis["transitionIssues"] = [];

  for (const engine of ENGINES) {
    for (const scope of SCOPES) {
      const cur = current[engine][scope];
      const model = optimum[engine][scope];
      if (!Number.isFinite(cur) || cur <= 0 || model <= 0) continue;
      const deltaPct = (cur - model) / model;
      if (Math.abs(deltaPct) <= 0.07) {
        strengths.push({ engine, scope, value: cur, deltaPct: round(deltaPct * 100, 1) });
      } else if (Math.abs(deltaPct) >= 0.15) {
        outliers.push({ engine, scope, value: cur, model, deltaPct: round(deltaPct * 100, 1) });
      }
    }
    const [lo, hi] = RATIO_BAND[laneOf(engine)];
    for (const [a, b] of SCOPE_PAIRS) {
      const prev = current[engine][a], next = current[engine][b];
      if (prev <= 0 || next <= 0) continue;
      const ratio = next / prev;
      if (ratio < lo || ratio > hi) transitionIssues.push({ engine, pair: [a, b], ratio: round(ratio, 2), band: [lo, hi] });
    }
  }
  return { strengths, outliers, transitionIssues, coherence: profileCoherence(current) };
}

/* ── Validation & auto-repair ────────────────────────────────── */
export interface ValidationReport {
  issues: string[];
  repairs: ChangeEntry[];
  repaired: SensitivityProfile;
}

export function validateAndRepair(profile: SensitivityProfile): ValidationReport {
  const issues: string[] = [];
  const repairs: ChangeEntry[] = [];
  const repaired: SensitivityProfile = {
    cam: { ...profile.cam }, ads: { ...profile.ads },
    gyroCam: { ...profile.gyroCam }, gyroAds: { ...profile.gyroAds },
  };

  // Pass 1 — hardware bounds.
  for (const engine of ENGINES) {
    const max = engine === "gyroCam" || engine === "gyroAds" ? 400 : 300;
    for (const scope of SCOPES) {
      const v = repaired[engine][scope];
      const clamped = Math.round(clamp(v, 1, max));
      if (!Number.isFinite(v) || v < 1) {
        repaired[engine][scope] = 1;
        issues.push(`${engine}.${scope}: invalid/low value repaired`);
      } else if (v > max) {
        repaired[engine][scope] = clamped;
        issues.push(`${engine}.${scope}: above ${max} clamped`);
        if (clamped !== Math.round(v)) repairs.push({ engine, scope, from: Math.round(v), to: clamped, pct: -100 * (1 - clamped / v), reasonKey: "fix_shake", reason: "Hardware bound clamp" });
      }
    }
  }

  // Pass 2 — scope transition coherence repair.
  for (const engine of ENGINES) {
    const [lo, hi] = RATIO_BAND[laneOf(engine)];
    for (const [a, b] of SCOPE_PAIRS) {
      const prev = repaired[engine][a];
      let next = repaired[engine][b];
      if (prev <= 0) continue;
      const ratio = next / prev;
      if (ratio < lo || ratio > hi) {
        const target = ratio < lo ? prev * lo : prev * hi;
        next = Math.round(target);
        const from = repaired[engine][b];
        repairs.push({ engine, scope: b, from, to: next, pct: round((next - from) / from * 100, 1), reasonKey: "fix_transition", reason: "Transition coherence repair" });
        repaired[engine][b] = next;
        issues.push(`${engine}.${a}→${b}: ratio ${ratio.toFixed(2)} outside [${lo}, ${hi}] repaired`);
      }
    }
  }

  // Pass 3 — gyro must not silently collapse with touch lanes for gyro users
  // (independent channels: gyroCam/gyroAds may differ freely, but must not be identical everywhere).
  const gyroDifferences = SCOPES.filter((s) => repaired.gyroCam[s] !== repaired.gyroAds[s]).length;
  if (gyroDifferences < 2) issues.push("gyroCam/gyroAds: insufficient independent separation");

  return { issues, repairs, repaired };
}

/* ── Confidence model ────────────────────────────────────────── */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export interface ConfidenceInfo {
  level: ConfidenceLevel;
  score: number;
  reasons: string[];
}

export function confidenceOf(
  ctx: ExpertContext,
  hasCurrent: boolean,
  iterations: number,
): ConfidenceInfo {
  const reasons: string[] = [];
  let score = 40;
  if (ctx.fps >= 60) { score += 8; reasons.push("FPS known"); }
  if (ctx.touchRate >= 120) { score += 8; reasons.push("touch sampling known"); }
  if (ctx.screenSize > 0 && ctx.ppi > 0) { score += 8; reasons.push("screen geometry known"); }
  if (ctx.fingers > 0) { score += 8; reasons.push("finger count set"); }
  if (ctx.gyroMode !== "off") { score += 8; reasons.push("gyro model active"); }
  if (ctx.weaponName) { score += 6; reasons.push("weapon model included"); }
  if (hasCurrent) { score += 10; reasons.push("current sensitivity analyzed"); }
  if (iterations >= 1) { score += 6; reasons.push("feedback incorporated"); }
  score = clamp(score, 30, 99);
  const level: ConfidenceLevel = score >= 80 ? "HIGH" : score >= 62 ? "MEDIUM" : "LOW";
  return { level, score: Math.round(score), reasons };
}

/* ── Structured expert result (spec §31) ─────────────────────── */
export interface ExpertResult {
  game: "PUBG MOBILE GLOBAL";
  profile: string;
  device: Record<string, unknown>;
  player: Record<string, unknown>;
  weapon: Record<string, unknown>;
  camera: ScopeSens;
  ads: ScopeSens;
  gyroCamera: ScopeSens;
  gyroAds: ScopeSens;
  freeLook: { cam: number; parashoot: number; vehicle: number };
  diagnostics: string[];
  changes: ChangeEntry[];
  confidence: ConfidenceInfo;
  optimizationVersion: number;
  coherence: number;
}

export function buildExpertResult(
  ctx: ExpertContext,
  active: SensitivityProfile,
  freeLook: { cam: number; parashoot: number; vehicle: number },
  changes: ChangeEntry[],
  diagnostics: string[],
  version: number,
): ExpertResult {
  return {
    game: "PUBG MOBILE GLOBAL",
    profile: ctx.mode === "balanced" && ctx.aimPriority === "balanced" ? "ALYAZOURI GG" : `${ctx.mode.toUpperCase()} · ${ctx.aimPriority.toUpperCase()}`,
    device: {
      name: ctx.deviceName, class: ctx.deviceClass, fps: ctx.fps,
      touchRate: ctx.touchRate, screenSize: ctx.screenSize, ppi: round(ctx.ppi),
    },
    player: {
      fingers: ctx.fingers, gyro: ctx.gyroMode, playStyle: ctx.playStyle,
      mode: ctx.mode, targetStyle: ctx.targetStyle, range: ctx.range, aimPriority: ctx.aimPriority,
    },
    weapon: { name: ctx.weaponName, type: ctx.weaponType },
    camera: active.cam, ads: active.ads,
    gyroCamera: active.gyroCam, gyroAds: active.gyroAds,
    freeLook,
    diagnostics,
    changes,
    confidence: confidenceOf(ctx, changes.length > 0, version - 1),
    optimizationVersion: version,
    coherence: profileCoherence(active),
  };
}
