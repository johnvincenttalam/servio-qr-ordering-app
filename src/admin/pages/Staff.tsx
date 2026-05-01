import { useEffect, useState } from "react";
import {
  AlertCircle,
  AtSign,
  ChefHat,
  Coffee,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
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
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/utils";
import {
  useAdminStaff,
  type StaffMember,
  type StaffRole,
} from "../useAdminStaff";
import { ConfirmFooterRow } from "../components/ConfirmFooterRow";
import { StaffEditor } from "./StaffEditor";
import { StaffCreateDialog } from "./StaffCreateDialog";
import { StaffPasswordReveal } from "./StaffPasswordReveal";

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

interface RevealState {
  context:
    | { kind: "created"; email?: string; username?: string | null }
    | { kind: "reset"; identifier: string };
  password: string;
}

export default function StaffPage() {
  const { user } = useAuth();
  const {
    members,
    isLoading,
    error,
    createStaff,
    resetPassword,
    setRole,
    setDisplayName,
    setAvatar,
    removeAvatar,
    remove,
  } = useAdminStaff();
  const [now, setNow] = useState(() => Date.now());
  const [createOpen, setCreateOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<StaffMember | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null);
  const [reveal, setReveal] = useState<RevealState | null>(null);

  // Resolve targets from the live members list so the modals reflect
  // realtime updates (e.g. another admin renames the row mid-edit).
  const editTarget = editTargetId
    ? members.find((m) => m.userId === editTargetId) ?? null
    : null;

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
            {members.length} member{members.length === 1 ? "" : "s"} · create
            accounts and manage roles
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          New staff
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
        <Empty onCreate={() => setCreateOpen(true)} />
      ) : (
        <StaffTable
          members={members}
          currentUserId={user?.id ?? null}
          now={now}
          onChangeRole={setRole}
          onEdit={(m) => setEditTargetId(m.userId)}
          onResetPassword={(m) => setResetTarget(m)}
          onRemove={(m) => setRemoveTarget(m)}
        />
      )}

      <StaffCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createStaff}
        onCreated={(info) => {
          setCreateOpen(false);
          setReveal({
            context: {
              kind: "created",
              email: info.email,
              username: info.username,
            },
            password: info.password,
          });
        }}
      />

      <ResetPasswordDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={async (m) => {
          const result = await resetPassword(m.userId);
          if (result.ok && result.password) {
            setResetTarget(null);
            setReveal({
              context: {
                kind: "reset",
                identifier:
                  m.username ??
                  m.displayName ??
                  m.email,
              },
              password: result.password,
            });
          }
          return result;
        }}
      />

      <RemoveDialog
        target={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async (m) => {
          await remove(m.userId);
          setRemoveTarget(null);
        }}
      />

      <StaffEditor
        open={editTarget !== null}
        member={editTarget}
        onClose={() => setEditTargetId(null)}
        onSaveName={setDisplayName}
        onUploadAvatar={setAvatar}
        onRemoveAvatar={removeAvatar}
      />

      <StaffPasswordReveal
        open={reveal !== null}
        onClose={() => setReveal(null)}
        context={reveal?.context ?? null}
        password={reveal?.password ?? null}
      />
    </div>
  );
}

function StaffTable({
  members,
  currentUserId,
  now,
  onChangeRole,
  onEdit,
  onResetPassword,
  onRemove,
}: {
  members: StaffMember[];
  currentUserId: string | null;
  now: number;
  onChangeRole: (id: string, role: StaffRole) => void;
  onEdit: (m: StaffMember) => void;
  onResetPassword: (m: StaffMember) => void;
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
            <th className="px-4 py-2.5 w-[140px]" />
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
              onEdit={onEdit}
              onResetPassword={onResetPassword}
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
  onEdit,
  onResetPassword,
  onRemove,
}: {
  member: StaffMember;
  isSelf: boolean;
  now: number;
  onChangeRole: (id: string, role: StaffRole) => void;
  onEdit: (m: StaffMember) => void;
  onResetPassword: (m: StaffMember) => void;
  onRemove: (m: StaffMember) => void;
}) {
  const Icon = ROLE_ICON[member.role];
  const initial =
    (member.displayName?.[0] ?? member.email[0] ?? "?").toUpperCase();
  const visibleName =
    member.displayName?.trim() ||
    member.username ||
    member.email.split("@")[0];

  // Hide synthetic "@servio.local" emails (assigned when admin only
  // created a username) — surfacing them is just visual noise.
  const isSyntheticEmail = member.email.endsWith("@servio.local");

  return (
    <tr className="group border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={visibleName}
              className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                ROLE_PILL[member.role]
              )}
            >
              {initial}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate font-semibold leading-tight">
              <span
                className={cn(
                  "truncate",
                  !member.displayName && "text-foreground/70"
                )}
              >
                {visibleName}
              </span>
              {isSelf && (
                <span className="rounded-full bg-muted px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  you
                </span>
              )}
              {member.passwordTemporary && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider text-foreground"
                  title="Must change password on next sign-in"
                >
                  <KeyRound className="h-2.5 w-2.5" strokeWidth={2.6} />
                  temp
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {member.username && (
                <span className="inline-flex items-center gap-1">
                  <AtSign className="h-3 w-3 shrink-0" strokeWidth={2.2} />
                  {member.username}
                </span>
              )}
              {!isSyntheticEmail && (
                <span className="inline-flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3 shrink-0" strokeWidth={2.2} />
                  {member.email}
                </span>
              )}
            </div>
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
            onChange={(e) =>
              onChangeRole(member.userId, e.target.value as StaffRole)
            }
            aria-label={`Change role for ${visibleName}`}
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
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onResetPassword(member)}
            aria-label={`Reset password for ${visibleName}`}
            title="Reset password"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted hover:text-foreground active:scale-95"
          >
            <KeyRound className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(member)}
            aria-label={`Edit ${visibleName}`}
            title="Edit staff"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted hover:text-foreground active:scale-95"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(member)}
            aria-label={`Remove ${visibleName}`}
            title="Remove staff"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ResetPasswordDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: StaffMember | null;
  onClose: () => void;
  onConfirm: (
    m: StaffMember
  ) => Promise<{ ok: boolean; message?: string; password?: string }>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setError(null);
      setPending(false);
    }
  }, [target]);

  const handle = async () => {
    if (!target || pending) return;
    setPending(true);
    setError(null);
    const result = await onConfirm(target);
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? "Reset failed");
    }
    // Success path closes the dialog from the parent; no work here.
  };

  const identifier =
    target?.username ?? target?.displayName ?? target?.email ?? "—";

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
            Reset password
          </DialogDescription>
          <DialogTitle className="text-xl font-bold leading-tight">
            Issue a new password
          </DialogTitle>
        </DialogHeader>

        {target && (
          <div className="space-y-3 px-5 py-4 text-sm">
            <p className="text-foreground">
              We&apos;ll generate a new temporary password for{" "}
              <span className="font-semibold">{identifier}</span> and
              show it to you once. Their current password will stop
              working immediately.
            </p>
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>
        )}

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          {target ? (
            <ConfirmFooterRow
              question={
                <>
                  Reset password for{" "}
                  <span className="font-bold">{identifier}</span>?
                </>
              }
              cancelLabel="Cancel"
              confirmLabel="Reset"
              pendingLabel="Resetting…"
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

  const identifier =
    target?.username ?? target?.displayName ?? target?.email ?? "—";

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
              <span className="font-semibold">{identifier}</span> will lose
              access to the admin app immediately. Their auth account stays so
              you can re-create access later if needed.
            </p>
          </div>
        )}

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          {target ? (
            <ConfirmFooterRow
              question={
                <>
                  Remove <span className="font-bold">{identifier}</span>?
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

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">No staff yet.</p>
      <button
        type="button"
        onClick={onCreate}
        className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
      >
        Create the first
      </button>
    </div>
  );
}
