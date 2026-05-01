import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertCircle, Check, Mail, Utensils } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/admin/reset-password`
        : undefined;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo }
    );

    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
            <Utensils className="h-6 w-6" strokeWidth={2.4} />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your staff email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="rounded-3xl border border-success/40 bg-success/10 p-5 text-center">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success text-white">
              <Check className="h-5 w-5" strokeWidth={2.6} />
            </span>
            <h2 className="text-base font-bold">Check your inbox</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              We sent a reset link to{" "}
              <span className="font-semibold text-foreground">{email}</span>.
              The link expires in an hour.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-3xl border border-border bg-card p-5"
          >
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold">
                Email
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2.2}
                />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl pl-9"
                  placeholder="staff@example.com"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !email}
              className="w-full rounded-full bg-foreground py-3 text-sm font-semibold text-background transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link
          to="/admin/login"
          className="mt-6 inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={2.4} />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
