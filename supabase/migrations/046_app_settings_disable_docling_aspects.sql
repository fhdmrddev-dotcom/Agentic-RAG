-- Migration 046: disable Docling on table + equation aspects.
--
-- Why: after 045 landed, /documents/upload routed every PDF through both
-- docling_tf_tables() AND docling_formula_equations(), each calling
-- DocumentConverter.convert() with do_formula_enrichment=True and
-- images_scale=2.0. On large PDFs this rendered every page twice at 2x
-- resolution, exhausting RAM (std::bad_alloc) and blowing past
-- EXTRACTOR_DOCLING_TIMEOUT_S=120 — see backend logs 2026-05-16 and
-- memory note project_docling_quality_unproven.md.
--
-- Effect:
--   tables    -> pdfplumber       (was docling_tf)
--   equations -> none              (was docling_formula)
-- Text and images defaults are unchanged (already non-Docling).
--
-- Both the ALTER (new installs) and the UPDATE (existing singleton row)
-- are required — 010 created the row with literal defaults baked in, so
-- changing the column default alone does not retroactively update it.

ALTER TABLE public.app_settings
  ALTER COLUMN extraction_table_engine_pdf SET DEFAULT 'pdfplumber',
  ALTER COLUMN extraction_equation_engine  SET DEFAULT 'none';

UPDATE public.app_settings
SET
  extraction_table_engine_pdf = 'pdfplumber',
  extraction_equation_engine  = 'none'
WHERE id = 'global';
