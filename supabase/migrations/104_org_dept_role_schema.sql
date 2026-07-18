-- 104_org_dept_role_schema.sql
-- Phase 161 (ORG-01, ORG-02) — the v3.4 org / dept / role / membership schema foundation.
--
-- WHAT THIS SHIPS (additive, zero-behavior-change on creation):
--   * 8 NEW org tables — organizations, departments, org_members, dept_members, roles,
--     role_permissions, org_invitations, sso_configs — each with RLS + FKs + indexes FROM creation.
--   * 3 SECURITY DEFINER helpers — current_user_org_ids() (the 42P17 recursion-break, ORG-02),
--     current_user_has_permission() (the write-side role gate, D-02), and
--     create_org_with_default_dept() (the one-default-dept construction guarantee, D-11).
--   * Membership-correct RLS on all 8 new tables (D-08 — correct-from-birth; these 8 are EXCLUDED
--     from Phase 163's 38-existing-table RLS-rewrite scope per D-09).
--   * The seeded CORE permission catalog (D-02/D-03/D-04) — 4 fixed tiers + default per-tier grants.
--   * A nullable org_id + btree index + forward-compat comment on the 23 remaining user-facing tables
--     (SC#3 — no FK, no NOT NULL; the FK/NOT-NULL flip is Phase 162/163).
--
-- Because the new tables are EMPTY and existing tables only gain a nullable column, Deep Mode /
-- the agent loop / retrieval / every current query stay byte-identical (T-161-06; ADR SC#4 — no
-- deployment tier is made harder).
--
-- ── APPLY DISCIPLINE (CLAUDE.md numbered-migration rules) ──────────────────────────────────────
--   * Apply by pasting this file into the LOCAL Supabase SQL editor. NEVER `supabase db push` /
--     `db reset` (preserves dev data).
--   * This file is IDEMPOTENT / re-paste-safe: every table is CREATE TABLE IF NOT EXISTS, every
--     function is CREATE OR REPLACE, every index is CREATE ... INDEX IF NOT EXISTS, every policy is
--     a drop-guard then a policy create (the latter has no IF NOT EXISTS), and every seed uses
--     INSERT ... ON CONFLICT DO NOTHING. Re-running the whole paste is a safe recovery step.
--   * AFTER applying: run `bash scripts/regenerate-full-schema.sh` (no --reset) and commit the
--     migration AND the regenerated supabase/full-schema.sql together. NEVER hand-edit full-schema.sql.
--   * Filename is digits-only (`104_...`) — a letter suffix like `104b` is silently skipped by the CLI.
--
-- ── CLOUD PARITY (do NOT touch cloud now) ──────────────────────────────────────────────────────
--   Migrations 099-103 + SECRETS_ENCRYPTION_KEY are already pending on the cloud (production) DB.
--   104 joins that pending set — it is applied to cloud only at the next operator-gated production
--   push, in order, per docs/DEPLOYMENT-WORKFLOW.md. This plan AUTHORS the file only; live LOCAL
--   application + verification is Phase 161 Plan 02 (a separate BLOCKING plan).
--
-- ── DEPLOYMENT-ARTIFACT PARITY (SEED-BEARING — Phase-158 D-16) ──────────────────────────────────
--   This migration seeds reference data (roles + role_permissions). When 104 enters the greenfield
--   deploy sequence, add it to the docs/OPERATOR.md Step-3 seed list and re-run
--   scripts/check-deploy-drift.sh (its Check-2 SOFT-WARNs a new seed-bearing migration above the
--   highest listed — human review, non-blocking). Deferred to the apply/deploy step with 099-103;
--   NOT staged in this author-only plan.

-- ================================================================================================
-- SECTION 1 — THE 8 ORG TABLES  (authored FIRST: the LANGUAGE sql helpers below reference these
--             tables and are parsed at CREATE time, so the tables must already exist.)
-- ================================================================================================

-- ── organizations — the tenant root (SC#1 / D-01) ──────────────────────────────────────────────
-- Carries subscription_tier (ENT-01/STRETCH-170 entitlement foothold, from day one) plus TWO
-- STRICTLY-SEPARATE jsonb homes (D-01): add_ons = entitlements/feature-flags; settings = the
-- SEED-120 forward-compat config home (per-org provider config / BYO keys / model selection land as
-- keys INSIDE settings in v3.5 with NO schema rewrite). Both copy the metadata jsonb NOT NULL
-- DEFAULT '{}' shape (095:47).
CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE,
    subscription_tier text,
    add_ons jsonb NOT NULL DEFAULT '{}',
    settings jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.organizations.add_ons IS 'D-01 / ENT-01 entitlements + feature-flags (STRETCH 170). SEPARATE from settings.';
COMMENT ON COLUMN public.organizations.settings IS 'D-01 / SEED-120 forward-compat home: per-org provider config / BYO keys / model selection land here as keys in v3.5 with NO schema rewrite (BYO values reuse the SEC-01 enc:v1: envelope). SEPARATE from add_ons.';

-- ── departments — self-referential tree + one-default-per-org guarantee (SC#4 / D-11) ───────────
-- parent_id is a nullable self-FK (folders precedent full-schema.sql:839/2833-2837): small orgs
-- leave it NULL; large orgs nest — zero schema change either way. is_default + the partial-unique
-- index below give EXACTLY ONE default department per org BY CONSTRUCTION (D-11).
CREATE TABLE IF NOT EXISTS public.departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    parent_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT departments_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX IF NOT EXISTS idx_departments_org_id ON public.departments USING btree (org_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON public.departments USING btree (parent_id);
-- D-11 backstop: one is_default=true row per org_id (partial-unique, documents_completed_hash_unique_idx precedent 2040).
CREATE UNIQUE INDEX IF NOT EXISTS departments_one_default_per_org_idx ON public.departments USING btree (org_id) WHERE (is_default = true);

-- ── org_members — the membership join (the 42P17 surface; D-03 fixed 4-tier role) ───────────────
-- role is a text column + named CHECK (house style — the repo has ZERO native CREATE TYPE enums).
CREATE TABLE IF NOT EXISTS public.org_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role = ANY (ARRAY['super-admin'::text, 'org-admin'::text, 'dept-admin'::text, 'member'::text])),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT org_members_org_user_unique UNIQUE (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.org_members USING btree (org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.org_members USING btree (user_id);

-- ── dept_members — dept-scoped membership. org_id is DENORMALIZED (NOT NULL FK) so
--    current_user_org_ids() gates this table without a join to departments (D-10). ───────────────
CREATE TABLE IF NOT EXISTS public.dept_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dept_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role = ANY (ARRAY['super-admin'::text, 'org-admin'::text, 'dept-admin'::text, 'member'::text])),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dept_members_dept_user_unique UNIQUE (dept_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_dept_members_dept_id ON public.dept_members USING btree (dept_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_org_id ON public.dept_members USING btree (org_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_user_id ON public.dept_members USING btree (user_id);

-- ── roles — GLOBAL reference data (D-04): the 4 fixed tiers. No org_id. ─────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
    role text PRIMARY KEY,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── role_permissions — GLOBAL reference data (D-04): the default-grant catalog. No org_id. ──────
-- permission_key is an OPEN text STRING (D-03) — NOT a DB enum, NO FK — so 167/169 INSERT new keys
-- with no schema change. Composite PK (role, permission_key) (user_memory_user_key_unique precedent 1919).
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role text NOT NULL REFERENCES public.roles(role) ON DELETE CASCADE,
    permission_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (role, permission_key)
);

-- ── org_invitations — near-complete (D-06). Stores token_hash, NEVER a raw token (T-161-04). ────
-- Phase 167 adds only app-layer provider wiring (resend/SES/none) + any dept-scoping column then.
CREATE TABLE IF NOT EXISTS public.org_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL CHECK (role = ANY (ARRAY['super-admin'::text, 'org-admin'::text, 'dept-admin'::text, 'member'::text])),
    token_hash text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])),
    expires_at timestamptz NOT NULL,
    invited_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON public.org_invitations USING btree (org_id);

-- ── sso_configs — deliberately THIN (D-07). Supabase Auth is the SAML service-provider; the
--    provider internals live in the Supabase-owned auth schema, NOT here. This table is a thin
--    org<->provider<->domain mapping. Phase 168 reveals its real shape live — invent nothing now.
CREATE TABLE IF NOT EXISTS public.sso_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email_domain text,
    provider_id text,
    attribute_mapping jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sso_configs_org_id ON public.sso_configs USING btree (org_id);
COMMENT ON COLUMN public.sso_configs.provider_id IS 'D-07: nullable pointer to the Supabase-owned SSO provider id (auth.sso_providers). NO FK into the Supabase auth schema.';

-- ================================================================================================
-- SECTION 2 — THE 3 SECURITY DEFINER HELPERS
-- Each is SECDEF + pins `SET search_path TO 'public'` (mandatory hardening, T-161-05;
-- folder_is_globally_visible precedent full-schema.sql:97-99). CREATE OR REPLACE = re-paste-safe.
-- ================================================================================================

-- current_user_org_ids() — ORG-02's recursion-break (breaks 42P17). Because it is SECDEF, its
-- internal read of org_members bypasses org_members' RLS, so a policy that CALLS it never re-enters
-- itself. Every other table's membership predicate calls THIS helper — never inlines an org_members
-- subquery (D-10). Shape = folder_is_globally_visible (LANGUAGE sql STABLE SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
    RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid();
$$;

-- current_user_has_permission(p_org_id, p_permission_key) — the write-side role gate (D-02) so
-- 164/166 have a real permission to check the day they land. The org_members JOIN role_permissions
-- lives INSIDE this SECDEF body (not in a policy predicate), which keeps the "no inlined org_members
-- subquery in a policy" rule intact AND breaks recursion (SECDEF bypasses org_members' RLS).
CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_org_id uuid, p_permission_key text)
    RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members m
    JOIN public.role_permissions rp ON rp.role = m.role
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
      AND rp.permission_key = p_permission_key
  );
$$;

-- create_org_with_default_dept(...) — D-11 construction guarantee: insert one org + its ONE default
-- department atomically. This phase ships ONLY the schema support; the creation-seam (trigger vs
-- app-layer vs both) that the 162 backfill / 167 JIT-provisioning both call is DEFERRED to the
-- 162/167 boundary — do NOT wire any creation trigger here.
CREATE OR REPLACE FUNCTION public.create_org_with_default_dept(
    p_name text,
    p_subscription_tier text DEFAULT NULL,
    p_default_dept_name text DEFAULT 'General'
)
    RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
BEGIN
  INSERT INTO public.organizations (name, subscription_tier)
  VALUES (p_name, p_subscription_tier)
  RETURNING id INTO v_org_id;

  INSERT INTO public.departments (org_id, name, is_default)
  VALUES (v_org_id, p_default_dept_name, true);

  RETURN v_org_id;
END;
$$;

-- CR-01 (161-REVIEW): create_org_with_default_dept is SECURITY DEFINER and bypasses RLS. Postgres grants
-- EXECUTE to PUBLIC by default, which Supabase auto-exposes as an anon/authenticated PostgREST RPC — i.e.
-- an ungated, RLS-bypassing org-creation write reachable by logged-out callers. Lock it to service_role:
-- the creation seam (162/167) runs service-side; the function owner (postgres) can always execute.
REVOKE EXECUTE ON FUNCTION public.create_org_with_default_dept(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_org_with_default_dept(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_org_with_default_dept(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_org_with_default_dept(text, text, text) TO service_role;

-- ================================================================================================
-- SECTION 3 — MEMBERSHIP-CORRECT RLS ON ALL 8 NEW TABLES  (D-08 correct-from-birth; these 8 are
--             EXCLUDED from Phase 163's 38-existing-table rewrite per D-09).
-- Idempotency idiom: a policy create has no IF NOT EXISTS, so each is drop-guarded first (015/019/029/030).
-- Every membership predicate routes through public.current_user_org_ids() / current_user_has_permission()
-- — no policy inlines an org_members subquery (the 42P17 contract, T-161-01).
-- ================================================================================================

-- (a) Enable RLS on all 8 tables (095:62-63 shape).
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dept_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sso_configs ENABLE ROW LEVEL SECURITY;

-- (b) Policies.

-- org_members — the LOCKED non-recursive pair (D-10 / ORG-02 / SC#2 / T-161-01). The self-rows-only
-- SELECT is a DIRECT column compare with NO org_members subquery (this is what breaks 42P17); the
-- org-roster read path routes through the SECDEF helper (any co-member sees the roster — tighten to
-- current_user_has_permission(org_id,'org:manage') later if roster visibility must be admin-only).
-- Writes are role-gated via current_user_has_permission (SECDEF → bypasses org_members RLS → no
-- recursion). Bootstrap of the FIRST member is a Phase 162/167 concern (via a SECDEF path).
DROP POLICY IF EXISTS org_members_self_select ON public.org_members;
CREATE POLICY org_members_self_select ON public.org_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS org_members_admin_select ON public.org_members;
CREATE POLICY org_members_admin_select ON public.org_members
  FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS org_members_insert ON public.org_members;
CREATE POLICY org_members_insert ON public.org_members
  FOR INSERT TO authenticated
  -- CR-02 (161-REVIEW): super-admin is the cross-org system role — never assignable via a user JWT.
  -- A user-JWT INSERT/UPDATE may set only org-admin/dept-admin/member; super-admin rows are created
  -- solely by the migration seed or a service-role/SECDEF path (both bypass RLS). Closes the org:manage
  -- self-escalation the plan's T-161-03 missed (reference-table lock alone did NOT secure the invariant).
  WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()) AND role <> 'super-admin');

DROP POLICY IF EXISTS org_members_update ON public.org_members;
CREATE POLICY org_members_update ON public.org_members
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(org_id, 'org:manage'))
  -- CR-02 (161-REVIEW): block self-escalation — an org:manage holder cannot UPDATE a membership row to
  -- the cross-org super-admin role (WITH CHECK gates the post-image; super-admin stays service-role-only).
  WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()) AND role <> 'super-admin');

DROP POLICY IF EXISTS org_members_delete ON public.org_members;
CREATE POLICY org_members_delete ON public.org_members
  FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));

-- organizations — keyed by id (its own id IS the org id, so membership predicate reads `id IN ...`).
-- Conservative writes (D-10): NO INSERT policy (creation via create_org_with_default_dept() SECDEF,
-- a user-JWT INSERT is a Phase 167 seam) and NO DELETE policy (org teardown is an operator/166 seam).
DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations
  FOR SELECT TO authenticated USING (id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS organizations_update ON public.organizations;
CREATE POLICY organizations_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(id, 'org:manage'))
  WITH CHECK (public.current_user_has_permission(id, 'org:manage') AND id IN (SELECT public.current_user_org_ids()));

-- departments — org-scoped; read = member of the org, write = org:manage. Every INSERT/UPDATE pins
-- org_id to the caller's orgs in the write-check clause (no cross-org write, T-161-02).
DROP POLICY IF EXISTS departments_select ON public.departments;
CREATE POLICY departments_select ON public.departments
  FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS departments_insert ON public.departments;
CREATE POLICY departments_insert ON public.departments
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS departments_update ON public.departments;
CREATE POLICY departments_update ON public.departments
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(org_id, 'org:manage'))
  WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS departments_delete ON public.departments;
CREATE POLICY departments_delete ON public.departments
  FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));

-- dept_members — org-scoped (via the denormalized org_id); write = org:manage.
DROP POLICY IF EXISTS dept_members_select ON public.dept_members;
CREATE POLICY dept_members_select ON public.dept_members
  FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS dept_members_insert ON public.dept_members;
CREATE POLICY dept_members_insert ON public.dept_members
  FOR INSERT TO authenticated
  -- CR-02 (161-REVIEW): same super-admin floor as org_members — dept_members.role carries the identical
  -- 4-tier CHECK, so without this an org:manage holder could escalate here instead. Service-role only.
  WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()) AND role <> 'super-admin');

DROP POLICY IF EXISTS dept_members_update ON public.dept_members;
CREATE POLICY dept_members_update ON public.dept_members
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(org_id, 'org:manage'))
  -- CR-02 (161-REVIEW): super-admin floor (see org_members_update).
  WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()) AND role <> 'super-admin');

DROP POLICY IF EXISTS dept_members_delete ON public.dept_members;
CREATE POLICY dept_members_delete ON public.dept_members
  FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));

-- org_invitations — org-scoped; write = org:invite (D-02 key). token_hash never leaves this table.
DROP POLICY IF EXISTS org_invitations_select ON public.org_invitations;
CREATE POLICY org_invitations_select ON public.org_invitations
  FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS org_invitations_insert ON public.org_invitations;
CREATE POLICY org_invitations_insert ON public.org_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(org_id, 'org:invite') AND org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS org_invitations_update ON public.org_invitations;
CREATE POLICY org_invitations_update ON public.org_invitations
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(org_id, 'org:invite'))
  WITH CHECK (public.current_user_has_permission(org_id, 'org:invite') AND org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS org_invitations_delete ON public.org_invitations;
CREATE POLICY org_invitations_delete ON public.org_invitations
  FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'org:invite'));

-- sso_configs — org-scoped; write = sso:manage (D-02 key).
DROP POLICY IF EXISTS sso_configs_select ON public.sso_configs;
CREATE POLICY sso_configs_select ON public.sso_configs
  FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS sso_configs_insert ON public.sso_configs;
CREATE POLICY sso_configs_insert ON public.sso_configs
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(org_id, 'sso:manage') AND org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS sso_configs_update ON public.sso_configs;
CREATE POLICY sso_configs_update ON public.sso_configs
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(org_id, 'sso:manage'))
  WITH CHECK (public.current_user_has_permission(org_id, 'sso:manage') AND org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS sso_configs_delete ON public.sso_configs;
CREATE POLICY sso_configs_delete ON public.sso_configs
  FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'sso:manage'));

-- roles + role_permissions — GLOBAL reference data (D-04 / T-161-03): read-all-authenticated +
-- NO write policy at all (INSERT/UPDATE/DELETE denied to EVERY JWT; only this migration, which runs
-- as owner/service-role and bypasses RLS, seeds them). An org-admin cannot grant themselves
-- super-admin perms. Byte-identical to model_overrides_read_all (full-schema.sql:3944).
DROP POLICY IF EXISTS roles_read_all ON public.roles;
CREATE POLICY roles_read_all ON public.roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS role_permissions_read_all ON public.role_permissions;
CREATE POLICY role_permissions_read_all ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- (c) Seed the CORE permission catalog (D-02/D-03). ON CONFLICT DO NOTHING = re-paste-safe (094:59-60).

-- The 4 fixed tiers (D-03).
INSERT INTO public.roles (role, description) VALUES
  ('super-admin', 'Cross-org system administrator — all permissions.'),
  ('org-admin', 'Organization administrator — manages org settings, members, and invitations.'),
  ('dept-admin', 'Department administrator — manages a department within an org.'),
  ('member', 'Baseline member — no management permissions.')
ON CONFLICT (role) DO NOTHING;

-- Default per-tier grants over the 5 milestone-known OPEN-STRING keys (D-02):
--   super-admin -> all 5; org-admin -> the 3 org:* keys; dept-admin -> the 1 dept:* key; member -> none.
-- `member` is intentionally absent (baseline = no manage perms). 168 MAY later additively INSERT an
-- org-admin -> sso:manage grant — do NOT seed it now (the whole point of open-string keys, D-03).
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('super-admin', 'org:manage'),
  ('super-admin', 'org:audit_view'),
  ('super-admin', 'dept:manage'),
  ('super-admin', 'org:invite'),
  ('super-admin', 'sso:manage'),
  ('org-admin', 'org:manage'),
  ('org-admin', 'org:audit_view'),
  ('org-admin', 'org:invite'),
  ('dept-admin', 'dept:manage')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ================================================================================================
-- SECTION 4 — NULLABLE org_id SWEEP on the 23 remaining user-facing tables (SC#3 / D-05 discretion).
-- Additive + byte-identical: each org_id is NULLABLE, with no foreign key and no not-null constraint
-- (that hardening lands in Phase 162/163). Unlike mig 096 (which added no index), this phase adds a
-- plain btree index per the CONTEXT discretion (cheap on all-NULL columns; ready for the 162 backfill
-- + 163 RLS). Column + comment shape = 096_org_id_stub_sweep.sql:18-26; index shape =
-- idx_classification_rules_org_id (full-schema.sql:2103).
--
-- Sweep set derived from the LIVE head-103 dump (RE-VERIFIED at execution): 42 CREATE TABLE total
--   - 13 already carry org_id (classification_rules, document_relationships, document_views,
--       documents, folders, harness_audit, metadata_field_definitions, operator_audit_log, skills,
--       threads, workflow_definitions, workflow_phases, workflow_runs) — NOT touched
--   - 4 system/identity, NOT user-facing (app_settings, model_capabilities_overrides, operator_users,
--       profiles) — EXCLUDED (stubbing operator_users' org_id would poison the one-way door, 095:5-8)
--   - 2 Phase-163-deferred (document_chunks, skill_embeddings) — EXCLUDED (their org_id denormalize +
--       composite index is TEN-04, the perf-gated crux)
--   = 23 swept below.
-- (The 9 existing un-indexed org_id columns are deliberately NOT back-indexed — scope kept tight.)
-- ================================================================================================

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON public.audit_log USING btree (org_id);
COMMENT ON COLUMN public.audit_log.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.code_executions ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_code_executions_org_id ON public.code_executions USING btree (org_id);
COMMENT ON COLUMN public.code_executions.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.document_images ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_document_images_org_id ON public.document_images USING btree (org_id);
COMMENT ON COLUMN public.document_images.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.document_tables ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_document_tables_org_id ON public.document_tables USING btree (org_id);
COMMENT ON COLUMN public.document_tables.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.eval_ratings ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_eval_ratings_org_id ON public.eval_ratings USING btree (org_id);
COMMENT ON COLUMN public.eval_ratings.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.eval_results ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_eval_results_org_id ON public.eval_results USING btree (org_id);
COMMENT ON COLUMN public.eval_results.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.eval_runs ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_eval_runs_org_id ON public.eval_runs USING btree (org_id);
COMMENT ON COLUMN public.eval_runs.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.message_feedback ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_message_feedback_org_id ON public.message_feedback USING btree (org_id);
COMMENT ON COLUMN public.message_feedback.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_messages_org_id ON public.messages USING btree (org_id);
COMMENT ON COLUMN public.messages.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.pdf_extraction_runs ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_pdf_extraction_runs_org_id ON public.pdf_extraction_runs USING btree (org_id);
COMMENT ON COLUMN public.pdf_extraction_runs.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_runs_org_id ON public.runs USING btree (org_id);
COMMENT ON COLUMN public.runs.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.sandbox_files ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_sandbox_files_org_id ON public.sandbox_files USING btree (org_id);
COMMENT ON COLUMN public.sandbox_files.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.skill_files ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_skill_files_org_id ON public.skill_files USING btree (org_id);
COMMENT ON COLUMN public.skill_files.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.skill_proposals ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_skill_proposals_org_id ON public.skill_proposals USING btree (org_id);
COMMENT ON COLUMN public.skill_proposals.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.skill_publish_overrides ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_skill_publish_overrides_org_id ON public.skill_publish_overrides USING btree (org_id);
COMMENT ON COLUMN public.skill_publish_overrides.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.skill_test_cases ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_skill_test_cases_org_id ON public.skill_test_cases USING btree (org_id);
COMMENT ON COLUMN public.skill_test_cases.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.skill_versions ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_skill_versions_org_id ON public.skill_versions USING btree (org_id);
COMMENT ON COLUMN public.skill_versions.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_todos_org_id ON public.todos USING btree (org_id);
COMMENT ON COLUMN public.todos.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.tuner_runs ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_tuner_runs_org_id ON public.tuner_runs USING btree (org_id);
COMMENT ON COLUMN public.tuner_runs.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.user_memory ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_user_memory_org_id ON public.user_memory USING btree (org_id);
COMMENT ON COLUMN public.user_memory.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_user_settings_org_id ON public.user_settings USING btree (org_id);
COMMENT ON COLUMN public.user_settings.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.workspace_file_versions ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_workspace_file_versions_org_id ON public.workspace_file_versions USING btree (org_id);
COMMENT ON COLUMN public.workspace_file_versions.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';

ALTER TABLE public.workspace_files ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_workspace_files_org_id ON public.workspace_files USING btree (org_id);
COMMENT ON COLUMN public.workspace_files.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';
