-- 117_harness_audit_external_action_sent.sql
-- Phase 190 (CONN-02 / CONN-03, decision D-20) — extend the harness_audit event_type
-- CHECK with the ONE send-receipt kind: 'external_action_sent'.
--
-- WHY: Phase 189 shipped the external_action node that RESOLVES and RECORDS but sends
-- nothing, and its D-09 deferred the send receipt to this phase in as many words —
-- *"where it would describe a real consequence"*. Phase 190 is where a real consequence
-- exists: an email actually leaves, a ticket is actually created, a message is actually
-- posted. A receipt for an INTENTION would have been a word for a thing that did not
-- happen; a receipt for a SEND is the only honest ledger row on this surface, and it is
-- the audit trail an outbound-egress feature is judged by.
--
-- THE MEASURED FACT THIS ANSWERS: the CHECK held exactly 23 literals
-- (supabase/full-schema.sql:1124 — the column is `event_type`, NOT `kind`; last widened
-- by 114). 23 -> 24 here, and the 23 below were re-derived from that live line, never
-- retyped from any planning document.
--
-- ⚠ BOTH LAYERS MOVE IN THE SAME COMMIT. Registering the kind in Python alone would only
-- MOVE the failure — from a ValueError before the INSERT to a Postgres 23514 during it.
-- That is BUG-260731-02 verbatim (migration 114's own header records the run it killed:
-- workflow_runs.id = 80c8823d). `backend/app/db/workflows.py::_AUDIT_EVENT_TYPES` gains
-- "external_action_sent" in the same commit as this file, and
-- `backend/tests/unit/test_audit_event_registration.py`'s G2 fence pins the two sets
-- EQUAL in BOTH directions. That fence reads the highest-numbered migration that DEFINES
-- the CHECK — so migration 116 (connector_connections) is invisible to it and THIS file
-- is the source of truth from now on.
--
-- THE SLUG IS LOCKED HERE. CONTEXT D-20 called `external_action_sent` a *working name*;
-- plan 190-03 makes it the name, checked legal against the fence's own extractor
-- (`'([^']+)'` on the SQL side, `[A-Za-z0-9_]+` on the Python side). Downstream plans
-- emit this exact literal — it is no longer provisional.
--
-- ALTER (NOT CREATE — harness_audit exists since 059). Adds exactly ONE literal and
-- changes nothing else: no table, no column, no index, no grant. Does NOT touch the
-- INSERT-only RLS on harness_audit, so the receipt-immutability guarantee holds. The
-- closed-vocabulary property the CHECK exists for is preserved — this widens it by one
-- REVIEWED literal.
--
-- Apply by pasting this whole file into the LOCAL Supabase SQL editor — NEVER
-- `supabase db push` / `supabase db reset` (both destroy dev data). Then run
-- `bash scripts/regenerate-full-schema.sh` with NO `--reset` and commit both. Filename is
-- DIGITS-ONLY (`117_…`); a letter suffix like `117b` is silently skipped by the CLI.
-- Apply 116 BEFORE this file (they are independent, but the recorded order is 116 -> 117).
--
-- NOTE (inherited from T-185-13-03): DROP+ADD CONSTRAINT takes a brief ACCESS EXCLUSIVE
-- lock on harness_audit. Immaterial on local dev; on cloud this belongs in the standing
-- migration-parity window (099 -> 117 land together, D-22), not mid-traffic.

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
        'action_risk_pending',
        -- 117 (Phase 190 CONN-02/CONN-03) — the send receipt: a real consequence, not an intention
        'external_action_sent'
    )
);
