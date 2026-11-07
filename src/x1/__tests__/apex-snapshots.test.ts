// ════════════════════════════════════════════════════════════════
// APEX ENGINE — GOLDEN OUTPUT SNAPSHOTS (PHASE 2 hardening).
//
// These snapshots freeze the EXACT 32-dimensional outputs of the Supreme
// APEX Engine for 12 representative configurations. Any future change that
// alters a single sensitivity value, score, or free-look number fails here —
// the constitutional "same input = same output, forever" guarantee.
// Captured under MODEL ALYAZOURI_GG_SUPREME_3.1.
// ════════════════════════════════════════════════════════════════
import { describe, expect, it } from "vitest";
import { BRANDS, WEAPONS } from "../data";
import { buildDeviceProfile, buildWeaponIntel, clearApexCache, runApex, type ApexInput } from "../apex";

const make = (deviceIdx: number, weaponIdx: number, over: Partial<ApexInput> = {}): ApexInput => {
  const d = BRANDS[0].devices[deviceIdx];
  const w = WEAPONS[0].weapons[weaponIdx];
  return {
    device: buildDeviceProfile({ name: d.name, fps: d.fps, touchRate: d.touchRate, screenSize: d.screenSize, resolution: d.resolution, gyroQuality: d.gyroQuality }),
    weapon: buildWeaponIntel(w.name, w.recoil, w.range, w.type),
    fingers: 4, gyroMode: "always", mode: "balanced", targetStyle: "mixed", range: "mixed", aimPriority: "balanced", playStyle: "headshot",
    ...over,
  };
};

/** [cam, ads, gyroCam, gyroAds] each as [tpp,fpp,red,2x,3x,4x,6x,8x], freeLook, [supreme,head,tracking,recoil] */
const SNAPS: Record<string, { p: number[][]; fl: number[]; s: number[] }> = {
  "base": {
    p: [[135, 143, 66, 54, 32, 18, 14, 11], [144, 143, 66, 51, 37, 29, 15, 9], [294, 230, 245, 212, 113, 97, 85, 60], [294, 230, 245, 212, 123, 107, 85, 60]],
    fl: [135, 132, 127], s: [100, 100, 100, 100],
  },
  "mode-aggressive": {
    p: [[136, 145, 66, 54, 32, 19, 14, 11], [145, 144, 66, 52, 37, 29, 15, 9], [296, 232, 246, 213, 113, 97, 86, 60], [296, 232, 246, 213, 124, 108, 86, 60]],
    fl: [136, 133, 128], s: [100, 100, 99, 100],
  },
  "mode-head": {
    p: [[135, 143, 65, 53, 31, 18, 14, 11], [144, 143, 65, 50, 35, 27, 15, 9], [294, 230, 250, 216, 116, 99, 86, 60], [294, 230, 250, 216, 127, 109, 86, 60]],
    fl: [135, 132, 127], s: [98, 98, 100, 99],
  },
  "mode-spray": {
    p: [[135, 143, 66, 54, 32, 18, 14, 11], [144, 143, 66, 52, 37, 29, 15, 9], [294, 230, 249, 215, 114, 97, 85, 60], [294, 232, 250, 216, 125, 108, 86, 60]],
    fl: [135, 132, 127], s: [99, 99, 99, 96],
  },
  "gyro-off": {
    p: [[141, 150, 69, 56, 34, 19, 15, 12], [150, 149, 68, 53, 38, 30, 16, 10], [265, 207, 221, 190, 101, 87, 77, 54], [265, 207, 221, 190, 111, 96, 77, 54]],
    fl: [141, 135, 130], s: [100, 100, 100, 100],
  },
  "gyro-scope": {
    p: [[137, 146, 67, 55, 33, 19, 14, 12], [146, 145, 67, 52, 37, 29, 15, 10], [285, 224, 238, 205, 109, 94, 83, 58], [288, 226, 240, 207, 121, 105, 84, 59]],
    fl: [137, 133, 127], s: [100, 100, 100, 100],
  },
  "weapon-akm": {
    p: [[136, 142, 62, 49, 27, 16, 12, 10], [142, 141, 61, 45, 29, 22, 12, 8], [298, 230, 236, 200, 96, 81, 71, 54], [300, 230, 237, 196, 107, 90, 69, 52]],
    fl: [136, 133, 128], s: [100, 100, 100, 100],
  },
  "weapon-ace32": {
    p: [[137, 143, 63, 50, 28, 16, 12, 10], [143, 142, 62, 46, 31, 24, 12, 8], [301, 230, 243, 203, 103, 87, 77, 57], [303, 231, 242, 200, 113, 96, 73, 52]],
    fl: [137, 134, 129], s: [100, 100, 100, 100],
  },
  "fingers-2": {
    p: [[137, 146, 67, 55, 33, 19, 14, 12], [146, 145, 66, 52, 37, 29, 15, 10], [285, 224, 238, 205, 109, 94, 83, 58], [285, 224, 238, 205, 119, 104, 83, 58]],
    fl: [137, 134, 129], s: [100, 100, 100, 100],
  },
  "range-long": {
    p: [[135, 143, 66, 54, 32, 18, 14, 11], [144, 143, 66, 51, 36, 28, 15, 9], [294, 230, 245, 212, 112, 96, 85, 59], [294, 230, 245, 212, 122, 107, 85, 59]],
    fl: [135, 132, 127], s: [100, 100, 100, 100],
  },
  "target-fast": {
    p: [[135, 144, 66, 54, 32, 18, 14, 11], [145, 144, 66, 52, 37, 29, 15, 9], [296, 232, 246, 213, 113, 97, 85, 60], [296, 232, 246, 213, 124, 107, 85, 60]],
    fl: [135, 132, 127], s: [100, 100, 99, 100],
  },
  "aim-precision": {
    p: [[135, 143, 65, 53, 31, 18, 14, 11], [144, 143, 65, 50, 36, 28, 15, 9], [294, 230, 247, 213, 114, 98, 85, 60], [294, 230, 248, 213, 125, 108, 85, 60]],
    fl: [135, 132, 127], s: [99, 99, 100, 100],
  },
};

const INPUTS: Record<string, ApexInput> = {
  "base": make(0, 0),
  "mode-aggressive": make(0, 0, { mode: "aggressive" }),
  "mode-head": make(0, 0, { mode: "head" }),
  "mode-spray": make(0, 0, { mode: "spray" }),
  "gyro-off": make(0, 0, { gyroMode: "off" }),
  "gyro-scope": make(0, 0, { gyroMode: "scope" }),
  "weapon-akm": make(0, 1),
  "weapon-ace32": make(0, 9),
  "fingers-2": make(0, 0, { fingers: 2 }),
  "range-long": make(0, 0, { range: "long" }),
  "target-fast": make(0, 0, { targetStyle: "fast" }),
  "aim-precision": make(0, 0, { aimPriority: "precision" }),
};

const ORDER = ["tpp", "fpp", "red", "scope2", "scope3", "scope4", "scope6", "scope8"] as const;

describe("APEX golden snapshots (determinism guarantee)", () => {
  for (const id of Object.keys(SNAPS)) {
    it(`config "${id}" matches the frozen output exactly`, () => {
      clearApexCache();
      const r = runApex(INPUTS[id]);
      const snap = SNAPS[id];
      const engines = ["cam", "ads", "gyroCam", "gyroAds"] as const;
      engines.forEach((engine, ei) => {
        ORDER.forEach((scope, si) => {
          expect(r.profile[engine][scope], `${engine}.${scope}`).toBe(snap.p[ei][si]);
        });
      });
      expect(r.freeLook.cam).toBe(snap.fl[0]);
      expect(r.freeLook.parashoot).toBe(snap.fl[1]);
      expect(r.freeLook.vehicle).toBe(snap.fl[2]);
      expect(r.scores.supreme).toBe(snap.s[0]);
      expect(r.scores.head).toBe(snap.s[1]);
      expect(r.scores.tracking).toBe(snap.s[2]);
      expect(r.scores.recoil).toBe(snap.s[3]);
      expect(r.valid).toBe(true);
      expect(r.monotonicRepairs).toBe(0);
      expect(r.candidatesEvaluated).toBe(2336);
    });
  }

  it("repeated runs are bitwise identical (cache and pure math)", () => {
    clearApexCache();
    const first = runApex(INPUTS["base"]);
    const second = runApex(INPUTS["base"]);
    expect(JSON.stringify(second.profile)).toBe(JSON.stringify(first.profile));
  });
});
