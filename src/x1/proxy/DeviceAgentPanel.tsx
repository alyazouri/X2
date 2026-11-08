import { useState } from "react";
import { useLang } from "../LanguageContext";
import type { DnsProxyMatch } from "./match";
import {
  buildDeviceProxyBundle, clearLocalBundle, downloadBundle,
  downloadInstructions, eProxyInstructions, loadLocalBundle,
  saveBundleLocally, type DeviceProxyBundle,
} from "./deviceAgent";

export function DeviceAgentPanel({ match }: { match: DnsProxyMatch }) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [saved, setSaved] = useState<DeviceProxyBundle | null>(() => loadLocalBundle());
  const [copied, setCopied] = useState(false);
  const bundle = buildDeviceProxyBundle(match);

  const save = () => {
    saveBundleLocally(bundle);
    setSaved(bundle);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(eProxyInstructions(bundle));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard unavailable */ }
  };

  const clear = () => {
    clearLocalBundle();
    setSaved(null);
  };

  return (
    <div className="mt-5 rounded-xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-[11px] font-bold tracking-widest text-emerald-300">📱 {isAr ? "وكيل البروكسي المحلي للجهاز" : "LOCAL DEVICE PROXY AGENT"}</div>
          <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-white/55">
            {isAr
              ? "يحفظ المطابقة على جهازك فقط ويجهّز إعداد eProxy النصي وجسر OpenVPN. لا تُرفع إعداداتك إلى خادمنا. التحقق النهائي لتمرير الحركة يتم داخل eProxy."
              : "Stores the match on your device only and prepares eProxy instructions plus an OpenVPN bridge directive. Nothing is uploaded. Final forwarding validation happens inside eProxy."}
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[9px] font-bold text-emerald-300">🔒 LOCAL ONLY</span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <AgentValue label="DNS" value={bundle.dns.address} color="text-orange-300" />
        <AgentValue label="Upstream" value={bundle.upstream.endpoint} color="text-cyan-300" />
        <AgentValue label="Local listener" value="127.0.0.1:1707" color="text-emerald-300" />
      </div>

      <div className="mt-3 rounded-lg border border-white/5 bg-black/30 p-3 text-[10px] leading-relaxed text-white/60">
        <div className="font-bold text-white">eProxy / VPN workflow</div>
        <ol className="mt-2 space-y-1 ps-5">
          <li>{isAr ? "احفظ الحزمة محلياً أو نزّل ملف التعليمات." : "Save the bundle locally or download the instruction file."}</li>
          <li>{isAr ? "في eProxy أنشئ Local HTTP Proxy على 127.0.0.1:1707." : "In eProxy create a local HTTP proxy on 127.0.0.1:1707."}</li>
          <li>{isAr ? `تحقق يدوياً من upstream: ${bundle.upstream.endpoint}.` : `Manually verify upstream: ${bundle.upstream.endpoint}.`}</li>
          <li>{isAr ? "شغّل eProxy وامنح إذن VPN المحلي، ثم اختبر الإنترنت من داخل التطبيق." : "Start eProxy, grant local VPN permission, then test internet access inside the app."}</li>
        </ol>
        <div className="mt-2 rounded bg-white/5 px-2 py-1 font-mono text-emerald-300" dir="ltr">{bundle.openVpnDirective}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={save} className="btn-primary rounded-lg px-3 py-2 text-[10px]">💾 {isAr ? "حفظ على جهازي" : "Save on my device"}</button>
        <button onClick={() => downloadBundle(bundle)} className="btn-ghost rounded-lg px-3 py-2 text-[10px]">⬇️ {isAr ? "تنزيل الحزمة" : "Download bundle"}</button>
        <button onClick={() => downloadInstructions(bundle)} className="btn-ghost rounded-lg px-3 py-2 text-[10px]">📄 {isAr ? "تعليمات eProxy" : "eProxy instructions"}</button>
        <button onClick={copy} className="btn-ghost rounded-lg px-3 py-2 text-[10px]">{copied ? "✓ Copied" : `📋 ${isAr ? "نسخ الإعداد" : "Copy setup"}`}</button>
        {saved && <button onClick={clear} className="rounded-lg border border-red-400/20 bg-red-500/5 px-3 py-2 text-[10px] text-red-300">🗑️ {isAr ? "مسح المحلي" : "Clear local"}</button>}
      </div>

      <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/5 p-2.5 text-[9px] leading-relaxed text-amber-200/75">
        ⚠️ {isAr
          ? "صيغة .epro مغلقة وتعتمد على إصدار التطبيق، لذلك لا ننشئ ملف .epro مزيفاً. ملفنا المحلي قابل للقراءة والمراجعة. مشغّل البروكسي يستطيع رؤية بيانات الاتصال، ولا يمكن ضمان الخصوصية المطلقة."
          : "The .epro format is proprietary and version-dependent, so no fake .epro is generated. Our local bundle is readable and auditable. A proxy operator can observe connection metadata; absolute privacy cannot be guaranteed."}
      </p>
    </div>
  );
}

function AgentValue({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-2.5">
      <div className="text-[8px] uppercase tracking-widest text-white/35">{label}</div>
      <div className={`mt-0.5 break-all font-mono text-[10px] ${color}`} dir="ltr">{value}</div>
    </div>
  );
}