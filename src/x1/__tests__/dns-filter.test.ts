// ════════════════════════════════════════════════════════════════
// DNS FILTERING CLASSIFICATION — pure logic tests.
// The filter state is derived ONLY from real RCODE/label evidence:
// a resolver that returns RCODE 0 for a known-good domain is OPEN (works,
// unfiltered); REFUSED/NXDOMAIN mean it blocks/censors (FILTERED);
// SERVFAIL/ALIVE mean unusable (BROKEN); TIMEOUT/UNREACHABLE = OFFLINE.
// This guarantees "any DNS that doesn't work is hidden" is evidence-based,
// never guessed.
// ════════════════════════════════════════════════════════════════
import { describe, expect, it } from "vitest";
import { dnsLabelOf, dnssecRankOf, filterStateOf } from "../net/NetworkCenter";

describe("dnsLabelOf — RCODE evidence → label", () => {
  it("maps real RCODEs to labels", () => {
    expect(dnsLabelOf(0, false, false, false)).toBe("VALID-DNS");
    expect(dnsLabelOf(3, false, false, false)).toBe("NXDOMAIN");
    expect(dnsLabelOf(2, false, false, false)).toBe("SERVFAIL");
    expect(dnsLabelOf(5, false, false, false)).toBe("REFUSED");
  });
  it("falls back to aliveness / timeout when there is no RCODE", () => {
    expect(dnsLabelOf(null, true, false, false)).toBe("ALIVE");
    expect(dnsLabelOf(null, false, false, true)).toBe("UNREACHABLE");
    expect(dnsLabelOf(null, false, true, false)).toBe("TIMEOUT");
    expect(dnsLabelOf(null, false, false, false)).toBe("TIMEOUT");
  });
});

describe("filterStateOf — label → filtering classification", () => {
  it("RCODE 0 (VALID-DNS) is OPEN — works, unfiltered", () => {
    expect(filterStateOf("VALID-DNS")).toBe("OPEN");
  });
  it("REFUSED and NXDOMAIN are FILTERED — resolver blocks/censors", () => {
    expect(filterStateOf("REFUSED")).toBe("FILTERED");
    expect(filterStateOf("NXDOMAIN")).toBe("FILTERED");
  });
  it("SERVFAIL and ALIVE are BROKEN — no usable DNS answer", () => {
    expect(filterStateOf("SERVFAIL")).toBe("BROKEN");
    expect(filterStateOf("ALIVE")).toBe("BROKEN");
  });
  it("TIMEOUT and UNREACHABLE are OFFLINE", () => {
    expect(filterStateOf("TIMEOUT")).toBe("OFFLINE");
    expect(filterStateOf("UNREACHABLE")).toBe("OFFLINE");
  });
  it("only OPEN counts as working (the results-list rule)", () => {
    const labels = ["VALID-DNS", "NXDOMAIN", "SERVFAIL", "REFUSED", "ALIVE", "TIMEOUT", "UNREACHABLE"] as const;
    const working = labels.filter((l) => filterStateOf(l) === "OPEN");
    expect(working).toEqual(["VALID-DNS"]); // exactly one label is "works on my network"
  });
});

describe("DNSSEC recommendation priority", () => {
  it("prefers validating, then unverified, then known non-validating", () => {
    expect(dnssecRankOf("VALIDATING")).toBeLessThan(dnssecRankOf("UNVERIFIED"));
    expect(dnssecRankOf("UNVERIFIED")).toBeLessThan(dnssecRankOf("NOT_VALIDATING"));
  });
  it("sorts states in the documented security order", () => {
    const states = ["NOT_VALIDATING", "VALIDATING", "UNVERIFIED"] as const;
    expect([...states].sort((a, b) => dnssecRankOf(a) - dnssecRankOf(b)))
      .toEqual(["VALIDATING", "UNVERIFIED", "NOT_VALIDATING"]);
  });
});
