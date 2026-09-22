-- Migration 191 — Phase 263 (PACK-17 / D-263-07, D-263-08)
-- Table: public.skills — add born_for_expert_bundle_id, the Expert-authoring provenance marker
-- No ACL statement here, deliberately: this migration creates no privilege obligation, which is the
--   only reason it stays outside scripts/check-schema-acl-parity.cjs and full-schema-supplement.sql
-- No RLS policy change: all four public.skills policies are row-scoped and cover the new column on existence
-- No historical backfill: every pre-existing row keeps NULL (retro-stamping would widen Experts to
--   skills their authors never scoped to them)

-- 1. Add born_for_expert_bundle_id column to public.skills
ALTER TABLE public.skills
    ADD COLUMN IF NOT EXISTS born_for_expert_bundle_id uuid REFERENCES public.expert_bundles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.skills.born_for_expert_bundle_id IS
    'Provenance marker for the Expert bundle a skill was authored for (D-263-07, Phase 263). NULL for every skill not born from Expert authoring, INCLUDING an abandoned draft (D-263-08). Read as the THIRD disjunct of resolve_expert_bundle''s phase-2 visibility check; the org_id fence above it is UNCHANGED.';

-- 2. Partial index for born-for lookups on skills
CREATE INDEX IF NOT EXISTS idx_skills_born_for_expert
    ON public.skills (born_for_expert_bundle_id)
    WHERE born_for_expert_bundle_id IS NOT NULL;
