# SERVIO

## 1. Overview

QR-based restaurant ordering platform delivered as a Progressive Web App.

**What it does**

- Diners scan a per-table QR code, browse the menu on their phone, place an order, and watch its status update in real time — no app install, no waiter wave-down for orders.
- Kitchen staff work a single-page display showing every active ticket and advance them through `pending → preparing → ready → served` with a tap.
- Admins manage menu items, categories, promotional banners, tables, staff, and operational settings from a sidebar-driven web app, with realtime monitoring and a full audit log.

**Core objectives**

- Eliminate paper menus and waiter-mediated ordering for casual-dining venues.
- Give the kitchen real-time visibility on what's pending vs. preparing vs. ready.
- Let one admin run the whole operation from a phone or laptop without a separate POS.

**Key problems it solves**

- Customers ordering before a waiter is free → table abandonment.
- Hand-written tickets getting lost or misread by the kitchen.
- Menu/price changes requiring reprints; sold-out items that the front-of-house didn't know about.
- No accountability trail when prices/availability change.
- Staff missing new orders while doing other tasks.

---

## 2. Scope

### Included

- Anonymous customer flow gated by signed QR token (`?qr=<token>`).
- Cart with item options (size, add-ons, etc.) and per-line option pricing.
- Real-time order tracking via Supabase Postgres changes.
- Web Push notifications when an order moves to `ready`.
- Kitchen display with audio chime on new orders, three-column status board.
- Admin: Dashboard with KPIs, Orders, Menu, Categories, Banners, Tables, Staff, Activity log, Settings.
- Smart suggestions (next table id, derive display name from email, default category from current filter).
- Image uploads to a public Supabase Storage bucket with client-side resize.
- Restaurant-wide configurable settings (name, currency, open/closed, require customer name, default prep time).
- Activity log auto-populated by DB triggers across menu/categories/banners/tables/waiter_calls.
- Per-table QR sticker with printable HTML template.
- PWA install + service worker + push.

### Not included

- Payment processing (orders go to the kitchen as "tab open"; bill is paid offline).
- Inventory tracking by ingredient (only menu-item-level `in_stock` toggle).
- Reservations / table booking.
- Multi-tenant — one deployment serves one venue.
- Loyalty / coupons / promo codes.
- Per-table ordered-item editing after submission (orders are immutable from the customer side).
- Server/staff-to-table assignment (no waiter routing).
- Native mobile apps.

---

## 3. User Roles

### Customer (anonymous)

- Reaches the app by scanning a table's QR sticker.
- Has an in-browser session keyed by `tableId` (persisted in localStorage with sliding TTL).
- Can browse the menu, build a cart, place an order, watch its status, ring the waiter, request the bill, and reorder from a per-device history.
- No password, no account.

### Admin

- Authenticates with email or username + password.
- Full read/write access to menu, categories, banners, tables, staff, settings, and activity log.
- Sees a sidebar order badge + chime on new customer orders.
- Can rotate per-table QR tokens, archive items/categories/tables, and assign roles to other staff.

### Kitchen

- Authenticates with the same auth flow.
- Sees only the kitchen display (`/kitchen`) and Orders.
- Can advance order status (`pending → preparing → ready → served`) but cannot edit menu or settings.

### Waiter (defined role, currently inactive)

- Reserved role in `staff.role`. The schema and role chip exist but no waiter-specific surfaces ship in v1.

---

## 4. Core Features

### 4.1 QR Table Validation

- Customer hits `/?qr=<token>` from the printed sticker.
- `useTableValidation` calls Supabase to confirm the token matches an active table; persists `tableId` in localStorage; routes to `/menu`.
- Invalid or expired token → "Invalid Table" landing page.

### 4.2 Menu Browsing

- Categories drive a horizontal chip filter; "Top Picks" strip; promo banners carousel.
- `useMenu` fetches items + categories + banners; subscribes to realtime so admin edits propagate without reload.
- Each item supports option groups (single-select or multi-select) with per-choice price deltas.
- "Sold out" items render greyscale and disable the Add button.

### 4.3 Cart + Checkout

- Zustand store with `persist` (localStorage v3, 12-hour sliding TTL).
- Each line is keyed by `lineId = itemId + sorted-selection-hash`, so identical configs stack and different configs are separate lines.
- Customer name is required if `restaurant_settings.require_customer_name = true`.
- Checkout button is disabled when `restaurant_settings.open_for_orders = false` and shows a "We're closed" banner on the menu.

### 4.4 Order Submission

- `submitOrder` inserts into `orders` + `order_items`. Returns the new order id.
- `OrderSuccessModal` confirms, offers a Web Push subscription opt-in, then routes to `/order-status?order=<id>`.

### 4.5 Order Status Tracking

- Customer sees a status hero card with a status-tinted gradient, animated icon, ETA range, and progress dots (3 steps + served terminal state).
- Subscribes to the order row via realtime; the page re-renders on status change.
- Push notification fires (server-side via the `send-order-push` edge function) when status hits `ready`.

### 4.6 Order History (per-device)

- Last 20 orders cached in localStorage keyed by device.
- `/history` page shows them with live status pulled from Supabase, filtered by id-set.
- "Reorder" rebuilds the cart from a past order (skipping archived items, toasting the count of skipped lines).

### 4.7 Waiter Call

- Customer can ring the waiter from the header bell (or call for the bill if `currentOrderId` exists).
- Inserts into `waiter_calls`; admin sees a dismissable banner on Orders + Kitchen.
- Resolving the call writes `resolved_at` + `resolved_by` and emits an audit log entry with response time.

### 4.8 Kitchen Display

- 3 columns: Pending, Preparing, Ready.
- Card morph between columns uses View Transitions API.
- New-order chime synthesized via Web Audio (no asset).
- Audio context primed on first sound-toggle click for browser auto-play compliance.

### 4.9 Admin — Dashboard

- 6 stat cards: Active orders, Today's orders, Today's revenue, Avg ticket, Top seller, Avg prep time.
- 3 cards have status-tinted icon backgrounds (info / success / warning); rest are neutral.
- Recent orders list (last 5) with table chip + status pill.

### 4.10 Admin — Orders

- Status filter chips with live counts (Active / All / Pending / Preparing / Ready / Served / Cancelled).
- Date-range segmented control (Today / 7d / 30d / All) — counts and visible orders flow from the same `rangeStart` cutoff.
- Desktop: dense table. Mobile: cards.
- Tap a row → drawer with status-advance segmented control + per-item breakdown.
- "/" focuses the search box; ⌘K opens the global palette.

### 4.11 Admin — Menu Manager

- List or grid view (toggle persists in localStorage).
- Per-row inline price editing (click → edit → Enter; Undo via toast).
- Bulk selection with sticky floating "Mark sold out / in stock" action bar.
- Stock toggle, edit drawer (image upload + options editor), archive with confirmation.
- "/" focuses search; new items pre-fill category from the current filter chip.

### 4.12 Admin — Categories

- Create / rename / archive / restore / drag-up-down reorder (with smooth View Transitions on swap).
- Curated lucide icon picker per category (`CATEGORY_ICONS`).
- Auto-derives a slug-style id from the label on create with a "Customize" escape hatch.

### 4.13 Admin — Banners

- Create / edit / delete (hard delete) / reorder / enable-disable toggle.
- BannerEditor uses the shared `ImageUpload` component; preview overlays live title/subtitle on the image.

### 4.14 Admin — Tables

- Create / rename / archive / restore.
- **Live session view** per table card: green border + ping dot + ITEMS / TAB / OPEN stats when there are non-terminal orders for that table.
- Smart-suggested next id (`T<n+1>` from highest existing `T<number>`).
- Per-table QR modal: SVG QR generation, rotate-token, print HTML template (80×110mm sticker), download SVG.

### 4.15 Admin — Staff

- Create staff with email or username (or both).
- Server-side temp-password generation; revealed once via modal.
- Role assignment (admin / kitchen / waiter).
- Smart-fill: derives username from email and display name from either.
- Remove, reset password (regenerates and shows once), edit avatar/display name (self-edit on Profile page).

### 4.16 Admin — Activity Log

- `audit_log` populated by DB triggers across menu_items, categories, banners, tables, waiter_calls.
- Per-day grouped feed with filter chips by entity type.
- Each row: tinted icon, summary (`"Halo-Halo price ₱99 → ₱129"`), actor (email local-part), relative time, entity id.
- Realtime subscription so new entries appear live.

### 4.17 Admin — Settings

- Restaurant identity (name, currency symbol).
- Order availability toggle (`open_for_orders`) — flips the customer-facing "We're closed" banner instantly.
- Order behavior (`require_customer_name`, `default_prep_minutes`).
- Per-section save with optimistic UI; concurrent updates from another tab don't stomp in-progress edits.

### 4.18 Command Palette (⌘K)

- Mounted at `AdminLayout`; opens via ⌘K or a search button in the mobile top bar.
- Lazily fetches summary rows on open: menu items, categories, banners, tables (admin-only) + recent orders.
- Empty query → role-filtered "Pages" group; typed query → adds Menu items / Orders / Categories / Banners / Tables groups.
- ↑↓ navigate, Enter to open, Esc to close.

### 4.19 New-order Awareness

- `useAdminOrderPulse` provider counts pending orders, subscribes to realtime.
- Sidebar shows a `bg-warning` count badge on the Orders link.
- Plays a chime when count rises (per-staff opt-in, persisted in localStorage, toggle on Profile page).

### 4.20 Image Upload

- Shared `ImageUpload` component: drag-drop, click-to-pick, "paste URL" fallback, preview with hover Replace + Remove, in-flight spinner.
- Client-side validation (PNG/JPEG/WebP, ≤5 MB), longest-edge resize to 1920px, JPEG re-encode at 0.85 quality.
- Uploads to public `menu-images` bucket under `items/<uuid>.jpg` or `banners/<uuid>.jpg`.

### 4.21 Push Notifications

- VAPID-keyed Web Push.
- Customer subscribes via `OrderSuccessModal` opt-in.
- Server-side `send-order-push` edge function fires when an order's status hits `ready`.

---

## 5. Functional Workflows

### 5.1 Customer — Place Order

1. Customer scans the per-table QR sticker.
2. App validates the token, persists `tableId`, redirects to `/menu`.
3. Customer browses categories, taps an item to view options, adds to cart (or quick-adds for option-less items).
4. Cart bar shows on every page once items are added; tap → `/cart`.
5. Cart page shows line items, totals, and a Checkout button.
6. Checkout collects optional/required name and notes; Place Order is gated by `open_for_orders`.
7. `submitOrder` writes to `orders` + `order_items`, returns the order id.
8. Success modal confirms, offers Push opt-in, routes to `/order-status`.
9. Customer watches status update in real time; gets a Web Push when status hits `ready`.
10. After "served", customer sees a "Thanks for ordering" terminal screen with "Order something else" CTA.

### 5.2 Kitchen — Advance Orders

1. Kitchen staff signs in, lands on `/kitchen`.
2. Display fetches all non-terminal orders, groups into 3 columns.
3. Realtime fires when a customer places a new order → row appears in Pending + chime plays (if enabled).
4. Staff taps the next-status button on the ticket → Postgres update → row morphs to next column via View Transitions.
5. When order moves to Ready, server-side push fires to subscribed customers.
6. Tap "Mark served" → row disappears from the board (status persists in DB).

### 5.3 Admin — Update Item Price

1. Admin lands on `/admin/menu`.
2. Hovers the price → pencil icon fades in.
3. Clicks the price → input replaces it, prefilled with current value.
4. Types new value, presses Enter (or blurs).
5. `setPrice` (via `optimisticUpdate`) paints new price immediately, sends DB update.
6. Toast appears with `"Halo-Halo price ₱99 → ₱129"` + Undo button.
7. DB trigger writes an `audit_log` row; Activity feed updates live in any open admin tab.

### 5.4 Admin — Bulk Mark Sold Out

1. Admin checks the box on multiple menu items.
2. Floating action bar appears at bottom-center: "N selected · Mark sold out / Mark in stock / clear".
3. Clicks "Mark sold out".
4. Single `.in()` Supabase update; all selected rows show greyscale.
5. Toast: "4 items marked sold out · Undo".
6. Per-id snapshot lets Undo restore each item to its prior state, not blanket-reset.

### 5.5 Admin — Add Table + Print QR

1. Admin clicks "Add table".
2. Modal opens with id input pre-filled with next `T<n>` suggestion.
3. Enters label (e.g. "Window booth"), clicks Create.
4. Insert into `tables` with a fresh hex QR token.
5. Tap the table card's QR icon → modal with SVG preview.
6. Click "Print sticker" → opens a popup window with the 80×110mm HTML template + auto-`window.print()`.
7. Sticker prints with brand chip, QR, "Scan to order" eyebrow, big table id, "No app · Tap & go" tagline.

### 5.6 Customer — Ring Waiter

1. Customer taps the bell icon in the header.
2. Sheet opens with two options: "Need help" / "Request bill" (the latter only when `currentOrderId` exists).
3. Picks one + optional note, taps Send.
4. Insert into `waiter_calls`.
5. Admin Orders page banner shows the new call.
6. Admin clicks Resolve → `resolved_at` + `resolved_by` written.
7. DB trigger writes audit log entry with response time: `"Resolved Table 6 service call (3 min)"`.

---

## 6. Business Rules & Constraints

### Authentication

- Anonymous customer access: gated by per-table QR token, validated server-side on each fetch.
- Staff access: Supabase Auth with email or username + password.
- Role enforcement: `AuthGuard` at route level + Postgres RLS at data level.
- Temp passwords: server-generated, shown once at create-time; staff must change on first login (`password_temporary` flag).

### Orders

- Order status flow: `pending → preparing → ready → served`. Skipping is allowed (admin can jump). `cancelled` is terminal from any state.
- Customers cannot edit or cancel an order after submission.
- An order belongs to exactly one `table_id` and zero-to-many `order_items`.

### Menu

- Items must have a non-empty name, description, image, category, and a non-negative price.
- Categories cannot be deleted while non-archived items reference them; admins are warned by the archive dialog with a count.
- Prices are stored as numeric; currency symbol is display-only and configurable via settings.

### Tables

- Table id must match `^[A-Z0-9]{1,8}$` (e.g. `T1`, `BAR3`, `PATIO12`).
- Each table has at most one active QR token. Rotating regenerates a 32-char hex token, invalidating any previously printed sticker.
- Archived tables show "Invalid Table" to scanning customers.

### Banners

- Banners are hard-deleted (no soft-archive column). Reorder is via integer `position` field.
- Only `active=true` banners surface on the customer carousel.

### Settings

- `restaurant_settings` is a singleton row (`id=1` constraint). Insert/delete are not exposed; updates only.
- Public read for everyone (anon QR landing needs `open_for_orders`); writes admin-only via RLS.

### Storage

- `avatars` bucket: 2 MB cap, image MIME allowlist, admin write + self-edit.
- `menu-images` bucket: 5 MB cap, admin write only, public read.
- All uploads are client-side resized + JPEG re-encoded; longest edge ≤ 1920px.

### Audit Log

- `audit_log` is admin-readable only. Inserts happen exclusively via `SECURITY DEFINER` triggers; no manual write policy exists.
- Position-only updates (drag-reorder) and zero-diff updates do not produce log entries.

### Waiter Calls

- Multiple unresolved calls from the same table are allowed (e.g. service + bill).
- Resolving is idempotent at the UI level (optimistic delete + toast on failure).

---

## 7. Data Model / Schema

All tables live in the `public` schema on Supabase Postgres.

### tables

- `id` text primary key — `^[A-Z0-9]{1,8}$`
- `label` text — human-readable name (e.g. "Window booth")
- `qr_token` text — 32-char hex; null if not yet generated
- `archived_at` timestamptz — soft-delete marker
- `created_at` timestamptz

### menu_items

- `id` text primary key — auto-derived from category + timestamp + random
- `name` text
- `price` numeric — non-negative
- `image` text — public URL (Storage or external)
- `category` text — FK → `categories.id`
- `description` text
- `top_pick` boolean
- `in_stock` boolean
- `options` jsonb — array of `{ id, name, kind: "single"|"multi", required, choices: [{ id, name, priceDelta }] }`
- `position` integer — sort within category
- `archived_at` timestamptz

### categories

- `id` text primary key — slug
- `label` text — display name
- `icon` text — lucide icon name (resolved via `CATEGORY_ICONS`)
- `position` integer
- `archived_at` timestamptz

### banners

- `id` text primary key
- `image` text
- `title` text — nullable
- `subtitle` text — nullable
- `position` integer
- `active` boolean

### orders

- `id` text primary key — generated as `ORD-<rand>`
- `table_id` text — FK → `tables.id`
- `status` text — `pending | preparing | ready | served | cancelled`
- `total` numeric
- `customer_name` text — nullable
- `notes` text — nullable
- `ready_at` timestamptz — set when status moves to ready
- `served_at` timestamptz — set when status moves to served
- `created_at` timestamptz

### order_items

- `line_id` text primary key
- `order_id` text — FK → `orders.id`
- `item_id` text — FK → `menu_items.id`, nullable (preserved if menu item is later archived)
- `name` text — denormalized
- `base_price` numeric
- `unit_price` numeric — `base_price` + sum of selection price deltas
- `quantity` integer
- `image` text — denormalized
- `selections` jsonb — `[{ optionId, optionName, choiceId, choiceName, priceDelta }]`

### staff

- `user_id` uuid primary key — FK → `auth.users.id`
- `role` text — `admin | kitchen | waiter`
- `display_name` text — nullable
- `avatar_url` text — nullable
- `username` text — nullable, unique
- `password_temporary` boolean — set true on temp-password create, cleared on first reset
- `created_at` timestamptz

### waiter_calls

- `id` uuid primary key
- `table_id` text — FK → `tables.id`
- `order_id` text — FK → `orders.id`, nullable (service-only calls)
- `kind` text — `service | bill`
- `note` text — nullable
- `created_at` timestamptz
- `resolved_at` timestamptz — nullable
- `resolved_by` uuid — FK → `auth.users.id`, nullable

### push_subscriptions

- `endpoint` text primary key
- `order_id` text — FK → `orders.id`
- `p256dh` text
- `auth` text
- `created_at` timestamptz

### audit_log

- `id` bigint identity primary key
- `actor_id` uuid — FK → `auth.users.id`, nullable on user delete
- `actor_email` text — denormalized
- `action` text — `INSERT | UPDATE | DELETE`
- `entity_type` text — `menu_item | category | banner | table | waiter_call`
- `entity_id` text
- `summary` text — human-readable, composed in trigger
- `before` jsonb — nullable
- `after` jsonb — nullable
- `created_at` timestamptz

### restaurant_settings

- `id` smallint primary key — `check (id = 1)` singleton
- `name` text — default `'SERVIO'`
- `currency_symbol` text — default `'₱'`
- `open_for_orders` boolean — default `true`
- `require_customer_name` boolean — default `false`
- `default_prep_minutes` integer — default `9`
- `updated_at` timestamptz — bumped by trigger
- `updated_by` uuid — FK → `auth.users.id`, nullable

### Storage Buckets

- `avatars` — public, 2 MB cap, image MIME
- `menu-images` — public, 5 MB cap, image MIME

---

## 8. API Design

The system uses Supabase's auto-generated PostgREST + RLS for CRUD and a small set of edge functions for side effects. Direct `fetch` calls are not used by the client — all data access goes through the `@supabase/supabase-js` client.

### REST (PostgREST via supabase-js)

All endpoints are gated by RLS — listed permissions assume the policies are in place.

#### `GET /menu_items`

- `select id, name, price, image, category, description, top_pick, in_stock, options, position`
- `is("archived_at", null)`
- Public read.

#### `PATCH /menu_items?id=eq.<id>`

- Body: any subset of writable columns
- Admin-only.

#### `GET /orders?id=eq.<id>`

- Returns one order with joined `order_items`.
- Anon read by id (used by customer order tracking).

#### `POST /orders`

- Body: full order row + nested `order_items`.
- Anon write — RLS validates the `table_id` exists and is non-archived.

#### `PATCH /orders?id=eq.<id>` (status update)

- Body: `{ status }` — `pending | preparing | ready | served | cancelled`.
- Staff (admin or kitchen) only.

#### `POST /waiter_calls`

- Body: `{ table_id, order_id?, kind, note? }`.
- Anon write.

#### `PATCH /waiter_calls?id=eq.<id>`

- Body: `{ resolved_at, resolved_by }`.
- Staff only.

#### `GET /audit_log`

- `order("created_at", { ascending: false }).limit(N)`
- Admin-only read; insert/update/delete blocked by RLS.

#### `GET|PATCH /restaurant_settings?id=eq.1`

- Public read.
- Admin-only update.

### Storage

#### `POST /storage/v1/object/menu-images/<prefix>/<uuid>.jpg`

- `prefix` is `items` or `banners`.
- Admin-only write.

#### `POST /storage/v1/object/avatars/staff/<userId>/avatar.png`

- Admin write or self-edit (path matches `auth.uid()::text`).

### Realtime (postgres_changes)

Subscribed via `useRealtimeTables` per surface:

- `admin-orders` ← `orders`, `order_items`
- `admin-pulse` ← `orders` (count + chime, single instance via Provider)
- `admin-table-sessions` ← `orders`, `order_items`
- `admin-tables` ← `tables`
- `admin-categories` ← `categories`
- `admin-menu-categories` ← `categories`
- `admin-activity` ← `audit_log`
- `staff-waiter-calls` ← `waiter_calls`
- `customer-history` ← `orders`
- `restaurant-settings` ← `restaurant_settings` (single instance via Provider)
- `kitchen-display` ← `orders`, `order_items`

### Edge Functions

#### `POST /functions/v1/send-order-push`

- Body: `{ order_id }`.
- Looks up `push_subscriptions` for the order, signs a VAPID payload, fires to each endpoint.
- Invoked from the client after `setStatus("ready")` (fire-and-forget).

### Auth

#### `POST /auth/v1/token?grant_type=password`

- Body: `{ email, password }` or `{ email: "<username>@servio.local", password }` for username login.

#### `POST /auth/v1/recover`

- Body: `{ email, redirect_to }`.

---

## 9. UI/UX Behavior

### Cross-cutting

- Optimistic updates everywhere — local state mutates first, server confirms after; rollback on error via `refetch()`.
- Toasts (sonner) are the single notification surface; success toasts on writes, error toasts on failures, Undo actions where reversible.
- Realtime fires `refetch()` on the relevant hook; UI re-renders from the new state.
- Skeleton loaders render block-for-block silhouettes of the eventual content (no layout shift).
- View Transitions API smooths card-to-card morphs (kitchen tickets, banner reorder, category reorder).

### Customer

- Cart-bar enters with a "stamp" animation when a new item is added (slam down + slight overshoot + settle).
- Order status hero card uses a gradient + decorative blurred circle, status-tinted by current status.
- ETA is shown as a range (`Usually ready in 7–11 min`) with ±2 min buffer; pill is `bg-foreground` for emphasis.
- Push opt-in is offered once on the success modal; explicit-decline is silent (no nag).
- Closed-state shows a warning banner on the menu and disables the place-order button on checkout.

### Admin

- Sidebar pending-orders badge animates pop-in on each increment.
- Inline price edit replaces the static price with an input on click, with a small pencil icon as hover affordance.
- Bulk action bar is a floating dark pill at `fixed bottom-4 left-1/2`, animates fade-up on first selection.
- Segmented controls (date range, view toggle, status tabs) share one component (`SegmentedControl`) with `card` / `filled` variants.
- ⌘K palette: keyboard nav (↑↓ + Enter), highlight follows mouse hover, Esc closes.
- Empty states use `AdminEmptyState` with a tinted icon container, helpful description, optional primary + secondary CTAs.
- Auth pages use `AuthShell` with a soft `bg-info/10` background glow + `bg-info/35` halo behind the brand mark.

### Kitchen

- Three-column layout — Pending / Preparing / Ready — each with status-colored count badges that animate `count-bump` on increment.
- Cards morph between columns via View Transitions.
- Sound toggle in the header primes the AudioContext on first click; mute persists in localStorage.

### Disabled / loading states

- Buttons get `disabled:cursor-not-allowed disabled:opacity-50` and lose hover/scale transforms.
- Async actions show inline spinners (Loader2 from lucide); the button label changes (e.g. "Saving…").

---

## 10. Edge Cases

### Realtime / network

- Multiple components calling the same realtime hook → channel name collision → `cannot add postgres_changes callbacks after subscribe()`. Solved by lifting shared subscriptions to a single Provider (`RestaurantSettingsProvider`, `AdminOrderPulseProvider`).
- Realtime drop / reconnect → next event refetches the full set; no diff replay.
- Push notification fails (subscription expired, browser denied) → server-side ignores per-endpoint failures; doesn't block the status update.

### Data shape drift

- Customer reorders an item that was archived since their last visit → `submitOrder` skips the line, toasts a count of skipped items.
- Order references a `menu_item` that was later archived → `order_items.item_id` is preserved but optional; UI degrades to denormalized `name` + `image` columns.
- Category archived while items still reference it → existing items keep the category id; admin sees the warning count in the archive confirmation dialog.

### Auth

- Password-reset link expired → user lands on `/admin/login?reason=expired-reset` with a friendly message.
- User signed in but no `staff` row (deleted while logged in) → guard kicks back to login with `reason=no-staff-record`.
- Synthetic email (`<username>@servio.local`) is not shown in the profile UI when present.

### Files

- Image upload >5 MB → client-side rejection before upload.
- Wrong MIME → client-side rejection.
- Network drop mid-upload → error toast; retry preserves form state.
- Avatar removed but DB write fails → optimistic local clear is rolled back via `refetch()`.

### Concurrent admin edits

- Two admins editing the same item → optimistic UI of the slower one is overwritten by the realtime push from the faster save.
- Settings page sections each track their own `dirty` flag and use refs/touched-flags so a concurrent realtime update from another tab doesn't stomp in-progress text input.

### QR / token

- Customer hits an old printed sticker after token rotation → "Invalid Table" landing.
- Customer hits a sticker for an archived table → "Invalid Table" landing.
- Same token across two devices → both work; orders are keyed by tableId, not session.

### Migration order

- `0014_menu_images_bucket.sql` must be applied before image uploads work — until then, the `ImageUpload` component's URL fallback is the only path.
- `0015_audit_log.sql` must be applied before the Activity page renders content.
- `0016_restaurant_settings.sql` must be applied before settings writes succeed; reads fall back to `DEFAULT_RESTAURANT_SETTINGS` until then.

### Browser quirks

- Service worker push title falls back to `"SERVIO"` (hardcoded) — runs outside the React tree, so it doesn't reflect a renamed restaurant until the next deploy regenerates the worker.
- iOS Safari Web Audio requires a user gesture to unlock — the chime toggle uses the click as the priming gesture.
- `window.open` blocked by popup blocker on the QR print path → toast `"Browser blocked the print window."`.

---

## 11. Future Enhancements

- **Payment integration** — Stripe / PayMongo for in-app paying so customers can close their tab without flagging a waiter.
- **Tipping** — preset percentage chips on the checkout page, configurable in Settings.
- **Server / staff-to-table assignment** — `tables.assigned_to` + a "claim" workflow on the kitchen / waiter surface.
- **Zones** — `tables.zone` column ("Front", "Bar", "Patio") with filter chips on the Tables page; matches the zone-filtering pattern from competing live-table dashboards.
- **Date-range analytics** — replace the dashboard's "today / yesterday" deltas with an interactive chart range.
- **Receipt printing** — thermal printer integration for kitchen/bar (escpos via WebUSB).
- **Item-level audit** — extend audit_log triggers to capture options/option-choice changes.
- **Reservations / pre-orders** — a separate `reservations` table with table holds.
- **Scheduled "auto-cancel pending"** — cron-ish job that cancels orders idle in pending for >N minutes (settings-configurable).
- **Multi-tenant** — venue-scoped tables, separate sub-domain or `?venue=` parameter.
- **Mobile native shells** — wrap the PWA in Capacitor for App Store distribution (mostly cosmetic; the PWA already covers function).
