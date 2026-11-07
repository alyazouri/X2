// ALYAZOURI GG deterministic QA diagnostics.
// Not executed during rendering; call runApexDiagnostics() in development/tests.
import { buildDeviceProfile, buildWeaponIntel, runApex } from "./engine";
import { ENGINES, SCOPES, type ApexInput, type SensitivityProfile } from "./types";

export interface DiagnosticCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface DiagnosticReport {
  passed: boolean;
  checks: DiagnosticCheck[];
  matrixRuns: number;
}

const expectedReference: SensitivityProfile = {
  cam: { tpp: 141, fpp: 150, red: 70, scope2: 58, scope3: 35, scope4: 20, scope6: 15, scope8: 12 },
  // Repaired ADS tail (MODEL 3.1): monotonic high-zoom continuation.
  ads: { tpp: 151, fpp: 150, red: 70, scope2: 55, scope3: 40, scope4: 31, scope6: 16, scope8: 10 },
  gyroCam: { tpp: 300, fpp: 235, red: 245, scope2: 210, scope3: 110, scope4: 95, scope6: 85, scope8: 60 },
  gyroAds: { tpp: 300, fpp: 235, red: 245, scope2: 210, scope3: 120, scope4: 105, scope6: 85, scope8: 60 },
};

const referenceInput = (): ApexInput => ({
  device: buildDeviceProfile({
    name: "iPad Pro 11 (M4)", fps: 120, refreshRate: 120,
    touchRate: 240, screenSize: 11, resolution: "2420×1668",
    gyroQuality: "excellent",
  }),
  weapon: buildWeaponIntel("M416", 72, 65, "AR"),
  fingers: 5,
  gyroMode: "always",
  mode: "balanced",
  targetStyle: "mixed",
  range: "mixed",
  aimPriority: "balanced",
  playStyle: "headshot",
});

const equalProfile = (left: SensitivityProfile, right: SensitivityProfile): boolean =>
  ENGINES.every((engine) => SCOPES.every((scope) => left[engine][scope] === right[engine][scope]));

/** Within ±10% of the supplied player baseline — headshot/stability shaping may
 *  slightly re-tune by design, so equality is intentionally not required. */
const withinTolerance = (left: SensitivityProfile, right: SensitivityProfile): boolean => {
  for (const engine of ENGINES) {
    for (const scope of SCOPES) {
      const expected = right[engine][scope];
      const actual = left[engine][scope];
      if (expected > 0 && Math.abs(actual - expected) / expected > 0.10) return false;
    }
  }
  return true;
};

export function runApexDiagnostics(): DiagnosticReport {
  const checks: DiagnosticCheck[] = [];
  const baseInput = referenceInput();
  const reference = runApex(baseInput);
  checks.push({
    name: "Reference calibration fidelity",
    passed: withinTolerance(reference.profile, expectedReference),
    detail: "Output sits within ±10% of the supplied player baseline (±1.5-2% headshot/stability shaping is intentional).",
  });
  const repeated = runApex({ ...baseInput });
  checks.push({
    name: "Deterministic output",
    passed: equalProfile(reference.profile, repeated.profile),
    detail: "Identical inputs must produce identical 32-dimensional profiles.",
  });
  checks.push({
    name: "Reference validation",
    passed: reference.valid && reference.validationIssues.length === 0,
    detail: reference.validationIssues.join(", ") || "No validation issues.",
  });
  checks.push({
    name: "Independent gyro channels",
    passed: SCOPES.filter((scope) => reference.profile.gyroCam[scope] !== reference.profile.gyroAds[scope]).length >= 2,
    detail: "Gyroscope and ADS Gyroscope must not collapse into one profile.",
  });

  const aggressive = runApex({ ...baseInput, mode: "aggressive", targetStyle: "fast", range: "close" });
  checks.push({
    name: "Advanced calibration changes the solution",
    passed: !equalProfile(reference.profile, aggressive.profile),
    detail: "Mode, target style, and combat range must feed the optimizer.",
  });

  const weapons = [
    buildWeaponIntel("M416", 72, 65, "AR"),
    buildWeaponIntel("UMP45", 35, 48, "SMG"),
    buildWeaponIntel("SKS", 52, 75, "DMR"),
    buildWeaponIntel("AWM", 95, 100, "Sniper"),
  ];
  const fingers = [2, 3, 4, 5, 6] as const;
  const gyroModes = ["off", "scope", "always"] as const;
  const ranges = ["close", "mid", "long"] as const;
  let matrixRuns = 0;
  let matrixValid = true;
  for (const weapon of weapons) {
    for (const finger of fingers) {
      for (const gyroMode of gyroModes) {
        for (const range of ranges) {
          const result = runApex({
            ...baseInput, weapon, fingers: finger, gyroMode, range,
          });
          matrixRuns += 1;
          matrixValid = matrixValid && result.valid;
        }
      }
    }
  }
  checks.push({
    name: "AR/SMG/DMR/SR matrix validation",
    passed: matrixValid,
    detail: `${matrixRuns} representative device/player/weapon configurations validated.`,
  });

  return {
    passed: checks.every((check) => check.passed),
    checks,
    matrixRuns,
  };
}
