// ════════════════════════════════════════════════════════════════
// SECURITY LAYER TESTS — Zod request schemas + rate limiter.
// ════════════════════════════════════════════════════════════════
import { describe, expect, it } from "vitest";
import {
  evidenceInputSchema, profileInputSchema, ratingInputSchema, scanInputSchema,
} from "../validation";
import { createRateLimiter } from "../rate-limit";

describe("ratingInputSchema", () => {
  it("accepts a valid rating", () => {
    const r = ratingInputSchema.safeParse({ rating: 5, comment: "great" });
    expect(r.success).toBe(true);
  });
  it("rejects out-of-range ratings", () => {
    for (const rating of [0, 6, -1, 3.5, "5", null]) {
      expect(ratingInputSchema.safeParse({ rating }).success).toBe(false);
    }
  });
  it("rejects oversized comments (500 char bound)", () => {
    expect(ratingInputSchema.safeParse({ rating: 3, comment: "x".repeat(501) }).success).toBe(false);
    expect(ratingInputSchema.safeParse({ rating: 3, comment: "x".repeat(500) }).success).toBe(true);
  });
  it("defaults comment to empty string", () => {
    const r = ratingInputSchema.safeParse({ rating: 4 });
    expect(r.success && r.data.comment).toBe("");
  });
});

describe("profileInputSchema", () => {
  const valid = {
    id: "123", name: "iPhone · M416", device: "iPhone 16 Pro Max",
    weapon: "M416", aiScore: 99, savedAt: 1700000000000,
  };
  it("accepts a valid profile", () => {
    expect(profileInputSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects empty id / negative savedAt / score > 100", () => {
    expect(profileInputSchema.safeParse({ ...valid, id: "" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...valid, savedAt: -5 }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...valid, aiScore: 101 }).success).toBe(false);
  });
  it("bounds text field lengths", () => {
    expect(profileInputSchema.safeParse({ ...valid, name: "x".repeat(121) }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...valid, device: "x".repeat(81) }).success).toBe(false);
  });
});

describe("evidenceInputSchema", () => {
  const row = { host: "178.20.185.28", port: 8080, status: "WORKING", evidence: "PROXY_CONNECT_OK", connectMs: 180 };
  it("accepts valid strong evidence rows (max 10)", () => {
    expect(evidenceInputSchema.safeParse({ rows: [row] }).success).toBe(true);
    expect(evidenceInputSchema.safeParse({ rows: Array.from({ length: 10 }, () => row) }).success).toBe(true);
  });
  it("rejects: 11 rows, weak status, non-IPv4 host, bad port", () => {
    expect(evidenceInputSchema.safeParse({ rows: Array.from({ length: 11 }, () => row) }).success).toBe(false);
    expect(evidenceInputSchema.safeParse({ rows: [{ ...row, status: "FAILED" }] }).success).toBe(false);
    expect(evidenceInputSchema.safeParse({ rows: [{ ...row, host: "not.an.ip.addr" }] }).success).toBe(false);
    expect(evidenceInputSchema.safeParse({ rows: [{ ...row, host: "8.8.8.8" }] }).success).toBe(true); // valid IPv4 form
    expect(evidenceInputSchema.safeParse({ rows: [{ ...row, port: 70000 }] }).success).toBe(false);
  });
});

describe("scanInputSchema", () => {
  it("accepts up to 220 endpoints", () => {
    const endpoints = Array.from({ length: 220 }, (_, i) => ({ host: `178.20.185.${(i % 254) + 1}`, port: 53 }));
    expect(scanInputSchema.safeParse({ endpoints }).success).toBe(true);
  });
  it("rejects > 220 endpoints and malformed ports", () => {
    const many = Array.from({ length: 221 }, (_, i) => ({ host: `178.20.${i % 255}.${i % 254}`, port: 53 }));
    expect(scanInputSchema.safeParse({ endpoints: many }).success).toBe(false);
    expect(scanInputSchema.safeParse({ endpoints: [{ host: "1.2.3.4", port: 0 }] }).success).toBe(false);
    expect(scanInputSchema.safeParse({ endpoints: [{ host: "1.2.3.4", port: 1.5 }] }).success).toBe(false);
  });
  it("bounds jitter sampling rounds to 1..5 and keeps it optional", () => {
    const ep = [{ host: "178.20.185.5", port: 53 }];
    expect(scanInputSchema.safeParse({ endpoints: ep }).success).toBe(true); // optional
    expect(scanInputSchema.safeParse({ endpoints: ep, rounds: 1 }).success).toBe(true);
    expect(scanInputSchema.safeParse({ endpoints: ep, rounds: 3 }).success).toBe(true);
    expect(scanInputSchema.safeParse({ endpoints: ep, rounds: 5 }).success).toBe(true);
    expect(scanInputSchema.safeParse({ endpoints: ep, rounds: 0 }).success).toBe(false);
    expect(scanInputSchema.safeParse({ endpoints: ep, rounds: 6 }).success).toBe(false);
    expect(scanInputSchema.safeParse({ endpoints: ep, rounds: 2.5 }).success).toBe(false);
  });
});

describe("createRateLimiter", () => {
  it("allows up to max, then blocks with retry window", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.limit("a").ok).toBe(true);
    expect(limiter.limit("a").ok).toBe(true);
    const third = limiter.limit("a");
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = limiter.limit("a");
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });
  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.limit("x").ok).toBe(true);
    expect(limiter.limit("y").ok).toBe(true);
    expect(limiter.limit("x").ok).toBe(false);
  });
  it("resets after the window expires", async () => {
    const limiter = createRateLimiter({ windowMs: 25, max: 1 });
    expect(limiter.limit("z").ok).toBe(true);
    expect(limiter.limit("z").ok).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(limiter.limit("z").ok).toBe(true);
  });
});
