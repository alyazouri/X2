// Player-density projection — pure model regression tests.
import { describe, expect, it } from "vitest";
import { JORDAN_HOURLY_DENSITY, playerDensityEstimate } from "../player-density";

describe("playerDensityEstimate", () => {
  it("peaks at the canonical Jordan evening window", () => {
    const peak = playerDensityEstimate({ hour: 23, historicalReliability: 100, measuredJitter: 0 });
    expect(peak).toBe(100);
  });
  it("is minimal at night hours", () => {
    const low = playerDensityEstimate({ hour: 4 });
    expect(low).toBeLessThan(20);
  });
  it("stays bounded 0–100 for every hour", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const v = playerDensityEstimate({ hour });
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
  it("never exceeds the hourly base when penalties are unknown", () => {
    const base = JORDAN_HOURLY_DENSITY[23];
    expect(playerDensityEstimate({ hour: 23 })).toBeLessThanOrEqual(base);
  });
  it("applies documented reliability adjustment", () => {
    const with100 = playerDensityEstimate({ hour: 23, historicalReliability: 100, measuredJitter: 0 });
    const with97 = playerDensityEstimate({ hour: 23, historicalReliability: 97, measuredJitter: 0 });
    expect(with100).toBeGreaterThanOrEqual(with97);
  });
  it("real jitter reduces the estimate as documented", () => {
    const calm = playerDensityEstimate({ hour: 23, measuredJitter: 0 });
    const shaky = playerDensityEstimate({ hour: 23, measuredJitter: 60 });
    expect(calm).toBeGreaterThan(shaky);
  });
});
