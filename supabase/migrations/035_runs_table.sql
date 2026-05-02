-- Migration 035: per-run lifecycle metadata for run-backed streaming
-- Phase 061 (D-v2.5-08, D-v2.5-11). Companion to the ephemeral Redis
-- Stream `run:{run_id}` (TTL 10 min completed / 60s failed). This table
-- is the durable record — survives Redis TTL expiry — for audit,
-- debugging, and future billing/usage UI.
--
-- D-061-05: PK = run_id uuid DEFAULT gen_random_uuid() (server-generated).
-- D-061-06: FK CASCADE on both thread_id (→ public.threads) and user_id
--           (→ auth.users). message_id is ON DELETE SET NULL because the
--           audit row should outlive a deleted message (planner deviation
--           recorded in 061-02-PLAN.md; D-061-06 itself only locks
--           thread_id + user_id behavior).
-- D-061-07: two indexes — partial idx_runs_active for the active-runs hot
--           path (Phase 062), composite idx_runs_history for audit/billing.
-- D-061-08: RLS — SELECT-only policy `runs_select_own` (auth.uid() = user_id).
--           No INSERT/UPDATE/DELETE policies; backend uses service-role
--           which bypasses RLS for all writes.
-- D-061-09: status enum enforced via CHECK constraint (4 values verbatim).

CREATE TABLE IF NOT EXISTS public.runs (
  run_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id    uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  status        text NOT NULL CHECK (status IN ('streaming','completed','failed','cancelled')),
  model         text NOT NULL,
  provider      text NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  input_tokens  integer,
  output_tokens integer,
  error         text
);

-- D-061-07 partial index: tiny because 99.9% of rows are terminal.
-- Serves the active-runs hot path that Phase 063's frontend hits on
-- every (re)connect.
CREATE INDEX IF NOT EXISTS idx_runs_active
  ON public.runs (user_id, thread_id, status)
  WHERE status = 'streaming';

-- D-061-07 composite index: serves run-history queries (audit, debugging,
-- future billing/usage UI).
CREATE INDEX IF NOT EXISTS idx_runs_history
  ON public.runs (user_id, thread_id, started_at DESC);

-- D-061-08: SELECT-only RLS via auth.uid() = user_id. Backend writes go
-- through service-role and bypass RLS by design.
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY runs_select_own
  ON public.runs FOR SELECT
  USING (auth.uid() = user_id);
