-- ============================================================
-- FULL-SCHEMA SUPPLEMENT — cross-schema bootstrap bits
-- ============================================================
-- pg_dump --schema=public (used by regenerate-full-schema.sh) captures the
-- entire public schema (tables, functions, indexes, RLS on public tables) but
-- CANNOT capture objects that live in other schemas or are global:
--
--   * storage buckets        (rows in storage.buckets)
--   * storage RLS policies   (policies on storage.objects)
--   * the signup trigger     (trigger on auth.users)
--   * realtime memberships   (ALTER PUBLICATION supabase_realtime ...)
--
-- This file collects those bits so full-schema.sql is a TRUE one-paste
-- bootstrap for a fresh Supabase project (cloud or local). It is appended to
-- the generated dump by regenerate-full-schema.sh.
--
-- EVERYTHING HERE IS IDEMPOTENT — safe to run repeatedly (e.g. to patch an
-- already-provisioned DB that predates a new bucket/realtime table).
--
-- MAINTENANCE: when a NEW migration adds a storage bucket, an auth.users
-- trigger, or a realtime table, mirror it here (idempotently). Sources:
--   storage  -> migrations 017 (skill-files), 029 (documents, sandbox-outputs),
--               054 (workspace-files), 111 (skill-files read policy: legacy global
--               flag retired -> s.is_system OR s.is_org_shared, D-165-01), 112 (skill-files
--               read policy: shared branch ORG-GATED to current_user_org_ids(), SEED-125 CR-02)
--   auth     -> migration 001 (on_auth_user_created)
--   realtime -> migrations 002 (documents), 014 (folders), 032 (messages)
--   ACLs     -> migration 118 (connector_connections.secret_ciphertext column grant,
--               CR-01); migration 181 (function EXECUTE on 13 SECURITY DEFINER
--               functions, CRED-03 -- guarded by scripts/check-schema-acl-parity.cjs,
--               which FAILS when a migration's function ACL is not mirrored below).
--               pg_dump runs with --no-privileges, so ANY migration that narrows a
--               table OR function privilege must be mirrored here or it is absent
--               from every greenfield bootstrap.
-- ============================================================


-- ============================================================
-- 1. pgvector — ensure the extension exists in public.
--    (Belt-and-suspenders: the generator also injects this near the top so it
--    precedes the public.vector column/index definitions. Harmless here.)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


-- ============================================================
-- 2. Storage buckets (all private) + RLS on storage.objects
-- ============================================================

-- documents — path: {user_id}/{document_id}/{filename}
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;

-- sandbox-outputs — path: {user_id}/{execution_id}/{filename}
INSERT INTO storage.buckets (id, name, public)
VALUES ('sandbox-outputs', 'sandbox-outputs', false) ON CONFLICT (id) DO NOTHING;

-- skill-files — path: {user_id}/{...}
INSERT INTO storage.buckets (id, name, public)
VALUES ('skill-files', 'skill-files', false) ON CONFLICT (id) DO NOTHING;

-- workspace-files — path: {user_id}/{...}
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-files', 'workspace-files', false) ON CONFLICT (id) DO NOTHING;

-- documents policies
DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
CREATE POLICY "Users can read own documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can upload to own documents folder" ON storage.objects;
CREATE POLICY "Users can upload to own documents folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text));

-- sandbox-outputs policies
DROP POLICY IF EXISTS "Users can read own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can read own sandbox outputs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can upload to own sandbox outputs folder" ON storage.objects;
CREATE POLICY "Users can upload to own sandbox outputs folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can delete own sandbox outputs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (select auth.uid()::text));

-- skill-files policies (read allows owner OR files belonging to a system built-in
-- OR an org-shared skill WITHIN the caller's org — mig 112 SEED-125 CR-02: the shared
-- branch is ORG-GATED to genuinely match the mig-109 skill_files TABLE-RLS shape
-- [is_system universal OUTSIDE the org gate; owner/is_org_shared INSIDE
-- org_id ∈ current_user_org_ids()]. mig 111's earlier "reconciled" comment was inaccurate —
-- its branch was s.is_system OR s.is_org_shared with NO org predicate, a cross-org read leak;
-- 112 closes it. Storage RLS runs under the user JWT so auth.uid()/current_user_org_ids() resolve.)
DROP POLICY IF EXISTS "Users can read own skill files" ON storage.objects;
CREATE POLICY "Users can read own skill files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'skill-files'
    AND (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.skill_files sf
        JOIN public.skills s ON s.id = sf.skill_id
        WHERE sf.file_path = name
          AND (
            s.is_system = true
            OR (
              s.org_id IN (SELECT public.current_user_org_ids())
              AND (s.user_id = (select auth.uid()) OR s.is_org_shared = true)
            )
          )
      )
    )
  );
DROP POLICY IF EXISTS "Users can upload to own skill files folder" ON storage.objects;
CREATE POLICY "Users can upload to own skill files folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own skill files" ON storage.objects;
CREATE POLICY "Users can delete own skill files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));

-- workspace-files policies
DROP POLICY IF EXISTS "workspace_storage_select_own" ON storage.objects;
CREATE POLICY "workspace_storage_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workspace-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "workspace_storage_insert_own" ON storage.objects;
CREATE POLICY "workspace_storage_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workspace-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "workspace_storage_delete_own" ON storage.objects;
CREATE POLICY "workspace_storage_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workspace-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));


-- ============================================================
-- 3. Auth: auto-create a profile row on signup (trigger on auth.users)
-- ============================================================
-- NOTE: keep this body in sync with migration 105 §D (public.handle_new_user). pg_dump emits
-- handle_new_user in the public dump ABOVE, but this supplement copy is appended LAST, so this is
-- the definition a greenfield paste actually keeps. It must therefore carry the SAME mig-105
-- extension: provision a personal org for every new signup (identical logic to mig 105 §A), wrapped
-- in an inner EXCEPTION-WHEN-OTHERS swallow so org-creation failure can NEVER abort the auth.users
-- INSERT / break signup (T-162-05). KEEP security definer + pinned search_path (T-162-06). If a future
-- migration changes handle_new_user, update this copy in the SAME commit or greenfield deploys drift.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer set search_path = public
  as $$
declare
  v_org_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;

  -- defensive personal-org provisioning — identical logic to mig 105 §A, swallowed so a failure
  -- logs a WARNING and returns normally instead of aborting the signup INSERT.
  begin
    if not exists (select 1 from public.org_members m where m.user_id = new.id) then
      v_org_id := public.create_org_with_default_dept(
                    coalesce(new.email, new.id::text) || '''s Organization', null, 'General');
      insert into public.org_members (org_id, user_id, role)
      values (v_org_id, new.id, 'org-admin')
      on conflict (org_id, user_id) do nothing;
    end if;
  exception when others then
    raise warning 'handle_new_user: personal-org creation failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 4. Realtime: add tables to the supabase_realtime publication.
--    Wrapped so re-runs (table already a member) don't error.
-- ============================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 5. Column-level privilege: connector_connections.secret_ciphertext
--    (migration 118 / Phase 190 code-review finding CR-01)
-- ============================================================
-- ⚠ WHY THIS LIVES HERE RATHER THAN IN THE DUMP: regenerate-full-schema.sh runs
--    `pg_dump --no-privileges`, so full-schema.sql carries NO ACLs AT ALL
--    (`grep -c '^GRANT\|^REVOKE' supabase/full-schema.sql` -> 0, measured
--    2026-08-09). Migration 118 is therefore INVISIBLE to the generated dump —
--    its COMMENT survives, its GRANT does not. A greenfield project bootstrapped
--    from full-schema.sql alone would ship with `secret_ciphertext` readable over
--    PostgREST by every authenticated org member, which is exactly the defect 118
--    exists to close.
--
--    The rest of this file's ACL story is unchanged: Supabase's stock
--    `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role`
--    default privileges are what give every other table its grants, and that is
--    still the right posture for every table that holds no secret. This one holds
--    a tenant credential, so it opts out — and the opt-out has to be re-stated in
--    a place the bootstrap can see.
--
--    Idempotent, like everything else in this file: REVOKE and GRANT are.
--
--    ⚠ ORDER MATTERS AGAINST THE DEFAULT PRIVILEGES. This block must run AFTER
--    the table exists and after any blanket grant, which it does: the supplement
--    is appended at the END of full-schema.sql.
REVOKE ALL ON public.connector_connections FROM anon;
REVOKE ALL ON public.connector_connections FROM authenticated;

-- One column per line so the OMISSION is visible in a diff. The column that is not
-- here is `secret_ciphertext`.
-- ⚠ MEASURED DRIFT, 2026-08-26 (Phase 211). This list had fallen FOUR COLUMNS behind the
--    live table, and the failure it ships is TOTAL rather than partial. `_SELECTABLE_COLUMNS`
--    (connector_service.py) is DERIVED from `ConnectorConnectionResponse`'s keys, so every
--    read projects every response field by name. A greenfield project bootstrapped from
--    full-schema.sql would therefore name four columns `authenticated` has no grant on and
--    PostgREST answers `42501 permission denied for table connector_connections` — on EVERY
--    connector read, including a pre-existing row that has nothing to do with the new column.
--    It looks like an outage, not a permissions bug. That is migration 118's own lesson,
--    recorded in this very file, recurring because the mirror is manual.
--
--    Three of the four (`mcp_server_url`, `tool_grants`, `discovered_tools`) drifted in at
--    Phase 206 and were latent for the whole milestone; `service_id` is migration 127's.
--    Derived from the live table, not retyped:
--      select column_name from information_schema.column_privileges
--       where table_name='connector_connections' and grantee='authenticated'
--         and privilege_type='SELECT';
--    Compare that set against this block whenever a migration adds a column here.
GRANT SELECT (
    id,
    org_id,
    created_by,
    capability,
    name,
    config,
    is_enabled,
    last_checked_at,
    last_check_verdict,
    created_at,
    updated_at,
    mcp_server_url,
    tool_grants,
    discovered_tools,
    service_id
) ON public.connector_connections TO authenticated;

-- Writes stay at TABLE level, INCLUDING the secret column: the org-admin create/edit
-- path runs on the user-JWT client and must be able to store an `enc:v1:` envelope.
-- A role may INSERT into and UPDATE a column it can never SELECT.
GRANT INSERT, UPDATE, DELETE ON public.connector_connections TO authenticated;


-- ============================================================
-- 6. Function EXECUTE privileges (migration 181 / Phase 248, CRED-03)
-- ============================================================
-- ⚠ WHY THIS LIVES HERE RATHER THAN IN THE DUMP: regenerate-full-schema.sh runs
--    `pg_dump --no-privileges` (scripts/regenerate-full-schema.sh:104), so a dump
--    can NEVER carry a function grant. Migration 181 is therefore INVISIBLE to the
--    generated schema: its 13 functions survive, its 30 REVOKEs do not. A greenfield
--    project bootstrapped from full-schema.sql alone ships every one of them with the
--    default PUBLIC EXECUTE grant — anon-executable over PostgREST — which is exactly
--    the advisor finding 181 exists to close.
--
-- ⭐ THIRD RECURRENCE OF ONE CLASS. full-schema.sql documents this failure verbatim
--    for migration 118 (the §5 header directly above); §5 is that fix; and the
--    MAINTENANCE note at the top of this file already told maintainers to mirror ACLs.
--    181 reproduced it anyway.
--    ⛔ So this section is guarded by `scripts/check-schema-acl-parity.cjs`, which FAILS
--    when a migration grants or revokes EXECUTE on a function this file does not mirror.
--    A prose instruction is what did not work twice; do not add a fourth.
--
-- ⚠ ORDER IS LOAD-BEARING: `anon` INHERITS from PUBLIC, so `REVOKE … FROM anon` changes
--    nothing while the PUBLIC grant stands (measured in migration 177). PUBLIC is
--    revoked first, every time.
--
-- ⚠ TRIGGER FUNCTIONS ARE SAFE TO REVOKE. PostgreSQL checks EXECUTE at CREATE TRIGGER
--    time, not at trigger-execution time (empirically verified against local Postgres,
--    BUS-235 / TM-248-03). Revoking does NOT break INSERT/UPDATE or signup; it blocks
--    direct invocation via /rest/v1/rpc/<trigger_fn>.
--
-- ⛔ NO TRANSACTION WRAPPER HERE. The migration wraps itself; the supplement is pasted
--    inside whatever transaction the operator is running and no other section opens one.
--
-- Idempotent, like everything else in this file: REVOKE and GRANT are.
-- Runs at the END of full-schema.sql, so every function exists and Supabase's stock
-- default privileges have already been applied.
--
-- §6a below is migration 181: 13 functions · 30 REVOKEs · 20 GRANTs, COPIED from
-- supabase/migrations/181_revoke_public_secdef_functions.sql lines 45-122, group comments
-- and order included — an argument list is part of a function's identity, so nothing here
-- is retyped — PLUS two `FROM PUBLIC` revokes copied from migration 106 and marked inline.
-- §6b after it carries three further functions the parity gate found in migrations 012,
-- 104 and 177. 16 functions in total; the gate, not this comment, is the authority.

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

-- ⚠ THE TWO `FROM PUBLIC` LINES BELOW COME FROM MIGRATION 106 (106:146-147), NOT FROM 181.
--    181 omits them because 106 had already revoked PUBLIC on every live DB. `pg_dump
--    --no-privileges` loses 106's revoke too, so on a GREENFIELD database the default PUBLIC
--    grant is still standing and the role revokes below are INERT while it does — migration
--    177's measured trap, one register over. PUBLIC first, every time.
REVOKE EXECUTE ON FUNCTION public.autofill_org_id_by_owner()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.autofill_org_id_by_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.autofill_org_id_by_owner() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.autofill_org_id_by_owner() TO service_role;

-- ⚠ migration 106:147 — PUBLIC first (see the note above).
REVOKE EXECUTE ON FUNCTION public.autofill_org_id_from_parent() FROM PUBLIC;
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


-- ============================================================
-- 6b. Function EXECUTE privileges the parity gate found OUTSIDE migration 181
-- ============================================================
-- ⭐ FOUND BY `node scripts/check-schema-acl-parity.cjs` ON ITS VERY FIRST RUN (2026-09-16,
--    Phase 252 Plan 01 Task 2) — and recorded here rather than quietly folded into §6a, because
--    the finding is that the mirror gap was WIDER than the migration that prompted it. The phase's
--    research measured 181 and stopped; the gate scans every migration and named three more
--    functions whose ACLs NO bootstrap artifact carried:
--
--      · public.create_org_with_default_dept(text, text, text)  — migration 104:233-236
--      · public.resize_embedding_column(integer)                — migration 177:122-127
--      · public.query_user_documents(text)                      — migration 012:32
--
-- ⛔ resize_embedding_column DELETES EVERY VECTOR in document_chunks and skill_embeddings.
--    BUG-260911-01 found it callable UNAUTHENTICATED in production; migration 177 closed that on
--    every database that ran it, and a greenfield bootstrap re-opened it. That is this file's
--    whole failure class, one function over — which is the argument for the gate, not for a
--    fourth prose note.
--
-- ⚠ 012's grant is a WIDENING, not a narrowing, and is mirrored anyway: the rule this file now
--    enforces is "every function ACL in supabase/migrations/ appears here", with no exception
--    list. An exception list is a thing that rots; a complete statement of the posture is not.
--
-- Copied from the migrations named above, not retyped. Idempotent, like everything else here.

-- migration 104 — org creation RPC: service-role only.
REVOKE EXECUTE ON FUNCTION public.create_org_with_default_dept(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_org_with_default_dept(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_org_with_default_dept(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_org_with_default_dept(text, text, text) TO service_role;

-- migration 177 — the re-embed path calls this on the service role; nothing else may.
REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resize_embedding_column(integer) TO service_role;

-- migration 012 — schema-qualified here; the migration relies on search_path.
GRANT EXECUTE ON FUNCTION public.query_user_documents(text) TO authenticated;
