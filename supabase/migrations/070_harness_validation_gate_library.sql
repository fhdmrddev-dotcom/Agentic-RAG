-- 070_harness_validation_gate_library.sql
-- Phase 102 (GATE-01/QUAL-01) — extend the harness_audit event_type CHECK with the
-- judge/publish/policy/ask_user-approval receipt kinds + add the golden-run flag.
-- ALTER (NOT CREATE — harness_audit exists since 059; workflow_runs since 057). Does
-- NOT touch the INSERT-only RLS, so the receipt immutability guarantee holds.
--
-- Apply by pasting into the Supabase SQL editor (or psycopg2 to local :54322 per the
-- 100/099/101.1 precedent) — NEVER `supabase db push` / `db reset` (preserves dev
-- data); then `bash scripts/regenerate-full-schema.sh` (no reset), commit both.
-- Plan 02 [BLOCKING] (operator, autonomous:false) applies it + regenerates full-schema.
-- This plan ONLY AUTHORS the file — it is NOT applied here.

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
        'policy_applied','validator_ask_user_approved'
    )
);

-- Golden-run flag (D-05). workflow_runs has NO immutability trigger; additive + safe.
ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS is_golden_run boolean DEFAULT false;
COMMENT ON COLUMN public.workflow_runs.is_golden_run IS
  'Phase 102 QUAL-01 (D-05). True = a publish-time validation run (real engine, real KB, judge-graded). Excluded from ordinary run history/listings. Default false (every pre-102 + ordinary run byte-identical).';
