-- Daily QR token auto-rotation. The first leg of presence-proofing
-- (Phase 2 / Control 1 in docs/ANTI_ABUSE.md). A photo of the printed
-- QR sticker taken on-site stops working after the next nightly
-- rotation — the printed sticker keeps working because it routes
-- through the table id, but the qr_token query parameter validation
-- in useTableValidation will reject any URL captured before today.
--
-- Why a hardcoded UTC slot rather than a per-venue setting:
--   • Single-tenant MVP — one venue, one schedule.
--   • Chosen slot is 20:00 UTC = 04:00 PHT (Asia/Manila), the closest
--     "everyone's asleep" hour for the target market. Adjust the
--     cron expression if the venue keeps later hours; rotating
--     mid-service would lock any actively-scanning customer out
--     until they rescan, which is bad UX.
--
-- Prereq: pg_cron must be enabled. On Supabase, this is normally
-- pre-allowed but if the CREATE EXTENSION below fails, enable
-- pg_cron via Database → Extensions in the dashboard first.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Extension
-- ─────────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron;
-- pgcrypto provides gen_random_bytes(); typically pre-enabled on
-- Supabase. Guarded for self-hosted parity.
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Idempotent schedule — drop the prior job before re-scheduling so
--    re-running this migration replaces cleanly rather than failing on
--    a duplicate-name conflict.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'rotate-qr-tokens-daily') then
    perform cron.unschedule('rotate-qr-tokens-daily');
  end if;
end $$;

-- The UPDATE skips archived tables (their qr_token doesn't matter —
-- they reject anonymous customers regardless via RLS). Token format
-- mirrors the client-side generateQrToken() helper: 32-char hex,
-- 128 bits of entropy.
select cron.schedule(
  'rotate-qr-tokens-daily',
  '0 20 * * *',
  $$
    update public.tables
    set qr_token = encode(gen_random_bytes(16), 'hex')
    where archived_at is null;
  $$
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Audit-log noise note
-- ─────────────────────────────────────────────────────────────────────────
-- The existing log_tables_change trigger (0015) fires once per row,
-- so the Activity feed will show one "Table X QR token rotated"
-- entry per active table per night. Actor will be null because the
-- cron job runs without auth.uid(); the UI renders that as
-- "Someone". Acceptable for now — if it becomes a real problem the
-- trigger can be taught to batch system-driven rotations into a
-- single summary entry.

notify pgrst, 'reload schema';
