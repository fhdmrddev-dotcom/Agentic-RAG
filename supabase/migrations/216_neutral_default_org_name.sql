-- 216 — a new personal org is named 'My organization', never the founder's email (Phase 296, SEED-364, D-06).
--
-- Until now handle_new_user named the personal org it provisions at signup
-- `coalesce(new.email, new.id::text) || '''s Organization'`. That name is shown to every colleague
-- later invited into the org (org switcher, members list, audit rows), so a founder's email address
-- leaked to everyone they ever invited. A constant is the only expression that cannot carry an email.
--
-- SCHEMA, NOT A SEED: no INSERT, no docs/OPERATOR.md Step-3 entry, no env var.
--
-- ⛔ NO EXISTING ORG IS RENAMED (D-06). This migration changes the function only; there is no
-- UPDATE of public.organizations. An org already named after an email keeps its name until its
-- admin renames it in the app — renaming someone's org from a migration is not ours to do.
--
-- PRIVILEGES: CREATE OR REPLACE FUNCTION keeps the function's existing ACL, so the mig-181 posture
-- (EXECUTE revoked from PUBLIC / anon / authenticated, granted to service_role) is unchanged.
-- SECURITY DEFINER, the pinned search_path, the org_members guard and the inner
-- EXCEPTION WHEN OTHERS swallow (signup can never fail on org provisioning, T-162-05) are kept.
-- The body is copied byte-for-byte from the CURRENT definition in supabase/full-schema.sql; the ONE
-- change is the org-name expression. scripts/full-schema-supplement.sql carries the same edit in
-- the same commit (D-25), because its copy is appended LAST and would otherwise win on greenfield.
--
-- APPLY (local): paste this whole file into the Supabase SQL editor (http://127.0.0.1:54323).
-- NEVER `supabase db push` / `supabase db reset` (they destroy dev data). Idempotent: re-running
-- it is a no-op. Then `bash scripts/regenerate-full-schema.sh` (NO --reset).
-- APPLY (cloud): belongs to the post-phase deploy — 214, 215, 216 in order, then
-- get_advisors(security). Never from a phase executor.

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Existing behavior, hardened with ON CONFLICT so a re-fire can't duplicate the profile row
  -- (profiles PK = id — verified live).
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'display_name')
  ON CONFLICT (id) DO NOTHING;

  -- NEW: defensive personal-org provisioning — identical logic to §A, wrapped in a swallow so a
  -- failure logs a WARNING and returns normally instead of aborting the signup INSERT.
  -- 216 (SEED-364): the org name is a constant; it no longer embeds the signup email.
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = new.id) THEN
      v_org_id := public.create_org_with_default_dept(
                    'My organization', NULL, 'General');
      INSERT INTO public.org_members (org_id, user_id, role)
      VALUES (v_org_id, new.id, 'org-admin')
      ON CONFLICT (org_id, user_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: personal-org creation failed for %: %', new.id, SQLERRM;
  END;

  RETURN new;
END;
$$;

-- VERIFY (read-only): expect one row reading PASS.
SELECT CASE
         WHEN pg_get_functiondef('public.handle_new_user()'::regprocedure) LIKE '%My organization%'
          AND pg_get_functiondef('public.handle_new_user()'::regprocedure) NOT LIKE '%new.email%'
         THEN 'PASS'
         ELSE 'FAIL'
       END AS migration_216_verify;
