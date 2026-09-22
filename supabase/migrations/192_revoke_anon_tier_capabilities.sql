-- 192 — revoke anon's read of the tier→capability map (258 review item, BUS-283 #5).
--
-- Migration 186 granted SELECT on public.tier_capabilities to anon and wrote its read policy
-- TO anon. Nothing unauthenticated reads it: the backend resolves entitlements on the
-- postgres pool (app/db/entitlements.py) and the frontend has no read path at all. Exposing
-- the pricing map to anonymous callers was never a requirement, so it is withdrawn here —
-- a follow-up migration, never an edit to 186.
--
-- ⚠ Table privileges are revoked from anon AND PUBLIC (Postgres grants nothing to PUBLIC on a
-- table by default, but REVOKE FROM PUBLIC is idempotent and closes the trap CLAUDE.md
-- records for functions). Idempotent: safe to paste twice.

REVOKE ALL ON TABLE public.tier_capabilities FROM anon;
REVOKE ALL ON TABLE public.tier_capabilities FROM PUBLIC;

DROP POLICY IF EXISTS "tier_capabilities_read_all" ON public.tier_capabilities;
CREATE POLICY "tier_capabilities_read_all"
    ON public.tier_capabilities
    FOR SELECT
    TO authenticated, service_role
    USING (true);
