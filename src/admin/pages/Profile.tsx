import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AtSign,
  Bell,
  BellOff,
  Camera,
  Check,
  ChefHat,
  Coffee,
  ImageOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMyProfile } from "../useMyProfile";
import { useAdminOrderPulse } from "../useAdminOrderPulse";
import type { StaffRole } from "../useAdminStaff";

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

const ROLE_PILL: Record<StaffRole, string> = {
  admin: "bg-foreground text-background",
  kitchen: "bg-info text-white",
  waiter: "bg-warning text-foreground",
};

export default function ProfilePage() {
  const { user, role, displayName, avatarUrl, refreshStaff } = useAuth();
  const profile = useMyProfile(user?.id ?? null);

  // Live local copy of the avatar URL so the preview flashes the new
  // file immediately on upload, before refreshStaff completes its
  // round-trip to repaint the sidebar.
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(
    avatarUrl
  );
  useEffect(() => {
    setLocalAvatarUrl(avatarUrl);
  }, [avatarUrl]);

  const initial =
    (displayName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  const visibleName =
    displayName?.trim() || user?.email?.split("@")[0] || "Staff";

  const isSyntheticEmail = (user?.email ?? "").endsWith("@servio.local");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Your profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customise how your name and photo appear across the app, and
          change your password.
        </p>
      </header>

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {localAvatarUrl ? (
            <img
              src={localAvatarUrl}
              alt={visibleName}
              className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <span
              className={cn(
                "flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold",
                role ? ROLE_PILL[role] : "bg-foreground text-background"
              )}
            >
              {initial}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold leading-tight">
              {visibleName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {role && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    ROLE_PILL[role]
                  )}
                >
                  {(() => {
                    const Icon = ROLE_ICON[role];
                    return <Icon className="h-3 w-3" strokeWidth={2.4} />;
                  })()}
                  {ROLE_LABEL[role]}
                </span>
              )}
              {!isSyntheticEmail && user?.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" strokeWidth={2.2} />
                  {user.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <AvatarSection
        currentAvatarUrl={localAvatarUrl}
        pending={profile.pending === "avatar"}
        onUpload={async (file) => {
          const url = await profile.uploadAvatar(file);
          setLocalAvatarUrl(url);
          // Re-pull the staff row so AuthProvider's cached avatarUrl
          // (and the sidebar that reads from it) updates without waiting
          // for next sign-in.
          await refreshStaff();
          toast.success("Avatar updated");
        }}
        onRemove={async () => {
          await profile.removeAvatar();
          setLocalAvatarUrl(null);
          await refreshStaff();
          toast.success("Avatar removed");
        }}
      />

      <NameSection
        currentName={displayName ?? ""}
        pending={profile.pending === "name"}
        onSave={async (name) => {
          await profile.saveDisplayName(name);
          await refreshStaff();
          toast.success("Name saved");
        }}
      />

      <PasswordSection
        pending={profile.pending === "password"}
        onSave={async (newPassword) => {
          const result = await profile.changePassword(newPassword);
          if (result.ok) {
            // Pulls the cleared password_temporary flag forward so a
            // forced-flow user changing password from here doesn't
            // get redirected back to /admin/reset-password.
            await refreshStaff();
          }
          return result;
        }}
      />

      <NotificationsSection />
    </div>
  );
}

function NotificationsSection() {
  const { soundEnabled, toggleSound } = useAdminOrderPulse();
  return (
    <SectionCard
      title="Notifications"
      subtitle="Personal preferences for this device. Other staff keep their own settings."
    >
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              soundEnabled
                ? "bg-success/15 text-success"
                : "bg-muted text-foreground/60"
            )}
          >
            {soundEnabled ? (
              <Bell className="h-4 w-4" strokeWidth={2.2} />
            ) : (
              <BellOff className="h-4 w-4" strokeWidth={2.2} />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">
              New-order chime
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Plays a soft tone whenever a new order lands while you&apos;re
              signed in. Saved to this device only.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={soundEnabled}
          aria-label="New-order chime"
          onClick={toggleSound}
          className={cn(
            "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2",
            soundEnabled ? "bg-success" : "bg-muted-foreground/30"
          )}
        >
          <span
            className={cn(
              "h-5 w-5 rounded-full bg-white transition-transform",
              soundEnabled ? "translate-x-5" : "translate-x-0"
            )}
            aria-hidden
          />
        </button>
      </div>
    </SectionCard>
  );
}

function AvatarSection({
  currentAvatarUrl,
  pending,
  onUpload,
  onRemove,
}: {
  currentAvatarUrl: string | null;
  pending: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload");
      setPreviewUrl(null);
    } finally {
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleRemove = async () => {
    setError(null);
    try {
      await onRemove();
      setPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove avatar");
    }
  };

  const visible = previewUrl ?? currentAvatarUrl;

  return (
    <SectionCard title="Avatar" subtitle="PNG, JPEG, or WebP. Max 2 MB.">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-bold text-foreground/70",
            pending && "animate-pulse"
          )}
        >
          {visible ? (
            <img
              src={visible}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Camera
              className="h-5 w-5 text-muted-foreground"
              strokeWidth={2.2}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            <Camera className="h-3.5 w-3.5" strokeWidth={2.4} />
            {currentAvatarUrl ? "Replace" : "Upload"}
          </button>
          {currentAvatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-50"
            >
              <ImageOff className="h-3.5 w-3.5" strokeWidth={2.4} />
              Remove
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {error && <ErrorPill message={error} />}
    </SectionCard>
  );
}

function NameSection({
  currentName,
  pending,
  onSave,
}: {
  currentName: string;
  pending: boolean;
  onSave: (name: string | null) => Promise<void>;
}) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  const trimmed = name.trim();
  const dirty = trimmed !== currentName.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty || pending) return;
    setError(null);
    try {
      await onSave(trimmed.length > 0 ? trimmed : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save name");
    }
  };

  return (
    <SectionCard
      title="Display name"
      subtitle="Shown in the sidebar, on order tickets, and across the admin app."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <AtSign
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2.2}
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Your name"
            className="h-11 rounded-xl pl-9"
          />
        </div>

        {error && <ErrorPill message={error} />}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!dirty || pending}
            className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

function PasswordSection({
  pending,
  onSave,
}: {
  pending: boolean;
  onSave: (
    newPassword: string
  ) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const minLength = 8;
  const passwordValid = password.length >= minLength;
  const passwordsMatch = password === confirm;
  const canSubmit = passwordValid && passwordsMatch && !pending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSuccess(false);
    const result = await onSave(password);
    if (!result.ok) {
      setError(result.message ?? "Couldn't change password");
      return;
    }
    setPassword("");
    setConfirm("");
    setSuccess(true);
    toast.success("Password changed");
    // Hide the success pill after a moment so it doesn't linger
    window.setTimeout(() => setSuccess(false), 2400);
  };

  return (
    <SectionCard
      title="Change password"
      subtitle="At least 8 characters. You'll stay signed in on this device."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="profile-password"
            className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            New password
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={2.2}
            />
            <Input
              id="profile-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl pl-9"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="profile-confirm"
            className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Confirm
          </label>
          <div className="relative">
            <KeyRound
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={2.2}
            />
            <Input
              id="profile-confirm"
              type="password"
              autoComplete="new-password"
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

        {error && <ErrorPill message={error} />}
        {success && (
          <div className="flex items-start gap-2 rounded-2xl border border-success/40 bg-success/10 p-3 text-xs text-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.6} />
            <p>Password updated.</p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {pending ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ErrorPill({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
