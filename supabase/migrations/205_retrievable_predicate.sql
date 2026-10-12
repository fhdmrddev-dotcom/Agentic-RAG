-- 205 — Phase 275 (RET-04; D-18, D-21, D-33, D-36; revisions W-1, W-1b; BUG-261004-01 folded)
-- documents.retrievable: the ONE home of "may an agent read this document".
--
-- WHAT. An archived document (204: archived_at) and a document whose source says it is gone
-- (source_state missing_at_source / unauthorized_at_source / source_disconnected) leave EVERY agent
-- read, and stay openable / downloadable / findable in the Library (D-18, D-21).
--
-- WHY A GENERATED COLUMN (RESEARCH M-1, measured on recall_bench, 100k chunks):
--   * the predicate used to be restated in three places — match_document_chunks (both branches),
--     keyword_search_chunks, and the Python seam — and only ever named 'source_disconnected'. That
--     drift IS BUG-261004-01: missing_at_source documents were served by today's RPCs.
--   * one STORED column is one definition; every consumer names it and never restates the rule.
--   * POSITIVE form (= 'live'): any future source_state value is excluded by default (fail closed).
--   * cost: unfiltered vector p50 2.0 ms with the column + ANALYZE vs a 25 ms baseline; the keyword
--     arm unchanged. ⛔ Without statistics, an inline `archived_at IS NULL` predicate made the
--     planner abandon HNSW (943 ms per call) — so ANALYZE follows the column add.
--
-- WHY A GUC FOR MODEL-WRITTEN SQL (RESEARCH M-2). query_user_documents (INVOKER, SELECT-only) is the
-- only door `query_documents` and `grep` use. A SQL rewrite cannot exclude archived rows safely: the
-- model can read document_chunks without ever naming documents. So the function switches a
-- transaction-local GUC on, and four RESTRICTIVE SELECT policies hide non-retrievable rows only while
-- it is on. Library reads (GUC off) are unchanged (≈9% on a full chunk count, measured).
--   ⚠ `IS DISTINCT FROM 'on'`: once a session has touched the placeholder, current_setting(…, true)
--     returns '' rather than NULL.
--   ⛔ The model must not be able to switch it off (revisions W-1, W-1b): text containing set_config,
--     current_setting, or a U& escape prefix (U&'…' / U&"…" can spell set_config without its
--     letters) is refused BEFORE anything runs. query_to_xml, ts_stat and ts_rewrite execute a SQL
--     STRING server-side, so a concatenated 'set_' || 'config' would reach set_config through them
--     — they are refused too (275-01, Rule 2: a gap in the planned denylist). The refusal is
--     case-insensitive; `you&me` is not a U& prefix (U& is only legal directly before a quote).
--
-- SECURITY DEFINER RPCs (owner postgres, BYPASSRLS) are unaffected by the policies; they carry
-- `AND d.retrievable` themselves. Both keep `SET search_path TO ''` and
-- `SET plan_cache_mode TO 'force_custom_plan'` (migration 201; CREATE OR REPLACE replaces the SET
-- list, and test_272_review_fixes scans every migration from 200 on for it). Same signatures as
-- migration 200, so no overload is created and nothing is dropped.
--
-- ⚠ Pitfall 8 (recorded, not fixed here): HNSW post-filtering under-fills top-k on a heavily
--   archived corpus (50% archived → 9-20 of 20 rows), exactly as it already does for is_latest =
--   false. The remedy is the existing hnsw_iterative_scan setting (Phase 241).
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor AFTER 204.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset).
-- ⚠ PRODUCTION (D-29): apply 204 then 205 BEFORE the backend deploys, then get_advisors(security).
-- ============================================================================

BEGIN;

-- ── 1. the column, then statistics ──────────────────────────────────────────
ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS retrievable boolean GENERATED ALWAYS AS (archived_at IS NULL AND (source_state IS NULL OR source_state = 'live')) STORED;

ANALYZE public.documents;

-- ── 2. match_document_chunks — migration 200's body, the predicate swapped in both branches ──
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding public.vector,
  match_user_id uuid,
  match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.3,
  metadata_filter jsonb DEFAULT NULL::jsonb,
  p_folder_ids uuid[] DEFAULT NULL::uuid[],
  p_embedding_model text DEFAULT NULL::text,
  p_document_ids uuid[] DEFAULT NULL::uuid[],
  p_exact_max_chunks integer DEFAULT NULL::integer
)
 RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE
  n_chunks integer;
BEGIN
  -- D-18: an EMPTY set means "the filter matched nothing" — zero rows, never "all".
  IF p_document_ids IS NOT NULL AND cardinality(p_document_ids) = 0 THEN
    RETURN;
  END IF;

  -- Size the set (bounded: stops counting one past the threshold). Branch choice only — the
  -- number is never returned, so counting through the DEFINER owner discloses nothing.
  IF p_document_ids IS NOT NULL AND p_exact_max_chunks IS NOT NULL THEN
    SELECT count(*) INTO n_chunks
    FROM (
      SELECT 1 FROM public.document_chunks c
      WHERE c.document_id = ANY (p_document_ids)
      LIMIT p_exact_max_chunks + 1
    ) bounded;
  END IF;

  IF n_chunks IS NOT NULL AND n_chunks <= p_exact_max_chunks THEN
    -- EXACT branch (SC#3): the ORDER BY is an expression (`+ 0`), so the HNSW index cannot serve
    -- it and the set is ranked exactly.
    -- ⚠ backend/tests/integration/test_272_rpc_document_scope.py holds this statement verbatim
    --   (EXACT_BRANCH_SQL) and fails if the two drift.
    RETURN QUERY
    SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
           1 - (dc.embedding OPERATOR(public.<=>) query_embedding) AS similarity
    FROM public.document_chunks dc
    JOIN public.documents d ON d.id = dc.document_id
    WHERE dc.document_id = ANY (p_document_ids)
      AND dc.org_id = ANY (SELECT public.current_user_org_ids())
      AND (
        dc.user_id = auth.uid()
        OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
        OR public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility)
      )
      AND d.retrievable
      AND 1 - (dc.embedding OPERATOR(public.<=>) query_embedding) > match_threshold
      AND d.is_latest = true
      AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
      AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
      AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)
    ORDER BY (dc.embedding OPERATOR(public.<=>) query_embedding) + 0
    LIMIT match_count;
    RETURN;
  END IF;

  -- INDEX branch: migration 200's body + the retrievable column (NULL set = unrestricted).
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding OPERATOR(public.<=>) query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())          -- D-164-01 org gate (indexed, mig 107)
    AND (                                                               -- PRAG-01 within-org visibility
      dc.user_id = auth.uid()                                          --   owner (session-derived, NOT match_user_id)
      OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
      OR public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility)  -- Phase 231 VIS-01
    )
    AND d.retrievable                                                   -- Phase 275 D-36 (archived + source state)
    AND 1 - (dc.embedding OPERATOR(public.<=>) query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)  -- D-10 stale-model filter
    AND (p_document_ids IS NULL OR dc.document_id = ANY (p_document_ids))     -- Phase 272 D-14
  ORDER BY dc.embedding OPERATOR(public.<=>) query_embedding
  LIMIT match_count;
END;
$function$;

-- ── 3. keyword_search_chunks — same swap ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.keyword_search_chunks(
  search_query text,
  match_user_id uuid,
  match_count integer DEFAULT 20,
  metadata_filter jsonb DEFAULT NULL::jsonb,
  p_folder_ids uuid[] DEFAULT NULL::uuid[],
  p_document_ids uuid[] DEFAULT NULL::uuid[]
)
 RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, rank double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE
  tsq tsquery;
BEGIN
  -- D-18: an EMPTY set means "the filter matched nothing" — zero rows, never "all".
  IF p_document_ids IS NOT NULL AND cardinality(p_document_ids) = 0 THEN
    RETURN;
  END IF;

  tsq := plainto_tsquery('english', search_query);
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         ts_rank_cd(dc.search_vector, tsq)::float AS rank
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())          -- D-164-01 org gate (indexed, mig 107)
    AND (                                                               -- PRAG-01 within-org visibility
      dc.user_id = auth.uid()                                          --   owner (session-derived, NOT match_user_id)
      OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
      OR public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility)  -- Phase 231 VIS-01
    )
    AND d.retrievable                                                   -- Phase 275 D-36 (archived + source state)
    AND dc.search_vector @@ tsq
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
    AND (p_document_ids IS NULL OR dc.document_id = ANY (p_document_ids))     -- Phase 272 D-14
  ORDER BY rank DESC
  LIMIT match_count;
END;
$function$;

-- The PUBLIC-EXECUTE trap: re-asserted even though CREATE OR REPLACE keeps the ACL.
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[]) TO service_role;

-- ── 4. query_user_documents — INVOKER, now switches the agent-read GUC on ───
-- No SET search_path: model SQL names tables unqualified (`FROM documents`) and must resolve them
-- exactly as before.
CREATE OR REPLACE FUNCTION public.query_user_documents(sql_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  result jsonb;
  clean_query text;
  prev_agent_read text;
BEGIN
  clean_query := trim(sql_query);

  -- Injection guard: SELECT only, no semicolons
  IF lower(clean_query) NOT LIKE 'select%' THEN
    RAISE EXCEPTION 'Only SELECT queries are permitted';
  END IF;
  IF position(';' IN clean_query) > 0 THEN
    RAISE EXCEPTION 'Query must be a single statement (no semicolons)';
  END IF;

  -- W-1 / W-1b: nothing in the text may read or switch a session setting, directly, through a
  -- Unicode-escape spelling, or through a function that executes a SQL string. Before EXECUTE.
  IF clean_query ~* '(set_config|current_setting|u&[''"]|query_to_xml|ts_stat|ts_rewrite)' THEN
    RAISE EXCEPTION 'Query may not read or change session settings'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- D-36: while this flag is on, the RESTRICTIVE agent-read policies hide non-retrievable rows.
  prev_agent_read := current_setting('app.agent_read', true);
  PERFORM set_config('app.agent_read', 'on', true);

  EXECUTE format('SELECT jsonb_agg(t) FROM (%s) t', clean_query)
    INTO result;

  -- Scope the flag to this call: the same transaction's Library reads see archived rows again.
  PERFORM set_config('app.agent_read', COALESCE(NULLIF(prev_agent_read, ''), 'off'), true);

  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.query_user_documents(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.query_user_documents(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.query_user_documents(text) TO authenticated;

-- ── 5. the helper the chunk/table/image policies use ────────────────────────
-- DEFINER so the per-row check reads documents without re-entering documents' own RLS; a missing
-- document reads as NOT retrievable (fail closed).
CREATE OR REPLACE FUNCTION public.document_is_retrievable(p_document_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE((SELECT d.retrievable FROM public.documents d WHERE d.id = p_document_id), false);
$function$;

REVOKE EXECUTE ON FUNCTION public.document_is_retrievable(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_is_retrievable(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.document_is_retrievable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_is_retrievable(uuid) TO service_role;

-- ── 6. the four RESTRICTIVE agent-read policies ─────────────────────────────
DROP POLICY IF EXISTS documents_agent_read_retrievable ON public.documents;
CREATE POLICY documents_agent_read_retrievable ON public.documents AS RESTRICTIVE FOR SELECT TO authenticated USING (current_setting('app.agent_read', true) IS DISTINCT FROM 'on' OR retrievable);

DROP POLICY IF EXISTS document_chunks_agent_read_retrievable ON public.document_chunks;
CREATE POLICY document_chunks_agent_read_retrievable ON public.document_chunks AS RESTRICTIVE FOR SELECT TO authenticated USING (current_setting('app.agent_read', true) IS DISTINCT FROM 'on' OR public.document_is_retrievable(document_id));

DROP POLICY IF EXISTS document_tables_agent_read_retrievable ON public.document_tables;
CREATE POLICY document_tables_agent_read_retrievable ON public.document_tables AS RESTRICTIVE FOR SELECT TO authenticated USING (current_setting('app.agent_read', true) IS DISTINCT FROM 'on' OR public.document_is_retrievable(document_id));

DROP POLICY IF EXISTS document_images_agent_read_retrievable ON public.document_images;
CREATE POLICY document_images_agent_read_retrievable ON public.document_images AS RESTRICTIVE FOR SELECT TO authenticated USING (current_setting('app.agent_read', true) IS DISTINCT FROM 'on' OR public.document_is_retrievable(document_id));

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('retrievable is a STORED generated column',
--      (select attgenerated = 's' from pg_attribute
--        where attrelid = 'public.documents'::regclass and attname = 'retrievable')),
--     ('exactly one match_document_chunks and one keyword_search_chunks',
--      (select count(*) = 2 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname in ('match_document_chunks', 'keyword_search_chunks'))),
--     ('both RPCs read d.retrievable and never source_disconnected',
--      (select bool_and(prosrc like '%d.retrievable%' and prosrc not like '%source_disconnected%')
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname in ('match_document_chunks', 'keyword_search_chunks'))),
--     ('both RPCs keep the plan pin and search_path',
--      (select bool_and('plan_cache_mode=force_custom_plan' = any (proconfig)
--                       and 'search_path=""' = any (proconfig))
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname in ('match_document_chunks', 'keyword_search_chunks'))),
--     ('anon cannot EXECUTE either RPC or query_user_documents',
--      not has_function_privilege('anon', 'public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer)', 'EXECUTE')
--      and not has_function_privilege('anon', 'public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[])', 'EXECUTE')
--      and not has_function_privilege('anon', 'public.query_user_documents(text)', 'EXECUTE')),
--     ('authenticated can EXECUTE query_user_documents',
--      has_function_privilege('authenticated', 'public.query_user_documents(text)', 'EXECUTE')),
--     ('query_user_documents switches the agent-read GUC and refuses set_config text',
--      (select prosrc like '%set_config(''app.agent_read'', ''on'', true)%' and prosrc like '%current_setting|u&%'
--         from pg_proc where oid = 'public.query_user_documents(text)'::regprocedure)),
--     ('four RESTRICTIVE agent-read policies',
--      (select count(*) = 4 from pg_policies where schemaname = 'public'
--        and policyname like '%_agent_read_retrievable' and permissive = 'RESTRICTIVE')),
--     ('anon cannot EXECUTE document_is_retrievable',
--      not has_function_privilege('anon', 'public.document_is_retrievable(uuid)', 'EXECUTE'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
