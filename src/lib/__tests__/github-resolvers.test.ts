// GitHub resolver sync — pure extraction logic tests.
import { describe, expect, it } from "vitest";
import { extractIpv4, mergeEntries, mergeSources, parseContinentJson, parseProviderJson } from "../github-resolvers";

describe("extractIpv4", () => {
  it("extracts IPs one per line", () => {
    expect(extractIpv4("1.1.1.1\n8.8.8.8\n9.9.9.9")).toEqual(["1.1.1.1", "8.8.8.8", "9.9.9.9"]);
  });
  it("ignores comments, hostnames and malformed octets", () => {
    const raw = "# public DNS\nCloudflare 1.1.1.1\nresolver.example.com\n300.1.1.1\n1.2.3\n0x42";
    expect(extractIpv4(raw)).toEqual(["1.1.1.1"]);
  });
  it("dedupes", () => {
    expect(extractIpv4("8.8.8.8\n8.8.8.8\n8.8.8.8")).toEqual(["8.8.8.8"]);
  });
  it("excludes private/reserved ranges (RFC1918 etc.)", () => {
    const raw = "10.0.0.1\n127.0.0.1\n192.168.1.1\n172.16.0.1\n169.254.0.1\n224.0.0.1\n1.1.1.1";
    expect(extractIpv4(raw)).toEqual(["1.1.1.1"]);
  });
  it("handles host:port lines by taking the host", () => {
    expect(extractIpv4("1.1.1.1:53\n9.9.9.9:53")).toEqual(["1.1.1.1", "9.9.9.9"]);
  });
});

describe("parseContinentJson", () => {
  it("keeps real country/continent/organization metadata", () => {
    const input = JSON.stringify({
      metadata: { continent: "Asia" },
      resolvers: [
        { ip: "87.236.233.117", country: "Jordan", country_code: "jo", continent: "Asia", organization: "JUNet" },
        { ip: "300.1.1.1", country: "Invalid", country_code: "xx" },
      ],
    });
    expect(parseContinentJson(input)).toEqual([
      { ip: "87.236.233.117", country: "Jordan", countryCode: "jo", continent: "Asia", organization: "JUNet" },
    ]);
  });
  it("returns empty for malformed/non-directory JSON", () => {
    expect(parseContinentJson("not-json")).toEqual([]);
    expect(parseContinentJson(JSON.stringify({ items: [] }))).toEqual([]);
  });
});

describe("parseProviderJson", () => {
  it("parses verified structured provider rows", () => {
    const input = JSON.stringify({
      servers: [
        { provider: "Cloudflare", variant: "Standard", filtering: "none", ipv4: ["1.1.1.1", "1.0.0.1"], ipv6: [], doh: "https://cloudflare-dns.com/dns-query", dot: "one.one.one.one" },
      ],
    });
    expect(parseProviderJson(input)).toEqual([
      { ip: "1.1.1.1", country: "Cloudflare (Standard)", countryCode: null, continent: null, organization: "none" },
      { ip: "1.0.0.1", country: "Cloudflare (Standard)", countryCode: null, continent: null, organization: "none" },
    ]);
  });
});

describe("mergeEntries", () => {
  it("prefers the duplicate entry that carries country metadata", () => {
    const out = mergeEntries([
      { ips: ["1.1.1.1"], entries: [] },
      { ips: ["1.1.1.1"], entries: [{ ip: "1.1.1.1", country: "Australia", countryCode: "au", continent: "Oceania", organization: "Cloudflare" }] },
    ]);
    expect(out).toEqual([{ ip: "1.1.1.1", country: "Australia", countryCode: "au", continent: "Oceania", organization: "Cloudflare" }]);
  });
});

describe("mergeSources", () => {
  it("merges in first-seen order with no duplicates", () => {
    const out = mergeSources([
      { repo: "a/b", ips: ["1.1.1.1", "2.2.2.2"], path: "main/x" },
      { repo: "c/d", ips: ["2.2.2.2", "3.3.3.3"], path: "main/y" },
      { repo: "e/f", ips: [], path: null },
    ]);
    expect(out).toEqual(["1.1.1.1", "2.2.2.2", "3.3.3.3"]);
  });
  it("empty parts yield nothing", () => {
    expect(mergeSources([])).toEqual([]);
  });
});
