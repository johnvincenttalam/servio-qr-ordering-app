# SERVIO Deployment Readiness

A capability map for the SERVIO deployment questionnaire — for each question, what the system does today (✅), does with caveats (◐), or doesn't cover (✗). Pair with the questionnaire when scoping a deployment so gaps surface up front.

**Legend**

- ✅ **Ready** — works today, no extra work
- ◐ **Partial** — works but with caveats; specific gap noted
- ✗ **Gap** — not built; deliberate scope decision or future work
- ⚙ **Configurable** — admin can change behaviour from `/admin/settings`

**Quick read at a glance**

- Customer ordering, kitchen display, admin tooling, reporting → **mostly ready**
- Payments, receipts, multi-branch → **gaps** (deliberate, see § 2 and § 10)
- Inventory and offline mode → **gaps** (out of MVP scope)

---

## 1. Customer Experience & Ordering Flow

### 1.1 Customers who don't have smartphones / prefer traditional ordering

- ✗ **Gap.** SERVIO is QR-only. There's no admin-side "place order on behalf of customer" surface, so a smartphone-less customer needs a staff member to enter the order on their own phone or device.
- **Workaround**: any staff phone can scan the table's QR and place the order on the customer's behalf — same flow as a guest, just operated by staff.

### 1.2 Fully replace waiter ordering vs. hybrid

- ◐ **Partial.** Fully QR-based today; hybrid via the workaround above. A real "staff order entry" surface is **not built**.

### 1.3 Multiple orders per table vs. one continuous tab

- ✅ **Ready.** Customers can place multiple orders. The Tables page renders a live "session" per table aggregating all non-terminal orders into ITEMS / TAB / OPEN stats. Order Status page has an "Add to your tab" CTA that returns to the menu without resetting state.

### 1.4 Customer name required vs. anonymous

- ⚙ **Configurable.** `restaurant_settings.require_customer_name` toggle in `/admin/settings`. When on, the checkout's name field becomes required and the place-order button blocks until filled.

---

## 2. Billing & Payment Process

### 2.1 Payment methods (Cash / GCash / Maya / Card)

- ✗ **Gap.** SERVIO does **not** process payments. Orders are submitted as "tab open"; the operator settles payment offline through whatever processor they already use.

### 2.2 Compute final bill automatically

- ✅ **Ready.** Each order's total is computed at submit (item prices + option deltas × quantity). The Tables live-session view shows the running tab (₱TAB column) per table.

### 2.3 Split bills / partial payments

- ✗ **Gap.** Each order is a single line; no split-bill or partial-payment tracking. If three customers at one table place separate orders, the system shows them as separate orders aggregated under the table — not a single bill split three ways.

### 2.4 Digital receipts / printed receipts

- ✗ **Gap.** No receipt format, no thermal printer integration. The customer's Order Status page is the closest thing to a digital record. The QR sticker print template (`/admin/tables` → Print sticker) uses `window.print()` but is for sticker printing, not receipts.

---

## 3. Kitchen Operations

### 3.1 Order prioritisation (FIFO vs. priority)

- ✅ **Ready (FIFO only).** Kitchen display orders tickets by `created_at` ascending within each status column. No VIP / priority flag.

### 3.2 Kitchen edit / correct orders / mark items unavailable

- ◐ **Partial.** Kitchen staff advance status (`pending → preparing → ready → served`) but cannot edit order contents.
- Items can be marked sold-out from `/admin/menu` (per item or bulk via the floating action bar) — but that's admin-side, not the kitchen display.
- An admin viewing the Orders page can change status to `cancelled` from the OrderDetail drawer.

### 3.3 High-volume periods / delays

- ◐ **Partial.** The kitchen display scrolls cleanly with arbitrary order count; tickets show "X min ago" age. No automatic "this order is X minutes overdue" alerting.

### 3.4 Fixed vs. dynamic prep time

- ⚙ **Fixed (configurable).** `restaurant_settings.default_prep_minutes` drives the customer-facing ETA range ("Usually ready in 7–11 min"). Dashboard shows actual avg prep computed from real data, but it doesn't feed back into the ETA automatically.

---

## 4. Staff Roles & Responsibilities

### 4.1 Existing roles

- ◐ **Partial.** Schema supports `admin`, `kitchen`, `waiter`. Admin and kitchen have full surfaces; **waiter is schema-only** (the role exists, no waiter-specific UI). **No cashier role.**

### 4.2 Assign staff to tables / track who served each order

- ✗ **Gap.** No staff-to-table assignment. `orders` has no `served_by` column.

### 4.3 Waiter calls — assigned vs. shared

- ✅ **Ready (shared).** All staff with kitchen/admin access see waiter calls in the banner. First to tap "Resolve" wins; the audit log captures who resolved + how long it took.

### 4.4 Activity tracking — performance / response times

- ◐ **Partial.** `/admin/activity` captures every meaningful admin action (price changes, archives, item creates, etc.) with actor identification. Waiter call resolution time is captured per-call. **Per-staff order-handling metrics are not built** — would need `served_by` first.

---

## 5. Menu & Inventory Management

### 5.1 Stock availability — manual vs. inventory system

- ◐ **Manual only.** Item-level `in_stock` toggle (per row + bulk action). **No ingredient-level inventory** — running out of "mango" doesn't auto-disable mango-containing items.

### 5.2 Automatic vs. manual sold-out

- ✗ **Manual only.** Bulk toggle helps ("ran out of mango → 4 items sold-out in one click") but the system doesn't auto-detect.

### 5.3 Item becomes unavailable mid-order

- ◐ **Partial.** A sold-out item is hidden from the menu's Add button immediately for new customers. Customers who already had it in cart (from before the toggle flipped) can still submit. **No automatic notify-and-replace flow.**

---

## 6. Connectivity & Reliability

### 6.1 Internet stability requirements

- ✗ **Online-required.** Supabase is the source of truth for everything. The customer PWA caches assets so the shell loads offline, but ordering, status, and admin all need connection.

### 6.2 Offline functionality / backup ordering

- ✗ **Gap.** No offline mode for kitchen or admin. No offline order-queue with sync-when-online behaviour. The customer cart does persist in localStorage with a 12-hour sliding TTL, so a brief drop doesn't lose the cart, but checkout needs network.

### 6.3 Free WiFi / customer mobile data

- N/A — operator's responsibility. The system is data-light (small JSON payloads, lazy-loaded admin chunk) so mobile data works fine.

---

## 7. Security & Abuse Prevention

### 7.1 Fake / prank orders, unauthorized access

- ◐ **Partial.** Per-table QR token (32-char hex, 128 bits of entropy) gates each table — random URL-guessing won't work. Anyone with the printed sticker can place an order.

### 7.2 Limit orders per table / verification

- ◐ **Partial.** Waiter calls have a 60-second cooldown per kind per table (sessionStorage + DB trigger). Order placement has no rate limit. **No verification step before placing an order.**

### 7.3 Static vs. rotated QR codes

- ✅ **Rotatable on demand.** `/admin/tables` → table QR modal → "Rotate token" generates a new 32-char hex token, invalidating any previously printed sticker. **Not automatically rotated** — operator-initiated only.

---

## 8. Reporting & Business Insights

### 8.1 Reports needed

- ✅ **Daily sales** — `/admin/dashboard` (today range) + `/admin/reports` for arbitrary windows.
- ✅ **Top-selling items** — Dashboard top-sellers leaderboard with units + revenue, ranked.
- ✅ **Peak hours** — Dashboard "Service load" chart, hour-by-hour with peak highlighted.
- ✗ **Staff performance** — not built (depends on the missing `served_by` column).

### 8.2 Revenue tracking — automatic vs. order-only

- ✅ **Automatic.** Revenue computed from order totals, surfaced on the dashboard hero + reports. Cancelled orders are excluded so refunds don't pad totals.

### 8.3 Exportable reports

- ✅ **CSV export** of orders for any date range from `/admin/reports` (Excel-friendly UTF-8 with BOM).
- ✗ **PDF export** is not built.
- ✅ **Dashboard analytics** — sparklines (7-day), service load, top sellers, range selector (Today / Week / Month).

---

## 9. Customer Behaviour & Edge Cases

### 9.1 Modify / cancel after submission

- ✗ **Gap (deliberate).** Customers cannot edit or cancel an order after submit. Admin or kitchen can move an order to `cancelled` from the Orders page; the customer's status page reflects that.

### 9.2 Group dining (multiple people at one table)

- ✅ **Ready.** Multiple customers can scan the same QR. Each places their own independent order; the Tables live-session view aggregates them under the table id (combined item count, combined tab total, age of the oldest).

### 9.3 Customer order history

- ✅ **Per-device.** `/history` page on the customer side shows the last 20 orders this device has placed (localStorage-backed). Reorder + live status pull. **Not tied to a customer account** (no accounts model).

---

## 10. Business Structure & Scalability

### 10.1 Single vs. multiple branches

- ✗ **Single-tenant.** One deployment serves one venue. Tables, menu, staff, settings, audit log are all global.

### 10.2 Future expansion

- ✗ **Multi-branch is a deliberate scope deferral.** Adding it would require a `venue_id` foreign key on every owned table + RLS policies that filter by venue + a venue-switcher in the admin shell. Significant rework.

### 10.3 Centralised management across branches

- ✗ **Not supported** as a consequence of being single-tenant. Would land alongside the multi-branch refactor above.

---

## 11. Goals & Expectations

These are the operator's answers — SERVIO doesn't pre-fill them. As deployment context, the system is best aligned with:

- ✅ **Faster service** — customers don't wait for a waiter to take orders.
- ✅ **Reduced staff workload on order-taking** — kitchen sees orders directly, no transcription.
- ◐ **Increased sales** — bigger menu surfacing (banners, top picks, photos) typically helps; no A/B testing tools though.
- ✅ **Improved customer experience** — instant ordering, real-time status, push when ready.

If the operator's primary goal is **payment automation** or **multi-venue management**, SERVIO is the wrong tool today.

---

## ✅ Additional Notes

### What SERVIO does that the questionnaire doesn't ask about

- **Audit log** at `/admin/activity` — every meaningful admin action (price change, sold-out toggle, archive, waiter resolve) is captured with actor + timestamp. Useful for accountability when staff blame each other.
- **Real-time everywhere** — Postgres realtime subscriptions mean a price change in the admin propagates to customer menus instantly without a refresh.
- **Web Push** when an order is ready — customer doesn't have to keep the tab open.
- **Settings-driven branding** — restaurant name + currency symbol are runtime-configurable, not redeployed.
- **PWA installable** — customers can pin the table's menu URL to their home screen.

### Common deployment prerequisites

- A Supabase project (Postgres + Auth + Storage + Realtime + Edge Functions).
- VAPID keys for Web Push.
- Apply migrations `0001` through `0016`.
- Configure restaurant identity in `/admin/settings` after first admin login.
- Print + distribute QR stickers from `/admin/tables`.

---

**Source questionnaire:** `RAG IT Solutions — SERVIO Deployment Questionnaire`
**Capability snapshot date:** 2026-05-02
