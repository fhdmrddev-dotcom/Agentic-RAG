-- Migration 039: pdf_extraction_runs telemetry table (Phase 071 — RAG-DOCLING-01 SC#4).
--
-- Per-document extraction lineage: which engine ran (docling | pymupdf | pypdf-legacy),
-- when, how long, how many tables/images came out, and any error.
-- Schema spec from .planning/PRDs/v2.6.md §5 line 136 (verbatim).
--
-- D-071-08: telemetry writes happen inside ingest_document after extract completes.
-- T-071-01-03: RLS = SELECT-only `auth.uid() = user_id`; service-role writes bypass RLS by design.
-- T-071-01-06: engine column ships as plain text (no validation constraint) — keeps schema relaxed for future engines.

CREATE TABLE IF NOT EXISTS public.pdf_extraction_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine       text NOT NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms  integer,
  table_count  integer,
  image_count  integer,
  error        text
);

CREATE INDEX IF NOT EXISTS idx_pdf_extraction_runs_document_id
  ON public.pdf_extraction_runs (document_id);

CREATE INDEX IF NOT EXISTS idx_pdf_extraction_runs_user_id
  ON public.pdf_extraction_runs (user_id);

-- D-071-08 + T-071-01-03: SELECT-only RLS via auth.uid() = user_id. Backend writes
-- go through service-role and bypass RLS by design (mirror runs_table.sql:47-53).
ALTER TABLE public.pdf_extraction_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY pdf_extraction_runs_select_own
  ON public.pdf_extraction_runs FOR SELECT
  USING (auth.uid() = user_id);
