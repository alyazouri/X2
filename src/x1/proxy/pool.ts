// PROXY GAMING INTELLIGENCE — Jordan proxy pool
// Same evidence discipline as the DNS analyzer: catalogue data is evidence only;
// all live metrics come from real browser probes on the user's current network.

export type ProxyState = "confirmed" | "candidate";

export interface ProxyEntry {
  host: string;
  port: number;
  asn: string;
  isp: string;
  catalogPrefix: string | null;
  state: ProxyState;
}

/** Compact seed: [host, port, asn, isp, catalogPrefix, state] */
type Seed = [string, number, string, string, string | null, ProxyState];

const SEEDS: Seed[] = [
  // ── Original verified pool ──
  ["109.237.193.187", 443, "AS50670", "VTEL Jordan", "109.237.193.0/24", "confirmed"],
  ["178.20.185.28", 8080, "AS50670", "VTEL Jordan", "178.20.185.0/24", "candidate"],

  // ── VTEL Jordan (AS50670) — 81.21.0.0/16 proxy candidates ──
  // Network ownership verified (AS50670); proxy service role validated only by live scanning.
  ["81.21.7.201", 80, "AS50670", "VTEL Jordan", "81.21.7.0/24", "candidate"],
  ["81.21.9.235", 80, "AS50670", "VTEL Jordan", "81.21.9.0/24", "candidate"],
  ["81.21.9.241", 80, "AS50670", "VTEL Jordan", "81.21.9.0/24", "candidate"],
  ["81.21.9.249", 80, "AS50670", "VTEL Jordan", "81.21.9.0/24", "candidate"],
  ["81.21.10.187", 80, "AS50670", "VTEL Jordan", "81.21.10.0/24", "candidate"],
  ["81.21.12.21", 80, "AS50670", "VTEL Jordan", "81.21.12.0/24", "candidate"],
  ["81.21.12.56", 80, "AS50670", "VTEL Jordan", "81.21.12.0/24", "candidate"],
  ["81.21.12.137", 80, "AS50670", "VTEL Jordan", "81.21.12.0/24", "candidate"],
  ["81.21.12.195", 80, "AS50670", "VTEL Jordan", "81.21.12.0/24", "candidate"],
  ["81.21.12.228", 80, "AS50670", "VTEL Jordan", "81.21.12.0/24", "candidate"],
  ["81.21.12.231", 80, "AS50670", "VTEL Jordan", "81.21.12.0/24", "candidate"],
  ["81.21.13.210", 80, "AS50670", "VTEL Jordan", "81.21.13.0/24", "candidate"],
  ["81.21.14.85", 80, "AS50670", "VTEL Jordan", "81.21.14.0/24", "candidate"],
  ["81.21.14.136", 80, "AS50670", "VTEL Jordan", "81.21.14.0/24", "candidate"],
  ["81.21.14.244", 80, "AS50670", "VTEL Jordan", "81.21.14.0/24", "candidate"],
  ["81.21.5.21", 20001, "AS50670", "VTEL Jordan", "81.21.5.0/24", "candidate"],
  ["81.21.12.218", 20001, "AS50670", "VTEL Jordan", "81.21.12.0/24", "candidate"],
  // ── Abu-Ghazaleh Intellectual Property Ltd. (AS38968) ──
  ["89.28.216.245", 80, "AS38968", "Abu-Ghazaleh IP", "89.28.216.0/23", "candidate"],
  ["149.200.136.6", 443, "AS8376", "Orange Jordan", "149.200.136.0/24", "confirmed"],
  ["188.123.160.201", 443, "AS8376", "Orange Jordan", "188.123.160.0/24", "candidate"],
  ["188.247.66.133", 443, "AS48832", "Zain Jordan", "188.247.64.0/19", "confirmed"],
  ["188.247.64.50", 8080, "AS48832", "Zain Jordan", "188.247.64.0/19", "candidate"],
  ["188.247.66.210", 80, "AS48832", "Zain Jordan", "188.247.64.0/19", "candidate"],
  ["212.35.85.26", 443, "AS8376", "Orange Jordan", "212.35.85.0/24", "confirmed"],
  ["86.108.11.20", 443, "AS8376", "Orange Jordan", "86.108.11.0/24", "confirmed"],

  // ── JUNet — Jordanian Universities Network (AS35656) proxy candidates ──
  // Network ownership verified (AS35656); proxy service role validated only by live scanning.
  ["87.236.232.12", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.232.0/24", "candidate"],
  ["87.236.232.36", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.232.0/24", "candidate"],
  ["87.236.232.179", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.232.0/24", "candidate"],
  ["87.236.232.235", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.232.0/24", "candidate"],
  ["87.236.232.235", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.232.0/24", "candidate"],
  ["87.236.233.38", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.99", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.100", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.105", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.110", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.111", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.112", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.113", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.116", 8080, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.119", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.119", 8080, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.124", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.137", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.194", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.195", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.195", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.196", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.196", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.197", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.198", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.198", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.199", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.199", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.200", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.200", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.201", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.202", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.203", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.205", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.206", 80, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.206", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],
  ["87.236.233.235", 443, "AS35656", "Jordan University Network (JUNet)", "87.236.233.0/24", "candidate"],

  // ── Orange Jordan / JDC high-port proxy candidates (AS8376) ──
  // Network ownership is confirmed; proxy service role is validated only by live scanning.
  ["46.185.131.218", 20001, "AS8376", "Orange Jordan", "46.185.131.0/24", "candidate"],
  ["46.185.131.218", 20002, "AS8376", "Orange Jordan", "46.185.131.0/24", "candidate"],
  ["46.185.138.151", 20001, "AS8376", "Orange Jordan", "46.185.138.0/24", "candidate"],
  ["46.185.138.151", 10010, "AS8376", "Orange Jordan", "46.185.138.0/24", "candidate"],

  // ── Jordan NITC (AS8934) ──
  ["193.188.64.38", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.81", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.92", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.122", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.127", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.136", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.172", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.186", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.188", 443, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.205", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.211", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.231", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.232", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.64.247", 80, "AS8934", "Jordan NITC", "193.188.64.0/24", "confirmed"],
  ["193.188.66.19", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.26", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.31", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.37", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.41", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.54", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.164", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.176", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.197", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.200", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.211", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.215", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.226", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.230", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.241", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.243", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.66.244", 80, "AS8934", "Jordan NITC", "193.188.66.0/24", "confirmed"],
  ["193.188.74.7", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.19", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.24", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.35", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.38", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.43", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.53", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.54", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.61", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.80", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.95", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.103", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.115", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.124", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.133", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.148", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.179", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.209", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.214", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.74.236", 80, "AS8934", "Jordan NITC", "193.188.74.0/24", "confirmed"],
  ["193.188.84.3", 80, "AS8934", "Jordan NITC", "193.188.84.0/24", "confirmed"],
  ["193.188.84.6", 80, "AS8934", "Jordan NITC", "193.188.84.0/24", "confirmed"],
  ["193.188.84.16", 80, "AS8934", "Jordan NITC", "193.188.84.0/24", "confirmed"],
  ["193.188.84.60", 80, "AS8934", "Jordan NITC", "193.188.84.0/24", "confirmed"],
  ["193.188.84.78", 80, "AS8934", "Jordan NITC", "193.188.84.0/24", "confirmed"],
  ["193.188.84.79", 80, "AS8934", "Jordan NITC", "193.188.84.0/24", "confirmed"],
  ["193.188.84.118", 80, "AS8934", "Jordan NITC", "193.188.84.0/24", "confirmed"],
  ["193.188.84.215", 80, "AS8934", "Jordan NITC", "193.188.84.0/24", "confirmed"],
  ["193.188.85.7", 80, "AS8934", "Jordan NITC", "193.188.85.0/24", "confirmed"],

  // ── Orange Jordan / JDC (AS8376) ──
  ["194.165.133.85", 443, "AS8376", "Orange Jordan", "194.165.133.0/24", "confirmed"],
  ["194.165.134.118", 80, "AS8376", "Orange Jordan", "194.165.134.0/24", "confirmed"],
  ["194.165.134.121", 80, "AS8376", "Orange Jordan", "194.165.134.0/24", "confirmed"],
  ["86.108.108.68", 80, "AS8376", "Orange Jordan", "86.108.108.0/24", "confirmed"],
  ["86.108.14.29", 80, "AS8376", "Orange Jordan", "86.108.14.0/24", "confirmed"],
  ["80.90.164.188", 80, "AS8376", "Orange Jordan", "80.90.164.0/24", "confirmed"],
  ["80.90.164.221", 80, "AS8376", "Orange Jordan", "80.90.164.0/24", "confirmed"],
  ["80.90.160.39", 80, "AS8376", "Orange Jordan", "80.90.160.0/24", "confirmed"],
  ["80.90.171.201", 80, "AS8376", "Orange Jordan", "80.90.171.0/24", "confirmed"],
  ["92.253.14.110", 80, "AS8376", "Orange Jordan", "92.253.14.0/24", "confirmed"],
  ["79.173.249.116", 80, "AS8376", "Orange Jordan", "79.173.249.0/24", "confirmed"],
  ["79.173.249.116", 8080, "AS8376", "Orange Jordan", "79.173.249.0/24", "confirmed"],
  ["79.173.252.218", 8080, "AS8376", "Orange Jordan", "79.173.252.0/24", "confirmed"],
  ["149.200.240.13", 8888, "AS8376", "Orange Jordan", "149.200.240.0/24", "confirmed"],
  ["149.200.251.112", 8888, "AS8376", "Orange Jordan", "149.200.251.0/24", "confirmed"],

  // ── Zain Jordan (AS48832) ──
  ["46.32.120.15", 80, "AS48832", "Zain Jordan", "46.32.120.0/24", "confirmed"],
  ["46.32.120.16", 80, "AS48832", "Zain Jordan", "46.32.120.0/24", "confirmed"],
  ["46.32.120.17", 80, "AS48832", "Zain Jordan", "46.32.120.0/24", "confirmed"],
  ["46.32.101.140", 80, "AS48832", "Zain Jordan", "46.32.101.0/24", "confirmed"],
  ["46.32.101.158", 80, "AS48832", "Zain Jordan", "46.32.101.0/24", "confirmed"],
  ["46.32.101.16", 80, "AS48832", "Zain Jordan", "46.32.101.0/24", "confirmed"],
  ["46.32.101.18", 80, "AS48832", "Zain Jordan", "46.32.101.0/24", "confirmed"],
  ["46.32.101.19", 80, "AS48832", "Zain Jordan", "46.32.101.0/24", "confirmed"],
  ["46.32.101.20", 80, "AS48832", "Zain Jordan", "46.32.101.0/24", "confirmed"],
  ["46.32.101.22", 80, "AS48832", "Zain Jordan", "46.32.101.0/24", "confirmed"],
  ["46.32.101.23", 80, "AS48832", "Zain Jordan", "46.32.101.0/24", "confirmed"],
  ["46.32.101.25", 80, "AS48832", "Zain Jordan", "46.32.101.0/24", "confirmed"],
  ["46.32.102.217", 80, "AS48832", "Zain Jordan", "46.32.102.0/24", "confirmed"],
  ["46.32.109.58", 80, "AS48832", "Zain Jordan", "46.32.109.0/24", "confirmed"],
  ["46.32.109.172", 80, "AS48832", "Zain Jordan", "46.32.109.0/24", "confirmed"],
  ["46.32.114.4", 80, "AS48832", "Zain Jordan", "46.32.114.0/24", "confirmed"],
  ["46.32.119.124", 8888, "AS48832", "Zain Jordan", "46.32.119.0/24", "confirmed"],
  ["46.32.99.244", 8888, "AS48832", "Zain Jordan", "46.32.99.0/24", "confirmed"],
  ["46.32.109.161", 8080, "AS48832", "Zain Jordan", "46.32.109.0/24", "confirmed"],

  // ── VTEL Jordan (AS50670) ──
  ["109.237.197.6", 80, "AS50670", "VTEL Jordan", "109.237.197.0/24", "confirmed"],
  ["109.237.192.171", 80, "AS50670", "VTEL Jordan", "109.237.192.0/24", "confirmed"],
  ["109.237.197.155", 80, "AS50670", "VTEL Jordan", "109.237.197.0/24", "confirmed"],
  ["109.237.197.19", 80, "AS50670", "VTEL Jordan", "109.237.197.0/24", "confirmed"],
  ["109.237.197.191", 80, "AS50670", "VTEL Jordan", "109.237.197.0/24", "confirmed"],
  ["109.237.197.195", 80, "AS50670", "VTEL Jordan", "109.237.197.0/24", "confirmed"],
  ["109.237.198.221", 80, "AS50670", "VTEL Jordan", "109.237.198.0/24", "confirmed"],
  ["109.237.199.186", 80, "AS50670", "VTEL Jordan", "109.237.199.0/24", "confirmed"],
  ["109.237.201.88", 80, "AS50670", "VTEL Jordan", "109.237.201.0/24", "confirmed"],
  ["109.237.202.76", 80, "AS50670", "VTEL Jordan", "109.237.202.0/24", "confirmed"],
  ["109.237.202.151", 80, "AS50670", "VTEL Jordan", "109.237.202.0/24", "confirmed"],
  ["109.237.202.171", 80, "AS50670", "VTEL Jordan", "109.237.202.0/24", "confirmed"],
  ["109.237.202.210", 80, "AS50670", "VTEL Jordan", "109.237.202.0/24", "confirmed"],
  ["109.237.202.248", 80, "AS50670", "VTEL Jordan", "109.237.202.0/24", "confirmed"],
  ["109.237.204.109", 80, "AS50670", "VTEL Jordan", "109.237.204.0/24", "confirmed"],
  ["109.237.204.199", 80, "AS50670", "VTEL Jordan", "109.237.204.0/24", "confirmed"],
  ["109.237.205.149", 80, "AS50670", "VTEL Jordan", "109.237.205.0/24", "confirmed"],
  ["109.237.205.183", 80, "AS50670", "VTEL Jordan", "109.237.205.0/24", "confirmed"],
  ["109.237.205.201", 80, "AS50670", "VTEL Jordan", "109.237.205.0/24", "confirmed"],
  ["109.237.205.209", 8080, "AS50670", "VTEL Jordan", "109.237.205.0/24", "confirmed"],
  ["109.237.194.54", 80, "AS50670", "VTEL Jordan", "109.237.194.0/24", "confirmed"],
  ["109.237.194.70", 80, "AS50670", "VTEL Jordan", "109.237.194.0/24", "confirmed"],
  ["109.237.194.237", 80, "AS50670", "VTEL Jordan", "109.237.194.0/24", "confirmed"],

  // ── Umniah (AS9038) ──
  ["85.159.217.22", 80, "AS9038", "Umniah", "85.159.217.0/24", "confirmed"],
  ["85.159.217.28", 80, "AS9038", "Umniah", "85.159.217.0/24", "confirmed"],
  ["85.159.217.195", 8080, "AS9038", "Umniah", "85.159.217.0/24", "confirmed"],
  ["85.159.218.54", 8080, "AS9038", "Umniah", "85.159.218.0/24", "confirmed"],
  ["85.159.222.82", 8080, "AS9038", "Umniah", "85.159.222.0/24", "confirmed"],
  // AS9038 Umniah — network confirmed; proxy service role requires live proof.
  ["37.220.117.185", 80, "AS9038", "Umniah", "37.220.117.0/24", "candidate"],
  ["37.220.120.75", 80, "AS9038", "Umniah", "37.220.120.0/24", "candidate"],
  ["37.220.121.155", 80, "AS9038", "Umniah", "37.220.121.0/24", "candidate"],
  ["37.220.117.32", 20001, "AS9038", "Umniah", "37.220.117.0/24", "candidate"],
  ["37.220.121.71", 10010, "AS9038", "Umniah", "37.220.121.0/24", "candidate"],
  // 212.118.0.0/19 — Umniah (RIPE RDAP: MNT-UMNIAH-JO)
  ["212.118.16.221", 80, "AS9038", "Umniah", "212.118.16.0/24", "candidate"],
  ["212.118.21.234", 8080, "AS9038", "Umniah", "212.118.21.0/24", "candidate"],

  // ── Arab Bank corporate network (AS59451) — 37.75.144.0/24 (RIPE: Arabbank SOC) ──
  ["37.75.144.78", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.174", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.176", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.191", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.211", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.212", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.216", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.217", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.224", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.225", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.226", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.227", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],
  ["37.75.144.251", 80, "AS59451", "Arab Bank", "37.75.144.0/24", "candidate"],

  // ── VTEL Jordan (AS50670) — 185.51.212.0/22 (RIPE: MNT-VTELJO) ──
  ["185.51.212.82", 80, "AS50670", "VTEL Jordan", "185.51.212.0/24", "candidate"],

  // ── Damamax (AS47887) ──
  ["82.212.81.216", 80, "AS47887", "Damamax", "82.212.81.0/24", "confirmed"],
  ["82.212.81.216", 8080, "AS47887", "Damamax", "82.212.81.0/24", "confirmed"],
  ["82.212.86.122", 80, "AS47887", "Damamax", "82.212.86.0/24", "confirmed"],
  ["82.212.86.122", 8080, "AS47887", "Damamax", "82.212.86.0/24", "confirmed"],
  ["82.212.87.26", 80, "AS47887", "Damamax", "82.212.87.0/24", "confirmed"],
  ["82.212.92.112", 443, "AS47887", "Damamax", "82.212.92.0/24", "confirmed"],
  ["82.212.92.124", 80, "AS47887", "Damamax", "82.212.92.0/24", "confirmed"],
  ["82.212.109.173", 8080, "AS47887", "Damamax", "82.212.109.0/24", "confirmed"],
  ["82.212.196.82", 80, "AS47887", "Damamax", "82.212.196.0/24", "confirmed"],

  // ── Unverified Jordan allocations (honest: candidate) ──
  ["176.28.184.141", 80, "AS48832", "Zain Jordan", null, "candidate"],
  ["176.28.184.205", 80, "AS48832", "Zain Jordan", null, "candidate"],
  ["176.28.184.254", 80, "AS48832", "Zain Jordan", null, "candidate"],
  ["176.28.201.188", 80, "AS48832", "Zain Jordan", null, "candidate"],
  // 46.23.112.0/24 — CORRECTED label: RIPE RDAP shows "WIMAX" block under
  // MNT-UMNIAH-JO / Umniah Company (AS9038), not Zain. ipwho.is concurs.
  ["46.23.112.65", 80, "AS9038", "Umniah", "46.23.112.0/24", "candidate"],
  ["46.23.112.75", 80, "AS9038", "Umniah", "46.23.112.0/24", "candidate"],
  ["46.23.112.198", 80, "AS9038", "Umniah", "46.23.112.0/24", "candidate"],
  ["46.23.112.215", 80, "AS9038", "Umniah", "46.23.112.0/24", "candidate"],

  // ── Jordan Telecom (AS8697) ──
  ["212.34.3.18", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.19", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.20", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.21", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.22", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.23", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.24", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.25", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.26", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.27", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.28", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.29", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.30", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.31", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
  ["212.34.3.62", 80, "AS8697", "Jordan Telecom", "212.34.3.0/24", "confirmed"],
];

/** Deduplicate by `host:port` — a proxy endpoint is the unique identifier. */
function buildPool(seeds: Seed[]): { pool: ProxyEntry[]; duplicates: number } {
  const seen = new Set<string>();
  const pool: ProxyEntry[] = [];
  for (const [host, port, asn, isp, catalogPrefix, state] of seeds) {
    const key = `${host}:${port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({ host, port, asn, isp, catalogPrefix, state });
  }
  return { pool, duplicates: seeds.length - pool.length };
}

const built = buildPool(SEEDS);

export const PROXY_POOL: ProxyEntry[] = built.pool;
export const PROXY_DUPLICATES_REMOVED: number = built.duplicates;
export const PROXY_RAW_COUNT: number = SEEDS.length;

export const PROXY_ISPS = Array.from(new Set(PROXY_POOL.map((p) => p.isp)));
