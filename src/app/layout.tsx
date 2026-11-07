import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Cairo, Orbitron } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "900"],
  display: "swap",
  variable: "--font-cairo",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-orbitron",
});

/* ═══ ALYAZOURI "A" star-burst monogram (aurora gradient) — original favicon ═══ */
const MARK_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23ffd166'/%3E%3Cstop offset='38%25' stop-color='%23ff9e2e'/%3E%3Cstop offset='70%25' stop-color='%23e03e00'/%3E%3Cstop offset='100%25' stop-color='%23a855f7'/%3E%3C/linearGradient%3E%3CradialGradient id='c' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%23fff8e1'/%3E%3Cstop offset='55%25' stop-color='%23ffd166'/%3E%3Cstop offset='100%25' stop-color='%23ff7a00' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='%2306040a'/%3E%3Cpath d='M100 4 L115.6 84.4 L196 100 L115.6 115.6 L100 196 L84.4 115.6 L4 100 L84.4 84.4 Z' fill='url(%23g)' opacity='0.92'/%3E%3Ccircle cx='100' cy='100' r='88' fill='none' stroke='url(%23g)' stroke-width='4' opacity='0.45'/%3E%3Ccircle cx='100' cy='100' r='26' fill='url(%23c)'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "محسّن الأردن | ALYAZOURI 2026 — PUBG Mobile Optimizer",
  description:
    "محسّن الأردن ALYAZOURI 2026 — مولد حساسية ببجي موبايل بالذكاء الاصطناعي، محلّل DNS والبروكسي الأردني، ومراقب البنق الحي.",
  icons: {
    icon: [
      { url: MARK_SVG, type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#06040a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${orbitron.variable}`}>
      <body>{children}</body>
    </html>
  );
}
