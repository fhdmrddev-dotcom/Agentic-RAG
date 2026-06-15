-- 068_workspace_template_ephemeral.sql
-- Phase 100 TMPL-01: ephemeral template upload. Adds two NULLABLE columns to
-- workspace_files so existing (agent-written) rows are byte-identical (NULL kind,
-- NULL expires_at → the gated read filter `expires_at IS NULL` always passes, D-11).
-- Also adds app_settings.template_ttl_hours (D-05, default 24).
-- Apply via the Supabase SQL editor (never `db push`/`db reset`), then
-- `bash scripts/regenerate-full-schema.sh` (no reset) and commit both files.

ALTER TABLE public.workspace_files
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Permissive forward-compatible CHECK (NULL allowed; Phase 101 may add kinds).
-- Pitfall 6: a CHECK that forgot NULL would block existing-row validity.
ALTER TABLE public.workspace_files
  DROP CONSTRAINT IF EXISTS workspace_files_kind_check;
ALTER TABLE public.workspace_files
  ADD CONSTRAINT workspace_files_kind_check
  CHECK (kind IS NULL OR kind IN ('template_input', 'agent'));

-- Partial index: the sweep + the run-pin query only ever touch non-NULL expiry rows.
CREATE INDEX IF NOT EXISTS idx_workspace_files_expires_at
  ON public.workspace_files (expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN public.workspace_files.kind IS
  'Phase 100 TMPL-01. NULL/''agent'' = agent-written (permanent, byte-identical to '
  'pre-100). ''template_input'' = user-uploaded ephemeral template (TTL-bound).';
COMMENT ON COLUMN public.workspace_files.expires_at IS
  'Phase 100 TMPL-01. NULL = never expires (agent files). Non-NULL = read-path '
  'filter excludes the row once now() passes it (D-06); the lifespan sweep GCs row '
  '+ Storage bytes (D-07); kickoff run-pin extends it to cover the run (D-09).';

-- D-05: default template TTL, tunable without code (no Settings-UI work this phase).
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS template_ttl_hours integer DEFAULT 24;
COMMENT ON COLUMN public.app_settings.template_ttl_hours IS
  'Phase 100 D-05. Hours an uploaded template_input file lives before expiry. '
  'Default 24. No new RLS — app_settings is the single global-row config table.';
