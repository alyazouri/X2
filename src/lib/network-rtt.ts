// ════════════════════════════════════════════════════════════════
// REAL FETCH RTT MEASUREMENT — shared by Hero + PingMonitor.
// Every sample is a genuine timed fetch protected by AbortController.
// No random values, no inferred latency, no invented packet loss.
// ════════════════════════════════════════════════════════════════

export interface RttStats {
  samples: number[];
  average: number | null;
  median: number | null;
  jitter: number | null;
  loss: number;
  attempts: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function calculateRttStats(samples: number[], attempts: number): RttStats {
  const clean = samples.filter((n) => Number.isFinite(n) && n >= 0);
  const sorted = [...clean].sort((a, b) => a - b);
  let median: number | null = null;
  if (sorted.length) {
    const i = Math.floor(sorted.length / 2);
    median = sorted.length % 2 ? round1(sorted[i]) : round1((sorted[i - 1] + sorted[i]) / 2);
  }
  let jitter: number | null = null;
  if (clean.length > 1) {
    let total = 0;
    for (let i = 1; i < clean.length; i += 1) total += Math.abs(clean[i] - clean[i - 1]);
    jitter = round1(total / (clean.length - 1));
  }
  return {
    samples: clean.map(round1),
    average: clean.length ? round1(clean.reduce((a, b) => a + b, 0) / clean.length) : null,
    median,
    jitter,
    loss: attempts > 0 ? Math.round(((attempts - clean.length) / attempts) * 100) : 0,
    attempts,
  };
}

/**
 * Measure real request RTT to `url`.
 * - hard timeout per sample
 * - no-store + cache-busting query
 * - opaque no-cors responses still count as a real completed request
 */
export async function measureFetchRtt(options: {
  url: string;
  attempts: number;
  timeoutMs: number;
  mode?: RequestMode;
}): Promise<RttStats> {
  const attempts = Math.max(1, Math.min(10, Math.floor(options.attempts)));
  const timeoutMs = Math.max(250, Math.min(15_000, Math.floor(options.timeoutMs)));
  const samples: number[] = [];

  for (let i = 0; i < attempts; i += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const started = performance.now();
    try {
      const u = new URL(options.url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      u.searchParams.set("_rtt", `${Date.now()}-${i}`);
      await fetch(u.toString(), {
        mode: options.mode,
        cache: "no-store",
        signal: ctrl.signal,
      });
      const elapsed = performance.now() - started;
      if (elapsed >= 0 && elapsed <= timeoutMs) samples.push(elapsed);
    } catch { /* failed/aborted sample counts toward real loss */ }
    finally { clearTimeout(timer); }
  }

  return calculateRttStats(samples, attempts);
}
