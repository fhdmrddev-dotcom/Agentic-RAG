-- Migration 020: Add source_refs JSONB column to messages
-- Stores source document references from search_documents / analyze_document tool calls
-- so that reloaded conversations can show the sources bar.

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS source_refs jsonb;
