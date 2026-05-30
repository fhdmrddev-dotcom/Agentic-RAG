-- 056_workflow_definitions.sql
-- Phase 090: Harness workflow definitions — table + ownership/global RLS
--            + UNIQUE(slug, version) + immutable-on-publish trigger + one global seed.
--
-- Substrate for HARNESS-02 (versioned / immutable-on-publish). Mirrors the skills
-- ownership model (017_skills.sql) with the column renamed user_id -> created_by (D-01).
-- The block-published trigger is the ONE genuinely-new SQL artifact in this phase.
--
-- Apply via the Supabase SQL editor in order 056 -> 059 (never `db push`/`db reset`),
-- then `bash scripts/regenerate-full-schema.sh`. This file is authored only; Plan 03
-- applies it (autonomous:false) per CLAUDE.md.

-- ============================================================
-- workflow_definitions table
-- ============================================================
CREATE TABLE public.workflow_definitions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        text NOT NULL,
    version     integer NOT NULL DEFAULT 1,
    name        text NOT NULL,
    description text NOT NULL DEFAULT '',
    status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),  -- D-04
    definition  jsonb NOT NULL DEFAULT '{}',     -- phases config parsed by WorkflowDefinition.model_validate()
    created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,               -- D-01 (column is created_by, NOT user_id)
    is_global   boolean NOT NULL DEFAULT false,                                          -- D-01 / D-02
    org_id      uuid,                                                                    -- D-11 forward-compat, nullable, NO FK
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT workflow_definitions_slug_version_unique UNIQUE (slug, version)           -- D-05
);

CREATE INDEX idx_workflow_definitions_created_by ON public.workflow_definitions(created_by);
CREATE INDEX idx_workflow_definitions_slug ON public.workflow_definitions(slug);

COMMENT ON COLUMN public.workflow_definitions.org_id IS
  'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';

-- ============================================================
-- workflow_definitions RLS — skills ownership model (017_skills.sql), renamed to created_by
-- ============================================================
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and global workflow definitions"
  ON public.workflow_definitions FOR SELECT
  USING (auth.uid() = created_by OR is_global = true);

-- D-03 / T-090-06 (resolved security flag — option b, lower-risk default):
-- the INSERT WITH CHECK adds `AND is_global = false`, so a regular user can only author
-- PRIVATE definitions. Global workflows can ONLY be created by seed migrations (which write
-- directly as the SQL-editor superuser, bypassing RLS). This is stricter than the skills
-- precedent (017 lets a user self-set is_global=true) because "any user can publish a global
-- workflow everyone sees" is undesirable. The operator tier that would relax this is deferred
-- to v2.9 (D-03 / D-v2.8-01) — until then global publishing is reserved to seed migrations;
-- regular users cannot self-set is_global=true.
CREATE POLICY "Users can insert own workflow definitions"
  ON public.workflow_definitions FOR INSERT
  WITH CHECK (auth.uid() = created_by AND is_global = false);

CREATE POLICY "Users can update own workflow definitions"
  ON public.workflow_definitions FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own workflow definitions"
  ON public.workflow_definitions FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================================
-- updated_at trigger (reuses public.set_updated_at from 014_folders.sql) — for draft edits
-- ============================================================
DROP TRIGGER IF EXISTS workflow_definitions_set_updated_at ON public.workflow_definitions;
CREATE TRIGGER workflow_definitions_set_updated_at
  BEFORE UPDATE ON public.workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Immutable-on-publish trigger (NEW — D-04 / HARNESS-02)
-- Keys on OLD.status so the draft->published transition itself is allowed (OLD.status='draft');
-- once published, ALL subsequent updates raise. ERRCODE check_violation (SQLSTATE 23514) so the
-- verify script can assert on it.
-- ============================================================
CREATE OR REPLACE FUNCTION public.workflow_definitions_block_published_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION
      'workflow_definitions row % is published and immutable; create a new version instead',
      OLD.id
      USING ERRCODE = 'check_violation';   -- SQLSTATE 23514, distinguishable in tests
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workflow_definitions_block_published ON public.workflow_definitions;
CREATE TRIGGER workflow_definitions_block_published
  BEFORE UPDATE ON public.workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION public.workflow_definitions_block_published_update();

-- ============================================================
-- One minimal valid global seed (D-02) — references the 018 seed system user.
-- This single seed doubles as the WorkflowDefinition.model_validate() fixture (RESEARCH OQ1 / SC#5).
-- The real 2-3 templates (HARNESS-07) are Phase 091's job — this only proves the seed MECHANISM
-- and gives the 090-01 unit test a parseable row. Ships status='published' so the block-published
-- trigger then freezes it (correct per D-04). The `definition` jsonb is the FULL WorkflowDefinition
-- shape (slug/version/name/status/phases[]) so model_validate(row["definition"]) parses cleanly.
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000a0',
  'research-summarize', 1, 'Research -> Summarize', 'published',
  '{
    "slug": "research-summarize",
    "version": 1,
    "name": "Research -> Summarize",
    "status": "published",
    "phases": [
      {
        "slug": "summarize",
        "phase_index": 0,
        "config": {
          "phase_type": "llm_single",
          "prompt": "Summarize the user request into a short research brief."
        },
        "validators": []
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',   -- seed system user from 018_skill_creator_seed.sql
  true                                        -- D-02: global
)
ON CONFLICT (id) DO NOTHING;
