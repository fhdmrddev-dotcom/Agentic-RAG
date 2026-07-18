-- Migration 097: Operator control-plane flags (Phase 147, FLAG-01)
-- Adds three additive boolean kill-switch columns to app_settings — the substrate
-- every later FLAG-01 enforcement seam (tool gates, workflow-launch block,
-- maintenance write-block middleware) reads through the existing per-worker 30s
-- TTL settings cache. Analog: 053_settings_unification.sql:14-29 (the
-- web_search_enabled / sandbox_enabled boolean-column pattern).
--
-- APPLY (CLAUDE.md): paste the FULL contents of this file into the LOCAL Supabase
--   SQL editor and run it (idempotent, IF-NOT-EXISTS-guarded — safe to re-run).
--   NEVER `supabase db push` / `supabase db reset` — those wipe local dev data.
-- THEN: from the repo root run `bash scripts/regenerate-full-schema.sh`
--   (no --reset — a live-DB schema dump that preserves data) to rebuild
--   supabase/full-schema.sql, then commit this file + full-schema.sql together.
-- CLOUD PARITY: paste this same SQL into the CLOUD Supabase SQL editor at
--   promotion — new app_settings columns are a non-code deploy half
--   (docs/DEPLOYMENT-WORKFLOW.md deploy-parity checklist).
--
-- Polarity (D-Q4, operator-resolved 2026-07-11):
--   - Capability switches (self_improve_enabled, workflows_enabled) default TRUE so
--     runtime stays byte-identical until an operator flips one, and a cold/uninitialized
--     read never silently DISABLES a capability on a transient blip.
--   - maintenance_mode defaults FALSE (platform OPEN). Failing "closed" on a fresh /
--     cold read would be a self-inflicted outage — a truly-uninitialized read must
--     leave the platform reachable.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS self_improve_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS workflows_enabled    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS maintenance_mode     boolean DEFAULT false;

-- Ensure the global row exists (idempotent — mirrors 053 Section 3).
INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;
