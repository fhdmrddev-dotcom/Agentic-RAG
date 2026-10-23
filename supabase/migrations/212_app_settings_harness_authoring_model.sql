-- 212 — the workflow-drafting model becomes a Settings control (operator direction 2026-10-23:
-- every non-secret setting is controllable in the UI). Until now it was env-only
-- (HARNESS_AUTHORING_MODEL), so switching away from a provider with no credit needed an .env edit
-- and a backend restart (found at 291 UAT S1).
--
-- Mirrors 086 (harness_judge_model): a model id is a VALUE, not a secret. '' = unset; the
-- resolver then falls back to HARNESS_AUTHORING_MODEL, then to the registry defaults.
-- Additive and idempotent; no backfill, no RLS change (app_settings policies are unchanged).
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS harness_authoring_model text NOT NULL DEFAULT '';
