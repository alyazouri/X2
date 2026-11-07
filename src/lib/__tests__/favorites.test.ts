// ════════════════════════════════════════════════════════════════
// FAVORITES STORAGE — pure helper tests (PHASE feature: pin endpoints).
// ════════════════════════════════════════════════════════════════
import { describe, expect, it } from "vitest";
import {
  EMPTY_FAVORITES, favoritesFirst, isFavorite, readFavorites,
  toggleFavorite, writeFavorites,
} from "../favorites";

/** Minimal in-memory Storage stub (getItem/setItem only). */
function memStorage(): { store: Record<string, string> } & Pick<Storage, "getItem" | "setItem"> {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
  };
}

describe("readFavorites", () => {
  it("returns empty when nothing stored", () => {
    expect(readFavorites(memStorage())).toEqual(EMPTY_FAVORITES);
    expect(readFavorites(undefined)).toEqual(EMPTY_FAVORITES);
  });
  it("sanitizes malformed stored JSON", () => {
    const s = memStorage();
    s.setItem("alyazouri_favorites_v1", "{not json");
    expect(readFavorites(s)).toEqual(EMPTY_FAVORITES);
    s.setItem("alyazouri_favorites_v1", JSON.stringify({ dns: "nope", proxy: null }));
    expect(readFavorites(s)).toEqual(EMPTY_FAVORITES);
  });
  it("filters non-string and oversized entries", () => {
    const s = memStorage();
    s.setItem("alyazouri_favorites_v1", JSON.stringify({
      dns: ["1.1.1.1", 42, "", "x".repeat(80), null],
      proxy: ["2.2.2.2:80"],
    }));
    const f = readFavorites(s);
    expect(f.dns).toEqual(["1.1.1.1"]);
    expect(f.proxy).toEqual(["2.2.2.2:80"]);
  });
  it("round-trips through writeFavorites", () => {
    const s = memStorage();
    const written = writeFavorites(s, { dns: ["1.1.1.1"], proxy: ["2.2.2.2:80"] });
    expect(readFavorites(s)).toEqual(written);
  });
});

describe("toggleFavorite", () => {
  it("adds then removes (immutable)", () => {
    const start = ["a"];
    const added = toggleFavorite(start, "b");
    expect(added).toEqual(["a", "b"]);
    expect(start).toEqual(["a"]); // original untouched
    expect(toggleFavorite(added, "a")).toEqual(["b"]);
  });
  it("isFavorite reflects membership", () => {
    expect(isFavorite(["a"], "a")).toBe(true);
    expect(isFavorite(["a"], "b")).toBe(false);
  });
});

describe("favoritesFirst", () => {
  it("floats favorites to the top, preserving secondary order", () => {
    const rows = [{ id: "a", j: 1 }, { id: "b", j: 2 }, { id: "c", j: 3 }];
    const out = favoritesFirst(rows, ["c"], (r) => r.id);
    expect(out.map((r) => r.id)).toEqual(["c", "a", "b"]); // c first, then original order
  });
  it("is stable for multiple favorites (relative order kept)", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const out = favoritesFirst(rows, ["d", "b"], (r) => r.id);
    expect(out.map((r) => r.id)).toEqual(["b", "d", "a", "c"]);
  });
  it("returns a new array (no mutation)", () => {
    const rows = [{ id: "a" }];
    const out = favoritesFirst(rows, [], (r) => r.id);
    expect(out).not.toBe(rows);
    expect(out).toEqual(rows);
  });
});
