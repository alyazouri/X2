// ═════════════════════════════════════════════════════════════════════════
// SHARED EDGE PROBER — the single real-socket measurement module.
// Extracted from /api/proxy-scan so every probe surface (Jordan plan, global
// directory scan) shares ONE implementation. No duplicated logic, no fakes.
// ═════════════════════════════════════════════════════════════════════════
import net from "node:net";
import { Resolver } from "node:dns";

export const TIMEOUT_MS = 1400;
export const DNS_TIMEOUT_MS = 1000;
export const CONNECT_TIMEOUT_MS = 1200;
export const HARD_DEADLINE_MS = Math.max(TIMEOUT_MS, CONNECT_TIMEOUT_MS, DNS_TIMEOUT_MS * 2) + 1000;
export const PROBE_CONCURRENCY = 200;

export type DnssecState = "VALIDATING" | "NOT_VALIDATING" | "UNVERIFIED";

export interface ProbeResult {
  host: string;
  port: number;
  endpoint: string;
  open: boolean;
  connectMs: number | null;
  evidence: string;
  dns?: boolean;
  rcode?: number | null;
  answers?: string[];
  dnsError?: string;
  proxy?: boolean;
  httpStatus?: number | null;
  samples?: number[];
  avgMs?: number | null;
  jitterMs?: number | null;
  dnssec?: DnssecState;
  dnssecEvidence?: string;
  dnssecMs?: number | null;
}

/** Real TCP connect probe (SYN → ACK timing). */
export function tcpProbe(host: string, port: number, timeoutMs: number = TIMEOUT_MS): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(hard);
      socket.destroy();
      resolve(result);
    };
    const hard = setTimeout(() => finish({
      host, port, endpoint: `${host}:${port}`, open: false, connectMs: null, evidence: "TIMEOUT",
    }), timeoutMs + 500);
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish({
      host, port, endpoint: `${host}:${port}`, open: true,
      connectMs: Math.round((performance.now() - started) * 10) / 10,
      evidence: "TCP_SYN_ACK",
    }));
    socket.once("timeout", () => finish({ host, port, endpoint: `${host}:${port}`, open: false, connectMs: null, evidence: "TIMEOUT" }));
    socket.once("error", (error: NodeJS.ErrnoException) => finish({
      host, port, endpoint: `${host}:${port}`, open: false, connectMs: null,
      evidence: error.code === "ECONNREFUSED" ? "TCP_RST" : "NETWORK_ERROR",
    }));
  });
}

/**
 * REAL DNSSEC validation capability test.
 * `dnssec-failed.org` carries an intentionally broken DNSSEC chain:
 *   • validating recursive resolver → SERVFAIL (correctly rejects it)
 *   • non-validating resolver       → returns A records (does not validate)
 *   • timeout/refused/other          → UNVERIFIED (never guessed)
 */
export function dnssecValidation(host: string, timeoutMs: number = DNS_TIMEOUT_MS): Promise<{
  dnssec: DnssecState;
  evidence: string;
  ms: number | null;
}> {
  return new Promise((resolve) => {
    const started = performance.now();
    const resolver = new Resolver({ timeout: timeoutMs, tries: 1 });
    resolver.setServers([host]);
    let settled = false;
    const finish = (dnssec: DnssecState, evidence: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { resolver.cancel(); } catch { /* */ }
      const ms = Math.round((performance.now() - started) * 10) / 10;
      resolve({ dnssec, evidence, ms });
    };
    const timer = setTimeout(() => finish("UNVERIFIED", "DNSSEC_TIMEOUT"), timeoutMs + 200);
    resolver.resolve4("dnssec-failed.org", (error, addresses) => {
      if (!error && addresses?.length) {
        finish("NOT_VALIDATING", "DNSSEC_BOGUS_RESOLVED");
        return;
      }
      const code = (error as NodeJS.ErrnoException | null)?.code ?? "";
      if (code === "ESERVFAIL") finish("VALIDATING", "DNSSEC_BOGUS_REJECTED");
      else finish("UNVERIFIED", code ? `DNSSEC_${code}` : "DNSSEC_NO_EVIDENCE");
    });
  });
}

/** REAL DNS query sent to `host` over UDP/53 via node:dns; DNSSEC test follows a valid answer. */
export function dnsProbe(host: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 1 });
    resolver.setServers([host]);
    let settled = false;
    const finish = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      try { resolver.cancel(); } catch { /* already done */ }
      resolve(result);
    };
    const timer = setTimeout(() => finish({
      host, port: 53, endpoint: `${host}:53`,
      open: false, connectMs: null, dns: true, rcode: null,
      evidence: "TIMEOUT",
    }), DNS_TIMEOUT_MS + 250);

    resolver.resolve4("pubg.com", async (error, addresses) => {
      clearTimeout(timer);
      const ms = Math.round((performance.now() - started) * 10) / 10;
      if (!error) {
        const sec = await dnssecValidation(host);
        return finish({
          host, port: 53, endpoint: `${host}:53`,
          open: true, connectMs: ms, dns: true, rcode: 0,
          evidence: "RCODE_0", answers: addresses || [],
          dnssec: sec.dnssec,
          dnssecEvidence: sec.evidence,
          dnssecMs: sec.ms,
        });
      }
      const code = (error as NodeJS.ErrnoException).code || "";
      let rcode: number | null = null;
      let evidence = "DNS_ERROR";
      if (code === "ENOTFOUND") { rcode = 3; evidence = "NXDOMAIN"; }
      else if (code === "ESERVFAIL") { rcode = 2; evidence = "SERVFAIL"; }
      else if (code === "EREFUSED" || code === "EACCES") { rcode = 5; evidence = "REFUSED"; }
      else if (code === "ETIMEOUT" || code === "ETIMEDOUT" || code === "EAGAIN") { evidence = "TIMEOUT"; }
      else if (code === "ECONNREFUSED") { evidence = "TCP_RST"; }
      finish({
        host, port: 53, endpoint: `${host}:53`,
        open: rcode !== null, connectMs: ms, dns: true, rcode,
        evidence, dnsError: code,
      });
    });
  });
}

/** REAL HTTP CONNECT handshake through a proxy. */
export function connectProbe(host: string, port: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(hard);
      socket.destroy();
      resolve(result);
    };
    const hard = setTimeout(() => finish({
      host, port, endpoint: `${host}:${port}`, open: true, connectMs: null, evidence: "CONNECT_TIMEOUT",
    }), CONNECT_TIMEOUT_MS + 500);
    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("connect", () => {
      socket.write("CONNECT pubg.com:443 HTTP/1.1\r\nHost: pubg.com:443\r\n\r\n");
    });
    socket.once("data", (buffer) => {
      const statusLine = buffer.toString("latin1").split("\r\n")[0] || "";
      const status = Number(statusLine.split(" ")[1]) || 0;
      const ms = Math.round((performance.now() - started) * 10) / 10;
      finish({
        host, port, endpoint: `${host}:${port}`, open: true, connectMs: ms,
        proxy: true, httpStatus: status,
        evidence: status >= 200 && status < 300 ? "PROXY_CONNECT_OK" : `PROXY_HTTP_${status}`,
      });
    });
    socket.once("timeout", () => finish({
      host, port, endpoint: `${host}:${port}`, open: true, connectMs: null,
      proxy: true, httpStatus: null, evidence: "CONNECT_TIMEOUT",
    }));
    socket.once("error", (error: NodeJS.ErrnoException) => finish({
      host, port, endpoint: `${host}:${port}`, open: false, connectMs: null,
      proxy: true, httpStatus: null,
      evidence: error.code === "ECONNREFUSED" ? "TCP_RST" : "NETWORK_ERROR",
    }));
  });
}

export const PROXY_TEST_PORTS = new Set([1080, 8080, 8888, 10010, 20001, 20002]);

/** One endpoint → the right real test. */
export async function probeEndpoint({ host, port }: { host: string; port: number }): Promise<ProbeResult> {
  if (port === 53) return dnsProbe(host);
  const tcp = await tcpProbe(host, port);
  if (!tcp.open) return tcp;
  if (PROXY_TEST_PORTS.has(port)) {
    const http = await connectProbe(host, port);
    return {
      ...tcp,
      connectMs: http.connectMs ?? tcp.connectMs,
      proxy: true,
      httpStatus: http.httpStatus,
      evidence: http.evidence,
    };
  }
  return tcp;
}

/** Final assurance: one endpoint can never block the whole scan. */
export function withDeadline(promise: Promise<ProbeResult>, ep: { host: string; port: number }): Promise<ProbeResult> {
  return Promise.race([
    promise,
    new Promise<ProbeResult>((resolve) => setTimeout(() => resolve({
      host: ep.host, port: ep.port, endpoint: `${ep.host}:${ep.port}`,
      open: false, connectMs: null, evidence: "TIMEOUT",
    }), HARD_DEADLINE_MS)),
  ]);
}

/** Runtimes without raw sockets degrade to honest evidence. */
export async function safeProbe(ep: { host: string; port: number }): Promise<ProbeResult> {
  try {
    return await probeEndpoint(ep);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    return {
      host: ep.host, port: ep.port, endpoint: `${ep.host}:${ep.port}`,
      open: false, connectMs: null,
      evidence: code === "ECONNREFUSED" ? "TCP_RST" : "NETWORK_ERROR",
    };
  }
}

/** Multi-round probe → real per-address jitter. Dead hosts stop early. */
export async function probeEndpointRounds(
  ep: { host: string; port: number },
  rounds: number,
): Promise<ProbeResult> {
  const results: ProbeResult[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const r = await withDeadline(safeProbe(ep), ep);
    results.push(r);
    if (!r.open && r.connectMs == null) break;
  }
  const base = results.find((r) => r.open) ?? results[0];
  const samples = results
    .map((r) => r.connectMs)
    .filter((x): x is number => x != null && Number.isFinite(x));
  let avgMs: number | null = null;
  let jitterMs: number | null = null;
  if (samples.length) {
    avgMs = Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10;
    if (samples.length > 1) {
      let s = 0;
      for (let i = 1; i < samples.length; i += 1) s += Math.abs(samples[i] - samples[i - 1]);
      jitterMs = Math.round((s / (samples.length - 1)) * 10) / 10;
    }
  }

  // Aggregate DNSSEC evidence; contradictory rounds stay UNVERIFIED.
  const secStates = results.map((r) => r.dnssec).filter(Boolean);
  const hasValidating = secStates.includes("VALIDATING");
  const hasNonValidating = secStates.includes("NOT_VALIDATING");
  const dnssec = hasValidating && !hasNonValidating
    ? "VALIDATING" as const
    : hasNonValidating && !hasValidating
      ? "NOT_VALIDATING" as const
      : secStates.length
        ? "UNVERIFIED" as const
        : base.dnssec;
  const dnssecEvidence = hasValidating && hasNonValidating
    ? "DNSSEC_INCONSISTENT_ROUNDS"
    : results.find((r) => r.dnssec === dnssec)?.dnssecEvidence ?? base.dnssecEvidence;
  const dnssecSamples = results.map((r) => r.dnssecMs).filter((x): x is number => x != null && Number.isFinite(x));
  const dnssecMs = dnssecSamples.length
    ? Math.round((dnssecSamples.reduce((a, b) => a + b, 0) / dnssecSamples.length) * 10) / 10
    : base.dnssecMs;

  return { ...base, samples, avgMs, jitterMs, dnssec, dnssecEvidence, dnssecMs };
}

export async function mapConcurrent<T, R>(
  values: T[], worker: (item: T) => Promise<R>, limit: number = PROBE_CONCURRENCY,
): Promise<R[]> {
  const out = new Array(values.length);
  let next = 0;
  async function run() {
    while (next < values.length) {
      const index = next++;
      out[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, run));
  return out;
}
