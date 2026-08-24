-- 125_circuit_breaker_trip.sql
-- Phase 204 (SCHED-02 / D-204-06 / D-204-07): the two durable homes a circuit-breaker
-- trip needs. Additive only — one nullable column and one widened CHECK.
--
-- ⚠ THIS MIGRATION EXISTS BECAUSE THE PLAN ASSUMED A COLUMN THAT DOES NOT EXIST.
-- 204-02's task 1 says the breaker "updates `workflow_runs.metadata` with circuit
-- breaker trip details", and D-204-07 repeats it. Measured against the schema on disk:
-- `workflow_runs` has NO `metadata` column and never has (057 created the table; 062,
-- 063, 064, 070, 105 and 122 are every ALTER since, and none adds one). Writing to it
-- would have raised `UndefinedColumnError` on the first real trip — a safety mechanism
-- that reads as armed, passes every unit test, and cannot record the one event it exists
-- for. That is the Phase-200 SC#3 shape, so the column is created rather than faked.
--
-- ⚠ BOTH LAYERS OF THE AUDIT VOCABULARY MOVE IN THE SAME COMMIT. Registering
-- 'circuit_breaker_tripped' in `app/db/workflows.py::_AUDIT_EVENT_TYPES` alone would only
-- MOVE the failure — from a ValueError before the INSERT to a Postgres 23514 during it.
-- That is BUG-260731-02 verbatim (migration 114's header records the run it killed:
-- workflow_runs.id = 80c8823d). `backend/tests/unit/test_audit_event_registration.py`'s
-- G2 fence pins the Python set and this CHECK EQUAL in BOTH directions, and it reads the
-- HIGHEST-numbered migration that DEFINES the CHECK — so this file supersedes 117 and is
-- the source of truth from now on.
--
-- THE MEASURED FACT THIS ANSWERS: 117 widened the CHECK to 24 literals. 24 -> 25 here,
-- and the 24 below were re-derived from 117's own body, never retyped from any planning
-- document.
--
-- ⚠ 124 BELONGS TO 204-03 (`workflow_schedules`). These two plans run in parallel with
-- ZERO `files_modified` overlap; the numbers are disjoint on purpose. The two migrations
-- are independent — apply in numeric order (124 then 125), but neither depends on the
-- other.
--
-- ⚠ THE BREAKER STILL HALTS A RUN IF THIS FILE IS NEVER APPLIED. Both writes below are
-- wrapped best-effort in `CircuitBreaker.trip_breaker` (its docstring records the rule:
-- "the bookkeeping is best-effort and the halt is not"). An unapplied migration costs the
-- trip RECORD, never the cancellation. It is still owed — an untraceable kill is the
-- `audit evasion` threat this phase names.
--
-- Apply by pasting this whole file into the LOCAL Supabase SQL editor — NEVER
-- `supabase db push` / `supabase db reset` (both destroy dev data). Then run
-- `bash scripts/regenerate-full-schema.sh` with NO `--reset` and commit both. Filename is
-- DIGITS-ONLY (`125_…`); a letter suffix like `125b` is silently skipped by the CLI.
--
-- NOTE (inherited from T-185-13-03): DROP+ADD CONSTRAINT takes a brief ACCESS EXCLUSIVE
-- lock on harness_audit. Immaterial on local dev; on cloud this belongs in the standing
-- migration-parity window, not mid-traffic.

-- ============================================================
-- 1. workflow_runs.metadata — the run-level trip detail (D-204-07)
-- ============================================================
-- Nullable with NO default, deliberately: `ADD COLUMN` with no default is a CATALOG-ONLY
-- operation — it rewrites no rows and holds its lock for microseconds (122's own header
-- makes the same argument for `definition_snapshot`). The writer COALESCEs, so an
-- untouched run reads `{}` without a single row ever having been rewritten.
--
-- Idempotent (`IF NOT EXISTS`) — safe to paste-replay in the SQL editor.
--
-- RLS: `workflow_runs`' four policies (057) are predicate-only and name no column list,
-- so `ADD COLUMN` touches none of them and the 1-hop `threads.user_id` chain still
-- governs every read of this column.
ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.workflow_runs.metadata IS
  'Phase 204 (SCHED-02): run-level operational metadata. Today it carries exactly one key, "circuit_breaker", written by CircuitBreaker.trip_breaker with the trip reason and the exact token/timing measurements. Merged with ||, never replaced.';

-- ============================================================
-- 2. harness_audit — the 25th kind: 'circuit_breaker_tripped'
-- ============================================================
ALTER TABLE public.harness_audit DROP CONSTRAINT harness_audit_event_type_check;
ALTER TABLE public.harness_audit ADD CONSTRAINT harness_audit_event_type_check CHECK (
    event_type IN (
        'phase_started','phase_completed','phase_transition',
        'gate_passed','gate_failed','tool_refused',
        'run_started','run_completed','run_failed',
        -- 069 (Phase 101.1) emit transitions:
        'emit_forced','emit_recovered','emit_validated','emit_rejected',
        'emit_rendered','emit_integrity_failed','emit_failed',
        -- 102 (GATE-01/QUAL-01) judge / publish / policy / ask_user-approval receipts:
        'judge_verdict','publish_attempted','publish_blocked','publish_succeeded',
        'policy_applied','validator_ask_user_approved',
        -- 185 (GOVERN-03 / BUG-260731-02) the armed action-risk pause:
        'action_risk_pending',
        -- 190 (CONN-02/CONN-03, D-20) the send receipt:
        'external_action_sent',
        -- 204 (SCHED-02 / D-204-07) the spend-cap / duration trip. A receipt for a run
        -- the SYSTEM stopped, which is the only thing that distinguishes it in the
        -- ledger from a run a PERSON stopped: both end 'cancelled'.
        'circuit_breaker_tripped'
    )
);
