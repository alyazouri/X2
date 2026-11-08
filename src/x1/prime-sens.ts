// ═════════════════════════════════════════════════════════════════════════
// PRIME ENGINE — deterministic APEX zone intents, explainable and bounded.
// This layer rides canonical Apex outputs and reshapes them only within
// game bounds, product bounds, and scope hierarchy rules. Nothing invents
// a score, and no lane rises after a higher-tier lane.
// ══════════════════════════════════════════════════════════════════════════
import type { EngineId, ScopeId, SensitivityProfile } from "./apex";
import { BOUNDS, ENGINES, SCOPES } from "./apex";

const noZoneValue = 50;
const SCOPED: ScopeId[] = ["red", "scope2", "scope3", "scope4", "scope6", "scope8"];

export type PrimeZones = {
  quickTurn: number;
  flicks: number;
  tracking: number;
  closeKick: number;
  holdHead: number;
  midField: number;
  snipeCalm: number;
  farSpin: number;
};

export const DEFAULT_PRIME_ZONES: PrimeZones = {
  quickTurn: noZoneValue,
  flicks: noZoneValue,
  tracking: noZoneValue,
  closeKick: noZoneValue,
  holdHead: noZoneValue,
  midField: noZoneValue,
  snipeCalm: noZoneValue,
  farSpin: noZoneValue,
};

function norm(v: number): number { return (v - noZoneValue) / noZoneValue; }
function toBoundary(engine: EngineId, v: number): number {
  const max = engine === "cam" || engine === "ads" ? BOUNDS.cam.max : BOUNDS.gyro.max;
  const min = engine === "cam" || engine === "ads" ? BOUNDS.cam.min : BOUNDS.gyro.min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function applyPrimeZones(base: SensitivityProfile, zones: PrimeZones): SensitivityProfile {
  const out: SensitivityProfile = { cam: { ...base.cam }, ads: { ...base.ads }, gyroCam: { ...base.gyroCam }, gyroAds: { ...base.gyroAds } };

  const turn = norm(zones.quickTurn);
  const flick = norm(zones.flicks);
  const track = norm(zones.tracking);
  const kick = norm(zones.closeKick);
  const head = norm(zones.holdHead);
  const mid = norm(zones.midField);
  const calm = norm(zones.snipeCalm);
  const spin = norm(zones.farSpin);

  for (const engine of ENGINES) {
    for (const scope of SCOPES) {
      let value = out[engine][scope];
      const gyro = engine === "gyroCam" || engine === "gyroAds";
      const scoped = scope !== "tpp" && scope !== "fpp";
      const high = scope === "scope6" || scope === "scope8";
      const closeZone = scope === "red" || scope === "scope2";

      if (!scoped) {
        value = adjust(value, turn, gyro ? 0.022 : 0.018);
        value = adjust(value, flick, gyro ? 0.02 : 0.016);
        value = adjust(value, kick, gyro ? 0.018 : 0.016);
      } else {
        if (closeZone) {
          value = adjust(value, kick, gyro ? 0.02 : 0.016);
          value = adjust(value, head, gyro ? -0.014 : -0.012);
        }
        value = adjust(value, head, gyro ? -0.02 : -0.018);
        value = adjust(value, mid, gyro ? -0.012 : -0.01);
        if (scope === "scope4" || scope === "scope6") value = adjust(value, spin, gyro ? 0.008 : 0.007);
        if (high) value = adjust(value, calm, gyro ? -0.025 : -0.02);
        if (scope === "scope8") value = adjust(value, spin, gyro ? 0.008 : 0.01);
      }

      out[engine][scope] = toBoundary(engine, value);
    }
  }

  // Monotonic zoom hierarchy: each scoped lane never exceeds the one below.
  for (const engine of ENGINES) {
    const lane = out[engine];
    for (let i = 1; i < SCOPED.length; i += 1) {
      if (lane[SCOPED[i]] > lane[SCOPED[i - 1]]) lane[SCOPED[i]] = lane[SCOPED[i - 1]];
    }
  }

  return out;
}

function adjust(base: number, intent: number, mult: number): number {
  if (intent === 0) return base;
  return base * (1 + intent * mult);
}

export function isDefaultPrime(zones: PrimeZones): boolean {
  return Object.values(zones).every((v) => v === noZoneValue);
}
