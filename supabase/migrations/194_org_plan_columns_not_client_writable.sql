-- 194 — an org admin must not be able to raise their own plan (Phase 265, R265-audit-fixes-01).
--
-- Every tier gate (app/db/entitlements.py) reads organizations.subscription_tier and
-- organizations.add_ons. Supabase's default "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,
-- authenticated" left both client roles with TABLE-level INSERT and UPDATE on organizations,
-- and the only UPDATE policy is current_user_has_permission(id, 'org:manage'). So any org admin
-- could PATCH their own org to 'enterprise' through PostgREST and pass every refusal Phase 258
-- built. Measured on production 2026-09-24 (read-only): has_column_privilege('authenticated',
-- 'public.organizations', 'subscription_tier', 'UPDATE') = true; same for add_ons; no trigger.
--
-- ⚠ A column-only "REVOKE UPDATE (subscription_tier) … FROM authenticated" would be a NO-OP:
-- the privilege is held at TABLE level, and a column revoke cannot subtract from a table grant.
-- So: revoke INSERT/UPDATE at table level, then grant UPDATE back column by column.
--
-- Nothing legitimate is lost. No app code writes organizations. Org creation runs through the
-- SECURITY DEFINER functions create_org_with_default_dept / handle_new_user (owner rights,
-- unaffected), and the backend's asyncpg pool connects as postgres / service_role.
-- Plan changes stay a service-role / SQL-editor action.
--
-- PUBLIC is revoked too (idempotent; closes the default-grant trap CLAUDE.md records).
-- Idempotent: safe to paste twice.

REVOKE INSERT, UPDATE ON TABLE public.organizations FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.organizations FROM authenticated;
REVOKE INSERT, UPDATE ON TABLE public.organizations FROM PUBLIC;

-- Column-level UPDATE a client role never needed (the table-level grant implied them) —
-- cleared explicitly so the re-grant below is the ONLY source.
REVOKE UPDATE (id, name, slug, subscription_tier, add_ons, settings, created_at, updated_at)
    ON public.organizations FROM anon;
REVOKE UPDATE (id, name, slug, subscription_tier, add_ons, settings, created_at, updated_at)
    ON public.organizations FROM authenticated;

-- What an org admin may still edit, under the existing organizations_update RLS policy.
GRANT UPDATE (name, slug, settings, updated_at) ON public.organizations TO authenticated;
