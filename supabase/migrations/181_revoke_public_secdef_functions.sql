-- 181: Revoke execute on SECURITY DEFINER functions from PUBLIC and anon (Phase 248 / CRED-03)
--
-- Closes the Supabase Security Advisor finding for anon-executable SECURITY DEFINER functions.
--
-- ── THE THREE GROUPS (248-MEASUREMENTS.md § 1) ──────────────────────────────────────────────────
-- Postgres grants EXECUTE on every function to PUBLIC by default. `anon` inherits from PUBLIC,
-- so `REVOKE ... FROM anon` changes nothing while the PUBLIC grant stands (measured in migration 177).
--
-- Group A (11 functions): Default PUBLIC grant present (=X/postgres). Must revoke from PUBLIC first,
-- then from anon, then grant back to authenticated / service_role only where legitimately needed.
--
-- Group B (2 functions): No PUBLIC grant; explicit anon + authenticated grants. Plain revoke from anon
-- and authenticated works directly.
--
-- Group C (2 functions): Already locked down (create_org_with_default_dept, resize_embedding_column).
--
-- ── TRIGGER FUNCTIONS vs RLS HELPERS / RPCs (248-MEASUREMENTS.md § 2 & BUS-235) ───────────────────
-- 1. TRIGGER FUNCTIONS (6 functions with 0 args):
--    - autofill_org_id_by_owner()       (37 bound triggers across 37 tables)
--    - autofill_org_id_from_parent()    (6 bound triggers across 6 tables)
--    - capture_skill_version()          (trigger on public.skills)
--    - handle_new_user()                (trigger on_auth_user_created on auth.users)
--    - stale_skill_embedding()          (trigger on public.skills)
--    - stale_skill_embedding_from_case()(trigger on test cases / skills)
--
--    Empirically verified against local Postgres :54322 (BUS-235 / TM-248-03):
--    PostgreSQL checks EXECUTE privilege at CREATE TRIGGER time, NOT at trigger execution time.
--    Revoking EXECUTE from PUBLIC, anon, and authenticated on trigger functions does NOT break DML
--    (INSERT / UPDATE) for authenticated users or signup on auth.users. It completely prevents
--    unintended direct execution via PostgREST RPC (/rest/v1/rpc/<trigger_fn>).
--
-- 2. RLS HELPERS & APP RPCs (7 functions):
--    - current_user_org_ids()           (Referenced by 147 RLS policies across the schema)
--    - connection_doc_is_visible(...)   (Referenced by connection-scoped document visibility policies)
--    - current_user_has_permission(...) (Referenced by org RBAC policies)
--    - folder_is_org_shared(...)        (Referenced by folder sharing RLS policies)
--    - keyword_search_chunks(...)       (App search RPC called via retrieval_service)
--    - match_document_chunks(...)       (App vector search RPC called via retrieval_service)
--    - match_skills(...)                (App vector search RPC called via skill_service)
--
--    Revoked from PUBLIC and anon. Granted explicitly to authenticated and service_role.

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · GROUP A: TRIGGER FUNCTIONS (Revoke from PUBLIC, anon, authenticated; keep service_role)
-- ═════════════════════════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.capture_skill_version() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.capture_skill_version() FROM anon;
REVOKE EXECUTE ON FUNCTION public.capture_skill_version() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.capture_skill_version() TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE EXECUTE ON FUNCTION public.stale_skill_embedding() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stale_skill_embedding() FROM anon;
REVOKE EXECUTE ON FUNCTION public.stale_skill_embedding() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.stale_skill_embedding() TO service_role;

REVOKE EXECUTE ON FUNCTION public.stale_skill_embedding_from_case() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stale_skill_embedding_from_case() FROM anon;
REVOKE EXECUTE ON FUNCTION public.stale_skill_embedding_from_case() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.stale_skill_embedding_from_case() TO service_role;


-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · GROUP B: TRIGGER FUNCTIONS (Explicit anon/authenticated grants; revoke both)
-- ═════════════════════════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.autofill_org_id_by_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.autofill_org_id_by_owner() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.autofill_org_id_by_owner() TO service_role;

REVOKE EXECUTE ON FUNCTION public.autofill_org_id_from_parent() FROM anon;
REVOKE EXECUTE ON FUNCTION public.autofill_org_id_from_parent() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.autofill_org_id_from_parent() TO service_role;


-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · GROUP A: RLS HELPERS & APP RPCs (Revoke from PUBLIC & anon; grant authenticated & service_role)
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- RLS helpers
REVOKE EXECUTE ON FUNCTION public.current_user_org_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_org_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO service_role;

REVOKE EXECUTE ON FUNCTION public.connection_doc_is_visible(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.connection_doc_is_visible(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.connection_doc_is_visible(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.connection_doc_is_visible(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.folder_is_org_shared(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.folder_is_org_shared(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.folder_is_org_shared(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.folder_is_org_shared(uuid) TO service_role;

-- App search RPCs
REVOKE EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.match_skills(vector, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_skills(vector, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_skills(vector, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_skills(vector, uuid, text) TO service_role;

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('anon cannot exec capture_skill_version',
--      not has_function_privilege('anon', 'public.capture_skill_version()', 'EXECUTE')),
--     ('anon cannot exec handle_new_user',
--      not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')),
--     ('anon cannot exec stale_skill_embedding',
--      not has_function_privilege('anon', 'public.stale_skill_embedding()', 'EXECUTE')),
--     ('anon cannot exec stale_skill_embedding_from_case',
--      not has_function_privilege('anon', 'public.stale_skill_embedding_from_case()', 'EXECUTE')),
--     ('anon cannot exec autofill_org_id_by_owner',
--      not has_function_privilege('anon', 'public.autofill_org_id_by_owner()', 'EXECUTE')),
--     ('anon cannot exec autofill_org_id_from_parent',
--      not has_function_privilege('anon', 'public.autofill_org_id_from_parent()', 'EXECUTE')),
--     ('anon cannot exec current_user_org_ids',
--      not has_function_privilege('anon', 'public.current_user_org_ids()', 'EXECUTE')),
--     ('authenticated can exec current_user_org_ids',
--      has_function_privilege('authenticated', 'public.current_user_org_ids()', 'EXECUTE')),
--     ('anon cannot exec connection_doc_is_visible',
--      not has_function_privilege('anon', 'public.connection_doc_is_visible(uuid, text)', 'EXECUTE')),
--     ('authenticated can exec connection_doc_is_visible',
--      has_function_privilege('authenticated', 'public.connection_doc_is_visible(uuid, text)', 'EXECUTE')),
--     ('anon cannot exec current_user_has_permission',
--      not has_function_privilege('anon', 'public.current_user_has_permission(uuid, text)', 'EXECUTE')),
--     ('authenticated can exec current_user_has_permission',
--      has_function_privilege('authenticated', 'public.current_user_has_permission(uuid, text)', 'EXECUTE')),
--     ('anon cannot exec folder_is_org_shared',
--      not has_function_privilege('anon', 'public.folder_is_org_shared(uuid)', 'EXECUTE')),
--     ('authenticated can exec folder_is_org_shared',
--      has_function_privilege('authenticated', 'public.folder_is_org_shared(uuid)', 'EXECUTE')),
--     ('anon cannot exec keyword_search_chunks',
--      not has_function_privilege('anon', 'public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[])', 'EXECUTE')),
--     ('authenticated can exec keyword_search_chunks',
--      has_function_privilege('authenticated', 'public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[])', 'EXECUTE')),
--     ('anon cannot exec match_document_chunks',
--      not has_function_privilege('anon', 'public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text)', 'EXECUTE')),
--     ('authenticated can exec match_document_chunks',
--      has_function_privilege('authenticated', 'public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text)', 'EXECUTE')),
--     ('anon cannot exec match_skills',
--      not has_function_privilege('anon', 'public.match_skills(vector, uuid, text)', 'EXECUTE')),
--     ('authenticated can exec match_skills',
--      has_function_privilege('authenticated', 'public.match_skills(vector, uuid, text)', 'EXECUTE'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
