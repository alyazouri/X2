// ════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — Jordan Matchmaking Optimizer (honest, no manipulation)
// ════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useLang } from "./LanguageContext";
import { t } from "./i18n";

/** Jordanian player density per local hour (0–23) — peak 20:00–01:00. */
const DENSITY = [
  18, 14, 11, 9, 8, 8, 9, 12, 16, 20, 24, 28,
  32, 30, 27, 29, 33, 38, 44, 52, 66, 82, 94, 100,
];

const TIPS = ["jo_tip1", "jo_tip2", "jo_tip3", "jo_tip4"] as const;

export function JordanMatchmaking() {
  const { lang } = useLang();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(iv);
  }, []);

  // Jordan is UTC+3 year-round (no DST).
  const jo = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60_000);
  const hour = jo.getHours();
  const minute = jo.getMinutes();
  const density = DENSITY[hour];
  const level = density >= 70 ? "peak" : density >= 40 ? "high" : density >= 20 ? "medium" : "low";

  const levelText =
    level === "peak" ? t("jo_peak", lang)
      : level === "high" ? t("jo_high", lang)
        : level === "medium" ? t("jo_medium", lang)
          : t("jo_low", lang);
  const levelColor =
    level === "peak" ? "text-red-300"
      : level === "high" ? "text-orange-300"
        : level === "medium" ? "text-amber-300" : "text-white/50";

  const clock = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return (
    <div className="card rounded-2xl p-5">
      {/* Clock + activity */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-black/30 p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/40">{t("jo_now", lang)}</p>
          <p className="font-display text-3xl font-black text-white tabular-nums">{clock}</p>
          <p className="text-[10px] text-white/35">🇯🇴 UTC+3 · Asia/Amman</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/30 p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/40">{t("jo_peak", lang)}</p>
          <p className={`font-display text-2xl font-black ${levelColor}`}>{levelText}</p>
          <div className="stat-bar mt-2 h-1.5">
            <span className="block h-full" style={{ width: `${density}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-white/35">{density}%</p>
        </div>
      </div>

      {/* 24h density chart */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-bold text-white/70">{t("jo_density", lang)}</p>
        <div className="flex h-24 items-end gap-[3px]" dir="ltr">
          {DENSITY.map((v, h) => (
            <div key={h} className="group relative flex-1">
              <div
                className={`w-full rounded-t transition-all ${h === hour
                  ? "bg-gradient-to-t from-red-600 to-orange-400"
                  : v >= 70 ? "bg-orange-500/60" : "bg-white/10"}`}
                style={{ height: `${Math.max(6, v * 0.9)}px` }}
              />
              <span className="mt-1 block text-center text-[7px] text-white/25">{h}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Best windows + server */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
          <p className="mb-2 text-[10px] font-bold text-orange-300">{t("jo_best_windows", lang)}</p>
          <ul className="space-y-1.5 text-[11px] text-white/60">
            <li className="flex items-center gap-2"><span className="text-orange-400">20:00–01:00</span>{t("jo_wd_evening", lang)}</li>
            <li className="flex items-center gap-2"><span className="text-orange-400">22:00–03:00</span>{t("jo_we_night", lang)}</li>
            <li className="flex items-center gap-2"><span className="text-orange-400">18:00–20:00</span>{t("jo_early", lang)}</li>
          </ul>
        </div>
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
          <p className="mb-1 text-[10px] font-bold text-sky-300">{t("jo_server", lang)}</p>
          <p className="text-sm font-bold text-white">{t("jo_me_server", lang)}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-white/50">{t("jo_server_desc", lang)}</p>
          <p className="mt-2 text-[10px] font-bold text-sky-300">{t("jo_routing", lang)}</p>
          <p className="text-[10px] leading-relaxed text-white/50">{t("jo_routing_desc", lang)}</p>
        </div>
      </div>

      {/* Verdict */}
      <div className={`mt-3 rounded-xl border p-3 text-center ${density >= 60
        ? "border-emerald-500/25 bg-emerald-500/10"
        : "border-amber-500/25 bg-amber-500/10"}`}
      >
        <p className={`text-xs font-bold ${density >= 60 ? "text-emerald-300" : "text-amber-300"}`}>
          {density >= 60 ? `✅ ${t("jo_play_now", lang)}` : `⏳ ${t("jo_wait", lang)}`}
        </p>
      </div>

      {/* Tips */}
      <div className="mt-3 rounded-xl border border-white/5 bg-black/30 p-3">
        <p className="mb-2 text-[10px] font-bold text-orange-300">{t("jo_tips", lang)}</p>
        <ul className="space-y-1.5">
          {TIPS.map((key) => (
            <li key={key} className="flex gap-2 text-[11px] leading-relaxed text-white/55">
              <span className="text-orange-400">▸</span>
              {t(key, lang)}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-[10px] leading-relaxed text-red-200/70">
        ⚠️ {t("jo_disclaimer", lang)}
      </p>
    </div>
  );
}
