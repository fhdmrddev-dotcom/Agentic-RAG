-- Migration 099: Model-registry deprecated state + org lock policy (Phase 149, MODEL-01/MODEL-02)
-- Adds the two schema atoms every downstream model-registry plan needs to exist first:
--   (1) model_capabilities_overrides.deprecated       — D-149-04 the "deprecated" badge state
--   (2) model_capabilities_overrides.deprecated_reason — optional operator note
--   (3) app_settings.llm_model_locked                  — D-149-07 forward-compatible lock policy flag
--
-- deprecated ≠ disabled (D-149-04): `deprecated` means the provider is sunsetting the model /
-- it vanished from live discovery — warn-and-steer, but the model can STAY enabled. `enabled`
-- alone controls availability (D-149-05 — the end-user effect of `deprecated` is a badge only).
-- llm_model_locked pins the org default beside app_settings.llm_model: one lock max, enforced in
-- app code — when the v3.4 per-user model layer arrives, locked = users cannot override the org pick.
--
-- Metadata-only: three idempotent ADD COLUMN statements. No data backfill — existing override rows
-- inherit `deprecated=false` from the column DEFAULT. No RLS policy: migration 053 already ships
-- `FOR SELECT TO authenticated USING (true)` on model_capabilities_overrides (read-all), and
-- app_settings writes are service-role only. Analog shape: 098_feature_visibility.sql.
--
-- APPLY (CLAUDE.md): paste the FULL contents of this file into the LOCAL Supabase SQL editor and
--   run it. Idempotent (ADD COLUMN IF NOT EXISTS) — safe to re-run.
--   NEVER `supabase db push` / `supabase db reset` — those wipe local dev data.
-- THEN: from the repo root run `bash scripts/regenerate-full-schema.sh` (no --reset — a live-DB
--   schema dump that preserves data) to rebuild supabase/full-schema.sql, then commit this file +
--   full-schema.sql together.
-- CLOUD PARITY: paste this same SQL into the CLOUD Supabase SQL editor at promotion — a new column
--   is a non-code deploy half (docs/DEPLOYMENT-WORKFLOW.md deploy-parity checklist). DEFERRED to the
--   standing production-push checklist (migrations 079+ already pending on cloud; do not touch cloud now).

-- ── D-149-04: deprecated state on model_capabilities_overrides ──────────────
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS deprecated boolean NOT NULL DEFAULT false;

ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS deprecated_reason text;

-- ── D-149-07: forward-compatible org-lock policy flag on app_settings ───────
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS llm_model_locked boolean NOT NULL DEFAULT false;
