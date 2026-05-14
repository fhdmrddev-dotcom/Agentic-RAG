-- Migration 041: document_images.bbox JSONB column (Phase 071 D-071-08).
--
-- Populated by Docling / PyMuPDF extractors via ExtractedDocument.images[i].bbox.
-- Phase 071 lands the column; LegacyExtractor path leaves bbox NULL.
-- Phase 072 (RAG-MM-LIFT-01/02) will refactor extract_and_store_images to
-- consume pre-extracted lists at which point bbox flows through for Docling/PyMuPDF.

ALTER TABLE public.document_images
  ADD COLUMN IF NOT EXISTS bbox jsonb;
