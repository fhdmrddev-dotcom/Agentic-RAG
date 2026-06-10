-- 067_skill_snapshots_sibling_column.sql
-- Phase 099 GAP (UAT Test 1 / 099-07): the immutable-on-publish trigger from
-- 056 (workflow_definitions_block_published_update) raises 23514 on EVERY update
-- of a published row. The 099 D-03a first-kickoff snapshot materializer must
-- persist the materialized snapshots back to the row → guaranteed 500 at first
-- kickoff of any skill-bearing published workflow. Fix (operator-locked sibling
-- column): store materialization state in a NEW skill_snapshots column that is
-- EXEMPT from the immutability guarantee, and amend the trigger to raise ONLY
-- when an AUTHORED column changes. A published row can then change its
-- skill_snapshots column and nothing else.
--
-- Apply via the Supabase SQL editor (never `db push`/`db reset`), then
-- `bash scripts/regenerate-full-schema.sh` and commit both files.

-- ── Sibling column: materialization state, NOT authored content ──────────────
ALTER TABLE public.workflow_definitions
  ADD COLUMN IF NOT EXISTS skill_snapshots jsonb;

COMMENT ON COLUMN public.workflow_definitions.skill_snapshots IS
  'Phase 099 D-03a materialization state (derived at FIRST kickoff), NOT authored '
  'content. Keyed by phase slug → SkillSnapshot JSON. EXCLUDED from the '
  'immutable-on-publish guarantee (the amended block-published trigger lets a '
  'published row change ONLY this column). Nullable, no default; NULL until first '
  'kickoff materializes the referenced skills.';

-- ── Amended trigger function: raise ONLY when an AUTHORED column changes ──────
-- Same message text + SQLSTATE 23514 as 056 (tests/verify assert on it). The
-- authored-column set is the operator-locked allowlist: a published row may ONLY
-- change skill_snapshots (and updated_at, which the set_updated_at trigger mutates).
CREATE OR REPLACE FUNCTION public.workflow_definitions_block_published_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'published' AND (
        NEW.slug        IS DISTINCT FROM OLD.slug
     OR NEW.version     IS DISTINCT FROM OLD.version
     OR NEW.name        IS DISTINCT FROM OLD.name
     OR NEW.description  IS DISTINCT FROM OLD.description
     OR NEW.status      IS DISTINCT FROM OLD.status
     OR NEW.definition  IS DISTINCT FROM OLD.definition
     OR NEW.created_by  IS DISTINCT FROM OLD.created_by
     OR NEW.is_global   IS DISTINCT FROM OLD.is_global
     OR NEW.org_id      IS DISTINCT FROM OLD.org_id
  ) THEN
    RAISE EXCEPTION
      'workflow_definitions row % is published and immutable; create a new version instead',
      OLD.id
      USING ERRCODE = 'check_violation';   -- SQLSTATE 23514, distinguishable in tests
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger itself is unchanged (CREATE OR REPLACE re-defined the function it calls).
-- Re-create idempotently for symmetry with 056.
DROP TRIGGER IF EXISTS workflow_definitions_block_published ON public.workflow_definitions;
CREATE TRIGGER workflow_definitions_block_published
  BEFORE UPDATE ON public.workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION public.workflow_definitions_block_published_update();
