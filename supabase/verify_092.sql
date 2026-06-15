-- =============================================================================
-- verify_092.sql  —  Phase 092 live-DB verification gate (migration 063)
-- =============================================================================
-- Phase: 092-dual-mode-wiring-continue-button
-- Run:   Plan 01 (autonomous: false) — pasted into the Supabase SQL editor
--        against the LIVE LOCAL Supabase AFTER migration 063 is applied
--        (operator checkpoint, Task 3). NEVER via `supabase db push`/`db reset`.
--
-- Why a SQL script (not pytest): backend/tests/conftest.py builds a fully
-- MOCKED Supabase client — the migrated columns + the recreated CHECK
-- constraints can only be confirmed against the live DB. This script asserts:
--   (a) the 4 new columns exist (workflow_runs.inputs/model/continues_used +
--       runs.continues_used),
--   (b) `cap_paused` is an allowed status on BOTH status CHECKs (introspection
--       via pg_get_constraintdef + an insert-rollback probe),
--   (c) the existing status values are preserved (T-092-01 — no value dropped).
--
-- Error-code references: 23514 = check_violation, 23503 = foreign_key_violation.
-- HOW TO RUN: execute block-by-block; Blocks D/E run inside a transaction you
-- roll back (no committed test data). Substitute :thread_id in Block E with a
-- real threads.id you own (for the workflow_runs FK).
-- =============================================================================


-- =============================================================================
-- BLOCK A — the 4 new columns exist (SEED-047 + D-06)
-- =============================================================================
-- EXPECT: 4 rows.
--   workflow_runs.inputs          | jsonb    | NO  (NOT NULL, default {})
--   workflow_runs.model           | text     | YES (nullable)
--   workflow_runs.continues_used  | integer  | NO  (NOT NULL, default 0)
--   runs.continues_used           | integer  | NO  (NOT NULL, default 0)
-- -----------------------------------------------------------------------------
SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (
        (table_name = 'workflow_runs' AND column_name IN ('inputs','model','continues_used'))
     OR (table_name = 'runs'          AND column_name = 'continues_used')
   )
 ORDER BY table_name, column_name;


-- =============================================================================
-- BLOCK B — runs.status CHECK now allows cap_paused (preserving the 5 values)
-- =============================================================================
-- EXPECT: 1 row whose definition contains ALL of:
--   'streaming','cap_paused','completed','failed','cancelled','timed_out'
-- -----------------------------------------------------------------------------
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conname = 'runs_status_check'
   AND conrelid = 'public.runs'::regclass;


-- =============================================================================
-- BLOCK C — workflow_runs.status CHECK now allows cap_paused (keep `paused`)
-- =============================================================================
-- EXPECT: 1 row whose definition contains ALL of:
--   'active','paused','cap_paused','completed','failed','cancelled'
-- (T-092-01 — `paused` MUST still be present; it is the sweep's auto-resume state.)
-- -----------------------------------------------------------------------------
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conname = 'workflow_runs_status_check'
   AND conrelid = 'public.workflow_runs'::regclass;


-- =============================================================================
-- BLOCK D — runs: cap_paused is INSERTable; a bogus status is REJECTED
-- =============================================================================
-- SC/req: D-06 — a Deep run can pause at the cap (non-terminal cap_paused).
-- Action: insert a runs row with status='cap_paused' (must succeed) and a row
--         with a bogus status (must raise 23514). Rolled back — no committed data.
-- NOTE:   runs has FK columns; this probe uses the CHECK only. If your runs table
--         requires non-null thread_id/user_id FKs, substitute real ids or rely on
--         Block B's introspection as the authoritative proof.
-- -----------------------------------------------------------------------------
BEGIN;
-- EXPECT: SUCCEEDS — cap_paused is now a valid status.
--   (uncomment + fill real FK ids if your runs schema enforces them)
-- INSERT INTO public.runs (run_id, thread_id, user_id, status)
-- VALUES (gen_random_uuid(), :'thread_id', :'user_id', 'cap_paused');
--
-- EXPECT: RAISES SQLSTATE 23514 (check_violation) — bogus status rejected.
-- INSERT INTO public.runs (run_id, thread_id, user_id, status)
-- VALUES (gen_random_uuid(), :'thread_id', :'user_id', 'not_a_real_status');
ROLLBACK;


-- =============================================================================
-- BLOCK E — workflow_runs: cap_paused is INSERTable
-- =============================================================================
-- SC/req: D-06 — a Harness run can pause at the cap (non-terminal cap_paused).
-- Action: insert a workflow_runs row with status='cap_paused' (must succeed).
--         Substitute :thread_id with a real threads.id you own. Rolled back.
-- -----------------------------------------------------------------------------
BEGIN;
-- EXPECT: SUCCEEDS — cap_paused is now a valid workflow_runs status.
--   (uncomment + fill a real thread_id + definition_id)
-- INSERT INTO public.workflow_runs (thread_id, definition_id, status, inputs, model, continues_used)
-- VALUES (:'thread_id', :'definition_id', 'cap_paused', '{"kickoff_prompt":"x"}'::jsonb, 'gpt-4o', 0);
ROLLBACK;


-- =============================================================================
-- END verify_092.sql — confirm Block A returns 4 columns, Blocks B/C show both
-- recreated CHECKs containing 'cap_paused' (and the original values preserved),
-- before marking migration 063 applied and regenerating full-schema.sql.
-- =============================================================================
