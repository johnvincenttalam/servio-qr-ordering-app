# Email setup — custom SMTP for invites & password resets

Supabase's built-in email service is rate-limited to **3–4 emails/hour
per project** on the free tier. That's fine for one-off testing but
will block real use the moment you invite more than a couple of staff
members or run multiple password resets in an hour. Configure custom
SMTP before you onboard any actual restaurant.

---

## Picking a provider

Every legitimate transactional email provider (Resend, SendGrid,
Mailgun, Postmark) **requires you to verify a domain** before they let
you send to arbitrary recipients — that's anti-spam, not their
preference. Resend's onboarding domain (`onboarding@resend.dev`) only
sends back to the account owner, so it can't deliver invites to other
staff.

Two practical paths without buying a domain yet:

| Option | Pros | Cons |
| --- | --- | --- |
| **Gmail SMTP** | Uses an account you already have, free, ~5 min setup | Emails come from your personal Gmail, ~500 recipients/day |
| **SendGrid Single-Sender** | Free 100/day, slightly more "professional" feel | Slightly more setup (verify a single email address) |

**For a single small restaurant in beta, Gmail SMTP is the most
practical choice.** Switch to Resend the day you buy a domain.

---

## Path A — Gmail SMTP (no domain required)

### 1. Enable 2-Step Verification on your Google Account

App Passwords don't work without it.

1. Go to https://myaccount.google.com/security
2. Under "How you sign in to Google", check that **2-Step
   Verification** is **On**. If not, click it and follow the prompts —
   phone-based is fine.

### 2. Generate an App Password

This is the password Supabase will use, **not** your real Gmail
password.

1. Go to https://myaccount.google.com/apppasswords (must be on a
   2FA-enabled account).
2. **App name**: `SERVIO Supabase` (anything memorable).
3. Click **Create**. A 16-character code shows up like
   `xxxx xxxx xxxx xxxx`.
4. **Copy it now** — Google won't show it again.

### 3. Wire it into Supabase

1. Supabase Dashboard → **Project Settings → Authentication → SMTP
   Settings** (or **Authentication → Emails → SMTP Settings** in
   newer UI).
2. Toggle **Enable Custom SMTP** on.
3. Fill in:

   ```
   Host:          smtp.gmail.com
   Port:          587
   Username:      your.real.gmail@gmail.com
   Password:      [the 16-char app password — strip the spaces]
   Sender email:  your.real.gmail@gmail.com
   Sender name:   SERVIO
   ```

4. Click **Save**.

### 4. Test

The previous rate-limit error was project-wide, not Gmail-specific —
once SMTP is custom you're effectively unblocked.

1. `/admin/staff` → invite a fresh email.
2. Should arrive within a minute, sender shows as **SERVIO** with
   your Gmail underneath.
3. Click the link → should land on `/admin/reset-password` → set a
   password → dashboard.

### Limits & caveats (Gmail)

- ~500 recipients/day for free Gmail; ~2000/day for Workspace.
- If Gmail flags suspicious activity it can throttle you. Send only
  legitimate transactional emails (invites, resets) — no marketing.
- The "From" address is your personal Gmail. Set the **Sender name**
  to `SERVIO` so the user-facing display still feels branded.

---

## Path B — Resend with a custom domain (production-grade)

When you buy a domain (~$12/yr at Cloudflare or Namecheap), switch to
Resend on the same day.

### 1. Buy a domain

Cloudflare Registrar (at-cost pricing, no markup) or Namecheap. Any
TLD works; `.app`, `.com`, `.menu` are all fine.

### 2. Add the domain to Resend

1. Sign up at https://resend.com (free, no card).
2. **Domains** → **Add Domain** → enter your domain.
3. Resend gives you 3–4 DNS records (SPF, DKIM, MX). Paste them at
   your registrar's DNS settings. Cloudflare's DNS UI is the cleanest
   for this.
4. Click **Verify**. Propagation usually takes 5–15 minutes.

### 3. Wire Resend into Supabase

Resend gives you SMTP credentials under **API Keys → SMTP**:

   ```
   Host:          smtp.resend.com
   Port:          587  (or 465 with SSL)
   Username:      resend
   Password:      [the API key Resend issues]
   Sender email:  noreply@yourdomain.com  (or any address @ your verified domain)
   Sender name:   SERVIO
   ```

Replace the Gmail values from Path A with these in
**Project Settings → Authentication → SMTP Settings**. Save.

### 4. Limits

- Free tier: **3,000 emails/month, 100/day**. Plenty for a single
  restaurant.
- Branded sender (`noreply@yourdomain.com`).
- Better deliverability than Gmail (proper SPF/DKIM/DMARC).

---

## Where this is used

The auth flows that send email through this SMTP config:

- **Invite a new staff member** (`admin-invite` edge function via
  `auth.admin.inviteUserByEmail`).
- **Forgot password** on `/admin/forgot-password` (uses
  `auth.resetPasswordForEmail`).
- **Email change confirmation** if you ever wire that up later.

The customer ordering flow doesn't send email, so the SMTP config
only affects staff onboarding and admin recovery.
