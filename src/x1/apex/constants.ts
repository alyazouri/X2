// ALYAZOURI GG Supreme model configuration.
// Constants describe physical/model roles. Final sensitivities are discovered
// by the optimizer and are never copied from these values.
import type {
  AimPriority, CombatRange, EngineId, FingerCount, GGModeId,
  GyroMode, ObjectiveWeights, ScopeId, TargetStyle,
  PlayStyleId,
} from "./types";

export interface ScopeModel {
  zoom: number;
  precision: number;
  tracking: number;
  rotation: number;
  recoilUse: number;
}

/** Independent scope behavior; no linear scope scaling is used. */
export const SCOPE_MODEL: Record<ScopeId, ScopeModel> = {
  tpp:    { zoom: 1.0,  precision: 0.16, tracking: 1.00, rotation: 1.00, recoilUse: 0.28 },
  fpp:    { zoom: 1.0,  precision: 0.24, tracking: 0.94, rotation: 0.88, recoilUse: 0.32 },
  red:    { zoom: 1.25, precision: 0.40, tracking: 1.00, rotation: 0.34, recoilUse: 1.00 },
  scope2: { zoom: 1.8,  precision: 0.56, tracking: 0.96, rotation: 0.22, recoilUse: 1.00 },
  scope3: { zoom: 2.5,  precision: 0.70, tracking: 0.86, rotation: 0.14, recoilUse: 1.00 },
  scope4: { zoom: 3.5,  precision: 0.82, tracking: 0.72, rotation: 0.09, recoilUse: 0.90 },
  scope6: { zoom: 5.0,  precision: 0.92, tracking: 0.50, rotation: 0.05, recoilUse: 0.52 },
  scope8: { zoom: 7.0,  precision: 0.98, tracking: 0.34, rotation: 0.03, recoilUse: 0.28 },
};

export const isNoScope = (scope: ScopeId): boolean => scope === "tpp" || scope === "fpp";

/** Headshot-zone weight per scope — how much that scope is used for
 *  head-level spray/tracking. 3× is the peak headshot spray zone, 4× second.
 *  Drives tighter scoped camera/ADS (stability) and stronger gyro pull-down. */
export const HEADSHOT_ZONE: Record<ScopeId, number> = {
  tpp: 0, fpp: 0, red: 0.45, scope2: 0.6, scope3: 1.0, scope4: 0.88, scope6: 0.5, scope8: 0.35,
};

export interface ModeProfile {
  weights: ObjectiveWeights;
  speedBias: number;
  precisionBias: number;
  recoilBias: number;
}

export const MODE_REGISTRY: Record<GGModeId, ModeProfile> = {
  aggressive:  { weights: { head: .10, tracking: .17, adhesion: .12, recoil: .11, micro: .07, stability: .06, rotation: .17, targetSwitch: .13, precision: .07 }, speedBias: .06, precisionBias: -.01, recoilBias: .01 },
  balanced:    { weights: { head: .13, tracking: .14, adhesion: .11, recoil: .13, micro: .12, stability: .12, rotation: .08, targetSwitch: .08, precision: .09 }, speedBias: 0, precisionBias: 0, recoilBias: 0 },
  control:     { weights: { head: .12, tracking: .12, adhesion: .10, recoil: .15, micro: .14, stability: .17, rotation: .05, targetSwitch: .05, precision: .10 }, speedBias: -.02, precisionBias: .04, recoilBias: .03 },
  precision:   { weights: { head: .17, tracking: .11, adhesion: .09, recoil: .10, micro: .17, stability: .14, rotation: .04, targetSwitch: .04, precision: .14 }, speedBias: -.03, precisionBias: .07, recoilBias: 0 },
  competitive: { weights: { head: .16, tracking: .16, adhesion: .13, recoil: .12, micro: .10, stability: .09, rotation: .09, targetSwitch: .09, precision: .06 }, speedBias: .025, precisionBias: .02, recoilBias: .01 },
  head:        { weights: { head: .24, tracking: .15, adhesion: .12, recoil: .14, micro: .14, stability: .11, rotation: .03, targetSwitch: .03, precision: .04 }, speedBias: -.01, precisionBias: .06, recoilBias: .03 },
  spray:       { weights: { head: .12, tracking: .15, adhesion: .10, recoil: .21, micro: .09, stability: .15, rotation: .06, targetSwitch: .06, precision: .06 }, speedBias: 0, precisionBias: .01, recoilBias: .08 },
};

export const AIM_PRIORITY_MUL: Record<AimPriority, Partial<ObjectiveWeights>> = {
  head: { head: 1.4, micro: 1.12, precision: 1.15, recoil: 1.08 },
  balanced: {},
  recoil: { recoil: 1.45, stability: 1.15 },
  precision: { precision: 1.4, micro: 1.2, stability: 1.12 },
};

export const TARGET_SPEED_MPS: Record<TargetStyle, number> = {
  static: 0.4, strafe: 3.0, fast: 5.5, mixed: 2.5,
};

export const DISTANCE_M: Record<CombatRange, number> = {
  close: 18, mid: 45, long: 120, mixed: 50,
};

export const PLAY_STYLE_BIAS: Record<PlayStyleId, {
  speed: number; precision: number; recoil: number;
}> = {
  // The supplied player calibration is already head-level focused, so
  // "headshot" is the neutral anchor rather than a second stacked modifier.
  headshot: { speed: 0, precision: 0, recoil: 0 },
  spray: { speed: 0.005, precision: 0.005, recoil: 0.05 },
  competitive: { speed: 0.02, precision: 0.015, recoil: 0.01 },
  close: { speed: 0.04, precision: -0.005, recoil: 0.015 },
  reflex: { speed: 0.045, precision: 0, recoil: 0 },
  conqueror: { speed: 0.015, precision: 0.03, recoil: 0.025 },
};

export interface FingerModel {
  engineGain: Record<EngineId, number>;
  microControl: number;
  stability: number;
}

/** Finger count models input geometry; it is not a more-fingers-is-higher rule. */
export const FINGER_MODEL: Record<FingerCount, FingerModel> = {
  2: { engineGain: { cam: 1.025, ads: 1.015, gyroCam: 0.96, gyroAds: 0.96 }, microControl: 0.94, stability: 0.95 },
  3: { engineGain: { cam: 1.015, ads: 1.01, gyroCam: 0.98, gyroAds: 0.98 }, microControl: 0.97, stability: 0.98 },
  4: { engineGain: { cam: 1.005, ads: 1.005, gyroCam: 0.99, gyroAds: 0.99 }, microControl: 0.99, stability: 0.99 },
  5: { engineGain: { cam: 1, ads: 1, gyroCam: 1, gyroAds: 1 }, microControl: 1, stability: 1 },
  6: { engineGain: { cam: 0.995, ads: 0.995, gyroCam: 1.01, gyroAds: 1.01 }, microControl: 1.03, stability: 1.03 },
};

export interface GyroModel {
  active: boolean;
  engineGain: Record<EngineId, number>;
  recoilControl: number;
  microControl: number;
}

export const GYRO_MODEL: Record<GyroMode, GyroModel> = {
  off: { active: false, engineGain: { cam: 1.045, ads: 1.04, gyroCam: 0.9, gyroAds: 0.9 }, recoilControl: 0.7, microControl: 0.85 },
  scope: { active: true, engineGain: { cam: 1.02, ads: 1.015, gyroCam: 0.97, gyroAds: 0.98 }, recoilControl: 1.08, microControl: 1.03 },
  always: { active: true, engineGain: { cam: 1, ads: 1, gyroCam: 1, gyroAds: 1 }, recoilControl: 1.18, microControl: 1.1 },
};

export interface EngineRole {
  tracking: number;
  precision: number;
  recoil: number;
  stability: number;
  rotation: number;
  baseline: number;
}

/** How strongly each control system serves each physical objective. */
export const ENGINE_ROLE: Record<EngineId, EngineRole> = {
  cam: { tracking: 1.0, precision: 1.0, recoil: 0.05, stability: 0.9, rotation: 1.0, baseline: 2.2 },
  ads: { tracking: 0.9, precision: 1.1, recoil: 0.35, stability: 1.0, rotation: 0.45, baseline: 2.0 },
  gyroCam: { tracking: 0.95, precision: 0.9, recoil: 0.78, stability: 1.05, rotation: 0.65, baseline: 1.8 },
  gyroAds: { tracking: 0.85, precision: 0.95, recoil: 1.0, stability: 1.1, rotation: 0.35, baseline: 1.7 },
};

export const OPTIMIZER = {
  minMultiplier: 0.82,
  maxMultiplier: 1.18,
  step: 0.005,
  comparisonDelta: 0.01,
  referenceFps: 120,
  referenceRefresh: 120,
  referenceTouchRate: 240,
  errorScoreDecay: 18,
} as const;
