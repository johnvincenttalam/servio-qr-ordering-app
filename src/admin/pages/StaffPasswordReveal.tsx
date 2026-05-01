import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StaffPasswordRevealProps {
  open: boolean;
  onClose: () => void;
  /**
   * What this password is for, displayed at the top so the admin
   * doesn't lose track when handling several accounts back-to-back.
   */
  context:
    | { kind: "created"; email?: string; username?: string | null }
    | { kind: "reset"; identifier: string }
    | null;
  password: string | null;
}

export function StaffPasswordReveal({
  open,
  onClose,
  context,
  password,
}: StaffPasswordRevealProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setRevealed(false);
      setCopied(false);
      setAcknowledged(false);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    }
  }, [open]);

  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(
        () => setCopied(false),
        1800
      );
    } catch {
      toast.error("Couldn't copy — select the password and copy manually.");
    }
  };

  const identifierLine = (() => {
    if (!context) return "";
    if (context.kind === "created") {
      const username = context.username;
      const email = context.email;
      if (username && email && !email.endsWith("@servio.local"))
        return `${username} · ${email}`;
      return username ?? email ?? "—";
    }
    return context.identifier;
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] gap-0 rounded-3xl p-0 sm:w-full sm:max-w-md"
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {context?.kind === "created" ? "Account ready" : "Password reset"}
          </DialogDescription>
          <DialogTitle className="text-xl font-bold leading-tight">
            One-time password
          </DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            For{" "}
            <span className="font-semibold text-foreground">
              {identifierLine}
            </span>
            . They&apos;ll be required to change it on first sign-in.
          </p>
        </DialogHeader>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 p-3">
            <KeyRound
              className="h-4 w-4 shrink-0 text-foreground/70"
              strokeWidth={2.2}
            />
            <code className="min-w-0 flex-1 truncate font-mono text-sm font-semibold tracking-wider">
              {password
                ? revealed
                  ? password
                  : "•".repeat(password.length)
                : "—"}
            </code>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide password" : "Show password"}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
            >
              {revealed ? (
                <EyeOff className="h-4 w-4" strokeWidth={2.2} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={2.2} />
              )}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!password}
              aria-label="Copy password"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" strokeWidth={2.4} />
              ) : (
                <Copy className="h-4 w-4" strokeWidth={2.2} />
              )}
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/15 p-3 text-xs text-foreground">
            <AlertCircle
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              strokeWidth={2.4}
            />
            <p>
              This is the only time you&apos;ll see it. Hand it off
              securely (verbal, encrypted message, paper note) — once you
              close this dialog, neither you nor we can recover it. Use{" "}
              <span className="font-semibold">Reset password</span> on
              the row to issue a new one.
            </p>
          </div>

          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-foreground"
            />
            <span>I&apos;ve given this password to the staff member.</span>
          </label>
        </div>

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={!acknowledged}
              className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              Done
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
