// ════════════════════════════════════════════════════════════════
// DNS GAMING INTELLIGENCE — Master DNS Dataset (Jordan pool)
// Source of truth. Every IP here is analyzed (none dropped before analysis).
// Duplicate IPs are merged by the engine (IP = unique identifier).
// ISP labels are INFERENCE from public IP-allocation prefixes
// (not invention); unconfident prefixes → "Unknown Jordan ISP".
// ════════════════════════════════════════════════════════════════

/** Full master list of DNS IPv4 addresses. Set enforces uniqueness at source. */
export const MASTER_DNS: string[] = Array.from(new Set<string>([
  // 46.185.x.x
  "46.185.129.130", "46.185.129.77", "46.185.138.166", "46.185.139.40", "46.185.139.160", "46.185.161.76", "46.185.162.241", "46.185.198.84", "46.185.208.246", "46.185.213.40",
  // 212.118.0.0/19 — Umniah (AS9038, RIPE RDAP: MNT-UMNIAH-JO)
  "212.118.0.2", "212.118.0.1", "212.118.1.10", "212.118.2.91", "212.118.7.147", "212.118.8.188", "212.118.12.22", "212.118.12.23", "212.118.12.90", "212.118.14.21", "212.118.14.34", "212.118.14.36", "212.118.14.134", "212.118.19.114", "212.118.19.199", "212.118.19.212", "212.118.19.213", "212.118.24.93", "212.118.29.114",
  // 213.139.x.x
  "213.139.57.12", "213.139.57.13", "213.139.57.20", "213.139.57.22", "213.139.57.28", "213.139.57.30", "213.139.57.31", "213.139.57.68", "213.139.57.71", "213.139.57.76", "213.139.57.86", "213.139.57.93", "213.139.57.100", "213.139.57.101", "213.139.57.103",
  // 213.186.x.x
  "213.186.163.115", "213.186.163.116", "213.186.174.123", "213.186.174.202",
  // 212.34.x.x
  "212.34.29.168", "212.34.30.10", "212.34.0.140",
  // 212.35.x.x
  "212.35.65.2", "212.35.67.178", "212.35.72.10", "212.35.73.194",
  // 92.253.x.x
  "92.253.9.136", "92.253.13.100", "92.253.18.250", "92.253.19.31", "92.253.19.65", "92.253.23.85", "92.253.48.187", "92.253.60.84", "92.253.92.116", "92.253.92.117", "92.253.101.9", "92.253.101.67", "92.253.101.217", "92.253.102.6", "92.253.120.32", "92.253.121.179", "92.253.122.255", "92.253.123.145", "92.253.123.214", "92.253.125.74", "92.253.127.139",
  "92.253.23.8", "92.253.60.133", "92.253.127.65",
  // 91.106.x.x
  "91.106.99.238", "91.106.99.239", "91.106.99.244", "91.106.99.245", "91.106.106.138", "91.106.111.75", "91.106.99.231", "91.106.99.246",
  "91.106.105.218", "91.106.107.227",
  // 217.23.x.x
  "217.23.37.74",
  // 86.108.x.x
  "86.108.8.161", "86.108.8.157", "86.108.11.3", "86.108.14.2", "86.108.14.128", "86.108.44.12", "86.108.45.170", "86.108.46.200", "86.108.59.62", "86.108.77.252",
  // 77.245.x.x
  "77.245.2.219", "77.245.2.220", "77.245.2.216", "77.245.2.218", "77.245.2.221", "77.245.2.222", "77.245.3.158", "77.245.10.30", "77.245.12.169", "77.245.13.191",
  // 94.142.x.x
  "94.142.37.179", "94.142.38.212", "94.142.38.213", "94.142.40.39", "94.142.53.34",
  // 37.202.x.x
  "37.202.67.44", "37.202.78.1", "37.202.83.30", "37.202.96.52", "37.202.127.139",
  // 82.212.x.x
  "82.212.70.66", "82.212.72.18", "82.212.79.115", "82.212.82.198", "82.212.84.109", "82.212.84.139", "82.212.84.161", "82.212.84.182", "82.212.84.211", "82.212.85.176", "82.212.92.81", "82.212.92.82", "82.212.92.90", "82.212.92.109", "82.212.92.112", "82.212.92.121", "82.212.92.122", "82.212.106.11",
  // 176.29.x.x
  "176.29.114.132", "176.29.114.141", "176.29.114.149", "176.29.114.159", "176.29.114.180", "176.29.114.181", "176.29.114.182", "176.29.114.183", "176.29.114.188", "176.29.114.190", "176.29.114.198", "176.29.151.152", "176.29.153.215", "176.29.154.115", "176.29.174.7", "176.29.176.230", "176.29.199.51", "176.29.199.164", "176.29.200.50",
  // 109.237.x.x / 178.20.x.x / 176.241.x.x — VTEL Jordan (AS50670, verified)
  "109.237.193.178", "109.237.197.6", "109.237.197.95", "109.237.197.195", "109.237.198.252", "109.237.201.32", "109.237.205.149", "109.237.205.167",
  "109.237.202.116",
  "178.20.185.2", "178.20.185.4", "178.20.185.5", "178.20.185.29", "178.20.185.30", "178.20.189.102", "178.20.189.206",
  "176.241.64.171",
  // 81.21.0.0/16 — VTEL Jordan (AS50670, verified ipwho.is)
  "81.21.2.55", "81.21.7.201",
  "81.21.9.228", "81.21.9.230", "81.21.9.252",
  "81.21.12.13", "81.21.12.56",
  "81.21.13.210",
  // 46.32.x.x
  "46.32.96.18", "46.32.100.238", "46.32.103.170", "46.32.113.204", "46.32.114.40", "46.32.114.242", "46.32.114.248",
  // 85.159.x.x
  "85.159.216.2", "85.159.217.82", "85.159.217.98", "85.159.217.195", "85.159.220.226", "85.159.220.229", "85.159.222.2", "85.159.222.82",
  // 109.107.224.0/19 — Umniah (AS9038, verified allocation)
  "109.107.236.244", "109.107.239.52", "109.107.239.80", "109.107.239.88", "109.107.241.153", "109.107.244.50", "109.107.244.86", "109.107.244.113", "109.107.245.123",
  // 81.x.x.x
  "81.28.112.8",
  // 37.x.x.x
  "37.152.6.11", "37.220.123.91", "37.75.144.35", "37.75.144.135", "37.75.144.136", "37.75.146.35", "37.75.147.135",
  // 80.90.x.x
  "80.90.160.54", "80.90.160.58", "80.90.160.131", "80.90.160.130", "80.90.161.242", "80.90.164.61", "80.90.164.164", "80.90.164.245", "80.90.172.146",
  "80.90.161.26",
  // 188.247.64.0/19 — Zain Jordan (AS48832, verified RIPE)
  "188.247.82.221", "188.247.84.81", "188.247.86.11",
  "188.247.64.50", "188.247.70.66", "188.247.85.137", "188.247.91.154", "188.247.94.98",
  "188.247.66.0", "188.247.66.1", "188.247.66.2", "188.247.66.3", "188.247.66.4", "188.247.66.5", "188.247.66.6",
  "188.247.66.8", "188.247.66.13", "188.247.66.14", "188.247.66.15",
  // 93.95.200.0/24 — Blink Jordan / Broadband Communications LPS (AS28730)
  "93.95.200.9", "93.95.200.247", "93.95.200.239", "93.95.200.248",
  // 194.165.x.x — Orange Jordan (AS8376, 194.165.128.0/19 verified RIPE)
  "194.165.133.85", "194.165.134.85", "194.165.136.249", "194.165.143.193", "194.165.145.178",
  "194.165.151.147", "194.165.152.154", "194.165.152.155", "194.165.152.157", "194.165.152.158", "194.165.155.50", "194.165.158.181", "194.165.158.236", "194.165.159.151",
  // 193.188.64.0/19 — Jordan NITC / AS8934 (verified RIPE allocation)
  "193.188.65.170", "193.188.66.2", "193.188.66.3", "193.188.66.4",
  "193.188.69.18", "193.188.69.19", "193.188.79.139",
  // 79.173.192.0/18 — Orange Jordan (AS8376) · public recursive
  "79.173.227.37", "79.173.249.41", "79.173.250.144", "79.173.250.145", "79.173.251.142", "79.173.251.155", "79.173.252.251", "79.173.253.7", "79.173.253.59", "79.173.253.123", "79.173.253.186",
  // 213.186.x.x — Orange Jordan / JDC (AS8376, verified)
  "213.186.179.217",
  // 82.212.64.0/18 — Damamax historical candidate (AS47887)
  "82.212.107.34",
  // 86.108.0.0/17 — Orange historical candidate (AS8376)
  "86.108.15.199",
  // 188.247.80.0/21 — Zain historical candidate (AS48832)
  "188.247.93.122",
  // AS9038 — Umniah historical candidate
  "91.106.105.142",
  // 149.200.128.0/17 — Orange Jordan (AS8376, verified allocation)
  "149.200.136.234", "149.200.251.27", "149.200.251.87", "149.200.254.136",
  // 87.236.233.x — Jordanian Universities Network / JUNet (AS35656): dns2.bau.edu.jo + gateway2.ahu.edu.jo
  "87.236.233.117", "87.236.233.70",
  // 217.144.0.0/20 — Network Exchange Technology / NEXT (AS21088, Amman)
  "217.144.6.6",
  // 5.198.240.0/21 — Orbit Telecom / Umniah (AS9038, Amman)
  "5.198.243.202",
  // 176.28.250.0/24 — Zain Jordan (AS48832, Amman)
  "176.28.250.235", "176.28.250.122",
  // 185.98.225.0/24 — Orange Jordan (AS8376, Amman)
  "185.98.225.173",
  // 185.96.70.0/24 — VTEL Jordan (AS50670, Amman)
  "185.96.70.36",
  // 79.134.152.0/22 — JCS Fiberlink / Jordanian European Internet Services (AS44702, Amman)
  "79.134.152.192",
  // 94.249.14.0/24 — Orange Jordan (AS8376, Amman)
  "94.249.14.227",
  // ── JUNet expansion — Jordanian Universities Network (AS35656, verified) ──
  // 87.236.232.0/24
  "87.236.232.5", "87.236.232.36", "87.236.232.99", "87.236.232.100", "87.236.232.175", "87.236.232.176", "87.236.232.202",
  // 87.236.233.0/24 (87.236.233.70 + .117 already listed above)
  "87.236.233.180", "87.236.233.195", "87.236.233.196", "87.236.233.197", "87.236.233.198", "87.236.233.199", "87.236.233.200",
  "87.236.233.201", "87.236.233.202", "87.236.233.203", "87.236.233.204", "87.236.233.205", "87.236.233.206", "87.236.233.230",
  // 87.236.234.0/24
  "87.236.234.77",
  // 87.236.235.0/24
  "87.236.235.161", "87.236.235.162", "87.236.235.163", "87.236.235.164", "87.236.235.165", "87.236.235.166", "87.236.235.167", "87.236.235.168",
  "87.236.235.169", "87.236.235.170", "87.236.235.171", "87.236.235.172", "87.236.235.173", "87.236.235.174", "87.236.235.175", "87.236.235.176",
  "87.236.235.177", "87.236.235.178", "87.236.235.179", "87.236.235.180", "87.236.235.181", "87.236.235.182", "87.236.235.183", "87.236.235.184",
  "87.236.235.185", "87.236.235.186", "87.236.235.187", "87.236.235.188", "87.236.235.189", "87.236.235.190",
  // ── Jordan Telecom (AS8697) — 212.34.6.0/24 ──
  "212.34.6.68", "212.34.6.85", "212.34.6.87",
  // ── NEXT Jordan / Network Exchange Technology (AS21088) ──
  "217.144.6.5",
  // ── Jordanian Experts for Information Security LLC (AS208148) — 89.38.152.0/24 ──
  "89.38.152.30", "89.38.152.90", "89.38.152.91",
  // ── Abu-Ghazaleh Intellectual Property Ltd. (AS38968) — 89.28.216.0/23 ──
  "89.28.216.50", "89.28.217.118",
  // ── VTEL Jordan (AS50670) — 185.51.212.0/22 (RIPE RDAP: MNT-VTELJO) ──
  "185.51.213.14", "185.51.214.99",
  // ── Islamic International Arab Bank (AS206608, RIPE: JO-IIAB, Jordan) ──
  "185.180.80.13", "185.180.83.13",
  // ── Blink Jordan / Broadband Communications LPS (AS28730, RIPE: BLINKJO) ──
  "185.176.47.253",
  // ── Non-Jordanian (RIPE-verified, labeled truthfully — see ISP_BY_IP/PREFIX) ──
  "31.214.1.5",     // Zain Kuwait (MTC, AS42961)
  "80.10.120.44",   // Orange France (IPBRX)
  "149.200.50.11",  // Magyar Telekom (Hungary) — NOT the Orange Jordan 149.200.128+ block
]));

/** ISP inference by /16 prefix — verified against RIPE/ipinfo allocation data.
 *  Includes AS8376 Orange, AS48832 Zain, AS9038 Umniah, AS47887 Damamax,
 *  AS28730 Blink and AS35656 JUNet.
 *  Unverified prefixes → "Unknown Jordan ISP" (honest, no guessing). */
const ISP_BY_PREFIX: Record<string, string> = {
  // AS8376 — Orange Jordan
  "46.185": "Orange Jordan",
  "86.108": "Orange Jordan",
  "92.253": "Orange Jordan",
  "37.202": "Orange Jordan",
  "212.34": "Orange Jordan",
  "212.35": "Orange Jordan",
  "80.90": "Orange Jordan",
  "194.165": "Orange Jordan",
  "79.173": "Orange Jordan",
  "149.200": "Orange Jordan",
  "185.98": "Orange Jordan",
  "94.249": "Orange Jordan",
  // AS8934 — National Information Technology Center (Jordan government)
  "193.188": "Jordan NITC",
  // AS48832 — Zain Jordan
  "176.29": "Zain Jordan",
  "176.28": "Zain Jordan",
  "46.32": "Zain Jordan",
  "217.23": "Zain Jordan",
  "188.247": "Zain Jordan",
  // AS9038 — Umniah / Orbit Telecom
  "85.159": "Umniah",
  "109.107": "Umniah",
  "5.198": "Umniah",
  // 212.118.0.0/19 verified RIPE RDAP: maintainer MNT-UMNIAH-JO → Umniah
  "212.118": "Umniah",
  "91.106": "Umniah",
  // AS47887 — Damamax
  "82.212": "Damamax",
  // AS50670 — VTEL Jordan
  "109.237": "VTEL Jordan",
  "178.20": "VTEL Jordan",
  "176.241": "VTEL Jordan",
  "185.96": "VTEL Jordan",
  "81.21": "VTEL Jordan",
  // AS21088 — Network Exchange Technology (NEXT)
  "217.144": "NEXT Jordan",
  // AS44702 — JCS Fiberlink / Jordanian European Internet Services
  "79.134": "JCS Fiberlink",
  // AS35656 — Jordanian Universities Network (JUNet): BAU/AHU
  "87.236": "Jordan University Network (JUNet)",
  // AS208148 — Jordanian Experts for Information Security LLC (verified ipwho.is)
  "89.38": "Jordanian Experts IS",
  // AS38968 — Abu-Ghazaleh Intellectual Property Ltd. (verified ipwho.is)
  "89.28": "Abu-Ghazaleh IP",
  // AS59451 — Arab Bank corporate network (RIPE RDAP: Arabbank SOC / MU5310_MNT)
  "37.75": "Arab Bank",
  // AS50670 — VTEL Jordan (RIPE RDAP: MNT-VTELJO, 185.51.212.0/22)
  "185.51": "VTEL Jordan",
  // Additional verified Zain/Orange allocations from the network registry.
  "77.245": "Zain Jordan",
  "213.186": "Orange Jordan",
  // AS28730 — Broadband Communications LPS / Blink Jordan
  "93.95": "Blink Jordan",
  "185.176": "Blink Jordan",
  // AS206608 — Islamic International Arab Bank PLC (RIPE: JO-IIAB, Jordan)
  "185.180": "Islamic Intl Arab Bank",
  // ── Non-Jordanian allocations, labeled truthfully from RIPE RDAP evidence ──
  // AS42961 — Mobile Telecommunications Co. K.S.C.P. / Zain (Kuwait)
  "31.214": "Zain Kuwait (MTC)",
  // Orange France — IPBRX access equipment (France)
  "80.10": "Orange France",
};

/** First-two-octets prefix of an IPv4 string. */
export function prefixOf(ip: string): string {
  return ip.split(".").slice(0, 2).join(".");
}

/** Per-IP ISP overrides where a /16 prefix spans multiple owners (RIPE-verified).
 *  prefixOf() is 2-octet only, so a specific IP owned by a different party than
 *  its /16 must be corrected here — otherwise it would be mislabeled (fake data). */
const ISP_BY_IP: Record<string, string> = {
  // 149.200.0.0–63.255 = Magyar Telekom (Hungary); the 149.200.128+ blocks are
  // GO-JOR / Orange Jordan. The /16 map cannot express this, so pin the IP.
  "149.200.50.11": "Magyar Telekom (HU)",
};

/** Inferred ISP for an IP (per-IP override → /16 prefix → honest fallback). */
export function inferIsp(ip: string): string {
  return ISP_BY_IP[ip] ?? ISP_BY_PREFIX[prefixOf(ip)] ?? "Unknown Jordan ISP";
}

/** Search Domain (provider domain) associated with each DNS — derived from the
 *  network allocation prefix. Browsers cannot do live reverse-DNS (PTR), so this
 *  is the provider's domain label (e.g. orange.jo / zain.jo); unknown → "local". */
const DOMAIN_BY_PREFIX: Record<string, string> = {
  // Orange Jordan (AS8376)
  "46.185": "orange.jo", "86.108": "orange.jo", "92.253": "orange.jo",
  "37.202": "orange.jo", "212.34": "orange.jo",
  "212.35": "orange.jo", "80.90": "orange.jo", "194.165": "orange.jo", "79.173": "orange.jo", "149.200": "orange.jo",
  "176.28": "zain.jo", "77.245": "zain.jo",
  "185.98": "orange.jo", "94.249": "orange.jo",
  // Umniah / Orbit Telecom (AS9038)
  "5.198": "umniah.com", "91.106": "umniah.com", "212.118": "umniah.com",
  // VTEL Jordan (AS50670)
  "185.96": "vtel.jo",
  // NEXT Jordan (AS21088)
  "217.144": "farah.jo",
  // JCS Fiberlink (AS44702)
  "79.134": "jcs.jo",
};
export function searchDomainOf(ip: string): string {
  return DOMAIN_BY_PREFIX[prefixOf(ip)] ?? "local";
}

export const JORDAN_ISPS = ["Orange Jordan", "Zain Jordan", "Umniah", "Damamax", "VTEL Jordan", "Jordan NITC", "Blink Jordan", "Jordan University Network (JUNet)", "Jordan Telecom", "NEXT Jordan", "JCS Fiberlink", "Jordanian Experts IS", "Abu-Ghazaleh IP", "Arab Bank", "Unknown Jordan ISP"];

/** Externally verified public DNS catalogue entries.
 *  Historical reliability is evidence only; live metrics always come from the
 *  current browser/network scan and are never replaced by these percentages. */
export interface KnownDnsEntry {
  hostname: string | null;
  historicalReliability: number | null;
  source: string;
  role: "recursive" | "authoritative" | "infrastructure" | "unknown";
  /** Network registry metadata from the advanced ASN catalogue. */
  asn: string | null;
  catalogPrefix: string | null;
  catalogState: "confirmed" | "historical" | null;
}

// Advanced registry — provider/catelog state per the submitted network table.
// Each entry is kept as evidence only; assertion of DNS validity on the user's
// network always derives from the live scan.
type KnownState = "confirmed" | "historical";
const REG: [string, string, string, KnownState, number][] = [
  // ip, asn, cataloguePrefix, state, historical reliability
  ["87.236.233.117", "AS35656", "87.236.233.0/24", "confirmed", 100],
  ["87.236.233.70", "AS35656", "87.236.233.0/24", "confirmed", 100],
  ["82.212.84.161", "AS47887", "82.212.84.0/24", "confirmed", 99],
  ["82.212.92.82", "AS47887", "82.212.92.0/24", "confirmed", 97],
  ["82.212.79.115", "AS47887", "82.212.79.0/24", "confirmed", 97],
  ["178.20.185.2", "AS50670", "178.20.185.0/24", "confirmed", 99],
  ["178.20.185.5", "AS50670", "178.20.185.0/24", "confirmed", 99],
  ["109.237.197.6", "AS50670", "109.237.197.0/24", "confirmed", 97],
  ["109.237.197.195", "AS50670", "109.237.197.0/24", "confirmed", 97],
  ["178.20.189.206", "AS50670", "178.20.189.0/24", "confirmed", 99],
  ["109.237.193.178", "AS50670", "109.237.193.0/24", "confirmed", 97],
  ["109.237.205.149", "AS50670", "109.237.205.0/24", "confirmed", 97],
  ["178.20.185.29", "AS50670", "178.20.185.0/24", "confirmed", 99],
  ["178.20.185.30", "AS50670", "178.20.185.0/24", "confirmed", 99],
  ["176.241.64.171", "AS50670", "176.241.64.0/21", "confirmed", 99],
  ["178.20.189.102", "AS50670", "178.20.189.0/24", "confirmed", 99],
  ["178.20.185.4", "AS50670", "178.20.185.0/24", "confirmed", 99],
  ["176.29.174.7", "AS48832", "176.29.174.0/24", "confirmed", 97],
  ["77.245.13.191", "AS48832", "77.245.13.0/24", "confirmed", 97],
  ["176.29.176.230", "AS48832", "176.29.176.0/24", "confirmed", 97],
  ["176.29.200.50", "AS48832", "176.29.200.0/24", "confirmed", 97],
  ["46.185.162.241", "AS8376", "46.185.162.0/24", "confirmed", 98],
  ["194.165.159.151", "AS8376", "194.165.159.0/24", "confirmed", 98],
  ["213.186.179.217", "AS8376", "213.186.179.0/24", "confirmed", 98],
  ["194.165.158.181", "AS8376", "194.165.158.0/24", "confirmed", 98],
  ["194.165.151.147", "AS8376", "194.165.151.0/24", "confirmed", 98],
  ["79.173.251.155", "AS8376", "79.173.251.0/24", "confirmed", 90.9],
  ["109.107.244.50", "AS9038", "109.107.244.0/24", "confirmed", 98],
  ["109.107.236.244", "AS9038", "109.107.236.0/24", "confirmed", 98],
  ["212.34.29.168", "AS8697", "212.34.29.0/24", "confirmed", 98],
  // Historical candidates — lower confidence
  ["188.247.93.122", "AS48832", "188.247.93.0/24", "historical", 85],
  ["79.173.253.186", "AS8376", "79.173.253.0/24", "historical", 70.97],
  ["91.106.105.142", "AS9038", "91.106.105.0/24", "historical", 68.97],
  ["82.212.107.34", "AS47887", "82.212.64.0/18", "historical", 99],
  ["86.108.15.199", "AS8376", "86.108.15.0/24", "historical", 92],
  ["109.237.202.116", "AS50670", "109.237.202.0/24", "historical", 99],
  ["79.173.251.142", "AS8376", "79.173.251.0/24", "historical", 88.8],
];

const KNOWN_DNS: Record<string, KnownDnsEntry> = Object.fromEntries(
  REG.map(([ip, asn, catalogPrefix, state, reliability]) => [
    ip,
    {
      hostname: ip === "87.236.233.117" ? "dns2.bau.edu.jo" : ip === "87.236.233.70" ? "gateway2.ahu.edu.jo" : null,
      historicalReliability: Number.isFinite(reliability) ? reliability : null,
      source: state === "confirmed" ? "Advanced ASN catalogue (confirmed)" : "Advanced ASN catalogue (historical candidate)",
      role: "recursive",
      asn,
      catalogPrefix,
      catalogState: state,
    } satisfies KnownDnsEntry,
  ]),
);
// Preserve authoritative entries separately (do NOT collapse into the recursive
// registry — they must never be selected as gaming recursive DNS).
KNOWN_DNS["193.188.66.2"] = {
  hostname: "a.cctld-servers.net.jo",
  historicalReliability: 100,
  source: "IANA .jo delegation / bgp.he.net SOA test",
  role: "authoritative",
  asn: "AS8934",
  catalogPrefix: "193.188.66.0/24",
  catalogState: "confirmed",
};
KNOWN_DNS["193.188.66.3"] = {
  hostname: "pella.nic.gov.jo",
  historicalReliability: null,
  source: "RIPE / NITC reverse DNS",
  role: "infrastructure",
  asn: "AS8934",
  catalogPrefix: "193.188.66.0/24",
  catalogState: "confirmed",
};
KNOWN_DNS["193.188.69.19"] = {
  hostname: "d.cctld-servers.net.jo",
  historicalReliability: 100,
  source: "IANA .jo delegation / bgp.he.net SOA test",
  role: "authoritative",
  asn: "AS8934",
  catalogPrefix: "193.188.69.0/24",
  catalogState: "confirmed",
};

export function knownDnsEntry(ip: string): KnownDnsEntry | null {
  return KNOWN_DNS[ip] ?? null;
}

/* ════════════════════════════════════════════════════════════════
   Jordan DNS IPv6 dataset — VERIFIED Jordan-pure only.
   Each address is cross-checked against IANA + RIPE/bgp.he.net:
   - 2a01:9700::  → AS8376 Orange Jordan (the provided resolver lives here).
   - 2a02:9c0::   → .jo ccTLD authoritative nameservers (NITC / MoDEE, Amman).
   EXCLUDED (NOT Jordan-pure — anycast mirrors abroad):
     • c.cctld-servers.net.jo  → AWS (2a05:d018::) — Ireland/US
     • jo.cctld.authdns.ripe.net → RIPE NCC (2a13:27c0:30::83) — Europe
     • rip.psg.com             → PSG (2001:418:1::39) — USA
   We do NOT fabricate guesses like "2a01:9700:9460::1"; only real, verified
   Jordanian infrastructure is listed. ═══ */
export const MASTER_DNS_V6: string[] = [
  // Orange Jordan (AS8376) — verified resolver provided by the player
  "2a01:9700:4314:3d01:82ae:3cff:fef8:3fd1",
  // .jo ccTLD authoritative nameservers — NITC (National Information Technology Center), Amman
  "2a02:9c0:0:407::2",     // a.cctld-servers.net.jo
  "2a02:9c0:0:408::103",   // b.cctld-servers.net.jo
  "2a02:9c0:0:19::19",     // d.cctld-servers.net.jo
];

/** Is this an IPv6 address? (contains ':'). */
export function isIPv6(ip: string): boolean {
  return ip.includes(":");
}

/** Format a host for fetch(): IPv6 must be wrapped in brackets. */
export function fetchHost(ip: string): string {
  return isIPv6(ip) ? `[${ip}]` : ip;
}

/** IPv6 ISP inference by network prefix (verified allocations). */
const V6_ISP: Record<string, string> = {
  "2a01:9700": "Orange Jordan",      // AS8376
  "2a02:9c0": "Jordan NITC (.jo)",   // National Information Technology Center, Amman
};
const V6_DOMAIN: Record<string, string> = {
  "2a01:9700": "orange.jo",
  "2a02:9c0": "nic.gov.jo",
};
/** IPv6 prefix (first 2 hextets). */
export function v6Prefix(ip: string): string {
  return ip.split(":").slice(0, 2).join(":");
}

/** Combined ISP inference (works for IPv4 + IPv6). */
export function inferIspAny(ip: string): string {
  if (isIPv6(ip)) return V6_ISP[v6Prefix(ip)] ?? "Unknown Jordan ISP";
  return inferIsp(ip);
}
/** Combined search-domain inference (IPv4 + IPv6). */
export function searchDomainAny(ip: string): string {
  if (isIPv6(ip)) return V6_DOMAIN[v6Prefix(ip)] ?? "local";
  return searchDomainOf(ip);
}
