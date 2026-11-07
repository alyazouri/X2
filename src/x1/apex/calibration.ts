// ALYAZOURI GG calibration layer.
// The values below are a single measured player reference, not final presets.
// Every selected weapon keeps its own 32-value profile; the reference only
// transfers the player's response style dimension-by-dimension.
import { getWeaponProfile } from "../weaponProfiles";
import { ENGINES, SCOPES, type EngineId, type ScopeId, type ScopeSens, type SensitivityProfile } from "./types";

export const MODEL_VERSION = "ALYAZOURI_GG_SUPREME_3.1";

export const REFERENCE_DEVICE = {
  name: "iPad Pro 11 (M4)",
  fps: 120,
  refreshRate: 120,
  touchRate: 240,
  touchLatencyMs: 1000 / 240,
  screenSize: 11,
  resolution: "2420×1668",
  ppi: Math.sqrt(2420 ** 2 + 1668 ** 2) / 11,
  aspectRatio: 2420 / 1668,
  gyroQuality: "excellent" as const,
};

export const REFERENCE_FINGERS = 5;

/** Measured player reference.
 *  REPAIR (3.1): the ADS high-zoom tail was corrupted — 6x (22) sat ABOVE
 *  4x (18), producing transfer coefficients {0.78, 1.83, 2.13} that diverged
 *  from the smooth {1.14…1.38} curve of the other dimensions and made the
 *  generated ADS curve violate monotonicity (6x > 4x is wrong in PUBG Mobile:
 *  higher zoom must never turn faster). The tail is restored as the smooth,
 *  monotonic continuation of the measured curve. */
const PLAYER_REFERENCE: SensitivityProfile = {
  cam: { tpp: 141, fpp: 150, red: 70, scope2: 58, scope3: 35, scope4: 20, scope6: 15, scope8: 12 },
  ads: { tpp: 151, fpp: 150, red: 70, scope2: 55, scope3: 40, scope4: 31, scope6: 16, scope8: 10 },
  gyroCam: { tpp: 300, fpp: 235, red: 245, scope2: 210, scope3: 110, scope4: 95, scope6: 85, scope8: 60 },
  gyroAds: { tpp: 300, fpp: 235, red: 245, scope2: 210, scope3: 120, scope4: 105, scope6: 85, scope8: 60 },
};

// M416 is the measured calibration weapon supplied by the player.
const M416_REFERENCE = getWeaponProfile("M416", 72, 65, "AR");
const profileArray = (engine: EngineId): number[] =>
  engine === "cam" ? M416_REFERENCE.cam :
  engine === "ads" ? M416_REFERENCE.ads :
  engine === "gyroCam" ? M416_REFERENCE.gyro : M416_REFERENCE.gyroAds;

/** Derive transfer coefficients at runtime from measured/reference values. */
export function calibrationCoefficients(): Record<EngineId, ScopeSens> {
  const result = {} as Record<EngineId, ScopeSens>;
  for (const engine of ENGINES) {
    const source = profileArray(engine);
    const values = {} as ScopeSens;
    SCOPES.forEach((scope, index) => {
      values[scope] = PLAYER_REFERENCE[engine][scope] / source[index];
    });
    result[engine] = values;
  }
  return result;
}

export const CALIBRATION_COEFFICIENTS = calibrationCoefficients();

export const scopeIndex = (scope: ScopeId): number => SCOPES.indexOf(scope);

export const emptyProfile = (): SensitivityProfile => ({
  cam: {} as ScopeSens,
  ads: {} as ScopeSens,
  gyroCam: {} as ScopeSens,
  gyroAds: {} as ScopeSens,
});
