// ═════════════════════════════════════════════════════════════════════════
// ALYAZOURI GG — PRIME INTENT ZONES (applied on top of canonical Apex output)
// Deterministic, explainable, bounded. No new vocabulary.
// ══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useLang } from "./LanguageContext";
import { applyPrimeZones, DEFAULT_PRIME_ZONES, isDefaultPrime, type PrimeZones } from "./prime-sens";
import type { OptimizationResult, SensitivityProfile } from "./apex";
import { SCOPES } from "./apex";

interface ZoneRow { key: keyof PrimeZones; ar: string; en: string; hintAr: string; hintEn: string }

const ROWS: ZoneRow[] = [
  { key: "quickTurn", ar: "التفاف سريع 180°", en: "Quick 180° turn", hintAr: "سرعة استجابة أعلى للقرب والالتفاف الواسع دون فقدان استقرار السكوبات البعيدة", hintEn: "Faster close-range reaction and wide-angle turn rate while far-scope stability stays untouched" },
  { key: "flicks", ar: "فليكس قريبة", en: "Close flicks", hintAr: "رفع السرعة النهائية لـ TPP/FPP مع بقاء منحنى التكبير ثابتاً", hintEn: "Raised TPP/FPP target-acquisition speed while the zoom curve stays intact" },
  { key: "tracking", ar: "التتبع المستمر", en: "Continuous tracking", hintAr: "تتبع متواصل دون اندفاع زائد عند السكوبات 1x–3x", hintEn: "Continuous tracking without overshoot at 1x–3x scopes" },
  { key: "closeKick", ar: "استجابة CQC", en: "CQC recoil response", hintAr: "رد فعل الرش أثناء المواجهة القريبة بحيث يبقى خط الرأس محفوظاً", hintEn: "Spray response during close encounters so the head line stays held" },
  { key: "holdHead", ar: "ثبات الرأس", en: "Head-level stability", hintAr: "التصفية للمراكز العليا تبقي الصبع عند الرأس وتمنع الانحراف", hintEn: "Upper-scope tightening keeps the line at head height through bursts" },
  { key: "midField", ar: "ميدان متوسط", en: "Mid-range control", hintAr: "تحسين الاستقرار على 3x/4x دون إخلال كفلان اللاعب على الأحجام الكبيرة", hintEn: "Improves stability at 3x–4x without ignoring big-screen steady aim" },
  { key: "snipeCalm", ar: "أهداف بعيدة", en: "Sniping calmness", hintAr: "تخفيض تدريجي 6x/8x للضغط البصري والهدوء أثناء التحديق", hintEn: "Graduated 6x/8x slow-down for steadier target acquisition at range" },
  { key: "farSpin", ar: "استيعاب بعيد", en: "Late-turn reach", hintAr: "انضمام طفيف لرفع التمثال عند الأبعاد العليا دون فقدان التوازن", hintEn: "Subtle rebound lift at distant zooms while balance is preserved" },
];

export function PrimeZonesPanel({ onCompute, profile }: {
  profile: OptimizationResult;
  onCompute: (result: SensitivityProfile) => void;
}) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [zones, setZones] = useState<PrimeZones>(() => ({ ...DEFAULT_PRIME_ZONES }));
  const [outcome, setOutcome] = useState<SensitivityProfile | null>(null);

  return (
    <div className="card rounded-2xl border border-purple-500/25 bg-purple-500/5 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧬</span>
          <div>
            <h3 className="font-display text-sm font-bold tracking-widest text-white">{isAr ? "مناطق PRIME الخاصة بنية اللعب" : "PRIME play-style zones"}</h3>
            <p className="text-[10px] text-purple-200/60">{isAr ? "طبقة إضافية فوق النتيجة النهائية — منظومة معدّلات موضوعية مدروسة، لا قيم عشوائية ولا نسخ محترفيين" : "Deterministic layer on top of the computed profile — documented factors, not copied pro numbers"}</p>
          </div>
        </div>
        <button onClick={() => setZones({ ...DEFAULT_PRIME_ZONES })} className="btn-ghost rounded-lg px-3 py-1.5 text-[10px] font-semibold">
          {isAr ? "↺ إعادة" : "↺ Reset"}
        </button>
      </div>
      <div className="space-y-2.5">
        {ROWS.map((row) => (
          <div key={row.key}>
            <label className="block text-xs text-white/75">
              <span className="mb-1 flex justify-between">
                <span>{isAr ? row.ar : row.en}</span>
                <span dir="ltr" className={`font-display font-bold ${zones[row.key] === DEFAULT_PRIME_ZONES[row.key] ? "text-white/40" : "text-purple-300"}`}>{zones[row.key]}%</span>
              </span>
              <input
                type="range" min={0} max={100} step={5} value={zones[row.key]}
                onChange={(e) => setZones((prev) => ({ ...prev, [row.key]: Number(e.target.value) }))}
                className="w-full accent-purple-500"
              />
            </label>
            <p className="mt-0.5 text-[9px] leading-relaxed text-white/40">{isAr ? row.hintAr : row.hintEn}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setOutcome(null)}
          disabled={isDefaultPrime(zones)}
          className="btn-ghost rounded-lg px-3 py-1.5 text-[10px] font-semibold disabled:opacity-30"
        >
          {isAr ? "إخفاء النتيجة" : "Hide"}
        </button>
        <button
          onClick={() => {
            const next = applyPrimeZones(profile.profile, zones);
            setOutcome(next);
            onCompute(next);
          }}
          className="btn-primary rounded-lg px-3 py-1.5 text-[10px] font-bold"
        >
          {isAr ? "🔥 احسب + طبّق" : "🔥 Compute + apply"}
        </button>
      </div>
      {outcome && (
        <details className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <summary className="cursor-pointer text-[10px] font-bold text-white/60">{isAr ? "النتيجة المحسوبة" : "Computed profile"}</summary>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
            {SCOPES.map((scope) => (
              <div key={scope} className="rounded bg-black/30 p-2">
                <p className="text-white/40">{scope.toUpperCase()}</p>
                <p dir="ltr" className="mt-0.5 font-mono text-white/80">
                  cam:{outcome.cam[scope]} · ads:{outcome.ads[scope]} · gyro:{outcome.gyroCam[scope]} · gyroAds:{outcome.gyroAds[scope]}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
