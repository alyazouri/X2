// ════════════════════════════════════════════════════════════════
// SCAN CONTROLLER — adaptive concurrency, priority queue,
// circuit breaker, two-pass scanning, batched result delivery.
// All CPU-heavy work (stats, scoring, ranking) stays OUTSIDE React.
// ════════════════════════════════════════════════════════════════
import type {
  Endpoint, EndpointRecord, ScanProgress, ScanEvent, ScanPhase,
  RawSample, HealthState, FailureReason,
} from "./types";
import { LIMITS, TEST_POLICY_VERSION } from "./types";
import { validateEndpoint, endpointId, deriveMetrics, computeConfidence, computeScores, classifyBehavior } from "./stats";

/* ── Priority queue entry ────────────────────────────────────── */
interface QueueEntry {
  endpoint: Endpoint;
  priority: number; // 0 = highest
  consecutiveFailures: number;
  circuitUntil: number;
}

/* ── Circuit breaker state ───────────────────────────────────── */
interface CircuitState {
  failures: number;
  openUntil: number;
}

/* ── Scan controller ─────────────────────────────────────────── */
export class ScanController {
  private queue: QueueEntry[] = [];
  private records = new Map<string, EndpointRecord>();
  private circuits = new Map<string, CircuitState>();
  private activeWorkers = 0;
  private concurrency: number;
  private maxConcurrency: number;
  private phase: ScanPhase = "idle";
  private startedAt = 0;
  private processedCount = 0;
  private eventBuffer: ScanEvent[] = [];
  private lastFlush = 0;
  private flushInterval = 120; // ms — batched UI delivery
  private timer: ReturnType<typeof setInterval> | null = null;
  private abortFlag = false;
  private pauseFlag = false;
  private lastHealthCheck = 0;
  private recentResults: { ok: boolean; ms: number; at: number }[] = [];

  constructor(
    private probeFn: (endpoint: Endpoint, signal: AbortSignal) => Promise<{ ok: boolean; ms: number; detail?: string; samples?: RawSample[] }>,
    private options: {
      initialConcurrency?: number;
      maxConcurrency?: number;
      kind: "dns" | "proxy";
      onComplete?: (records: Map<string, EndpointRecord>) => void;
      onBatch?: (events: ScanEvent[], progress: ScanProgress) => void;
    } = { kind: "dns" },
  ) {
    this.concurrency = options.initialConcurrency ?? 6;
    this.maxConcurrency = Math.min(options.maxConcurrency ?? LIMITS.MAX_WORKERS, LIMITS.MAX_WORKERS);
  }

  get policyVersion(): string {
    return this.options.kind === "dns" ? TEST_POLICY_VERSION.dns : TEST_POLICY_VERSION.proxy;
  }

  /* ── Public: enqueue endpoints ─────────────────────────────── */
  enqueue(endpoints: Endpoint[], priorities?: Map<string, number>): void {
    for (const ep of endpoints) {
      const validation = validateEndpoint({ host: ep.host, port: ep.port, protocol: ep.protocol });
      if (!validation.valid) continue; // Invalid endpoints never enter the queue
      const id = endpointId(ep.host, ep.port, ep.protocol);
      if (this.records.has(id)) continue; // Never scan the same endpoint twice
      const priority = priorities?.get(id) ?? 3;
      this.queue.push({ endpoint: ep, priority, consecutiveFailures: 0, circuitUntil: 0 });
      this.records.set(id, {
        endpoint: ep,
        state: "QUEUED",
        raw: [],
        metrics: null,
        verification: { dnsUdp: "UNKNOWN", dnsTcp: "UNKNOWN", dnssec: "UNKNOWN", nxdomain: "UNKNOWN", httpConnect: "UNKNOWN", tlsHandshake: "UNKNOWN" },
        scores: null,
        confidence: null,
        networkBehavior: "INSUFFICIENT_DATA",
        updatedAt: Date.now(),
        policyVersion: this.policyVersion,
      });
    }
    // Sort by priority (P0 first)
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  /* ── Public: start scan ────────────────────────────────────── */
  start(): void {
    if (this.phase === "pass1" || this.phase === "pass2") return;
    this.abortFlag = false;
    this.pauseFlag = false;
    this.phase = "pass1";
    this.startedAt = Date.now();
    this.processedCount = 0;
    this.lastHealthCheck = Date.now();
    this.recentResults = [];
    this.pump();
    this.timer = setInterval(() => this.adaptConcurrency(), 2000);
    this.emit({ type: "phase", at: Date.now(), data: "pass1" });
  }

  /* ── Public: pause / resume / stop ─────────────────────────── */
  pause(): void {
    this.pauseFlag = true;
    this.phase = "paused";
    this.emit({ type: "phase", at: Date.now(), data: "paused" });
  }

  resume(): void {
    if (this.phase !== "paused") return;
    this.pauseFlag = false;
    this.phase = this.queue.length > 0 ? "pass1" : "pass2";
    this.pump();
  }

  stop(): void {
    this.abortFlag = true;
    this.phase = "stopped";
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.flush(true);
    this.options.onComplete?.(this.records);
  }

  /* ── Public: get current records snapshot ──────────────────── */
  getRecords(): Map<string, EndpointRecord> {
    return new Map(this.records);
  }

  getProgress(): ScanProgress {
    const total = this.records.size;
    const recs = [...this.records.values()];
    return {
      phase: this.phase,
      total,
      processed: this.processedCount,
      queued: this.queue.length,
      active: this.activeWorkers,
      verified: recs.filter((r) => r.state === "VERIFIED" || r.state === "DNS_PASS" || r.state === "TCP_PASS").length,
      partial: recs.filter((r) => r.state === "DNS_PARTIAL" || r.state === "REACHABLE").length,
      failed: recs.filter((r) => r.state === "DNS_FAILED" || r.state === "TCP_FAILED").length,
      timeout: recs.filter((r) => r.failureReason === "TIMEOUT" || r.state === "EXPIRED").length,
      endpointsPerSecond: this.startedAt > 0 ? round2(this.processedCount / ((Date.now() - this.startedAt) / 1000)) : 0,
      elapsedMs: this.startedAt > 0 ? Date.now() - this.startedAt : 0,
      activeWorkers: this.activeWorkers,
    };
  }

  /* ── Private: worker pump ───────────────────────────────────── */
  private pump(): void {
    if (this.abortFlag || this.pauseFlag) return;
    if (this.phase === "complete" || this.phase === "stopped") return;

    const now = Date.now();
    while (this.activeWorkers < this.concurrency && this.queue.length > 0 && !this.abortFlag && !this.pauseFlag) {
      const entry = this.queue.shift()!;
      const id = endpointId(entry.endpoint.host, entry.endpoint.port, entry.endpoint.protocol);

      // Circuit breaker check
      const circuit = this.circuits.get(id);
      if (circuit && circuit.openUntil > now) {
        this.updateRecord(id, { state: "STALE", failureReason: "CIRCUIT_OPEN" });
        this.processedCount++;
        continue;
      }

      this.activeWorkers++;
      this.runProbe(entry, id);
    }

    if (this.queue.length === 0 && this.activeWorkers === 0) {
      this.onPhaseComplete();
    }
  }

  private async runProbe(entry: QueueEntry, id: string): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const result = await this.probeFn(entry.endpoint, controller.signal);
      clearTimeout(timeoutId);

      const record = this.records.get(id);
      if (!record) return;

      // Append raw sample
      record.raw.push({ ms: result.ms, at: Date.now(), ok: result.ok, stage: "quick", detail: result.detail });
      if (record.raw.length > LIMITS.MAX_SAMPLES) record.raw = record.raw.slice(-LIMITS.MAX_SAMPLES);

      this.recentResults.push({ ok: result.ok, ms: result.ms, at: Date.now() });
      if (this.recentResults.length > 100) this.recentResults.shift();

      // Kind-aware, evidence-aware state assignment.
      // ok=true with rcode → DNS verified; ok=true without → reachable only.
      const isDnsKind = this.options.kind === "dns";
      const failState: HealthState = isDnsKind ? "DNS_FAILED" : "TCP_FAILED";

      if (result.ok) {
        entry.consecutiveFailures = 0;
        // Check if we have actual DNS evidence (rcode from DoH response).
        const hasDnsEvidence = result.detail?.startsWith("rcode:");
        if (isDnsKind && hasDnsEvidence) {
          this.updateRecord(id, { state: "DNS_PASS" });
        } else if (!isDnsKind) {
          this.updateRecord(id, { state: "TCP_PASS" });
        } else {
          // DNS endpoint is reachable but we couldn't verify DNS protocol.
          this.updateRecord(id, { state: "REACHABLE" });
        }
      } else {
        entry.consecutiveFailures++;
        if (entry.consecutiveFailures >= LIMITS.CIRCUIT_THRESHOLD) {
          this.circuits.set(id, { failures: entry.consecutiveFailures, openUntil: Date.now() + LIMITS.CIRCUIT_COOLDOWN_MS });
        }
        const reason = (result.detail as FailureReason) || "UNKNOWN";
        this.updateRecord(id, { state: failState, failureReason: reason });
      }

      this.processedCount++;
      this.emit({ type: "row", at: Date.now(), data: id });
    } catch (err) {
      clearTimeout(timeoutId);
      this.processedCount++;
      const catchState: HealthState = this.options.kind === "dns" ? "DNS_FAILED" : "TCP_FAILED";
      this.updateRecord(id, { state: catchState, failureReason: "TIMEOUT" });
      this.recentResults.push({ ok: false, ms: 5000, at: Date.now() });
    } finally {
      this.activeWorkers--;
      this.pump();
    }
  }

  /* ── Private: adaptive concurrency (§16, §17) ───────────────── */
  private adaptConcurrency(): void {
    if (this.phase !== "pass1" && this.phase !== "pass2") return;
    const now = Date.now();
    if (now - this.lastHealthCheck < 2000) return;
    this.lastHealthCheck = now;

    // Only look at recent window (last 5s)
    const windowStart = now - 5000;
    const recent = this.recentResults.filter((r) => r.at >= windowStart);
    if (recent.length < 5) return;

    const okCount = recent.filter((r) => r.ok).length;
    const okRate = okCount / recent.length;
    const avgLatency = recent.reduce((a, r) => a + r.ms, 0) / recent.length;
    const queueDepth = this.queue.length;

    if (okRate < 0.5 || avgLatency > 3000) {
      this.concurrency = Math.max(2, Math.floor(this.concurrency * 0.6));
    } else if (okRate > 0.85 && avgLatency < 1200 && queueDepth > 0) {
      this.concurrency = Math.min(this.maxConcurrency, this.concurrency + 2);
    }
  }

  /* ── Private: phase completion ─────────────────────────────── */
  private onPhaseComplete(): void {
    if (this.phase === "pass1") {
      // Transition to pass 2: re-queue reachable endpoints for deep verification
      this.phase = "pass2";
      for (const rec of this.records.values()) {
        if (rec.state === "REACHABLE") {
          this.queue.push({
            endpoint: rec.endpoint,
            priority: 1, // P1 = previously verified
            consecutiveFailures: 0,
            circuitUntil: 0,
          });
        }
      }
      this.queue.sort((a, b) => a.priority - b.priority);
      this.emit({ type: "phase", at: Date.now(), data: "pass2" });
      this.pump();
    } else if (this.phase === "pass2") {
      this.finalize();
    }
  }

  /* ── Private: finalize + compute stats ─────────────────────── */
  private finalize(): void {
    this.phase = "complete";
    if (this.timer) { clearInterval(this.timer); this.timer = null; }

    for (const rec of this.records.values()) {
      if (rec.raw.length === 0) continue;
      const metrics = deriveMetrics(rec.raw);
      const scores = computeScores(metrics, rec.verification);
      const confidence = computeConfidence(metrics, rec.verification, Date.now() - rec.updatedAt);
      const behavior = classifyBehavior(metrics);

      // State determination: VERIFIED requires actual DNS evidence for DNS kind,
      // or TCP evidence for Proxy kind. REACHABLE alone is not VERIFIED for DNS.
      let state: HealthState = rec.state;
      const isDnsKind = this.options.kind === "dns";
      const hasDnsEvidence = rec.raw.some((s) => s.detail?.startsWith("rcode:"));
      const hasAnySuccess = metrics.successCount > 0;

      if (isDnsKind) {
        if (hasDnsEvidence && metrics.sampleCount >= 2 && metrics.successRate >= 50) {
          state = "VERIFIED";
        } else if (hasDnsEvidence) {
          state = "DNS_PASS";
        } else if (hasAnySuccess && metrics.successRate >= 50) {
          state = "DNS_PARTIAL"; // Reachable but DNS protocol not confirmed.
        } else if (hasAnySuccess) {
          state = "REACHABLE";
        } else {
          state = "DNS_FAILED";
        }
      } else {
        // Proxy: TCP connection success = verified for proxy purposes.
        if (hasAnySuccess && metrics.sampleCount >= 2 && metrics.successRate >= 50) {
          state = "VERIFIED";
        } else if (hasAnySuccess) {
          state = "TCP_PASS";
        } else {
          state = "TCP_FAILED";
        }
      }

      rec.metrics = metrics;
      rec.scores = scores;
      rec.confidence = confidence;
      rec.networkBehavior = behavior;
      rec.state = state;
      rec.updatedAt = Date.now();
    }

    this.flush(true);
    this.options.onComplete?.(this.records);
    this.emit({ type: "complete", at: Date.now(), data: null });
  }

  /* ── Private: update record fields ─────────────────────────── */
  private updateRecord(id: string, updates: Partial<EndpointRecord>): void {
    const rec = this.records.get(id);
    if (!rec) return;
    Object.assign(rec, updates);
    rec.updatedAt = Date.now();
  }

  /* ── Private: batched event emission (§24) ─────────────────── */
  private emit(event: ScanEvent): void {
    this.eventBuffer.push(event);
    const now = performance.now();
    if (now - this.lastFlush >= this.flushInterval) this.flush();
  }

  private flush(force = false): void {
    if (this.eventBuffer.length === 0 && !force) return;
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    this.lastFlush = performance.now();
    this.options.onBatch?.(events, this.getProgress());
  }
}

const round2 = (n: number): number => Math.round(n * 10) / 10;
