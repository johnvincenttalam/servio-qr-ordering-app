# SERVIO — Code-Generation Rules

Concise, directive ruleset for AI-assisted code generation in this repo. Pair with `docs/SYSTEM.md` (reference) and `CLAUDE.md` (workflow). Optimized for ingestion as context.

---

## Stack invariants

- React **19**, TypeScript, Vite **8**.
- Tailwind **v4** (via `@import "tailwindcss"`); custom theme tokens in `src/index.css`.
- shadcn/ui primitives sit on top of `@base-ui/react`.
- Zustand **v5** for global state; React Context for shared realtime subscriptions; `useState` for local.
- Supabase: Postgres + RLS + Realtime + Storage + Auth + Edge Functions.
- Routing: `react-router-dom` v7. Customer routes are anonymous; admin/kitchen behind `AuthGuard`.
- Toasts: `sonner` (one global Toaster mounted in `App.tsx`).
- Icons: `lucide-react`.
- Date/time: native `Date` + `formatRelative` from `@/utils`. No moment/dayjs/date-fns.

---

## File organization

| Concern | Path |
|---|---|
| Customer pages | `src/pages/<Name>/index.tsx` |
| Admin pages | `src/admin/pages/<Name>.tsx` |
| Kitchen page | `src/kitchen/pages/Display.tsx` |
| Shared UI | `src/components/common/`, `src/components/ui/` |
| Customer-section UI | `src/components/menu/`, `src/components/cart/`, `src/components/checkout/`, `src/components/layout/` |
| Admin-section UI | `src/admin/components/` |
| Hooks (shared) | `src/hooks/use<Name>.ts(x)` |
| Hooks (admin-only) | `src/admin/use<Name>.ts(x)` |
| Hooks (kitchen-only) | `src/kitchen/use<Name>.ts` |
| Pure utilities | `src/lib/<concern>.ts` |
| Domain types | `src/types/index.ts` (shared); admin-only types stay in their hook file |
| Constants | `src/constants/index.ts` |
| Supabase migrations | `supabase/migrations/<NNNN>_<slug>.sql` |
| Edge functions | `supabase/functions/<name>/index.ts` |

**Rule**: any module that exports JSX must be `.tsx`. Hooks that contain a Provider are `.tsx`; pure-logic hooks are `.ts`.

---

## Data layer (Supabase)

- **Always** access Supabase through the singleton in `@/lib/supabase`. Never instantiate a new client.
- **Never** call `fetch()` directly against the Supabase REST URL. Use the JS client.
- DB tables use `snake_case`; client domain types use `camelCase`. Mapping happens **inside the service**, not in the hook.
- Soft-delete via `archived_at` timestamp. Filter `.is("archived_at", null)` for active rows.
- New tables MUST have RLS policies in the same migration. Default: deny all; explicitly allow per role.
- All `INSERT`/`UPDATE`/`DELETE` triggers that touch `audit_log` must be `SECURITY DEFINER` and reset `search_path`.

### Services layer

`src/services/<entity>.ts` owns all Supabase queries for a single domain. Hooks (`useAdmin<X>`) consume services and add React state + realtime + optimistic UI. Components consume hooks. **Don't** call Supabase directly from a hook or component.

Conventions:
- Service files export domain types (`AdminTable`, `BannerDraft`, etc.) and mapping helpers (`compareTableIds`, `compareCategoriesForList`). Row interfaces and `rowTo<X>` mappers stay private to the file.
- Read functions return `{ items, error }` (or richer for multi-entity fetches like `fetchMenu`). They handle their own `console.error` and return mapped domain objects on success.
- Mutation functions:
  - Single-field updates that pair with `optimisticUpdate` return the unawaited Supabase query (`PromiseLike<DbResult>`). Example: `setMenuItemInStock(id, inStock)`.
  - Editor-form mutations that need to surface validation throw on error and return `Promise<void>`. Example: `saveMenuItem(id, draft)`.
  - Mutations that compute a value (token rotation) `await` internally and return the value on success, throw on failure.
- Hooks re-export domain types via `export type { ... }` so existing page-level imports keep working.

Existing services (one file per domain — both customer and admin functions live together where the underlying table is shared):

- `@/services/menu` — admin `fetchMenuOverview` + customer `fetchActiveMenuItems` / `fetchActiveCategories` / `fetchActiveBanners` / `fetchMenuItem` + admin mutations (`setMenuItemInStock`, `setMenuItemsInStock`, `setMenuItemPrice`, `saveMenuItem`, `createMenuItem`, `archiveMenuItem`), `MenuItemDraft`
- `@/services/tables` — `fetchTables`, `countActiveOrdersForTable`, mutations (`createTable`, `saveTableLabel`, `archiveTable`, `restoreTable`, `rotateTableToken`), helpers (`generateQrToken`, `compareTableIds`), `TableDraft`
- `@/services/banners` — `fetchBanners`, `setBannerActive`, `saveBanner`, `createBanner`, `deleteBanner`, `swapBannerPositions`, `BannerDraft`
- `@/services/categories` — `fetchCategories`, `countItemsInCategory`, mutations (`createCategory`, `saveCategoryDetails`, `archiveCategory`, `restoreCategory`, `swapCategoryPositions`), `compareCategoriesForList`, `CategoryDraft`
- `@/services/staff` — `fetchStaff` (list_staff RPC), `createStaff` + `resetStaffPassword` (edge functions), `setStaffRole`, `setStaffDisplayName`, `setStaffAvatar`, `clearStaffAvatar`, `deleteStaffMember`, `unpackEdgeError`, `StaffMember`, `CreateStaffParams`
- `@/services/orders` — admin `fetchAdminOrders` + `setOrderStatus` + `sendReadyPush`; customer `fetchOrderStatus` + `submitOrder`
- `@/services/dashboard` — `fetchDashboard` (5-query Promise.all + aggregations), `DEFAULT_DASHBOARD_STATS`
- `@/services/activity` — `fetchActivity` (audit_log read with optional entity-type filter)
- `@/services/tableSessions` — `fetchTableSessions` (per-table aggregate of active orders)
- `@/services/profile` — self-service RPCs (`updateMyDisplayName`, `uploadMyAvatar`, `removeMyAvatar`, `changeMyPassword`)
- `@/services/waiterCalls` — `fetchUnresolvedWaiterCalls`, `createWaiterCall`, `resolveWaiterCall`

### Optimistic updates

- **Use `optimisticUpdate` from `@/lib/optimistic`** for any mutation that updates local UI state before the network round-trip. Do not roll your own.
- Required fields: `apply`, `request`, `refetch`, `errorMessage`, `successMessage`, `logTag`.
- Optional `undo` + `undoRequest` together → renders an Undo button on the success toast. Pass both or neither.
- `successMessage: null` skips the toast (use for silent operations).
- `request` accepts `PromiseLike<DbResult>`, so a Supabase query builder can be returned directly without `await`.
- Undo behavior is per-id, not blanket inverse — snapshot prior state and restore each row individually.

### Realtime

- Subscribe via `useRealtimeTables({ channel, tables, onChange })` from `@/hooks/useRealtimeTables`.
- **Channel names must be globally unique.** Two components subscribing to the same channel name → `cannot add postgres_changes callbacks after subscribe()` error.
- **Rule**: if a hook is called by multiple components simultaneously, lift it into a Provider that owns the single subscription. Examples: `RestaurantSettingsProvider`, `AdminOrderPulseProvider`. Hooks read from the Provider's context.
- Existing channel names — do not reuse:
  `admin-orders`, `admin-pulse`, `admin-table-sessions`, `admin-tables`, `admin-categories`, `admin-menu-categories`, `admin-activity`, `staff-waiter-calls`, `customer-history`, `restaurant-settings`, `kitchen-display`.
- Realtime `onChange` should usually call `refetch()`. Diffing payloads is fine for hot paths but unnecessary for small result sets.

---

## State management

- **Zustand** is reserved for cross-route persistent state. Currently used for the customer cart + tableId in `src/store/useAppStore.ts`.
- `useState` for component-local state.
- React Context (Provider pattern) for state that must be shared across siblings without prop drilling — primarily Supabase realtime subscriptions that would otherwise duplicate channels.
- LocalStorage keys must use the `servio.` prefix. Examples: `servio.kitchen.sound`, `servio.admin.orderSound`, `servio.admin.menu.view`, `servio.orderHistory.v1`.

---

## UI components — use these, don't reinvent

| Need | Component | Path |
|---|---|---|
| Brand mark / logo chip | `<BrandMark className="h-N w-N" />` | `@/components/common/BrandMark` |
| Empty state surface | `<AdminEmptyState icon=... title=... />` | `@/admin/components/AdminEmptyState` |
| Segmented control / tab pill | `<SegmentedControl variant="card"|"filled" />` | `@/components/common/SegmentedControl` |
| Image upload (drag-drop + URL fallback) | `<ImageUpload value onChange prefix="items"|"banners" />` | `@/admin/components/ImageUpload` |
| Inline price edit | `<InlinePriceEdit value onSave />` | `@/admin/components/InlinePriceEdit` |
| Auth page chrome | `<AuthShell title subtitle>` | `@/admin/components/AuthShell` |
| Inline confirm row | `<ConfirmFooterRow question onCancel onConfirm />` | `@/admin/components/ConfirmFooterRow` |
| Customer empty state | `<EmptyState icon title description />` | `@/components/common/EmptyState` |

**Rules**:
- **NEVER** render `<Utensils />` from lucide as a brand mark. Use `<BrandMark />`. Lucide `Utensils` is reserved for in-data icons (e.g. menu-item placeholder).
- **NEVER** hand-roll a dashed-border empty box. Use `AdminEmptyState`.
- **NEVER** hand-roll a `bg-muted` track of pill buttons. Use `SegmentedControl`.
- **NEVER** pass a fixed `rounded-*` Tailwind class to `<BrandMark>`. The component owns its corner radius (proportional to size).
- Use the `formatPrice` helper from `@/utils` for any currency display. Currency symbol comes from `restaurant_settings`; never hardcode `₱`.

---

## Naming conventions

- Components: `PascalCase`, file matches export name.
- Hooks: `use<Name>` for hooks, `<Name>Provider` for context providers.
- Booleans: `isX`, `hasX`, `canX`. Never `xFlag` or `xBool`.
- Event handlers (props): `onX` (not `xCallback`). Internal handlers: `handleX`.
- Toast messages: terse, sentence case, no trailing period unless multiple sentences.
- DB table names: plural snake_case (`menu_items`, `audit_log`).
- Client types for DB rows: `<Name>Row` interface; mapped to `<Name>` for export.

---

## Forms

- Inputs from `@/components/ui/input` (and `Textarea`). Don't use raw `<input>`.
- Validation lives in the component (`isValid` derived from draft state). Show inline error text under the field; don't toast for field-level issues.
- Toast on submit failure (caught error). Toast on submit success only when there's no other visual feedback (e.g. modal close + list refresh is enough on its own).
- Smart suggestions pattern: derive target field from source field via `useEffect`, but **only when the target is "untouched"** — track via a `useRef<boolean>` set to true in the target's `onChange`. See `StaffCreateDialog`, `TableEditor`.

---

## Auth & permissions

- Customer routes are **anonymous** — no `AuthGuard`, no Supabase user.
- Admin/kitchen routes wrap content in `<AuthGuard allowedRoles={["admin"]}>` (or `["admin", "kitchen"]`).
- The `AuthGuard` reads `useAuth()` from `@/auth/AuthProvider` and redirects to `/admin/login?reason=...` on miss.
- Roles: `"admin" | "kitchen" | "waiter"` (waiter is reserved, no surfaces yet).
- **Never** rely on client-side role checks for security. They're for UX (hiding nav links). RLS at the DB level is the actual gate.
- Username login uses synthetic emails of form `<username>@servio.local` server-side. The Profile page hides synthetic emails from display.

---

## Routing

- Customer paths: `/`, `/menu`, `/cart`, `/checkout`, `/order-status`, `/history`.
- Admin paths: `/admin/*` (lazy-loaded chunk).
- Kitchen path: `/kitchen` (lazy-loaded chunk).
- Auth: `/admin/login`, `/admin/forgot-password`, `/admin/reset-password`.
- New admin pages: route them in `src/admin/AdminApp.tsx`, sidebar entry in `src/admin/components/Sidebar.tsx` `PRIMARY_NAV` or `SECONDARY_NAV`, palette entry in `src/admin/components/CommandPalette.tsx`'s `pages` array.

---

## Styling

- **Tailwind only.** No CSS-in-JS, no styled-components, no inline `style={{}}` except for dynamic computed values (e.g. proportional border-radius via percentage).
- Status color tokens: `info` (blue, `--info: #2D8EFF`), `success` (green, `#13CE66`), `warning` (yellow, `#FFCC3D`), `destructive` (red, `#F94949`). Use these instead of hex.
- Tinted surfaces use `/10`, `/15`, `/20`, `/25`, `/40` opacity ramps. Solid `bg-info` / `bg-success` etc. is for high-emphasis only (e.g. status pills).
- Cards: `rounded-3xl border border-border bg-card p-N`.
- Pills/chips: `rounded-full`.
- Icon containers: square with `rounded-xl` or `rounded-2xl`. Brand chips use `<BrandMark>` (proportional rounding).

### Animation

- Reuse named animations from `src/index.css`: `animate-fade-up`, `animate-pop-in`, `animate-cart-thumb`, `animate-tab-pop`, `animate-count-bump`, `animate-check-pulse`, etc.
- View Transitions API for cross-card morphs (kitchen tickets, banner reorder). Wrap state mutation in `document.startViewTransition?.(() => { ... })` with a fallback that just runs the callback.
- All animations must respect `@media (prefers-reduced-motion: reduce)` (already wired globally).

---

## Settings (restaurant-wide config)

- Read via `useRestaurantSettings()` (read context). Returns `{ settings, isLoading }` — never mutates.
- Writes via `useAdminSettings()` (admin-only). Returns `update(partial)`.
- Module-level mutable state for non-React callsites (currency symbol read by `formatPrice`) — set via `<SettingsBoot />` mounted near the App root.
- **Rule**: when adding a new setting, add it to the `restaurant_settings` migration column list, the `RestaurantSettings` type, the `DEFAULT_RESTAURANT_SETTINGS` constant, the `useAdminSettings.update` payload mapping, and surface it in `src/admin/pages/Settings.tsx`.

---

## Error handling

- Network/DB errors: caught at the call site, toasted via `toast.error("Couldn't <verb> — try again")`. Then `await refetch()` to resync from server truth.
- Validation errors: rendered inline near the offending field, never via toast.
- Console-error format: `[admin/<area>] <action> failed:` — used as the `logTag` parameter to `optimisticUpdate`.
- **NEVER** swallow errors silently. If catching to prevent UI break, also log + toast.

---

## Migrations

- Migrations live in `supabase/migrations/<NNNN>_<slug>.sql`. Sequential 4-digit prefix.
- Each migration is idempotent — use `if not exists`, `on conflict do update`, `drop policy if exists` before `create policy`, etc.
- New tables: emit `notify pgrst, 'reload schema';` at the bottom so PostgREST picks up the change.
- Add to realtime publication via the guarded pattern (see `0005_waiter_calls.sql` and `0015_audit_log.sql`).
- Always include RLS policies in the same migration as the table definition.
- Audit-relevant tables: write a trigger that inserts into `audit_log` with a human-readable summary. Skip position-only updates and zero-diff updates.

---

## Storage

- Two buckets: `avatars` (2 MB cap) and `menu-images` (5 MB cap). Both public read.
- Uploads go through helpers: `uploadStaffAvatar` (`@/lib/avatarUpload`) and `uploadMenuImage(file, prefix)` (`@/lib/menuImageUpload`).
- Both helpers do client-side validation (MIME, byte cap), resize, and re-encode before upload. **Don't** upload raw user-picked files.
- Path scheme: `avatars/staff/<userId>/avatar.png` (stable, overwriting); `menu-images/<prefix>/<uuid>.jpg` (unique, no overwrite).

---

## Web Push

- VAPID-keyed via env: `VITE_VAPID_PUBLIC_KEY` (client) + private key on the edge function.
- Customer subscribes via `subscribeToOrderPush(orderId)` from `@/lib/push` — invoked from `OrderSuccessModal` opt-in.
- Status-change → push fires from `useAdminOrders.setStatus` when status hits `"ready"` (fire-and-forget call to the `send-order-push` edge function).
- **Don't** call push subscription APIs directly — always use `@/lib/push` helpers.

---

## Imports

- Use `@/` path alias for everything under `src/`. No relative paths beyond one directory deep.
- Group imports: react → external libs → `@/` internal → relative. One blank line between groups.
- Type-only imports use `import type`.
- Lucide icons import from `lucide-react`. Group all icons in a single `import { ... } from "lucide-react"`.

---

## Anti-patterns (don't ship)

- Direct `fetch` to Supabase REST URLs.
- Hand-rolled optimistic-update plumbing (use `optimisticUpdate`).
- New realtime channels with names already in use.
- `useState` to mirror server data without a corresponding fetcher hook.
- Hardcoded `₱` or restaurant name (`"SERVIO"`) in user-facing strings — read from `useRestaurantSettings`.
- Top-level `localStorage.getItem(...)` outside lazy initializers (breaks SSR if it's ever added).
- `as any` or `@ts-ignore` to silence the type checker. Fix the type.
- Logic in `index.html`'s splash. Splash is presentational only.
- Hand-rolled segmented controls / dashed empty boxes / brand chips.
- `width:` / `height:` inline styles when a Tailwind size class would do.
- New deps without a clear, narrow need. Prefer extending existing utilities.

---

## Commit conventions

- Bundle related sub-pieces into one commit at the **feature-module boundary**, not per micro-step. (See user memory `feedback_commit_cadence`.)
- Title: imperative, ≤72 chars, no scope prefix (we don't use conventional commits).
- Body: 1-2 sentences explaining the **why**, not the what. Reference filenames + behavior, not changes.
- Always include the agent attribution trailer when committing through Claude Code.
- Never amend a published commit. Add a follow-up.
- `git add -u` for tracked files; `-A` only when adding new files we're confident about.

---

## Common pitfalls (caught here before; don't repeat)

- **`.ts` vs `.tsx`** — files containing JSX must be `.tsx` even if they're "hooks". Renaming requires clearing `node_modules/.vite` and a dev-server restart.
- **Channel name collision** — two `useRealtimeTables({ channel: "x" })` calls on the same render error out. Lift to a Provider.
- **`Promise<DbResult>` vs `PromiseLike<DbResult>`** — Supabase query builders are thenable but not structural Promises. `optimisticUpdate.request` accepts `PromiseLike` for this reason.
- **`window.print()` popup blockers** — toast a clear message when `window.open` returns `null`.
- **`auto-disable on active`** in segmented controls — the `disabled` cursor on the active option looks like a bug. Don't auto-disable; let `handleStatus` early-return when `next === current`.
- **Service worker can't read React state** — push notification fallback strings stay hardcoded; don't try to thread settings into `sw.ts`.
- **Active-pill in `rounded-2xl`** — at h-9 (36px) `rounded-2xl` (18px) becomes a perfect circle. Use proportional rounding (`%`) when chip size varies.
- **Realtime updates while editing** — Settings sections track `dirty` per section so a concurrent admin's save in another tab doesn't overwrite the in-progress text. Mirror this for any future multi-section form on a realtime-backed entity.
- **`.in("status", ["a","b"])`** in Supabase requires the column to be a real Postgres `enum` or `text`; `.not("status", "in", "(...)")` requires the parens-wrapped string form, not the array form.

---

## When adding a feature

1. Read `docs/SYSTEM.md` for context on the surrounding domain.
2. If touching the DB:
   - New migration in `supabase/migrations/`.
   - RLS in same migration.
   - Realtime publication if customer/admin needs live data.
   - Trigger for `audit_log` if it's a CRUD-able admin entity.
3. Write/extend the hook in `src/admin/use<Name>.ts(x)` (or shared/customer equivalent).
4. Use `optimisticUpdate` for mutations that paint locally.
5. Lift to a Provider if the hook will be consumed by multiple components.
6. Build the page/component using the existing primitives (`AdminEmptyState`, `SegmentedControl`, `ImageUpload`, etc.).
7. Wire route in `AdminApp.tsx`, sidebar entry in `Sidebar.tsx`, palette entry in `CommandPalette.tsx`.
8. Run `npx tsc -b` before committing — the project enforces strict type checking.
9. Manual smoke-test the golden path in the dev server before claiming done.

---

## When fixing a bug

- Identify root cause; do **not** band-aid with a `try/catch` that hides the symptom.
- If the bug is a missing edge case, add the case to `docs/SYSTEM.md` § 10.
- If the bug reveals a pattern that other places might have, sweep grep for the pattern and fix all instances in one commit.
- Don't change behavior in unrelated code paths "while you're there" — keep the diff focused.

---

## Out of scope (don't suggest unprompted)

- Adding new dependencies.
- Switching frameworks or major version bumps.
- Multi-tenant refactors.
- Native mobile shells.
- Payment integrations.
- Analytics / tracking SDKs.
- Translation / i18n (single-language for now).
