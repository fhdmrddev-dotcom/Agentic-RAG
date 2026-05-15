-- Migration 047: ship camelot as the default table engine for PDF extraction
-- and reduce the allowed-values constraint to ('camelot', 'pdfplumber').
--
-- Why: Phase 071.3 D-071.3-05/07 — completes the Docling demotion started by
-- migration 046. After 046 flipped the default from 'docling_tf' to the
-- interim 'pdfplumber', the bench winner 'camelot' was selected by Plan 01
-- (see .planning/research/071.3-bench-results.md and WINNER.md for rationale).
--
-- This migration:
--   1. Drops any prior CHECK constraint (idempotency guard — migration 045 did
--      NOT add a constraint, but this DROP IF EXISTS is a safe no-op there and
--      protects environments that manually added one).
--   2. Migrates any pre-existing 'docling_tf' rows to 'pdfplumber' so the
--      new constraint does not fail on them.
--   3. Removes the column DEFAULT.
--   4. Adds CHECK constraint restricting values to ('camelot', 'pdfplumber').
--   5. Sets the new DEFAULT to 'camelot'.
--   6. Updates the singleton 'global' row to 'camelot' so the live system
--      uses the new default immediately.

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_extraction_table_engine_pdf_check;

UPDATE public.app_settings
SET extraction_table_engine_pdf = 'pdfplumber'
WHERE extraction_table_engine_pdf = 'docling_tf';

ALTER TABLE public.app_settings
  ALTER COLUMN extraction_table_engine_pdf DROP DEFAULT;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_extraction_table_engine_pdf_check
  CHECK (extraction_table_engine_pdf IN ('camelot', 'pdfplumber'));

ALTER TABLE public.app_settings
  ALTER COLUMN extraction_table_engine_pdf SET DEFAULT 'camelot';

UPDATE public.app_settings
SET extraction_table_engine_pdf = 'camelot'
WHERE id = 'global';
