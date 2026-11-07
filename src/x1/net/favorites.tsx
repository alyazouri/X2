// ════════════════════════════════════════════════════════════════
// FAVORITES — React binding (hook) + inline star toggle for tables.
// Storage logic lives in src/lib/favorites.ts (pure, unit-tested).
// ════════════════════════════════════════════════════════════════
import { useCallback, useState } from "react";
import { useLang } from "../LanguageContext";
import {
  readFavorites, toggleFavorite, writeFavorites,
  type Favorites,
} from "../../lib/favorites";

export function useFavorites(): {
  favorites: Favorites;
  isDnsFav: (ip: string) => boolean;
  isProxyFav: (endpoint: string) => boolean;
  toggleDns: (ip: string) => void;
  toggleProxy: (endpoint: string) => void;
} {
  // Lazy init reads localStorage once on the client (this tree is client-only);
  // avoids a setState-in-effect cascade. SSR-safe via the typeof guard.
  const [favorites, setFavorites] = useState<Favorites>(() =>
    readFavorites(typeof localStorage !== "undefined" ? localStorage : undefined),
  );

  const toggleDns = useCallback((ip: string) => {
    setFavorites((prev) => {
      const next = { ...prev, dns: toggleFavorite(prev.dns, ip) };
      writeFavorites(typeof localStorage !== "undefined" ? localStorage : undefined, next);
      return next;
    });
  }, []);

  const toggleProxy = useCallback((endpoint: string) => {
    setFavorites((prev) => {
      const next = { ...prev, proxy: toggleFavorite(prev.proxy, endpoint) };
      writeFavorites(typeof localStorage !== "undefined" ? localStorage : undefined, next);
      return next;
    });
  }, []);

  return {
    favorites,
    isDnsFav: (ip) => favorites.dns.includes(ip),
    isProxyFav: (endpoint) => favorites.proxy.includes(endpoint),
    toggleDns,
    toggleProxy,
  };
}

/** Inline ★ toggle button. `active` = already favorited. */
export function FavoriteToggle({ active, onToggle, label }: {
  active: boolean;
  onToggle: () => void;
  label: string;
}) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      title={isAr ? (active ? "إزالة من المفضلة" : "إضافة إلى المفضلة") : (active ? "Remove from favorites" : "Add to favorites")}
      aria-label={`${label} — ${active ? "★" : "☆"}`}
      className={`inline-flex shrink-0 items-center justify-center rounded border px-1 py-0.5 text-[10px] font-bold leading-none transition-colors ${
        active
          ? "border-amber-400/50 bg-amber-500/15 text-amber-300"
          : "border-white/10 bg-white/[0.03] text-white/30 hover:border-amber-400/40 hover:text-amber-300/80"
      }`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
