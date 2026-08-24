-- 121_workflow_phases_timings.sql
-- Phase 200 (DES-02 / D-05 / D-06) — give workflow_phases two nullable timestamp columns so a
-- PER-STEP DURATION becomes derivable for the first time.
--
-- WHY THIS IS OWED AT ALL. Measured at HEAD: `create_workflow_run` batch-INSERTs EVERY phase row
-- for a run in one transaction (`backend/app/db/workflows.py:334`), so `created_at` is the moment
-- the RUN was created — identical across all of a run's phases and unrelated to when any of them
-- began work. And every one of the seven status writers overwrites `updated_at=now()` on each
-- transition, so `updated_at` is only ever "the last time anything about this row moved". Neither
-- column can answer "how long did this step take", and no third column existed. **`started_at` is
-- precisely the thing `created_at` cannot be** — that is the whole argument for D-05, and it is
-- why the batch INSERT above deliberately does NOT learn either of these columns.
--
-- ── started_at ──────────────────────────────────────────────────────────────────────────────
-- Written at ONE site: `mark_phase_active` (`backend/app/db/workflows.py:1441`), the durable
-- flip to `active` that happens BEFORE any of the phase's work runs (Pitfall 1: durable-first).
--
-- ⚠ NO BACKFILL — THIS IS A DECISION (D-06), NOT AN OVERSIGHT, AND IT IS RECORDED HERE BECAUSE
-- THE SCHEMA IS WHERE THE NEXT PERSON WILL ASK. Every workflow_phases row that predates this
-- migration keeps BOTH columns NULL, forever. A backfill from `updated_at` was offered and
-- REJECTED: for a phase whose last transition WAS its terminal one, `updated_at` is roughly the
-- completion instant and the backfilled value would be roughly right; for a phase that was
-- retried, resumed, cancelled or had its output rewritten, it is the time of some LATER event
-- entirely and the backfilled value would be silently WRONG — and **nothing on the row would say
-- which of the two it was**. A NULL says "time not recorded" honestly. A wrong number says
-- "8.1s" with total confidence. The two client-facing states this preserves are structurally
-- distinct and must stay so: `never ran` (the step has no timestamps because it never started)
-- versus `time not recorded` (the step ran, before this migration existed).
--
-- ⚠ NEITHER COLUMN DECLARES A `default` CLAUSE, FOR THE SAME REASON. A `default now()` would
-- backfill every
-- existing row at ALTER time in Postgres 11+, destroying D-06's "time not recorded" arm before it
-- ever existed — a backfill by accident is still a backfill. `backend/tests/test_migration_121.py`
-- asserts the absence as a NEGATIVE control, because a test that only proves the columns exist
-- cannot tell a no-backfill migration from a backfilled one.
--
-- ⚠ BOTH COLUMNS ARE NULLABLE. A `not null` column would have REQUIRED a backfill (or a default)
-- to be addable at all, so the nullability is not a convenience — it is part of the proof that no
-- backfill happened, and the migration test asserts `is_nullable = 'YES'` on both.
--
-- ── completed_at ────────────────────────────────────────────────────────────────────────────
-- Written at FIVE of the seven status-write sites in `backend/app/db/workflows.py`:
--   * `complete_phase`         (:1483) — 'completed'
--   * `fail_phase`             (:1505) — 'failed'
--   * `record_phase_not_sent`  (:1548) — 'recorded_not_sent'  (189's governed external action)
--   * `cancel_phase`           (:1597) — 'cancelled', the ENGINE arm (194)
--   * `cancel_active_phases`   (:1649) — 'cancelled', the RUN-KEYED ENGINELESS arm (194)
--
-- ⚠ THE SEVENTH SITE IS `cancel_active_phases` AND IT IS EASY TO MISS. It is the arm Phase 194
-- built for a Stop that lands with NO producer running: no engine, no loop, no `phase_id`, so the
-- row must be FOUND rather than named. Its predicate `WHERE workflow_run_id = $1 AND status =
-- 'active'` means it only ever moves rows that ALREADY carry a `started_at`, so writing
-- `completed_at` there is correct. A change that covers only six sites leaves a hole on exactly
-- that path, and D-06's `cancelled → "ran 8.1s, interrupted"` arm then renders "time not
-- recorded" on a run the user stopped a second ago.
--
-- ⚠ `skip_phase` (:1517) WRITES NEITHER COLUMN, DELIBERATELY. A skipped phase never ran: it was
-- routed around. Both timestamps stay NULL and the row reads `never ran` — D-06 calls that
-- CORRECT SILENCE, not a gap. Writing `completed_at` on a skip would claim the step finished.
--
-- ── WHAT THIS MIGRATION DOES NOT TOUCH ──────────────────────────────────────────────────────
--
-- 1. **THE PHASE-STATUS CHECK CONSTRAINT IS NOT REWRITTEN.** Phase 200 adds no phase status —
--    D-10 pauses the RUN, not the phase. Migration 119's rule "re-add every shipped literal
--    VERBATIM" does not apply here because this file rewrites no CHECK at all, and the seven
--    literals (`pending, active, completed, failed, skipped, recorded_not_sent, cancelled`) are
--    untouched. ⚠ The constraint's IDENTIFIER is deliberately left UNSPELLED in this file: the
--    plan's fence is a literal grep asserting zero occurrences of it, and a denial reads
--    identically to a use under a grep (the 189-09 lesson). Migration 119 names it in full.
--
-- 2. **NO RLS WORK IS OWED, and a reviewer will ask, so it is answered here.**
--    `058_workflow_phases.sql:38-77` creates four policies (select / insert / update / delete)
--    which all share ONE predicate —
--      auth.uid() = (SELECT t.user_id FROM threads t
--                    JOIN workflow_runs wr ON wr.thread_id = t.id
--                    WHERE wr.id = workflow_run_id)
--    — and **not one of them names a column list**. `ADD COLUMN` therefore touches no policy: the
--    new columns inherit the same 2-hop FK-chain access rule as every existing column, with no
--    policy created, dropped or altered. `backend/tests/test_migration_121.py` reads
--    `information_schema.columns` rather than probing with an INSERT, so it cannot mutate the
--    operator's live dev data and cannot confuse "the column is absent" with "something else
--    rejected the row".
--
-- 3. **The `updated_at` trigger is INERT here.** `public.set_updated_at()` (014_folders.sql)
--    writes only `NEW.updated_at`, is registered `BEFORE UPDATE` (not INSERT), and fires on every
--    UPDATE regardless of which column moved. So the seven write sites KEEP their explicit
--    `updated_at=now()` unchanged, no diff is owed there, and the trigger neither writes nor
--    clobbers either new column.
--
-- 4. **⚠ SEED-143 IS DECLINED HERE, DELIBERATELY.** SEED-143 proposes a CHECK constraining
--    `workflow_phases.slug` (the `constructor`-slug class behind BUG-260807-01 / BUG-260808-01).
--    It is a schema AND an API-surface change, on a phase already carrying a behaviour change,
--    and neither `200-CONTEXT.md` nor the ROADMAP scoped it. Taking it here would make ROADMAP
--    SC#5's "changes no behaviour beyond..." unprovable.
--    **Re-open trigger: the next phase that opens a `workflow_phases` migration for another
--    reason.** Recorded rather than dropped (the "every deferral gets a named trigger" rule).
--
-- ── HOW THIS IS APPLIED ─────────────────────────────────────────────────────────────────────
--
-- Apply by pasting the ENTIRE file into the Supabase SQL editor — ⚠ NEVER `supabase db push` /
-- `supabase db reset` (both wipe local dev data; CLAUDE.md forbids them outright). Then run
-- `bash scripts/regenerate-full-schema.sh` with **NO `--reset`**, and commit the regenerated
-- artifact. Never hand-edit `supabase/full-schema.sql`.
--
-- BEGIN/COMMIT wrapping (migration 115's review finding WR-01, inherited by 119): without it the
-- two ADD COLUMNs would each run in their own implicit transaction when pasted into the editor,
-- so a dropped session between them leaves the table half-migrated. DDL is transactional in
-- Postgres, so this genuinely rolls back. `IF NOT EXISTS` on each ADD makes a re-paste safe.
--
-- NOTE: `ADD COLUMN` with no default and no nullability constraint is a CATALOG-ONLY operation —
-- it rewrites no rows and holds its ACCESS EXCLUSIVE lock for microseconds. Immaterial locally;
-- on cloud it still belongs in the standing migration-parity window.
--
-- ⚠ CLOUD PARITY (for the eventual operator-triggered promotion, NOT now): this migration must be
-- pasted into the CLOUD Supabase SQL editor in the SAME operation that deploys this backend, or
-- the widened `.select()` in `backend/app/api/workflow_runs.py` reads a column the cloud DB does
-- not have.

BEGIN;

ALTER TABLE public.workflow_phases
    ADD COLUMN IF NOT EXISTS started_at timestamptz,
    ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.workflow_phases.started_at IS
  'Phase 200 (DES-02 / D-05): the instant this phase flipped to active, written ONCE by mark_phase_active (backend/app/db/workflows.py:1441) BEFORE any of the phase''s work runs. NULLABLE and NOT BACKFILLED (D-06): a pre-200 row keeps NULL forever, which reads "time not recorded" — distinct from "never ran". A backfill from updated_at is right for some rows and silently wrong for others, and nothing on the row would say which. created_at cannot substitute: every phase row of a run is batch-INSERTed together at run creation.';

COMMENT ON COLUMN public.workflow_phases.completed_at IS
  'Phase 200 (DES-02 / D-05): the instant this phase reached a terminal status. Written at FIVE sites in backend/app/db/workflows.py — complete_phase (:1483), fail_phase (:1505), record_phase_not_sent (:1548), cancel_phase (:1597) and cancel_active_phases (:1649, the run-keyed engineless-Stop arm 194 built, whose AND status = ''active'' predicate means it only moves rows that already carry a started_at). skip_phase (:1517) writes NEITHER column deliberately — a skipped phase never ran. NULLABLE and NOT BACKFILLED (D-06).';

COMMIT;
