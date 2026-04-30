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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStaffRole(userId: string) {
      const { data } = await supabase
        .from("staff")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!cancelled) {
        setRole((data?.role as StaffRole | undefined) ?? null);
      }
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        await loadStaffRole(sessionUser.id);
      }
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return;
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        if (nextUser) {
          await loadStaffRole(nextUser.id);
        } else {
          setRole(null);
        }
      }
    );

    return () => {
      cancelled = true;
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
