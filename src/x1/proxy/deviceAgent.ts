// LOCAL DEVICE PROXY AGENT
// Creates a portable, local-only workflow bundle for eProxy / OpenVPN bridging.
// Nothing is uploaded to our server. The user explicitly saves/downloads it.
import type { DnsProxyMatch } from "./match";

const STORAGE_KEY = "alyazouri_proxy_device_agent_v1";

export interface DeviceProxyBundle {
  version: 1;
  generatedAt: string;
  name: string;
  privacy: "local-only";
  localListener: { host: "127.0.0.1"; port: 1707 };
  upstream: {
    host: string;
    port: number;
    endpoint: string;
    isp: string;
    asn: string;
    status: string;
    tx: number;
    rx: number;
  };
  dns: {
    address: string;
    isp: string;
    asn: string | null;
    status: string;
  };
  openVpnDirective: string;
  notes: string[];
}

export function buildDeviceProxyBundle(match: DnsProxyMatch): DeviceProxyBundle {
  const proxy = match.proxy;
  const dns = match.dns;
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    name: `ALYAZOURI-${proxy.isp.replace(/\s+/g, "-").toUpperCase()}`,
    privacy: "local-only",
    localListener: { host: "127.0.0.1", port: 1707 },
    upstream: {
      host: proxy.host,
      port: proxy.port,
      endpoint: proxy.endpoint,
      isp: proxy.isp,
      asn: proxy.asn,
      status: proxy.status,
      tx: proxy.io.tx,
      rx: proxy.io.rx,
    },
    dns: {
      address: dns.ip,
      isp: dns.isp,
      asn: dns.verification.asn,
      status: dns.status,
    },
    openVpnDirective: "http-proxy 127.0.0.1 1707",
    notes: [
      "This file is generated locally and is not uploaded by ALYAZOURI GG.",
      "The upstream endpoint was reachable in the browser scan; actual proxy forwarding must be verified inside eProxy.",
      "eProxy .epro is a proprietary version-dependent format, so this bundle intentionally does not impersonate it.",
      "Proxy operators can see connection metadata. End-to-end HTTPS still protects encrypted content.",
    ],
  };
}

export function saveBundleLocally(bundle: DeviceProxyBundle): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
}

export function loadLocalBundle(): DeviceProxyBundle | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as DeviceProxyBundle : null;
  } catch {
    return null;
  }
}

export function clearLocalBundle(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function eProxyInstructions(bundle: DeviceProxyBundle): string {
  return [
    "ALYAZOURI GG — eProxy local workflow",
    "",
    `Profile: ${bundle.name}`,
    `Selected DNS: ${bundle.dns.address} (${bundle.dns.asn ?? bundle.dns.isp})`,
    `Verified upstream endpoint: ${bundle.upstream.endpoint} (${bundle.upstream.asn})`,
    "",
    "eProxy (Android):",
    "1. Open eProxy and create a local HTTP proxy/custom request profile.",
    `2. Local listener: ${bundle.localListener.host}:${bundle.localListener.port}`,
    `3. Upstream endpoint to verify/configure manually: ${bundle.upstream.endpoint}`,
    "4. Start eProxy and grant Android VPN permission if your eProxy version uses VPNService.",
    "5. Test internet access in eProxy. If forwarding fails, stop and remove the profile.",
    "",
    "OpenVPN bridge directive:",
    bundle.openVpnDirective,
    "",
    "Important: endpoint reachability does not prove protocol compatibility or relay authorization.",
  ].join("\n");
}

export function downloadBundle(bundle: DeviceProxyBundle): void {
  downloadText(`${bundle.name}.alyproxy.json`, JSON.stringify(bundle, null, 2), "application/json");
}

export function downloadInstructions(bundle: DeviceProxyBundle): void {
  downloadText(`${bundle.name}-eproxy.txt`, eProxyInstructions(bundle), "text/plain");
}

function downloadText(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}