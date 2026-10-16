-- ============================================================================
-- 208 — Phase 284-06 (SEED-357 · FIX-11 / D-22): the Library's FIRST PAGE stops growing with the
-- library. Root page 1 (`GET /documents?folder_id=root`) and Find page 1 (`POST /document-search`)
-- were 2.54x / 2.59x slower at 50k documents than at 10k; D-22 asks for ≤ 1.5x.
--
-- WHERE THE TIME WAS (measured, 284-MEASUREMENTS.md "SEED-357 — where the 50k time goes"):
--   pg_stat_statements around real API calls: of a 446 ms Root request the ONE PostgREST statement
--   was 408 ms, and of a 466 ms Find request 417 ms. The API side is flat at ~40-60 ms. Inside the
--   statement two things are linear in the library:
--     (a) the page has no ordered path. 207's `user_id = auth.uid() OR folder_id IN (shared)`
--         is served by a BitmapOr, so the planner sorts every matched row. Root's
--         document_tables(count) / document_images(count) embeds are LATERAL joins BELOW that
--         sort, so they ran for all 29,808 Root rows at 50k, not for the 25 on the page.
--     (b) the documents SELECT policy (migration 154) calls auth.uid() BARE, so it is evaluated
--         PER ROW. PostgREST sets only request.jwt.claims, so every evaluation re-parses the
--         whole JWT payload. The exact count alone cost 138 ms (Root) / 223 ms (Find) at 50k.
--   Before 208, at 50k, as authenticated with a real token's claims: Root statement 494 ms,
--   Find 474 ms. After 208, the AFTER figures are in 284-MEASUREMENTS.md "AFTER (208)". The
--   page becomes a ~25-row index walk, and the exact count stays linear but costs ~0.5 µs per row.
--
-- WHAT EACH SECTION DOES
--   1. Three btree indexes, each leading on (user_id, is_latest) so the walk is PER CALLER and
--      never visits another tenant's documents:
--        documents_library_root_created_idx  (… created_at DESC, id DESC) WHERE folder_id IS NULL
--          — Root page 1, `order=created_at.desc,id.desc` (the browse list's default order).
--        documents_library_added_idx          (… created_at DESC NULLS LAST, id)
--          — Find page 1, `sort=added_desc` (`created_at DESC NULLS LAST, id ASC`).
--        documents_library_folder_created_idx (… folder_id, created_at DESC, id DESC)
--                                             WHERE folder_id IS NOT NULL
--          — a folder's page 1 (`folder_id=eq.X`; the equality makes folder_id redundant for
--            ordering, which `IS NULL` cannot do — hence Root's own partial index).
--      All three work under a GENERIC plan too: the leading columns are equalities, and the
--      partial predicates follow from `folder_id IS NULL` (a literal in PostgREST's SQL) and
--      from `folder_id = $n` (strict, so it implies IS NOT NULL).
--      PostgREST prepares its statements, so a generic plan is possible after five executions.
--   2. The documents SELECT policy: `auth.uid() = user_id` → `(SELECT auth.uid()) = user_id`.
--      This is the same predicate. auth.uid() is STABLE, so its value cannot change within a
--      statement. Wrapped, it is evaluated ONCE (an InitPlan) instead of once per row. Name,
--      command, role and every other arm are 154's, unchanged. A guard REFUSES unless the
--      current policy is exactly 154's (or already 208's), so a policy that drifted in some
--      environment is never silently overwritten.
--   3. public.library_documents, rewritten as a UNION ALL that an index can walk IN ORDER.
--      Same 36 columns in the same order, same security_invoker, same grants, same row set:
--        leg 1 = the caller's own documents; leg 2 = documents in org-shared folders the caller
--        does not own, minus the caller's own (so the legs are disjoint and UNION ALL is exact).
--      ⚠ WHY THIS SHAPE (Postgres 17.6, measured — the obvious shapes do NOT work):
--        * A UNION ALL leg with a WHERE clause cannot be flattened into an appendrel
--          (is_safe_append_member: "the child can't have any WHERE quals"). It is then planned as
--          an isolated subquery that never sees the outer ORDER BY / LIMIT, so it is sorted in
--          full again. Measured: Find got WORSE, 474 → 956 ms. So NEITHER leg has a WHERE. Each
--          leg carries a constant `leg`, and every predicate lives in the outer WHERE, which
--          Postgres pushes into each child and const-folds per leg.
--        * The own leg's `user_id = auth.uid()` must make the index's leading user_id redundant
--          for ORDERING, and only an equivalence class does that. A qual that exists in one child
--          only never forms one. So both legs expose `scope_key` (leg 1: d.user_id, leg 2:
--          auth.uid()). The outer `scope_key = (SELECT auth.uid())` is ONE parent-level
--          equality: for leg 1 it is the caller filter, for leg 2 it is constant-true (or NULL for
--          a caller with no uid, so fail-closed is kept).
--        * leg 2's folder set is `folder_id = ANY (ARRAY(SELECT …))`, an InitPlan the
--          folder_id index can use, instead of 207's `IN (SELECT …)` semi-join (same set: a NULL
--          folder_id matches neither).
--        * `id` is read from a LEFT JOIN back to public.documents (`o.id`), not from the union.
--          PostgREST infers an embed (`document_tables(count)` — GET /documents' LIST_SELECT) by
--          tracing a view column to its base column, and it cannot trace through a UNION. With
--          `u.id` every embedded read failed with PGRST200 "Could not find a relationship between
--          'library_documents' and 'document_tables'" (measured on the first local apply; 8 live
--          tests red, reverted to 207 within minutes). The join costs ~nothing:
--            - on the page it is a primary-key probe for the ~25 rows the walk returns;
--            - on the count it is REMOVED (a LEFT JOIN to a unique key whose columns the count
--              never reads);
--            - the row is the same row under the same RLS, so `o.id` = `u.id` always.
--      The derived columns (filename_key, version_count, has_earlier) are 207's text verbatim.
--      Postgres evaluates them AFTER the sort, for the page's rows only.
--      `leg` and `scope_key` are internal: the view's output columns are 207's, which the drift
--      fence in test_284_view_live.py pins.
--   4. Grants, re-asserted exactly as 207: SELECT only, to authenticated and service_role;
--      nothing to PUBLIC or anon (mirrored in scripts/full-schema-supplement.sql).
--   No new function and no definer-rights object (D-18 / T-284-06).
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor. NEVER `supabase db push` /
-- `db reset`. Then: bash scripts/regenerate-full-schema.sh (no --reset). Safe to paste twice
-- (IF NOT EXISTS indexes; the policy guard accepts 208's own form; CREATE OR REPLACE VIEW with
-- an identical column list; REVOKE/GRANT are idempotent).
-- ⚠ PRODUCTION ORDER: 207 → 208 → get_advisors(security) → backend → frontend. 208 needs no
--   backend change and the backend needs no 208, so the order only matters for performance.
--   Plain CREATE INDEX (no CONCURRENTLY) is right at production's size (178 documents on
--   2026-10-16): it takes a SHARE lock on documents for milliseconds. Above ~100k documents, run
--   the three CREATE INDEX statements first, on their own, as CREATE INDEX CONCURRENTLY.
-- ============================================================================

BEGIN;

-- The policy guard compares deparsed text, which depends on search_path. Pin it for this
-- transaction (every object below is schema-qualified anyway).
SET LOCAL search_path TO public, extensions;

-- ── 1. The three first-page indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS documents_library_root_created_idx
  ON public.documents (user_id, is_latest, created_at DESC, id DESC)
  WHERE folder_id IS NULL;

CREATE INDEX IF NOT EXISTS documents_library_added_idx
  ON public.documents (user_id, is_latest, created_at DESC NULLS LAST, id);

CREATE INDEX IF NOT EXISTS documents_library_folder_created_idx
  ON public.documents (user_id, is_latest, folder_id, created_at DESC, id DESC)
  WHERE folder_id IS NOT NULL;

-- ── 2. The documents SELECT policy: auth.uid() once per statement, not once per row ───────────
DO $guard$
DECLARE
  v_qual text;
  v_154 constant text :=
    '((org_id IN ( SELECT current_user_org_ids() AS current_user_org_ids)) AND ((auth.uid() = user_id) '
    'OR ((folder_id IS NOT NULL) AND folder_is_org_shared(folder_id)) '
    'OR connection_doc_is_visible(source_connection_id, ingest_visibility)))';
  v_208 constant text :=
    '((org_id IN ( SELECT current_user_org_ids() AS current_user_org_ids)) AND ((( SELECT auth.uid() AS uid) = user_id) '
    'OR ((folder_id IS NOT NULL) AND folder_is_org_shared(folder_id)) '
    'OR connection_doc_is_visible(source_connection_id, ingest_visibility)))';
BEGIN
  SELECT pg_get_expr(p.polqual, p.polrelid) INTO v_qual
    FROM pg_policy p
   WHERE p.polrelid = 'public.documents'::regclass
     AND p.polname = 'Users can view own or global-folder documents'
     AND p.polcmd = 'r' AND p.polpermissive
     AND p.polroles = ARRAY['authenticated'::regrole::oid];
  IF v_qual IS NULL THEN
    RAISE EXCEPTION '208: policy "Users can view own or global-folder documents" (permissive, FOR SELECT, TO authenticated) not found on public.documents — refusing to create it blind';
  END IF;
  IF v_qual <> v_154 AND v_qual <> v_208 THEN
    RAISE EXCEPTION '208: the documents SELECT policy differs from migration 154''s — refusing to overwrite it. Found: %', v_qual;
  END IF;
END
$guard$;

DROP POLICY IF EXISTS "Users can view own or global-folder documents" ON public.documents;
CREATE POLICY "Users can view own or global-folder documents" ON public.documents
  FOR SELECT TO authenticated
  USING (
    (org_id IN (SELECT public.current_user_org_ids()))
    AND (
      ((SELECT auth.uid()) = user_id)
      OR ((folder_id IS NOT NULL) AND public.folder_is_org_shared(folder_id))
      OR public.connection_doc_is_visible(source_connection_id, ingest_visibility)
    )
  );

-- ── 3. The view, as a UNION ALL an index can walk in order ────────────────────────────────────
CREATE OR REPLACE VIEW public.library_documents WITH (security_invoker = true) AS
SELECT
  o.id,  -- from the joined base row, NOT the union: PostgREST's embeds need it (section 3)
  u.user_id,
  u.filename,
  u.file_path,
  u.file_size,
  u.mime_type,
  u.status,
  u.error_message,
  u.chunk_count,
  u.created_at,
  u.updated_at,
  u.content_hash,
  u.metadata,
  u.folder_id,
  u.version_number,
  u.is_latest,
  -- the markdown body is deliberately omitted here (see 207 section 1)
  u.ingestion_step,
  u.extractor,
  u.document_type_norm,
  u.date_typed,
  u.org_id,
  u.source_connection_id,
  u.ingest_visibility,
  u.source_state,
  u.thread_key,
  u.page_count,
  u.source_created_at,
  u.source_modified_at,
  u.source_author,
  u.archived_at,
  u.archived_policy_id,
  u.archived_policy_name,
  u.retrievable,
  lower(u.filename) COLLATE "C" AS filename_key,
  (SELECT count(*)::int
     FROM public.documents e
    WHERE e.user_id = u.user_id
      AND e.filename = u.filename
      AND (e.user_id = (SELECT auth.uid())
           OR (e.folder_id IS NOT NULL AND e.folder_id IN (
                 SELECT f.id FROM public.folders f
                  WHERE f.user_id <> (SELECT auth.uid()) AND public.folder_is_org_shared(f.id))))
  ) AS version_count,
  EXISTS (
    SELECT 1
      FROM public.documents e
     WHERE e.user_id = u.user_id
       AND e.filename = u.filename
       AND e.version_number < u.version_number
       AND (e.user_id = (SELECT auth.uid())
            OR (e.folder_id IS NOT NULL AND e.folder_id IN (
                  SELECT f.id FROM public.folders f
                   WHERE f.user_id <> (SELECT auth.uid()) AND public.folder_is_org_shared(f.id))))
  ) AS has_earlier
FROM (
  -- leg 1: the caller's own documents (no WHERE here — see section 3 in the header)
  SELECT 1 AS leg, d.user_id AS scope_key,
         d.id, d.user_id, d.filename, d.file_path, d.file_size, d.mime_type, d.status,
         d.error_message, d.chunk_count, d.created_at, d.updated_at, d.content_hash, d.metadata,
         d.folder_id, d.version_number, d.is_latest, d.ingestion_step, d.extractor,
         d.document_type_norm, d.date_typed, d.org_id, d.source_connection_id,
         d.ingest_visibility, d.source_state, d.thread_key, d.page_count, d.source_created_at,
         d.source_modified_at, d.source_author, d.archived_at, d.archived_policy_id,
         d.archived_policy_name, d.retrievable
    FROM public.documents d
  UNION ALL
  -- leg 2: documents in org-shared folders the caller does not own (not the caller's own)
  SELECT 2 AS leg, auth.uid() AS scope_key,
         d.id, d.user_id, d.filename, d.file_path, d.file_size, d.mime_type, d.status,
         d.error_message, d.chunk_count, d.created_at, d.updated_at, d.content_hash, d.metadata,
         d.folder_id, d.version_number, d.is_latest, d.ingestion_step, d.extractor,
         d.document_type_norm, d.date_typed, d.org_id, d.source_connection_id,
         d.ingest_visibility, d.source_state, d.thread_key, d.page_count, d.source_created_at,
         d.source_modified_at, d.source_author, d.archived_at, d.archived_policy_id,
         d.archived_policy_name, d.retrievable
    FROM public.documents d
) u
LEFT JOIN public.documents o ON o.id = u.id
WHERE u.scope_key = (SELECT auth.uid())
  AND (u.leg = 1
       OR (u.leg = 2
           AND u.user_id IS DISTINCT FROM (SELECT auth.uid())
           AND u.folder_id = ANY (ARRAY(
                 SELECT f.id FROM public.folders f
                  WHERE f.user_id <> (SELECT auth.uid()) AND public.folder_is_org_shared(f.id)))));

COMMENT ON VIEW public.library_documents IS
  'Phase 284 (mig 207, rewritten by 208): the Library visible set — own documents ∪ documents in '
  'org-shared folders the caller does not own, as a UNION ALL an index walks in order. '
  'security_invoker: RLS on documents/folders applies beneath it. Keyed on auth.uid(): the '
  'service role reads 0 rows. SELECT-only.';

-- ── 4. Grants: SELECT only, never PUBLIC / anon (exactly 207's) ──────────────────────────────
REVOKE ALL ON public.library_documents FROM PUBLIC;
REVOKE ALL ON public.library_documents FROM anon;
REVOKE ALL ON public.library_documents FROM authenticated;
REVOKE ALL ON public.library_documents FROM service_role;
GRANT SELECT ON public.library_documents TO authenticated;
GRANT SELECT ON public.library_documents TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('library_documents exists and is security_invoker',
--      coalesce((select 'security_invoker=true' = any(c.reloptions) from pg_class c
--                 join pg_namespace n on n.oid = c.relnamespace
--                where n.nspname = 'public' and c.relname = 'library_documents' and c.relkind = 'v'),
--               false)),
--     ('the view is the 208 UNION ALL (scope_key legs)',
--      coalesce(pg_get_viewdef('public.library_documents'::regclass) like '%UNION ALL%'
--               and pg_get_viewdef('public.library_documents'::regclass) like '%scope_key%', false)),
--     ('the view omits full_markdown and exposes neither leg nor scope_key',
--      not exists (select 1 from information_schema.columns where table_schema = 'public'
--                    and table_name = 'library_documents'
--                    and column_name in ('full_markdown', 'leg', 'scope_key'))),
--     ('the view carries filename_key, version_count and has_earlier',
--      (select count(*) = 3 from information_schema.columns where table_schema = 'public'
--         and table_name = 'library_documents'
--         and column_name in ('filename_key', 'version_count', 'has_earlier'))),
--     ('anon cannot SELECT it',
--      not has_table_privilege('anon', 'public.library_documents', 'SELECT')),
--     ('authenticated can SELECT it',
--      has_table_privilege('authenticated', 'public.library_documents', 'SELECT')),
--     ('authenticated cannot INSERT, UPDATE or DELETE through it',
--      not has_table_privilege('authenticated', 'public.library_documents', 'INSERT')
--      and not has_table_privilege('authenticated', 'public.library_documents', 'UPDATE')
--      and not has_table_privilege('authenticated', 'public.library_documents', 'DELETE')),
--     ('service_role can SELECT it (and reads 0 rows: auth.uid() is NULL)',
--      has_table_privilege('service_role', 'public.library_documents', 'SELECT')
--      and not has_table_privilege('service_role', 'public.library_documents', 'INSERT')),
--     ('documents_library_root_created_idx exists (partial: folder_id IS NULL)',
--      exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'documents'
--                and indexname = 'documents_library_root_created_idx'
--                and indexdef like '%(user_id, is_latest, created_at DESC, id DESC) WHERE (folder_id IS NULL)%')),
--     ('documents_library_added_idx exists',
--      exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'documents'
--                and indexname = 'documents_library_added_idx'
--                and indexdef like '%(user_id, is_latest, created_at DESC NULLS LAST, id)%')),
--     ('documents_library_folder_created_idx exists (partial: folder_id IS NOT NULL)',
--      exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'documents'
--                and indexname = 'documents_library_folder_created_idx'
--                and indexdef like '%(user_id, is_latest, folder_id, created_at DESC, id DESC) WHERE (folder_id IS NOT NULL)%')),
--     ('the view reads id from the joined documents row (PostgREST embeds need its origin)',
--      coalesce(pg_get_viewdef('public.library_documents'::regclass) like '%LEFT JOIN %documents o ON %o.id = u.id%', false)),
--     ('the documents SELECT policy evaluates auth.uid() once (wrapped in a SELECT)',
--      exists (select 1 from pg_policy p where p.polrelid = 'public.documents'::regclass
--                and p.polname = 'Users can view own or global-folder documents'
--                and p.polcmd = 'r' and p.polpermissive
--                and pg_get_expr(p.polqual, p.polrelid) like '%( SELECT auth.uid() AS uid) = user_id%'
--                and pg_get_expr(p.polqual, p.polrelid) not like '%(auth.uid() = user_id)%')),
--     ('the documents SELECT policy keeps its three arms and its org gate',
--      exists (select 1 from pg_policy p where p.polrelid = 'public.documents'::regclass
--                and p.polname = 'Users can view own or global-folder documents'
--                and pg_get_expr(p.polqual, p.polrelid) like '%current_user_org_ids()%'
--                and pg_get_expr(p.polqual, p.polrelid) like '%folder_is_org_shared(folder_id)%'
--                and pg_get_expr(p.polqual, p.polrelid) like '%connection_doc_is_visible(source_connection_id, ingest_visibility)%'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
