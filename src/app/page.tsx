// ════════════════════════════════════════════════════════════════
// Entry page — reconstructs the original Vite SPA mount behavior.
// The original index.html ships an empty <div id="root"> and mounts
// the whole app client-side (src/main.tsx). We reproduce that by
// loading the app shell client-only (no server-rendered markup).
// ════════════════════════════════════════════════════════════════
"use client";

import dynamic from "next/dynamic";

const Shell = dynamic(() => import("@/x1/Shell"), { ssr: false });

export default function HomePage() {
  return <Shell />;
}
