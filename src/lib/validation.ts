// ════════════════════════════════════════════════════════════════
// SHARED REQUEST VALIDATION (Zod) — single source of truth for every
// public API input. All route handlers parse with these schemas, so
// malformed, oversized or hostile payloads are rejected before touching
// the database or the network scanner.
// ════════════════════════════════════════════════════════════════
import { z } from "zod";

/** IPv4 literal — the only host form the scanner and evidence store accept. */
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** Ports the scanner is allowed to touch (mirrors the edge probe allow-list). */
export const SCANNABLE_PORTS = [53, 80, 443, 853, 1080, 8080, 8888, 10010, 20001, 20002] as const;

/** Endpoint statuses worth sharing with the community (successful evidence only). */
const STRONG_STATUSES = ["WORKING", "PARTIAL", "REACHABLE"] as const;

/* ── POST /api/ratings ─────────────────────────────────────── */
export const ratingInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().default(""),
});
export type RatingInput = z.infer<typeof ratingInputSchema>;

/* ── POST /api/profiles ────────────────────────────────────── */
export const profileInputSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  device: z.string().min(1).max(80),
  weapon: z.string().min(1).max(80),
  aiScore: z.number().min(0).max(100),
  savedAt: z.number().positive(),
  /** Opaque sensitivity snapshot; size-capped below at the serialization level. */
  payload: z.unknown().optional(),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

/** Snapshot payload bound (protects the jsonb column from oversized writes). */
export const MAX_PROFILE_PAYLOAD_BYTES = 4000;

/* ── POST /api/proxy-evidence ──────────────────────────────── */
export const evidenceRowSchema = z.object({
  host: z.string().regex(IPV4_RE).max(15),
  port: z.number().int().min(1).max(65535),
  status: z.enum(STRONG_STATUSES),
  evidence: z.string().max(80).optional().default(""),
  source: z.string().max(40).optional().default("BROWSER"),
  connectMs: z.number().min(0).max(60000).nullable().optional(),
});
export const evidenceInputSchema = z.object({
  rows: z.array(evidenceRowSchema).min(1).max(10),
});
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;

/* ── POST /api/proxy-scan ──────────────────────────────────── */
export const scanEndpointSchema = z.object({
  host: z.string().min(7).max(64),
  port: z.number().int().min(1).max(65535),
});
export const scanInputSchema = z.object({
  endpoints: z.array(scanEndpointSchema).max(220),
  /** Sampling rounds per endpoint for real jitter measurement (1–5). */
  rounds: z.number().int().min(1).max(5).optional(),
});
export type ScanInput = z.infer<typeof scanInputSchema>;

/** Compact JSON error body for rejected inputs (no internal details leak). */
export function zodErrorBody(issueCount: number) {
  return { ok: false as const, error: "INVALID_BODY", issues: issueCount };
}
