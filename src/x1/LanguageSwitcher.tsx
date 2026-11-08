import { useState, useRef, useEffect } from "react";
import { useLang } from "./LanguageContext";
import { LANGUAGES, t } from "./i18n";

export function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = LANGUAGES.find((l) => l.id === lang)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
        aria-label="Change language"
      >
        <span className="text-lg">{current.flag}</span>
        <span className="hidden sm:inline">{current.name}</span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-[#0a0a14]/95 p-1 shadow-2xl backdrop-blur-lg"
          style={{ [current.name === "العربية" ? "right" : "left"]: 0 } as React.CSSProperties}
        >
          <div className="border-b border-white/5 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/40">
            {t("nav_language", lang)}
          </div>
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setLang(l.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-right text-sm transition-colors ${
                lang === l.id
                  ? "bg-orange-500/15 text-orange-300"
                  : "text-white/80 hover:bg-white/5"
              }`}
            >
              <span className="text-lg">{l.flag}</span>
              <span className="flex-1 font-semibold">{l.name}</span>
              {lang === l.id && <span className="text-orange-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
