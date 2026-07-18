-- 096_org_id_stub_sweep.sql  (D-05 — v3.4 org-RBAC one-way-door prep)
-- Adds a nullable org_id metadata stub to the FOUR unambiguous owned-root tables the v3.4 org-RBAC
-- rewrite will scope: documents, folders, threads, skills.
--
-- Follows the harness_audit precedent strictly (mig 059:19,36-37): the column is METADATA-ONLY —
-- nullable, NO foreign key, NO index, NO backfill. Zero behavior change in v3.3. Deliberately does
-- NOT add idx_*_org_id indexes even though the DM-era org_id columns did (RESEARCH INDEX TENSION
-- flag) — D-05 follows the leaner harness_audit shape, not the DM shape.
--
-- Scope (RESEARCH A3, VERIFIED against full-schema.sql): ONLY the four top-level owned roots.
--   * Child tables (messages, chunks, skill_files, …) inherit org through their parent FK — NOT stubbed.
--   * workflow_definitions / workflow_runs already carry an org_id stub (prior phase) — NOT touched.
--   * user_memory / eval / tuner tables deferred to the v3.4 planner.
--
-- Split from mig 095 so the operator tables can ship/rollback independently of this metadata sweep.
-- Apply: paste into the Supabase SQL editor (never db push/db reset). Filename digits only, no suffix.

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS org_id uuid;

COMMENT ON COLUMN public.documents.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';
COMMENT ON COLUMN public.folders.org_id   IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';
COMMENT ON COLUMN public.threads.org_id   IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';
COMMENT ON COLUMN public.skills.org_id    IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';
