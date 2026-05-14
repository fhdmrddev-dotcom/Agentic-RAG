-- Migration 040: Document extractor lineage column (Phase 071 D-071-08, Q-v2.6-04 LOCKED).
--
-- Per Q-v2.6-04: NO auto-re-extract on deploy. Backfill TAGS existing rows
-- 'pypdf-legacy' (informational only); new uploads default to EXTRACTOR_PRIMARY
-- env var ('docling' as of Phase 071).
-- T-071-01-01: idempotent — UPDATE only touches NULL rows; safe to re-run.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS extractor text;

-- One-time backfill (idempotent: only touches NULL rows)
UPDATE public.documents SET extractor = 'pypdf-legacy' WHERE extractor IS NULL;
