// Shared scan-result store so independent analyzers can cooperate
// (e.g. DNS ↔ Proxy matching) without prop drilling or global app state.
import type { DnsAnalysis } from "./types";

let latest: DnsAnalysis | null = null;
let updatedAt = 0;

export const dnsScanStore = {
  set(analysis: DnsAnalysis): void { latest = analysis; updatedAt = Date.now(); },
  get(): DnsAnalysis | null { return latest; },
  ageMs(): number { return updatedAt ? Date.now() - updatedAt : Infinity; },
  clear(): void { latest = null; updatedAt = 0; },
};
