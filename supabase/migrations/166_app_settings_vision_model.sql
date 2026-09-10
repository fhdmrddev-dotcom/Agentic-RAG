-- SEED-226 follow-up: the vision model is a SETTING, not a hardcoded constant.
-- Apply via Supabase SQL editor — NEVER db push / db reset (CLAUDE.md).
--
-- ⚠ WHY THIS EXISTS. `backend/app/config.py` carried `vision_model: str = "gpt-4o-mini"` — a
--   specific, ageing model name pinned in code. Worse, the resolution at BOTH call sites read
--
--       env_settings.vision_model or app_settings.llm_model
--
--   and because the env default was NON-EMPTY, the `or` could never fall through. The
--   `llm_model` half was DEAD CODE: every vision call this product has ever made went to
--   gpt-4o-mini regardless of which provider the operator configured.
--
-- ⚠ NUMBER 166, NOT 157. Migrations 157-165 are RESERVED by the ROADMAP for phases 234-241
--   (231's close shifted every reservation +2 after it consumed 154/155/156). Numbers are
--   monotonic and gaps are NEVER backfilled, so this out-of-band change takes the next free
--   number ABOVE the whole reserved block rather than borrowing from Phase 234.
--
-- `vision_model` follows the `extraction_model` convention exactly (migration 072):
-- NULL / empty means "use the active chat model", never a pinned name.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS vision_model      text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vision_max_pages  integer DEFAULT 50;

COMMENT ON COLUMN public.app_settings.vision_model IS
  'Model used to transcribe scanned PDFs, drawings and uploaded images (SEED-226). '
  'NULL or empty => fall back to the VISION_MODEL env var, then to the active llm_model. '
  'Never defaults to a pinned model name.';

COMMENT ON COLUMN public.app_settings.vision_max_pages IS
  'Hard ceiling on pages transcribed per document. A document with more pages is transcribed '
  'up to this number and the shortfall is recorded in documents.metadata._vision.truncated '
  'AND stated in every chunk header, so a partial transcription can never read as complete.';
