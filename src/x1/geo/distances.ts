// GEO INTELLIGENCE — approximate Jordanian-network endpoint coordinates +
// Haversine distance. Coordinates come from RIPE allocation city data
// (Amman is the dominant Jordanian hosting location; a few endpoints are in
// Zarqa / Balqa). These are honest approximations, not per-hop measurements.

export interface CityCoord { lat: number; lng: number; city: string; }

const AMMAN: CityCoord = { lat: 31.9552, lng: 35.9450, city: "Amman" };
const ZARQA: CityCoord = { lat: 31.8791, lng: 35.9210, city: "Khuraybat as Suq (Zarqa)" };

/** Approximate endpoint (city) by network prefix — from RIPE/ipinfo allocation city. */
const CITY_BY_PREFIX: Record<string, CityCoord> = {
  // AS8376 Orange / Amman
  "46.185": AMMAN, "86.108": AMMAN, "92.253": AMMAN, "37.202": AMMAN,
  "212.118": AMMAN, "212.34": AMMAN, "212.35": AMMAN, "80.90": AMMAN,
  "194.165": AMMAN, "79.173": AMMAN, "149.200": AMMAN, "213.186": AMMAN,
  "188.123": AMMAN,
  // AS48832 Zain / Amman (188.247.93.x is Khuraybat as Suq/Zarqa per ipinfo)
  "176.29": AMMAN, "46.32": AMMAN, "217.23": AMMAN, "176.28": AMMAN, "46.23": AMMAN,
  // AS9038 Umniah / Amman
  "85.159": AMMAN, "109.107": AMMAN,
  "37.220": AMMAN,
  // AS47887 Damamax / Amman
  "82.212": AMMAN,
  // AS50670 VTEL / Amman
  "109.237": AMMAN, "178.20": AMMAN, "176.241": AMMAN,
  // AS8934 NITC / Amman
  "193.188": AMMAN,
  // AS35656 JUNet / Amman
  "87.236": AMMAN,
  // AS28730 Blink / Amman
  "93.95": AMMAN,
  // AS8697 Jordan Telecom / Amman
  "188.247": ZARQA,
};

/** IPv6 defaults to Amman (all verified Jordanian allocations are Amman-based). */
export function endpointCity(ipOrHost: string): CityCoord {
  if (ipOrHost.includes(":") && ipOrHost.split(":").length > 2) return AMMAN; // IPv6
  const prefix = ipOrHost.split(".").slice(0, 2).join(".");
  return CITY_BY_PREFIX[prefix] ?? AMMAN;
}

/** Great-circle distance (km) between two lat/lng points. */
export function haversineKm(a: CityCoord, b: CityCoord): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number { return (deg * Math.PI) / 180; }

/** Estimated one-way network distance from user to a server endpoint (km).
 *  Uses Haversine; the measured RTT remains the authoritative "nearest" metric
 *  because it is the true network distance, this only refines it geographically. */
export function distanceTo(ipOrHost: string, userLat: number, userLng: number): {
  km: number; city: string;
} {
  const server = endpointCity(ipOrHost);
  const km = haversineKm({ lat: userLat, lng: userLng, city: "" }, server);
  return { km: Math.round(km * 10) / 10, city: server.city };
}
