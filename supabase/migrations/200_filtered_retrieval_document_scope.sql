-- 200_filtered_retrieval_document_scope.sql
-- Phase 272 (FIND-07, D-14 / D-18 / D-19): filtered retrieval — one document set for BOTH arms
-- Tables/functions: public.document_chunks (one btree index),
--                   public.match_document_chunks, public.keyword_search_chunks
--
-- WHY. "October revenue" must not return March. Phase 272 resolves a chat filter to a set of
-- document ids under the caller's RLS (backend `retrieval_scope.py`), then hands that SAME set to
-- the vector arm and the keyword arm. This migration gives both RPCs the restriction:
--
-- 1. A trailing `p_document_ids uuid[] DEFAULT NULL` on BOTH RPCs. NULL = no restriction (every
--    existing 7-/5-positional caller is unchanged: recall_eval._MATCH_SQL, test_266, test_111_1).
--    An EMPTY array returns ZERO rows — "the filter matched nothing" can never widen to "search
--    everything" (D-18, defence in depth; the backend already short-circuits before calling).
--
-- 2. `match_document_chunks` also gains `p_exact_max_chunks integer DEFAULT NULL`. When a set is
--    supplied and holds at most that many chunks, the set is searched EXACTLY: the ORDER BY is an
--    EXPRESSION (`… + 0`) the HNSW index cannot serve (pgvector README: the ORDER BY "must be the
--    result of a distance operator (not an expression)" for the index to be used), so no HNSW node
--    can appear in the plan and the selective-filter recall cliff (SEED-273) cannot occur. Above
--    the threshold the index branch runs — today's body verbatim plus the set restriction. NULL
--    threshold = never exact. The threshold value lives in ONE backend constant
--    (`retrieval_rpc.FILTERED_EXACT_MAX_CHUNKS`), set by 272-05's measurement.
--
-- 3. `idx_document_chunks_document_id` — the btree the exact branch needs. Without it
--    `document_id = ANY(…)` sequentially scans document_chunks (measured on recall_bench,
--    100k chunks: Parallel Seq Scan, shared read 6,590 → with the index: Bitmap Index Scan, 764).
--    272-REVIEW WR-05: it is built CONCURRENTLY in STEP 1, so ingest (INSERT/UPDATE/DELETE on
--    document_chunks) is never blocked for the build. The safe path used to live only in a comment
--    while the file itself built the index inside BEGIN, taking a SHARE lock for the whole build.
--
-- ⛔ HOW TO APPLY — TWO RUNS, IN THIS ORDER:
--    STEP 1. Run the single `CREATE INDEX CONCURRENTLY …` statement below ON ITS OWN — a separate
--            SQL-editor run containing nothing else. It must run outside a transaction block:
--            CONCURRENTLY refuses to run inside BEGIN/COMMIT, and a multi-statement paste is one
--            implicit transaction, so pasting the whole file at once fails on this statement
--            (loudly, before anything else runs).
--    STEP 2. Run everything from `BEGIN;` to `COMMIT;`. Its first statement REFUSES to continue
--            unless the index exists AND is valid, so STEP 1 cannot be skipped silently.
--    ⚠ A failed or cancelled CONCURRENTLY build leaves an INVALID index under this name; IF NOT
--      EXISTS then skips it and the exact branch sequential-scans. Remedy (also outside a
--      transaction): `DROP INDEX CONCURRENTLY IF EXISTS public.idx_document_chunks_document_id;`
--      then re-run STEP 1. The VERIFY block below reads `indisvalid`, not just the index name.
--    ⚠ `supabase db reset` / `regenerate-full-schema.sh --reset` replay files through the CLI,
--      which may run a file as one batch; if STEP 1 fails there, apply it by hand as above.
--
-- 4. The OLD signatures are DROPPED first. CREATE OR REPLACE with an added parameter makes a NEW
--    overload, and positional callers then fail with "function … is not unique" (the 033/036/073
--    precedent). Exactly ONE function per name must remain.
--
-- 5. The PUBLIC-EXECUTE trap (BUG-260911-01 class, migration 181): a (re)created function is
--    executable by PUBLIC by default, and Supabase's default privileges also grant anon. REVOKE
--    from PUBLIC *and* anon, then grant back authenticated + service_role — the same ACL the old
--    signatures carried after 181.
--
-- The DEFINER bodies keep EVERY existing predicate in both branches — the org gate
-- (current_user_org_ids), within-org visibility (owner / org-shared folder /
-- connection_doc_is_visible), source_state, is_latest, metadata, folder scope (D-19: a filter
-- narrows the chat scope, it never replaces it) and the embedding-model filter. So an org-B
-- document id passed by an org-A caller still returns zero rows.
--
-- Bodies copied from the HIGHEST migration that (re)creates them: 170_documents_source_state.sql
-- (181 only re-grants), confirmed byte-identical to pg_get_functiondef on the local DB.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Safe to paste twice (DROP IF EXISTS / CREATE OR REPLACE /
-- IF NOT EXISTS / REVOKE+GRANT are all idempotent) — and, since 272-REVIEW WR-04, a re-paste no
-- longer undoes 201: see the plan pin below.
--
-- ⛔ THE CUSTOM-PLAN PIN (272-05 → 272-REVIEW WR-04). The btree in step 1 makes PL/pgSQL's GENERIC
--    plan of both bodies a whole-table join; a pooled connection switches to it after five calls,
--    so UNFILTERED search regresses (recall_bench: 3-8 ms -> up to 1.56 s vector, up to 31 s
--    keyword). Migration 201 pinned `plan_cache_mode = force_custom_plan` with ALTER FUNCTION … SET.
--    ⚠ CREATE OR REPLACE REPLACES A FUNCTION'S WHOLE SET LIST (measured on the local DB: proconfig
--    went from [search_path, plan_cache_mode] to [search_path] on a re-paste of this file), so the
--    pin now lives IN BOTH DEFINITIONS below (`SET plan_cache_mode TO 'force_custom_plan'`) and 201
--    stays as a harmless, idempotent no-op for a database that already ran it.
--    ⛔ any later CREATE OR REPLACE of either function MUST carry the same clause — copying a body
--    without it brings the regression back silently (tests/unit/test_272_review_fixes.py fences
--    every definition from 200 on).
-- ============================================================================

-- ── STEP 1 (RUN ON ITS OWN, outside a transaction): the btree the exact branch needs ─────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_document_id
  ON public.document_chunks (document_id);

-- ── STEP 2 (one run, from BEGIN to COMMIT) ──────────────────────────────────────────────────
BEGIN;

-- ── 1. Refuse to swap the functions without a VALID btree (STEP 1 cannot be skipped) ────────
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idx_document_chunks_document_id' AND i.indisvalid
  ) THEN
    RAISE EXCEPTION 'migration 200: idx_document_chunks_document_id is missing or INVALID. Run STEP 1 '
      '(CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks '
      '(document_id);) on its own first. If the index exists but is INVALID, run DROP INDEX CONCURRENTLY '
      'IF EXISTS public.idx_document_chunks_document_id; then STEP 1 again.';
  END IF;
END
$guard$;

-- ── 2. Drop the OLD signatures (exactly one function per name must remain) ──────────────────
DROP FUNCTION IF EXISTS public.match_document_chunks(
  public.vector, uuid, integer, double precision, jsonb, uuid[], text
);
DROP FUNCTION IF EXISTS public.keyword_search_chunks(
  text, uuid, integer, jsonb, uuid[]
);

-- ── 3. match_document_chunks: + p_document_ids, + p_exact_max_chunks ───────────────────────
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
    -- it and the set is ranked exactly. Every predicate below is today's, verbatim, plus the set.
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
      AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')
      AND 1 - (dc.embedding OPERATOR(public.<=>) query_embedding) > match_threshold
      AND d.is_latest = true
      AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
      AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
      AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)
    ORDER BY (dc.embedding OPERATOR(public.<=>) query_embedding) + 0
    LIMIT match_count;
    RETURN;
  END IF;

  -- INDEX branch: migration 170's body verbatim + the set restriction (NULL = unrestricted).
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
    AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')  -- Phase 234 VIS-05
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

-- ── 4. keyword_search_chunks: + p_document_ids ──────────────────────────────────────────────
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
    AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')  -- Phase 234 VIS-05
    AND dc.search_vector @@ tsq
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
    AND (p_document_ids IS NULL OR dc.document_id = ANY (p_document_ids))     -- Phase 272 D-14
  ORDER BY rank DESC
  LIMIT match_count;
END;
$function$;

-- ── 5. The PUBLIC-EXECUTE trap: revoke from PUBLIC, not only anon (migration 181) ───────────
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[]) TO service_role;

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('exactly one match_document_chunks',
--      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'match_document_chunks') = 1),
--     ('exactly one keyword_search_chunks',
--      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'keyword_search_chunks') = 1),
--     ('match_document_chunks has the 9-arg signature',
--      to_regprocedure('public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer)') is not null),
--     ('keyword_search_chunks has the 6-arg signature',
--      to_regprocedure('public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[])') is not null),
--     ('anon cannot exec keyword_search_chunks',
--      not has_function_privilege('anon', 'public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[])', 'EXECUTE')),
--     ('authenticated can exec keyword_search_chunks',
--      has_function_privilege('authenticated', 'public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[])', 'EXECUTE')),
--     ('service_role can exec keyword_search_chunks',
--      has_function_privilege('service_role', 'public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[])', 'EXECUTE')),
--     ('anon cannot exec match_document_chunks',
--      not has_function_privilege('anon', 'public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer)', 'EXECUTE')),
--     ('authenticated can exec match_document_chunks',
--      has_function_privilege('authenticated', 'public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer)', 'EXECUTE')),
--     ('service_role can exec match_document_chunks',
--      has_function_privilege('service_role', 'public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer)', 'EXECUTE')),
--     ('match_document_chunks pins custom plans (WR-04: in the definition itself)',
--      (select 'plan_cache_mode=force_custom_plan' = any (p.proconfig) from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'match_document_chunks')),
--     ('keyword_search_chunks pins custom plans (WR-04: in the definition itself)',
--      (select 'plan_cache_mode=force_custom_plan' = any (p.proconfig) from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'keyword_search_chunks')),
--     ('idx_document_chunks_document_id exists',
--      exists (select 1 from pg_indexes where schemaname = 'public'
--                and indexname = 'idx_document_chunks_document_id')),
--     -- WR-05: an INVALID leftover of a failed CONCURRENTLY build still appears in pg_indexes.
--     -- FAIL here → DROP INDEX CONCURRENTLY IF EXISTS public.idx_document_chunks_document_id;
--     --             then re-run STEP 1 on its own.
--     ('idx_document_chunks_document_id is VALID (indisvalid)',
--      exists (select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
--                join pg_namespace n on n.oid = c.relnamespace
--                where n.nspname = 'public' and c.relname = 'idx_document_chunks_document_id'
--                  and i.indisvalid))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
