-- Phase 56: Agent Real-Time Feedback
-- Migration 032: ingestion_step column on documents + messages Realtime publication

-- ============================================================
-- 1. Add ingestion_step column to documents table (D-10)
-- ============================================================
-- Nullable text — no CHECK constraint per D-10 Claude's discretion
-- (allows future stages without further migrations).
-- Backend writes one of: 'extracting', 'chunking', 'embedding', 'metadata'
-- (D-11). Column is irrelevant once status='completed'.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ingestion_step text;

-- ============================================================
-- 2. Add messages table to Supabase Realtime publication (D-14)
-- ============================================================
-- Phase 55 added this LIVE on the dev instance (commit 5a2e237) but never
-- wrote a .sql file — fresh installs would lack it. Idempotent: ADD TABLE
-- raises an error if already in publication; we use a DO
-- block to swallow that specific error.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN
  -- Already in publication — Phase 55 5a2e237 already added it; ignore.
  NULL;
END $$;

-- ============================================================
-- 3. Set REPLICA IDENTITY FULL on messages table (D-14/D-15/D-16)
-- ============================================================
-- Required for Realtime UPDATE/INSERT events to deliver the full row payload
-- including thread_id (used by the frontend filter `thread_id=eq.{threadId}`).
-- documents already has this (000_full_schema.sql line 237).
-- ALTER TABLE ... REPLICA IDENTITY FULL is idempotent in Postgres.

ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ============================================================
-- Notes
-- ============================================================
-- ingestion_step REPLICA IDENTITY: documents already has REPLICA IDENTITY FULL
-- (000_full_schema.sql line 237) so the new column is delivered in UPDATE payloads
-- automatically. No further action needed for D-12.
--
-- RLS: Existing documents and messages SELECT policies (auth.uid() = user_id)
-- already cover the new column and Realtime subscription — no new policies needed.
