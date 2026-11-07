// ════════════════════════════════════════════════════════════════
// DNS GAMING INTELLIGENCE — Saudi DNS Dataset (separate pool)
// Verified against ipinfo/RIPE allocation data.
// EXCLUDED: 87.236.136.3 → Bahrain (Nuetel, AS35568), not Saudi.
// ════════════════════════════════════════════════════════════════

export type SaudiIsp =
  | "STC" | "Mobily" | "Zain KSA" | "Etihad Etisalat" | "Nour"
  | "AWAL" | "Applied Technologies" | "Saudi Net" | "Unknown Saudi ISP";

/** Full Saudi DNS list. Set enforces uniqueness at source. */
export const SAUDI_DNS: string[] = Array.from(new Set<string>([
  // 2.88.x / 2.89.x — STC (AS25019)
  "2.88.93.191", "2.88.148.46", "2.88.152.172", "2.88.26.22", "2.88.142.172", "2.88.134.157",
  "2.89.169.196", "2.89.212.177",
  // 5.42.x — Mobily (AS35242)
  "5.42.254.85", "5.42.248.31", "5.42.246.46", "5.42.254.82", "5.42.254.84",
  // 5.163.x — Mobily
  "5.163.124.76",
  // 50.61.x — STC
  "50.61.33.230",
  // 78.93.x — AWAL / Arabian Internet (AS25233)
  "78.93.157.161", "78.93.156.17", "78.93.193.36", "78.93.66.145",
  // 31.166.x / 31.167.x — STC
  "31.166.235.236", "31.166.21.202",
  "31.167.79.1", "31.167.149.251", "31.167.97.77", "31.167.176.106", "31.167.161.181",
  // 141.164.x — STC Jeddah
  "141.164.147.110",
  // 176.45.x — STC
  "176.45.168.235",
  // 94.97.x — STC
  "94.97.245.37", "94.97.248.221", "94.97.253.127",
  // 37.224.x — Mobily
  "37.224.101.19", "37.224.42.81", "37.224.89.83",
  // 178.86.x / 178.80.x — STC
  "178.86.81.144", "178.80.8.74", "178.80.65.252",
  // 144.24.x — STC
  "144.24.215.63",
  // 51.211.x — STC
  "51.211.180.141", "51.211.167.107", "51.211.177.81",
  // 178.20.148.0/23 — Nour Internet (AS29684)
  "178.20.149.155", "178.20.145.45",
  // 93.112.x — Etihad Etisalat / Mobily
  "93.112.1.57", "93.112.194.187", "93.112.174.77", "93.112.156.8",
  "93.112.158.140", "93.112.8.242", "93.112.46.226", "93.112.23.229", "93.112.0.71",
  // 185.137.x
  "185.137.244.2",
  // 212.33.160.0/19 — Applied Technologies (AS41132)
  "212.33.190.217",
  // 95.219.x — Mobily
  "95.219.6.15",
  // 176.224.x — Zain KSA
  "176.224.228.209", "176.224.75.59", "176.224.230.198", "176.224.254.80",
  // 212.102.x — STC
  "212.102.0.102",
  // 95.177.x
  "95.177.177.225", "95.177.176.8",
  // 77.232.x
  "77.232.96.139", "77.232.98.10",
  // 87.101.x
  "87.101.153.50", "87.101.204.72",
  // 88.85.x / 88.213.x
  "88.85.251.150", "88.213.89.246", "88.213.85.230",
  // 212.70.x
  "212.70.49.96",
  // 94.77.x / 94.49.x — STC
  "94.77.227.82", "94.77.249.119", "94.77.205.170", "94.49.27.139",
  // 51.195.x — OVH/other
  "51.195.217.245",
  // 195.122.x
  "195.122.70.234",
  // 86.51.x
  "86.51.155.82", "86.51.39.250", "86.51.159.33", "86.51.157.252",
  // 8.213.x
  "8.213.0.112", "8.213.0.111",
  // 85.194.x
  "85.194.70.174", "85.194.121.250",
  // 83.101.x
  "83.101.128.173",
  // 150.230.x
  "150.230.247.162",
  // 85.208.x
  "85.208.52.73",
  // 89.108.x
  "89.108.26.56",
]));

/** Saudi ISP inference by /16 prefix. */
const SA_ISP_BY_PREFIX: Record<string, SaudiIsp> = {
  "2.88": "STC", "2.89": "STC",
  "5.42": "Mobily", "5.163": "Mobily", "37.224": "Mobily", "95.219": "Mobily",
  "50.61": "STC", "141.164": "STC", "176.45": "STC", "94.97": "STC",
  "178.86": "STC", "178.80": "STC", "144.24": "STC", "51.211": "STC",
  "212.102": "STC", "94.77": "STC", "94.49": "STC",
  "78.93": "AWAL",
  "31.166": "STC", "31.167": "STC",
  "93.112": "Etihad Etisalat",
  "178.20": "Nour",
  "212.33": "Applied Technologies",
  "176.224": "Zain KSA",
};

export const SAUDI_ISPS: SaudiIsp[] = [
  "STC", "Mobily", "Zain KSA", "Etihad Etisalat", "Nour",
  "AWAL", "Applied Technologies", "Unknown Saudi ISP",
];

const SA_DOMAIN: Record<string, string> = {
  "2.88": "stc.com.sa", "2.89": "stc.com.sa", "50.61": "stc.com.sa",
  "141.164": "stc.com.sa", "176.45": "stc.com.sa", "94.97": "stc.com.sa",
  "178.86": "stc.com.sa", "178.80": "stc.com.sa", "144.24": "stc.com.sa",
  "51.211": "stc.com.sa", "212.102": "stc.com.sa", "94.77": "stc.com.sa",
  "94.49": "stc.com.sa", "31.166": "stc.com.sa", "31.167": "stc.com.sa",
  "5.42": "mobily.com.sa", "5.163": "mobily.com.sa", "37.224": "mobily.com.sa",
  "95.219": "mobily.com.sa", "93.112": "etihadetisalat.com",
  "78.93": "solutions.com.sa", "178.20": "nour.net.sa",
  "212.33": "app-tec.com", "176.224": "sa.zain.com",
};

export function saudiIspOf(ip: string): SaudiIsp {
  const prefix = ip.split(".").slice(0, 2).join(".");
  return SA_ISP_BY_PREFIX[prefix] ?? "Unknown Saudi ISP";
}

export function saudiDomainOf(ip: string): string {
  const prefix = ip.split(".").slice(0, 2).join(".");
  return SA_DOMAIN[prefix] ?? "local";
}

/** Saudi city coordinates for distance estimates (Riyadh default). */
export const SAUDI_CITIES: Record<string, { lat: number; lng: number; city: string }> = {
  default: { lat: 24.7136, lng: 46.6753, city: "Riyadh" },
  jeddah: { lat: 21.4858, lng: 39.1925, city: "Jeddah" },
  medina: { lat: 24.5247, lng: 39.5692, city: "Medina" },
};

export function saudiCityOf(ip: string): { lat: number; lng: number; city: string } {
  if (ip.startsWith("141.164")) return SAUDI_CITIES.jeddah;
  if (ip.startsWith("51.211")) return SAUDI_CITIES.medina;
  return SAUDI_CITIES.default;
}
