-- 082_threads_is_eval_flag.sql
-- Phase 134.1 (BUG-260702-01) — Evals run silently: hide eval-execution threads from the sidebar.
--
-- The eval runner (`eval_runner_service._create_eval_thread`) must create a REAL public.threads row
-- to execute the agent loop (the loop reads folder_id + history from the DB — there is no in-memory
-- path). That thread is pure EXECUTION EXHAUST: the eval's user-visible outputs live in
-- public.eval_results and render in the eval panel, NOT in the chat sidebar. Before this migration
-- those exhaust threads (title '[eval] skill A/B run') were returned by GET /threads and polluted the
-- user's chat sidebar (BUG-260702-01: 34 = 10% of all threads, half empty).
--
-- This ADDITIVE-ONLY migration adds a boolean marker so the sidebar list query
-- (backend `app/api/threads.py::list_threads`) can exclude eval-execution threads with a single
-- `.eq("is_eval", False)` filter. NON-DESTRUCTIVE: existing eval threads are FLAGGED (hidden), not
-- deleted — the transcript stays available for debugging a bad eval. Going forward the column is set
-- at insert time by `_create_eval_thread` (the column, not the title, is the source of truth).
--
-- Apply via the Supabase SQL editor OR psycopg2 against the local DB at 127.0.0.1:54322, then rebuild
--   supabase/full-schema.sql with `bash scripts/regenerate-full-schema.sh` (NO --reset — the default
--   live-DB dump preserves dev data) and commit the migration + regenerated full-schema.sql together.
--   Do NOT use `supabase db push`/`db reset` — it wipes local dev data (CLAUDE.md migration
--   discipline, D-14).

-- 1. Additive marker column. NOT NULL DEFAULT false → every existing + future REAL chat thread is
--    is_eval=false (visible); only the eval runner opts a thread OUT of the sidebar.
ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS is_eval boolean NOT NULL DEFAULT false;

-- 2. One-time backfill: flag the historical eval-execution threads (created before this column
--    existed) so they drop out of the sidebar immediately. Title is the only signal available for
--    these legacy rows (Postgres LIKE treats '[' literally — no bracket class — so '[eval]%' matches
--    the literal '[eval]' prefix). Going forward, _create_eval_thread sets the column explicitly.
UPDATE public.threads
  SET is_eval = true
  WHERE is_eval = false
    AND title LIKE '[eval]%';

-- 3. Partial index matching the sidebar hot path
--    (`WHERE user_id = ? AND is_eval = false ORDER BY updated_at DESC`). Indexing only the VISIBLE
--    rows keeps that query cheap at scale and keeps the eval exhaust out of the index entirely.
CREATE INDEX IF NOT EXISTS idx_threads_user_visible
  ON public.threads (user_id, updated_at DESC)
  WHERE is_eval = false;
