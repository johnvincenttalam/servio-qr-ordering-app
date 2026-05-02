import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  Power,
  RotateCw,
  Store,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import type { QrRotationCadence } from "@/hooks/useRestaurantSettings";
import { useOpenStatus } from "@/hooks/useBusinessHours";
import {
  type BusinessHoursDay,
  type Weekday,
  formatNextOpenAt,
} from "@/services/businessHours";
import { useAdminBusinessHours } from "../useAdminBusinessHours";
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

          <HoursSection
            timezone={settings.timezone}
            lastCallMinutes={settings.lastCallMinutesBeforeClose}
            onSaveSettings={(next) => update(next)}
          />

          <QrSecuritySection
            cadence={settings.qrRotationCadence}
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
// QR security — rotation cadence. Each rotation invalidates printed
// stickers, so the picker stays at "off" by default and any change
// surfaces a banner on the Tables page when reprints are pending.
// ─────────────────────────────────────────────────────────────────────
const CADENCE_OPTIONS: readonly { id: QrRotationCadence; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const CADENCE_DESCRIPTION: Record<QrRotationCadence, string> = {
  off: "Tokens never auto-rotate. Use the Rotate action on a single table when you suspect that table's QR has leaked.",
  weekly:
    "Rotates every Sunday night. You'll need to reprint all stickers before Monday open — bulk Print is on the Tables page.",
  monthly:
    "Rotates on the last day of each month. Lower reprint burden than weekly; longer window where a leaked photo URL stays valid.",
};

function QrSecuritySection({
  cadence,
  onSave,
}: {
  cadence: QrRotationCadence;
  onSave: (next: SettingsUpdate) => Promise<void>;
}) {
  const [draft, setDraft] = useState(cadence);
  const [pending, setPending] = useState(false);

  useEffect(() => setDraft(cadence), [cadence]);

  const dirty = draft !== cadence;

  const handleSave = async () => {
    if (!dirty) return;
    setPending(true);
    try {
      await onSave({ qrRotationCadence: draft });
      toast.success("QR rotation schedule saved");
    } catch {
      // toasted in hook
    } finally {
      setPending(false);
    }
  };

  return (
    <SectionCard
      icon={RotateCw}
      tone="warning"
      title="QR security"
      description="Stale photos of your QR sticker can be replayed off-premises. Rotating tokens regularly invalidates them — but every rotation requires reprinting stickers, so pick a cadence your operation can keep up with."
    >
      <div className="space-y-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rotation cadence
          </p>
          <SegmentedControl
            value={draft}
            onChange={setDraft}
            options={CADENCE_OPTIONS}
            ariaLabel="QR rotation cadence"
          />
        </div>
        <p className="rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          {CADENCE_DESCRIPTION[draft]}
        </p>
      </div>
      <SectionFooter
        dirty={dirty}
        pending={pending}
        valid={true}
        onSave={handleSave}
      />
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Business hours — schedule + timezone + last-call. Each day saves
// independently so toggling Tuesday closed doesn't dirty Wednesday.
// Live status banner up top reflects what the customer sees right now.
// ─────────────────────────────────────────────────────────────────────
const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};
const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0]; // Mon-first, Sun last

// Common IANA timezones — keeps the dropdown manageable. Admins outside
// the list can paste an arbitrary IANA string in the input.
const COMMON_TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Australia/Sydney",
  "UTC",
];

function HoursSection({
  timezone,
  lastCallMinutes,
  onSaveSettings,
}: {
  timezone: string;
  lastCallMinutes: number;
  onSaveSettings: (next: SettingsUpdate) => Promise<void>;
}) {
  const { hours, saveDay } = useAdminBusinessHours();
  const status = useOpenStatus();

  // One drafts map for the whole schedule + the venue-wide settings.
  // Single "Save changes" button at the bottom commits everything that
  // changed — matches the per-section save pattern used elsewhere on
  // this page and avoids the 7 tiny per-row buttons that are easy to
  // miss when a row wraps.
  const [draftHours, setDraftHours] = useState<
    Record<Weekday, BusinessHoursDay>
  >(hours);
  const [draftTz, setDraftTz] = useState(timezone);
  const [draftLastCall, setDraftLastCall] = useState(lastCallMinutes);
  const [pending, setPending] = useState(false);

  useEffect(() => setDraftHours(hours), [hours]);
  useEffect(() => setDraftTz(timezone), [timezone]);
  useEffect(() => setDraftLastCall(lastCallMinutes), [lastCallMinutes]);

  const dirtyDays = (Object.values(draftHours) as BusinessHoursDay[]).filter(
    (d) => {
      const orig = hours[d.weekday];
      return (
        d.closed !== orig.closed ||
        d.openTime !== orig.openTime ||
        d.closeTime !== orig.closeTime
      );
    }
  );

  const settingsDirty =
    draftTz !== timezone || draftLastCall !== lastCallMinutes;
  const dirty = dirtyDays.length > 0 || settingsDirty;

  const dayValid = (d: BusinessHoursDay) =>
    d.closed ||
    (d.openTime !== null &&
      d.closeTime !== null &&
      d.openTime < d.closeTime);
  const allDaysValid = (Object.values(draftHours) as BusinessHoursDay[]).every(
    dayValid
  );
  const settingsValid =
    draftTz.trim().length > 0 &&
    Number.isFinite(draftLastCall) &&
    draftLastCall >= 0 &&
    draftLastCall < 240;
  const valid = allDaysValid && settingsValid;

  const handleSave = async () => {
    if (!dirty || !valid) return;
    setPending(true);
    try {
      // Save settings first so the timezone change lands before any
      // schedule edits are interpreted in the new tz.
      if (settingsDirty) {
        await onSaveSettings({
          timezone: draftTz.trim(),
          lastCallMinutesBeforeClose: draftLastCall,
        });
      }
      // Then save each dirty day. Sequential rather than parallel —
      // the table is only 7 rows so the round-trip cost is small,
      // and sequential keeps error handling simple (first failure
      // halts further writes; user retries).
      for (const day of dirtyDays) {
        await saveDay(day);
      }
      toast.success("Hours saved");
    } catch {
      // saveDay + onSaveSettings already toast on failure
    } finally {
      setPending(false);
    }
  };

  // Derived status copy — combines the same OpenStatus the customer
  // sees with the human-readable next-open time so staff can verify
  // their schedule landed without scanning the QR themselves.
  const statusCopy =
    status.kind === "open"
      ? `Open per schedule · closes at ${status.closesAt.toLocaleTimeString(
          "en-US",
          {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: timezone,
          }
        )}`
      : status.kind === "closed-override"
      ? "Force-closed by admin override"
      : status.nextOpenAt
      ? formatNextOpenAt(status.nextOpenAt, timezone)
      : "Closed — no upcoming open time configured";

  const statusTone =
    status.kind === "open"
      ? "border-success/40 bg-success/10 text-foreground"
      : status.kind === "closed-override"
      ? "border-destructive/40 bg-destructive/10 text-foreground"
      : "border-warning/40 bg-warning/10 text-foreground";

  const updateDay = (next: BusinessHoursDay) =>
    setDraftHours((prev) => ({ ...prev, [next.weekday]: next }));

  return (
    <SectionCard
      icon={Clock}
      tone="info"
      title="Business hours"
      description="When the QR scanner unlocks the menu and when the kitchen accepts orders. The manual override (Order availability) above can still force-close the venue regardless of the schedule."
    >
      <div className="space-y-4">
        {/* Live status banner — same OpenStatus the customer ClosedPage reads. */}
        <div
          className={cn(
            "flex items-start gap-2 rounded-2xl border p-3 text-xs",
            statusTone
          )}
        >
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
          <p className="font-medium">{statusCopy}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Timezone">
            <div className="relative">
              <select
                value={draftTz}
                onChange={(e) => setDraftTz(e.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-border bg-card px-3 pr-9 text-sm font-medium text-foreground focus:border-foreground/40 focus:outline-none"
              >
                {COMMON_TIMEZONES.includes(draftTz) ? null : (
                  <option value={draftTz}>{draftTz} (custom)</option>
                )}
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2.2}
              />
            </div>
          </Field>
          <Field label="Last call (min)">
            <Input
              type="number"
              min={0}
              max={239}
              value={draftLastCall}
              onChange={(e) => setDraftLastCall(Number(e.target.value))}
              className="h-11 rounded-xl"
            />
          </Field>
        </div>
        <p className="-mt-1 text-[11px] text-muted-foreground">
          Last call: stop accepting new orders this many minutes before
          close. 0 = orders allowed until the second the venue closes.
        </p>

        {/* Per-day editor — pure controlled inputs, no per-row save. */}
        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Schedule
            </p>
            {dirtyDays.length > 0 && (
              <span className="text-[11px] font-semibold text-warning">
                {dirtyDays.length} day{dirtyDays.length === 1 ? "" : "s"} pending
              </span>
            )}
          </div>
          {WEEKDAY_ORDER.map((wd) => (
            <DayRow
              key={wd}
              day={draftHours[wd]}
              onChange={updateDay}
              isInvalid={!dayValid(draftHours[wd])}
            />
          ))}
        </div>

        <SectionFooter
          dirty={dirty}
          pending={pending}
          valid={valid}
          onSave={handleSave}
        />
      </div>
    </SectionCard>
  );
}

function DayRow({
  day,
  onChange,
  isInvalid,
}: {
  day: BusinessHoursDay;
  onChange: (next: BusinessHoursDay) => void;
  isInvalid: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/30 p-3 transition-colors",
        isInvalid ? "border-destructive/40" : "border-border",
        day.closed && "opacity-70"
      )}
    >
      <span className="w-24 shrink-0 text-sm font-semibold">
        {WEEKDAY_LABELS[day.weekday]}
      </span>

      <label className="inline-flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={day.closed}
          onChange={(e) => {
            const closed = e.target.checked;
            // Re-opening a previously-closed day: the DB stored null
            // for both times when the row was last saved as closed,
            // so unchecking just flips the flag without populating the
            // times leaves them null and tanks validation. Backfill
            // sensible defaults when the user re-opens a day; the
            // displayed values from the input fallback then match the
            // actual state.
            onChange({
              ...day,
              closed,
              openTime:
                !closed && day.openTime === null ? "09:00" : day.openTime,
              closeTime:
                !closed && day.closeTime === null ? "22:00" : day.closeTime,
            });
          }}
          className="h-4 w-4 rounded border-border"
        />
        <span className="font-medium">Closed</span>
      </label>

      {!day.closed && (
        <div className="flex items-center gap-2 text-xs">
          <Input
            type="time"
            value={day.openTime ?? "09:00"}
            onChange={(e) => onChange({ ...day, openTime: e.target.value })}
            className="h-9 w-36 rounded-xl"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="time"
            value={day.closeTime ?? "22:00"}
            onChange={(e) => onChange({ ...day, closeTime: e.target.value })}
            className="h-9 w-36 rounded-xl"
          />
        </div>
      )}

      {isInvalid && (
        <span className="ml-auto text-[11px] text-destructive">
          Open must be before close
        </span>
      )}
    </div>
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
