-- 113_sso_configs_firming.sql
-- Phase 168 (SSO — SAML 2.0 CORE), Plan 01 — the load-bearing schema foundation the SSO phase stands on.
--
-- WHAT THIS DOES (five idempotent, re-paste-safe statements, in order):
--   (1) LOAD-BEARING GRANT — seeds ('org-admin','sso:manage') into role_permissions. Mig 104
--       shipped the sso_configs RLS write policies ALREADY gating on current_user_has_permission(
--       org_id,'sso:manage') (mig 104:375-388), but granted sso:manage to super-admin ONLY
--       (mig 104:416-425) and explicitly RESERVED this org-admin grant for Phase 168
--       (mig 104:414 comment). This flip ACTIVATES those dormant policies — without it every
--       org-admin write to sso_configs 403s (RESEARCH Pitfall 1 / D-168-01). Org-admin ONLY —
--       never widened to member/dept-admin (T-168-06).
--   (2) status column — the D-168-05 approval gate. Defaults 'pending_approval'; a 3-value CHECK
--       (pending_approval / active / disabled). Only an approved config may route logins (Plan 04).
--   (3) lowercased-email_domain UNIQUE index — case-insensitive one-org-per-domain determinism
--       (D-168-05 anti-hijack). Partial (non-null email_domain only) so thin/unclaimed rows coexist.
--   (4) approved_by (uuid) + approved_at (timestamptz) — the operator-approval audit trail.
--   (5) app_settings.supabase_management_token — the encrypted home for the Cloud `sbp_` management
--       token (D-168-01). Plan 02 adds this column name to backend SECRET_COLUMNS so main.py's boot
--       sweep_row encrypts it at rest via the Phase-150 MultiFernet cipher (enc:v1: envelope).
--
-- WHAT IS DELIBERATELY UNTOUCHED (D-07 preserved):
--   * provider_id STAYS text (holds the GoTrue provider UUID string) — NO type change.
--   * NO foreign key added into the Supabase-owned auth schema — the sso_configs<->provider link
--     stays a nullable text pointer, exactly as mig 104 designed it (mig 104:163 comment).
--   * NO metadata_url / metadata_xml columns — Supabase Auth owns the SAML provider internals; this
--     table is a thin org<->provider<->domain mapping only.
--
-- IDEMPOTENT: every DDL uses IF NOT EXISTS; the seed uses ON CONFLICT (role, permission_key) DO
--   NOTHING (mig 104:426 idiom) — the whole file is safe to re-paste. Digits-only filename (NO
--   letter suffix — the Supabase CLI silently skips `113b`).
--
-- ── APPLY DISCIPLINE (CLAUDE.md) — AUTHORED HERE, OPERATOR-APPLIED ──────────────────────────────
--   NOT applied in this change. Applied LOCAL by the OPERATOR pasting this whole file into the
--   Supabase SQL editor @ :54322 as ONE execution (pure DDL, BEGIN…COMMIT is fine) — AFTER 112.
--   NEVER ``supabase db push`` / ``db reset`` (preserves dev data). AFTER applying: run
--   ``bash scripts/regenerate-full-schema.sh`` (NO --reset — live-DB dump) and commit this
--   migration + the regenerated supabase/full-schema.sql together. NEVER hand-edit full-schema.sql.
--
-- ── CLOUD PARITY / DEPLOYMENT-ARTIFACT PARITY ───────────────────────────────────────────────────
--   113 joins the pending cloud set (099 → … → 112 → 113), applied to production only at the next
--   operator-gated push, in order. Reference-data seed (the sso:manage grant row) + additive
--   schema columns. Plan 02 registers the two SSO env vars in the deploy artifacts (D-16) in ITS
--   commit; this migration owes no OPERATOR.md / check-deploy-drift.sh change (adds no env var /
--   bundled service / sandbox tag; the app_settings column is a secrets-swept store, not a seed).

BEGIN;

-- ================================================================================================
-- §1 — LOAD-BEARING GRANT: activate the mig-104 sso_configs RLS write policies for org-admins.
--   mig 104:414 reserved exactly this grant for Phase 168. Org-admin ONLY (never member/dept-admin).
-- ================================================================================================
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('org-admin', 'sso:manage')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ================================================================================================
-- §2 — sso_configs approval gate (D-168-05): status defaults pending_approval, 3-value CHECK.
-- ================================================================================================
ALTER TABLE public.sso_configs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status = ANY (ARRAY['pending_approval'::text, 'active'::text, 'disabled'::text]));

-- ================================================================================================
-- §3 — case-insensitive one-org-per-domain (D-168-05 anti-hijack). Partial: non-null domains only.
-- ================================================================================================
CREATE UNIQUE INDEX IF NOT EXISTS sso_configs_email_domain_lower_unique
  ON public.sso_configs (lower(email_domain))
  WHERE email_domain IS NOT NULL;

-- ================================================================================================
-- §4 — operator-approval audit trail (who approved the config, and when).
-- ================================================================================================
ALTER TABLE public.sso_configs ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.sso_configs ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- ================================================================================================
-- §5 — encrypted Cloud management-token store (D-168-01). Plan 02 adds this name to SECRET_COLUMNS
--   so the Phase-150 cipher encrypts it at boot; here we only add the column (plaintext-capable
--   until Plan 02 wires the sweep). Text home, mirroring the other app_settings secret columns.
-- ================================================================================================
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS supabase_management_token text;

COMMIT;

-- Closing note: 113 flips the org-admin sso:manage grant live (activating the already-shipped
-- mig-104 sso_configs RLS write policies), adds the D-168-05 approval gate (status + lowercased-
-- domain uniqueness + approved_by/at) and the D-168-01 encrypted app_settings.supabase_management_
-- token store. provider_id stays text; NO foreign key into the Supabase-owned auth schema; NO
-- metadata_url/xml (D-07 held). Idempotent (IF NOT EXISTS + ON CONFLICT DO NOTHING), one
-- BEGIN/COMMIT. Apply AFTER 112 via the SQL editor; then regenerate full-schema no-reset + commit
-- both same-commit. 113 joins the pending cloud set (099→113) — not applied to cloud now.
