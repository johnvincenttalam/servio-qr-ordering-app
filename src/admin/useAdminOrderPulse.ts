import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { playChime, primeChime } from "@/lib/chime";

const SOUND_PREF_KEY = "servio.admin.orderSound";

/**
 * Lightweight pulse for the admin layout: tracks the number of orders
 * currently in `pending` status and plays a chime whenever that count
 * strictly rises — i.e. a new customer order arrived. Mirrors the
 * kitchen's audio-cue behaviour so an admin who's on the Menu (or any
 * non-Orders) page still notices fresh tickets coming in.
 *
 * The badge count and the sound preference are both surfaced so the
 * Sidebar can render them consistently. The sound preference is
 * persisted in localStorage; the count is fetched on mount and
 * refreshed on any realtime change to the orders table.
 */
export function useAdminOrderPulse() {
  const [pendingCount, setPendingCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SOUND_PREF_KEY) === "on";
    } catch {
      return false;
    }
  });

  const refetch = useCallback(async () => {
    const { count, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (error) {
      console.warn("[admin/pulse] count failed:", error);
      return;
    }
    setPendingCount(count ?? 0);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Realtime: any change on the orders table might affect the pending
  // bucket — a new INSERT (always pending), or a status change in or
  // out of pending. A simple refetch is cheaper to reason about than
  // diffing the payload, and the count query is single-row fast.
  useRealtimeTables({
    channel: "admin-pulse",
    tables: ["orders"],
    onChange: () => {
      void refetch();
    },
  });

  // Chime on count rise. Initial mount is suppressed because the ref
  // starts equal to the loaded value, so we only fire when realtime
  // bumps the count above what we'd already settled on.
  const prevCountRef = useRef(pendingCount);
  useEffect(() => {
    if (pendingCount > prevCountRef.current && soundEnabled) {
      playChime();
    }
    prevCountRef.current = pendingCount;
  }, [pendingCount, soundEnabled]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_PREF_KEY, next ? "on" : "off");
      } catch {
        // Private mode / disabled storage — preference still works for the session.
      }
      if (next) {
        // The toggle click is a user gesture; use it to unlock the
        // audio context and play a confirmation tone so the admin
        // knows the chime is wired up.
        primeChime();
        playChime();
      }
      return next;
    });
  }, []);

  return { pendingCount, soundEnabled, toggleSound };
}
