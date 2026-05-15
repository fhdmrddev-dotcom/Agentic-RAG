-- Migration 045: app_settings per-aspect extraction engine columns
-- (Phase 071.2 D-071.2-03).
--
-- 7 columns set the default engine per aspect. Per-call override via
-- /upload and /reextract `?engines=text:docling,tables:docling_tf,...`
-- query param remains permitted when extraction_per_call_hints_enabled=true.
--
-- Defaults follow D-071.2-02 — "strict wins ship as new defaults; legacy
-- stays first-class on text".

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS extraction_text_engine_pdf       text DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS extraction_text_engine_docx      text DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS extraction_table_engine_pdf      text DEFAULT 'docling_tf',
  ADD COLUMN IF NOT EXISTS extraction_image_engine_pdf      text DEFAULT 'pymupdf_full',
  ADD COLUMN IF NOT EXISTS extraction_image_engine_docx     text DEFAULT 'zip_xpath',
  ADD COLUMN IF NOT EXISTS extraction_equation_engine       text DEFAULT 'docling_formula',
  ADD COLUMN IF NOT EXISTS extraction_per_call_hints_enabled boolean DEFAULT true;
