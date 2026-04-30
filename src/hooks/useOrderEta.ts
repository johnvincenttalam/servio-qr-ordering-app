import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface UseOrderEtaReturn {
  /** Minutes the kitchen typically takes — null while loading or on error. */
  minutes: number | null;
}

// Module-level cache so two OrderStatus mounts in the same session don't
// double-fetch. Refetches naturally on a fresh page load.
let cachedMinutes: number | null = null;
let inflight: Promise<number | null> | null = null;

async function fetchEta(): Promise<number | null> {
  if (cachedMinutes !== null) return cachedMinutes;
  if (inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase.rpc("order_eta_minutes");
    if (error) {
      console.warn("[order-eta] rpc failed:", error.message);
      return null;
    }
    const n = typeof data === "number" ? data : null;
    if (n !== null) cachedMinutes = n;
    return n;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * Fetches the shop-wide average prep time once per session. Returns null
 * while loading or if the RPC fails — the caller should hide the ETA in
 * that case rather than show a placeholder.
 */
export function useOrderEta(enabled: boolean = true): UseOrderEtaReturn {
  const [minutes, setMinutes] = useState<number | null>(cachedMinutes);

  useEffect(() => {
    if (!enabled) return;
    if (cachedMinutes !== null) {
      setMinutes(cachedMinutes);
      return;
    }
    let cancelled = false;
    fetchEta().then((value) => {
      if (!cancelled) setMinutes(value);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { minutes };
}
