// ════════════════════════════════════════════════════════════════
// DEVICE CAPABILITY SNAPSHOT — honest browser-observable facts only.
//
// Browsers intentionally do NOT expose a reliable manufacturer/model or
// physical screen inches (especially iOS). We never infer or invent them.
// The user-selected catalogue device remains authoritative for sensitivity;
// this panel shows real reported capabilities to help catch wrong selection.
// ════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { useLang } from "./LanguageContext";

interface SelectedDevice {
  name: string;
  fps: number;
  touchRate: number;
  screenSize: number;
  resolution: string;
  gyroQuality: "excellent" | "good" | "average";
}

interface BrowserCapabilities {
  platform: string | null;
  mobile: boolean | null;
  cores: number | null;
  memoryGB: number | null;
  cssScreen: [number, number] | null;
  reportedPixels: [number, number] | null;
  dpr: number | null;
  viewport: [number, number] | null;
}

function initialCapabilities(): BrowserCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { platform: null, mobile: null, cores: null, memoryGB: null, cssScreen: null, reportedPixels: null, dpr: null, viewport: null };
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: { platform?: string; mobile?: boolean };
  };
  const dpr = window.devicePixelRatio || 1;
  const sw = window.screen?.width ?? 0;
  const sh = window.screen?.height ?? 0;
  return {
    platform: nav.userAgentData?.platform ?? nav.platform ?? null,
    mobile: typeof nav.userAgentData?.mobile === "boolean" ? nav.userAgentData.mobile : null,
    cores: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
    memoryGB: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    cssScreen: sw > 0 && sh > 0 ? [sw, sh] : null,
    // This is browser-reported backing-pixel geometry, NOT claimed native panel resolution.
    reportedPixels: sw > 0 && sh > 0 ? [Math.round(sw * dpr), Math.round(sh * dpr)] : null,
    dpr,
    viewport: [window.innerWidth, window.innerHeight],
  };
}

/** Measure actual animation refresh cadence from requestAnimationFrame. */
function useMeasuredRefreshRate() {
  const [hz, setHz] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let last = performance.now();
    const deltas: number[] = [];
    const frame = (now: number) => {
      if (cancelled) return;
      const dt = now - last;
      last = now;
      if (dt > 4 && dt < 100) deltas.push(dt);
      if (deltas.length >= 45) {
        const sorted = [...deltas].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const raw = 1000 / median;
        // Normalize to standard display rates while keeping uncommon values honest.
        const standards = [30, 50, 60, 75, 90, 100, 120, 144, 165, 240];
        const nearest = standards.reduce((a, b) => Math.abs(b - raw) < Math.abs(a - raw) ? b : a);
        setHz(Math.abs(nearest - raw) <= 5 ? nearest : Math.round(raw));
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, []);
  return hz;
}

function normalizedResolution(value: string): [number, number] | null {
  const m = value.match(/(\d+)[×x](\d+)/);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  return a >= b ? [a, b] : [b, a];
}

export function DeviceCapabilityPanel({ selected }: { selected: SelectedDevice }) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [caps] = useState(initialCapabilities);
  const refreshHz = useMeasuredRefreshRate();
  const match = useMemo(() => {
    const selectedRes = normalizedResolution(selected.resolution);
    const reported = caps.reportedPixels;
    if (!selectedRes || !reported) return null;
    const browserRes: [number, number] = reported[0] >= reported[1] ? reported : [reported[1], reported[0]];
    const delta = Math.abs(browserRes[0] - selectedRes[0]) / selectedRes[0]
      + Math.abs(browserRes[1] - selectedRes[1]) / selectedRes[1];
    return delta <= 0.08;
  }, [selected.resolution, caps.reportedPixels]);

  return (
    <details className="mt-3 rounded-xl border border-white/5 bg-black/25 p-3">
      <summary className="cursor-pointer text-[11px] font-bold text-white/65">
        🧩 {isAr ? "قدرات الجهاز التي كشفها المتصفح (حقيقية)" : "Browser-observed device capabilities (real)"}
      </summary>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-3">
        {[
          [isAr ? "المنصة" : "Platform", caps.platform ?? "N/A"],
          [isAr ? "الشاشة (CSS)" : "CSS screen", caps.cssScreen ? `${caps.cssScreen[0]}×${caps.cssScreen[1]}` : "N/A"],
          [isAr ? "بكسلات مُبلّغة" : "Reported pixels", caps.reportedPixels ? `${caps.reportedPixels[0]}×${caps.reportedPixels[1]}` : "N/A"],
          ["DPR", caps.dpr?.toFixed(2) ?? "N/A"],
          [isAr ? "معدل التحديث المقاس" : "Measured refresh", refreshHz ? `${refreshHz} Hz` : (isAr ? "جاري القياس…" : "Measuring…")],
          [isAr ? "أنوية منطقية" : "Logical cores", caps.cores ?? "N/A"],
          [isAr ? "ذاكرة مُبلّغة" : "Reported memory", caps.memoryGB ? `${caps.memoryGB} GB` : "N/A"],
          [isAr ? "مساحة العرض" : "Viewport", caps.viewport ? `${caps.viewport[0]}×${caps.viewport[1]}` : "N/A"],
          [isAr ? "تطابق الدقة المختارة" : "Selected resolution match", match == null ? "N/A" : match ? "✓" : "⚠"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <p className="text-white/35">{label}</p>
            <p dir="ltr" className="mt-0.5 font-mono font-bold text-white/75">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[9px] leading-relaxed text-amber-200/60">
        ⚠️ {isAr
          ? "اسم الشركة والطراز وحجم الشاشة بالبوصة لا يكشفها المتصفح بشكل موثوق، خصوصاً على iOS. لذلك لا نخمنها: اختر جهازك يدوياً، واستخدم هذه القياسات للتحقق. «البكسلات المُبلّغة» ليست ادعاءً بالدقة الأصلية للوحة."
          : "Browsers do not reliably expose manufacturer, model, or physical inches—especially on iOS. We never guess them: select your device manually and use these facts to verify it. “Reported pixels” is not claimed native panel resolution."}
      </p>
    </details>
  );
}
