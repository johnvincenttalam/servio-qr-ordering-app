import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  AtSign,
  ChefHat,
  Coffee,
  Mail,
  ShieldCheck,
  Type,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CreateStaffParams, StaffRole } from "../useAdminStaff";

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  kitchen: "Kitchen",
  waiter: "Waiter",
};

const ROLE_ICON: Record<StaffRole, LucideIcon> = {
  admin: ShieldCheck,
  kitchen: ChefHat,
  waiter: Coffee,
};

const USERNAME_RE = /^[a-z0-9._]{3,30}$/;

interface StaffCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    params: CreateStaffParams
  ) => Promise<{ ok: boolean; message?: string; password?: string; email?: string; username?: string | null }>;
  /**
   * Called when create succeeds. The parent uses this to flip into the
   * password-reveal modal so the admin can read it once.
   */
  onCreated: (info: {
    password: string;
    email?: string;
    username?: string | null;
  }) => void;
}

export function StaffCreateDialog({
  open,
  onClose,
  onSubmit,
  onCreated,
}: StaffCreateDialogProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<StaffRole>("kitchen");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens or closes
  useEffect(() => {
    if (!open) {
      setEmail("");
      setUsername("");
      setDisplayName("");
      setRole("kitchen");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedUsername = username.trim().toLowerCase();
  const usernameValid =
    !trimmedUsername || USERNAME_RE.test(trimmedUsername);
  const hasIdentifier = !!trimmedEmail || !!trimmedUsername;
  const canSubmit = hasIdentifier && usernameValid && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const result = await onSubmit({
      email: trimmedEmail || undefined,
      username: trimmedUsername || undefined,
      role,
      displayName: displayName.trim() || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.message ?? "Couldn't create the account");
      return;
    }
    if (result.password) {
      onCreated({
        password: result.password,
        email: result.email,
        username: result.username,
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!submitting}
        className="w-[calc(100%-2rem)] gap-0 rounded-3xl p-0 sm:w-full sm:max-w-md"
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Create
          </DialogDescription>
          <DialogTitle className="text-xl font-bold leading-tight">
            New staff account
          </DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            We&apos;ll generate a temporary password — share it with the
            staff member directly. They&apos;ll change it on first login.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Username{" "}
              <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
                login alias
              </span>
            </label>
            <div className="relative">
              <AtSign
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2.2}
              />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="maria"
                maxLength={30}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                className="h-11 rounded-xl pl-9 lowercase"
                autoFocus
              />
            </div>
            {trimmedUsername && !usernameValid && (
              <p className="text-[11px] text-destructive">
                3–30 chars, lowercase letters / digits / dot / underscore.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email{" "}
              <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
                optional but recommended
              </span>
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2.2}
              />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@example.com"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                className="h-11 rounded-xl pl-9"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Used for password recovery later. Skip if the staff member
              doesn&apos;t have one — the username is enough to sign in.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Display name{" "}
              <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
                optional
              </span>
            </label>
            <div className="relative">
              <Type
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2.2}
              />
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Maria Santos"
                maxLength={60}
                className="h-11 rounded-xl pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["admin", "kitchen", "waiter"] as StaffRole[]).map((r) => {
                const Icon = ROLE_ICON[r];
                const isActive = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition-all active:scale-95",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground/70 hover:border-foreground/40 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.4} />
                    {ROLE_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </form>

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {submitting ? "Creating…" : "Create account"}
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
