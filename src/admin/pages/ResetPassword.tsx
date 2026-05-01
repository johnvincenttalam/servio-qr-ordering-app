import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Lock, Utensils } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

/**
 * Used after both:
 *   1. Forgot-password recovery link click (Supabase signed the user in
 *      with a recovery token in the URL fragment)
 *   2. First-time invite link click (admin-invite redirects new staff
 *      here so they're forced to set a password before continuing)
 *
 * Either way the user is already signed in by the time this page mounts;
 * we just collect a new password and call updateUser.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If the link was old/invalid, Supabase won't establish a session. In
  // that case we send the user back to the login screen with a hint.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/admin/login", {
        replace: true,
        state: { reason: "expired-reset" },
      });
    }
  }, [authLoading, user, navigate]);

  const minLength = 8;
  const passwordValid = password.length >= minLength;
  const passwordsMatch = password === confirm;
  const canSubmit = passwordValid && passwordsMatch && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Password is set — drop them on the dashboard. AuthProvider already
    // has a live session so AuthGuard waves them through.
    navigate("/admin", { replace: true });
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
            <Utensils className="h-6 w-6" strokeWidth={2.4} />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Set your password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a password you&apos;ll use to sign in next time.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-border bg-card p-5"
        >
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-semibold">
              New password
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2.2}
              />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl pl-9"
                placeholder="••••••••"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              At least {minLength} characters.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-sm font-semibold">
              Confirm
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2.2}
              />
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 rounded-xl pl-9"
                placeholder="••••••••"
              />
            </div>
            {confirm && !passwordsMatch && (
              <p className="text-[11px] text-destructive">
                Passwords don&apos;t match.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-full bg-foreground py-3 text-sm font-semibold text-background transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {submitting ? "Saving…" : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}
