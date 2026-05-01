import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { AuthShell } from "../components/AuthShell";

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

    if (updateError) {
      setSubmitting(false);
      setError(updateError.message);
      return;
    }

    // Clear the password_temporary flag via the security-definer RPC
    // so future logins go straight to the dashboard. Failure here is
    // not fatal — the next login will prompt them again, which is
    // annoying but not broken.
    const { error: clearError } = await supabase.rpc(
      "clear_password_temporary"
    );
    if (clearError) {
      console.warn("[reset] couldn't clear temp flag:", clearError);
    }

    setSubmitting(false);
    // Force a hard navigate so AuthProvider re-fetches the staff row
    // and picks up password_temporary = false. Without this the cached
    // value would still send them back here on next protected route.
    window.location.assign("/admin");
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  return (
    <AuthShell
      title="Set your password"
      subtitle="Choose a password you'll use to sign in next time."
    >
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
    </AuthShell>
  );
}
