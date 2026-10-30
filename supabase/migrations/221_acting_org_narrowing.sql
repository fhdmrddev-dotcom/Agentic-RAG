-- 221 — Phase 304 (KEY-02; D-13, D-14, D-16, D-39, D-42)
-- "A key acts as you in ONE org": the membership set can be NARROWED, never widened.
--
-- WHAT. Three things, and nothing else (the switch columns are in 220):
--   1. public.current_user_org_ids() intersects the caller's membership with the transaction-local
--      GUC app.acting_org_id (D-13). Unset (or empty) = the caller's FULL membership set, exactly as
--      today. Set to an org the caller belongs to = that org only. Set to an org the caller does NOT
--      belong to = NOTHING. The GUC is an AND on org_members, so it can only narrow.
--      The backend sets it with set_config(..., true) inside _apply_rls_user_context, and only when
--      the acting-org contextvar is set by app/security/acting_member.py (D-14). is_local = true
--      reverts it at COMMIT, so it never reaches the next pool borrower.
--      A malformed value makes the ::uuid cast raise: the statement errors, which fails CLOSED.
--   2. Every membership reader that bypassed the function is routed through it (D-16, D-39):
--        · current_user_has_permission(uuid, text) — gains
--          `AND m.org_id IN (SELECT public.current_user_org_ids())`; every other arm kept;
--        · expert_bundles_read_policy / expert_bundles_write_policy;
--        · expert_grants_read_policy  / expert_grants_write_policy;
--        · model_rates_select_policy  / model_rates_insert_policy.
--      The FOR ALL write policies are routed too, because permissive policies are OR'ed for SELECT:
--      routing only the read policy would leave the write policy re-admitting the same rows (R-05b).
--      A direct `SELECT m.org_id FROM org_members m WHERE m.user_id = auth.uid()` cannot be narrowed
--      in place — org_members_self_select admits the member's rows in every org whatever the GUC
--      says — so the only way to narrow is to stop reading org_members directly. model_rates_insert
--      keeps its admin/owner role arm (role is not in the function), now intersected with it.
--   3. D-42 (BUG-261030-03): DELETE, TRUNCATE, TRIGGER and REFERENCES on public.organizations are
--      revoked from PUBLIC, anon and authenticated (PUBLIC first — the CLAUDE.md trap). Default
--      privileges left them there; no app path uses them (org lifecycle runs on the backend pool).
--
-- ⛔ THE PLANNER EVIDENCE IS VOID IF ANY FUNCTION ATTRIBUTE CHANGES. current_user_org_ids() is
-- re-declared with EXACTLY its measured header: LANGUAGE sql, STABLE, SECURITY DEFINER,
-- SET search_path TO 'public', and no ROWS / COST clause (it relies on the defaults ROWS 1000,
-- COST 100, measured with pg_get_functiondef + pg_proc before writing this). PostgreSQL never
-- inlines a SECURITY DEFINER function or one with a SET clause, so the planner sees only those
-- attributes; with them unchanged the plan is unchanged. Proven, not assumed:
-- scripts/explain-acting-org.py -> .planning/phases/304-personal-mcp-keys-that-act-as-you/
-- evidence/explain-acting-org.txt (old vs new body, GUC unset: identical plan text; every
-- current_user_org_ids() node loops=1 — a hashed SubPlan, evaluated once per statement).
--
-- ACLs. Mig 181's four REVOKE/GRANT lines are re-issued VERBATIM after each re-declared function
-- (REVOKE FROM PUBLIC first). CREATE OR REPLACE keeps the existing ACL, so this is belt and braces —
-- and it keeps the migration self-sufficient if it is ever pasted onto a database without 181.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset), and
--       backend/venv/Scripts/python scripts/check-migration-221-live.py.
-- ⚠ PRODUCTION: paste with Phase 305 (D-30), under per-action operator approval, BEFORE the 304
--   backend boots there; then run get_advisors(security) (D-33).
-- ============================================================================

BEGIN;

-- ── 1. current_user_org_ids(): narrow-only (D-13) ───────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT org_id FROM public.org_members
   WHERE user_id = auth.uid()
     AND (NULLIF(current_setting('app.acting_org_id', true), '') IS NULL
          OR org_id = NULLIF(current_setting('app.acting_org_id', true), '')::uuid);
$function$;
REVOKE EXECUTE ON FUNCTION public.current_user_org_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_org_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO service_role;

-- ── 2a. current_user_has_permission: routed (D-39) ──────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_org_id uuid, p_permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members m
    JOIN public.role_permissions rp ON rp.role = m.role
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
      AND rp.permission_key = p_permission_key
      AND m.org_id IN (SELECT public.current_user_org_ids())
  );
$function$;
REVOKE EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) TO service_role;

-- ── 2b. expert_bundles (mig 187) — both policies, every other arm byte-identical ──
DROP POLICY IF EXISTS "expert_bundles_read_policy" ON public.expert_bundles;
CREATE POLICY "expert_bundles_read_policy"
    ON public.expert_bundles
    FOR SELECT
    TO authenticated, service_role
    USING (
        auth.role() = 'service_role'
        OR is_system = true
        OR (
            org_id IN (SELECT public.current_user_org_ids())
            AND (visibility IN ('org', 'public') OR created_by = auth.uid())
        )
    );

DROP POLICY IF EXISTS "expert_bundles_write_policy" ON public.expert_bundles;
CREATE POLICY "expert_bundles_write_policy"
    ON public.expert_bundles
    FOR ALL
    TO authenticated, service_role
    USING (
        auth.role() = 'service_role'
        OR (
            is_system = false
            AND org_id IN (SELECT public.current_user_org_ids())
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            is_system = false
            AND org_id IN (SELECT public.current_user_org_ids())
        )
    );

-- ── 2c. expert_grants (mig 189) — both policies ─────────────────────────────
DROP POLICY IF EXISTS "expert_grants_read_policy" ON public.expert_grants;
CREATE POLICY "expert_grants_read_policy"
    ON public.expert_grants
    FOR SELECT
    TO authenticated, service_role
    USING (
        auth.role() = 'service_role'
        OR expert_id IN (
            SELECT eb.id
            FROM public.expert_bundles eb
            WHERE eb.org_id IN (SELECT public.current_user_org_ids())
        )
    );

DROP POLICY IF EXISTS "expert_grants_write_policy" ON public.expert_grants;
CREATE POLICY "expert_grants_write_policy"
    ON public.expert_grants
    FOR ALL
    TO authenticated, service_role
    USING (
        auth.role() = 'service_role'
        OR expert_id IN (
            SELECT eb.id
            FROM public.expert_bundles eb
            WHERE eb.org_id IN (SELECT public.current_user_org_ids())
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR expert_id IN (
            SELECT eb.id
            FROM public.expert_bundles eb
            WHERE eb.org_id IN (SELECT public.current_user_org_ids())
        )
    );

-- ── 2d. model_rates (mig 183) — both policies (183 created them without a DROP) ──
DROP POLICY IF EXISTS "model_rates_select_policy" ON public.model_rates;
CREATE POLICY "model_rates_select_policy"
    ON public.model_rates
    FOR SELECT
    TO authenticated, service_role
    USING (org_id IS NULL OR org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS "model_rates_insert_policy" ON public.model_rates;
CREATE POLICY "model_rates_insert_policy"
    ON public.model_rates
    FOR INSERT
    TO authenticated, service_role
    WITH CHECK (
        auth.role() = 'service_role' OR (
            org_id IS NOT NULL AND org_id IN (
                SELECT m.org_id FROM public.org_members m
                WHERE m.user_id = auth.uid() AND m.role IN ('admin', 'owner')
                  AND m.org_id IN (SELECT public.current_user_org_ids())
            )
        )
    );

-- ── 3. D-42 (BUG-261030-03): organizations — no destructive privilege for a client role ──
REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.organizations FROM PUBLIC;
REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.organizations FROM anon;
REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.organizations FROM authenticated;

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('current_user_org_ids reads app.acting_org_id',
--      (select position('app.acting_org_id' in pg_get_functiondef('public.current_user_org_ids()'::regprocedure)) > 0)),
--     ('current_user_org_ids attributes unchanged (STABLE, DEFINER, ROWS 1000, search_path)',
--      (select provolatile = 's' and prosecdef and prorows = 1000 and procost = 100
--              and proconfig::text like '%search_path%'
--         from pg_proc where oid = 'public.current_user_org_ids()'::regprocedure)),
--     ('current_user_has_permission routes through current_user_org_ids',
--      (select position('current_user_org_ids' in pg_get_functiondef('public.current_user_has_permission(uuid, text)'::regprocedure)) > 0)),
--     ('no routed policy reads org_members except model_rates_insert''s role arm',
--      (select count(*) = 0 from pg_policies where schemaname = 'public'
--        and policyname in ('expert_bundles_read_policy', 'expert_bundles_write_policy',
--                           'expert_grants_read_policy', 'expert_grants_write_policy',
--                           'model_rates_select_policy')
--        and (coalesce(qual, '') like '%org_members%' or coalesce(with_check, '') like '%org_members%'))),
--     ('anon cannot exec current_user_org_ids',
--      not has_function_privilege('anon', 'public.current_user_org_ids()', 'EXECUTE')),
--     ('anon cannot exec current_user_has_permission',
--      not has_function_privilege('anon', 'public.current_user_has_permission(uuid, text)', 'EXECUTE')),
--     ('anon holds no destructive privilege on organizations',
--      not has_table_privilege('anon', 'public.organizations', 'DELETE')
--      and not has_table_privilege('anon', 'public.organizations', 'TRUNCATE')
--      and not has_table_privilege('anon', 'public.organizations', 'TRIGGER')
--      and not has_table_privilege('anon', 'public.organizations', 'REFERENCES')),
--     ('authenticated holds no destructive privilege on organizations',
--      not has_table_privilege('authenticated', 'public.organizations', 'DELETE')
--      and not has_table_privilege('authenticated', 'public.organizations', 'TRUNCATE')
--      and not has_table_privilege('authenticated', 'public.organizations', 'TRIGGER')
--      and not has_table_privilege('authenticated', 'public.organizations', 'REFERENCES'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
