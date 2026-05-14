-- Migration 042: document_tables.bbox + extractor columns (Phase 071 D-071-08).
--
-- bbox: JSONB shape from Docling's native BoundingBox.model_dump() — {l, t, r, b, coord_origin, page}.
-- extractor: 'docling' | 'pymupdf' | 'pypdf-legacy' — lineage tag per row.
-- Phase 071 ships the columns; per-row writes wired in Plan 02 telemetry path.

ALTER TABLE public.document_tables
  ADD COLUMN IF NOT EXISTS bbox      jsonb,
  ADD COLUMN IF NOT EXISTS extractor text;
