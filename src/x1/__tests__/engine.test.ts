// ════════════════════════════════════════════════════════════════
// Golden regression tests for the sensitivity engines.
// Values were captured from the shipped engine itself — any drift in the
// math (rounding, clamp order, factors) fails the suite.
// ════════════════════════════════════════════════════════════════
import { describe, expect, it } from "vitest";
import { BRANDS, WEAPONS } from "../data";
import { computeSensitivity } from "../sensitivity";
import {
  apexCacheSize, buildDeviceProfile, buildWeaponIntel,
  clearApexCache, runApex, runApexDiagnostics,
} from "../apex";
import { applyFineTune, DEFAULT_FINE_TUNE, isDefaultFineTune, snapshotOf } from "../SensitivityLab";

const APPLE = BRANDS[0];
const IPHONE_16_PM = APPLE.devices[0]; // iPhone 16 Pro Max · 120fps · 240Hz
const M416 = WEAPONS[0].weapons[0];    // M416 · AR

const baseParams = {
  deviceId: IPHONE_16_PM.name,
  device: IPHONE_16_PM,
  brandId: APPLE.id,
  fingers: 4,
  styleId: "headshot",
  gyroMode: "always" as const,
  weaponId: M416.name,
  weaponName: M416.name,
  weaponRecoil: M416.recoil,
  weaponRange: M416.range,
  weaponType: M416.type,
};

describe("computeSensitivity — golden profile", () => {
  it("matches the pinned golden values (iPhone 16 Pro Max · M416 · headshot · 4F · gyro always)", () => {
    const sens = computeSensitivity(baseParams);
    expect(sens.cam).toEqual({ tpp: 136, fpp: 115, red: 53, scope2: 37, scope3: 27, scope4: 20, scope6: 12, scope8: 8 });
    expect(sens.ads).toEqual({ tpp: 122, fpp: 103, red: 48, scope2: 35, scope3: 27, scope4: 20, scope6: 11, scope8: 7 });
    expect(sens.gyroCam).toEqual({ tpp: 269, fpp: 244, red: 279, scope2: 249, scope3: 220, scope4: 176, scope6: 97, scope8: 54 });
    expect(sens.gyroAds).toEqual({ tpp: 262, fpp: 238, red: 283, scope2: 257, scope3: 222, scope4: 183, scope6: 104, scope8: 59 });
    expect(sens.freeLook).toEqual({ cam: 103, parashoot: 99, vehicle: 95 });
    expect(sens.aiScore).toBe(99);
    expect(sens.factors.deviceFactor).toBeCloseTo(0.9504, 4);
    expect(sens.factors.fingerFactor).toBe(1);
    expect(sens.factors.styleFactor).toBe(0.97);
    expect(sens.factors.weaponFactor).toBe(0.97);
  });

  it("is deterministic", () => {
    const a = computeSensitivity(baseParams);
    const b = computeSensitivity(baseParams);
    expect(a).toEqual(b);
  });
});

describe("computeSensitivity — full catalogue invariants", () => {
  it("every device × weapon combination stays inside game bounds", () => {
    for (const brand of BRANDS) {
      for (const device of brand.devices) {
        for (const cat of WEAPONS) {
          for (const weapon of cat.weapons) {
            const sens = computeSensitivity({
              deviceId: device.name, device, brandId: brand.id,
              fingers: 4, styleId: "headshot", gyroMode: "always",
              weaponId: weapon.name, weaponName: weapon.name,
              weaponRecoil: weapon.recoil, weaponRange: weapon.range, weaponType: weapon.type,
            });
            for (const table of [sens.cam, sens.ads]) {
              for (const v of Object.values(table)) {
                expect(v).toBeGreaterThanOrEqual(1);
                expect(v).toBeLessThanOrEqual(300);
              }
            }
            for (const table of [sens.gyroCam, sens.gyroAds]) {
              for (const v of Object.values(table)) {
                expect(v).toBeGreaterThanOrEqual(1);
                expect(v).toBeLessThanOrEqual(400);
              }
            }
            for (const v of Object.values(sens.freeLook)) {
              expect(v).toBeGreaterThanOrEqual(1);
              expect(v).toBeLessThanOrEqual(300);
            }
            expect(sens.aiScore).toBeGreaterThanOrEqual(58);
            expect(sens.aiScore).toBeLessThanOrEqual(99);
          }
        }
      }
    }
  });
});

describe("APEX engine — golden run", () => {
  const input = () => ({
    device: buildDeviceProfile({
      name: IPHONE_16_PM.name, fps: IPHONE_16_PM.fps, touchRate: IPHONE_16_PM.touchRate,
      screenSize: IPHONE_16_PM.screenSize, resolution: IPHONE_16_PM.resolution,
      gyroQuality: IPHONE_16_PM.gyroQuality,
    }),
    weapon: buildWeaponIntel(M416.name, M416.recoil, M416.range, M416.type),
    fingers: 4 as const,
    gyroMode: "always" as const,
    mode: "balanced" as const,
    targetStyle: "mixed" as const,
    range: "mixed" as const,
    aimPriority: "balanced" as const,
    playStyle: "headshot" as const,
  });

  it("matches the pinned golden optimization", () => {
    clearApexCache();
    const result = runApex(input());
    expect(result.valid).toBe(true);
    expect(result.scores.supreme).toBe(100);
    expect(result.profile.cam).toEqual({ tpp: 135, fpp: 143, red: 66, scope2: 54, scope3: 32, scope4: 18, scope6: 14, scope8: 11 });
    expect(result.freeLook).toEqual({ cam: 135, parashoot: 132, vehicle: 127 });
    expect(result.inputLagMs).toBeCloseTo(12.5, 1);
    expect(result.candidatesEvaluated).toBe(2336);
  });

  it("is cached by fingerprint and deterministic", () => {
    clearApexCache();
    expect(apexCacheSize()).toBe(0);
    const a = runApex(input());
    expect(apexCacheSize()).toBe(1);
    const b = runApex(input());
    expect(apexCacheSize()).toBe(1); // cache hit, no new entry
    expect(a.profile).toEqual(b.profile);
    expect(a.scores).toEqual(b.scores);
  });

  it("diagnostics pass on the bundled model", () => {
    const report = runApexDiagnostics();
    expect(report.passed).toBe(true);
  });
});

describe("Sensitivity Lab — fine-tune transform", () => {
  const sens = computeSensitivity(baseParams);

  it("default fine-tune is the identity (engines stay authoritative)", () => {
    expect(isDefaultFineTune(DEFAULT_FINE_TUNE)).toBe(true);
    expect(applyFineTune(sens, DEFAULT_FINE_TUNE)).toBe(sens);
  });

  it("scales every scope of one engine and leaves the others untouched", () => {
    const tuned = applyFineTune(sens, { ...DEFAULT_FINE_TUNE, cam: 110 });
    expect(tuned.cam.tpp).toBe(Math.min(300, Math.round(sens.cam.tpp * 1.1)));
    expect(tuned.cam.scope8).toBe(Math.min(300, Math.round(sens.cam.scope8 * 1.1)));
    expect(tuned.ads).toEqual(sens.ads);
    expect(tuned.gyroCam).toEqual(sens.gyroCam);
    expect(tuned.aiScore).toBe(sens.aiScore);
  });

  it("clamps camera/ADS to 300 and gyro to 400, never below 1", () => {
    const up = applyFineTune(sens, { cam: 150, ads: 150, gyroCam: 150, gyroAds: 150 });
    for (const table of [up.cam, up.ads]) {
      for (const v of Object.values(table)) expect(v).toBeLessThanOrEqual(300);
    }
    for (const table of [up.gyroCam, up.gyroAds]) {
      for (const v of Object.values(table)) expect(v).toBeLessThanOrEqual(400);
    }
    const down = applyFineTune(sens, { cam: 50, ads: 50, gyroCam: 50, gyroAds: 50 });
    for (const table of [down.cam, down.ads, down.gyroCam, down.gyroAds]) {
      for (const v of Object.values(table)) expect(v).toBeGreaterThanOrEqual(1);
    }
  });

  it("snapshot captures all four tables + free look for compare/restore", () => {
    const snap = snapshotOf(sens);
    expect(snap.cam).toEqual(sens.cam);
    expect(snap.ads).toEqual(sens.ads);
    expect(snap.gyroCam).toEqual(sens.gyroCam);
    expect(snap.gyroAds).toEqual(sens.gyroAds);
    expect(snap.freeLook).toEqual(sens.freeLook);
  });
});
