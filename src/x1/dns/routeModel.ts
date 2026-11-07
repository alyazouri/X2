// DNS route distribution model — estimates how much of the path to each DNS
// traverses Jordanian network vs Saudi transit.
// NOTE: browsers cannot run traceroute. This is an explainable statistical
// model combining (1) verified host location/prefix ownership, and
// (2) measured round-trip latency as a geographic distance proxy.
// It is an ESTIMATE, not a live per-hop measurement.

import { isIPv6, prefixOf } from "./dataset";
import type { DnsRecord } from "./types";
import type { SampleSet } from "./types";

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));
const round1 = (n: number): number => Math.round(n * 10) / 10;

export interface RouteEstimate {
  jordan: number;  // % of modeled path traversing Jordanian network
  saudi: number;   // % of modeled path traversing Saudi transit
  local: boolean;  // host is Jordanian infrastructure (not abroad / anycast)
}

interface RouteBase { jo: number; sa: number; }

/** Baseline (pre-latency) per prefix based on host location:
 *  - Jordan domestic hosts: mostly local routing, small international egress.
 *  - Global/unverified prefixes: more WAN/Saudi transit. */
const BASE_BY_PREFIX: Record<string, RouteBase> = {
  // AS8376 — Orange Jordan (domestic Amman)
  "46.185": { jo: 93, sa: 4 }, "86.108": { jo: 93, sa: 4 },
  "92.253": { jo: 94, sa: 3 }, "37.202": { jo: 94, sa: 3 },
  "212.118": { jo: 95, sa: 2 }, "212.34": { jo: 95, sa: 2 },
  "212.35": { jo: 95, sa: 2 }, "80.90": { jo: 93, sa: 4 },
  "194.165": { jo: 93, sa: 4 }, "79.173": { jo: 95, sa: 2 }, "149.200": { jo: 93, sa: 4 },
  // AS8934 — Jordan NITC (government network, Amman)
  "193.188": { jo: 97, sa: 1 },
  // AS48832 — Zain Jordan (domestic Amman)
  "176.29": { jo: 94, sa: 3 }, "46.32": { jo: 94, sa: 3 }, "217.23": { jo: 94, sa: 3 }, "188.247": { jo: 94, sa: 3 },
  // AS9038 — Umniah (Amman)
  "85.159": { jo: 94, sa: 3 }, "109.107": { jo: 94, sa: 3 },
  // AS47887 — Damamax (Amman)
  "82.212": { jo: 94, sa: 3 },
  // AS28730 — Blink Jordan
  "93.95": { jo: 92, sa: 5 },
  // AS35656 — JUNet (universities, Amman)
  "87.236": { jo: 96, sa: 2 },
  // AS50670 — VTEL Jordan (Amman)
  "109.237": { jo: 93, sa: 4 }, "178.20": { jo: 93, sa: 4 }, "176.241": { jo: 93, sa: 4 },
  "77.245": { jo: 94, sa: 3 }, "213.186": { jo: 93, sa: 4 },
  "176.28": { jo: 94, sa: 3 },
  "185.98": { jo: 93, sa: 4 }, "94.249": { jo: 93, sa: 4 },
  "5.198": { jo: 94, sa: 3 }, "91.106": { jo: 94, sa: 3 },
  "185.96": { jo: 93, sa: 4 },
  "217.144": { jo: 93, sa: 4 },
  "79.134": { jo: 92, sa: 5 },
};

const V6_BASE: RouteBase[] = [
  { jo: 93, sa: 4 },  // Orange Jordan IPv6
  { jo: 96, sa: 2 },  // Jordan NITC (ccTLD)
];

function baseFor(ip: string, isp: string): RouteBase {
  if (isIPv6(ip)) return isp.includes("ccTLD") || isp.includes("NITC") ? V6_BASE[1] : V6_BASE[0];
  return BASE_BY_PREFIX[prefixOf(ip)] ?? { jo: 75, sa: 14 };
}

/** Saudi route estimate: Saudi DNS routes almost entirely domestically. */
export function saudiRouteEstimate(record: DnsRecord, samples: SampleSet | undefined): RouteEstimate {
  const base = { sa: 95, jo: 3 };
  let sa = base.sa;
  if (record.hasData && samples !== undefined) {
    const avg = samples.rtts.length ? samples.rtts.reduce((a, v) => a + v, 0) / samples.rtts.length : null;
    if (avg !== null) {
      const shift = clamp(Math.max(0, avg - 20) / 15 * 3, 0, 18);
      sa = base.sa - shift;
    }
  }
  sa = clamp(sa, 60, 98);
  return { saudi: round1(sa), jordan: round1(3), local: true };
}

/** Estimated route distribution: base topology × measured latency adjustment. */
export function routeEstimate(record: DnsRecord, samples: SampleSet | undefined): RouteEstimate {
  const b = baseFor(record.ip, record.isp);
  // If we have real latency data, adjust the model by RTT (proxy for distance).
  let joystick = b.jo;
  let saudi = b.sa;
  if (record.hasData && samples !== undefined) {
    const avg = samples.rtts.length
      ? samples.rtts.reduce((a, v) => a + v, 0) / samples.rtts.length
      : null;
    if (avg !== null) {
      // Crisp RTT tiers (explained): faster ⇒ locally routed, slower ⇒ WAN/Saudi.
      // Each +15 ms beyond 20 ms shifts ~3% from Jordan to Saudi.
      const excessMs = Math.max(0, avg - 20);
      const shift = clamp(excessMs / 15 * 3, 0, 18);
      joystick = b.jo - shift;
      saudi = b.sa + Math.min(shift * 0.55, 16); // Saudi share rises with WAN distance
    }
  }
  joystick = clamp(joystick, 60, 98);
  saudi = clamp(saudi, 0, 30);
  const local = baseFor(record.ip, record.isp).jo >= 88;
  return { jordan: round1(joystick), saudi: round1(saudi), local };
}
