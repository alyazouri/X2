// ════════════════════════════════════════════════════════════════
// ALYAZOURI GG — APEX ENGINE · Strict Type Layer
// Internal ID: alyazouri-gg · Engine: ALYAZOURI_GG_APEX_ENGINE
// ════════════════════════════════════════════════════════════════

/** The 8 independent scope dimensions (TPP/FPP are separated problems). */
export type ScopeId =
  | "tpp" | "fpp" | "red" | "scope2" | "scope3" | "scope4" | "scope6" | "scope8";

/** The 4 independent control systems. */
export type EngineId = "cam" | "ads" | "gyroCam" | "gyroAds";

export type GyroMode = "off" | "scope" | "always";
export type FingerCount = 2 | 3 | 4 | 5 | 6;
export type CombatRange = "close" | "mid" | "long" | "mixed";
export type TargetStyle = "static" | "strafe" | "fast" | "mixed";
export type AimPriority = "head" | "balanced" | "recoil" | "precision";
export type PlayStyleId = "headshot" | "spray" | "competitive" | "close" | "reflex" | "conqueror";

/** ALYAZOURI GG profile modes — each re-weights optimization objectives. */
export type GGModeId =
  | "aggressive" | "balanced" | "control" | "precision"
  | "competitive" | "head" | "spray";

export const SCOPES: ScopeId[] = ["tpp", "fpp", "red", "scope2", "scope3", "scope4", "scope6", "scope8"];
export const ENGINES: EngineId[] = ["cam", "ads", "gyroCam", "gyroAds"];

/** A full per-scope sensitivity vector (8 independent values). */
export type ScopeSens = Record<ScopeId, number>;

/** A complete sensitivity profile = 4 engines × 8 scopes = 32 dimensions. */
export interface SensitivityProfile {
  cam: ScopeSens;
  ads: ScopeSens;
  gyroCam: ScopeSens;
  gyroAds: ScopeSens;
}

/** Multi-objective weight set used by the scalarized Pareto selection. */
export interface ObjectiveWeights {
  head: number;
  tracking: number;
  adhesion: number;
  recoil: number;
  micro: number;
  stability: number;
  rotation: number;
  targetSwitch: number;
  precision: number;
}

export type ObjectiveKey = keyof ObjectiveWeights;
export const OBJECTIVE_KEYS: ObjectiveKey[] = [
  "head", "tracking", "adhesion", "recoil", "micro", "stability", "rotation", "targetSwitch", "precision",
];

/** Final quality scores (0–100) plus the aggregate SUPREME score. */
export interface OptimizationScore extends ObjectiveWeights {
  supreme: number;
}

/** Per-scope overall performance (0–100) for each of the 8 scopes. */
export type ScopePerformance = Record<ScopeId, number>;

/** Detailed per-engine × per-scope performance (0–100). */
export type EngineScopeMatrix = Record<EngineId, ScopePerformance>;

/** Device fingerprint + response model. */
export interface DeviceProfile {
  name: string;
  fps: number;
  /** Best available panel refresh estimate; falls back to the declared game FPS. */
  refreshRate: number;
  touchRate: number;
  /** Sampling interval derived from touchRate, in milliseconds. */
  touchLatencyMs: number;
  screenSize: number;
  resolution: string;
  ppi: number;
  aspectRatio: number;
  gyroQuality: "excellent" | "good" | "average";
}

/** Weapon intelligence payload (sourced from the existing weapon database). */
export interface WeaponIntel {
  name: string;
  type: string;
  recoil: number;       // game-feel rating 0–100
  range: number;        // game-feel rating 0–100
  fireRate: number;     // rounds per minute
  verticalRecoil: number;   // 0–100
  horizontalRecoil: number; // 0–100
  adsSpeed: number;     // 0–100
}

/** A single contributor explanation line. */
export interface ExplanationItem {
  label: string;
  detail: string;
  impact: "boost" | "reduce" | "stabilize" | "tune";
}

/** Forward-model error components measured during simulation (lower = better). */
export interface MeasuredErrors {
  tracking: number;
  overshoot: number;
  undershoot: number;
  microShake: number;
  aimDrift: number;
  recoil: number;
  response: number;
  total: number;
}

/** Why a value was chosen: which factor moved it and by how much. */
export interface FactorAttribution {
  factor: string;
  label: string;
  deltaPct: number;       // average sensitivity shift caused by this factor (%)
  direction: "up" | "down" | "neutral";
}

/** Reliability of the discovered solution. */
export interface ConfidenceInfo {
  score: number;          // 0–100
  level: "low" | "medium" | "high";
  margin: number;         // optimality sharpness (higher = more certain)
  richness: number;       // 0–1 input-data richness
  iterations: number;     // calibration loop iterations performed
}

/** Free-look sensitivity (camera / parachute / vehicle). */
export interface FreeLook { cam: number; parashoot: number; vehicle: number; }

/** Optimized adjustment multiplier per engine × scope. */
export type GProfile = Record<EngineId, Record<ScopeId, number>>;

/** The full validated result of one ALYAZOURI GG optimization run. */
export interface OptimizationResult {
  id: "alyazouri-gg";
  engine: "ALYAZOURI_GG_APEX_ENGINE";
  tier: "SUPREME";
  game: "PUBG MOBILE GLOBAL";
  profile: SensitivityProfile;
  scores: OptimizationScore;
  scopePerformance: ScopePerformance;
  engineScope: EngineScopeMatrix;
  explanations: ExplanationItem[];
  fingerprint: string;
  totalAimError: number;
  valid: boolean;
  candidatesEvaluated: number;
  /** Recoil-compensation factor applied to the gyro channel (1.0 = none, higher = more pull-down). */
  recoilCompFactor: number;
  /** True when the run is tuned for head-level precision + maximum stability. */
  headLevelOptimized: boolean;
  /** How many scoped values were clamped to keep the zoom curve monotonic (0 = clean). */
  monotonicRepairs: number;
  // ── dynamic adaptation diagnostics (all derived from math, not random) ──
  /** Combined input latency (frame interval + touch interval) in ms. */
  inputLagMs: number;
  /** 0–100 micro-aim steadiness score (higher = steadier crosshair). */
  microShakeIndex: number;
  /** 0–100 head-level stability (vertical crosshair hold during spray). */
  headLevelStability: number;
  /** 0–100 tracking stability against target speed. */
  trackingStability: number;
  /** 0–100 scope stability (high-zoom steadiness). */
  scopeStability: number;
  // ── Supreme Engine: forward-model outputs ──
  /** Error components measured by the forward aim model at the optimum. */
  errors: MeasuredErrors;
  /** Per-factor attribution explaining the discovered solution. */
  attribution: FactorAttribution[];
  /** Confidence/reliability of the solution. */
  confidence: ConfidenceInfo;
  /** Free-look values discovered by the model. */
  freeLook: FreeLook;
  /** True only after real player feedback has refined this fingerprint. */
  learned: boolean;
  /** Optimized adjustment multipliers per engine × scope. */
  gProfile: GProfile;
  /** Exact engine revision used to build/cache this result. */
  modelVersion: string;
  /** Human-readable validation failures. Empty when valid. */
  validationIssues: string[];
  /** Factors consumed by the legacy-compatible FactorsPanel bridge. */
  modelFactors: {
    device: number;
    fingers: number;
    calibration: number;
    recoil: number;
  };
}

/** Inputs required to run the engine. */
export interface ApexInput {
  device: DeviceProfile;
  weapon: WeaponIntel;
  fingers: FingerCount;
  gyroMode: GyroMode;
  mode: GGModeId;
  targetStyle: TargetStyle;
  range: CombatRange;
  aimPriority: AimPriority;
  playStyle: PlayStyleId;
}

/** Hard value bounds (PUBG Mobile legitimate ranges). */
export const BOUNDS = {
  cam: { min: 1, max: 300 },
  ads: { min: 1, max: 300 },
  gyro: { min: 1, max: 400 },
} as const;
