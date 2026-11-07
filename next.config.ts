import type { NextConfig } from "next";

/**
 * Content-Security-Policy for ALYAZOURI 2026.
 *
 * Rationale per directive:
 *  • script-src MUST allow 'unsafe-inline': Next.js App Router injects inline
 *    flight-data scripts (self.__next_f.push) into the prerendered HTML — they
 *    are the app's bootstrap itself. Static pages cannot carry a per-request
 *    nonce, so inline scripts are permitted while every other hardening
 *    directive stays strict. Blocking them = blank page.
 *  • connect-src allows `https:` broadly BY DESIGN: the network scanner's core
 *    function is probing arbitrary Jordanian endpoints (DNS/CDN/relays), so
 *    restricting it to a fixed domain list would break the product. All
 *    sensitive calls (our own API) stay same-origin.
 *  • style-src/font-src allow Google Fonts (Cairo + Orbitron — the visual
 *    identity depends on them).
 *  • frame-src/script-src allow youtube.com for the ambient music player.
 *  • img-src allows the external QR generator used by the share dialog.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.youtube.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://api.qrserver.com",
  "connect-src 'self' https: wss:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-src https://www.youtube.com",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// NOTE: frame-ancestors and X-Frame-Options are intentionally OMITTED.
// The project is viewed through cross-origin preview frames during
// development/verification; denying framing renders a blank page there.
// Clickjacking risk for this read-mostly public tool is minimal, and the
// remaining CSP directives (object-src/base-uri/form-action/script-src)
// still provide the core XSS protections.
const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Hashed build assets are immutable — cache aggressively.
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // PWA files must always revalidate so installed apps receive updates.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
    ];
  },
};

export default nextConfig;
