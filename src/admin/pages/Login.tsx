import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Utensils, AlertCircle } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Input } from "@/components/ui/input";

interface LocationState {
  from?: string;
  reason?: "no-staff-record" | "expired-reset";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, isLoading, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const flashReason = (location.state as LocationState | null)?.reason;

  // If already authed with a role, bounce to dashboard
  useEffect(() => {
    if (!isLoading && user && role) {
      navigate("/admin", { replace: true });
    }
  }, [user, role, isLoading, navigate]);

  // Show a friendly message if the guard kicked us back here without a role
  useEffect(() => {
    if (flashReason === "no-staff-record" && user && !role) {
      setError(
        "You're signed in but not registered as staff. Ask an admin to add you."
      );
    } else if (flashReason === "expired-reset") {
      setError(
        "That reset link has expired. Request a new one below."
      );
    }
  }, [flashReason, user, role]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // The useEffect above will redirect once role loads
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sign in failed. Check your email and password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
            <Utensils className="h-6 w-6" strokeWidth={2.4} />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            SERVIO Admin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage the kitchen and menu.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-border bg-card p-5"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-semibold">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="staff@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-semibold">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full rounded-full bg-foreground py-3 text-sm font-semibold text-background transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <Link
            to="/admin/forgot-password"
            className="block text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Link>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Staff accounts are created by an admin from the Staff manager.
        </p>
      </div>
    </div>
  );
}
