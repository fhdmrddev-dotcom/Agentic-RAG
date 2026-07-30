-- 114_harness_audit_action_risk_pending.sql
-- Phase 185 (GOVERN-03 / BUG-260731-02) — extend the harness_audit event_type CHECK
-- with the ONE armed-action-risk-pause kind: 'action_risk_pending'.
--
-- WHY: an armed action-risk checkpoint does not park — it KILLS the run. Measured on
-- workflow_runs.id = 80c8823d (definition sc10-armed-f77e72, gpt-5.5): `retrieve`
-- completed, `emit` reached its timing:"pre" approval gate, and the run then died with
--   ValueError: write_audit event_type must be one of the 22 harness_audit kinds
--   (059 + 069 + 070), got 'action_risk_pending'
-- leaving a phase permanently `active` under a run marked `failed`, and nobody asked.
-- Plan 185-05 introduced the kind FOR HONESTY (harness_engine.py:697-711 — announcing
-- `gate_failed` on an armed pause would tell the ledger something went wrong when
-- nothing did), but never registered the new word at either layer that admits an audit
-- kind. Registering the Python allow-list alone would only move the failure from a
-- ValueError to a Postgres 23514 mid-run — hence this migration.
--
-- ALTER (NOT CREATE — harness_audit exists since 059; the CHECK was last widened by
-- 070). Adds exactly ONE literal (22 → 23) and changes nothing else: no table, no
-- column, no index, no grant. Does NOT touch the INSERT-only RLS on harness_audit, so
-- the receipt immutability guarantee holds. The closed-vocabulary property the CHECK
-- exists for is preserved — this widens it by one REVIEWED literal, and the Python set
-- is pinned equal to this list by backend/tests/unit/test_audit_event_registration.py.
--
-- Apply by pasting into the Supabase SQL editor (or psycopg2 to local :54322 per the
-- 100/099/101.1 precedent) — NEVER `supabase db push` / `db reset` (preserves dev
-- data); then `bash scripts/regenerate-full-schema.sh` (no reset), commit both.
-- Task 3 [BLOCKING] (operator, autonomous:false) applies it + regenerates full-schema.
-- This plan ONLY AUTHORS the file — it is NOT applied here.
--
-- NOTE (T-185-13-03): DROP+ADD CONSTRAINT takes a brief ACCESS EXCLUSIVE lock on
-- harness_audit. Immaterial on local dev; on cloud this belongs in the standing
-- migration-parity window (migs 099→114 land together), not mid-traffic.

ALTER TABLE public.harness_audit DROP CONSTRAINT harness_audit_event_type_check;
ALTER TABLE public.harness_audit ADD CONSTRAINT harness_audit_event_type_check CHECK (
    event_type IN (
        'phase_started','phase_completed','phase_transition',
        'gate_passed','gate_failed','tool_refused',
        'run_started','run_completed','run_failed',
        -- 069 (Phase 101.1) emit transitions:
        'emit_forced','emit_recovered','emit_validated','emit_rejected',
        'emit_rendered','emit_integrity_failed','emit_failed',
        -- 102 (GATE-01/QUAL-01) — judge / publish / policy / ask_user-approval receipts:
        'judge_verdict','publish_attempted','publish_blocked','publish_succeeded',
        'policy_applied','validator_ask_user_approved',
        -- 185 (GOVERN-03 / BUG-260731-02) — the armed action-risk pause:
        'action_risk_pending'
    )
);
