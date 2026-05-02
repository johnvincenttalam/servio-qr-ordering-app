# SERVIO Anti-Abuse Design

Anonymous QR-based ordering creates a real risk of fake / prank submissions. This is a design proposal for a layered defence that makes casual abuse 10× harder, gives staff fast reactive controls, and **avoids burning real customer UX for hypothetical attackers**.

Status: **proposal**, not yet implemented.

---

## 1. Threat model

The right controls depend on what we're actually defending against. Most of what reads as "security" here is fraud / abuse, not cryptography — the kitchen has natural backpressure (a human sees every ticket) and the harm is wasted attention, not stolen money.

| Attacker | Frequency | Damage | What works |
|---|---|---|---|
| Casual prankster (drive-by submit-and-bolt) | High | Wasted kitchen time, single order | Friction + reactive cancel |
| Drunk friend / fat-finger | High | One bad order, no malice | Undo window |
| Off-premises spam (leaked sticker URL) | Low | Multiple orders, modest damage | Rate limit + presence proof |
| Competitor sabotage during rush | Rare | Real money | Capacity backpressure + staff hold |
| Cryptographic forgery | ~0 | N/A | Per-table token rotation already covers it |

The system already has 32-char hex tokens per table that staff can rotate on demand. The remaining work is targeting the top three rows.

---

## 2. Layered architecture

Five concentric layers, applied in order. Each layer trades a slice of UX friction for a category of abuse.

### Layer 1 — Presence evidence (passive, zero friction)

Already in place:
- 32-char hex QR token per table
- Token validated server-side on every fetch via RLS
- Operator-initiated rotation invalidates printed stickers

Add:
- **Per-session token** issued on first scan with `(table_id, session_id, exp)`, valid 4-6 hours
- **Auto-expire** after N hours of inactivity OR when staff marks the table as turned over
- Subsequent customer requests carry the session token, not just the QR token

**Catches**: off-premises abuse where the static URL leaks online.
**Cost**: zero.

### Layer 2 — Device binding (passive, zero friction)

- Client generates `device_id` (UUID v4 in localStorage) on first visit
- Server records `(session_id, device_id)` pair on first order from a session
- Subsequent orders from the same session but a **different** device → soft verification path
- Persistent `device_blocklist` table — staff can flag a `device_id` and all future orders from it auto-reject

**Catches**: drunk-friend-orders-for-wrong-table, repeat abusers from the same browser.
**Cost**: zero for honest customers.
**Honest caveat**: cleared localStorage = treated as a new device. Deterrence, not bulletproof identity. Promote to FingerprintJS / persistent server cookies if needed later.

### Layer 3 — Rate limiting (server-side, deterministic)

DB trigger pattern, mirroring the existing `waiter_calls` cooldown.

| Scope | Limit | Action when exceeded |
|---|---|---|
| Per table | 25 orders/hour, 100/day | Hold for staff approval |
| Per device | 10 orders/hour | Hold for staff approval |
| Per session | 5 orders in first 60 seconds | Hold (typical bot pattern) |

Numbers configurable via `restaurant_settings`. Defaults are tight enough to catch abuse, loose enough that no real table hits them in a long Sunday brunch.

**Implementation**: `before insert on orders` trigger computes the rate from `created_at` history and either raises P0001 (hard reject) or sets a `requires_review` flag (soft hold) — proposal favours the soft-hold route for review and recovery.

**Catches**: volume tail.
**Cost**: zero for normal customers.

### Layer 4 — Soft verification ladder (graduated friction)

**Don't apply by default.** Activated only when Layer 3 says so or behavioural signals fire.

| Trigger | Verification |
|---|---|
| Brand-new device on a table mid-session | Light: "Are you also at table T6?" confirm checkbox |
| Order > Nx avg ticket (configurable) | Medium: name field becomes required + 30s confirm window |
| Rate limit hit / behavioural anomaly | Strong: order goes to `pending_review`, staff approves from a banner |
| Repeat abuse from the device | Block: rejected with "ask a staff member to help" |

**SMS OTP** is the heaviest tool here. Reserve for the strongest tier and only if the venue asks for it — it adds Twilio cost and alienates anonymous customers. Most restaurants won't need it; staff approval achieves the same goal without infrastructure.

### Layer 5 — Behavioural signals (computed at submit time)

Cheap heuristics, server-side. Each signal is a flag, not a hard block. Sum into a risk score, store on the order row for post-mortem.

- **Time-since-scan < 10s** — bot or prankster (no human reads a menu in 10s)
- **Same `device_id` ordering on 3+ tables in 5 min** — device hopping
- **Order placed outside `restaurant_settings.open_for_orders`** — already gated; log for audit
- **Total > 5× the running per-table avg** — unusual basket
- **Items mostly low-margin / sold-out / weird mix** — low-value, defer until evidence

Score above threshold → escalate to soft verification (Layer 4).

### Layer 6 — Reactive staff controls (the actual safety net)

These are the highest-leverage controls — most "abuse" is recoverable when staff catches it within 30 seconds.

Add to Orders page + OrderDetail:
- **Hold for review** workflow: orders flagged by Layers 3-5 land in a banner (similar to `WaiterCallsBanner`) instead of going straight to the kitchen. Staff approves → enters kitchen flow. Rejects → cancelled with a logged reason.
- **Block this device** action on the order row → adds `device_id` to the blocklist
- **Pause table** action → toggles a per-table flag that blocks new orders without rotating the QR token (faster than rotation, reversible from the same row)

### Layer 7 — 30-second undo window (UX, but anti-abuse adjacent)

Between order submit and kitchen ticket appearance:
- Customer sees a "Order placed — cancel within 30s" banner with a Cancel button
- Kitchen display only shows the ticket after the window elapses
- Catches fat-finger mistakes AND prankster-bolts (if someone's really there for the food, they don't tap cancel)

**Cost**: 30s delay between submit and kitchen prep. Negligible — kitchens take >30s to start anyway.

---

## 3. Trade-offs

| Control | UX cost | Effectiveness | Cost | When |
|---|---|---|---|---|
| Per-session token | None | Medium | Low (dev only) | Always — easy win |
| Device binding | None | Medium | Low | Always |
| Rate-limit DB trigger | None for normal | High vs. spam | Low | Always |
| 30s undo window | Tiny | High vs. casual | Low | Always |
| Behavioural scoring | None | Medium | Medium | After Phase 1 |
| Hold-for-review | None for normal | Very high | Medium | **Critical** |
| SMS OTP | High | Very high | Medium ($) | Only if venue asks |
| Captcha (hidden Turnstile) | None | Medium vs. bots | Low | If real bot traffic appears |
| Captcha (visible) | High | Medium | Free | **Don't** — universally hated |
| Mandatory phone | Very high | High | Free | **Don't** — kills the anon UX |
| Geofencing (IP) | None | Low (urban IP unreliable) | Medium | Skip |

---

## 4. Phased implementation

### Phase 1 — Foundation (~2-3 days)

"Ship this first, covers ~80% of real abuse" set.

**Migration `0017_anti_abuse.sql`**:
- `order_sessions` table: `(id, table_id, qr_token, device_id, started_at, last_seen_at, expires_at)`
- `device_blocklist` table: `(device_id, blocked_by, reason, created_at)`
- `orders` gains:
  - `device_id text` (nullable)
  - `session_id uuid` (FK → order_sessions, nullable)
  - `requires_review boolean default false`
  - `risk_score smallint default 0`
  - `submitted_at timestamptz` (separate from `created_at` so the kitchen-visibility 30s window is independent)
- Triggers:
  - `before insert on orders` — compute risk score, set `requires_review` based on rate-limit + blocklist
  - `before insert on orders` — reject when `device_id` is on the blocklist
- RPC `start_session(table_id, qr_token, device_id)` — issues a session, rate-limited internally
- RLS: kitchen sees only `orders` where `requires_review = false AND submitted_at < now() - interval '30 seconds'`

**Client**:
- `device_id` generated on first customer load, stored in `localStorage` under `servio.deviceId`
- Sent with every customer write (order submit, waiter call)
- `useUndoWindow(orderId, deadlineMs)` hook on `OrderSuccessModal` — 30s countdown with a Cancel action that updates the order to `cancelled` if still inside the window

**Admin**:
- New **"Held orders"** banner on the Orders page (mirrors `WaiterCallsBanner`)
- Per-order **"Block device"** + **"Pause table"** actions in `OrderDetail`
- Held / blocked / paused events surface on the Activity log

This phase **does not** add OTP, captcha, or mandatory verification. Pure passive defence + reactive controls + a small UX delay.

### Phase 2 — Behavioural scoring (~1 week)

- Promote risk-score computation from "rate limit only" to the multi-signal scorer (Layer 5)
- Tunable thresholds in `restaurant_settings`
- Risk score visible on Orders page (small chip on flagged orders) for staff context

### Phase 3 — Soft verification (~1-2 weeks, if needed)

Build only if Phase 1+2 don't catch enough.

- Light tier: confirm-checkbox in checkout when triggers fire
- Medium tier: dynamic name-required + larger confirm window
- Strong tier: staff-approval queue (already in Phase 1, just promoted)
- Optional: SMS OTP via a configurable provider — gated by a setting in `restaurant_settings`

### Phase 4 — Trust score (longer term)

- Per-device historical behaviour score
- "Trusted" devices (multiple successful orders, no flags) skip soft verification
- Resets if blocklisted

---

## 5. Why we're not doing the obvious things

- **CAPTCHA on every order** — universally hated, alienates honest customers, ineffective against motivated humans (the actual threat).
- **Mandatory phone number** — kills the anonymous-by-design property that makes QR ordering low-friction in the first place. Build it in Phase 3 only if the operator explicitly asks.
- **IP geofencing** — urban IP geolocation is too noisy. False positives on customers using mobile data + VPNs would be brutal.
- **OTP-on-first-order** — same alienation issue. Reserve for the strongest tier of soft verification.
- **Hard-reject on rate-limit** — soft hold + staff approval is recoverable; hard reject loses real customers when the limit's wrong.

---

## 6. Recommendation

Ship **Phase 1** first. It's:

- Bounded scope (one migration + one hook + three admin actions)
- High signal (catches casual prank + spam + fat-finger + post-submit regret)
- Zero friction for honest customers
- Reversible (every control has a staff override)
- Operates at the layer abuse actually happens — write time

**Build OTP and CAPTCHA only when there's evidence simpler controls aren't enough.** The classic security mistake here is over-engineering for an attacker that isn't actually targeting a single restaurant's ₱500 order. Most pranksters give up after the first failed submit; most rate-limited spammers don't return.

---

**Status**: Proposal — 2026-05-02. Update or supersede when implementation lands.
