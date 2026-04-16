-- Migration 026: user_memory table for cross-thread persistent memory (Phase 33)
-- Supports remember(key, value) upsert-by-key with case-insensitive key storage,
-- and recall(key?) retrieval. RLS: owner-only SELECT/INSERT/UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS public.user_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_memory_user_key_unique UNIQUE (user_id, key)
);

-- Index for top-N by updated_at lookups (memory injection block)
CREATE INDEX IF NOT EXISTS user_memory_user_updated_idx
  ON public.user_memory (user_id, updated_at DESC);

-- Row-Level Security: owner-only access
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own memory"
  ON public.user_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory"
  ON public.user_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory"
  ON public.user_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memory"
  ON public.user_memory FOR DELETE
  USING (auth.uid() = user_id);

-- BEFORE UPDATE trigger to keep updated_at current on every upsert conflict
-- (Required for top-10 ORDER BY updated_at DESC to reflect recent writes — Pitfall 2)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_memory_updated_at ON public.user_memory;
CREATE TRIGGER user_memory_updated_at
  BEFORE UPDATE ON public.user_memory
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
