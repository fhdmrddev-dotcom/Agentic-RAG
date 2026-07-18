-- 095_operator_foundation.sql
-- Phase 146 (ADMIN-01): the operator-role foundation — the org-agnostic operator principal
-- (operator_users) + the append-only operator action ledger (operator_audit_log).
--
-- operator_users is a SYSTEM-LEVEL, ORG-AGNOSTIC principal (D-06). It deliberately has NO org_id:
-- an operator spans ALL orgs. Per-org operators are a v3.4 concern; stubbing org_id on the principal
-- here would poison the v3.4 org-RBAC one-way door (an operator is NOT scoped to an org — not a JWT
-- claim, not an is_admin boolean, not a special org row).
--
-- operator_audit_log follows the append-only harness_audit precedent (mig 059):
--   * operator_user_id is a PLAIN stored uuid with NO foreign key (059:16 idiom) so an operator's
--     action history SURVIVES their deletion — deleting an operator cannot erase their trail
--     (tamper-resistance; NEVER FK CASCADE).
--   * action is FREE-TEXT with NO CHECK constraint (RESEARCH A4): the auto audit-floor derives an
--     action per admin route, so a CHECK would force a migration per new admin action, fighting the
--     by-construction floor goal. label is the plain-sentence human-facing receipt.
--   * org_id is the D-05 forward-compat stub (059:19 idiom): nullable, NO FK, NO index, NO backfill.
--
-- RLS posture is STRICTER than harness_audit: both tables ship RLS-ENABLED with ZERO policies =
-- deny-all for anon/authenticated. A normal JWT must NEVER read either operator table. Only the
-- service-role backend (which bypasses RLS) behind require_operator reads them (Pitfall 1 acknowledged:
-- there is NO RLS backstop — require_operator in app code is the sole gate).
--
-- Apply: paste into the Supabase SQL editor (never db push/db reset). Filename digits only, no suffix.

-- ============================================================
-- operator_users — org-agnostic operator principal (D-06). NO org_id (one-way-door protection).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.operator_users (
    user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at timestamptz NOT NULL DEFAULT now(),
    granted_by uuid,        -- NULL = env-bootstrap provenance; set when Phase 148 adds grant-by-operator
    note       text
);

-- ============================================================
-- operator_audit_log — append-only operator action ledger (harness_audit precedent, mig 059).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.operator_audit_log (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_user_id uuid NOT NULL,          -- PLAIN uuid, NO FK — survives operator deletion (tamper-resistant, 059:16)
    action           text NOT NULL,          -- free-text machine code (A4), convention "<area>.<verb>" (e.g. health.view). NO CHECK.
    label            text NOT NULL,          -- plain-sentence receipt ("Viewed system health") — 062-A
    is_write         boolean NOT NULL DEFAULT false,  -- the ✎ write mark (write vs view)
    target_type      text,                   -- nullable; 147+ enrich (e.g. 'run','user','setting')
    target_id        text,                   -- nullable
    metadata         jsonb NOT NULL DEFAULT '{}',
    org_id           uuid,                   -- D-05 forward-compat stub: nullable, NO FK, NO index, NO backfill (059:19)
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_operator_audit_created ON public.operator_audit_log(created_at DESC);  -- feed order

COMMENT ON COLUMN public.operator_audit_log.org_id IS
  'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';

-- ============================================================
-- RLS — deny-all by omission (STRICTER than harness_audit's owner SELECT/INSERT).
-- ENABLE ROW LEVEL SECURITY with NO policy statements at all: anon/authenticated are denied
-- every operation. The service-role backend bypasses RLS and gates reads via require_operator.
-- ============================================================
ALTER TABLE public.operator_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_audit_log  ENABLE ROW LEVEL SECURITY;
-- (No policy statements at all — deny-all by omission.)
