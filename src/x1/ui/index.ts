// ════════════════════════════════════════════════════════════════
// UI BARREL — PHASE 1 move-only refactor.
// The former ui.tsx monolith (1,019 lines, 20 exports) is split into
// single-concern modules. Every export keeps its name and behavior, so
// existing `from "./ui"` imports resolve here unchanged.
// ════════════════════════════════════════════════════════════════
export * from "./core";     // RevealSection, SectionHeader, NightModeToggle, SensitivityTable…
export * from "./share";    // CopyButton, ShareButton, AIPredictions + share-codec re-exports
export * from "./rating";   // RatingSection
export * from "./status";   // StatusBar, DPICalculator
export * from "./ping";     // PingMonitor
export * from "./hero";     // AuroraMark, JordanFlag, Hero, PWABanner, QuickSearch
