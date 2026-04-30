import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type StaffRole = "admin" | "kitchen" | "waiter";

interface AuthContextValue {
  user: User | null;
  role: StaffRole | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INIT_TIMEOUT_MS = 2000;
const ROLE_QUERY_TIMEOUT_MS = 3000;

const ROLE_CACHE_KEY = "servio.auth.role";
const USERID_CACHE_KEY = "servio.auth.userId";

function getCachedRole(userId: string): StaffRole | null {
  try {
    if (sessionStorage.getItem(USERID_CACHE_KEY) !== userId) return null;
    return sessionStorage.getItem(ROLE_CACHE_KEY) as StaffRole | null;
  } catch {
    return null;
  }
}

function setCachedRole(userId: string | null, role: StaffRole | null) {
  try {
    if (userId && role) {
      sessionStorage.setItem(USERID_CACHE_KEY, userId);
      sessionStorage.setItem(ROLE_CACHE_KEY, role);
    } else {
      sessionStorage.removeItem(USERID_CACHE_KEY);
      sessionStorage.removeItem(ROLE_CACHE_KEY);
    }
  } catch {
    // sessionStorage may throw in private browsing — fail silent
  }
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      window.setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms
      )
    ),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let firstEventReceived = false;

    async function fetchRoleFromDb(userId: string): Promise<StaffRole | null> {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("staff")
            .select("role")
            .eq("user_id", userId)
            .maybeSingle(),
          ROLE_QUERY_TIMEOUT_MS,
          "loadStaffRole"
        );
        if (error) {
          console.error("[auth] loadStaffRole error:", error);
          return null;
        }
        return (data?.role as StaffRole | undefined) ?? null;
      } catch (err) {
        console.error("[auth] loadStaffRole failed:", err);
        return null;
      }
    }

    async function backgroundRefreshRole(userId: string) {
      const dbRole = await fetchRoleFromDb(userId);
      if (cancelled) return;
      setCachedRole(userId, dbRole);
      setRole(dbRole);
    }

    async function handleAuthEvent(session: { user: User | null } | null) {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setCachedRole(null, null);
        setRole(null);
        if (!cancelled) setIsLoading(false);
        return;
      }

      const cached = getCachedRole(nextUser.id);
      if (cached) {
        // Instant: trust cache, unblock UI now, refresh in background
        setRole(cached);
        if (!cancelled) setIsLoading(false);
        backgroundRefreshRole(nextUser.id);
      } else {
        // No cache: wait for DB (with timeout) before unblocking
        const dbRole = await fetchRoleFromDb(nextUser.id);
        if (cancelled) return;
        setCachedRole(nextUser.id, dbRole);
        setRole(dbRole);
        setIsLoading(false);
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;
        console.log("[auth] state:", event);
        firstEventReceived = true;
        await handleAuthEvent(session);
      }
    );

    // Safety: if no auth event in 2s, assume no session and unblock
    const bootstrapTimer = window.setTimeout(() => {
      if (!cancelled && !firstEventReceived) {
        console.warn(
          `[auth] no auth event within ${INIT_TIMEOUT_MS}ms — assuming no session`
        );
        setUser(null);
        setRole(null);
        setIsLoading(false);
      }
    }, INIT_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(bootstrapTimer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    setCachedRole(null, null);
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
