// Auto-detect the user's network on app open.
import { useEffect, useState } from "react";
import { detectNetwork, friendlyIspName, networkStore, type NetworkInfo } from "./detectNetwork";

export type NetworkState =
  | { status: "idle" }
  | { status: "detecting" }
  | { status: "detected"; info: NetworkInfo; friendlyIsp: string | null }
  | { status: "failed" };

export function useNetworkDetection(): NetworkState & { redetect: () => void } {
  const [state, setState] = useState<NetworkState>(() => {
    const cached = networkStore.get();
    if (cached) {
      return { status: "detected", info: cached, friendlyIsp: friendlyIspName(cached.asn, cached.isp) };
    }
    return { status: "idle" };
  });

  const run = async () => {
    setState({ status: "detecting" });
    const info = await detectNetwork();
    if (info) {
      networkStore.set(info);
      setState({ status: "detected", info, friendlyIsp: friendlyIspName(info.asn, info.isp) });
    } else {
      setState({ status: "failed" });
    }
  };

  useEffect(() => {
    if (networkStore.get()) return;
    const timer = setTimeout(() => {
      void run();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return { ...state, redetect: run };
}
