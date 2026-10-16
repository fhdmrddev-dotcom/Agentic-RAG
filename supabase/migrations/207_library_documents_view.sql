-- ============================================================================
-- 207 — Phase 284 (FIX-11 · BUG-261014-06 + BUG-261014-07): the Library's visible set, as ONE
-- security_invoker view, so every Library list, count and summary pages and counts IN SQL.
--
-- WHAT EACH SECTION CLOSES
--   1. public.library_documents — the ONE SQL home of the Library's visible set (D-04 / R-01):
--      the caller's own documents ∪ documents in org-shared folders the caller does NOT own.
--      Before 284 that set was computed in Python (`GET /documents`: two unranged PostgREST legs,
--      a Python merge, then a `document_id in.(…)` count loop batched at 100 ids — the
--      BUG-261014-06 stopgap). Every leg was silently cut at PostgREST's max_rows (1,000), and the
--      folder-id leg rode the URL. A view lets the builder's `.order().range()` and
--      `count="exact"` push down into ONE query, so nothing is cut and no id list grows with the
--      library.
--      * security_invoker (on): the view runs as the CALLER. RLS on documents and
--        folders still applies beneath it — the view can only NARROW what RLS admits, never
--        widen it. The predicate is the Library's DEFINITION; RLS is the WALL.
--      * It DELIBERATELY EXCLUDES two legs RLS would admit (RESEARCH fact 2, D-04 "no widening"):
--        connection-visible documents (`connection_doc_is_visible`) and OTHER users' documents in
--        a shared folder the caller owns (the old global leg skipped folders the caller owns:
--        folder_utils.get_globally_visible_folder_ids, `f.user_id != user_id`).
--      * It reuses public.folder_is_org_shared (the global-subtree predicate, renamed by migration 111) —
--        the subtree rule is never restated here.
--      * It is keyed on auth.uid(), so the SERVICE ROLE reads ZERO rows (fail-closed). The agent's
--        service-role paths therefore keep their own two-leg reads (R-02).
--      * full_markdown is OMITTED (up to ~267 KB per row; no list consumer reads it). Three
--        derived columns are added: filename_key (lower(filename) COLLATE "C" — codepoint order,
--        Python's sort), version_count and has_earlier (both restricted to the same visible set).
--      ⚠ COLUMN DRIFT: a column added to public.documents later does NOT appear here. The live
--        suite test_284_view_live.py fences view columns == documents − {full_markdown} +
--        {filename_key, version_count, has_earlier}; a new documents column must be added to this
--        view in the same migration.
--   2. Grants — SELECT ONLY, to authenticated and service_role; nothing to PUBLIC or anon. New
--      relations inherit Supabase's default grants (anon/authenticated ALL), so everything is
--      revoked first. SELECT-only also keeps this auto-updatable view READ-ONLY. The dump is
--      --no-privileges, so these lines are mirrored in scripts/full-schema-supplement.sql.
--   No new function and no definer-rights object (D-18 / T-284-06).
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor. NEVER `supabase db push` /
-- `db reset`. Then: bash scripts/regenerate-full-schema.sh (no --reset). Safe to paste twice
-- (CREATE OR REPLACE VIEW with an identical column list; REVOKE/GRANT are idempotent).
-- ⚠ PRODUCTION: apply 207 BEFORE the backend deploy that carries Phase 284 — `GET /documents`,
--   `GET /documents/{id}` and `GET /library/summary` read this view and 500 without it (RESEARCH
--   Pitfall 3) — then run get_advisors(security).
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.library_documents WITH (security_invoker = true) AS
SELECT
  d.id,
  d.user_id,
  d.filename,
  d.file_path,
  d.file_size,
  d.mime_type,
  d.status,
  d.error_message,
  d.chunk_count,
  d.created_at,
  d.updated_at,
  d.content_hash,
  d.metadata,
  d.folder_id,
  d.version_number,
  d.is_latest,
  -- the markdown body is deliberately omitted here (see section 1)
  d.ingestion_step,
  d.extractor,
  d.document_type_norm,
  d.date_typed,
  d.org_id,
  d.source_connection_id,
  d.ingest_visibility,
  d.source_state,
  d.thread_key,
  d.page_count,
  d.source_created_at,
  d.source_modified_at,
  d.source_author,
  d.archived_at,
  d.archived_policy_id,
  d.archived_policy_name,
  d.retrievable,
  lower(d.filename) COLLATE "C" AS filename_key,
  (SELECT count(*)::int
     FROM public.documents e
    WHERE e.user_id = d.user_id
      AND e.filename = d.filename
      AND (e.user_id = (SELECT auth.uid())
           OR (e.folder_id IS NOT NULL AND e.folder_id IN (
                 SELECT f.id FROM public.folders f
                  WHERE f.user_id <> (SELECT auth.uid()) AND public.folder_is_org_shared(f.id))))
  ) AS version_count,
  EXISTS (
    SELECT 1
      FROM public.documents e
     WHERE e.user_id = d.user_id
       AND e.filename = d.filename
       AND e.version_number < d.version_number
       AND (e.user_id = (SELECT auth.uid())
            OR (e.folder_id IS NOT NULL AND e.folder_id IN (
                  SELECT f.id FROM public.folders f
                   WHERE f.user_id <> (SELECT auth.uid()) AND public.folder_is_org_shared(f.id))))
  ) AS has_earlier
FROM public.documents d
WHERE d.user_id = (SELECT auth.uid())
   OR (d.folder_id IS NOT NULL AND d.folder_id IN (
         SELECT f.id FROM public.folders f
          WHERE f.user_id <> (SELECT auth.uid()) AND public.folder_is_org_shared(f.id)));

COMMENT ON VIEW public.library_documents IS
  'Phase 284 (mig 207): the Library visible set — own documents ∪ documents in org-shared folders '
  'the caller does not own. security_invoker: RLS on documents/folders applies beneath it. '
  'Keyed on auth.uid(): the service role reads 0 rows. SELECT-only.';

-- ── 2. Grants: SELECT only, never PUBLIC / anon ──────────────────────────────────────────────
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
--     ('the view omits full_markdown',
--      not exists (select 1 from information_schema.columns where table_schema = 'public'
--                    and table_name = 'library_documents' and column_name = 'full_markdown')),
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
--      and not has_table_privilege('service_role', 'public.library_documents', 'INSERT'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
