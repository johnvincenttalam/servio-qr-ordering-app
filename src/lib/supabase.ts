import { createClient, processLock } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Default `navigatorLock` coordinates token refreshes across tabs of
    // the same origin. That's appropriate for SPAs with one tab open at
    // a time, but our operators routinely keep admin + kitchen + a
    // customer flow open simultaneously, and the cross-tab lock starts
    // throwing NavigatorLockAcquireTimeoutError when several tabs try to
    // refresh in the same window. processLock is in-memory per-tab —
    // each tab runs its own refresh cycle, still sharing the persisted
    // session via localStorage, with no cross-tab contention.
    lock: processLock,
  },
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
});
