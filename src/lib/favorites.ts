// ════════════════════════════════════════════════════════════════
// FAVORITES STORAGE — pure, side-effect-free persistence helpers.
// Users pin the DNS/proxy endpoints they actually use so they survive
// the jitter-ascending table order and always float to the top.
// localStorage only (private, per-device); no backend contract.
// ════════════════════════════════════════════════════════════════

export const FAVORITES_KEY = "alyazouri_favorites_v1";

export interface Favorites {
  /** Pinned DNS addresses (bare IPs). */
  dns: string[];
  /** Pinned proxy endpoints (`host:port`). */
  proxy: string[];
}

export const EMPTY_FAVORITES: Favorites = { dns: [], proxy: [] };

const MAX_PER_LIST = 50;

/** Read + sanitize favorites; never throws, never trusts stored shape. */
export function readFavorites(storage: Pick<Storage, "getItem"> | undefined): Favorites {
  if (!storage) return EMPTY_FAVORITES;
  try {
    const raw = storage.getItem(FAVORITES_KEY);
    if (!raw) return EMPTY_FAVORITES;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY_FAVORITES;
    const obj = parsed as Partial<Favorites>;
    const cleanList = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64).slice(0, MAX_PER_LIST)
        : [];
    return { dns: cleanList(obj.dns), proxy: cleanList(obj.proxy) };
  } catch {
    return EMPTY_FAVORITES;
  }
}

/** Persist favorites; returns the sanitized value actually written. */
export function writeFavorites(
  storage: Pick<Storage, "setItem"> | undefined,
  next: Favorites,
): Favorites {
  const clean: Favorites = {
    dns: next.dns.slice(0, MAX_PER_LIST),
    proxy: next.proxy.slice(0, MAX_PER_LIST),
  };
  try { storage?.setItem(FAVORITES_KEY, JSON.stringify(clean)); } catch { /* quota/private mode */ }
  return clean;
}

export function isFavorite(list: string[], id: string): boolean {
  return list.includes(id);
}

/** Toggle `id` in `list` (immutable). Caps growth at MAX_PER_LIST. */
export function toggleFavorite(list: string[], id: string): string[] {
  return list.includes(id)
    ? list.filter((x) => x !== id)
    : [...list, id].slice(0, MAX_PER_LIST);
}

/**
 * Order rows so favorites come first, preserving the caller's secondary
 * order (stable). `keyOf` extracts the row's favorite id.
 */
export function favoritesFirst<T>(rows: T[], favorites: string[], keyOf: (row: T) => string): T[] {
  const pinned = rows.filter((r) => favorites.includes(keyOf(r)));
  const rest = rows.filter((r) => !favorites.includes(keyOf(r)));
  return [...pinned, ...rest];
}
