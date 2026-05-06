-- Migration 038: extend public.runs.status CHECK to admit 'timed_out'
-- Phase 066 (D-066-04, D-066-08). Companion to:
--   - threads.py terminal classification (D-066-05): TimeoutError → 'timed_out'
--   - runs.py cancel_run (UNCHANGED per D-066-05): user-Stop → 'cancelled'
--   - SSE TERMINAL_TYPES set (D-066-06): adds 'timed_out' wire-format value
--   - Pydantic MessageResponse.run_status (D-066-04): 4-value Literal → 5-value
--
-- D-066-08: NO retroactive classification. Historical rows with
-- status='cancelled' STAY 'cancelled' — the migration is forward-only.
--
-- Atomic single-statement DROP+ADD CHECK per Postgres docs
-- (postgresql.org/docs/current/sql-altertable.html — multiple alterations
-- on a single table can be combined into one ALTER TABLE statement).
--
-- The constraint auto-name `runs_status_check` is the deterministic
-- Postgres auto-naming for inline column CHECK on table public.runs
-- column status (verified at migration 035 line 25, no explicit name).
-- If the auto-name differs in your DB, run this verification first:
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'public.runs'::regclass AND contype = 'c';
-- and substitute the actual name in the DROP CONSTRAINT clause.

ALTER TABLE public.runs
    DROP CONSTRAINT runs_status_check,
    ADD  CONSTRAINT runs_status_check
        CHECK (status IN ('streaming','completed','failed','cancelled','timed_out'));
