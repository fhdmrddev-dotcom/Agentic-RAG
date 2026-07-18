-- Migration 102: First-run install-wizard finalize flag (Phase 158, DEPLOY-02, D-05)
-- Adds one additive boolean column to app_settings — the AUDITABLE half of the D-05
-- dual finalize marker. The install wizard's finalize step (158-06) writes this flag
-- through the existing per-worker 30s TTL settings cache, read via a new
-- setup_complete() helper beside maintenance_mode(). Analog: 097_operator_flags.sql
-- (the maintenance_mode boolean-column pattern) — same shape, one column.
--
-- POLARITY (D-05): the flag is the AUDITABLE / app-facing signal ONLY, NOT the gate
--   authority. The blip-proof gate authority is the local file marker in
--   setup_store.py (`finalized:true`) — a transient DB outage must NEVER bounce a
--   live box's users back into the wizard. Defaults FALSE so a fresh box / cold read /
--   a not-yet-applied column all read "not set up" (setup_complete() fails soft to
--   False, mirroring maintenance_mode()) — never a false "configured".
--
-- APPLY (CLAUDE.md): paste the FULL contents of this file into the LOCAL Supabase
--   SQL editor and run it (idempotent, IF-NOT-EXISTS-guarded — safe to re-run), OR
--   run it via psycopg2 against 127.0.0.1:54322. NEVER `supabase db push` /
--   `supabase db reset` — those wipe local dev data.
-- THEN: from the repo root run `bash scripts/regenerate-full-schema.sh`
--   (no --reset — a live-DB schema dump that preserves data) to rebuild
--   supabase/full-schema.sql, then commit this file + full-schema.sql together.
-- NOTE (Phase 158 chain): the live apply + full-schema regen is deferred to the
--   operator-gated plan 158-12 — this plan (158-02) authors the SQL file + the
--   fail-soft reader ONLY; no live-DB operation is performed here.
-- CLOUD PARITY: paste this same SQL into the CLOUD Supabase SQL editor at promotion —
--   new app_settings columns are a non-code deploy half (docs/DEPLOYMENT-WORKFLOW.md
--   deploy-parity checklist). Append 102 to the pending cloud-parity list
--   (migs 099/100/101 + SECRETS_ENCRYPTION_KEY).

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false;

-- Ensure the global row exists (idempotent — the A6 gotcha: save_app_settings UPDATEs
-- WHERE id='global'; a missing row = silent no-op). Mirrors 097 Section 2.
INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;
