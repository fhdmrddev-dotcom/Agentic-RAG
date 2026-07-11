-- Migration 098: Feature-visibility audience map (Phase 148, VIS-01)
-- Adds ONE additive JSONB column to app_settings holding per-feature audience
-- records — the substrate the `require_visible(feature)` API-layer gate and the
-- `GET /features` effective-map endpoint read through the existing per-worker 30s
-- TTL settings cache. Audience is stored as an ENUM-SHAPED RECORD
-- {"audience":"operators|everyone"} — NEVER a bare boolean — so the v3.4 org-RBAC
-- roles path (SEED-115) can extend it to {"audience":"role","roles":[...]} with
-- zero further migration. Analog: 097_operator_flags.sql (app_settings runtime
-- switches) + the existing app_settings.provider_model_lists JSONB column.
--
-- APPLY (CLAUDE.md): paste the FULL contents of this file into the LOCAL Supabase
--   SQL editor and run it. Idempotent in BOTH senses — SCHEMA (ADD COLUMN IF NOT
--   EXISTS) AND DATA (WR-03: the seed merges the day-one object UNDER the existing
--   column so a re-run preserves operator-customized audiences, never resetting them
--   to the day-one defaults). Safe to re-run.
--   NEVER `supabase db push` / `supabase db reset` — those wipe local dev data.
-- THEN: from the repo root run `bash scripts/regenerate-full-schema.sh`
--   (no --reset — a live-DB schema dump that preserves data) to rebuild
--   supabase/full-schema.sql, then commit this file + full-schema.sql together.
-- CLOUD PARITY: paste this same SQL into the CLOUD Supabase SQL editor at
--   promotion — a new app_settings column + seed is a non-code deploy half
--   (docs/DEPLOYMENT-WORKFLOW.md deploy-parity checklist). Local and cloud each
--   carry their own app_settings.global row; the D-05 seed must run in both.
--
-- Metadata-only: this migration adds a column + seeds the global row. It does NOT
-- touch any audit-table CHECK constraint. The new operator-ledger action codes
-- (user.disable / operator.grant / visibility.set / audit.export / audit.view_platform)
-- write to operator_audit_log.action, which is FREE-TEXT (no CHECK — verified mig 095);
-- the platform audit_log 19-action CHECK is READ-ONLY for Phase 148 and untouched.
--
-- Polarity (D-05 / D-06): skill_studio + model_management default to Operators-only
-- (SC#3 TRUE verbatim — no manual flip needed at deploy); workflow_authoring +
-- governance_health default to Everyone (shipped v2.9/v3.0 capabilities keep working;
-- an operator can tighten). The DB seed is belt-and-suspenders with the code
-- cold-read default (_GOVERNED_FEATURES) — a genuine cold-read still resolves each
-- feature to the same polarity.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS feature_visibility jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Ensure the global row exists (idempotent — mirrors 097 / 053 Section 3).
INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- D-05 day-one seed. Audience values are enum-shaped records, NEVER booleans.
-- WR-03 (Phase 148 review): DATA-idempotent seed. The day-one object is the BASE and the
-- existing column is merged ON TOP (`base || existing`), so any audience an operator has
-- already customized at runtime WINS — a re-run (notably the cloud-promotion paste) only
-- backfills keys that are still absent and NEVER resets a customized governance state back
-- to the day-one defaults (the silent data-loss the unconditional overwrite caused).
UPDATE public.app_settings
SET feature_visibility =
  jsonb_build_object(
    'skill_studio',       jsonb_build_object('audience', 'operators'),
    'model_management',   jsonb_build_object('audience', 'operators'),
    'workflow_authoring', jsonb_build_object('audience', 'everyone'),
    'governance_health',  jsonb_build_object('audience', 'everyone')
  ) || coalesce(feature_visibility, '{}'::jsonb)   -- existing keys win
WHERE id = 'global';
