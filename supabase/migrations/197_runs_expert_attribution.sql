-- Migration 197 — Phase 268 (METER-08 / D-268-04 / D-268-05 / D-268-06 / D-268-18 / D-268-19)
-- public.runs — which Expert a run ran with, and whether that was recorded at all.
--
-- TWO COLUMNS, THREE STATES — and the third is the point.
--   expert_attributed = true,  expert_id = <uuid>  → the run ran with that Expert (access-checked
--                                                     for the turn: ThreadScoping.born_for_bundle_id).
--   expert_attributed = true,  expert_id = NULL    → "No Expert" — recorded, and there was none
--                                                     (plain chat, harness, eval, golden, resume shells).
--   expert_attributed = false (the column default)  → "Not recorded (before 268)". Nobody wrote it.
--   Every row inserted from 268 on is written by db.runs.insert_run, which sets true IN SQL, so a
--   caller cannot forget it; a sub-agent row copies its parent's pair in the same statement.
--
-- WHY expert_id HAS NO FOREIGN KEY (D-268-04).
--   Contrast migration 188: threads.active_expert_id carries a foreign key to
--   public.expert_bundles(id) with ON DELETE SET NULL. That is right for a thread's CURRENT Expert. Here it would be a lie that
--   rewrites history: deleting an Expert would turn every run it ever made into
--   (expert_attributed = true, expert_id = NULL) — "No Expert" — and its spend would silently move
--   onto a line that claims the runs had no Expert. Without an FK the id survives the delete, the
--   report's join finds no bundle, and the line reads "Deleted Expert". A dangling id is the honest
--   state; a nulled one is a false one.
--
-- WHY THERE IS NO BACKFILL HERE (D-268-06).
--   The only candidate source is the thread's current active_expert_id, and that is not evidence
--   of the Expert at the time: Phase 267 made mid-thread Expert swaps possible, so a thread's Expert
--   today says nothing about the Expert of a run last week. Every pre-268 row therefore keeps the
--   default false and reads "Not recorded (before 268)", forever — never "No Expert". A schema
--   change must not do data work, and this one could only do WRONG data work.
--
-- No index (268-RESEARCH Q4: the spend query filters roots by org/time; the Expert predicate rides
-- that scan). No policy and no GRANT: runs keeps RLS and its single runs_select_own policy; an owner
-- reading their own run's expert_id is harmless (T-268-06). ADD COLUMN ... DEFAULT false NOT NULL is
-- metadata-only on PG >= 11, so this does not rewrite runs (T-268-07).
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- NOTE: no DO block, no COMMIT inside a procedure — migrations 105 and 107 could not be pasted into
-- the Supabase SQL editor for exactly that reason.
-- ============================================================================

BEGIN;

ALTER TABLE public.runs
    ADD COLUMN IF NOT EXISTS expert_id uuid;

ALTER TABLE public.runs
    ADD COLUMN IF NOT EXISTS expert_attributed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.runs.expert_id IS
    'Phase 268 (METER-08 / D-268-04). The Expert this run ran with: the ACCESS-CHECKED bundle id '
    'resolved for the turn (ThreadScoping.born_for_bundle_id), stamped at the one INSERT '
    '(db.runs.insert_run) and never re-read at report time. A sub-agent row copies its parent''s '
    'value in SQL. Read it ONLY together with expert_attributed: NULL + attributed = No Expert; '
    'NULL + not attributed = Not recorded (before 268). NO FOREIGN KEY on purpose — ON DELETE SET NULL '
    'would turn a deleted Expert''s runs into No Expert; a missing join renders "Deleted Expert".';

COMMENT ON COLUMN public.runs.expert_attributed IS
    'Phase 268 (METER-08 / D-268-04 / D-268-06). true for every row written from 268 on — set in SQL '
    'by db.runs.insert_run, copied from the parent for a sub-agent. false (the default) means Not '
    'recorded (before 268). NEVER BACKFILLED: the thread''s current Expert is no evidence of the '
    'Expert at the time, because Phase 267 made mid-thread swaps possible.';

COMMIT;

-- Verify (read-only):
-- SELECT column_name, is_nullable, column_default, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'runs'
--    AND column_name IN ('expert_id', 'expert_attributed');
-- expected: expert_id uuid YES <null> · expert_attributed boolean NO false
