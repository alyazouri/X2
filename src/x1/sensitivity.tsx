import { useLang } from "./LanguageContext";
import { t, type TranslationKey } from "./i18n";
import { getWeaponProfile } from "./weaponProfiles";
import { PRO_PROFILES } from "./data";

// ─── Sensitivity value object: [TPP, FPP, Red/Holo, 2x, 3x, 4x, 6x, 8x] ───
// PUBG Mobile Global exposes Red Dot + Holographic + Aim Assist as one shared
// sensitivity field in the game settings. `red` intentionally represents that
// shared control — creating a separate Holographic number would be fake.
export type SensObj = {
  tpp: number; fpp: number; red: number;
  scope2: number; scope3: number; scope4: number; scope6: number; scope8: number;
};

const SENS_MAX = 300;
const GYRO_MAX = 400;
const SENS_MIN = 1;

export type Sens = {
  cam: SensObj; ads: SensObj; gyroCam: SensObj; gyroAds: SensObj;
  freeLook: { cam: number; parashoot: number; vehicle: number };
  aiScore: number;
  factors: {
    fps: number; touchRate: number; screenSize: number; gyroQuality: string;
    /** Computed physical pixel density from the selected device catalogue. */
    ppi: number;
    /** Composite factors used by the final equations. */
    deviceFactor: number; fingerFactor: number; styleFactor: number; weaponFactor: number;
    /** Explainable sub-factors (no hidden modifiers). */
    fpsFactor: number; touchFactor: number; screenFactor: number; ppiFactor: number;
    gyroQualityFactor: number; scopedStyleFactor: number; gyroStyleFactor: number;
    gyroOffBoost: number; horizontalGyroCompensation: number; superPowerFactor: number;
  };
};

export type GyroMode = "off" | "scope" | "always";

export type SensParams = {
  deviceId: string;
  device: { name: string; fps: number; touchRate: number; screenSize: number; resolution: string; gyroQuality: "excellent" | "good" | "average"; };
  brandId: string; fingers: number; styleId: string; gyroMode: GyroMode;
  weaponId: string; weaponName: string; weaponRecoil: number; weaponRange: number; weaponType: string;
  proProfile?: string;
  isSuperPower?: boolean; // Super Power toggle
};

// clamp helpers
const cl = (n: number, min = SENS_MIN, max = SENS_MAX) => Math.max(min, Math.min(max, Math.round(n)));
const cg = (n: number) => Math.max(SENS_MIN, Math.min(GYRO_MAX, Math.round(n)));

const VALID_FINGERS = new Set([2, 3, 4, 5, 6]);
const VALID_STYLES = new Set(["headshot", "spray", "competitive", "close", "reflex", "conqueror"]);
const VALID_GYRO_MODES = new Set<GyroMode>(["off", "scope", "always"]);
const SCOPED_KEYS: (keyof SensObj)[] = ["red", "scope2", "scope3", "scope4", "scope6", "scope8"];

/** Fail fast on invalid physical/config inputs — never substitute guessed data. */
export function assertSensitivityParams(p: SensParams): void {
  const fail = (field: string, detail: string): never => {
    throw new Error(`SENS_INVALID_INPUT: ${field} — ${detail}`);
  };
  if (!p?.device) fail("device", "device profile is required");
  if (!p.device.name) fail("device.name", "required");
  if (!Number.isFinite(p.device.fps) || p.device.fps <= 0) fail("device.fps", "must be positive");
  if (!Number.isFinite(p.device.touchRate) || p.device.touchRate <= 0) fail("device.touchRate", "must be positive");
  if (!Number.isFinite(p.device.screenSize) || p.device.screenSize <= 0) fail("device.screenSize", "must be positive");
  if (!/^(\d+)[×x](\d+)$/.test(p.device.resolution)) fail("device.resolution", "must be WIDTH×HEIGHT");
  if (!VALID_FINGERS.has(p.fingers)) fail("fingers", "must be 2, 3, 4, 5, or 6");
  if (!VALID_STYLES.has(p.styleId)) fail("styleId", `unsupported style ${p.styleId}`);
  if (!VALID_GYRO_MODES.has(p.gyroMode)) fail("gyroMode", `unsupported mode ${p.gyroMode}`);
  if (!p.weaponName) fail("weaponName", "required");
  if (!Number.isFinite(p.weaponRecoil) || p.weaponRecoil < 0 || p.weaponRecoil > 100) fail("weaponRecoil", "must be 0–100");
  if (!Number.isFinite(p.weaponRange) || p.weaponRange < 0 || p.weaponRange > 100) fail("weaponRange", "must be 0–100");
}

/** Validate final game bounds + physical zoom relationships. */
export function sensitivityIssues(sens: Sens): string[] {
  const issues: string[] = [];
  for (const [engine, table, max] of [
    ["cam", sens.cam, SENS_MAX],
    ["ads", sens.ads, SENS_MAX],
    ["gyroCam", sens.gyroCam, GYRO_MAX],
    ["gyroAds", sens.gyroAds, GYRO_MAX],
  ] as const) {
    for (const [scope, value] of Object.entries(table)) {
      if (!Number.isInteger(value) || value < SENS_MIN || value > max) issues.push(`${engine}.${scope}: out of bounds`);
    }
    for (let i = 1; i < SCOPED_KEYS.length; i += 1) {
      if (table[SCOPED_KEYS[i]] > table[SCOPED_KEYS[i - 1]]) {
        issues.push(`${engine}.${String(SCOPED_KEYS[i])}: zoom curve rises`);
      }
    }
  }
  for (const [key, value] of Object.entries(sens.freeLook)) {
    if (!Number.isInteger(value) || value < SENS_MIN || value > SENS_MAX) issues.push(`freeLook.${key}: out of bounds`);
  }
  if (!(sens.freeLook.cam >= sens.freeLook.parashoot && sens.freeLook.parashoot >= sens.freeLook.vehicle)) {
    issues.push("freeLook: camera/parachute/vehicle relationship violated");
  }
  if (!Number.isInteger(sens.aiScore) || sens.aiScore < 58 || sens.aiScore > 99) issues.push("aiScore: out of bounds");
  return issues;
}

// ════════════════════════════════════════════════════════════════
// PROFESSIONAL SENSITIVITY ENGINE — ALYAZOURI 2026
// 1. Each weapon has a REAL calibrated profile (32 values)
// 2. Device adjustments are TINY (±2-6%) to preserve accuracy
// 3. Recoil-aware gyro: high-recoil → more gyro compensation on scopes
// 4. PPI-aware: higher pixel density → finer control → slightly lower sens
// 5. Headshot precision: competitive/conqueror → lower scope sens
// 6. Long-range stability: 3x-8x get extra stability for high-recoil weapons
// ════════════════════════════════════════════════════════════════
export function computeSensitivity(p: SensParams): Sens {
  assertSensitivityParams(p);
  const wp = getWeaponProfile(p.weaponName, p.weaponRecoil, p.weaponRange, p.weaponType);
  const { fps, touchRate: touch, screenSize: screen, gyroQuality: gyroQ, resolution } = p.device;

  // PPI calculation — resolution shape was validated above; no guessed fallback.
  const rm = resolution.match(/(\d+)[×x](\d+)/)!;
  const resW = +rm[1];
  const resH = +rm[2];
  const ppi = Math.sqrt(resW * resW + resH * resH) / screen;

  // ▬▬▬▬ DEVICE FACTOR (tiny adjustments ±2-6%) ▬▬▬▬
  const fpsF = fps >= 165 ? 0.96 : fps >= 144 ? 0.98 : fps >= 120 ? 1.0 : fps >= 90 ? 1.03 : 1.05;
  const touchF = touch >= 960 ? 0.97 : touch >= 720 ? 0.98 : touch >= 480 ? 0.99 : touch >= 240 ? 1.0 : 1.02;
  const screenF = screen >= 13 ? 1.03 : screen >= 11 ? 1.0 : screen >= 8.3 ? 0.98 : screen >= 6.7 ? 0.96 : 0.95;
  const ppiF = ppi >= 500 ? 0.98 : ppi >= 400 ? 0.99 : ppi >= 300 ? 1.0 : 1.01;
  const gyroQF = gyroQ === "excellent" ? 1.0 : gyroQ === "good" ? 0.97 : 0.92;

  const dM = fpsF * touchF * screenF * ppiF;
  const dD = dM * gyroQF;

  // ▬▬▬▬ FINGER FACTOR (±4%) ▬▬▬▬
  const fM = ({ 2: 1.04, 3: 1.02, 4: 1.0, 5: 0.98, 6: 0.96 } as Record<number, number>)[p.fingers] ?? 1.0;

  // ▬▬▬▬ STYLE FACTOR (±3%) ▬▬▬▬
  const sC = ({ headshot: 0.97, spray: 1.02, competitive: 1.0, close: 1.03, reflex: 1.02, conqueror: 0.98 } as Record<string, number>)[p.styleId] ?? 1.0;
  const sS = ({ headshot: 0.96, spray: 1.01, competitive: 1.0, close: 1.01, reflex: 1.0, conqueror: 0.97 } as Record<string, number>)[p.styleId] ?? 1.0;
  const sG = ({ headshot: 1.02, spray: 1.01, competitive: 1.0, close: 1.01, reflex: 1.01, conqueror: 0.99 } as Record<string, number>)[p.styleId] ?? 1.0;

  // ▬▬▬▬ GYRO OFF BOOST ▬▬▬▬
  const gOff = (p.gyroMode === "off" || p.gyroMode === "scope") ? 1.05 : 1.0;

  // ▬▬▬▬ PRO PROFILE MULTIPLIERS ▬▬▬▬
  const prof = p.proProfile ? PRO_PROFILES.find((pr) => pr.id === p.proProfile) : null;
  const profCQC = prof?.cqcMul ?? 1.0;
  const profNear = prof?.scopeNearMul ?? 1.0;
  const profFar = prof?.scopeFarMul ?? 1.0;
  const profGyro = prof?.gyroMul ?? 1.0;
  const profGyroFar = prof?.gyroFarMul ?? 1.0;

  // ▬▬▬▬ RECOIL-AWARE SCOPE STABILITY ▬▬▬▬
  const vRecoil = wp.verticalRecoil;
  const hRecoil = wp.horizontalRecoil;
  const scopeStab = vRecoil >= 80 ? 0.93 : vRecoil >= 65 ? 0.95 : vRecoil >= 50 ? 0.97 : 1.0;
  const gyroHComp = hRecoil >= 45 ? 1.04 : hRecoil >= 30 ? 1.02 : 1.0;

  // Super Power toggle slightly amplifies precision tuning
  const sp = p.isSuperPower ? 0.98 : 1.0;

  // ─── Camera (hip-fire) sensitivity ───
  const cam: SensObj = {
    tpp: cl(wp.cam[0] * dD * fM * sC * gOff * profCQC),
    fpp: cl(wp.cam[1] * dD * fM * sC * gOff * profCQC),
    red: cl(wp.cam[2] * dD * fM * sC * profNear),
    scope2: cl(wp.cam[3] * dD * fM * sS * scopeStab * profNear * sp),
    scope3: cl(wp.cam[4] * dD * fM * sS * scopeStab * profNear * sp),
    scope4: cl(wp.cam[5] * dD * fM * sS * scopeStab * profFar * sp),
    scope6: cl(wp.cam[6] * dD * fM * sS * scopeStab * profFar * sp),
    scope8: cl(wp.cam[7] * dD * fM * sS * scopeStab * profFar * sp),
  };

  // ─── ADS (aim-down-sights) sensitivity ───
  const ads: SensObj = {
    tpp: cl(wp.ads[0] * dD * fM * sC * gOff * profCQC),
    fpp: cl(wp.ads[1] * dD * fM * sC * gOff * profCQC),
    red: cl(wp.ads[2] * dD * fM * sC * profNear),
    scope2: cl(wp.ads[3] * dD * fM * sS * scopeStab * profNear * sp),
    scope3: cl(wp.ads[4] * dD * fM * sS * scopeStab * profNear * sp),
    scope4: cl(wp.ads[5] * dD * fM * sS * scopeStab * profFar * sp),
    scope6: cl(wp.ads[6] * dD * fM * sS * scopeStab * profFar * sp),
    scope8: cl(wp.ads[7] * dD * fM * sS * scopeStab * profFar * sp),
  };

  // ─── Gyroscope camera ───
  const gyroCam: SensObj = {
    tpp: cg(wp.gyro[0] * dD * fM * sG * profGyro),
    fpp: cg(wp.gyro[1] * dD * fM * sG * profGyro),
    red: cg(wp.gyro[2] * dD * fM * sG * gyroHComp * profGyro),
    scope2: cg(wp.gyro[3] * dD * fM * sG * gyroHComp * profGyro),
    scope3: cg(wp.gyro[4] * dD * fM * sG * gyroHComp * profGyro),
    scope4: cg(wp.gyro[5] * dD * fM * sG * gyroHComp * profGyroFar),
    scope6: cg(wp.gyro[6] * dD * fM * sG * gyroHComp * profGyroFar),
    scope8: cg(wp.gyro[7] * dD * fM * sG * gyroHComp * profGyroFar),
  };

  // ─── Gyroscope ADS ───
  const gyroAds: SensObj = {
    tpp: cg(wp.gyroAds[0] * dD * fM * sG * profGyro),
    fpp: cg(wp.gyroAds[1] * dD * fM * sG * profGyro),
    red: cg(wp.gyroAds[2] * dD * fM * sG * gyroHComp * profGyro),
    scope2: cg(wp.gyroAds[3] * dD * fM * sG * gyroHComp * profGyro),
    scope3: cg(wp.gyroAds[4] * dD * fM * sG * gyroHComp * profGyro),
    scope4: cg(wp.gyroAds[5] * dD * fM * sG * gyroHComp * profGyroFar),
    scope6: cg(wp.gyroAds[6] * dD * fM * sG * gyroHComp * profGyroFar),
    scope8: cg(wp.gyroAds[7] * dD * fM * sG * gyroHComp * profGyroFar),
  };

  // ─── Free look (parachute / vehicle / camera) ───
  const freeLook = {
    cam: cl(108 * dM * fM),
    parashoot: cl(104 * dM * fM),
    vehicle: cl(100 * dM * fM),
  };

  // ─── AI Score (0-100) ───
  const aiScore = Math.round(
    Math.min(
      99,
      Math.max(
        58,
        74 +
          (gyroQ === "excellent" ? 8 : gyroQ === "good" ? 4 : 0) +
          (fps >= 120 ? 6 : fps >= 90 ? 3 : 0) +
          (touch >= 480 ? 4 : touch >= 240 ? 2 : 0) +
          (p.fingers >= 4 ? 5 : p.fingers >= 3 ? 3 : 0) +
          (p.gyroMode === "always" ? 5 : p.gyroMode === "scope" ? 3 : 0) +
          (p.isSuperPower ? 3 : 0) -
          (vRecoil >= 80 ? 5 : vRecoil >= 65 ? 3 : 0),
      ),
    ),
  );

  const result: Sens = {
    cam, ads, gyroCam, gyroAds, freeLook, aiScore,
    factors: {
      fps, touchRate: touch, screenSize: screen, gyroQuality: gyroQ, ppi,
      deviceFactor: dD, fingerFactor: fM, styleFactor: sC, weaponFactor: scopeStab,
      fpsFactor: fpsF, touchFactor: touchF, screenFactor: screenF, ppiFactor: ppiF,
      gyroQualityFactor: gyroQF, scopedStyleFactor: sS, gyroStyleFactor: sG,
      gyroOffBoost: gOff, horizontalGyroCompensation: gyroHComp, superPowerFactor: sp,
    },
  };
  const issues = sensitivityIssues(result);
  if (issues.length) {
    throw new Error(`SENS_INVALID_OUTPUT: ${issues.join("; ")}`);
  }
  return result;
}

// ─── Factors panel (used in the output column) ───
export function FactorsPanel({ sens }: { sens: Sens }) {
  const { lang } = useLang();
  const F = sens.factors;
  const items = [
    { k: t("factors_device", lang), v: F.deviceFactor.toFixed(2), icon: "📱", sub: `${F.fps} FPS` },
    { k: t("factors_weapon", lang), v: F.weaponFactor.toFixed(2), icon: "🔫", sub: F.gyroQuality },
    { k: t("factors_fingers", lang), v: F.fingerFactor.toFixed(2), icon: "🖐️", sub: "±4%" },
    { k: t("factors_style", lang), v: F.styleFactor.toFixed(2), icon: "🎮", sub: "±3%" },
  ];

  return (
    <div className="card rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500" />
        <h4 className="font-display text-sm font-bold tracking-widest text-white/90">{t("factors_title", lang)}</h4>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.k} className="rounded-xl border border-white/5 bg-black/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-lg">{i.icon}</span>
              <span className="font-display text-lg font-black text-orange-300 tabular-nums">×{i.v}</span>
            </div>
            <div className="mt-1 text-[10px] text-white/60">{i.k}</div>
            <div className="text-[9px] text-white/30">{i.sub}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px] leading-relaxed">
        <span className="text-orange-300">{t("factors_equation", lang)}</span>{" "}
        <span dir="ltr" className="font-mono">Profile × Device × Fingers × Style × RecoilComp</span>
        <br />
        <span className="text-white/40">{t("factors_desc", lang)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" dir="ltr" aria-label="Transparent calculation factors">
        {[
          `PPI ${F.ppi.toFixed(0)}`,
          `FPS ×${F.fpsFactor.toFixed(2)}`,
          `Touch ×${F.touchFactor.toFixed(2)}`,
          `Screen ×${F.screenFactor.toFixed(2)}`,
          `Density ×${F.ppiFactor.toFixed(2)}`,
          `GyroQ ×${F.gyroQualityFactor.toFixed(2)}`,
          `ScopeStyle ×${F.scopedStyleFactor.toFixed(2)}`,
          `GyroStyle ×${F.gyroStyleFactor.toFixed(2)}`,
          `H-Recoil ×${F.horizontalGyroCompensation.toFixed(2)}`,
        ].map((label) => (
          <span key={label} className="rounded border border-white/5 bg-black/25 px-1.5 py-0.5 font-mono text-[8px] text-white/40">{label}</span>
        ))}
      </div>
    </div>
  );
}

export type ScopeKey = keyof Sens;
export const SCOPE_LABELS: { key: keyof Sens["cam"]; labelKey: TranslationKey }[] = [
  { key: "tpp", labelKey: "sens_scope_tpp" },
  { key: "fpp", labelKey: "sens_scope_fpp" },
  { key: "red", labelKey: "sens_scope_red" },
  { key: "scope2", labelKey: "sens_scope_2x" },
  { key: "scope3", labelKey: "sens_scope_3x" },
  { key: "scope4", labelKey: "sens_scope_4x" },
  { key: "scope6", labelKey: "sens_scope_6x" },
  { key: "scope8", labelKey: "sens_scope_8x" },
];
