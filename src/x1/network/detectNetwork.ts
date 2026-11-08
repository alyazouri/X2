// NETWORK DETECTION — discovers the user's current network (public IP → ASN → ISP).
// Browsers cannot read the OS's configured DNS servers, but the public IP's ASN
// identifies the ISP, which in turn identifies the DNS resolvers that network uses.
// This is an honest, verifiable detection (no guessing).

export interface NetworkInfo {
  ip: string | null;
  asn: string | null;       // e.g. "AS8376"
  isp: string | null;       // e.g. "Jordan Data Communications Company LLC"
  org: string | null;
  city: string | null;
  country: string | null;
  source: string;
}

/** Map a detected ASN/ISP to the friendly ISP name used across this project. */
export function friendlyIspName(asn: string | null, isp: string | null): string | null {
  if (!asn && !isp) return null;
  const text = `${asn ?? ""} ${isp ?? ""}`.toLowerCase();
  const table: [RegExp, string][] = [
    [/as8376|orange|jordan data communications|jordan telecom|go\.com\.jo/, "Orange Jordan"],
    [/as48832|zain|jordanian mobile/, "Zain Jordan"],
    [/as9038|umniah|bahrainia/, "Umniah"],
    [/as47887|damamax|hadatheh/, "Damamax"],
    [/as50670|vtel/, "VTEL Jordan"],
    [/as8934|nitc|national information technology/, "Jordan NITC"],
    [/as35656|junet|universities/, "Jordan University Network (JUNet)"],
    [/as8697/, "Jordan Telecom"],
    [/as28730|blink/, "Blink Jordan"],
  ];
  for (const [re, name] of table) if (re.test(text)) return name;
  return null;
}

interface WhoIsResponse { ip?: string; connection?: { asn?: number; org?: string; isp?: string }; city?: string; country?: string; }
interface IpApiResponse { ip?: string; asn?: string; org?: string; city?: string; country_name?: string; }

async function fetchJson(url: string, timeoutMs = 6000): Promise<unknown> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (e) {
    clearTimeout(to);
    throw e;
  }
}

/** Detect the user's network. Tries multiple CORS-friendly sources with fallback. */
export async function detectNetwork(): Promise<NetworkInfo | null> {
  // 1) ipwho.is — free, CORS-enabled, returns ASN + ISP.
  try {
    const d = (await fetchJson("https://ipwho.is/")) as WhoIsResponse;
    if (d?.ip) {
      return {
        ip: d.ip,
        asn: d.connection?.asn ? `AS${d.connection.asn}` : null,
        isp: d.connection?.isp ?? null,
        org: d.connection?.org ?? null,
        city: d.city ?? null,
        country: d.country ?? null,
        source: "ipwho.is",
      };
    }
  } catch { /* try next */ }

  // 2) ipapi.co — fallback, CORS-enabled.
  try {
    const d = (await fetchJson("https://ipapi.co/json/")) as IpApiResponse;
    if (d?.ip) {
      return {
        ip: d.ip,
        asn: d.asn ?? null,
        isp: d.org ?? null,
        org: d.org ?? null,
        city: d.city ?? null,
        country: d.country_name ?? null,
        source: "ipapi.co",
      };
    }
  } catch { /* try next */ }

  // 3) Cloudflare trace — public IP + colo only (no ASN), used as last resort.
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch("https://www.cloudflare.com/cdn-cgi/trace", { cache: "no-store", signal: ctrl.signal });
    clearTimeout(to);
    const text = await res.text();
    const ip = text.match(/^ip=(.+)$/m)?.[1] ?? null;
    const colo = text.match(/^colo=(.+)$/m)?.[1] ?? null;
    const loc = text.match(/^loc=(.+)$/m)?.[1] ?? null;
    if (ip) {
      return { ip, asn: null, isp: null, org: null, city: colo, country: loc, source: "cloudflare trace" };
    }
  } catch { /* all failed */ }

  return null;
}

/** Shared store so every analyzer can read the detected network. */
let cached: NetworkInfo | null = null;
export const networkStore = {
  set(info: NetworkInfo | null): void { cached = info; },
  get(): NetworkInfo | null { return cached; },
};
