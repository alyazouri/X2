// ════════════════════════════════════════════════════════════════
// SHARE CODEC — URL-safe serialization of a full setup snapshot.
// Extracted to the shared lib layer (PHASE 1): pure functions, fully
// unit-tested, re-exported from the UI barrel for backward compatibility.
// ════════════════════════════════════════════════════════════════

/** Encode a payload object into a URL-safe base64 code (no padding). */
export function encodeShareCode(payload: Record<string, unknown>): string {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/=+$/, "");
  } catch { return ""; }
}

/** Decode a share code back into a payload object; null when malformed. */
export function decodeShareCode(code: string): Record<string, unknown> | null {
  try {
    const bin = atob(code);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch { return null; }
}
