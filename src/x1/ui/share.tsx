import { useState, useMemo } from "react";
import { useLang } from "../LanguageContext";
import { type Sens } from "../sensitivity";
import { encodeShareCode, decodeShareCode } from "../../lib/share-code";

// Re-exported so existing `from "./ui"` imports keep working unchanged.
export { encodeShareCode, decodeShareCode };

/* ════════════════ COPY BUTTON ════════════════ */
export function CopyButton({ sens }: { sens: Sens }) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [copied, setCopied] = useState(false);
  const build = () => [
    `📷 TPP ${sens.cam.tpp} | FPP ${sens.cam.fpp} | Red ${sens.cam.red} | 3x ${sens.cam.scope3} | 4x ${sens.cam.scope4} | 6x ${sens.cam.scope6}`,
    `🎯 ADS TPP ${sens.ads.tpp} | FPP ${sens.ads.fpp} | Red ${sens.ads.red} | 4x ${sens.ads.scope4}`,
    `🔄 Gyro TPP ${sens.gyroCam.tpp} | Red ${sens.gyroCam.red} | 4x ${sens.gyroCam.scope4}`,
    `🏆 AI Score: ${sens.aiScore}/100`,
  ].join("\n");
  const copy = async () => {
    try { await navigator.clipboard.writeText(build()); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* */ }
  };
  return (
    <button onClick={copy} className={`btn-primary w-full rounded-xl px-5 py-3 text-sm ${copied ? "!bg-emerald-600" : ""}`}>
      {copied ? `✅ ${isAr ? "تم النسخ!" : "Copied!"}` : `📋 ${isAr ? "نسخ الحساسية" : "Copy Sensitivity"}`}
    </button>
  );
}

/* ════════════════ SHARE BUTTON ════════════════
   Builds a REAL importable link (?p=<code>) that restores the full setup on
   any device, plus a QR code so the sensitivity can be moved to the phone
   where it is actually used. */
export function ShareButton({ sens, deviceName, weaponName, sharePayload }: {
  sens: Sens; deviceName: string; weaponName: string; sharePayload?: Record<string, unknown>;
}) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [shared, setShared] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const shareUrl = useMemo(() => {
    if (!sharePayload || typeof window === "undefined") return "";
    const code = encodeShareCode(sharePayload);
    if (!code) return "";
    return `${window.location.origin}${window.location.pathname}?p=${code}`;
  }, [sharePayload]);
  const buildShareText = () => [
    isAr ? "🎯 حساسيتي من ALYAZOURI 2026" : "🎯 My Sensitivity from ALYAZOURI 2026",
    `📱 ${deviceName} · 🔫 ${weaponName}`,
    ``,
    `📷 Camera: TPP ${sens.cam.tpp}% | FPP ${sens.cam.fpp}%`,
    `🎯 ADS: TPP ${sens.ads.tpp}% | FPP ${sens.ads.fpp}%`,
    `Red Dot: ${sens.cam.red}% | ×4: ${sens.cam.scope4}%`,
    `🏆 AI Score: ${sens.aiScore}/100`,
    ``,
    shareUrl || "🔗 ALYAZOURI 2026",
  ].join("\n");
  const handleShare = async () => {
    const text = buildShareText();
    try {
      if (navigator.share) { await navigator.share({ title: "ALYAZOURI Sensitivity", text }); setShared(true); }
      else { await navigator.clipboard.writeText(text); setShared(true); }
      setTimeout(() => setShared(false), 3000);
    } catch { /* cancelled */ }
  };
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <button onClick={handleShare} className={`btn-ghost rounded-xl px-5 py-3 text-sm transition-all ${shared ? "!border-emerald-400/50 !text-emerald-300" : ""}`}>
        {shared ? `✅ ${isAr ? "تمت المشاركة!" : "Shared!"}` : `📤 ${isAr ? "مشاركة الحساسية" : "Share Sensitivity"}`}
      </button>
      <button onClick={() => { setQrOpen(true); setQrFailed(false); }} title={isAr ? "رمز QR للنقل إلى الجوال" : "QR code to move it to your phone"}
        className="btn-ghost rounded-xl px-4 py-3 text-sm" aria-label="QR">
        🔳
      </button>
      {qrOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm" onClick={() => setQrOpen(false)}>
          <div className="card neon-box w-full max-w-sm rounded-2xl p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-display text-sm font-bold tracking-widest text-white">{isAr ? "انقل الحساسية إلى جوالك" : "Move the sensitivity to your phone"}</h4>
            <div className="mx-auto mt-4 flex h-64 w-64 items-center justify-center rounded-xl bg-white p-2">
              {!qrFailed && shareUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=6&data=${encodeURIComponent(shareUrl)}`}
                  alt="QR" width={240} height={240} onError={() => setQrFailed(true)} />
              ) : (
                <span className="px-4 text-xs text-black/60">{isAr ? "تعذر توليد الرمز — انسخ الرابط أدناه." : "QR unavailable — copy the link below."}</span>
              )}
            </div>
            {shareUrl && (
              <div className="mt-3 flex items-center gap-2">
                <input readOnly value={shareUrl} dir="ltr" className="w-full truncate rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[10px] text-white/70 focus:outline-none" />
                <button onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setShared(true); setTimeout(() => setShared(false), 2500); } catch { /* */ } }}
                  className="btn-primary shrink-0 rounded-lg px-3 py-2 text-xs">{isAr ? "نسخ" : "Copy"}</button>
              </div>
            )}
            <button onClick={() => setQrOpen(false)} className="btn-ghost mt-3 w-full rounded-xl px-4 py-2 text-xs">{isAr ? "إغلاق" : "Close"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════ AI PREDICTIONS ════════════════ */
export function AIPredictions({ deviceName, fingers, styleId, weaponName }: { deviceName: string; fingers: number; styleId: string; weaponName: string }) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const list = useMemo(() => {
    const a: { icon: string; ar: string; en: string }[] = [];
    a.push(styleId === "headshot" || styleId === "sniper"
      ? { icon: "🎯", ar: `هيدشوت عالي مع ${weaponName} بفضل دقة السكوب.`, en: `High headshot rate with ${weaponName} thanks to scope precision.` }
      : { icon: "🔥", ar: `سبراي ثابت على ${weaponName} حتى المدى المتوسط.`, en: `Stable spray on ${weaponName} up to mid range.` });
    a.push(fingers >= 4
      ? { icon: "🖐️", ar: `${fingers} أصابع = تحكم سريع في الـ HUD والبنق.`, en: `${fingers} fingers = fast HUD & movement control.` }
      : { icon: "🖐️", ar: `${fingers} أصابع — جرّب 4 أصابع لتحكم أسرع.`, en: `${fingers} fingers — try 4 for faster control.` });
    a.push({ icon: "📱", ar: `${deviceName} يقدم أداءً ممتازاً لهذه الحساسية.`, en: `${deviceName} delivers great performance for this sensitivity.` });
    return a;
  }, [deviceName, fingers, styleId, weaponName]);
  return (
    <div className="card neon-box rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">🤖</span>
        <h3 className="font-display text-sm font-bold tracking-widest text-white">{isAr ? "تنبؤات الذكاء الاصطناعي" : "AI Predictions"}</h3>
      </div>
      <div className="space-y-2">
        {list.map((p, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/30 p-2.5 text-xs text-white/75">
            <span className="text-base">{p.icon}</span><span>{isAr ? p.ar : p.en}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
