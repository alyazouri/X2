import { describe, expect, it } from "vitest";
import { buildDeviceProfile, buildWeaponIntel, runApex } from "../apex";
import { applyPrimeZones, DEFAULT_PRIME_ZONES, isDefaultPrime, type PrimeZones } from "../prime-sens";
import { BRANDS, WEAPONS } from "../data";

const lanes = ["tpp","fpp","red","scope2","scope3","scope4","scope6","scope8"] as const;
const scoped = ["red","scope2","scope3","scope4","scope6","scope8"] as const;
function baseApex() {
  const d = BRANDS[0].devices[0];
  const w = WEAPONS[0].weapons[0];
  return runApex({
    device: buildDeviceProfile({ name: d.name, fps: d.fps, touchRate: d.touchRate, screenSize: d.screenSize, resolution: d.resolution, gyroQuality: d.gyroQuality }),
    weapon: buildWeaponIntel(w.name, w.recoil, w.range, w.type),
    fingers: 4, gyroMode: "always", mode: "balanced", targetStyle: "mixed", range: "mixed", aimPriority: "balanced", playStyle: "headshot",
  });
}

describe("PrimeZones", () => {
  it("is a no-op at defaults", () => {
    expect(isDefaultPrime(DEFAULT_PRIME_ZONES)).toBe(true);
    expect(applyPrimeZones(baseApex().profile, DEFAULT_PRIME_ZONES)).toEqual(baseApex().profile);
  });
  it("quickTurn raises only TPP/FPP and keeps scoped structures stable", () => {
    const apex = baseApex();
    const out = applyPrimeZones(apex.profile, { ...DEFAULT_PRIME_ZONES, quickTurn: 100 });
    expect(out.cam.tpp).toBeGreaterThanOrEqual(apex.profile.cam.tpp);
    expect(out.cam.fpp).toBeGreaterThanOrEqual(apex.profile.cam.fpp);
    expect(out.cam.red).toBeLessThanOrEqual(apex.profile.cam.red);
    expect(out.cam.scope8).toBeLessThanOrEqual(apex.profile.cam.scope6);
  });
  it("holdHead lowers or keeps high-zoom touch sensitivity predictably (never raises it)", () => {
    const apex = baseApex();
    const out = applyPrimeZones(apex.profile, { ...DEFAULT_PRIME_ZONES, holdHead: 100 });
    expect(out.cam.scope4).toBeLessThanOrEqual(apex.profile.cam.scope4);
    expect(out.cam.scope6).toBeLessThanOrEqual(apex.profile.cam.scope6);
    expect(out.cam.scope8).toBeLessThanOrEqual(apex.profile.cam.scope8);
    expect(out.cam.tpp).toBe(apex.profile.cam.tpp);
  });
  it("never leaves scope bounds and never defeats the zoom hierarchy", () => {
    const apex = baseApex();
    const out = applyPrimeZones(apex.profile, { quickTurn:100,flicks:25,tracking:50,closeKick:75,holdHead:100,midField:100,snipeCalm:100,farSpin:100 });
    for (const engine of Object.keys(out) as (keyof typeof out)[]) {
      const lane = out[engine];
      expect(lane.tpp).toBeGreaterThanOrEqual(1);
      expect(lane.scope8).toBeLessThanOrEqual(400);
      for (let i=1;i<scoped.length;i++) {
        expect(lane[scoped[i]]).toBeLessThanOrEqual(lane[scoped[i-1]]);
      }
    }
  });
  it("internal consistency: fields + bounds + monotonicity all hold after any intent mix", () => {
    const apex = baseApex();
    const variants: PrimeZones[] = [
      DEFAULT_PRIME_ZONES,
      { ...DEFAULT_PRIME_ZONES, quickTurn: 100 },
      { ...DEFAULT_PRIME_ZONES, closeKick: 100 },
      { ...DEFAULT_PRIME_ZONES, holdHead: 100 },
      { ...DEFAULT_PRIME_ZONES, midField: 100 },
      { ...DEFAULT_PRIME_ZONES, snipeCalm: 50 },
      { ...DEFAULT_PRIME_ZONES, farSpin: 0 },
      { ...DEFAULT_PRIME_ZONES, flicks: 100, holdHead: -100 },
    ];
    for (const zones of variants) {
      const out = applyPrimeZones(apex.profile, zones);
      for (const engine of Object.keys(out) as (keyof typeof out)[]) {
        const lane = out[engine];
        expect(lane.tpp).toBeGreaterThanOrEqual(1);
        expect(lane.tpp).toBeLessThanOrEqual(400);
        for (let i=1;i<scoped.length;i++) {
          expect(lane[scoped[i]]).toBeLessThanOrEqual(lane[scoped[i-1]]);
        }
      }
      expect(Object.keys(out)).toEqual(Object.keys(apex.profile));
    }
  });
});
