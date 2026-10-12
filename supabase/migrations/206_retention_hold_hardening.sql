-- 206 — Phase 275 code-review fix pass (275-REVIEW-backend.md B-CR-01..03, B-WR-01..03).
-- Hardens the legal hold and the retention engine shipped by 204/205. 204 and 205 are NOT edited
-- (both are applied); every change here is CREATE OR REPLACE / DROP-then-CREATE, so it is
-- idempotent: safe to paste twice.
--
-- WHAT EACH SECTION CLOSES
--   1. B-CR-01 — "held" no longer depends on a column the document's OWNER may change.
--      * The hold predicates join a hold to its COVERAGE ROW's org (lhd.org_id / lhf.org_id), never
--        to the document's current org_id. The delete triggers' "no active hold in OLD.org_id" fast
--        path is widened to "no active hold anywhere", so moving a row's org_id cannot skip the check.
--      * documents_hold_identity_guard: on a held document (or any member of a held version family)
--        a change of org_id or user_id is REFUSED (PT409). A filename change is ALLOWED (D-16: the
--        hold stops deletion only, and the watch sync renames a document when it is renamed at
--        source) but the hold FOLLOWS it: every hold that covers the old version family through
--        direct coverage is materialised onto every row of that family, so a rename can never
--        leave a version behind (the documents_sticky_hold_on_move pattern, for the name).
--      * folders_hold_identity_guard: a held folder's org_id / user_id cannot change either.
--   2. B-CR-02 — a user JWT can no longer delete a file in the `documents` bucket while a documents
--      row still names that path. The app doors delete the row first (D-38), so they still work;
--      the bytes of a held document can only go after its row, and its row is refused.
--   3. B-CR-03 — the D-35 coverage trigger fires only when the coverage KEY changes. The
--      `added_by ... ON DELETE SET NULL` action is an UPDATE of added_by alone and no longer runs
--      it, so deleting an auth user who once extended a since-released hold succeeds.
--   4. B-WR-01 — a folder policy's folder must be in the policy's org (refused on write, every
--      role). The evaluator side (one document's undecidable date or out-of-org folder is that
--      document's "can't be decided", never the org's) is in backend/app/services/retention/.
--   5. B-WR-02 — a new version inserted into an archived version family inherits the family's
--      archive state, so it is not agent-retrievable while the Library says "Archived" (D-18, D-25).
--   6. B-WR-03 — public.delete_folder_tree: the folder delete door's document delete and folder
--      delete run in ONE transaction as the caller (SECURITY INVOKER, RLS applies), so a hold
--      refusal anywhere in the cascade rolls back every document too (D-15: all-or-nothing). It
--      returns the deleted rows' file paths; the bytes are removed after the commit.
--
-- NO MATTER NAME LEAVES THE DATABASE IN AN ERROR (D-17): every refusal names an id only.
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor. NEVER `supabase db push` /
-- `db reset`. Then: bash scripts/regenerate-full-schema.sh (no --reset).
-- ⚠ PRODUCTION: apply 204, then 205, then 206 BEFORE the backend deploy that carries the 275 fix
--   pass (the folder delete door calls delete_folder_tree, which only 206 creates), then run
--   get_advisors(security).
-- ============================================================================

BEGIN;

-- ── 1. B-CR-01: the hold predicates anchor on the coverage row ──────────────────
CREATE OR REPLACE FUNCTION public.retention_held_documents(p_document_ids uuid[])
RETURNS TABLE(document_id uuid, hold_id uuid, held_since timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT DISTINCT x.doc_id, x.hid, x.since
  FROM (
    -- (a) directly, by version family (D-16). The hold is matched to its COVERAGE ROW's org.
    SELECT t.id AS doc_id, h.id AS hid, h.created_at AS since
    FROM public.documents t
    JOIN public.documents fam
      ON fam.org_id = t.org_id AND fam.user_id = t.user_id AND fam.filename = t.filename
    JOIN public.legal_hold_documents lhd ON lhd.document_id = fam.id
    JOIN public.legal_holds h
      ON h.id = lhd.hold_id AND h.org_id = lhd.org_id AND h.released_at IS NULL
    WHERE t.id = ANY (p_document_ids)
    UNION ALL
    -- (b) by its folder or any ancestor, evaluated now (D-05), matched to the coverage row's org
    SELECT t.id, h.id, h.created_at
    FROM public.documents t
    CROSS JOIN LATERAL public.retention_folder_ancestors(t.folder_id) a
    JOIN public.legal_hold_folders lhf ON lhf.folder_id = a.folder_id
    JOIN public.legal_holds h
      ON h.id = lhf.hold_id AND h.org_id = lhf.org_id AND h.released_at IS NULL
    WHERE t.id = ANY (p_document_ids)
      AND t.folder_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.legal_holds ah WHERE ah.released_at IS NULL)
  ) x;
$$;

CREATE OR REPLACE FUNCTION public.retention_held_folders(p_folder_ids uuid[])
RETURNS TABLE(folder_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT DISTINCT f.id
  FROM public.folders f
  WHERE f.id = ANY (p_folder_ids)
    AND EXISTS (SELECT 1 FROM public.legal_holds ah WHERE ah.released_at IS NULL)
    AND (
      EXISTS (
        SELECT 1
        FROM public.retention_folder_ancestors(f.id) a
        JOIN public.legal_hold_folders lhf ON lhf.folder_id = a.folder_id
        JOIN public.legal_holds h
          ON h.id = lhf.hold_id AND h.org_id = lhf.org_id AND h.released_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.retention_held_documents(
          ARRAY(SELECT d.id FROM public.documents d WHERE d.folder_id = f.id)
        )
      )
    );
$$;

-- ACLs re-asserted (CREATE OR REPLACE keeps them; restated so a reader of 206 alone sees them).
REVOKE EXECUTE ON FUNCTION public.retention_held_documents(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retention_held_documents(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.retention_held_documents(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.retention_held_documents(uuid[]) TO service_role;
REVOKE EXECUTE ON FUNCTION public.retention_held_folders(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retention_held_folders(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.retention_held_folders(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.retention_held_folders(uuid[]) TO service_role;

-- The delete triggers: the fast path no longer trusts OLD.org_id.
CREATE OR REPLACE FUNCTION public.documents_refuse_held_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- fast path: no active hold anywhere costs one partial-index probe per deleted row
  IF NOT EXISTS (SELECT 1 FROM public.legal_holds h WHERE h.released_at IS NULL) THEN
    RETURN OLD;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.retention_held_documents(ARRAY[OLD.id])) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'document % is on legal hold', OLD.id USING ERRCODE = 'PT409';
END;
$$;

CREATE OR REPLACE FUNCTION public.folders_refuse_held_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.legal_holds h WHERE h.released_at IS NULL) THEN
    RETURN OLD;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.retention_held_folders(ARRAY[OLD.id])) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'folder % contains documents on legal hold', OLD.id USING ERRCODE = 'PT409';
END;
$$;

-- A held document keeps its identity; a rename carries the hold with it.
CREATE OR REPLACE FUNCTION public.documents_hold_identity_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.legal_holds h WHERE h.released_at IS NULL) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.retention_held_documents(ARRAY[OLD.id])) THEN
    RETURN NEW;
  END IF;
  -- Positive form: only a pure rename passes; any org or owner change falls to the refusal.
  IF NEW.org_id IS NOT DISTINCT FROM OLD.org_id AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    -- The hold follows the name: every hold covering the OLD version family through direct
    -- coverage is written onto every row of that family (this row included), so the renamed row
    -- and the versions it leaves behind all stay held.
    INSERT INTO public.legal_hold_documents (hold_id, document_id, org_id, added_at)
    SELECT DISTINCT lhd.hold_id, fam.id, OLD.org_id, now()
    FROM public.documents src
    JOIN public.legal_hold_documents lhd ON lhd.document_id = src.id
    JOIN public.legal_holds h
      ON h.id = lhd.hold_id AND h.org_id = lhd.org_id AND h.released_at IS NULL AND h.org_id = OLD.org_id
    JOIN public.documents fam
      ON fam.org_id = OLD.org_id AND fam.user_id = OLD.user_id AND fam.filename = OLD.filename
    WHERE src.org_id = OLD.org_id AND src.user_id = OLD.user_id AND src.filename = OLD.filename
    ON CONFLICT (hold_id, document_id) DO NOTHING;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'document % is on legal hold', OLD.id USING ERRCODE = 'PT409';
END;
$$;

DROP TRIGGER IF EXISTS documents_hold_identity_guard ON public.documents;
CREATE TRIGGER documents_hold_identity_guard BEFORE UPDATE OF org_id, user_id, filename ON public.documents
    FOR EACH ROW
    WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id
          OR OLD.user_id IS DISTINCT FROM NEW.user_id
          OR OLD.filename IS DISTINCT FROM NEW.filename)
    EXECUTE FUNCTION public.documents_hold_identity_guard();

CREATE OR REPLACE FUNCTION public.folders_hold_identity_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.legal_holds h WHERE h.released_at IS NULL) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.retention_held_folders(ARRAY[OLD.id])) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'folder % contains documents on legal hold', OLD.id USING ERRCODE = 'PT409';
END;
$$;

DROP TRIGGER IF EXISTS folders_hold_identity_guard ON public.folders;
CREATE TRIGGER folders_hold_identity_guard BEFORE UPDATE OF org_id, user_id ON public.folders
    FOR EACH ROW
    WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id OR OLD.user_id IS DISTINCT FROM NEW.user_id)
    EXECUTE FUNCTION public.folders_hold_identity_guard();

-- ── 2. B-CR-02: a file that still backs a document row is not deletable by a user JWT ──
-- SECURITY DEFINER so the answer never depends on what the caller's documents RLS lets them see
-- (a row in another org they belong to must still count).
CREATE OR REPLACE FUNCTION public.storage_object_backs_document(p_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.documents d WHERE d.file_path = p_name);
$$;

REVOKE EXECUTE ON FUNCTION public.storage_object_backs_document(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.storage_object_backs_document(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.storage_object_backs_document(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_object_backs_document(text) TO service_role;

CREATE INDEX IF NOT EXISTS documents_file_path_idx ON public.documents (file_path);

DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents'
         AND (storage.foldername(name))[1] = (select auth.uid()::text)
         AND NOT public.storage_object_backs_document(name));

-- ── 3. B-CR-03: the coverage trigger fires on the coverage key only ─────────────
DROP TRIGGER IF EXISTS legal_hold_documents_same_org ON public.legal_hold_documents;
CREATE TRIGGER legal_hold_documents_same_org BEFORE INSERT OR UPDATE OF hold_id, document_id, org_id
    ON public.legal_hold_documents FOR EACH ROW EXECUTE FUNCTION public.legal_hold_coverage_same_org();
DROP TRIGGER IF EXISTS legal_hold_folders_same_org ON public.legal_hold_folders;
CREATE TRIGGER legal_hold_folders_same_org BEFORE INSERT OR UPDATE OF hold_id, folder_id, org_id
    ON public.legal_hold_folders FOR EACH ROW EXECUTE FUNCTION public.legal_hold_coverage_same_org();

-- ── 4. B-WR-01: a folder policy names a folder of its own org ───────────────────
CREATE OR REPLACE FUNCTION public.retention_policies_folder_same_org()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.folder_id IS NULL
     OR EXISTS (SELECT 1 FROM public.folders f WHERE f.id = NEW.folder_id AND f.org_id = NEW.org_id) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'a retention policy can only name a folder of its own organization' USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS retention_policies_folder_same_org ON public.retention_policies;
CREATE TRIGGER retention_policies_folder_same_org BEFORE INSERT OR UPDATE OF folder_id, org_id
    ON public.retention_policies FOR EACH ROW EXECUTE FUNCTION public.retention_policies_folder_same_org();

-- ── 5. B-WR-02: a new version joins its family's archive ────────────────────────
-- Runs after documents_autofill_org_id (triggers fire in name order), so NEW.org_id is set. The
-- family key is the disposition key (org, owner, filename, folder) the sweep archives together.
-- `retrievable` is a generated column, computed after BEFORE triggers, so it follows.
CREATE OR REPLACE FUNCTION public.documents_inherit_family_archive()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  fam record;
BEGIN
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT d.archived_at, d.archived_policy_id, d.archived_policy_name
    INTO fam
    FROM public.documents d
   WHERE d.org_id = NEW.org_id AND d.user_id = NEW.user_id AND d.filename = NEW.filename
     AND d.folder_id IS NOT DISTINCT FROM NEW.folder_id
     AND d.archived_at IS NOT NULL
   ORDER BY d.is_latest DESC, d.version_number DESC NULLS LAST, d.archived_at DESC
   LIMIT 1;
  IF FOUND THEN
    NEW.archived_at := fam.archived_at;
    NEW.archived_policy_id := fam.archived_policy_id;
    NEW.archived_policy_name := fam.archived_policy_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_inherit_family_archive ON public.documents;
CREATE TRIGGER documents_inherit_family_archive BEFORE INSERT ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.documents_inherit_family_archive();

-- ── 6. B-WR-03: the folder delete is one transaction ────────────────────────────
-- SECURITY INVOKER: the caller's RLS decides what is visible and deletable, exactly as the two
-- PostgREST statements it replaces did. A PT409 from any cascaded folder or document trigger
-- aborts the whole call, so no document is deleted when the folder is refused.
CREATE OR REPLACE FUNCTION public.delete_folder_tree(p_folder_id uuid)
RETURNS TABLE(document_id uuid, file_path text)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'a signed-in user is required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  WITH RECURSIVE sub(id) AS (
    SELECT f.id FROM public.folders f WHERE f.id = p_folder_id
    UNION ALL
    SELECT c.id FROM public.folders c JOIN sub s ON c.parent_id = s.id
  ) CYCLE id SET is_cycle USING path,
  gone AS (
    DELETE FROM public.documents d
     WHERE d.folder_id IN (SELECT s.id FROM sub s WHERE NOT s.is_cycle)
       AND d.user_id = v_uid
    RETURNING d.id AS gone_id, d.file_path AS gone_path
  )
  SELECT g.gone_id, g.gone_path FROM gone g;
  DELETE FROM public.folders f WHERE f.id = p_folder_id AND f.user_id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_folder_tree(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_folder_tree(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_folder_tree(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_folder_tree(uuid) TO service_role;

-- Trigger functions are never called directly (PUBLIC first — anon inherits from PUBLIC).
REVOKE EXECUTE ON FUNCTION public.documents_hold_identity_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.folders_hold_identity_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.retention_policies_folder_same_org() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.documents_inherit_family_archive() FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('the hold predicates join a hold to its coverage row''s org',
--      (select bool_and(prosrc like '%h.org_id = lhd.org_id%' or prosrc like '%h.org_id = lhf.org_id%')
--         from pg_proc where oid in ('public.retention_held_documents(uuid[])'::regprocedure,
--                                    'public.retention_held_folders(uuid[])'::regprocedure))
--      and (select prosrc not like '%h.org_id = t.org_id%'
--             from pg_proc where oid = 'public.retention_held_documents(uuid[])'::regprocedure)),
--     ('the delete triggers no longer trust OLD.org_id',
--      (select bool_and(prosrc not like '%OLD.org_id%')
--         from pg_proc where proname in ('documents_refuse_held_delete', 'folders_refuse_held_delete'))),
--     ('the identity guards exist on documents and folders',
--      (select count(*) = 2 from pg_trigger where not tgisinternal
--        and tgname in ('documents_hold_identity_guard', 'folders_hold_identity_guard'))),
--     ('the coverage triggers carry a column list',
--      (select bool_and(pg_get_triggerdef(oid) like '%UPDATE OF hold_id%') from pg_trigger
--        where tgname in ('legal_hold_documents_same_org', 'legal_hold_folders_same_org'))),
--     ('the documents storage DELETE policy refuses a file that backs a row',
--      (select pg_get_expr(polqual, polrelid) like '%storage_object_backs_document%'
--         from pg_policy where polrelid = 'storage.objects'::regclass
--          and polname = 'Users can delete own documents')),
--     ('authenticated can EXECUTE storage_object_backs_document, anon cannot',
--      has_function_privilege('authenticated', 'public.storage_object_backs_document(text)', 'EXECUTE')
--      and not has_function_privilege('anon', 'public.storage_object_backs_document(text)', 'EXECUTE')),
--     ('the policy-folder and archive-inheritance triggers exist',
--      (select count(*) = 2 from pg_trigger where not tgisinternal
--        and tgname in ('retention_policies_folder_same_org', 'documents_inherit_family_archive'))),
--     ('delete_folder_tree is SECURITY INVOKER, authenticated may call it, anon may not',
--      (select not prosecdef from pg_proc where oid = 'public.delete_folder_tree(uuid)'::regprocedure)
--      and has_function_privilege('authenticated', 'public.delete_folder_tree(uuid)', 'EXECUTE')
--      and not has_function_privilege('anon', 'public.delete_folder_tree(uuid)', 'EXECUTE')),
--     ('the hold predicates are still the service role''s only',
--      not has_function_privilege('authenticated', 'public.retention_held_documents(uuid[])', 'EXECUTE')
--      and not has_function_privilege('authenticated', 'public.retention_held_folders(uuid[])', 'EXECUTE')
--      and has_function_privilege('service_role', 'public.retention_held_documents(uuid[])', 'EXECUTE'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
