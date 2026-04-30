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
  displayName: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INIT_TIMEOUT_MS = 2000;
const ROLE_QUERY_TIMEOUT_MS = 3000;

const ROLE_CACHE_KEY = "servio.auth.role";
const NAME_CACHE_KEY = "servio.auth.displayName";
const USERID_CACHE_KEY = "servio.auth.userId";

interface CachedStaff {
  role: StaffRole;
  displayName: string | null;
}

function getCachedStaff(userId: string): CachedStaff | null {
  try {
    if (sessionStorage.getItem(USERID_CACHE_KEY) !== userId) return null;
    const role = sessionStorage.getItem(ROLE_CACHE_KEY) as StaffRole | null;
    if (!role) return null;
    return {
      role,
      displayName: sessionStorage.getItem(NAME_CACHE_KEY) || null,
    };
  } catch {
    return null;
  }
}

function setCachedStaff(userId: string | null, staff: CachedStaff | null) {
  try {
    if (userId && staff) {
      sessionStorage.setItem(USERID_CACHE_KEY, userId);
      sessionStorage.setItem(ROLE_CACHE_KEY, staff.role);
      if (staff.displayName) {
        sessionStorage.setItem(NAME_CACHE_KEY, staff.displayName);
      } else {
        sessionStorage.removeItem(NAME_CACHE_KEY);
      }
    } else {
      sessionStorage.removeItem(USERID_CACHE_KEY);
      sessionStorage.removeItem(ROLE_CACHE_KEY);
      sessionStorage.removeItem(NAME_CACHE_KEY);
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
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let firstEventReceived = false;

    async function fetchStaffFromDb(
      userId: string
    ): Promise<CachedStaff | null> {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("staff")
            .select("role, display_name")
            .eq("user_id", userId)
            .maybeSingle(),
          ROLE_QUERY_TIMEOUT_MS,
          "loadStaff"
        );
        if (error) {
          console.error("[auth] loadStaff error:", error);
          return null;
        }
        if (!data?.role) return null;
        return {
          role: data.role as StaffRole,
          displayName: (data.display_name as string | null) ?? null,
        };
      } catch (err) {
        console.error("[auth] loadStaff failed:", err);
        return null;
      }
    }

    async function backgroundRefreshStaff(userId: string) {
      const fresh = await fetchStaffFromDb(userId);
      if (cancelled) return;
      setCachedStaff(userId, fresh);
      setRole(fresh?.role ?? null);
      setDisplayName(fresh?.displayName ?? null);
    }

    async function handleAuthEvent(session: { user: User | null } | null) {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setCachedStaff(null, null);
        setRole(null);
        setDisplayName(null);
        if (!cancelled) setIsLoading(false);
        return;
      }

      const cached = getCachedStaff(nextUser.id);
      if (cached) {
        // Instant: trust cache, unblock UI now, refresh in background
        setRole(cached.role);
        setDisplayName(cached.displayName);
        if (!cancelled) setIsLoading(false);
        backgroundRefreshStaff(nextUser.id);
      } else {
        // No cache: wait for DB (with timeout) before unblocking
        const fresh = await fetchStaffFromDb(nextUser.id);
        if (cancelled) return;
        setCachedStaff(nextUser.id, fresh);
        setRole(fresh?.role ?? null);
        setDisplayName(fresh?.displayName ?? null);
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
        setDisplayName(null);
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
    setCachedStaff(null, null);
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, role, displayName, isLoading, signIn, signOut }}
    >
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
