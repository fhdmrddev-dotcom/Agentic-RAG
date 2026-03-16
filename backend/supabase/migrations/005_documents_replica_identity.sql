-- Migration 005: Set REPLICA IDENTITY FULL on documents table
-- Required for Supabase Realtime to filter UPDATE events by user_id.
-- Without this, PostgreSQL WAL for UPDATE only includes the primary key,
-- so Realtime can't apply column filters and drops UPDATE events silently.

ALTER TABLE public.documents REPLICA IDENTITY FULL;
