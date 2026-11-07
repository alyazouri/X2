// ALYAZOURI GG device/player/weapon response model.
// This layer produces a calibrated baseline and independent objective targets.
// It does not choose the final value; optimizer.ts performs that search.
import { getWeaponProfile } from "../weaponProfiles";
import { CALIBRATION_COEFFICIENTS, REFERENCE_DEVICE, scopeIndex } from "./calibration";
import {
  AIM_PRIORITY_MUL, DISTANCE_M, ENGINE_ROLE, FINGER_MODEL, GYRO_MODEL,
  HEADSHOT_ZONE, MODE_REGISTRY, PLAY_STYLE_BIAS, SCOPE_MODEL, TARGET_SPEED_MPS,
} from "./constants";
import type {
  ApexInput, EngineId, ObjectiveWeights, ScopeId, WeaponIntel,
} from "./types";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const profileArray = (profile: ReturnType<typeof getWeaponProfile>, engine: EngineId): number[] =>
  engine === "cam" ? profile.cam :
  engine === "ads" ? profile.ads :
  engine === "gyroCam" ? profile.gyro : profile.gyroAds;

const qualityFactor = (quality: ApexInput["device"]["gyroQuality"]): number =>
  quality === "excellent" ? 1 : quality === "good" ? 0.965 : 0.92;

export interface DeviceResponse {
  inputLatencyMs: number;
  responseRatio: number;
  physicalRatio: number;
  ppiRatio: number;
  stability: number;
  engineGain: Record<EngineId, number>;
}

/** Relative device adaptation. The reference iPad evaluates to exactly 1.0. */
export function deviceResponse(input: ApexInput): DeviceResponse {
  const device = input.device;
  const currentFrame = Math.max(1000 / device.fps, 1000 / device.refreshRate);
  const referenceFrame = Math.max(1000 / REFERENCE_DEVICE.fps, 1000 / REFERENCE_DEVICE.refreshRate);
  const inputLatencyMs = currentFrame + device.touchLatencyMs;
  const referenceLatency = referenceFrame + REFERENCE_DEVICE.touchLatencyMs;

  // Small exponents avoid extreme scaling while retaining physical adaptation.
  const physicalRatio = Math.pow(device.screenSize / REFERENCE_DEVICE.screenSize, 0.07);
  const ppiRatio = Math.pow(REFERENCE_DEVICE.ppi / device.ppi, 0.035);
  const responseRatio = Math.pow(inputLatencyMs / referenceLatency, 0.045);
  const touchGain = clamp(physicalRatio * ppiRatio * responseRatio, 0.9, 1.1);
  const gyroGain = clamp(
    Math.pow(device.screenSize / REFERENCE_DEVICE.screenSize, 0.02) *
    Math.pow(inputLatencyMs / referenceLatency, 0.03) *
    qualityFactor(device.gyroQuality),
    0.9,
    1.07,
  );
  const stability = clamp(
    (referenceLatency / inputLatencyMs) ** 0.08 * qualityFactor(device.gyroQuality),
    0.88,
    1.08,
  );

  return {
    inputLatencyMs,
    responseRatio,
    physicalRatio,
    ppiRatio,
    stability,
    engineGain: {
      cam: touchGain,
      ads: clamp(touchGain * 0.997 + 0.003, 0.9, 1.1),
      gyroCam: gyroGain,
      gyroAds: clamp(gyroGain * 0.998 + 0.002, 0.9, 1.07),
    },
  };
}

/** Fire-rate-aware recoil pressure relative to the M416 calibration weapon. */
export function recoilPressure(weapon: WeaponIntel): number {
  const vertical = weapon.verticalRecoil / 100;
  const horizontal = weapon.horizontalRecoil / 100;
  const fireRate = Math.sqrt(clamp(weapon.fireRate / 680, 0.45, 1.7));
  return (vertical * 0.78 + horizontal * 0.22) * fireRate;
}

const REFERENCE_RECOIL = recoilPressure({
  name: "M416", type: "AR", recoil: 72, range: 65,
  fireRate: 680, verticalRecoil: 55, horizontalRecoil: 30, adsSpeed: 80,
});

/** Headshot focus from the player's chosen config (headshot/stability intent). */
export function headFocusOf(input: ApexInput): number {
  return clamp(
    (input.mode === "head" ? 0.9 : 0) +
    (input.mode === "precision" ? 0.6 : 0) +
    (input.mode === "competitive" ? 0.35 : 0) +
    (input.aimPriority === "head" ? 0.9 : 0) +
    (input.aimPriority === "precision" ? 0.6 : 0),
    0, 1.8,
  );
}

export interface PhysicsContext {
  device: DeviceResponse;
  fingerControl: number;
  fingerStability: number;
  gyroActive: boolean;
  gyroControl: number;
  targetAngularSpeed: number;
  referenceAngularSpeed: number;
  recoilPressure: number;
  recoilDelta: number;
  microRisk: number;
  weights: ObjectiveWeights;
}

function effectiveWeights(input: ApexInput): ObjectiveWeights {
  const base = MODE_REGISTRY[input.mode].weights;
  const priority = AIM_PRIORITY_MUL[input.aimPriority];
  const out = {} as ObjectiveWeights;
  (Object.keys(base) as (keyof ObjectiveWeights)[]).forEach((key) => {
    out[key] = base[key] * (priority[key] ?? 1);
  });
  return out;
}

export function buildPhysicsContext(input: ApexInput): PhysicsContext {
  const device = deviceResponse(input);
  const finger = FINGER_MODEL[input.fingers];
  const gyro = GYRO_MODEL[input.gyroMode];
  const speed = TARGET_SPEED_MPS[input.targetStyle];
  const distance = DISTANCE_M[input.range];
  const targetAngularSpeed = Math.atan(speed / distance) * (180 / Math.PI);
  const referenceAngularSpeed = Math.atan(
    TARGET_SPEED_MPS.mixed / DISTANCE_M.mixed,
  ) * (180 / Math.PI);
  const pressure = recoilPressure(input.weapon);
  const recoilDelta = clamp(pressure / REFERENCE_RECOIL - 1, -0.55, 1.2);
  const latencyRisk = clamp(device.inputLatencyMs / (1000 / 120 + 1000 / 240) - 1, -0.4, 0.8);
  const microRisk = clamp(
    Math.max(0, latencyRisk) * 0.45 +
    Math.max(0, 1 - finger.microControl) * 1.8 +
    Math.max(0, 1 - device.stability) * 1.2 +
    (gyro.active ? 0 : 0.08),
    0,
    1,
  );

  return {
    device,
    fingerControl: finger.microControl,
    fingerStability: finger.stability,
    gyroActive: gyro.active,
    gyroControl: gyro.recoilControl,
    targetAngularSpeed,
    referenceAngularSpeed,
    recoilPressure: pressure,
    recoilDelta,
    microRisk,
    weights: effectiveWeights(input),
  };
}

/** Calibrated baseline: selected weapon's own dimension × player transfer × device/player geometry. */
export function calibratedBaseline(
  input: ApexInput,
  context: PhysicsContext,
  engine: EngineId,
  scope: ScopeId,
): number {
  const weapon = getWeaponProfile(
    input.weapon.name,
    input.weapon.recoil,
    input.weapon.range,
    input.weapon.type,
  );
  const seed = profileArray(weapon, engine)[scopeIndex(scope)];
  const finger = FINGER_MODEL[input.fingers].engineGain[engine];
  const gyro = GYRO_MODEL[input.gyroMode].engineGain[engine];

  // ── HEADSHOT + STABILITY SHAPING (direct on the value — not just subtle
  // optimizer nudges). No-scope stays untouched (rotation), so TPP/FPP keep
  // the player's speed. Scoped camera/ADS get tightened for stability;
  // Gyro/Gyro-ADS get stronger head-level pull-down. ──
  let shape = 1;
  if (scope !== "tpp" && scope !== "fpp") {
    const hz = HEADSHOT_ZONE[scope];
    const headFocus = headFocusOf(input);
    if (engine === "gyroCam" || engine === "gyroAds") {
      // Gyro/ADS gyro: up-tune for recoil head-level pull-down.
      shape = 1 + 0.045 * hz * (1 + headFocus * 0.8);
    } else {
      // Camera/ADS: down-tune for stability at head level.
      shape = 1 - 0.04 * hz * (1 + headFocus * 0.7);
    }
  }

  return seed * CALIBRATION_COEFFICIENTS[engine][scope] *
    context.device.engineGain[engine] * finger * gyro * shape;
}

export interface ObjectiveTargets {
  tracking: number;
  precision: number;
  recoil: number;
  stability: number;
  rotation: number;
}

/** Independent target multipliers for one engine × scope problem. */
export function objectiveTargets(
  input: ApexInput,
  context: PhysicsContext,
  engine: EngineId,
  scope: ScopeId,
): ObjectiveTargets {
  const scopeModel = SCOPE_MODEL[scope];
  const role = ENGINE_ROLE[engine];
  const mode = MODE_REGISTRY[input.mode];
  const playStyle = PLAY_STYLE_BIAS[input.playStyle];
  const isGyroEngine = engine === "gyroCam" || engine === "gyroAds";
  // Headshot focus — config intent toward head-level precision+stability.
  const headFocus = headFocusOf(input);
  const hz = HEADSHOT_ZONE[scope];
  const angularDelta = clamp(
    (context.targetAngularSpeed - context.referenceAngularSpeed) /
      context.referenceAngularSpeed,
    -0.9,
    2.5,
  );
  const longRange = input.range === "long" ? 1 : input.range === "close" ? -0.55 : 0;
  const staticTarget = input.targetStyle === "static" ? 1 : 0;
  const precisionPriority = input.aimPriority === "precision" ? 0.06 : input.aimPriority === "head" ? 0.045 : 0;
  const recoilPriority = input.aimPriority === "recoil" ? 0.055 : input.aimPriority === "head" ? 0.025 : 0;

  const tracking = 1 +
    angularDelta * 0.025 * scopeModel.tracking * role.tracking +
    (mode.speedBias + playStyle.speed) * scopeModel.tracking * 0.5;

  // ── HEADSHOT + STABILITY TUNING ───────────────────────────────────────────
  // Scoped camera/ADS: tighter in headshot zones → steadier micro aim at head level.
  // Stronger weapon recoil further tightens for control. Gyro stays responsive
  // (it does the head-level pull-down instead).
  // Subtle target nudges (the primary shaping now happens on the baseline).
  const headshotTighten = hz * 0.005 * (1 + headFocus * 0.85) * (isGyroEngine ? 0.3 : 1);
  const recoilTighten = clamp(context.recoilDelta, 0, 1.2) * 0.004 * hz;
  const precision = 1 -
    (mode.precisionBias + playStyle.precision + precisionPriority + Math.max(0, longRange) * 0.025 + staticTarget * 0.01) *
    scopeModel.precision * role.precision -
    headshotTighten * scopeModel.precision -
    recoilTighten * scopeModel.precision;

  // Gyro (and ADS gyro): stronger head-level pull-down in headshot zones —
  // keeps the crosshair ON head level through recoil-driven spray instead of
  // letting it climb or drift above the head.
  const headshotPull = isGyroEngine ? hz * 0.008 * (1 + headFocus * 0.9) : 0;
  const recoil = 1 +
    (context.recoilDelta * 0.045 + mode.recoilBias + playStyle.recoil + recoilPriority) *
    scopeModel.recoilUse * role.recoil * context.gyroControl +
    headshotPull * scopeModel.recoilUse;

  // Extra scoped stability in headshot zones (only when a head-focused config is chosen).
  const stability = 1 -
    (context.microRisk * 0.06 + Math.max(0, longRange) * 0.018) *
    scopeModel.precision * role.stability -
    hz * 0.012 * headFocus * scopeModel.precision;
  const rotation = 1 +
    (mode.speedBias + playStyle.speed + (input.range === "close" ? 0.035 : input.range === "long" ? -0.018 : 0)) *
    scopeModel.rotation * role.rotation;

  return {
    tracking: clamp(tracking, 0.88, 1.14),
    precision: clamp(precision, 0.86, 1.04),
    recoil: clamp(recoil, 0.9, 1.16),
    stability: clamp(stability, 0.88, 1.03),
    rotation: clamp(rotation, 0.9, 1.12),
  };
}

export interface DimensionErrors {
  tracking: number;
  overshoot: number;
  undershoot: number;
  microShake: number;
  aimDrift: number;
  recoil: number;
  response: number;
  total: number;
}

/** Multi-objective cost evaluated for every candidate multiplier.
 *  `precomputed` lets the search reuse multiplier-independent targets. */
export function evaluateCandidate(
  input: ApexInput,
  context: PhysicsContext,
  engine: EngineId,
  scope: ScopeId,
  multiplier: number,
  precomputed?: ObjectiveTargets,
): DimensionErrors {
  const scopeModel = SCOPE_MODEL[scope];
  const role = ENGINE_ROLE[engine];
  const w = context.weights;
  const targets = precomputed ?? objectiveTargets(input, context, engine, scope);
  const sq = (value: number): number => value * value;

  const tracking = sq(multiplier - targets.tracking) * (w.tracking + w.adhesion * 0.45) * role.tracking;
  const microShake = sq(multiplier - targets.precision) * (w.micro + w.precision * 0.55 + w.head * 0.25) * role.precision;
  const recoil = sq(multiplier - targets.recoil) * (w.recoil + w.head * 0.25) * role.recoil;
  const aimDrift = sq(multiplier - targets.stability) * w.stability * role.stability;
  const response = sq(multiplier - targets.rotation) * (w.rotation + w.targetSwitch * 0.55) * role.rotation;
  const responseTarget = Math.max(targets.tracking, targets.recoil * scopeModel.recoilUse);
  // Heavier overshoot penalty in headshot zones — overshooting the head zone
  // (climbing above head level) is the costliest aim error for headshots.
  const hzError = HEADSHOT_ZONE[scope];
  const overshoot = sq(Math.max(0, multiplier - Math.min(targets.precision, targets.stability))) *
    (w.precision + w.stability + w.head * hzError) * scopeModel.precision * (1 + context.microRisk) *
    (1 + hzError * 0.6);
  const undershoot = sq(Math.max(0, responseTarget - multiplier)) *
    (w.tracking + w.recoil) * (scopeModel.tracking + scopeModel.recoilUse) * 0.55;
  const baseline = sq(multiplier - 1) * role.baseline;
  const total = tracking + microShake + recoil + aimDrift + response + overshoot + undershoot + baseline;

  return { tracking, overshoot, undershoot, microShake, aimDrift, recoil, response, total };
}
