/**
 * Customer-side order history. Anonymous customers don't have an account,
 * so "your past orders on this device" is the right scope: we keep a
 * minimal index of order ids in localStorage and re-fetch the live row
 * from Supabase on demand for the up-to-date status / items.
 *
 * Capped at 20 entries to keep localStorage tidy. Newest first.
 */

const KEY = "servio.orderHistory.v1";
const MAX_ENTRIES = 20;

export interface OrderHistoryEntry {
  id: string;
  /** Snapshot at the time the order was placed; useful for the list view. */
  total: number;
  createdAt: number;
  /** Customer name they used; pre-fills checkout on a reorder. */
  customerName?: string;
  /** Table they ordered from. Helpful for "you ordered from T2 last time". */
  tableId?: string;
}

function safeParse(raw: string | null): OrderHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) => e && typeof e.id === "string" && typeof e.createdAt === "number"
    );
  } catch {
    return [];
  }
}

export function getOrderHistory(): OrderHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return safeParse(window.localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

export function recordOrder(entry: OrderHistoryEntry): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getOrderHistory();
    // De-dupe in case the same id is recorded twice (placement retry).
    const filtered = existing.filter((e) => e.id !== entry.id);
    const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota / private mode — drop silently rather than throw mid-checkout.
  }
}

export function clearOrderHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Most recently used customer name across history. Used to pre-fill the
 * checkout form on a reorder so returning customers don't retype it.
 */
export function getLastCustomerName(): string | null {
  for (const entry of getOrderHistory()) {
    if (entry.customerName) return entry.customerName;
  }
  return null;
}
