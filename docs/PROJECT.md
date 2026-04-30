# SERVIO — Project Reference

A QR-based restaurant ordering PWA. A customer scans a QR code on their table, lands on the app with a `?t=<tableId>` query, browses the menu, customizes items, places an order, and watches its status. The kitchen / staff side is **not built yet** — this document also sketches how it would integrate.

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind v4 (`@tailwindcss/vite`), CSS variables for tokens |
| Font | Outfit Variable (`@fontsource-variable/outfit`) |
| State | Zustand v5 with `persist` middleware → `sessionStorage` |
| Routing | React Router v7 (`BrowserRouter`) |
| UI primitives | shadcn/ui on top of `@base-ui/react` |
| Icons | `lucide-react` |
| Toasts | `sonner` |
| PWA | `vite-plugin-pwa` (Workbox-based service worker, manifest) |

---

## 2. Folder Structure

```
src/
├── App.tsx                         # Routes + splash dismiss hook
├── main.tsx                        # React mount
├── index.css                       # Design tokens, base, animation keyframes, utilities
│
├── components/
│   ├── cart/
│   │   ├── CartFooter.tsx          # Sticky bottom CTA on /cart
│   │   ├── CartItemRow.tsx         # Cart line: image, name, selections, qty stepper
│   │   └── CartSummary.tsx         # Itemized list + total (used in Checkout)
│   │
│   ├── checkout/
│   │   └── OrderSuccessModal.tsx   # Animated check + Track Order CTA
│   │
│   ├── common/
│   │   ├── EmptyState.tsx          # Icon block + heading + body + optional CTA
│   │   └── ReloadPrompt.tsx        # PWA update banner (vite-plugin-pwa)
│   │
│   ├── layout/
│   │   ├── AppLayout.tsx           # Header + main + Toaster + FlyToCartProvider
│   │   └── Header.tsx              # Brand mark, table chip, cart icon
│   │
│   ├── menu/
│   │   ├── PromoCarousel.tsx       # Hero scroll-snap banner carousel + dot indicators
│   │   ├── TopPicksStrip.tsx       # Horizontal scroll of "Top Picks" mini cards
│   │   ├── MenuSearchBar.tsx       # Spotlight-style search input
│   │   ├── CategoryTabs.tsx        # Icon-only inactive / icon+label active pills
│   │   ├── MenuGrid.tsx            # 2-col grid; staggers card fade-up
│   │   ├── MenuItemCard.tsx        # Tile in the grid (image, name, price chip, +)
│   │   ├── MenuItemModal.tsx       # Item detail + options + qty + Add CTA
│   │   ├── MenuSkeleton.tsx        # Skeleton matching the live page section-for-section
│   │   └── FlyToCart.tsx           # Provider + portal for fly-to-cart animation
│   │
│   ├── order/
│   │   └── AnimatedStatusIcon.tsx  # Per-status animated icon (clock/chef/check)
│   │
│   └── ui/                         # shadcn primitives (button, card, dialog, etc.)
│
├── constants/
│   ├── index.ts                    # VALID_TABLE_IDS, currency, category/status labels
│   ├── menu-data.ts                # Mock menu items
│   └── banners.ts                  # Mock promo banners
│
├── hooks/
│   ├── useMenu.ts                  # Fetches menu + categories
│   ├── useOrderStatus.ts           # Polls order status
│   └── useTableValidation.ts       # Reads `?t=`, validates, sets store, redirects
│
├── lib/
│   └── utils.ts                    # `cn()` helper
│
├── pages/
│   ├── Home/index.tsx              # /  – table validation / welcome / invalid
│   ├── Menu/index.tsx              # /menu
│   ├── Cart/index.tsx              # /cart
│   ├── Checkout/index.tsx          # /checkout
│   └── OrderStatus/index.tsx       # /order-status
│
├── services/
│   ├── menu-service.ts             # Mock: fetchMenu, fetchCategories, fetchMenuItem
│   └── order-service.ts            # Mock: submitOrder, fetchOrderStatus (in-memory map)
│
├── store/
│   └── useAppStore.ts              # Zustand store + lineIdOf helper
│
├── types/
│   └── index.ts                    # All shared TS types
│
└── utils/
    └── index.ts                    # isValidTableId, formatPrice

public/
├── favicon.svg
├── icons/                          # PWA icons (192/512)
└── images/halo-halo.png            # Locally-hosted product image (transparent PNG)

index.html                          # Pre-React HTML splash + inline CSS keyframes
docs/
└── PROJECT.md                      # This file
```

---

## 3. Routing & Customer Flow

```
                    ┌──────────────────┐
QR scan: /?t=T1 ──▶ │ HomePage (/)     │ useTableValidation
                    │  – validates     │   ├─ valid → setTableId + redirect /menu
                    │  – welcome anim  │   └─ invalid → "Invalid Table" UI
                    └──────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │ MenuPage (/menu) │ Carousel + Top Picks + Search +
                    │                  │ Categories + Grid + sticky View Cart
                    └──────────────────┘
                            │  tap View Cart
                            ▼
                    ┌──────────────────┐
                    │ CartPage (/cart) │ List of CartItemRows + sticky CartFooter
                    └──────────────────┘
                            │  Proceed to Checkout
                            ▼
                ┌──────────────────────┐
                │ CheckoutPage         │ Name + Notes + Order Summary + sticky CTA
                │ (/checkout)          │ submitOrder → OrderSuccessModal
                └──────────────────────┘
                            │  Track Order
                            ▼
                ┌──────────────────────┐
                │ OrderStatusPage      │ Animated status icon (pending/preparing/
                │ (/order-status)      │ ready) + step indicator + Order Again
                └──────────────────────┘
```

### Sticky stack
- **Header** (z-50): full-width white bar with bottom hairline, sits at `top-0`
- **CategoryTabs** (z-40): sticky at `top-[64px]` so it stays visible while the grid scrolls
- **Bottom CTAs** (z-50): every page that has a primary action uses a `fixed bottom-0` bar inside `max-w-md/lg/xl` — `pb-36` on `<main>` reserves space so the last row never hides behind it

---

## 4. Data Model (`src/types/index.ts`)

```ts
type MenuCategory = "meals" | "drinks" | "desserts" | "sides";
type OrderStatus  = "pending" | "preparing" | "ready";

interface MenuOptionChoice {
  id: string;
  name: string;
  priceDelta?: number;   // optional surcharge added to base price
}

interface MenuOption {
  id: string;
  name: string;          // "Size", "Add Rice"
  type: "single" | "multi";
  required?: boolean;
  choices: MenuOptionChoice[];
}

interface MenuItem {
  id: string;
  name: string;
  price: number;         // base price
  image: string;         // remote URL or /images/...
  category: MenuCategory;
  description: string;
  topPick?: boolean;     // surfaced in TopPicksStrip
  inStock?: boolean;     // false → grayed out, "Sold out" chip, no add
  options?: MenuOption[];
}

interface CartItemSelection {
  optionId: string;
  optionName: string;
  choiceId: string;
  choiceName: string;
  priceDelta: number;
}

interface CartItem {
  lineId: string;        // composite: "<itemId>" or "<itemId>::<sortedOptionChoiceIds>"
  itemId: string;
  name: string;
  basePrice: number;
  unitPrice: number;     // basePrice + sum(selections.priceDelta)
  quantity: number;
  image: string;
  selections: CartItemSelection[];
}

interface Order {
  id: string;            // "ORD-<base36-timestamp>"
  tableId: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  customerName?: string;
  notes?: string;
  createdAt: number;
}

// Promo banners (separate from menu items)
interface PromoBanner {
  id: string;
  image: string;
  title?: string;
  subtitle?: string;
}
```

### Why `lineId` (composite key)?
The same dish with different selections must be **separate cart entries**:
- `meal-3` (Pork Adobo, no rice) → lineId `"meal-3"`
- `meal-3` + Garlic rice → lineId `"meal-3::rice:garlic-rice"`

`lineIdOf(itemId, selections)` (in `useAppStore.ts`) sorts selections deterministically so `(rice + spice)` and `(spice + rice)` collapse to the same line.

---

## 5. State Management (`src/store/useAppStore.ts`)

Zustand store, persisted to `sessionStorage` under key **`servio-session-v2`** (the v2 suffix invalidated old shape from before `lineId`).

```ts
interface AppState {
  tableId: string | null;
  cart: CartItem[];
  currentOrderId: string | null;

  setTableId(id): void;
  addToCart(item: { id, name, price, image }, selections, quantity): void;
  removeFromCart(lineId): void;
  updateQuantity(lineId, quantity): void;  // quantity ≤ 0 → removes
  clearCart(): void;
  setCurrentOrderId(id): void;
  getCartTotal(): number;                  // computed from unitPrice × quantity
  getCartItemCount(): number;              // sum of quantity
}
```

### Subscription gotcha
Selectors that return a **function reference** (`(s) => s.getCartItemCount`) never trigger re-renders because the function ref is stable. Always **invoke** the getter inside the selector:

```tsx
// ✅ re-renders when cart changes
const itemCount = useAppStore((s) => s.getCartItemCount());

// ❌ won't re-render
const getCount = useAppStore((s) => s.getCartItemCount);
const itemCount = getCount();  // stale
```

This bug already bit us once — see `Header.tsx` and `Menu/index.tsx`.

---

## 6. Mock Services

Both files in `src/services/` simulate latency with `setTimeout`. **All in-memory, all client-side** — meaning order data dies on refresh.

### `menu-service.ts`
- `fetchMenu()` → returns `MENU_ITEMS` (from `constants/menu-data.ts`)
- `fetchCategories()` → derives from `CATEGORY_LABELS`
- `fetchMenuItem(id)` → array find

### `order-service.ts`
- Maintains a `Map<string, Order>` in memory
- `submitOrder()` → generates `ORD-<base36>` id, stores, returns
- `fetchOrderStatus(id)` → progresses status by elapsed time:
  - 0–10s → pending
  - 10–20s → preparing
  - 20s+ → ready
- `useOrderStatus(id)` polls this every few seconds

**For real backend** — replace these two files with API/Supabase calls. The hook contracts (`useMenu`, `useOrderStatus`) don't need to change.

---

## 7. Design System

### 7.1 Color tokens (`src/index.css`, oklch)

| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.98 0 0)` | page bg (off-white) |
| `--foreground` | `oklch(0.18 0 0)` | text, icons, CTA bg |
| `--card` | `oklch(1 0 0)` | white surfaces, header |
| `--muted` | `oklch(0.96 0 0)` | secondary blocks, status pills, search bar |
| `--muted-foreground` | `oklch(0.5 0 0)` | secondary text |
| `--border` | `oklch(0.92 0 0)` | hairlines |
| `--destructive` | `oklch(0.62 0.22 25)` | iOS-system red — **only used for cart trash icon** |

The palette is **fully grayscale** except for `--destructive`. No gradients. No shadows. No glows. Depth comes from borders and color contrast.

### 7.2 Radii scale

`--radius: 0.625rem` (10px). Tailwind utilities derive from it:
- `rounded-md` ≈ 8px (small buttons, quantity chips)
- `rounded-xl` ≈ 14px (inputs)
- `rounded-2xl` ≈ 18px (cart row image, top-pick image)
- `rounded-3xl` ≈ 22px (cards, sections, banners, modals)
- `rounded-full` (every CTA pill, every icon button, dot indicators)

### 7.3 Typography (Outfit Variable)

- Body: 14–16px, weight 400–500
- Bold (semantic emphasis): weight 600 (`font-semibold`)
- Headings: weight 700 (`font-bold`), `letter-spacing: -0.025em` set globally on h1–h3
- Avoid `font-extrabold` except for the cart total (`text-xl font-bold` is plenty for headings)

### 7.4 Spacing & layout

- Page wrap: `mx-auto max-w-md sm:max-w-lg lg:max-w-xl` — content stays narrow on tablet/desktop. Header's bg spans full viewport via `-mx` trick.
- Page padding: `px-4 pt-4 pb-36` on `<main>` — pb-36 = 144px reserves space for sticky bottom CTAs (cart footer is ~129px tall).
- Edge-bleed sections (`-mx-4`) — Carousel, Top Picks, Categories — extend to viewport edge but inner scroll content has its own `px-4` to align with the page grid.

### 7.5 Animations (`src/index.css` `@layer utilities`)

| Class | Keyframe | Where used |
|---|---|---|
| `animate-fade-up` | translateY(8 → 0) + opacity | menu cards, sections, modal content |
| `animate-pop-in` | scale(0.6 → 1.15 → 1) | cart badge when count changes |
| `animate-check-circle` | stroke-dashoffset 151 → 0 over 600ms | order success modal, Ready status |
| `animate-check-mark` | stroke-dashoffset 50 → 0 (350ms, 500ms delay) | same |
| `animate-check-pulse` | scale 1 → 1.06 → 1 (one-shot at 850ms) | order success modal |
| `animate-clock-hour` | rotate 360° / 8s linear infinite | Pending status icon |
| `animate-clock-minute` | rotate 360° / 2s linear infinite | Pending status icon |
| `animate-steam-1/2/3` | translateY + scaleY + opacity (staggered 600ms) | Preparing chef hat steam |
| `animate-ready-glow` | scale 1 → 1.04 → 1 (loop, 1.4s delay) | Ready status icon |
| `animate-fly-to-cart` | translate(--dx,--dy) + scale(0.18) + arc | tap `+` on a card or modal |
| `animate-tab-pop` | scale 0.7 → 1.2 → 1 + rotate spring | category tab activation |

**Splash animations** live inline in `index.html` and are scoped to `#app-splash` — they use vanilla CSS with `pathLength="100"` so the splash works before the JS bundle parses. The dismiss is staged in `App.tsx` (`useDismissSplash`): minimum **1800ms** so the intro animation completes, then a 380ms fade-out.

`prefers-reduced-motion` is honored for the **fly-to-cart** trigger (skipped entirely) and the **splash** (animations disabled, final state shown).

---

## 8. Features Inventory (what works today)

### Customer-facing
- ✅ QR table validation (`?t=T1`–`T10`, see `VALID_TABLE_IDS`)
- ✅ Promo banner carousel (3 sample banners, scroll-snap, dot indicators, no auto-rotate)
- ✅ Top Picks horizontal strip (driven by `topPick: true` flag)
- ✅ Menu search (matches name + description)
- ✅ Category filtering (icon-only inactive, icon+label active, hides during search)
- ✅ Item customization (single-select options, required/optional, price deltas)
- ✅ Out-of-stock state (visual + Add disabled)
- ✅ Cart line dedup by composite `lineId`
- ✅ Quantity stepper with red trash on quantity = 1
- ✅ Checkout with optional name + special instructions
- ✅ Animated order-placed success modal
- ✅ Order status with animated icons + step indicator + auto-progressing mock status
- ✅ Fly-to-cart animation from menu cards, top picks, and the modal
- ✅ Pre-React HTML splash + matching HomePage hand-off
- ✅ PWA installable + offline shell (vite-plugin-pwa)

### Not built
- ❌ Real backend (orders die on refresh)
- ❌ Payments
- ❌ Push notifications ("Your order is ready")
- ❌ Wait time estimation
- ❌ Call waiter / request bill
- ❌ Order edit / cancel grace window
- ❌ Multi-select option types (data model supports `"multi"` but UI only renders single-select)
- ❌ Allergen / dietary filters
- ❌ Multi-language
- ❌ Auth (no users yet — table id is the only identity)

---

## 9. Conventions & Decisions Worth Knowing

1. **No shadows or glows.** Depth comes from borders, color contrast, and motion. Even rings (which use box-shadow underneath) are used sparingly.
2. **Grayscale + one exception (red).** Adding any other color is a breaking design decision — discuss before doing it. The red is reserved for destructive actions only.
3. **Edge-bleed pattern** for any horizontally-scrolling section: parent has `-mx-4`, inner scroll container has `px-4 snap-x snap-mandatory`. Keeps the peek effect while content aligns to the page grid.
4. **Bottom CTA pattern**: `fixed bottom-0` inside a `max-w` wrapper so it doesn't overflow on tablet/desktop; reserve space with `pb-36` on `<main>`.
5. **State persistence**: zustand `sessionStorage` (cleared on tab close — appropriate for table-bound sessions). Bump the persist key (`servio-session-v2` → `v3` etc.) when changing `CartItem` shape.
6. **Customizable items skip quick-add.** If a `MenuItem` has any `options`, the card `+` button opens the modal so the user can configure (no silent quick-add with defaults).
7. **Image source convention**: anything from Unsplash is hot-linked (works for a demo); local PNGs (transparent for cartoon-style featured items) live in `public/images/`.
8. **Persisted state migration**: when CartItem schema changes, **bump the `persist.name`** rather than writing a migration function. This is a low-stakes app and a wiped session is fine.

---

## 10. Roadmap Toward an Admin / Kitchen App

The customer app is roughly feature-complete. The biggest gap is the **other side** — staff need to receive orders and manage the menu. Here's a proposed shape:

### 10.1 Repository structure — keep it in this project

**Recommendation: build admin and kitchen inside this same repo, route-split with lazy loading.** The customer and admin sides will share types, design tokens, UI primitives, and the Supabase client; duplicating any of those across repos costs more in drift and inconsistency than the cleanliness buys.

```tsx
// src/App.tsx — sketch
const AdminApp   = lazy(() => import("@/admin/AdminApp"));
const KitchenApp = lazy(() => import("@/kitchen/KitchenApp"));

<Routes>
  {/* Customer shell — current AppLayout */}
  <Route element={<AppLayout />}>
    <Route path="/"             element={<HomePage />} />
    <Route path="/menu"         element={<MenuPage />} />
    <Route path="/cart"         element={<CartPage />} />
    <Route path="/checkout"     element={<CheckoutPage />} />
    <Route path="/order-status" element={<OrderStatusPage />} />
  </Route>

  {/* Admin / Kitchen — own layouts, own auth, own chunks */}
  <Route path="/admin/*"   element={<Suspense fallback={<SplashFallback />}><AdminApp /></Suspense>} />
  <Route path="/kitchen/*" element={<Suspense fallback={<SplashFallback />}><KitchenApp /></Suspense>} />
</Routes>
```

Folder layout when admin lands:

```
src/
├── (everything below stays the customer app)
├── admin/                # admin-only pages, layout, auth guard
│   ├── AdminApp.tsx
│   ├── AdminLayout.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── MenuManager.tsx
│   │   ├── Orders.tsx
│   │   └── Banners.tsx
│   └── components/...
├── kitchen/              # kitchen display
│   ├── KitchenApp.tsx
│   └── ...
└── shared/               # things both customer and admin need
    └── ... (types, services already in src/types and src/services — likely just expand those)
```

**Why this and not a separate repo or a monorepo (yet):**

| | Single SPA + lazy routes (recommended) | Monorepo (pnpm/Turborepo) | Separate repos |
|---|---|---|---|
| Type sharing | trivial | trivial via `packages/types` | needs published package or codegen |
| Design system drift | impossible | low risk | high risk |
| Bundle size for customer | small (lazy) | small (separate apps) | small |
| Deploy cadence | coupled | independent | independent |
| Setup overhead | none | medium | high |
| Best when | small team, single product | growing team or apps diverge | regulatory / org reasons demand it |

**Migrate later if either of these becomes true:**
- Admin needs server-side rendering (Next.js) while customer stays a pure SPA
- Customer and admin have to ship on different cadences (e.g., admin gets feature-flagged previews you don't want anywhere near customers)
- The bundle gets large enough that lazy-loading isn't enough (which would be bizarre for an app this size)

The cleanest intermediate step is a **monorepo** (`apps/customer`, `apps/admin`, `apps/kitchen` + `packages/types`, `packages/ui`). Don't preemptively reach for it.

### 10.2 Suggested route split

```
/                         (customer)  ──┐
/menu                     (customer)    │  current app
/cart                     (customer)    │  (table-id auth)
/checkout                 (customer)    │
/order-status             (customer)  ──┘
─────────────────────────────────────────
/admin/login              (auth)
/admin/menu               (admin)     ──┐  password / staff auth
/admin/orders             (admin)       │
/admin/banners            (admin)     ──┘
─────────────────────────────────────────
/kitchen                  (staff)        kitchen display, big tickets,
                                         optimized for an iPad in landscape
```

Customer routes stay table-id-authenticated (no login). Admin/kitchen routes need real auth — recommend **Supabase Auth** (email + password is enough for a single restaurant; can add magic links later).

### 10.3 Suggested backend

**Supabase** is the highest-leverage choice:
- Postgres with row-level security
- Built-in Auth
- **Realtime subscriptions** — admin/kitchen views auto-update when orders come in
- Storage for menu images
- TypeScript client with generated types

Replacement plan:
- `services/menu-service.ts` → `supabase.from('menu_items').select(...)`
- `services/order-service.ts` → `supabase.from('orders').insert(...)` + a realtime channel for status changes
- `useOrderStatus` → swap polling for `supabase.channel().on('postgres_changes', ...)`

### 10.4 Suggested schema (Postgres / Supabase)

```sql
-- tables (the physical ones)
create table tables (
  id text primary key,             -- "T1", "T2"
  label text not null,             -- "Table 1"
  qr_token text unique             -- optional: rotates so old QRs can be revoked
);

-- menu items
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  image text not null,
  category text not null check (category in ('meals','drinks','desserts','sides')),
  description text not null,
  top_pick boolean default false,
  in_stock boolean default true,
  options jsonb,                   -- MenuOption[] — keep as JSON for flexibility
  position int default 0,          -- ordering on the menu
  archived_at timestamptz          -- soft delete
);

-- promo banners (managed by admin)
create table banners (
  id uuid primary key default gen_random_uuid(),
  image text not null,
  title text,
  subtitle text,
  position int default 0,
  active boolean default true
);

-- orders
create table orders (
  id text primary key,             -- "ORD-..."
  table_id text references tables(id),
  status text not null check (status in ('pending','preparing','ready','served','cancelled')) default 'pending',
  total numeric(10,2) not null,
  customer_name text,
  notes text,
  created_at timestamptz default now(),
  ready_at timestamptz             -- set when status flips to 'ready' (for wait-time calc)
);

-- order line items (denormalized: snapshot of what was ordered)
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text references orders(id) on delete cascade,
  line_id text not null,           -- composite from useAppStore
  item_id uuid references menu_items(id),
  name text not null,              -- snapshot in case the menu item is renamed later
  base_price numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  quantity int not null,
  image text not null,
  selections jsonb                 -- CartItemSelection[]
);

-- staff (admin/kitchen access)
create table staff (
  user_id uuid primary key references auth.users(id),
  role text check (role in ('admin','kitchen','waiter')) not null
);
```

Suggested RLS:
- `menu_items`, `banners`: anyone can `select` (for the customer app); only staff with role `admin` can mutate
- `orders`, `order_items`: anyone can `insert` (customer placing an order); only staff can `select`/`update`
- Customer status read needs a separate path — e.g., a Supabase Edge Function that takes `order_id` and returns the status, or a public `select` policy keyed on `order_id` (long, hard-to-guess id is fine for this app's threat model).

### 10.5 Admin UI sketch

- **`/admin/menu`** — Reuse `MenuGrid` + `MenuItemCard` in "manage" mode (long-press / right-click → edit drawer). Toggle in-stock with a switch on each card. Drag to reorder. Add a + FAB for new items. Modal for options editor.
- **`/admin/orders`** — A list view. Each order is a card with: status pill, table chip, items, total, age. Status dropdown to advance manually. Filter by status / table / date.
- **`/admin/banners`** — Drag-reorder list, image upload to Supabase Storage, title/subtitle inputs, active toggle.
- **`/kitchen`** — Big-ticket display optimized for landscape. One big card per active order with: table number (huge), all line items, special instructions highlighted, swipe-to-progress (pending → preparing → ready). Auto-scroll horizontally if more than fit. Sound on new order.

### 10.6 Push notifications ("Your order is ready")

The PWA scaffold already supports this. When status flips to `ready`:
- Send a Web Push from the backend to the customer's subscribed endpoint
- Subscription was captured when the customer placed the order (ask permission right after Place Order — very high conversion at that moment)

This is the killer feature — customers can put their phone away while waiting.

---

## 11. Quick Reference: Common Tasks

### Add a new menu item
Edit `src/constants/menu-data.ts`, add an entry. To make it customizable, give it `options: [...]`. To make it the day's featured pick on the carousel, edit `src/constants/banners.ts` instead (banners and menu items are independent now — featured used to be a flag on `MenuItem` but was removed).

### Add a new table
Add the id to `VALID_TABLE_IDS` in `src/constants/index.ts`.

### Bump the cart safe area
Change `pb-36` on `<main>` in `AppLayout.tsx`. Don't add bottom padding to individual pages.

### Add a new animation
Add a `@keyframes` + `.animate-...` class inside `@layer utilities` in `src/index.css`. Use `cubic-bezier(0.34, 1.56, 0.64, 1)` for spring/bounce effects (this is the same easing the splash, cart badge, and tab-pop all use).

### Force a fresh cart on schema change
Bump the `persist.name` in `useAppStore.ts` (e.g., `servio-session-v2` → `v3`).
