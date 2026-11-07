// Real RTT statistics — pure aggregation regression tests.
import { describe, expect, it } from "vitest";
import { calculateRttStats } from "../network-rtt";

describe("calculateRttStats", () => {
  it("computes average, median, consecutive-delta jitter and loss", () => {
    expect(calculateRttStats([10, 20, 15], 4)).toEqual({
      samples: [10, 20, 15], average: 15, median: 15, jitter: 7.5, loss: 25, attempts: 4,
    });
  });
  it("does not invent jitter from one sample", () => {
    expect(calculateRttStats([42.25], 3)).toEqual({
      samples: [42.3], average: 42.3, median: 42.3, jitter: null, loss: 67, attempts: 3,
    });
  });
  it("represents total failure honestly", () => {
    expect(calculateRttStats([], 5)).toEqual({
      samples: [], average: null, median: null, jitter: null, loss: 100, attempts: 5,
    });
  });
  it("filters invalid samples", () => {
    const r = calculateRttStats([10, Number.NaN, -5, Number.POSITIVE_INFINITY, 20], 5);
    expect(r.samples).toEqual([10, 20]);
    expect(r.loss).toBe(60);
    expect(r.jitter).toBe(10);
  });
});
