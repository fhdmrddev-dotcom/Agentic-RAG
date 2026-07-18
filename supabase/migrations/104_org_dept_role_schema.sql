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
--     DROP POLICY IF EXISTS + CREATE POLICY (CREATE POLICY has no IF NOT EXISTS), and every seed is
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
