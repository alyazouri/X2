// ════════════════════════════════════════════════════════════════
// Shared clipboard helpers for the Network Intelligence Center.
// Lets the user copy ANY displayed DNS address or proxy endpoint.
// ════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useLang } from "../LanguageContext";

/** Clipboard write with a legacy fallback for older mobile browsers. */
export async function copyText(value: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(value); return true; } catch { /* try legacy path */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}

/** Tiny inline copy button (⧉ → ✓) for any DNS/proxy value. */
export function CopyValue({ value }: { value: string }) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };
  return (
    <button onClick={copy}
      title={copied ? (isAr ? "تم النسخ!" : "Copied!") : (isAr ? `نسخ ${value}` : `Copy ${value}`)}
      aria-label={isAr ? `نسخ ${value}` : `Copy ${value}`}
      className={`inline-flex shrink-0 items-center justify-center rounded border px-1 py-0.5 text-[9px] font-bold leading-none transition-colors ${
        copied ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
               : "border-white/10 bg-white/[0.03] text-white/40 hover:border-orange-400/50 hover:text-orange-300"
      }`}>
      {copied ? "✓" : "⧉"}
    </button>
  );
}
