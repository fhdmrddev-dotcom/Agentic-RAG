-- Migration 037: Restore messages.confidence_* columns
--
-- Regression context:
-- The columns confidence_level / confidence_avg_similarity / confidence_disclaimer were
-- defined ONLY in the retired bootstrap file supabase/migrations/000_full_schema.sql.
-- That file was moved out of the migration sequence in commit 197b53a (2026-05-02) when
-- the regenerate-full-schema.sh pipeline was introduced. Because no sequenced migration
-- (001..036) ever created these columns, the regenerated supabase/full-schema.sql lost
-- them and any fresh DB built from migrations alone was missing them.
--
-- Active runtime code that depends on these columns:
--   - backend/app/api/threads.py:1027-1029 (writes the values when an assistant message
--     completes a RAG turn)
--   - backend/app/api/knowledge_health.py:148-484 (reads them for the Low-Confidence
--     Documents and Low-Confidence Queries dashboards)
--   - backend/app/models/message.py:25-27 (Pydantic MessageResponse fields)
--
-- IF NOT EXISTS guard: idempotent — safe to re-run against environments where the
-- columns happen to already exist (e.g. a pristine DB rebuilt from the old 000 file).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS confidence_level         text,
  ADD COLUMN IF NOT EXISTS confidence_avg_similarity double precision,
  ADD COLUMN IF NOT EXISTS confidence_disclaimer    text;
