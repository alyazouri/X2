// ════════════════════════════════════════════════════════════════
// Client mount shell — 1:1 reconstruction of the original
// src/main.tsx bootstrap: StrictMode → LanguageProvider → App
// ════════════════════════════════════════════════════════════════
"use client";

import { StrictMode, useEffect } from "react";
import App from "./App";
import { LanguageProvider } from "./LanguageContext";

export default function Shell() {
  // PWA: register the service worker (production only; dev would fight HMR).
  // Update flow: when a NEW version is detected while one is controlling the
  // page, tell it to skip waiting so users get fixes without a manual purge.
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const incoming = registration.installing;
            if (!incoming) return;
            incoming.addEventListener("statechange", () => {
              if (incoming.state === "installed" && navigator.serviceWorker.controller) {
                incoming.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch(() => { /* offline install unsupported */ });
    }
  }, []);

  return (
    <StrictMode>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </StrictMode>
  );
}
