-- 177_rls_app_settings_user_settings.sql
-- BUG-260911-01 — measured on PRODUCTION 2026-09-11, read-only, via the Supabase MCP.
--
-- ⛔ WHAT IS WRONG, AND WHY NO GATE IN THIS PROJECT COULD SEE IT.
--
--   app_settings   rls_enabled = false   anon = arwdDxtm   (INSERT/SELECT/UPDATE/DELETE)
--   user_settings  rls_enabled = false   anon = arwdDxtm
--
-- `anon` is the role behind the publishable key that ships inside the frontend bundle, and
-- `public` is exposed to PostgREST. So `/rest/v1/app_settings` is readable AND WRITABLE by
-- anyone on the internet: maintenance_mode, sandbox_enabled, llm_model, feature_visibility,
-- llm_model_locked, setup_complete — and DELETE of the single settings row.
--
-- Supabase's own linter calls this ERROR `rls_disabled_in_public` (lint 0013). It is the only
-- ERROR-level finding on the project, and it contradicts the standing CLAUDE.md rule that every
-- table carries RLS.
--
-- ⚠ EVERY GATE STAYED GREEN, for the same reason migration 156's did: the backend reads these
--   tables through `get_supabase()`, which is built with the SERVICE ROLE (`dependencies.py:29`)
--   and bypasses RLS entirely. No unit test, typecheck, count gate or deploy check makes a
--   request as `anon`. One read-only advisor call surfaced it.
--
-- ✅ WHAT WAS **NOT** EXPOSED — both checked rather than assumed, and both clean:
--    1. Every secret column is NULL in production (all ten provider keys + supabase_management_token).
--       Production takes credentials from environment variables. NOTHING NEEDS ROTATING.
--    2. No cross-tenant read. `match_document_chunks` / `keyword_search_chunks` / `match_skills`
--       are anon-executable but filter on `auth.uid()`, not on their `match_user_id` argument —
--       the source says so itself: `dc.user_id = auth.uid()  -- owner (session-derived, NOT
--       match_user_id)`. Under anon that is NULL, so they return nothing. The v3.4 door holds.
--
--    The blast radius is CONFIGURATION AND AVAILABILITY, not data and not credentials.
--
-- ── WHY REVOKING IS SAFE — traced before writing, not assumed ────────────────────────────────
--
--   * The frontend NEVER touches either table directly. `grep '.from("app_settings"' frontend/src`
--     returns nothing; every hit for `.from(` is `Array.from`.
--   * The backend reads them through `get_supabase()` = SERVICE ROLE (`dependencies.py:29`),
--     which is unaffected by both the REVOKE and the RLS enable.
--   * `get_user_supabase()` (`dependencies.py:209`) does use the anon KEY, but always with a
--     Bearer JWT, so PostgREST runs it as `authenticated`, never as `anon`. Its callers
--     (`checked_queries.py`) do not reference either table.
--
--   Therefore no shipped path loses access. If one is found later, the fix is a POLICY, never a
--   re-grant to `anon`.
--
-- ── SCOPE: deliberately narrow ───────────────────────────────────────────────────────────────
--
--   This migration fixes the ERROR finding and the one destructive RPC. It deliberately does NOT
--   sweep the other anon-executable SECURITY DEFINER functions: they are self-authorising (see
--   above), and revoking them without tracing every caller would trade a config exposure for an
--   outage. That sweep is its own piece of work.
--
--   `operator_users` and `operator_audit_log` are deliberately LEFT ALONE. They have RLS enabled
--   with zero policies, which denies everything except the service role — that is FAIL-CLOSED and
--   correct by Phase 146's design (app-layer isolation, no RLS backstop). The advisor lists them
--   as INFO; "fixing" them into having policies would weaken them.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`.
-- Apply to LOCAL first, verify, then CLOUD.
-- ============================================================================================

BEGIN;

-- ── 1. app_settings — global config. No user column, so RLS with NO POLICY is the correct
--       shape: it denies every role except the service role, which is the only thing that
--       should ever write global configuration. Same shape as operator_users today.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_settings FROM anon;
REVOKE ALL ON public.app_settings FROM authenticated;

-- ── 2. user_settings — per-user rows. RLS plus an OWNER policy, because CLAUDE.md's rule is
--       "users only see their own data" and a future user-JWT read should succeed on its own
--       row rather than be denied wholesale.
--       ⚠ The table holds 0 rows in production today, so this policy is currently unexercised.
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_settings FROM anon;

DROP POLICY IF EXISTS user_settings_owner_select ON public.user_settings;
CREATE POLICY user_settings_owner_select ON public.user_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_settings_owner_update ON public.user_settings;
CREATE POLICY user_settings_owner_update ON public.user_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_settings_owner_insert ON public.user_settings;
CREATE POLICY user_settings_owner_insert ON public.user_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- `authenticated` keeps the table-level grants it needs for the policies above to be reachable;
-- the policies are what constrain it to its own row. DELETE is deliberately NOT granted a policy
-- — a user does not delete their settings row, the service role does.
REVOKE DELETE ON public.user_settings FROM authenticated;

-- ── 3. resize_embedding_column — SECURITY DEFINER, performs DDL, and changing the dimension
--       DELETES EVERY VECTOR IN THE CORPUS. It was executable by `anon` at
--       /rest/v1/rpc/resize_embedding_column. It is called by the re-embed path on the service
--       role and has no business being reachable from a browser.
--
--       ⚠⚠ REVOKING FROM `anon` ALONE IS A NO-OP, AND THIS WAS MEASURED, NOT REASONED.
--       The first version of this migration revoked from `anon` and `authenticated` only. It
--       applied cleanly to local and the verify block still reported
--       `*** FAIL *** anon cannot resize embeddings`. The ACL says why:
--
--           proacl = {=X/postgres, postgres=X/postgres, service_role=X/postgres}
--                     ↑ an EMPTY grantee before "=" is PUBLIC
--
--       **Postgres grants EXECUTE on every function to PUBLIC by default.** `anon` inherits it
--       from PUBLIC, so revoking the role changes nothing while the PUBLIC grant stands. The
--       revoke MUST target PUBLIC, and the roles that legitimately need it are then granted back
--       explicitly.
--
--       ⭐ The same is true of EVERY function the security advisor flagged as anon-executable.
--          A future sweep that revokes role-by-role will silently achieve nothing.
REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM authenticated;

-- The re-embed path calls this on the service role; restore it explicitly now PUBLIC is gone.
GRANT EXECUTE ON FUNCTION public.resize_embedding_column(integer) TO service_role;

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying, in the same editor. Every row must read PASS.
--
--   with c(what, ok) as (values
--     ('app_settings RLS on',
--      (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
--       where n.nspname='public' and c.relname='app_settings')),
--     ('user_settings RLS on',
--      (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
--       where n.nspname='public' and c.relname='user_settings')),
--     ('anon cannot read app_settings',
--      not has_table_privilege('anon','public.app_settings','SELECT')),
--     ('anon cannot write app_settings',
--      not has_table_privilege('anon','public.app_settings','UPDATE')),
--     ('anon cannot read user_settings',
--      not has_table_privilege('anon','public.user_settings','SELECT')),
--     ('anon cannot resize embeddings',
--      not has_function_privilege('anon','public.resize_embedding_column(integer)','EXECUTE')),
--     ('service_role still writes app_settings',
--      has_table_privilege('service_role','public.app_settings','UPDATE'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from c;
--
-- Then re-run the Supabase security advisor: `rls_disabled_in_public` must be GONE.
-- Then load the app and save the Settings page — it goes through the service role and must work.
-- ============================================================================================
