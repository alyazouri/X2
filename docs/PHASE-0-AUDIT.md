# PHASE 0 — DISCOVERY & AUDIT REPORT

```
Project   : ALYAZOURI 2026 — PUBG Mobile Sensitivity Optimizer
Governance: CONSTITUTION.md v1.0
Scope     : Audit only — ZERO code changes (per PHASE 0 acceptance criteria)
Method    : Every fact below was measured from the repository, not estimated
```

---

## 1. BASELINE QUALITY GATES (measured at audit time)

| Gate | Command | Result |
|---|---|---|
| Type generation | `npx next typegen` | ✅ Types generated successfully |
| TypeScript | `npm exec tsc -- --noEmit` | ✅ 0 errors |
| ESLint | `npx eslint .` | ✅ 0 errors, 0 warnings |
| Tests | `npm exec vitest run` | ✅ 34/34 (4 files) |
| Build | `npm run build` | ✅ 5 API routes + static pages |

**Conclusion**: the platform currently passes every global quality gate.
All subsequent phases must preserve this baseline.

---

## 2. CODEBASE INVENTORY (measured)

Total TypeScript volume: **13,904 lines** across `src/`.

| Domain | Lines | Status |
|---|---|---|
| `src/x1/net` (Network Intelligence) | 2,833 | Live (NetworkCenter, RegionRouter, CheckHost, copy) + legacy |
| `src/x1/apex` (APEX Engine) | 2,096 | Live — sacred |
| `src/x1/dns` (DNS platform) | 1,577 | dataset.ts live · analyzer/engine legacy |
| `src/x1/proxy` (Proxy platform) | 1,397 | pool.ts live · analyzers legacy |
| `src/app/api` (Route handlers) | 564 | Live |
| `src/x1` root modules | 17 files | Live (App, ui, sensitivity, Lab, i18n…) |
| `src/x1/__tests__` | 314 | Live |
| `src/lib` + tests | 343 | Live (validation, rate-limit) |
| `src/x1/geo` + `network` | 307 | Live |
| `src/db` | 132 | Live (lazy bootstrap) |

### Complexity hotspots (largest files)
| File | Lines | Risk |
|---|---|---|
| `src/x1/ui.tsx` | 1,018 | God-module: PingMonitor + Share/QR + Rating + Hero + StatusBar |
| `src/x1/net/NetworkCenter.tsx` | 1,007 | God-module: scan orchestration + 3 tabs + rendering |
| `src/x1/App.tsx` | 777 | Composition root + MusicPlayer + share import |
| `src/x1/dns/DnsAnalyzer.tsx` | 593 | Legacy (unwired) |
| `src/x1/proxy/ProxyAnalyzer.tsx` | 584 | Legacy (unwired) |

### Legacy cluster (historical — preserved by constitution)
**3,386 lines** compile but are NOT connected to the live UI graph:
`DnsAnalyzer` · `ProxyAnalyzer` · `DeviceAgentPanel` · `proxy/engine` · `proxy/match` ·
`proxy/deviceAgent` · `proxy/serverScanner` · `net/controller` · `net/stats` ·
`net/EvidenceDrawer` · `net/components` · `dns/engine` · `dns/routeModel` · `apex/feedback`.
Cross-references verified: they import ONLY each other. Constitution rule
"never remove historical modules" applies — they stay, type-checked.

---

## 3. ARCHITECTURE AUDIT

### Current structure vs. constitution's preferred layers
```
Preferred               Current state                         Gap
─────────────────────────────────────────────────────────────────────────
domain/                 src/x1/apex, sensitivity.tsx           Naming only
features/               src/x1/net, dns, proxy, geo, network   Naming only
services/               src/app/api (route handlers)           Thin — logic inline
repositories/           src/db (schema + lazy pool)            No repository abstraction
lib/                    src/lib (validation, rate-limit)       ✅ Present
ui/                     src/x1/ui.tsx (monolith)               Needs split
hooks/                  scattered (useNetwork, useGeolocation) Needs consolidation
config/                 next.config.ts, netlify.toml           ✅ Present
```

### Coupling findings (measured via import graph)
- Most-imported: `./types` (24) · `LanguageContext` (18 across paths) · `i18n` (9) — healthy hubs.
- **App.tsx is the composition root** importing ~15 modules — acceptable for a root,
  but MusicPlayer (60+ lines) lives inside it.
- **ui.tsx exports 15+ components** — the single largest reuse surface and the
  primary split candidate (PHASE 1).
- No circular imports detected (import graph is a DAG).

### Layering violations found
1. Route handlers contain SQL strings inline (no repository layer) — minor, 5 routes.
2. `NetworkCenter.tsx` mixes orchestration, derivation, and presentation (3 concerns).
3. Client business logic (share-code codec) lives in `ui.tsx` instead of `lib/`.

---

## 4. TECHNICAL DEBT REGISTER

| ID | Item | Severity | Evidence | Phase |
|---|---|---|---|---|
| TD-01 | `ui.tsx` god-module (1,018 lines, 15+ exports) | Medium | wc -l | P1 |
| TD-02 | `NetworkCenter.tsx` 3-concern monolith (1,007 lines) | Medium | import graph | P1/P4 |
| TD-03 | `vitest` in `dependencies` (should be devDependency) | Low | package.json | P1 |
| TD-04 | `clsx` + `tailwind-merge` imported only by unwired `cn.ts` | Low | grep — zero importers | P1 (decision) |
| TD-05 | Version pinning inconsistency (pinned vs ^) across deps | Low | package.json | P1 |
| TD-06 | `window as any` in App.tsx MusicPlayer (1 occurrence) | Low | grep | P1 |
| TD-07 | No APEX output snapshots across the config space (only 84 configs probed) | Medium | test inventory | P2 |
| TD-08 | Constitution targets cold <15ms / cached <3ms; measured cold ≈20ms | Medium | benchmark test | P2/P5 |
| TD-09 | Rate limiter is per-instance (serverless limitation) | Medium (documented) | rate-limit.ts | P14 |
| TD-10 | No observability (metrics/tracing/error tracking) | Medium | — | P8 |
| TD-11 | No CI/CD pipeline definition in repo | Medium | — | P13 |
| TD-12 | No OpenAPI documentation for the 5 APIs | Low | — | P14 |
| TD-13 | No Lighthouse baseline (P5 requires ≥95/100/2s/200ms) | Medium | — | P5 |
| TD-14 | npm audit reports transitive vulnerabilities (dev tooling) | Low | npm audit | P6 |
| TD-15 | Legacy cluster (3,386 lines) compiles unwired — maintenance cost | Accepted | constitution rule | — (keep) |

---

## 5. RISK MATRIX

Likelihood: L(ow)/M(edium)/H(igh) · Impact: 1–5

| ID | Risk | L | I | Score | Mitigation | Owner phase |
|---|---|---|---|---|---|---|
| R-01 | Regression in APEX outputs during refactor | M | 5 | 🔴 10 | Golden snapshots BEFORE any change (P2 gates P1 engine touches) | P2 |
| R-02 | White-screen recurrence via header/CSP edits | M | 5 | 🔴 10 | Constitution §10-6 rule: browser-verify any header change | Every |
| R-03 | Scan hang recurrence on slow platforms | L | 4 | 🟠 6 | 3-level deadlines already in place; P4 adds unified harness | P4 |
| R-04 | Breaking DB contract without migration | L | 5 | 🟠 7 | drizzle-kit push flow + schema-only changes via review checklist | P7 |
| R-05 | Rate limiter bypass via multiple serverless instances | M | 2 | 🟡 4 | Accepted until Redis (P14); limits still absorb bursts | P14 |
| R-06 | God-file splits introducing UI regressions | M | 3 | 🟡 6 | Splits are move-only (no logic change) + full gate run | P1 |
| R-07 | Dependency supply-chain (transitive vulns) | L | 3 | 🟢 3 | P6 audit; runtime deps are minimal and mainstream | P6 |
| R-08 | check-host.net unavailability degrades ping/region | M | 2 | 🟡 4 | Honest degradation already implemented; P4 adds more fallbacks | P4 |
| R-09 | Losing determinism via accidental memo/cache change | L | 5 | 🟠 7 | Fingerprint cache + determinism tests are regression guards | P2 |
| R-10 | Phase sequencing violation (skipping) | L | 4 | 🟠 4 | This document + CONSTITUTION.md gate every phase | All |

---

## 6. DEPENDENCY ANALYSIS (measured)

### Runtime dependencies (11)
| Package | Version | Used by | Verdict |
|---|---|---|---|
| next | 16.2.6 | framework | ✅ Keep |
| react / react-dom | 19.2.6 | framework | ✅ Keep |
| pg + drizzle-orm + dotenv | 8.20.0 / 0.45.2 / 17.3.1 | db layer | ✅ Keep |
| zod | ^4.6.5 | src/lib/validation.ts (all 5 APIs) | ✅ Keep |
| @netlify/plugin-nextjs | ^5.16.1 | deployment | ✅ Keep |
| vitest | ^5.0.3 | tests ONLY | ⚠️ Move to devDependencies (TD-03) |
| clsx + tailwind-merge | ^2.1.1 / ^3.4.0 | only unwired cn.ts | ⚠️ Decision item (TD-04) |

### Dev dependencies (9)
All justified: tailwind toolchain (4), typescript (2×), eslint (2), drizzle-kit.

### Decisions recorded
- **vitest → devDependencies**: safe (no runtime import), reduces serverless bundle surface.
- **clsx/tailwind-merge**: cn.ts is a historical module → keep packages while the module
  exists (constitution: never remove historical modules). Revisit if cn.ts is ever relocated.
- No missing dependencies. No duplicate functionality. No abandoned packages.

---

## 7. INCIDENT LEDGER STATUS
All 8 documented incidents (`PROJECT_PROMPT.md` §10) have permanent fixes verified
in the current codebase: lazy DB, concurrency 200, no NETLIFY early-exit, region
state machine, ADS monotonicity repair, CSP/frame fixes, dual-shape node parser,
music retry cap. **No open incidents.**

---

## 8. PHASE 0 ACCEPTANCE CHECKLIST

| Criterion | Status | Evidence |
|---|---|---|
| Architecture audited | ✅ | §3 above |
| Technical debt documented | ✅ | §4 — 15 items, ID'd and phased |
| Risk matrix created | ✅ | §5 — 10 risks scored |
| Dependency analysis completed | ✅ | §6 — all 20 packages verdicted |
| No code changes | ✅ | This phase created only CONSTITUTION.md + this document |
| Global quality gates green | ✅ | §1 — measured at audit time |

**PHASE 0: COMPLETE. Ready to proceed to PHASE 1 upon approval.**

---

## 9. RECOMMENDED NEXT STEP (PHASE 1 preview — approval required)

Move-only refactor (zero logic changes), in this order:
1. `vitest` → devDependencies (1 line, gates re-run).
2. Split `ui.tsx` → `src/x1/ui/` (PingMonitor, ShareQR, Rating, Hero, StatusBar, primitives)
   keeping the existing `./ui` barrel import so **no consumer changes**.
3. Extract share-code codec → `src/lib/share-code.ts` (+ tests).
4. Typed `Window` interface for the YouTube player (removes the only `any`).
5. Update PROJECT_PROMPT.md structure section.

Each step ends with the full mandatory validation pipeline.
