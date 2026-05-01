import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
  ChefHat,
  Coffee,
  Trash2,
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
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/utils";
import {
  useAdminStaff,
  type StaffMember,
  type StaffRole,
} from "../useAdminStaff";
import { ConfirmFooterRow } from "../components/ConfirmFooterRow";

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

export default function StaffPage() {
  const { user } = useAuth();
  const {
    members,
    isLoading,
    error,
    invite,
    setRole,
    setDisplayName,
    remove,
  } = useAdminStaff();
  const [now, setNow] = useState(() => Date.now());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<StaffMember | null>(null);

  // Tick "last seen" labels every 30s
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Staff
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Staff manager
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} member{members.length === 1 ? "" : "s"} · invite
            new staff or change roles
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Invite staff
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : members.length === 0 ? (
        <Empty onInvite={() => setInviteOpen(true)} />
      ) : (
        <StaffTable
          members={members}
          currentUserId={user?.id ?? null}
          now={now}
          onChangeRole={setRole}
          onChangeName={setDisplayName}
          onRemove={(m) => setRemoveTarget(m)}
        />
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={invite}
      />

      <RemoveDialog
        target={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async (m) => {
          await remove(m.userId);
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}

function StaffTable({
  members,
  currentUserId,
  now,
  onChangeRole,
  onChangeName,
  onRemove,
}: {
  members: StaffMember[];
  currentUserId: string | null;
  now: number;
  onChangeRole: (id: string, role: StaffRole) => void;
  onChangeName: (id: string, name: string | null) => void;
  onRemove: (m: StaffMember) => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5">Member</th>
            <th className="px-4 py-2.5 w-[140px]">Role</th>
            <th className="px-4 py-2.5 w-[140px]">Last seen</th>
            <th className="px-4 py-2.5 w-[60px]" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <StaffRow
              key={m.userId}
              member={m}
              isSelf={m.userId === currentUserId}
              now={now}
              onChangeRole={onChangeRole}
              onChangeName={onChangeName}
              onRemove={onRemove}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffRow({
  member,
  isSelf,
  now,
  onChangeRole,
  onChangeName,
  onRemove,
}: {
  member: StaffMember;
  isSelf: boolean;
  now: number;
  onChangeRole: (id: string, role: StaffRole) => void;
  onChangeName: (id: string, name: string | null) => void;
  onRemove: (m: StaffMember) => void;
}) {
  const Icon = ROLE_ICON[member.role];
  const initial =
    (member.displayName?.[0] ?? member.email[0] ?? "?").toUpperCase();

  return (
    <tr className="group border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              ROLE_PILL[member.role]
            )}
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <NameField
              displayName={member.displayName}
              fallback={member.email.split("@")[0]}
              isSelf={isSelf}
              onSave={(value) => onChangeName(member.userId, value)}
            />
            <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" strokeWidth={2.2} />
              {member.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <label className="relative inline-flex items-center">
          <span
            className={cn(
              "pointer-events-none inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
              ROLE_PILL[member.role]
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={2.4} />
            {ROLE_LABEL[member.role]}
          </span>
          <select
            value={member.role}
            onChange={(e) => onChangeRole(member.userId, e.target.value as StaffRole)}
            aria-label={`Change role for ${member.email}`}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="admin">Admin</option>
            <option value="kitchen">Kitchen</option>
            <option value="waiter">Waiter</option>
          </select>
        </label>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {member.lastSignInAt
          ? formatRelative(member.lastSignInAt, now)
          : "Never"}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onRemove(member)}
          aria-label={`Remove ${member.email}`}
          title="Remove staff"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:scale-95"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </td>
    </tr>
  );
}

function NameField({
  displayName,
  fallback,
  isSelf,
  onSave,
}: {
  displayName: string | null;
  fallback: string;
  isSelf: boolean;
  onSave: (value: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the draft in sync if the row updates while we're not editing
  // (e.g. another admin renamed this person via realtime).
  useEffect(() => {
    if (!editing) setDraft(displayName ?? "");
  }, [displayName, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    const next = trimmed.length > 0 ? trimmed : null;
    if (next !== (displayName ?? null)) {
      onSave(next);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(displayName ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        maxLength={60}
        placeholder={fallback}
        aria-label="Display name"
        className="w-full rounded-md border border-foreground/30 bg-background px-1.5 py-0.5 text-sm font-semibold leading-tight focus:border-foreground focus:outline-none"
      />
    );
  }

  const visible = displayName?.trim() || fallback;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Edit name"
      className="group/name flex items-center gap-1.5 rounded-md text-left -mx-1 px-1 py-0.5 hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30"
    >
      <span
        className={cn(
          "truncate font-semibold leading-tight",
          !displayName && "text-foreground/70"
        )}
      >
        {visible}
      </span>
      {isSelf && (
        <span className="rounded-full bg-muted px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          you
        </span>
      )}
      <Pencil
        className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100"
        strokeWidth={2.2}
        aria-hidden
      />
    </button>
  );
}

function InviteDialog({
  open,
  onClose,
  onInvite,
}: {
  open: boolean;
  onClose: () => void;
  onInvite: (params: {
    email: string;
    role: StaffRole;
    displayName?: string;
  }) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("kitchen");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("kitchen");
      setDisplayName("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await onInvite({
      email,
      role,
      displayName: displayName.trim() || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      toast.success(`Invite sent to ${email}`);
      onClose();
    } else {
      setError(result.message ?? "Invite failed");
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
            Invite
          </DialogDescription>
          <DialogTitle className="text-xl font-bold leading-tight">
            New staff member
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoFocus
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Display name{" "}
              <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
                optional
              </span>
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Maria"
              className="h-11 rounded-xl"
            />
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
              disabled={submitting || !email}
              className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {submitting ? "Sending…" : "Send invite"}
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: StaffMember | null;
  onClose: () => void;
  onConfirm: (m: StaffMember) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  const handle = async () => {
    if (!target || pending) return;
    setPending(true);
    try {
      await onConfirm(target);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o && !pending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!pending}
        className="w-[calc(100%-2rem)] gap-0 rounded-3xl p-0 sm:w-full sm:max-w-md"
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Remove
          </DialogDescription>
          <DialogTitle className="text-xl font-bold leading-tight">
            Revoke staff access
          </DialogTitle>
        </DialogHeader>

        {target && (
          <div className="px-5 py-4 text-sm">
            <p className="text-foreground">
              <span className="font-semibold">{target.email}</span> will lose
              access to the admin app immediately. Their auth account stays so
              you can re-invite them later.
            </p>
          </div>
        )}

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          {target ? (
            <ConfirmFooterRow
              question={
                <>
                  Remove{" "}
                  <span className="font-bold">{target.email}</span>?
                </>
              }
              cancelLabel="Keep"
              confirmLabel="Remove"
              pendingLabel="Removing…"
              pending={pending}
              onCancel={onClose}
              onConfirm={handle}
            />
          ) : null}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
        >
          <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
          <div className="h-6 w-20 rounded-full bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-8 w-8 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

function Empty({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">No staff yet.</p>
      <button
        type="button"
        onClick={onInvite}
        className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
      >
        Invite the first
      </button>
    </div>
  );
}
