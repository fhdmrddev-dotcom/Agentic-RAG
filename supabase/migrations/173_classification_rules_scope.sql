-- 173_classification_rules_scope.sql
-- Phase 237: One Rule Engine, Not Two — RULES-01 / SC#1 / SC#3
--
-- Adds the `rule_scope` discriminator column to `public.classification_rules`:
--   * 'classification' (default): Evaluated post-extraction in `ingest_enrich.py`
--     against document metadata built-ins, custom field definitions, and source facts.
--   * 'watch': Evaluated at file arrival / preview in `preview_service.py`
--     against file arrival properties (name, path, mime, size) and source facts.
--
-- Backfills existing rows to 'classification'.
-- Constraint enforces: rule_scope IN ('watch', 'classification').
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`.
-- ============================================================================

BEGIN;

ALTER TABLE public.classification_rules
    ADD COLUMN IF NOT EXISTS rule_scope text NOT NULL DEFAULT 'classification';

-- Check constraint ensuring valid scope values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'classification_rules_scope_check'
    ) THEN
        ALTER TABLE public.classification_rules
            ADD CONSTRAINT classification_rules_scope_check
            CHECK (rule_scope IN ('watch', 'classification'));
    END IF;
END $$;

COMMENT ON COLUMN public.classification_rules.rule_scope IS
    'Evaluation scope discriminator: "watch" (evaluated on file arrival / preview) or "classification" (evaluated post-extraction).';

-- Index for efficient scope-filtered queries alongside enabled / user_id
CREATE INDEX IF NOT EXISTS classification_rules_scope_idx
    ON public.classification_rules (rule_scope, enabled);

COMMIT;
