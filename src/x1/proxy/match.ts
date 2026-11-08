// DNS ↔ PROXY matching intelligence.
// Finds the best DNS + proxy pairings based on network affinity (same ASN),
// combined gaming quality, path diversity, and (when available) the user's
// geographic proximity to the endpoints.
import type { ProxyAnalysis, ProxyRecord } from "./engine";
import type { DnsAnalysis, DnsRecord } from "../dns/types";
import { distanceTo } from "../geo/distances";

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const round = (n: number, d = 0): number => { const f = 10 ** d; return Math.round(n * f) / f; };

export interface UserGeo { lat: number; lng: number; }

/** The user's live network (detected from their public IP). */
export interface UserNetwork { asn: string | null; isp: string | null; }

export interface DnsProxyMatch {
  dns: DnsRecord;
  proxy: ProxyRecord;
  matchScore: number;
  sameAsn: boolean;
  sameIsp: boolean;
  onUserNetwork: boolean;      // both endpoints sit on the user's own ISP network
  geoKm: number | null;        // combined distance from user to DNS + proxy (km)
  rationale: string;
}

export interface MatchResult {
  matches: DnsProxyMatch[];
  best: DnsProxyMatch | null;
  onUserNetwork: DnsProxyMatch | null; // best pair fully inside the user's ISP
  diverse: DnsProxyMatch | null;       // best cross-network pair (redundancy)
  closest: DnsProxyMatch | null;       // geographically closest pair (if GPS)
  usedGeo: boolean;
  usedNetwork: boolean;
}

/** Matching balances: the user's OWN network first, then ASN affinity,
 *  combined quality, path diversity, and geographic proximity. */
export function matchDnsProxy(
  dns: DnsAnalysis,
  proxy: ProxyAnalysis,
  limit = 8,
  user: UserGeo | null = null,
  network: UserNetwork | null = null,
): MatchResult {
  const dnsRanked = dns.ranked.filter((r) => r.gamingScore !== null).slice(0, 20);
  const proxyRanked = proxy.ranked.slice(0, 20);
  if (dnsRanked.length === 0 || proxyRanked.length === 0) {
    return { matches: [], best: null, onUserNetwork: null, diverse: null, closest: null, usedGeo: false, usedNetwork: false };
  }

  const userAsn = network?.asn ?? null;

  const scored: DnsProxyMatch[] = [];
  for (const d of dnsRanked) {
    for (const p of proxyRanked) {
      const sameAsn = d.verification.asn === p.asn;
      const sameIsp = d.isp === p.isp;
      // On the user's own network = both DNS and proxy share the user's ISP/ASN.
      const dnsOnUser = userAsn !== null && d.verification.asn === userAsn;
      const proxyOnUser = userAsn !== null && p.asn === userAsn;
      const onUserNetwork = userAsn !== null && dnsOnUser && proxyOnUser;

      const dnsScore = d.gamingScore ?? 0;
      const proxyScore = p.gamingScore ?? 0;
      const combined = dnsScore * 0.55 + proxyScore * 0.45;

      // Strongest signal: everything stays on the user's own ISP network.
      const affinity = onUserNetwork ? 20 : sameAsn ? 12 : sameIsp ? 7 : 0;
      const matchScore = round(clamp(combined + affinity, 0, 100));

      let geoKm: number | null = null;
      if (user) {
        const dKm = distanceTo(d.ip, user.lat, user.lng).km;
        const pKm = distanceTo(p.host, user.lat, user.lng).km;
        geoKm = round(dKm * 0.5 + pKm * 0.5, 1);
      }

      const rationale = onUserNetwork
        ? `On YOUR network (${userAsn}) — DNS and proxy both run on your ISP, fully consistent with your Wi-Fi`
        : user && geoKm !== null
          ? `Closest pair (~${geoKm} km) · ${sameAsn ? "same network" : "cross-network"}`
          : sameAsn
            ? `Same network (${p.asn}) — one routing domain, minimal cross-network hops`
            : sameIsp
              ? `Same provider (${d.isp}) — provider-level affinity`
              : `Cross-network (${d.verification.asn ?? "?"} ↔ ${p.asn}) — maximum path diversity`;

      scored.push({ dns: d, proxy: p, matchScore, sameAsn, sameIsp, onUserNetwork, geoKm, rationale });
    }
  }

  scored.sort((a, b) =>
    b.matchScore - a.matchScore ||
    a.dns.metrics.avg + a.proxy.metrics.avg - (b.dns.metrics.avg + b.proxy.metrics.avg));

  const matches = scored.slice(0, limit);
  const onUserNetwork = scored.find((m) => m.onUserNetwork) ?? null;
  const diverse = scored.find((m) => !m.sameAsn) ?? null;
  const closest = user
    ? [...scored].sort((a, b) => (a.geoKm ?? Infinity) - (b.geoKm ?? Infinity))[0] ?? null
    : null;
  return { matches, best: matches[0] ?? null, onUserNetwork, diverse, closest, usedGeo: user !== null, usedNetwork: userAsn !== null };
}
