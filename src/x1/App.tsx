import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useLang } from "./LanguageContext";
import { t } from "./i18n";
import { BRANDS, WEAPONS, FINGERS, STYLES, PRO_PROFILES, PRO_RECOMMENDATIONS } from "./data";
import { computeSensitivity, FactorsPanel, type GyroMode, type Sens } from "./sensitivity";
import { runApex, runApexDiagnostics, buildDeviceProfile, buildWeaponIntel, type GGModeId, type TargetStyle, type CombatRange, type AimPriority, type SensitivityProfile } from "./apex";
import { ExpertSection } from "./ExpertSection";
import { ExportCard } from "./ExportCard";
import { DeviceCapabilityPanel } from "./DeviceCapabilities";
import { PrimeZonesPanel } from "./PrimeZonesPanel";
import { applyPrimeZones, DEFAULT_PRIME_ZONES, isDefaultPrime, type PrimeZones } from "./prime-sens";
import {
  ApplyGuide, ComparePanel, FineTunePanel, WeaponComparePanel, applyFineTune,
  DEFAULT_FINE_TUNE, isDefaultFineTune, snapshotOf, type FineTune, type SavedTables,
} from "./SensitivityLab";
import { ApexPanel } from "./ApexPanel";
import { Particles } from "./Particles";
import { Aurora } from "./Aurora";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LiveUsersBadge } from "./LiveUsers";
import { fetchJsonWithHardTimeout } from "../lib/fetch-timeout";
import {
  SectionHeader, RevealSection, SensitivityTable, CopyButton, ShareButton, AIPredictions,
  RatingSection, NightModeToggle,
  PingMonitor, Hero, PWABanner, QuickSearch, AuroraMark, decodeShareCode,
} from "./ui";

const PROFILES_KEY = "alyazouri_profiles";
interface SavedProfile {
  id: string; name: string; savedAt: number; aiScore: number; device: string; weapon: string;
  /** Full sensitivity snapshot (enables compare); absent in pre-upgrade saves. */
  tables?: SavedTables;
  ft?: FineTune;
}

/* ═══ Code splitting: below-the-fold feature sections load on demand.
   The network cluster (datasets + check-host client + geo) and matchmaking
   are the heaviest modules and are not needed for the generator above. ═══ */
const NetworkCenter = lazy(() =>
  import("./net/NetworkCenter").then((m) => ({ default: m.NetworkCenter })),
);
const JordanMatchmaking = lazy(() =>
  import("./JordanMatchmaking").then((m) => ({ default: m.JordanMatchmaking })),
);

/** Skeleton shown while a lazy section streams in (matches the card language). */
function SectionSkeleton() {
  return (
    <div className="card animate-pulse rounded-2xl p-5" role="status" aria-live="polite">
      <div className="h-3 w-1/3 rounded bg-white/10" />
      <div className="mt-3 h-3 w-2/3 rounded bg-white/5" />
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-white/[0.04]" />)}
      </div>
      <div className="mt-4 h-24 rounded-xl bg-white/[0.03]" />
    </div>
  );
}

function getInitialShareData(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const code = new URLSearchParams(window.location.search).get("p");
    return code ? decodeShareCode(code) : null;
  } catch {
    return null;
  }
}

function findInitialDevice(share: Record<string, unknown> | null) {
  if (typeof share?.d === "string") {
    for (const b of BRANDS) {
      const found = b.devices.find((d) => d.name === share.d);
      if (found) return { brandId: b.id, deviceId: found.name };
    }
  }
  return { brandId: BRANDS[0].id, deviceId: BRANDS[0].devices[0].name };
}

function findInitialWeapon(share: Record<string, unknown> | null) {
  if (typeof share?.w === "string") {
    for (const c of WEAPONS) {
      if (c.weapons.some((x) => x.name === share.w)) {
        return { catId: c.id, weaponId: share.w as string };
      }
    }
  }
  return { catId: WEAPONS[0].id, weaponId: WEAPONS[0].weapons[0].name };
}

export default function App() {
  const { lang, dir } = useLang();
  const isAr = lang === "ar";

  const initialShare = useMemo(() => getInitialShareData(), []);

  const [brandId, setBrandId] = useState(() => findInitialDevice(initialShare).brandId);
  const brand = useMemo(() => BRANDS.find((b) => b.id === brandId)!, [brandId]);
  const [deviceId, setDeviceId] = useState(() => findInitialDevice(initialShare).deviceId);
  const device = useMemo(() => brand.devices.find((d) => d.name === deviceId) ?? brand.devices[0], [brand, deviceId]);

  // PPI derived from the device resolution for the Expert device model.
  const devicePpi = useMemo(() => {
    const rm = device.resolution.match(/(\d+)[×x](\d+)/);
    const w = rm ? +rm[1] : 2400;
    const h = rm ? +rm[2] : 1080;
    return Math.sqrt(w * w + h * h) / device.screenSize;
  }, [device]);

  const [fingers, setFingers] = useState<number>(() => {
    const f = Number(initialShare?.f);
    return [2, 3, 4, 5, 6].includes(f) ? f : 4;
  });
  const [styleId, setStyleId] = useState(() => {
    const s = initialShare?.s;
    return typeof s === "string" && STYLES.some((x) => x.id === s) ? s : "headshot";
  });
  const [gyroMode, setGyroMode] = useState<GyroMode>(() => {
    const g = initialShare?.g;
    return g === "off" || g === "scope" || g === "always" ? g : "always";
  });
  const [proProfile, setProProfile] = useState<string | undefined>(() => {
    const pr = initialShare?.pr;
    return typeof pr === "string" && pr && PRO_PROFILES.some((x) => x.id === pr) ? pr : undefined;
  });
  const [isSuperPower, setIsSuperPower] = useState(() => initialShare?.sp === 1);

  // ── ALYAZOURI GG (APEX ENGINE) state ──
  const [ggActive, setGgActive] = useState(() => initialShare?.gg === 1);
  const [ggMode, setGgMode] = useState<GGModeId>(() => {
    const m = initialShare?.m;
    return ["aggressive", "balanced", "control", "precision", "competitive", "head", "spray"].includes(m as string) ? (m as GGModeId) : "balanced";
  });
  const [ggTargetStyle, setGgTargetStyle] = useState<TargetStyle>(() => {
    const ts = initialShare?.ts;
    return ["static", "strafe", "fast", "mixed"].includes(ts as string) ? (ts as TargetStyle) : "mixed";
  });
  const [ggRange, setGgRange] = useState<CombatRange>(() => {
    const r = initialShare?.r;
    return ["close", "mid", "long", "mixed"].includes(r as string) ? (r as CombatRange) : "mixed";
  });
  const [ggAimPriority, setGgAimPriority] = useState<AimPriority>(() => {
    const ap = initialShare?.ap;
    return ["head", "balanced", "recoil", "precision"].includes(ap as string) ? (ap as AimPriority) : "balanced";
  });

  // Expert adaptive iteration override (locked FINAL profile from ExpertSection).
  const currentConfigKey = `${device.name}|${fingers}|${styleId}|${gyroMode}|${ggMode}|${ggTargetStyle}|${ggRange}|${ggAimPriority}`;
  const [appliedExpertKey, setAppliedExpertKey] = useState<string | null>(null);
  const [expertOverride, setExpertOverride] = useState<SensitivityProfile | null>(null);
  const [expertFreeLook, setExpertFreeLook] = useState<Sens["freeLook"] | null>(null);

  const activeExpertOverride = appliedExpertKey === currentConfigKey ? expertOverride : null;
  const activeExpertFreeLook = appliedExpertKey === currentConfigKey ? expertFreeLook : null;

  // Sensitivity Lab: user's per-engine fine-tune applied AFTER the engines.
  const [fineTune, setFineTune] = useState<FineTune>(() => {
    const ft = initialShare?.ft;
    if (Array.isArray(ft) && ft.length === 4 && ft.every((n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 50 && n <= 150)) {
      return { cam: ft[0], ads: ft[1], gyroCam: ft[2], gyroAds: ft[3] };
    }
    return DEFAULT_FINE_TUNE;
  });

  const [weaponCatId, setWeaponCatId] = useState(() => findInitialWeapon(initialShare).catId);
  const weaponCat = useMemo(() => WEAPONS.find((c) => c.id === weaponCatId)!, [weaponCatId]);
  const [weaponId, setWeaponId] = useState(() => findInitialWeapon(initialShare).weaponId);
  const weapon = useMemo(() => weaponCat.weapons.find((w) => w.name === weaponId) ?? weaponCat.weapons[0], [weaponCat, weaponId]);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "cloud" | "local" | "failed">("idle");
  // Prime intent zones — applied over the canonical Apex profile when it wins.
  const [primeZones, setPrimeZones] = useState<PrimeZones>(() => ({ ...DEFAULT_PRIME_ZONES }));
  const [primeProfile, setPrimeProfile] = useState<SensitivityProfile | null>(null);
  const [profiles, setProfiles] = useState<SavedProfile[]>(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PROFILES_KEY) : null;
      if (raw) return JSON.parse(raw);
    } catch { /* */ }
    return [];
  });

  useEffect(() => {
    // Cloud sync: merge profiles saved on other devices (when a backend exists).
    type ProfileApi = { ok?: boolean; profiles?: (SavedProfile & { payload?: { tables?: SavedTables; ft?: FineTune } })[] };
    fetchJsonWithHardTimeout<ProfileApi>("/api/profiles", {}, 8000).then((d) => {
      if (!d?.ok || !Array.isArray(d.profiles)) return;
      const remote: SavedProfile[] = d.profiles.map((p) => ({
        id: p.id, name: p.name, savedAt: p.savedAt, aiScore: p.aiScore, device: p.device, weapon: p.weapon,
        tables: p.payload?.tables, ft: p.payload?.ft,
      }));
      setProfiles((prev) => {
        const merged = [...prev];
        for (const r of remote) if (!merged.some((m) => m.id === r.id)) merged.push(r);
        return merged.sort((a, b) => b.savedAt - a.savedAt).slice(0, 12);
      });
    }).catch(() => { /* local-only mode */ });
  }, []);

  useEffect(() => {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return;
    const report = runApexDiagnostics();
    if (!report.passed) console.error("ALYAZOURI GG diagnostics failed", report);
  }, []);

  const handleExpertApply = (profile: SensitivityProfile, fl?: Sens["freeLook"]) => {
    setAppliedExpertKey(currentConfigKey);
    setExpertOverride(profile);
    if (fl) setExpertFreeLook(fl);
  };

  const baseSens = useMemo(() => computeSensitivity({
    deviceId: device.name, device, brandId, fingers, styleId, gyroMode,
    weaponId: weapon.name, weaponName: weapon.name, weaponRecoil: weapon.recoil, weaponRange: weapon.range, weaponType: weapon.type,
    proProfile, isSuperPower,
  }), [device, brandId, fingers, styleId, gyroMode, weapon, proProfile, isSuperPower]);

  // Prime zones reset only when the user actually computes a new profile (event-driven),
  // not via render-time setState in an effect.

  // Weapon-vs-weapon comparison: same device/config, only the weapon varies.
  // Uses the deterministic base engine so the delta is reproducible and isolates
  // exactly one variable (the weapon) — no APEX/fine-tune noise.
  const computeForWeapon = useCallback((w: { name: string; recoil: number; range: number; type: string }): Sens =>
    computeSensitivity({
      deviceId: device.name, device, brandId, fingers, styleId, gyroMode,
      weaponId: w.name, weaponName: w.name, weaponRecoil: w.recoil, weaponRange: w.range, weaponType: w.type,
      proProfile, isSuperPower,
    }), [device, brandId, fingers, styleId, gyroMode, proProfile, isSuperPower]);

  // ── ALYAZOURI GG APEX ENGINE (cached + memoized; never runs on every render) ──
  const apexResult = useMemo(() => {
    if (!ggActive) return null;
    return runApex({
      device: buildDeviceProfile({ name: device.name, fps: device.fps, touchRate: device.touchRate, screenSize: device.screenSize, resolution: device.resolution, gyroQuality: device.gyroQuality }),
      weapon: buildWeaponIntel(weapon.name, weapon.recoil, weapon.range, weapon.type),
      fingers: fingers as 2 | 3 | 4 | 5 | 6,
      gyroMode, mode: ggMode, targetStyle: ggTargetStyle, range: ggRange, aimPriority: ggAimPriority,
      playStyle: styleId as "headshot" | "spray" | "competitive" | "close" | "reflex" | "conqueror",
    });
  }, [ggActive, device, weapon, fingers, gyroMode, ggMode, ggTargetStyle, ggRange, ggAimPriority, styleId]);

  // Bridge: when GG is active, the 4 engine tables + AI score come from the APEX profile.
  const sens: Sens = useMemo(() => {
    // Expert-locked profile wins whenever present (even before ACTIVATE).
    if (activeExpertOverride && ggActive && apexResult && apexResult.valid) {
      return {
        ...baseSens,
        cam: activeExpertOverride.cam,
        ads: activeExpertOverride.ads,
        gyroCam: activeExpertOverride.gyroCam,
        gyroAds: activeExpertOverride.gyroAds,
        freeLook: activeExpertFreeLook ?? apexResult.freeLook,
        aiScore: apexResult.scores.supreme,
        factors: baseSens.factors,
      };
    }
    if (activeExpertOverride) {
      return {
        ...baseSens,
        cam: activeExpertOverride.cam,
        ads: activeExpertOverride.ads,
        gyroCam: activeExpertOverride.gyroCam,
        gyroAds: activeExpertOverride.gyroAds,
        freeLook: activeExpertFreeLook ?? baseSens.freeLook,
        factors: baseSens.factors,
      };
    }
    if (!ggActive || !apexResult || !apexResult.valid) return baseSens;
    const p = apexResult.profile;
    return {
      ...baseSens,
      cam: p.cam,
      ads: p.ads,
      gyroCam: p.gyroCam,
      gyroAds: p.gyroAds,
      freeLook: apexResult.freeLook,
      aiScore: apexResult.scores.supreme,
      factors: {
        ...baseSens.factors,
        deviceFactor: apexResult.modelFactors.device,
        fingerFactor: apexResult.modelFactors.fingers,
        styleFactor: apexResult.modelFactors.calibration,
        weaponFactor: apexResult.modelFactors.recoil,
      },
    };
  }, [ggActive, apexResult, baseSens, activeExpertOverride, activeExpertFreeLook]);

  // Layer order: engine → prime zones (when an Apex profile is the winner)
  // → user fine-tune. Prime is never allowed to rescale the free-look lane and
  // never violates BOUNDS or zoom hierarchy (enforced inside applyPrimeZones).
  const primedSens = useMemo(() => {
    if (!primeProfile) return sens;
    return { ...sens, cam: primeProfile.cam, ads: primeProfile.ads, gyroCam: primeProfile.gyroCam, gyroAds: primeProfile.gyroAds };
  }, [sens, primeProfile]);
  const finalSens = useMemo(() => applyFineTune(primedSens, fineTune), [primedSens, fineTune]);

  const selectDeviceByName = (name: string) => {
    for (const b of BRANDS) {
      const found = b.devices.find((d) => d.name === name);
      if (found) { setBrandId(b.id); setDeviceId(name); return; }
    }
  };

  const selectWeapon = (catId: string, name: string) => {
    const c = WEAPONS.find((x) => x.id === catId); if (!c) return;
    setWeaponCatId(catId); setWeaponId(name);
  };

  const saveProfile = async () => {
    setSaveState("saving");
    const p: SavedProfile = {
      id: `${Date.now()}`, name: `${device.name} · ${weapon.name}`, savedAt: Date.now(),
      aiScore: finalSens.aiScore, device: device.name, weapon: weapon.name,
      tables: snapshotOf(finalSens),
      ft: isDefaultFineTune(fineTune) ? undefined : fineTune,
    };
    const next = [p, ...profiles].slice(0, 12);
    setProfiles(next);
    let localSaved = false;
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(next)); localSaved = true; } catch { /* quota/private mode */ }

    const { tables, ft, ...meta } = p;
    try {
      await fetchJsonWithHardTimeout<{ ok?: boolean }>("/api/profiles", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...meta, payload: { tables, ft } }),
      }, 8000);
      setSaveState("cloud");
    } catch {
      setSaveState(localSaved ? "local" : "failed");
    }
    setTimeout(() => setSaveState("idle"), 2600);
  };

  // ── Importable share link (?p=<code>) restores the full setup ──
  const sharePayload = useMemo(() => ({
    d: device.name, w: weapon.name, f: fingers, s: styleId, g: gyroMode,
    m: ggMode, ts: ggTargetStyle, r: ggRange, ap: ggAimPriority,
    pr: proProfile ?? "", sp: isSuperPower ? 1 : 0, gg: ggActive ? 1 : 0,
    ft: isDefaultFineTune(fineTune) ? undefined : [fineTune.cam, fineTune.ads, fineTune.gyroCam, fineTune.gyroAds],
  }), [device.name, weapon.name, fingers, styleId, gyroMode, ggMode, ggTargetStyle, ggRange, ggAimPriority, proProfile, isSuperPower, ggActive, fineTune]);

  return (
    <div dir={dir} className="relative min-h-screen">
      <a href="#generator" className="sr-skip">{isAr ? "تخطي إلى المولد" : "Skip to generator"}</a>
      {/* Interactive aurora mesh — reacts to the pointer, controls, scroll & tilt */}
      <Aurora />
      <Particles />
      <div className="aurora-grain" aria-hidden="true" />
      <div className="relative z-10">
        {/* ═══ NAVBAR ═══ */}
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#05070c]/80 backdrop-blur-md">
          <div className="mx-auto flex h-[61px] max-w-7xl items-center justify-between gap-3 px-5">
            <a href="#top" className="flex items-center gap-2">
              <AuroraMark className="h-8 w-8 shrink-0" />
              <span className="font-display text-sm font-black tracking-widest text-white">ALYAZOURI</span>
            </a>
            <nav className="hidden items-center gap-1 lg:flex">
              {[["generator", "nav_generator"], ["ping", "nav_ping"], ["dns", "nav_dns"], ["jo", "nav_jo"], ["about", "nav_about"]].map(([id, key]) => (
                <a key={id} href={`#${id}`} className="rounded-lg px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white">{t(key as never, lang)}</a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <div className="hidden xl:block"><QuickSearch onPickDevice={selectDeviceByName} onPickWeapon={selectWeapon} /></div>
              <LiveUsersBadge />
              <NightModeToggle />
              <MusicPlayer />
              <LanguageSwitcher />
              <button onClick={() => document.getElementById("generator")?.scrollIntoView({ behavior: "smooth" })} className="btn-primary hidden rounded-xl px-4 py-2 text-xs sm:block">{t("nav_cta", lang)}</button>
            </div>
          </div>
        </header>
        <StatusBarLazy />
        <main id="top">
          <Hero />
          <div className="mx-auto max-w-7xl px-5 pb-24">
            {/* ═══ GENERATOR ═══ */}
            <section id="generator" className="mt-12 scroll-mt-24">
              <SectionHeader eyebrow={t("sec_generator_eyebrow", lang)} title={t("sec_generator_title", lang)} subtitle={t("sec_generator_sub", lang)} />
              <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
                {/* Controls */}
                <div className="space-y-5">
                  {/* ALYAZOURI GG — APEX ENGINE flagship panel */}
                  <RevealSection>
                    <ApexPanel
                      active={ggActive} onToggle={() => setGgActive((v) => !v)}
                      mode={ggMode} setMode={setGgMode}
                      targetStyle={ggTargetStyle} setTargetStyle={setGgTargetStyle}
                      range={ggRange} setRange={setGgRange}
                      aimPriority={ggAimPriority} setAimPriority={setGgAimPriority}
                      gyroMode={gyroMode} setGyroMode={setGyroMode}
                      result={apexResult}
                    />
                  </RevealSection>

                  {/* Device */}
                  <div className="card rounded-2xl p-5">
                    <div className="mb-3 flex items-center gap-2"><span className="text-lg">📱</span><h3 className="font-display text-sm font-bold tracking-widest text-white">{t("device_select", lang)}</h3></div>
                    <div className="flex flex-wrap gap-2">
                      {BRANDS.map((b) => (
                        <button key={b.id} onClick={() => { setBrandId(b.id); setDeviceId(b.devices[0].name); }} className={`chip rounded-xl px-3 py-1.5 text-xs font-semibold ${brandId === b.id ? "active" : ""}`}>
                          <span className="me-1">{b.icon}</span>{b.name}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {brand.devices.map((dv) => (
                        <button key={dv.name} onClick={() => setDeviceId(dv.name)} className={`chip rounded-lg px-2.5 py-1.5 text-[11px] ${deviceId === dv.name ? "active" : ""}`}>{dv.name}</button>
                      ))}
                    </div>
                    <div className="mt-3 rounded-lg border border-white/5 bg-black/30 p-3 text-sm">
                      <span className="text-white/50">{t("device_selected", lang)}</span><b className="text-orange-300"> {device.name}</b>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded bg-black/40 px-2 py-0.5 font-display text-xs">{device.fps} FPS</span>
                        <span className="rounded bg-black/40 px-2 py-0.5 font-display text-xs">{device.touchRate} Hz</span>
                        <span className="rounded bg-black/40 px-2 py-0.5 font-display text-xs">{device.screenSize}&Prime;</span>
                        <span className={`rounded px-2 py-0.5 font-display text-xs ${device.gyroQuality === "excellent" ? "bg-emerald-500 text-emerald-300" : device.gyroQuality === "good" ? "bg-amber-500 text-amber-300" : "bg-red-500 text-red-300"}`}>
                          {device.gyroQuality === "excellent" ? t("device_gyro_excellent", lang) : device.gyroQuality === "good" ? t("device_gyro_good", lang) : t("device_gyro_average", lang)}
                        </span>
                      </div>
                      <DeviceCapabilityPanel selected={device} />
                    </div>
                  </div>

                  {/* Gyro Mode */}
                  <div className="card rounded-2xl p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-display text-sm font-bold tracking-widest text-white">{t("gyro_title", lang)}</h3>
                      <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[10px] font-bold text-orange-300">{gyroMode === "off" ? t("gyro_status_off", lang) : gyroMode === "scope" ? t("gyro_status_scope", lang) : t("gyro_status_always", lang)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: "off", icon: "⭕", label: t("gyro_off", lang), desc: t("gyro_off_desc", lang) },
                        { id: "scope", icon: "🎯", label: t("gyro_scope", lang), desc: t("gyro_scope_desc", lang) },
                        { id: "always", icon: "🔄", label: t("gyro_always", lang), desc: t("gyro_always_desc", lang) },
                      ] as const).map((m) => (
                        <button key={m.id} onClick={() => setGyroMode(m.id as GyroMode)} className={`chip rounded-xl p-3 text-center ${gyroMode === m.id ? "active" : ""}`}>
                          <div className="text-xl">{m.icon}</div><div className="mt-1 text-[11px] font-bold text-white">{m.label}</div><div className="text-[9px] text-white/50">{m.desc}</div>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-white/40">{gyroMode === "off" ? t("gyro_msg_off", lang) : gyroMode === "scope" ? t("gyro_msg_scope", lang) : t("gyro_msg_always", lang)}</p>
                  </div>

                  {/* Pro Profile */}
                  <div className="card neon-box rounded-2xl p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-display text-sm font-bold tracking-widest text-white">🏆 {isAr ? "البروفايل الاحترافي" : "Pro Profile"}</h3>
                      <span className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-2.5 py-0.5 text-[9px] font-bold text-white">PRO</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setProProfile(undefined)} className={`chip rounded-xl px-3 py-1.5 text-xs ${!proProfile ? "active" : ""}`}>{isAr ? "تلقائي" : "Auto"}</button>
                      {PRO_PROFILES.map((pr) => (
                        <button key={pr.id} onClick={() => setProProfile(pr.id)} className={`chip rounded-xl px-3 py-1.5 text-xs font-semibold ${proProfile === pr.id ? "active" : ""}`}>{isAr ? pr.nameAr : pr.name}</button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-white/5 bg-black/30 p-3">
                      <div className="flex items-center gap-2"><span className="text-lg">⚡</span><span className="text-xs text-white/70">{isAr ? "الوضع الخارق" : "Super Power"}</span></div>
                      <button onClick={() => setIsSuperPower((v) => !v)} role="switch" aria-checked={isSuperPower} aria-label={isAr ? "الوضع الخارق" : "Super Power"} className={`relative h-7 w-12 rounded-full border transition-all ${isSuperPower ? "border-orange-400 bg-orange-500/30" : "border-white/15 bg-black/40"}`}>
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${isSuperPower ? "left-6 bg-gradient-to-br from-orange-400 to-red-500" : "left-0.5 bg-white/30"}`} />
                      </button>
                    </div>
                    {proProfile && (() => {
                      const pr = PRO_PROFILES.find((p) => p.id === proProfile); const rec = PRO_RECOMMENDATIONS[proProfile]; if (!pr) return null;
                      const stats = [
                        { k: isAr ? "تحكم ارتداد" : "Recoil", v: pr.recoilControl, c: "bg-red-500" },
                        { k: isAr ? "تتبع" : "Tracking", v: pr.tracking, c: "bg-emerald-500" },
                        { k: isAr ? "فليك" : "Flicking", v: pr.flicking, c: "bg-sky-500" },
                        { k: isAr ? "بعيد" : "Long Range", v: pr.longRange, c: "bg-purple-500" },
                        { k: isAr ? "قريب" : "CQC", v: pr.cqcPower, c: "bg-orange-500" },
                      ];
                      return (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-xl border border-white/5 bg-black/30 p-3 text-xs text-white/75">{isAr ? pr.descriptionAr : pr.description}</div>
                          <div className="space-y-2">{stats.map((s) => (
                            <div key={s.k} className="flex items-center gap-2"><span className="w-20 shrink-0 text-[10px] text-white/60">{s.k}</span>
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5"><span className={`block h-full rounded-full ${s.c}`} style={{ width: `${s.v}%` }} /></div>
                              <span className="w-5 text-right font-display text-[10px] font-bold text-white/80">{s.v}</span></div>
                          ))}</div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="rounded-lg border border-emerald-400/10 bg-emerald-500/5 p-2.5"><div className="mb-1 text-[10px] font-bold text-emerald-300">✅ {isAr ? "القوة" : "Strengths"}</div>{(isAr ? pr.strengthsAr : pr.strengths).map((s) => <div key={s} className="flex items-center gap-1.5 text-[10px] text-white/70"><span className="h-1 w-1 rounded-full bg-emerald-400" />{s}</div>)}</div>
                            <div className="rounded-lg border border-amber-400/10 bg-amber-500/5 p-2.5"><div className="mb-1 text-[10px] font-bold text-amber-300">⚠️ {isAr ? "الضعف" : "Weak"}</div>{(isAr ? pr.weaknessesAr : pr.weaknesses).map((s) => <div key={s} className="flex items-center gap-1.5 text-[10px] text-white/70"><span className="h-1 w-1 rounded-full bg-amber-400" />{s}</div>)}</div>
                            <div className="rounded-lg border border-sky-400/10 bg-sky-500/5 p-2.5"><div className="mb-1 text-[10px] font-bold text-sky-300">🎯 {isAr ? "الأفضل لـ" : "Best for"}</div><div className="flex flex-wrap gap-1">{(isAr ? pr.bestForAr : pr.bestFor).map((s) => <span key={s} className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-semibold text-sky-300">{s}</span>)}</div></div>
                          </div>
                          {rec && (
                            <>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="rounded-lg border border-purple-400/10 bg-purple-500/5 p-3"><div className="mb-1.5 font-display text-[10px] font-bold text-purple-300">PRO MAX</div>
                                  <div className="space-y-1.5 text-[10px] text-white/65">
                                    <div className="flex justify-between"><span>{isAr ? "وضع الجايرو الموصى" : "Recommended Gyro"}</span><span className="rounded bg-purple-500/10 px-2 py-0.5 font-bold text-purple-300">{rec.gyro}</span></div>
                                    <div className="flex justify-between"><span>{isAr ? "أقل أصابع مناسب" : "Recommended Fingers"}</span><span className="rounded bg-purple-500/10 px-2 py-0.5 font-bold text-purple-300">{rec.minFingers}F</span></div>
                                    <div className="flex justify-between"><span>{isAr ? "السلاح المقترح" : "Suggested Weapon"}</span><span className="rounded bg-purple-500/10 px-2 py-0.5 font-bold text-purple-300">{rec.preferredWeaponName}</span></div>
                                    <div className="flex justify-between gap-2"><span>{isAr ? "أنسب فئة أسلحة" : "Best Weapon Focus"}</span><span className="text-right font-semibold text-purple-300">{(isAr ? rec.weaponFocusAr : rec.weaponFocus).join(" · ")}</span></div>
                                  </div>
                                </div>
                                <div className="rounded-lg border border-fuchsia-400/10 bg-fuchsia-500/5 p-3"><div className="mb-1.5 font-display text-[10px] font-bold text-fuchsia-300">INSIGHT</div><p className="text-[10px] text-white/65">{isAr ? rec.noteAr : rec.note}</p></div>
                              </div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="rounded-lg border border-cyan-400/10 bg-cyan-500/5 p-3"><div className="mb-1.5 font-display text-[10px] font-bold text-cyan-300">TOOL STACK</div><div className="flex flex-wrap gap-1">{(isAr ? rec.featureStackAr : rec.featureStack).map((s) => <span key={s} className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[8px] font-semibold text-cyan-300">{s}</span>)}</div></div>
                                <div className="rounded-lg border border-lime-400/10 bg-lime-500/5 p-3"><div className="mb-1.5 font-display text-[10px] font-bold text-lime-300">WARM-UP</div><div className="space-y-1">{(isAr ? rec.warmupAr : rec.warmup).map((s) => <div key={s} className="flex items-center gap-1.5 text-[10px] text-white/70"><span className="h-1 w-1 rounded-full bg-lime-400" />{s}</div>)}</div></div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Fingers + Style */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="card rounded-2xl p-5">
                      <h3 className="mb-3 font-display text-sm font-bold tracking-widest text-white">{t("fingers_title", lang)}</h3>
                      <div className="flex flex-wrap gap-2">{FINGERS.map((f) => (
                        <button key={f} onClick={() => setFingers(f)} className={`chip rounded-xl px-4 py-2 text-sm font-bold ${fingers === f ? "active" : ""}`}>{f}</button>
                      ))}</div>
                    </div>
                    <div className="card rounded-2xl p-5">
                      <h3 className="mb-3 font-display text-sm font-bold tracking-widest text-white">{t("style_title", lang)}</h3>
                      <div className="flex flex-wrap gap-2">{STYLES.map((s) => (
                        <button key={s.id} onClick={() => setStyleId(s.id)} className={`chip flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${styleId === s.id ? "active" : ""}`}><span>{s.icon}</span>{t(("style_" + s.id) as never, lang)}</button>
                      ))}</div>
                    </div>
                  </div>

                  {/* Weapon */}
                  <div className="card rounded-2xl p-5">
                    <h3 className="mb-3 font-display text-sm font-bold tracking-widest text-white">{t("weapon_title", lang)}</h3>
                    <div className="flex flex-wrap gap-2">{WEAPONS.map((c) => (
                      <button key={c.id} onClick={() => { setWeaponCatId(c.id); setWeaponId(c.weapons[0].name); }} className={`chip rounded-xl px-3 py-1.5 text-xs font-semibold ${weaponCatId === c.id ? "active" : ""}`}><span className="me-1">{c.icon}</span>{c.id.toUpperCase()}</button>
                    ))}</div>
                    <div className="mt-3 flex flex-wrap gap-2">{weaponCat.weapons.map((w) => (
                      <button key={w.name} onClick={() => setWeaponId(w.name)} className={`chip rounded-lg px-2.5 py-1.5 text-[11px] ${weaponId === w.name ? "active" : ""}`}>{w.name}</button>
                    ))}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-white/5 bg-black/30 p-2.5"><div className="text-white/50">{t("weapon_recoil", lang)}</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${weapon.recoil}%` }} /></div></div>
                      <div className="rounded-lg border border-white/5 bg-black/30 p-2.5"><div className="text-white/50">{t("weapon_range", lang)}</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400" style={{ width: `${weapon.range}%` }} /></div></div>
                    </div>
                  </div>

                  <button onClick={() => void saveProfile()} disabled={saveState === "saving"}
                    className={`btn-ghost w-full rounded-xl px-5 py-3 text-sm disabled:opacity-60 ${saveState === "cloud" ? "!border-emerald-400/40 !text-emerald-300" : saveState === "failed" ? "!border-red-400/40 !text-red-300" : ""}`}>
                    {saveState === "saving" ? `⏳ ${isAr ? "جاري الحفظ…" : "Saving…"}`
                      : saveState === "cloud" ? `✅ ${isAr ? "تم الحفظ والمزامنة" : "Saved & synced"}`
                      : saveState === "local" ? `✅ ${isAr ? "تم الحفظ محلياً (السحابة غير متاحة)" : "Saved locally (cloud unavailable)"}`
                      : saveState === "failed" ? `❌ ${isAr ? "تعذّر الحفظ" : "Save failed"}`
                      : `💾 ${isAr ? "حفظ الحساسية" : "Save Sensitivity"}`}
                  </button>
                  <CopyButton sens={finalSens} />
                  <ShareButton sens={finalSens} deviceName={device.name} weaponName={weapon.name} sharePayload={sharePayload} />
                  <ExportCard sens={finalSens} deviceName={device.name} weaponName={weapon.name} />
                </div>

                {/* Output */}
                <div className="space-y-5">
                  {/* Sensitivity Lab — manual fine-tune over the engine output */}
                  <FineTunePanel value={fineTune} onChange={setFineTune} gyroOff={gyroMode === "off"} />

                  {/* AI Score */}
                  <div className="card relative overflow-hidden rounded-2xl p-5">
                    <div className="absolute inset-0 bg-grid opacity-20" />
                    <div className="relative flex items-center justify-between gap-4">
                      <div>
                        <div className="font-display text-[10px] font-bold tracking-widest text-orange-400">{t("ai_score_label", lang)}</div>
                        <div className="mt-1 text-lg font-bold text-white">{t("ai_score_title", lang)}</div>
                        <div className="mt-1 text-[11px] text-white/50">{device.name} · {weapon.name} · {fingers} {t("ai_suffix", lang)}</div>
                      </div>
                      <div className="relative h-28 w-28">
                        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                          <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
                          <circle cx="50" cy="50" r="42" stroke="url(#grad)" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${(finalSens.aiScore / 100) * 264} 264`} />
                          <defs><linearGradient id="grad" x1="0" x2="1"><stop offset="0%" stopColor="#ff7a00" /><stop offset="100%" stopColor="#ffd166" /></linearGradient></defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-3xl font-black text-orange-300">{finalSens.aiScore}</span><span className="text-[9px] text-white/40">AI SCORE</span></div>
                      </div>
                    </div>
                  </div>

                  <FactorsPanel sens={finalSens} />

                  {/* Sensitivity tables (engine output + fine-tune) */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SensitivityTable label={t("sens_camera", lang)} data={finalSens.cam} color="orange" />
                    <SensitivityTable label={t("sens_ads", lang)} data={finalSens.ads} color="orange" />
                    {gyroMode === "off" ? (
                      <div className="card flex flex-col items-center justify-center rounded-2xl p-8 text-center sm:col-span-2"><div className="text-4xl">⭕</div><div className="mt-2 font-bold text-white">{t("gyro_disabled_title", lang)}</div><div className="mt-1 text-xs text-white/50">{t("gyro_disabled_msg", lang)}</div></div>
                    ) : (
                      <>
                        <SensitivityTable label={t("sens_gyro_cam", lang)} data={finalSens.gyroCam} color="sky" showTppFpp={gyroMode === "always"} />
                        <SensitivityTable label={t("sens_gyro_ads", lang)} data={finalSens.gyroAds} color="sky" showTppFpp={gyroMode === "always"} />
                      </>
                    )}
                  </div>

                  {/* Free Look */}
                  <div className="card rounded-2xl p-5">
                    <h4 className="mb-3 font-display text-sm font-bold tracking-widest text-white/90">{t("sens_freelook", lang)}</h4>
                    <div className="grid grid-cols-3 gap-3 text-center">{Object.entries(finalSens.freeLook).map(([k, v]) => {
                      const labelKey = k === "cam" ? "sens_freelook_cam" : k === "parashoot" ? "sens_freelook_para" : "sens_freelook_vehicle";
                      return (<div key={k} className="rounded-xl border border-white/5 bg-black/30 p-3"><div className="text-[10px] uppercase tracking-widest text-white/40">{t(labelKey as never, lang)}</div><div className="mt-1 font-display text-2xl font-black text-orange-300">{v}%</div></div>);
                    })}</div>
                  </div>

                  {/* Sensitivity Lab — in-game apply guide */}
                  <ApplyGuide sens={finalSens} gyroOff={gyroMode === "off"} />

                  {/* EXPERT — adaptive aim engineering (V1→FINAL) */}
                  <ExpertSection
                    sens={finalSens}
                    baseline={baseSens}
                    ctx={{
                      deviceName: device.name, fps: device.fps, touchRate: device.touchRate,
                      screenSize: device.screenSize, ppi: devicePpi,
                      fingers, gyroMode,
                      weaponName: weapon.name, weaponType: weapon.type, styleId,
                      mode: ggMode, targetStyle: ggTargetStyle, range: ggRange, aimPriority: ggAimPriority,
                    }}
                    onApply={handleExpertApply}
                  />

                  <AIPredictions deviceName={device.name} fingers={fingers} styleId={styleId} weaponName={weapon.name} />
                  <div className="card rounded-2xl p-5">
                    <h4 className="mb-3 font-display text-sm font-bold tracking-widest text-white/90">{t("stability_title", lang)}</h4>
                    <div className="space-y-3">
                      {[
                        { label: t("stability_device", lang), value: (finalSens.factors.deviceFactor * 100).toFixed(0), color: "from-orange-500 to-red-500" },
                        { label: t("stability_weapon", lang), value: (finalSens.factors.weaponFactor * 100).toFixed(0), color: "from-amber-500 to-orange-500" },
                        { label: t("stability_fingers", lang), value: (finalSens.factors.fingerFactor * 100).toFixed(0), color: "from-emerald-500 to-teal-500" },
                        { label: t("stability_style", lang), value: (finalSens.factors.styleFactor * 100).toFixed(0), color: "from-sky-500 to-indigo-500" },
                      ].map((item) => (
                        <div key={item.label} className="space-y-1"><div className="flex justify-between"><span className="text-xs text-white/70">{item.label}</span><span className="font-display text-xs font-bold text-white tabular-nums">{item.value}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/5"><span className={`block h-full rounded-full bg-gradient-to-r ${item.color}`} style={{ width: `${item.value}%` }} /></div></div>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] text-white/40">{t("stability_equation", lang)}<br />{t("stability_desc", lang)}</p>
                  </div>

                  {/* Sensitivity Lab — compare against a saved snapshot */}
                  <ComparePanel current={finalSens} profiles={profiles} />

                  {/* Sensitivity Lab — weapon vs weapon (same device/config) */}
                  <WeaponComparePanel currentWeapon={weapon.name} compute={computeForWeapon} />

                  {/* ALYAZOURI GG Prime zones — applied over the computed Apex profile */}
                  {ggActive && apexResult && apexResult.valid && (
                    <PrimeZonesPanel
                      profile={apexResult}
                      onCompute={(p) => setPrimeProfile(p)}
                    />
                  )}
                </div>
              </div>
            </section>

            {/* ═══ PING ═══ */}
            <section id="ping" className="mt-20 scroll-mt-24"><SectionHeader eyebrow={t("ping_eyebrow", lang)} title={t("ping_title", lang)} subtitle={t("ping_sub", lang)} /><PingMonitor /></section>

            {/* ═══ NETWORK INTELLIGENCE CENTER (DNS + PROXY unified) ═══ */}
            <section id="dns" className="mt-20 scroll-mt-24">
              <SectionHeader eyebrow={t("dns_eyebrow", lang)} title={t("dns_title", lang)} subtitle={t("dns_sub", lang)} />
              <Suspense fallback={<SectionSkeleton />}>
                <NetworkCenter />
              </Suspense>
            </section>

            {/* ═══ JORDAN MATCHMAKING OPTIMIZER ═══ */}
            <section id="jo" className="mt-20 scroll-mt-24">
              <SectionHeader eyebrow={t("jo_eyebrow", lang)} title={t("jo_title", lang)} subtitle={t("jo_sub", lang)} />
              <Suspense fallback={<SectionSkeleton />}>
                <JordanMatchmaking />
              </Suspense>
            </section>

            {/* ═══ EQUATIONS ═══ */}
            <section className="mt-20">
              <SectionHeader eyebrow={t("eq_eyebrow", lang)} title={t("eq_title", lang)} subtitle={t("eq_sub", lang)} />
              <div className="grid gap-4 md:grid-cols-3">{[
                { k: "R_s", label: t("eq_rs", lang), eq: "(FPS × TSR × G_s) / (H_d × R_c)" },
                { k: "G_y", label: t("eq_gy", lang), eq: "(T_s × FPS) / (L_d + H_t)" },
                { k: "H_d", label: t("eq_hd", lang), eq: "(T_r × FPS) / D_l" },
              ].map((e) => (
                <div key={e.k} className="card rounded-2xl p-5"><div className="font-display text-2xl font-black text-orange-400">{e.k}</div><div className="mt-1 text-sm text-white/70">{e.label}</div><div dir="ltr" className="mt-3 rounded-lg border border-white/5 bg-black/40 p-3 text-center font-mono text-xs text-orange-200">{e.eq}</div></div>
              ))}</div>
            </section>

            {/* ═══ SAVED ═══ */}
            <section className="mt-20">
              <SectionHeader eyebrow={t("saved_eyebrow", lang)} title={t("saved_title", lang)} subtitle={t("saved_sub", lang)} />
              <div className="card rounded-2xl p-5">
                {profiles.length === 0 ? (
                  <div className="py-10 text-center text-white/50"><div className="text-4xl">🗂️</div><div className="mt-3 text-sm">{t("saved_empty", lang)}</div></div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{profiles.map((p) => (
                    <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4"><div className="flex items-center justify-between"><span className="font-display text-sm font-bold text-white">{p.name}</span><span className="rounded bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">{p.aiScore}</span></div><div className="mt-1 text-[10px] text-white/40">{new Date(p.savedAt).toLocaleString("ar-JO")}</div></div>
                  ))}</div>
                )}
              </div>
            </section>

            {/* Proxy is now inside the unified Network Intelligence Center at #dns */}

            {/* ═══ RATING ═══ */}
            <RevealSection className="mt-20"><RatingSection /></RevealSection>

            {/* ═══ FOOTER ═══ */}
            <footer id="about" className="mt-20 scroll-mt-24">
              <div className="grid gap-8 md:grid-cols-3">
                <div>
                  <div className="flex items-center gap-3"><AuroraMark className="h-9 w-9 shrink-0" /><div><div className="font-display font-black tracking-widest text-white">ALYAZOURI</div><div className="text-[11px] text-white/50">Jordan Gaming Optimizer 2026</div></div></div>
                  <p className="mt-4 text-sm text-white/60">{t("footer_about", lang)}</p>
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold tracking-widest text-orange-300">{t("footer_features", lang)}</h4>
                  <ul className="mt-3 space-y-2 text-sm text-white/70">{(["footer_f1", "footer_f2", "footer_f3", "footer_f4", "footer_f5"] as const).map((k) => <li key={k}>{t(k, lang)}</li>)}</ul>
                </div>
                <div className="flex items-end justify-center md:justify-end">
                  <div className="text-center md:text-right">
                    <div className="font-display text-3xl font-black text-orange-400/30">2026</div>
                    <div className="text-xs text-white/40">ALYAZOURI AI ENGINE</div>
                  </div>
                </div>
              </div>
              <div className="divider my-6" />
              <div className="flex flex-col items-center justify-between gap-2 text-center text-xs text-white/40 sm:flex-row sm:text-start">
                <span>{t("footer_rights", lang)}</span>
                <span className="font-display tracking-widest">{t("footer_tagline", lang)}</span>
              </div>
            </footer>
          </div>
        </main>
        <PWABanner />
      </div>
    </div>
  );
}

/* ═══ Local components (kept here to mirror original structure) ═══ */
import { StatusBar } from "./ui";

function StatusBarLazy() { return <StatusBar />; }

/* ══════════ MusicPlayer (YouTube ambient music) ══════════ */
const MUSIC_MUTED_KEY = "alyazouri_music_muted";
const YOUTUBE_VIDEO_ID = "fwmczauXmVA";

/** Minimal shape of the YouTube IFrame player actually used by MusicPlayer. */
interface YTPlayerLike {
  setVolume: (volume: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy?: () => void;
}
interface YTGlobalLike {
  Player?: new (elementId: string, options: Record<string, unknown>) => YTPlayerLike;
}
interface MusicWindow extends Window {
  YT?: YTGlobalLike;
  onYouTubeIframeAPIReady?: () => void;
}

function MusicPlayer() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem(MUSIC_MUTED_KEY) === "true"; } catch { return false; } });
  const [ready, setReady] = useState(false);
  const playerRef = useRef<YTPlayerLike | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    // Reuse an existing host div (StrictMode remount) instead of duplicating it.
    const div = (document.getElementById("yt-music-player") as HTMLDivElement | null) ?? (() => {
      const d = document.createElement("div");
      d.id = "yt-music-player";
      d.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
      document.body.appendChild(d);
      return d;
    })();
    containerRef.current = div;
    const w = window as MusicWindow;
    if (!w.YT?.Player && !document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const create = () => {
      if (disposed) return;
      const YT = w.YT;
      if (!YT?.Player) {
        // Cap retries: a blocked/unavailable YouTube API must not loop forever.
        if (++retries > 30) return;
        retryTimer = setTimeout(create, 300);
        return;
      }
      if (playerRef.current) return;
      let playerInstance: YTPlayerLike | null = null;
      playerInstance = new YT.Player("yt-music-player", {
        videoId: YOUTUBE_VIDEO_ID,
        playerVars: { autoplay: 0, loop: 1, playlist: YOUTUBE_VIDEO_ID, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, iv_load_policy: 3, origin: window.location.origin },
        events: {
          onReady: () => { try { playerInstance?.setVolume(40); } catch { /* */ } setReady(true); if (!muted) startPlayback(); },
          onStateChange: (e: { data: number }) => { if (e.data === 1) setPlaying(true); else if (e.data === 0) { try { playerInstance?.seekTo(0, true); playerInstance?.playVideo(); } catch { /* */ } } },
        },
      });
      playerRef.current = playerInstance;
    };
    w.onYouTubeIframeAPIReady = create;
    create();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      try { playerRef.current?.destroy?.(); } catch { /* */ }
      playerRef.current = null;
      try { div.remove(); } catch { /* */ }
      containerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPlayback = () => { const p = playerRef.current; if (!p) return; try { p.setVolume(40); p.playVideo(); setPlaying(true); } catch { /* */ } };

  useEffect(() => {
    if (!ready || muted) return;
    const handler = () => startPlayback();
    document.addEventListener("click", handler, { once: true });
    document.addEventListener("touchstart", handler, { once: true });
    document.addEventListener("keydown", handler, { once: true });
    return () => { document.removeEventListener("click", handler); document.removeEventListener("touchstart", handler); document.removeEventListener("keydown", handler); };
  }, [ready, muted]);

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) { setMuted((m) => { const n = !m; try { localStorage.setItem(MUSIC_MUTED_KEY, String(n)); } catch { /* */ } return n; }); return; }
    if (muted || !playing) { try { p.setVolume(40); p.playVideo(); } catch { /* */ } setMuted(false); setPlaying(true); try { localStorage.setItem(MUSIC_MUTED_KEY, "false"); } catch { /* */ } }
    else { try { p.pauseVideo(); } catch { /* */ } setMuted(true); setPlaying(false); try { localStorage.setItem(MUSIC_MUTED_KEY, "true"); } catch { /* */ } }
  };

  return (
    <button onClick={toggleMute} title={isAr ? (playing && !muted ? "كتم الموسيقى" : "تشغيل الموسيقى") : (playing && !muted ? "Mute music" : "Play music")}
      className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-all ${playing && !muted ? "border border-orange-400/30 bg-orange-500/10 text-orange-300" : "btn-ghost"}`}>
      <span className="text-lg">{playing && !muted ? "🎵" : "🔇"}</span>
      {playing && !muted && (
        <span className="flex items-end gap-[2px]">
          <span className="inline-block w-[3px] rounded-full bg-orange-400" style={{ animation: "musicBar 0.4s ease-in-out infinite alternate", height: "6px" }} />
          <span className="inline-block w-[3px] rounded-full bg-orange-400" style={{ animation: "musicBar 0.55s ease-in-out infinite alternate", height: "10px" }} />
          <span className="inline-block w-[3px] rounded-full bg-orange-400" style={{ animation: "musicBar 0.7s ease-in-out infinite alternate", height: "4px" }} />
        </span>
      )}
    </button>
  );
}
