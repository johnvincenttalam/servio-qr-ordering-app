# SERVIO

QR-based smart restaurant ordering, built as a Progressive Web App.

Diners scan a per-table QR code, browse the menu on their phone, place an order, and watch it move through `pending → preparing → ready → served` in real time. Kitchen staff work a single-page status board; admins manage menu, tables, banners, staff, and settings from a sidebar-driven web app.

**Live**: <https://servio-qr-ordering-app.vercel.app>

---

## Quick start

```bash
# Install
npm install

# Configure env (see "Environment variables" below)
cp .env.example .env.local

# Apply Supabase migrations to your project
supabase db push        # or paste each .sql in supabase/migrations into the dashboard

# Run the dev server
npm run dev
```

The app boots at `http://localhost:5173`. Customer flow lives at `/` (with `?qr=<token>`); admin at `/admin`; kitchen at `/kitchen`.

---

## Stack

- **React 19** + **TypeScript** + **Vite 8**
- **Tailwind v4** + shadcn/ui on top of `@base-ui/react`
- **Zustand v5** for cross-route state; React Context for shared realtime subscriptions
- **Supabase**: Postgres + Row-Level Security + Realtime + Storage + Auth + Edge Functions
- **Web Push** with VAPID keys
- **PWA** via `vite-plugin-pwa` and a custom service worker
- **Sentry** error monitoring (opt-in via `VITE_SENTRY_DSN`)
- **Playwright** for golden-path E2E

Hosted on **Vercel**.

---

## Project layout

```
src/
├── pages/              # Customer routes (/, /menu, /cart, /checkout, /order-status, /history)
├── admin/              # Admin app (/admin/*) — pages, layout, hooks
│   ├── pages/
│   ├── components/
│   └── use<X>.ts(x)   # admin-only hooks
├── kitchen/            # Kitchen display (/kitchen)
├── components/
│   ├── ui/             # shadcn primitives
│   ├── common/         # cross-app shared (BrandMark, EmptyState, SegmentedControl, ...)
│   ├── menu/           # customer menu surfaces
│   ├── cart/
│   ├── checkout/
│   └── layout/
├── hooks/              # shared hooks (useRestaurantSettings, useRealtimeTables, ...)
├── lib/                # pure utilities (supabase client, optimistic helper, push, chime, ...)
├── store/              # Zustand store (cart + tableId)
├── auth/               # AuthProvider + AuthGuard
├── services/           # thin wrappers around Supabase calls
├── types/              # shared domain types
└── constants/

supabase/
├── migrations/         # numbered SQL migrations (NNNN_slug.sql)
└── functions/          # edge functions (send-order-push, ...)

docs/
├── SYSTEM.md           # full system reference (overview → schema → edge cases)
├── CODEGEN.md          # AI-optimized code-generation rules + conventions
├── PROJECT.md
└── email-setup.md
```

---

## Environment variables

Create `.env.local` from `.env.example`. Required:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `VITE_VAPID_PUBLIC_KEY` | Web Push VAPID public key (private key lives on the edge function) |
| `VITE_SENTRY_DSN` | Optional — error monitoring |

Edge function env (set in Supabase dashboard):

| Variable | Purpose |
|---|---|
| `VAPID_PRIVATE_KEY` | Used by `send-order-push` to sign payloads |
| `VAPID_SUBJECT` | `mailto:` URL identifying the sender |

---

## Migrations

All schema lives in `supabase/migrations/` as numbered SQL files. Apply them in order on a fresh project:

```bash
supabase db push
```

Or paste each into the Supabase dashboard SQL editor in order. Each migration is idempotent — safe to re-run.

Notable migrations:

- `0001_init.sql` — base schema (tables, menu_items, orders, order_items, staff, ...)
- `0009_staff_avatar.sql` — `avatars` Storage bucket + RLS
- `0014_menu_images_bucket.sql` — `menu-images` Storage bucket
- `0015_audit_log.sql` — activity-log table + per-entity triggers
- `0016_restaurant_settings.sql` — singleton config row

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Serve the build locally |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npx tsc -b` | TypeScript-only check (no build output) |

---

## Roles & access

- **Customer** — anonymous, gated by per-table QR token. No login.
- **Admin** — email or username + password. Full read/write across menu, tables, staff, settings, audit log.
- **Kitchen** — same auth, scoped to `/kitchen` + Orders. Can advance status; cannot edit menu.
- **Waiter** — reserved role, no waiter-specific surfaces ship in v1.

Auth: Supabase Auth (email/password). Username login is implemented via synthetic `<username>@servio.local` emails server-side.

---

## Documentation

| File | Purpose |
|---|---|
| [`docs/SYSTEM.md`](docs/SYSTEM.md) | Full system reference — features, workflows, schema, API, edge cases |
| [`docs/CODEGEN.md`](docs/CODEGEN.md) | AI-optimized rules and conventions for code generation (Cursor / Claude Code) |
| [`docs/PROJECT.md`](docs/PROJECT.md) | Project notes |
| [`docs/email-setup.md`](docs/email-setup.md) | Supabase email + auth configuration |

---

## Contributing

Conventions enforced by `docs/CODEGEN.md`. Highlights:

- Use existing primitives (`<BrandMark>`, `<AdminEmptyState>`, `<SegmentedControl>`, `<ImageUpload>`, `optimisticUpdate`) before adding new ones.
- Lift any `useRealtimeTables` subscription into a Provider if more than one component will consume it (channel-name collision is fatal).
- Use `optimisticUpdate` from `@/lib/optimistic` for any mutation that paints local state before the network round-trip — don't roll your own toast/refetch dance.
- Bundle related work into a single commit at the feature-module boundary, not per file.
- Run `npx tsc -b` before committing.

---

## License

Private project. Not open-source.
