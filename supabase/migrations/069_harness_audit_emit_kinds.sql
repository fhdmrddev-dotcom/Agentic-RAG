-- 069_harness_audit_emit_kinds.sql
-- Phase 101.1 (D-12) — extend the harness_audit event_type CHECK with emit-transition kinds.
-- The table + INSERT-only RLS already exist (059_harness_audit_and_threads_col.sql). Substrate
-- Phase 107 (GOV-02 / EU AI Act Art. 12 receipt) reads these rows as a pure query later.
--
-- This is an ALTER (NOT a CREATE — the table exists since 059). It does NOT touch the
-- INSERT-only RLS policies, so the receipt immutability guarantee (no UPDATE/DELETE policy) holds.
-- No new columns: the D-12 receipt fields (tier, raw field-map, gate/integrity verdicts, output
-- file hash, definition@version) ride the unbounded metadata jsonb.
--
-- Apply by pasting into the Supabase SQL editor (or psycopg2 to local :54322 per the 100/099
-- precedent) — NEVER `supabase db push` / `db reset` (preserves dev data). Plan 05 (operator,
-- autonomous:false) applies it + regenerates supabase/full-schema.sql.

ALTER TABLE public.harness_audit DROP CONSTRAINT harness_audit_event_type_check;
ALTER TABLE public.harness_audit ADD CONSTRAINT harness_audit_event_type_check CHECK (
    event_type IN (
        'phase_started','phase_completed','phase_transition',
        'gate_passed','gate_failed','tool_refused',
        'run_started','run_completed','run_failed',
        -- 101.1 emit transitions (D-12):
        'emit_forced','emit_recovered','emit_validated','emit_rejected',
        'emit_rendered','emit_integrity_failed','emit_failed'
    )
);
