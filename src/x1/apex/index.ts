// ════════════════════════════════════════════════════════════════
// ALYAZOURI GG — APEX ENGINE · Public API
// Internal ID: alyazouri-gg · Tier: SUPREME · Game: PUBG MOBILE GLOBAL
// ════════════════════════════════════════════════════════════════
export * from "./types";
export {
  applyPrimeZones,
  DEFAULT_PRIME_ZONES,
  isDefaultPrime,
  type PrimeZones,
} from "../prime-sens";
export * from "./constants";
export {
  runApex, clearApexCache, apexCacheSize, fingerprint,
  buildDeviceProfile, buildWeaponIntel, apexToScopeSens, assertApexInput,
} from "./engine";
export { runApexDiagnostics } from "./diagnostics";
export type { OptimizationResult, ApexInput, OptimizationScore, ScopePerformance, EngineScopeMatrix, ExplanationItem, ObjectiveWeights } from "./types";

/** Profile registration (Phase 02). */
export const ALYAZOURI_GG_PROFILE = {
  id: "alyazouri-gg",
  name: "ALYAZOURI GG",
  category: "PRO PROFILE",
  tier: "SUPREME",
  engine: "ALYAZOURI_GG_APEX_ENGINE",
  game: "PUBG MOBILE GLOBAL",
  status: "AVAILABLE",
} as const;
