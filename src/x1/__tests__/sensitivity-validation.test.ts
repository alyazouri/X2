// Base sensitivity engine validation + relationship regression tests.
import { describe, expect, it } from "vitest";
import { BRANDS, WEAPONS, STYLES } from "../data";
import {
  assertSensitivityParams, computeSensitivity, sensitivityIssues,
  type GyroMode, type Sens, type SensParams,
} from "../sensitivity";

function params(): SensParams {
  const brand = BRANDS[0];
  const device = brand.devices[0];
  const weapon = WEAPONS[0].weapons[0];
  return {
    deviceId: device.name, device, brandId: brand.id,
    fingers: 4, styleId: "headshot", gyroMode: "always",
    weaponId: weapon.name, weaponName: weapon.name,
    weaponRecoil: weapon.recoil, weaponRange: weapon.range, weaponType: weapon.type,
  };
}

function cloneSens(s: Sens): Sens {
  return JSON.parse(JSON.stringify(s)) as Sens;
}

describe("assertSensitivityParams", () => {
  it("accepts the canonical input", () => {
    expect(() => assertSensitivityParams(params())).not.toThrow();
  });
  it("rejects invalid physical device data instead of guessing", () => {
    const p = params();
    expect(() => assertSensitivityParams({ ...p, device: { ...p.device, fps: 0 } })).toThrow(/device\.fps/);
    expect(() => assertSensitivityParams({ ...p, device: { ...p.device, touchRate: -1 } })).toThrow(/device\.touchRate/);
    expect(() => assertSensitivityParams({ ...p, device: { ...p.device, screenSize: 0 } })).toThrow(/device\.screenSize/);
    expect(() => assertSensitivityParams({ ...p, device: { ...p.device, resolution: "unknown" } })).toThrow(/device\.resolution/);
  });
  it("rejects invalid player configuration", () => {
    const p = params();
    expect(() => assertSensitivityParams({ ...p, fingers: 7 })).toThrow(/fingers/);
    expect(() => assertSensitivityParams({ ...p, styleId: "magic" })).toThrow(/styleId/);
    expect(() => assertSensitivityParams({ ...p, gyroMode: "half" as GyroMode })).toThrow(/gyroMode/);
  });
  it("rejects invalid weapon metadata", () => {
    const p = params();
    expect(() => assertSensitivityParams({ ...p, weaponRecoil: 101 })).toThrow(/weaponRecoil/);
    expect(() => assertSensitivityParams({ ...p, weaponRange: -1 })).toThrow(/weaponRange/);
  });
});

describe("sensitivityIssues", () => {
  const valid = computeSensitivity(params());
  it("finds no issue in canonical output", () => {
    expect(sensitivityIssues(valid)).toEqual([]);
  });
  it("detects bounds, rising zoom curve, free-look and score violations", () => {
    const broken = cloneSens(valid);
    broken.cam.tpp = 301;
    broken.ads.scope4 = 10;
    broken.ads.scope6 = 20;
    broken.freeLook.vehicle = 200;
    broken.aiScore = 101;
    const issues = sensitivityIssues(broken).join(" | ");
    expect(issues).toMatch(/cam\.tpp: out of bounds/);
    expect(issues).toMatch(/ads\.scope6: zoom curve rises/);
    expect(issues).toMatch(/freeLook/);
    expect(issues).toMatch(/aiScore/);
  });
});

describe("full catalog relationships", () => {
  it("all 77×48 devices/weapons stay valid in all 3 gyro modes", () => {
    const modes: GyroMode[] = ["off", "scope", "always"];
    let runs = 0;
    for (const brand of BRANDS) for (const device of brand.devices) {
      for (const cat of WEAPONS) for (const weapon of cat.weapons) {
        for (const gyroMode of modes) {
          const s = computeSensitivity({
            deviceId: device.name, device, brandId: brand.id,
            fingers: 4, styleId: "headshot", gyroMode,
            weaponId: weapon.name, weaponName: weapon.name,
            weaponRecoil: weapon.recoil, weaponRange: weapon.range, weaponType: weapon.type,
          });
          expect(sensitivityIssues(s), `${device.name}/${weapon.name}/${gyroMode}`).toEqual([]);
          runs += 1;
        }
      }
    }
    expect(runs).toBe(77 * 48 * 3);
  });
  it("all styles and finger geometries remain valid on representative hardware", () => {
    const brand = BRANDS[0], device = brand.devices[0], weapon = WEAPONS[0].weapons[0];
    for (const style of STYLES) for (const fingers of [2, 3, 4, 5, 6]) {
      const s = computeSensitivity({
        deviceId: device.name, device, brandId: brand.id,
        fingers, styleId: style.id, gyroMode: "always",
        weaponId: weapon.name, weaponName: weapon.name,
        weaponRecoil: weapon.recoil, weaponRange: weapon.range, weaponType: weapon.type,
      });
      expect(sensitivityIssues(s), `${style.id}/${fingers}F`).toEqual([]);
    }
  });
});
