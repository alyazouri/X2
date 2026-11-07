// ════════════════════════════════════════════════════════════════
// BASE SENSITIVITY ENGINE — GOLDEN DATASET (PHASE 3).
//
// Frozen outputs of computeSensitivity() across a representative matrix of
// devices × weapons × fingers × styles × gyro modes. Together with the
// full-catalogue bounds test (engine.test.ts) this guarantees the calibration
// can never drift silently: any coefficient change shows up here first.
// Captured 2026 · model state at capture time.
// ════════════════════════════════════════════════════════════════
import { describe, expect, it } from "vitest";
import { BRANDS, WEAPONS } from "../data";
import { computeSensitivity, type GyroMode } from "../sensitivity";

/** [tpp, fpp, red, 2x, 3x, 4x, 6x, 8x] */
type Vec = [number, number, number, number, number, number, number, number];
interface Golden {
  device: [number, number];
  weapon: [number, number];
  fingers: number;
  style: string;
  gyro: GyroMode;
  cam: Vec; ads: Vec; gyroCam: Vec; gyroAds: Vec;
  freeLook: [number, number, number];
  ai: number;
}

const GOLDEN: Record<string, Golden> = {
  "iPhone 16 Pro Max · M416 · 4F · headshot · gyro always": {
    device: [0, 0], weapon: [0, 0], fingers: 4, style: "headshot", gyro: "always",
    cam: [136, 115, 53, 37, 27, 20, 12, 8],
    ads: [122, 103, 48, 35, 27, 20, 11, 7],
    gyroCam: [269, 244, 279, 249, 220, 176, 97, 54],
    gyroAds: [262, 238, 283, 257, 222, 183, 104, 59],
    freeLook: [103, 99, 95], ai: 99,
  },
  "iPhone 16 Pro Max · AKM · 3F · spray · gyro scope": {
    device: [0, 0], weapon: [0, 1], fingers: 3, style: "spray", gyro: "scope",
    cam: [156, 129, 54, 35, 23, 19, 11, 7],
    ads: [135, 114, 47, 33, 22, 17, 9, 7],
    gyroCam: [276, 247, 277, 242, 193, 151, 83, 51],
    gyroAds: [269, 240, 280, 244, 199, 158, 87, 53],
    freeLook: [105, 101, 97], ai: 93,
  },
  "iPhone 16 Pro Max · ACE32 · 6F · competitive · gyro off": {
    device: [0, 0], weapon: [0, 9], fingers: 6, style: "competitive", gyro: "off",
    cam: [145, 120, 51, 34, 23, 17, 10, 7],
    ads: [125, 106, 45, 31, 22, 16, 9, 6],
    gyroCam: [259, 230, 261, 225, 188, 149, 82, 48],
    gyroAds: [254, 224, 262, 229, 192, 154, 84, 48],
    freeLook: [99, 95, 91], ai: 92,
  },
  "Galaxy S25 Ultra · M416 · 4F · headshot · gyro always": {
    device: [1, 0], weapon: [0, 0], fingers: 4, style: "headshot", gyro: "always",
    cam: [136, 115, 53, 37, 27, 20, 12, 8],
    ads: [122, 103, 48, 35, 27, 20, 11, 7],
    gyroCam: [269, 244, 279, 249, 220, 176, 97, 54],
    gyroAds: [262, 238, 283, 257, 222, 183, 104, 59],
    freeLook: [103, 99, 95], ai: 99,
  },
  "iPad Pro 13 (M4) · M416 · 5F · conqueror · gyro always": {
    device: [0, 17], weapon: [0, 0], fingers: 5, style: "conqueror", gyro: "always",
    cam: [148, 125, 58, 40, 29, 22, 13, 9],
    ads: [132, 112, 52, 38, 29, 22, 12, 8],
    gyroCam: [281, 254, 290, 259, 229, 183, 101, 57],
    gyroAds: [273, 247, 294, 268, 232, 190, 108, 62],
    freeLook: [110, 106, 102], ai: 99,
  },
  "iPhone 16 Pro Max · M416 · 2F · close · gyro scope": {
    device: [0, 0], weapon: [0, 0], fingers: 2, style: "close", gyro: "scope",
    cam: [158, 134, 59, 41, 29, 22, 14, 9],
    ads: [141, 120, 53, 39, 29, 22, 12, 8],
    gyroCam: [278, 252, 287, 257, 226, 181, 100, 56],
    gyroAds: [270, 245, 291, 265, 229, 188, 107, 61],
    freeLook: [107, 103, 99], ai: 93,
  },
};

const KEYS = ["tpp", "fpp", "red", "scope2", "scope3", "scope4", "scope6", "scope8"] as const;
const toObj = (v: Vec) => Object.fromEntries(KEYS.map((k, i) => [k, v[i]]));

describe("base sensitivity engine — golden dataset", () => {
  for (const [name, g] of Object.entries(GOLDEN)) {
    it(name, () => {
      const brand = BRANDS[g.device[0]];
      const device = brand.devices[g.device[1]];
      const weapon = WEAPONS[g.weapon[0]].weapons[g.weapon[1]];
      const s = computeSensitivity({
        deviceId: device.name, device, brandId: brand.id,
        fingers: g.fingers, styleId: g.style, gyroMode: g.gyro,
        weaponId: weapon.name, weaponName: weapon.name,
        weaponRecoil: weapon.recoil, weaponRange: weapon.range, weaponType: weapon.type,
      });
      expect(s.cam).toEqual(toObj(g.cam));
      expect(s.ads).toEqual(toObj(g.ads));
      expect(s.gyroCam).toEqual(toObj(g.gyroCam));
      expect(s.gyroAds).toEqual(toObj(g.gyroAds));
      expect(s.freeLook).toEqual({ cam: g.freeLook[0], parashoot: g.freeLook[1], vehicle: g.freeLook[2] });
      expect(s.aiScore).toBe(g.ai);
    });
  }

  it("is deterministic across repeated calls", () => {
    const brand = BRANDS[0];
    const device = brand.devices[0];
    const weapon = WEAPONS[0].weapons[0];
    const params = {
      deviceId: device.name, device, brandId: brand.id,
      fingers: 4, styleId: "headshot", gyroMode: "always" as GyroMode,
      weaponId: weapon.name, weaponName: weapon.name,
      weaponRecoil: weapon.recoil, weaponRange: weapon.range, weaponType: weapon.type,
    };
    expect(computeSensitivity(params)).toEqual(computeSensitivity(params));
  });
});
