// ════════════════════════════════════════════════════════════════
// APEX ENGINE — zoom-curve invariants (regression guard).
// The MODEL 3.1 repair fixed a corrupted ADS high-zoom tail that made 6x
// turn FASTER than 4x. These tests guarantee the physical curve:
// higher magnification must never produce a higher sensitivity.
// ════════════════════════════════════════════════════════════════
import { describe, expect, it } from "vitest";
import { BRANDS, WEAPONS } from "../data";
import { buildDeviceProfile, buildWeaponIntel, runApex, type ApexInput, type SensitivityProfile } from "../apex";
import { ENGINES } from "../apex";

const SCOPED_LANE = ["red", "scope2", "scope3", "scope4", "scope6", "scope8"] as const;

function makeInput(over: Partial<ApexInput>, deviceIdx: number, weaponIdx: number): ApexInput {
  const d = BRANDS[0].devices[deviceIdx];
  const w = WEAPONS[0].weapons[weaponIdx];
  const base: ApexInput = {
    device: buildDeviceProfile({ name: d.name, fps: d.fps, touchRate: d.touchRate, screenSize: d.screenSize, resolution: d.resolution, gyroQuality: d.gyroQuality }),
    weapon: buildWeaponIntel(w.name, w.recoil, w.range, w.type),
    fingers: 4, gyroMode: "always", mode: "balanced", targetStyle: "mixed", range: "mixed", aimPriority: "balanced", playStyle: "headshot",
  };
  return { ...base, ...over };
}

const laneOf = (profile: SensitivityProfile, engine: (typeof ENGINES)[number]) =>
  SCOPED_LANE.map((s) => profile[engine][s]);

const isMonotonic = (seq: number[]) => seq.every((v, i) => i === 0 || v <= seq[i - 1]);

describe("APEX zoom-curve invariants", () => {
  it("every engine's red→8x curve is non-increasing (default config)", () => {
    const result = runApex(makeInput({}, 0, 0));
    expect(result.valid).toBe(true);
    expect(result.monotonicRepairs).toBe(0);
    for (const engine of ENGINES) {
      expect(isMonotonic(laneOf(result.profile, engine)), `${engine} curve violated`).toBe(true);
    }
  });

  it("ADS high-zoom tail stays monotonic across modes, gyro modes and weapons", () => {
    const modes = ["aggressive", "balanced", "control", "precision", "competitive", "head", "spray"] as const;
    const gyros = ["off", "scope", "always"] as const;
    const weapons = [0, 2, 5, 9]; // AR / SMG / DMR / Sniper spread
    for (const mode of modes) {
      for (const gyro of gyros) {
        for (const wi of weapons) {
          const result = runApex(makeInput({ mode, gyroMode: gyro }, 0, wi));
          expect(result.valid).toBe(true);
          for (const engine of ENGINES) {
            expect(
              isMonotonic(laneOf(result.profile, engine)),
              `${mode}/${gyro}/weapon#${wi}/${engine} violated: ${laneOf(result.profile, engine).join(",")}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it("performance: objective targets are reused (search still evaluates 73 candidates per dimension)", () => {
    const result = runApex(makeInput({}, 0, 0));
    expect(result.candidatesEvaluated).toBe(2336); // 32 dims × 73 candidates
  });
});
