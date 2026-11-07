// ALYAZOURI GG multi-objective search.
// Every one of the 32 dimensions runs an independent deterministic candidate
// search around a weapon/device/player calibrated baseline.
import {
  AIM_PRIORITY_MUL, FINGER_MODEL, GYRO_MODEL, MODE_REGISTRY, OPTIMIZER,
} from "./constants";
import {
  buildPhysicsContext, calibratedBaseline, evaluateCandidate, objectiveTargets,
  type DimensionErrors, type ObjectiveTargets, type PhysicsContext,
} from "./physics";
import {
  BOUNDS, ENGINES, OBJECTIVE_KEYS, SCOPES,
  type ApexInput, type EngineId, type EngineScopeMatrix,
  type FactorAttribution, type GProfile, type MeasuredErrors,
  type OptimizationScore, type ScopeId,
  type ScopePerformance, type SensitivityProfile,
} from "./types";
import { emptyProfile } from "./calibration";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const isGyro = (engine: EngineId): boolean => engine === "gyroCam" || engine === "gyroAds";
const maxFor = (engine: EngineId): number => isGyro(engine) ? BOUNDS.gyro.max : engine === "ads" ? BOUNDS.ads.max : BOUNDS.cam.max;

interface SearchResult {
  multiplier: number;
  errors: DimensionErrors;
  evaluated: number;
  margin: number;
}

function searchDimension(
  input: ApexInput,
  context: PhysicsContext,
  engine: EngineId,
  scope: ScopeId,
): SearchResult {
  let bestMultiplier = 1;
  let bestErrors: DimensionErrors | null = null;
  let bestTotal = Number.POSITIVE_INFINITY;
  let secondBest = Number.POSITIVE_INFINITY;
  let evaluated = 0;

  // The objective targets are multiplier-independent — compute once per
  // dimension instead of once per candidate (removes ~98% of that work).
  const targets: ObjectiveTargets = objectiveTargets(input, context, engine, scope);

  for (
    let multiplier = OPTIMIZER.minMultiplier;
    multiplier <= OPTIMIZER.maxMultiplier + 1e-9;
    multiplier += OPTIMIZER.step
  ) {
    const candidate = round(multiplier, 3);
    const errors = evaluateCandidate(input, context, engine, scope, candidate, targets);
    evaluated += 1;
    if (errors.total < bestTotal - 1e-12) {
      secondBest = bestTotal;
      bestErrors = errors;
      bestTotal = errors.total;
      bestMultiplier = candidate;
    } else if (errors.total > bestTotal + 1e-12 && errors.total < secondBest) {
      secondBest = errors.total;
    }
  }

  const selectedErrors = bestErrors ?? evaluateCandidate(input, context, engine, scope, 1);
  const rawMargin = Number.isFinite(secondBest)
    ? (secondBest - selectedErrors.total) / Math.max(selectedErrors.total, 0.0001)
    : 0;
  return {
    multiplier: bestMultiplier,
    errors: selectedErrors,
    evaluated,
    margin: clamp(rawMargin * 8, 0, 1),
  };
}

export interface OptimizeOutput {
  profile: SensitivityProfile;
  baseline: SensitivityProfile;
  gProfile: GProfile;
  errors: MeasuredErrors;
  totalError: number;
  candidates: number;
  avgMargin: number;
  engineScope: EngineScopeMatrix;
  scopePerformance: ScopePerformance;
  ctx: PhysicsContext;
  recoilCompFactor: number;
  /** How many scoped values were clamped to keep the zoom curve monotonic. */
  monotonicRepairs: number;
}

/** Scoped sensitivities must never rise as magnification increases — a 6x
 *  that turns faster than a 4x is unplayable in PUBG Mobile Global. Enforce
 *  the physical curve after the independent per-dimension search. */
const SCOPED_LANE: ScopeId[] = ["red", "scope2", "scope3", "scope4", "scope6", "scope8"];
function enforceZoomCurve(profile: SensitivityProfile): number {
  let repairs = 0;
  for (const engine of ENGINES) {
    for (let i = 1; i < SCOPED_LANE.length; i += 1) {
      const prevScope = SCOPED_LANE[i - 1];
      const scope = SCOPED_LANE[i];
      if (profile[engine][scope] > profile[engine][prevScope]) {
        profile[engine][scope] = profile[engine][prevScope];
        repairs += 1;
      }
    }
  }
  return repairs;
}

const emptyMatrix = (): EngineScopeMatrix => ({
  cam: {} as ScopePerformance,
  ads: {} as ScopePerformance,
  gyroCam: {} as ScopePerformance,
  gyroAds: {} as ScopePerformance,
});

function aggregateErrors(errors: DimensionErrors[]): MeasuredErrors {
  const count = Math.max(1, errors.length);
  const sum = (key: keyof DimensionErrors): number =>
    errors.reduce((total, item) => total + item[key], 0) / count;
  return {
    tracking: round(sum("tracking"), 4),
    overshoot: round(sum("overshoot"), 4),
    undershoot: round(sum("undershoot"), 4),
    microShake: round(sum("microShake"), 4),
    aimDrift: round(sum("aimDrift"), 4),
    recoil: round(sum("recoil"), 4),
    response: round(sum("response"), 4),
    total: round(sum("total"), 4),
  };
}

export function optimize(input: ApexInput): OptimizeOutput {
  const context = buildPhysicsContext(input);
  const profile = emptyProfile();
  const baseline = emptyProfile();
  const gProfile = emptyProfile() as GProfile;
  const engineScope = emptyMatrix();
  const chosenErrors: DimensionErrors[] = [];
  let candidates = 0;
  let marginTotal = 0;
  let recoilRatioTotal = 0;
  let recoilRatioCount = 0;

  for (const engine of ENGINES) {
    for (const scope of SCOPES) {
      const baseValue = calibratedBaseline(input, context, engine, scope);
      const search = searchDimension(input, context, engine, scope);
      const value = Math.round(clamp(
        baseValue * search.multiplier,
        BOUNDS.cam.min,
        maxFor(engine),
      ));
      baseline[engine][scope] = Math.round(clamp(baseValue, BOUNDS.cam.min, maxFor(engine)));
      profile[engine][scope] = value;
      gProfile[engine][scope] = search.multiplier;
      chosenErrors.push(search.errors);
      candidates += search.evaluated;
      marginTotal += search.margin;
      engineScope[engine][scope] = Math.round(
        100 * Math.exp(-search.errors.total * OPTIMIZER.errorScoreDecay),
      );

      if ((engine === "gyroCam" || engine === "gyroAds") &&
          (scope === "red" || scope === "scope2" || scope === "scope3" || scope === "scope4")) {
        recoilRatioTotal += value / Math.max(1, baseline[engine][scope]);
        recoilRatioCount += 1;
      }
    }
  }

  // Physical curve guard: higher magnification must never turn faster.
  const monotonicRepairs = enforceZoomCurve(profile);

  const scopePerformance = {} as ScopePerformance;
  for (const scope of SCOPES) {
    const activeEngines = input.gyroMode === "off"
      ? (["cam", "ads"] as EngineId[])
      : ENGINES;
    scopePerformance[scope] = Math.round(
      activeEngines.reduce((sum, engine) => sum + engineScope[engine][scope], 0) /
      activeEngines.length,
    );
  }
  const errors = aggregateErrors(chosenErrors);

  return {
    profile,
    baseline,
    gProfile,
    errors,
    totalError: errors.total,
    candidates,
    avgMargin: marginTotal / (ENGINES.length * SCOPES.length),
    engineScope,
    scopePerformance,
    ctx: context,
    recoilCompFactor: round(recoilRatioTotal / Math.max(1, recoilRatioCount), 2),
    monotonicRepairs,
  };
}

const scoreFromError = (error: number, decay: number): number =>
  Math.round(clamp(100 * Math.exp(-error * decay), 0, 100));

/** Scores are derived from measured optimum errors, not hardware marketing labels. */
export function computeScores(input: ApexInput, errors: MeasuredErrors): OptimizationScore {
  const tracking = scoreFromError(errors.tracking + errors.undershoot * 0.35, 80);
  const recoil = scoreFromError(errors.recoil, 95);
  const micro = scoreFromError(errors.microShake + errors.overshoot * 0.35, 95);
  const stability = scoreFromError(errors.aimDrift + errors.microShake * 0.45 + errors.overshoot * 0.35, 75);
  const rotation = scoreFromError(errors.response + errors.undershoot * 0.45, 70);
  const targetSwitch = scoreFromError(errors.tracking * 0.6 + errors.response * 0.4, 80);
  const precision = scoreFromError(errors.microShake * 0.55 + errors.overshoot * 0.3 + errors.aimDrift * 0.15, 90);
  const head = Math.round(tracking * 0.27 + recoil * 0.29 + micro * 0.25 + stability * 0.19);
  const adhesion = Math.round(tracking * 0.45 + stability * 0.25 + micro * 0.2 + targetSwitch * 0.1);
  const scores: OptimizationScore = {
    head, tracking, adhesion, recoil, micro, stability,
    rotation, targetSwitch, precision, supreme: 0,
  };
  const modeWeights = MODE_REGISTRY[input.mode].weights;
  const priority = AIM_PRIORITY_MUL[input.aimPriority];
  let weighted = 0;
  let weightTotal = 0;
  for (const key of OBJECTIVE_KEYS) {
    const weight = modeWeights[key] * (priority[key] ?? 1);
    weighted += scores[key] * weight;
    weightTotal += weight;
  }
  scores.supreme = Math.round(weighted / weightTotal);
  return scores;
}

/** Validate ranges, finiteness, scope separation, and independent gyro engines. */
export function validationIssues(profile: SensitivityProfile): string[] {
  const issues: string[] = [];
  for (const engine of ENGINES) {
    const values: number[] = [];
    for (const scope of SCOPES) {
      const value = profile[engine][scope];
      values.push(value);
      if (!Number.isFinite(value)) issues.push(`${engine}.${scope}: non-finite`);
      if (value < BOUNDS.cam.min) issues.push(`${engine}.${scope}: below ${BOUNDS.cam.min}`);
      const max = maxFor(engine);
      if (value > max) issues.push(`${engine}.${scope}: above ${max}`);
    }
    // A scope curve that collapsed to a single value is not a real profile.
    if (new Set(values).size < 3) issues.push(`${engine}: insufficient scope separation`);
  }
  const gyroSeparation = SCOPES.filter(
    (scope) => profile.gyroCam[scope] !== profile.gyroAds[scope],
  ).length;
  if (gyroSeparation < 2) issues.push("gyroCam/gyroAds: insufficient independent separation");

  // The scoped zoom curve must never rise with magnification.
  for (const engine of ENGINES) {
    for (let i = 1; i < SCOPED_LANE.length; i += 1) {
      const prev = SCOPED_LANE[i - 1];
      const cur = SCOPED_LANE[i];
      if (profile[engine][cur] > profile[engine][prev]) {
        issues.push(`${engine}.${cur}: higher than ${prev} (zoom curve violation)`);
      }
    }
  }
  return issues;
}

/** Per-factor attribution: how far each input moved the discovered solution. */
export function attribution(
  input: ApexInput,
  optimized: OptimizeOutput,
): FactorAttribution[] {
  const mean = (values: number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const pct = (ratio: number): number => round(Math.abs(ratio - 1) * 100, 1);
  const directionOf = (ratio: number): FactorAttribution["direction"] =>
    ratio - 1 > 0.0005 ? "up" : 1 - ratio > 0.0005 ? "down" : "neutral";

  const deviceRatio = mean(Object.values(optimized.ctx.device.engineGain));
  const fingerRatio = mean(Object.values(FINGER_MODEL[input.fingers].engineGain));
  const gyroRatio = mean(Object.values(GYRO_MODEL[input.gyroMode].engineGain));
  const recoilRatio = optimized.recoilCompFactor;

  const entries: FactorAttribution[] = [
    {
      factor: "device",
      label: `Device response (${input.device.name})`,
      deltaPct: pct(deviceRatio),
      direction: directionOf(deviceRatio),
    },
    {
      factor: "fingers",
      label: `${input.fingers}-finger geometry`,
      deltaPct: pct(fingerRatio),
      direction: directionOf(fingerRatio),
    },
    {
      factor: "gyro",
      label: `Gyro ${input.gyroMode}`,
      deltaPct: pct(gyroRatio),
      direction: directionOf(gyroRatio),
    },
    {
      factor: "recoil",
      label: `Recoil (${input.weapon.name})`,
      deltaPct: pct(recoilRatio),
      direction: directionOf(recoilRatio),
    },
  ];
  return entries.sort((a, b) => b.deltaPct - a.deltaPct);
}

/** Reliability of the discovered solution (margin × input richness). */
export function confidence(
  input: ApexInput,
  avgMargin: number,
): {
  score: number;
  level: "low" | "medium" | "high";
  margin: number;
  richness: number;
  iterations: number;
} {
  const richnessInputs = [
    input.device.fps > 0,
    input.device.refreshRate > 0,
    input.device.touchRate > 0,
    input.device.screenSize > 0,
    input.device.ppi > 0,
    Boolean(input.device.resolution),
    Boolean(input.weapon.name),
    input.weapon.verticalRecoil >= 0,
    input.weapon.fireRate > 0,
    input.fingers >= 2,
    input.gyroMode !== undefined,
    input.mode !== undefined,
  ];
  const richness = richnessInputs.filter(Boolean).length / richnessInputs.length;
  const score = Math.round(clamp(46 + avgMargin * 34 + richness * 20, 0, 99));
  return {
    score,
    level: score >= 80 ? "high" : score >= 62 ? "medium" : "low",
    margin: round(avgMargin, 3),
    richness: round(richness, 3),
    iterations: 1,
  };
}

/** Free-look values derived from the discovered camera profile. */
export function freeLookFromProfile(
  input: ApexInput,
  profile: SensitivityProfile,
): { cam: number; parashoot: number; vehicle: number } {
  const cam = profile.cam.tpp;
  const gyroBoost = input.gyroMode === "always" ? 1.02 : input.gyroMode === "scope" ? 1.01 : 1.0;
  return {
    cam: Math.round(clamp(cam, 1, 300)),
    parashoot: Math.round(clamp(cam * 0.96 * gyroBoost, 1, 300)),
    vehicle: Math.round(clamp(cam * 0.92 * gyroBoost, 1, 300)),
  };
}
