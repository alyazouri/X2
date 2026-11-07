// USER GEOLOCATION — requests GPS permission on app open with HIGH ACCURACY.
// Uses watchPosition for continuous refinement and surfaces accuracy so a coarse
// IP/network-estimated position is never presented as a precise GPS fix.
import { useEffect, useRef, useState, useCallback } from "react";

export interface GeoCoords { lat: number; lng: number; accuracy: number | null; }
export type GeoPrecision = "precise" | "approximate" | "coarse";

export type GeoState =
  | { status: "idle" }
  | { status: "prompting" }
  | { status: "granted"; coords: GeoCoords; precision: GeoPrecision }
  | { status: "denied" }
  | { status: "error"; message: string }
  | { status: "unsupported" };

// Accuracy thresholds (meters)
const PRECISE_M = 1000;      // < 1 km → true GPS fix
const APPROXIMATE_M = 10000; // 1–10 km → approximate (WiFi / cell)
// > 10 km → coarse (often an IP-based estimate that can be the wrong city)

export function useGeolocation(): GeoState & { requestAgain: () => void } {
  const [state, setState] = useState<GeoState>({ status: "idle" });
  const bestAccRef = useRef<number>(Infinity);
  const watchIdRef = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      try { navigator.geolocation.clearWatch(watchIdRef.current); } catch { /* */ }
      watchIdRef.current = null;
    }
  }, []);

  const accept = useCallback((pos: GeolocationPosition) => {
    const accuracy = pos.coords.accuracy ?? null;
    // Keep the BEST (lowest) accuracy reading so far.
    if (accuracy !== null && accuracy >= bestAccRef.current) return;
    if (accuracy !== null) bestAccRef.current = accuracy;

    const precision: GeoPrecision =
      accuracy === null ? "coarse"
        : accuracy < PRECISE_M ? "precise"
          : accuracy < APPROXIMATE_M ? "approximate" : "coarse";

    setState({
      status: "granted",
      coords: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy },
      precision,
    });
  }, []);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "unsupported" });
      return;
    }
    setState({ status: "prompting" });
    bestAccRef.current = Infinity;

    // High-accuracy single shot first.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        accept(pos);
        // Continue watching for a more accurate fix (mobile refines over time).
        clearWatch();
        watchIdRef.current = navigator.geolocation.watchPosition(
          accept,
          () => { /* keep best reading */ },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
        );
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState({ status: "denied" });
        else setState({ status: "error", message: err.message });
      },
      // High accuracy → genuine GPS where available; never a stale cached position.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [accept, clearWatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      requestLocation();
    }, 0);
    return () => {
      clearTimeout(timer);
      clearWatch();
    };
  }, [requestLocation, clearWatch]);

  return { ...state, requestAgain: requestLocation };
}
