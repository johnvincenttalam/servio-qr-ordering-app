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
  avatarUrl: string | null;
  /**
   * True when the user's password was just set by an admin and they
   * must change it before doing anything else. Login routes them
   * straight to /admin/reset-password while this is true. Cleared on
   * the server via clear_password_temporary() once the new password
   * is saved.
   */
  passwordTemporary: boolean;
  isLoading: boolean;
  /**
   * Sign in with either an email or a username + password. Username
   * is resolved to its underlying email via the
   * lookup_email_by_username RPC before calling Supabase auth.
   */
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INIT_TIMEOUT_MS = 2000;
// Generous timeout: covers Supabase cold-start and tabs returning from
// backgrounded sleep. A failure here just means "we don't know yet" — we
// keep the cached role rather than logging the user out (see below).
const ROLE_QUERY_TIMEOUT_MS = 8000;

const ROLE_CACHE_KEY = "servio.auth.role";
const NAME_CACHE_KEY = "servio.auth.displayName";
const AVATAR_CACHE_KEY = "servio.auth.avatarUrl";
const TEMP_PWD_CACHE_KEY = "servio.auth.passwordTemporary";
const USERID_CACHE_KEY = "servio.auth.userId";

interface CachedStaff {
  role: StaffRole;
  displayName: string | null;
  avatarUrl: string | null;
  passwordTemporary: boolean;
}

function getCachedStaff(userId: string): CachedStaff | null {
  try {
    if (sessionStorage.getItem(USERID_CACHE_KEY) !== userId) return null;
    const role = sessionStorage.getItem(ROLE_CACHE_KEY) as StaffRole | null;
    if (!role) return null;
    return {
      role,
      displayName: sessionStorage.getItem(NAME_CACHE_KEY) || null,
      avatarUrl: sessionStorage.getItem(AVATAR_CACHE_KEY) || null,
      passwordTemporary:
        sessionStorage.getItem(TEMP_PWD_CACHE_KEY) === "1",
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
      if (staff.avatarUrl) {
        sessionStorage.setItem(AVATAR_CACHE_KEY, staff.avatarUrl);
      } else {
        sessionStorage.removeItem(AVATAR_CACHE_KEY);
      }
      sessionStorage.setItem(
        TEMP_PWD_CACHE_KEY,
        staff.passwordTemporary ? "1" : "0"
      );
    } else {
      sessionStorage.removeItem(USERID_CACHE_KEY);
      sessionStorage.removeItem(ROLE_CACHE_KEY);
      sessionStorage.removeItem(NAME_CACHE_KEY);
      sessionStorage.removeItem(AVATAR_CACHE_KEY);
      sessionStorage.removeItem(TEMP_PWD_CACHE_KEY);
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [passwordTemporary, setPasswordTemporary] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let firstEventReceived = false;

    type FetchResult =
      | { ok: true; staff: CachedStaff | null }
      | { ok: false };

    async function fetchStaffFromDb(userId: string): Promise<FetchResult> {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("staff")
            .select("role, display_name, avatar_url, password_temporary")
            .eq("user_id", userId)
            .maybeSingle(),
          ROLE_QUERY_TIMEOUT_MS,
          "loadStaff"
        );
        if (error) {
          console.error("[auth] loadStaff error:", error);
          return { ok: false };
        }
        if (!data?.role) return { ok: true, staff: null };
        return {
          ok: true,
          staff: {
            role: data.role as StaffRole,
            displayName: (data.display_name as string | null) ?? null,
            avatarUrl: (data.avatar_url as string | null) ?? null,
            passwordTemporary:
              (data.password_temporary as boolean | null) ?? false,
          },
        };
      } catch (err) {
        console.error("[auth] loadStaff failed:", err);
        return { ok: false };
      }
    }

    async function backgroundRefreshStaff(userId: string) {
      const result = await fetchStaffFromDb(userId);
      if (cancelled) return;
      // Only update on a definitive answer. A transient timeout/network
      // error must not blow away the cached role — that's the path that
      // was logging users out on refresh.
      if (!result.ok) return;
      setCachedStaff(userId, result.staff);
      setRole(result.staff?.role ?? null);
      setDisplayName(result.staff?.displayName ?? null);
      setAvatarUrl(result.staff?.avatarUrl ?? null);
      setPasswordTemporary(result.staff?.passwordTemporary ?? false);
    }

    async function handleAuthEvent(session: { user: User | null } | null) {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setCachedStaff(null, null);
        setRole(null);
        setDisplayName(null);
        setAvatarUrl(null);
        setPasswordTemporary(false);
        if (!cancelled) setIsLoading(false);
        return;
      }

      const cached = getCachedStaff(nextUser.id);
      if (cached) {
        // Instant: trust cache, unblock UI now, refresh in background.
        setRole(cached.role);
        setDisplayName(cached.displayName);
        setAvatarUrl(cached.avatarUrl);
        setPasswordTemporary(cached.passwordTemporary);
        if (!cancelled) setIsLoading(false);
        backgroundRefreshStaff(nextUser.id);
        return;
      }

      // No cache: wait for DB. Retry once on transient error so a single
      // slow request doesn't immediately drop us into the unauthorized
      // login screen.
      let result = await fetchStaffFromDb(nextUser.id);
      if (!result.ok && !cancelled) {
        await new Promise((r) => window.setTimeout(r, 500));
        result = await fetchStaffFromDb(nextUser.id);
      }
      if (cancelled) return;
      const staff = result.ok ? result.staff : null;
      setCachedStaff(nextUser.id, staff);
      setRole(staff?.role ?? null);
      setDisplayName(staff?.displayName ?? null);
      setAvatarUrl(staff?.avatarUrl ?? null);
      setPasswordTemporary(staff?.passwordTemporary ?? false);
      setIsLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return;
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
        setAvatarUrl(null);
        setPasswordTemporary(false);
        setIsLoading(false);
      }
    }, INIT_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(bootstrapTimer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const trimmed = identifier.trim();
      let email = trimmed;

      // No "@" → treat as username, resolve to email via the public RPC
      if (!trimmed.includes("@")) {
        const { data, error: rpcError } = await supabase.rpc(
          "lookup_email_by_username",
          { p_username: trimmed.toLowerCase() }
        );
        if (rpcError) {
          throw new Error("Couldn't verify the username. Try again.");
        }
        if (!data) {
          // Mirror Supabase's invalid-credentials wording so an attacker
          // can't tell whether it was a bad username or a bad password.
          throw new Error("Invalid login credentials");
        }
        email = data as string;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    []
  );

  const signOut = useCallback(async () => {
    setCachedStaff(null, null);
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        displayName,
        avatarUrl,
        passwordTemporary,
        isLoading,
        signIn,
        signOut,
      }}
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
