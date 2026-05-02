/**
 * Business hours data layer. Mirrors the public.business_hours table
 * from migration 0024. The customer side reads these to know whether
 * to render the menu or the ClosedPage; the admin side writes to them
 * via the Settings → Hours editor.
 *
 * Server-side enforcement lives in is_restaurant_open() + the
 * check_order_abuse trigger; this module is the client cache + the
 * "next open at" / "is open now" math used to render the closed page.
 */
import { supabase } from "@/lib/supabase";

/** 0 = Sunday, 6 = Saturday — matches Postgres extract(dow). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BusinessHoursDay {
  weekday: Weekday;
  /** "HH:MM" 24h, or null when closed (closed flag is the source of truth). */
  openTime: string | null;
  closeTime: string | null;
  closed: boolean;
}

interface BusinessHoursRow {
  weekday: number;
  open_time: string | null;
  close_time: string | null;
  closed: boolean;
}

function rowToDay(row: BusinessHoursRow): BusinessHoursDay {
  // Postgres returns "HH:MM:SS"; trim seconds for cleaner display
  // and parsing parity with <input type="time">.
  const trimSeconds = (t: string | null): string | null =>
    t ? t.slice(0, 5) : null;
  return {
    weekday: row.weekday as Weekday,
    openTime: trimSeconds(row.open_time),
    closeTime: trimSeconds(row.close_time),
    closed: row.closed,
  };
}

export interface FetchHoursResult {
  /** Indexed by weekday (0–6) so callers can look up by day directly. */
  hours: Record<Weekday, BusinessHoursDay>;
  error: string | null;
}

/** All 7 rows. The migration seeds them so the result is always full. */
export async function fetchBusinessHours(): Promise<FetchHoursResult> {
  const { data, error } = await supabase
    .from("business_hours")
    .select("weekday, open_time, close_time, closed")
    .order("weekday", { ascending: true });

  if (error) {
    console.error("[services/businessHours] fetch failed:", error);
    return { hours: defaultHours(), error: error.message };
  }

  const map = defaultHours();
  for (const row of (data ?? []) as BusinessHoursRow[]) {
    const day = rowToDay(row);
    map[day.weekday] = day;
  }
  return { hours: map, error: null };
}

/**
 * Save a single day. Called from the admin Hours editor; one row per
 * save so a quick toggle on Tuesday doesn't write Wednesday too.
 */
export function saveBusinessHoursDay(day: BusinessHoursDay) {
  return supabase
    .from("business_hours")
    .update({
      open_time: day.closed ? null : day.openTime,
      close_time: day.closed ? null : day.closeTime,
      closed: day.closed,
    })
    .eq("weekday", day.weekday);
}

/**
 * Default hours used as the initial cache value before the realtime
 * fetch lands. Mirrors the migration seed (open 09:00–22:00 every day)
 * so the UI doesn't flash "closed" before the network comes back.
 */
export function defaultHours(): Record<Weekday, BusinessHoursDay> {
  const weekdays: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
  return Object.fromEntries(
    weekdays.map((w) => [
      w,
      { weekday: w, openTime: "09:00", closeTime: "22:00", closed: false },
    ])
  ) as Record<Weekday, BusinessHoursDay>;
}

// ─────────────────────────────────────────────────────────────────────
// Open/closed math — pure functions, no Supabase dependency. The same
// logic runs server-side in is_restaurant_open(); we duplicate it
// here so the closed banner can render without a round-trip and the
// Settings page can show "currently open per schedule" live.
// ─────────────────────────────────────────────────────────────────────

interface OpenComputeInput {
  openForOrders: boolean;
  timezone: string;
  lastCallMinutes: number;
  hours: Record<Weekday, BusinessHoursDay>;
  /** Inject "now" for testing; defaults to wall clock. */
  now?: Date;
}

export type OpenStatus =
  | { kind: "open"; closesAt: Date }
  | { kind: "closed-schedule"; nextOpenAt: Date | null }
  | { kind: "closed-override" };

/**
 * Compute the venue's open/closed status as of `now` (defaulting to
 * wall clock). Returns enough info to render an honest closed page —
 * "Opens at 9:00 AM tomorrow" — without further queries.
 */
export function computeOpenStatus(input: OpenComputeInput): OpenStatus {
  const { openForOrders, timezone, lastCallMinutes, hours } = input;
  const now = input.now ?? new Date();

  if (!openForOrders) return { kind: "closed-override" };

  const local = toLocal(now, timezone);
  const todayDow = local.weekday;
  const today = hours[todayDow];

  if (today && !today.closed && today.openTime && today.closeTime) {
    const openMinutes = parseTimeToMinutes(today.openTime);
    const effectiveCloseMinutes =
      parseTimeToMinutes(today.closeTime) - lastCallMinutes;
    const nowMinutes = local.hour * 60 + local.minute;
    if (nowMinutes >= openMinutes && nowMinutes < effectiveCloseMinutes) {
      const closesAt = composeLocalDate(
        now,
        timezone,
        0,
        effectiveCloseMinutes
      );
      return { kind: "open", closesAt };
    }
  }

  return {
    kind: "closed-schedule",
    nextOpenAt: findNextOpen(now, timezone, hours),
  };
}

/**
 * Returns the next moment the venue opens, or null if no day in the
 * upcoming week has hours configured. Walks at most 7 days forward.
 */
function findNextOpen(
  now: Date,
  timezone: string,
  hours: Record<Weekday, BusinessHoursDay>
): Date | null {
  const local = toLocal(now, timezone);
  const nowMinutes = local.hour * 60 + local.minute;

  for (let offset = 0; offset < 7; offset++) {
    const dow = ((local.weekday + offset) % 7) as Weekday;
    const day = hours[dow];
    if (!day || day.closed || !day.openTime) continue;
    const openMinutes = parseTimeToMinutes(day.openTime);
    // Today only counts if the open time hasn't passed yet.
    if (offset === 0 && nowMinutes >= openMinutes) continue;
    return composeLocalDate(now, timezone, offset, openMinutes);
  }
  return null;
}

/**
 * Format the next-open Date for the customer ClosedPage. Absolute
 * format ("Opens at 9:00 AM tomorrow"), with relative day labels for
 * the most-recent two and weekday names for further out.
 */
export function formatNextOpenAt(
  nextOpenAt: Date,
  timezone: string,
  now: Date = new Date()
): string {
  const todayLocal = toLocal(now, timezone);
  const targetLocal = toLocal(nextOpenAt, timezone);
  const dayDelta = daysBetweenLocalDates(todayLocal, targetLocal);

  const time = nextOpenAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  });

  if (dayDelta === 0) return `Opens today at ${time}`;
  if (dayDelta === 1) return `Opens tomorrow at ${time}`;

  const weekday = nextOpenAt.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: timezone,
  });
  return `Opens ${weekday} at ${time}`;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers — local-time math. Intl.DateTimeFormat is the only reliable
// way to get a specific timezone's wall-clock time without pulling
// date-fns-tz / Luxon.
// ─────────────────────────────────────────────────────────────────────

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: Weekday;
}

function toLocal(date: Date, timezone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  const weekdayMap: Record<string, Weekday> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday] ?? 0,
  };
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Compose a Date for "today (in timezone), plus N days, at H:M local".
 * Approximation: builds the target wall-clock string and parses it
 * back. Sufficient for "next open at" — DST transitions might be off
 * by an hour at the margin, which is acceptable for v1.
 */
function composeLocalDate(
  ref: Date,
  timezone: string,
  daysAhead: number,
  minutes: number
): Date {
  const local = toLocal(ref, timezone);
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  // Construct ISO-like string in target tz, then convert to UTC by
  // round-tripping through Date with a synthetic offset. The cleanest
  // approach is to use a temp UTC date for the wall-clock value, then
  // subtract the timezone offset of that day.
  const baseUtc = Date.UTC(local.year, local.month - 1, local.day + daysAhead, hh, mm);
  const baseDate = new Date(baseUtc);
  // Compute the offset between baseDate-as-UTC and baseDate-as-local-tz
  const tzOffsetMs = tzOffsetMinutes(baseDate, timezone) * 60_000;
  return new Date(baseUtc - tzOffsetMs);
}

function tzOffsetMinutes(date: Date, timezone: string): number {
  const local = toLocal(date, timezone);
  const utc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute
  );
  return Math.round((utc - date.getTime()) / 60_000);
}

function daysBetweenLocalDates(a: LocalParts, b: LocalParts): number {
  const ad = Date.UTC(a.year, a.month - 1, a.day);
  const bd = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bd - ad) / 86_400_000);
}
