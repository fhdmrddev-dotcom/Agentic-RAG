-- Phase 111: configurable metadata extraction model + window cap + enrichment reversibility (META-03)
-- + enum field_type options carrier on metadata_field_definitions (META-01, Q4 gap (a))
-- Apply via Supabase SQL editor OR psycopg2-direct to :54322 — NEVER db push/db reset (Plan 05 [BLOCKING]).
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS extraction_model            text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraction_window_cap       integer DEFAULT 32000,
  ADD COLUMN IF NOT EXISTS metadata_enrichment_mode    text DEFAULT 'enriched';

ALTER TABLE public.metadata_field_definitions
  ADD COLUMN IF NOT EXISTS options jsonb DEFAULT NULL;
