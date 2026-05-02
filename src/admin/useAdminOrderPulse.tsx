import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { playChime, primeChime } from "@/lib/chime";

const SOUND_PREF_KEY = "servio.admin.orderSound";

interface AdminOrderPulseValue {
  pendingCount: number;
  soundEnabled: boolean;
  toggleSound: () => void;
}

const AdminOrderPulseContext = createContext<AdminOrderPulseValue | null>(null);

/**
 * Provider that owns the single pulse subscription for the admin
 * surface: the pending-orders count, a chime on count rise, and the
 * persistent "sound on/off" preference. Mounted once at the
 * AdminLayout level so Sidebar (badge) and Profile (toggle) can both
 * read from context without each opening a duplicate Supabase channel.
 */
export function AdminOrderPulseProvider({ children }: { children: ReactNode }) {
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

  return (
    <AdminOrderPulseContext.Provider
      value={{ pendingCount, soundEnabled, toggleSound }}
    >
      {children}
    </AdminOrderPulseContext.Provider>
  );
}

/**
 * Read the pulse state from the provider. Falls back to a quiet,
 * zero-count, no-op stub when called outside the provider so an
 * orphan render doesn't crash.
 */
export function useAdminOrderPulse(): AdminOrderPulseValue {
  const ctx = useContext(AdminOrderPulseContext);
  if (!ctx) {
    return {
      pendingCount: 0,
      soundEnabled: false,
      toggleSound: () => undefined,
    };
  }
  return ctx;
}
