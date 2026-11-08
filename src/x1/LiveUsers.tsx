import { useEffect, useState } from "react";
import { fetchJsonWithHardTimeout } from "../lib/fetch-timeout";

// Honest live-presence for a static single-file frontend:
//  • TOTAL visitors  → real GLOBAL counter via the free CounterAPI (shared across all users).
//  • LIVE sessions   → real CONCURRENT tabs/sessions on THIS browser via BroadcastChannel.
// Real cross-internet concurrent counting requires a backend (not possible in a static
// build without inventing numbers), so "live" is scoped to the local browser honestly.

const CHANNEL = "alyazouri-gg-live";
const LS_KEY = "alyazouri_live_sessions";
const HEARTBEAT_MS = 3000;
const STALE_MS = 9000;
const COUNTER_NS = "alyazouri-gg";
const COUNTER_KEY = "visits";

type Sessions = Record<string, number>;
const readSessions = (): Sessions => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } };
const writeSessions = (s: Sessions): void => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* */ } };

export function useLiveUsers(): { live: number; total: number | null } {
  const [live, setLive] = useState(1);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    // Session identity only (not a metric/calculation). Use the browser's UUID
    // primitive rather than Math.random so business outputs stay randomness-free.
    const id = typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${performance.timeOrigin.toFixed(0)}`;
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel(CHANNEL); } catch { /* unsupported */ }

    const refresh = (): void => {
      const s = readSessions();
      const now = Date.now();
      for (const k of Object.keys(s)) if (now - s[k] > STALE_MS) delete s[k];
      s[id] = now;
      writeSessions(s);
      setLive(Object.keys(s).length);
      bc?.postMessage("beat");
    };
    refresh();
    const iv = setInterval(refresh, HEARTBEAT_MS);

    const onMsg = (): void => {
      const s = readSessions();
      const now = Date.now();
      for (const k of Object.keys(s)) if (now - s[k] > STALE_MS) delete s[k];
      setLive(Object.keys(s).length);
    };
    bc?.addEventListener("message", onMsg);
    window.addEventListener("storage", onMsg);

    // Real global visitor count via CounterAPI (increments once per session).
    const op = sessionStorage.getItem("counted") ? "get" : "up";
    sessionStorage.setItem("counted", "1");
    fetchJsonWithHardTimeout<{ count?: number }>(`https://api.counterapi.dev/v1/${op}/${COUNTER_NS}/${COUNTER_KEY}`, {}, 6000)
      .then((d) => { if (typeof d.count === "number") setTotal(d.count); })
      .catch(() => setTotal(null));

    const leave = (): void => {
      const s = readSessions(); delete s[id]; writeSessions(s); bc?.postMessage("beat");
    };
    window.addEventListener("beforeunload", leave);

    return () => {
      clearInterval(iv);
      bc?.removeEventListener("message", onMsg);
      window.removeEventListener("storage", onMsg);
      window.removeEventListener("beforeunload", leave);
      leave();
    };
  }, []);

  return { live, total };
}

export function LiveUsersBadge() {
  const { live, total } = useLiveUsers();
  return (
    <span className="hidden items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] font-semibold sm:flex">
      <span className="flex items-center gap-1 text-emerald-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        {live}
        <span className="text-white/40">live</span>
      </span>
      {total !== null && (
        <span className="flex items-center gap-1 text-sky-300/80">
          <span className="text-white/20">|</span>👥 {total.toLocaleString()}
          <span className="text-white/40">visits</span>
        </span>
      )}
    </span>
  );
}
