// ════════════════════════════════════════════════════════════════
// GITHUB RESOLVER SYNC — extract real IPv4 addresses from raw list files.
// Pure and unit-testable; the route does the fetching, this does the parse.
// ════════════════════════════════════════════════════════════════

export interface ResolverSource {
  repo: string;              // owner/name
  paths: string[];           // known file paths to try, in order
}

/** GitHub resolver sources — every path verified LIVE (content fetched + IPv4
 *  extracted) before listing. Any source that returns nothing is reported
 *  honestly in the sync response instead of faking coverage. */
export const RESOLVER_SOURCES: ResolverSource[] = [
  { repo: "trybyteful/public-dns-directory", paths: [
    // Rich metadata (country/continent/org); Jordan file is explicit so JO
    // remains available even if a continent export changes.
    "main/data/by-country/jo.json",
    "main/data/by-continent/af.json", "main/data/by-continent/as.json",
    "main/data/by-continent/eu.json", "main/data/by-continent/na.json",
    "main/data/by-continent/sa.json", "main/data/by-continent/oc.json",
  ] },
  // janmasarik/resolvers returns no IPs at its listed paths (verified live);
  // it stays documented as a seed source but is not a sync fetch target.
  { repo: "rix4uni/resolvers", paths: ["main/resolvers.txt", "master/resolvers.txt"] },
  { repo: "kh4sh3i/Fresh-Resolvers", paths: ["main/resolvers.txt", "master/resolvers.txt"] },
  { repo: "lulushuz/Awesome-Resolver", paths: ["main/dns-all-up.json"] },
  { repo: "neargle/public-dns-list", paths: ["master/all.txt", "master/china.txt"] },
  { repo: "cujanovic/public-dns-resolvers", paths: ["master/resolvers.txt", "main/resolvers.txt", "main/ips-all.txt"] },
  // Additional repositories — every raw path below was fetched and parsed
  // successfully before registration (counts documented in PROJECT_PROMPT.md).
  { repo: "trickest/resolvers", paths: ["main/resolvers.txt"] },
  { repo: "Findomain/fresh-resolvers", paths: ["main/resolvers.txt"] },
  { repo: "0xAb1d/TrueResolvers", paths: ["main/resolvers.txt", "main/resolvers-trusted.txt"] },
  { repo: "OpenResolversFoundation/openresolvers", paths: ["main/resolvers.txt"] },
  { repo: "Phasip/resolvers", paths: ["master/resolvers.txt"] },
  { repo: "hackeyMonkey/public-dns-resolvers", paths: ["master/resolvers.txt"] },
  // Two more validated forks with live resolvers.txt (verified live).
  { repo: "bbhunter/resolvers", paths: ["master/resolvers.txt"] },
  { repo: "kotrouss/resolvers", paths: ["master/resolvers.txt"] },
  // Curated verified dataset with structured metadata (variants/filtering/DoH).
  { repo: "denizsnet/public-dns-servers", paths: ["main/dns-servers.json", "main/dns-servers.csv"] },
];

// One IPv4 literal per token; anything else (comments, hosts, %markers) is ignored.
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

/** Extract + sanitize + dedupe IPv4 addresses from raw file text. */
export function extractIpv4(text: string): string[] {
  const out = new Set<string>();
  const matches = text.match(IPV4_RE) ?? [];
  for (const m of matches) {
    const octets = m.split(".").map(Number);
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) continue;
    // Exclude reserved/private ranges — a public resolver list never means them,
    // and host-scanning them is meaningless.
    const a = octets[0], b = octets[1];
    if (a === 0 || a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a >= 224) continue;
    out.add(octets.join("."));
  }
  return [...out];
}

export interface SourceResult {
  repo: string;
  ips: string[];
  path: string | null;
}

/** Rich resolver record — only real metadata the source document carries. */
export interface ResolverEntry {
  ip: string;
  country: string | null;
  countryCode: string | null;
  continent: string | null;
  organization: string | null;
}

/** Parse trybyteful per-continent JSON: { metadata, resolvers: [...] }. */
export function parseContinentJson(text: string): ResolverEntry[] {
  try {
    const j = JSON.parse(text) as {
      metadata?: { continent?: string };
      resolvers?: {
        ip?: string; country?: string; country_code?: string;
        continent?: string; organization?: string | null;
      }[];
    };
    if (!Array.isArray(j.resolvers)) return [];
    const out: ResolverEntry[] = [];
    for (const r of j.resolvers) {
      if (typeof r.ip !== "string") continue;
      const ips = extractIpv4(r.ip);
      if (!ips.length) continue;
      out.push({
        ip: ips[0],
        country: typeof r.country === "string" ? r.country : null,
        countryCode: typeof r.country_code === "string" ? r.country_code : null,
        continent: typeof r.continent === "string" ? r.continent : (typeof j.metadata?.continent === "string" ? j.metadata.continent : null),
        organization: typeof r.organization === "string" ? r.organization : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Merge rich entries by IP — records WITH country metadata win over plain ones. */
export function mergeEntries(parts: { ips: string[]; entries: ResolverEntry[] }[]): ResolverEntry[] {
  const byIp = new Map<string, ResolverEntry>();
  for (const part of parts) {
    for (const e of part.entries) {
      const prev = byIp.get(e.ip);
      if (!prev || (!prev.country && e.country)) byIp.set(e.ip, e);
    }
    for (const ip of part.ips) {
      if (!byIp.has(ip)) byIp.set(ip, { ip, country: null, countryCode: null, continent: null, organization: null });
    }
  }
  return [...byIp.values()];
}

/** Structured provider dataset (denizsnet/public-dns-servers): every entry is
 *  verified by that project's maintainers with variant + filtering metadata. */
export function parseProviderJson(text: string): ResolverEntry[] {
  try {
    const j = JSON.parse(text) as { servers?: { provider?: string; variant?: string; ipv4?: string[]; filtering?: string }[] }
      | { provider?: string; variant?: string; ipv4?: string[]; filtering?: string }[];
    const list = Array.isArray(j) ? j : (j.servers ?? []);
    if (!Array.isArray(list)) return [];
    const out: ResolverEntry[] = [];
    for (const s of list) {
      const provider = typeof s?.provider === "string" ? s.provider : null;
      const variant = typeof (s as { variant?: string } | null)?.variant === "string" ? (s as { variant: string }).variant : null;
      const filtering = typeof (s as { filtering?: string } | null)?.filtering === "string" ? (s as { filtering: string }).filtering : null;
      for (const raw of Array.isArray(s?.ipv4) ? s.ipv4 : []) {
        if (typeof raw !== "string") continue;
        const ips = extractIpv4(raw);
        if (!ips.length) continue;
        out.push({
          ip: ips[0],
          country: provider ? `${provider}${variant ? ` (${variant})` : ""}` : "Verified list",
          countryCode: null,
          continent: null,
          organization: filtering,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Merge per-source results into one deduped list (first-seen order). */
export function mergeSources(parts: SourceResult[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    for (const ip of part.ips) {
      if (seen.has(ip)) continue;
      seen.add(ip);
      out.push(ip);
    }
  }
  return out;
}
