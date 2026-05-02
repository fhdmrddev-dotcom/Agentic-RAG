-- ============================================================
-- Migration 003: Drop residual OpenAI Responses API columns
-- Module 2 cleanup — these columns were used in Module 1 for
-- the OpenAI Responses API and are no longer needed.
-- Safe to run even if the columns were already dropped.
-- ============================================================

alter table public.threads drop column if exists openai_thread_id;
