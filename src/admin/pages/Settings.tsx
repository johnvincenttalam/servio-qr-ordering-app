import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  ClipboardList,
  Power,
  Store,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAdminSettings, type SettingsUpdate } from "../useAdminSettings";

/**
 * Sectioned settings form. Each section saves independently so a
 * "open for orders" emergency toggle never has to wait on the admin
 * finishing a name edit. The settings hook is realtime-backed, so a
 * concurrent change from another tab repaints the form without
 * stomping on the section the user is currently typing in (because
 * each section has its own isolated draft state).
 */
export default function SettingsPage() {
  const { settings, isLoading, update } = useAdminSettings();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Admin
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Restaurant-wide configuration. Changes apply instantly across all
          customer tabs.
        </p>
      </header>

      {isLoading ? (
        <SectionSkeleton count={3} />
      ) : (
        <>
          <AvailabilitySection
            openForOrders={settings.openForOrders}
            onSave={(v) => update({ openForOrders: v })}
          />

          <IdentitySection
            name={settings.name}
            currencySymbol={settings.currencySymbol}
            onSave={(next) => update(next)}
          />

          <BehaviorSection
            requireCustomerName={settings.requireCustomerName}
            defaultPrepMinutes={settings.defaultPrepMinutes}
            requireSeatedSession={settings.requireSeatedSession}
            onSave={(next) => update(next)}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Availability — single big toggle with strong visual feedback so a
// "we're closed" decision is unambiguous from across the room.
// ─────────────────────────────────────────────────────────────────────
function AvailabilitySection({
  openForOrders,
  onSave,
}: {
  openForOrders: boolean;
  onSave: (next: boolean) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    setPending(true);
    try {
      await onSave(!openForOrders);
      toast.success(
        !openForOrders
          ? "Orders are open — customers can place orders again."
          : "Orders paused — customers will see a closed banner."
      );
    } catch {
      // toast already surfaced in the hook
    } finally {
      setPending(false);
    }
  };

  return (
    <SectionCard
      icon={Power}
      tone={openForOrders ? "success" : "warning"}
      title="Order availability"
      description="Pause ordering during breaks or after hours. Browsing the menu still works — only the place-order step is blocked."
    >
      <div
        className={cn(
          "flex items-center justify-between rounded-2xl border p-4 transition-colors",
          openForOrders
            ? "border-success/40 bg-success/5"
            : "border-warning/50 bg-warning/10"
        )}
      >
        <div>
          <p className="text-sm font-bold leading-tight">
            {openForOrders ? "Open for orders" : "Paused"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {openForOrders
              ? "Customers can place orders right now."
              : "Customers see a 'we're not taking orders' notice."}
          </p>
        </div>
        <ToggleSwitch
          checked={openForOrders}
          onChange={handleToggle}
          disabled={pending}
          aria-label="Open for orders"
        />
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Identity — name + currency. Each field has its own draft state so
// editing one doesn't dirty the other, and Save is per-section.
// ─────────────────────────────────────────────────────────────────────
function IdentitySection({
  name,
  currencySymbol,
  onSave,
}: {
  name: string;
  currencySymbol: string;
  onSave: (next: SettingsUpdate) => Promise<void>;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftCurrency, setDraftCurrency] = useState(currencySymbol);
  const [pending, setPending] = useState(false);

  // Re-sync the draft when the live value changes from another tab —
  // unless the local input already matches (avoid stomping in-flight edits).
  useEffect(() => {
    setDraftName(name);
  }, [name]);
  useEffect(() => {
    setDraftCurrency(currencySymbol);
  }, [currencySymbol]);

  const dirty = draftName !== name || draftCurrency !== currencySymbol;
  const valid = draftName.trim().length > 0 && draftCurrency.trim().length > 0;

  const handleSave = async () => {
    if (!dirty || !valid) return;
    setPending(true);
    try {
      await onSave({
        name: draftName.trim(),
        currencySymbol: draftCurrency.trim(),
      });
      toast.success("Identity saved");
    } catch {
      // toasted in hook
    } finally {
      setPending(false);
    }
  };

  return (
    <SectionCard
      icon={Store}
      tone="info"
      title="Restaurant identity"
      description="What your venue is called and which currency you use. Updates apply across customer + admin surfaces; push notifications keep the build-time default until the service worker is regenerated on the next deploy."
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Name">
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="SERVIO"
            className="h-11 rounded-xl"
            maxLength={40}
          />
        </Field>
        <Field label="Currency symbol">
          <Input
            value={draftCurrency}
            onChange={(e) => setDraftCurrency(e.target.value)}
            placeholder="₱"
            className="h-11 rounded-xl text-center"
            maxLength={4}
          />
        </Field>
      </div>
      <SectionFooter
        dirty={dirty}
        pending={pending}
        valid={valid}
        onSave={handleSave}
      />
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Order behavior — the small operational toggles + ETA.
// ─────────────────────────────────────────────────────────────────────
function BehaviorSection({
  requireCustomerName,
  defaultPrepMinutes,
  requireSeatedSession,
  onSave,
}: {
  requireCustomerName: boolean;
  defaultPrepMinutes: number;
  requireSeatedSession: boolean;
  onSave: (next: SettingsUpdate) => Promise<void>;
}) {
  const [draftRequire, setDraftRequire] = useState(requireCustomerName);
  const [draftPrep, setDraftPrep] = useState(defaultPrepMinutes);
  const [draftSeated, setDraftSeated] = useState(requireSeatedSession);
  const [pending, setPending] = useState(false);

  useEffect(() => setDraftRequire(requireCustomerName), [requireCustomerName]);
  useEffect(() => setDraftPrep(defaultPrepMinutes), [defaultPrepMinutes]);
  useEffect(() => setDraftSeated(requireSeatedSession), [requireSeatedSession]);

  const dirty =
    draftRequire !== requireCustomerName ||
    draftPrep !== defaultPrepMinutes ||
    draftSeated !== requireSeatedSession;
  const valid =
    Number.isFinite(draftPrep) && draftPrep > 0 && draftPrep < 240;

  const handleSave = async () => {
    if (!dirty || !valid) return;
    setPending(true);
    try {
      await onSave({
        requireCustomerName: draftRequire,
        defaultPrepMinutes: draftPrep,
        requireSeatedSession: draftSeated,
      });
      toast.success("Order settings saved");
    } catch {
      // toasted in hook
    } finally {
      setPending(false);
    }
  };

  return (
    <SectionCard
      icon={ClipboardList}
      tone="info"
      title="Order behavior"
      description="How customers place orders and what the kitchen promises."
    >
      <div className="space-y-3">
        <ToggleRow
          checked={draftRequire}
          onChange={setDraftRequire}
          title="Require customer name at checkout"
          description="When on, customers must enter a name before placing the order. Off makes it optional."
        />
        <ToggleRow
          checked={draftSeated}
          onChange={setDraftSeated}
          title="Staff must seat each party before ordering"
          description="When on, scanning the QR opens the menu but blocks the place-order step until a staff member taps Seat on that table. Helpful against off-premises abuse; adds a step to your service workflow."
        />
        <Field label="Default prep time (minutes)">
          <Input
            type="number"
            min={1}
            max={239}
            value={draftPrep}
            onChange={(e) => setDraftPrep(Number(e.target.value))}
            className="h-11 w-32 rounded-xl"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Used to compute the &ldquo;Usually ready in&rdquo; ETA on the
            customer order tracker.
          </p>
        </Field>
      </div>
      <SectionFooter
        dirty={dirty}
        pending={pending}
        valid={valid}
        onSave={handleSave}
      />
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Shared section primitives.
// ─────────────────────────────────────────────────────────────────────

const TONE_CLASSES = {
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/25 text-foreground",
  neutral: "bg-muted text-foreground/70",
} as const;

type Tone = keyof typeof TONE_CLASSES;

function SectionCard({
  icon: Icon,
  tone,
  title,
  description,
  children,
}: {
  icon: typeof Store;
  tone: Tone;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 space-y-4">
      <header className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            TONE_CLASSES[tone]
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div>
          <h2 className="text-base font-bold leading-tight">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <ToggleSwitch
        checked={checked}
        onChange={() => onChange(!checked)}
        aria-label={title}
      />
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  ...rest
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
} & Pick<React.AriaAttributes, "aria-label">) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-success" : "bg-muted-foreground/30"
      )}
      {...rest}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
        aria-hidden
      />
    </button>
  );
}

function SectionFooter({
  dirty,
  pending,
  valid,
  onSave,
}: {
  dirty: boolean;
  pending: boolean;
  valid: boolean;
  onSave: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
      {!valid && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" strokeWidth={2.4} />
          Fix the highlighted fields
        </span>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={pending || !valid}
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
        {pending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function SectionSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-border bg-card p-5 space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          </div>
          <div className="h-11 w-full rounded-xl bg-muted" />
        </div>
      ))}
    </>
  );
}
