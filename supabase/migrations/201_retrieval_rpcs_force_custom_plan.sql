-- 201_retrieval_rpcs_force_custom_plan.sql
-- Phase 272 (272-05, SC#3 / D-14): pin both chunk-retrieval RPCs to CUSTOM plans.
-- Functions: public.match_document_chunks (9-arg, migration 200)
--            public.keyword_search_chunks (6-arg, migration 200)
--
-- ⛔ APPLY IN THE SAME SESSION AS MIGRATION 200, IMMEDIATELY AFTER IT, AND BEFORE THE BACKEND
--    DEPLOY. Migration 200 WITHOUT this one regresses UNFILTERED search on every pooled connection.
--
-- WHY. Migration 200 added the btree `idx_document_chunks_document_id`, which the exact branch
-- needs. The SEED-273 ladder's mandatory CUSTOM-and-GENERIC EXPLAIN (272-05) found what that index
-- does to the GENERIC plan of the bodies' statements:
--
--   PL/pgSQL caches each statement's plan per session. For the first five executions it plans
--   with the real arguments (custom plans); from the sixth it may switch to ONE generic plan that
--   ignores them. With the new btree available, the generic plan joins every visible document to
--   its chunks through `document_id` and sorts the whole set — it never walks HNSW. A pooled
--   backend connection serves many requests, so after its fifth retrieval call every later call
--   on that connection runs the whole-table plan, filtered or not.
--
-- Measured on recall_bench (100,000 chunks, pgvector 0.8.0, 2026-10-03), 12 sequential calls on
-- ONE session, every DDL inside a transaction that was rolled back:
--
--   unfiltered vector, migration 170 body, no btree (pre-272) ......  3-8 ms on every call
--   unfiltered vector, migration 170 body + btree ..................  calls 6-12: 450-1,030 ms
--   unfiltered vector, migration 200 as applied ....................  calls 6-12: 490-1,560 ms
--   unfiltered vector, migration 200 + this pin ....................  2.5-6 ms on every call
--   filtered (500-chunk set) index branch, 200 as applied ..........  calls 6-12: 440-500 ms
--   filtered (500-chunk set) index branch, 200 + this pin ..........  8-20 ms on every call
--   unfiltered keyword, migration 170 body, no btree (pre-272) .....  0.5-0.9 s (a term in every chunk)
--   unfiltered keyword, migration 200 as applied ...................  calls 6-12: 11.7-31.0 SECONDS
--   unfiltered keyword, migration 200 + this pin ...................  0.15-0.42 s
--
-- So the index alone (170 body + btree) causes it; the pin removes it. Evidence and the script:
-- .planning/phases/272-close-means-wrong/evidence/plancache-diagnosis.txt.
--
-- THE FIX. `SET plan_cache_mode = force_custom_plan` as a FUNCTION attribute: inside these two
-- functions every statement is planned with the call's real arguments, so a NULL document set
-- folds away and HNSW / GIN are chosen exactly as before 200, and a small set picks the btree.
-- Cost: one planning pass per call (sub-millisecond here). No body, signature or ACL changes —
-- ALTER FUNCTION … SET keeps the function's grants (migration 200's PUBLIC/anon revoke stands).
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor. NEVER `supabase db push` /
-- `db reset`. Safe to paste twice (ALTER … SET is idempotent).
-- ============================================================================

BEGIN;

ALTER FUNCTION public.match_document_chunks(
  public.vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer
) SET plan_cache_mode = force_custom_plan;

ALTER FUNCTION public.keyword_search_chunks(
  text, uuid, integer, jsonb, uuid[], uuid[]
) SET plan_cache_mode = force_custom_plan;

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('match_document_chunks pins custom plans',
--      (select 'plan_cache_mode=force_custom_plan' = any (p.proconfig) from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'match_document_chunks')),
--     ('keyword_search_chunks pins custom plans',
--      (select 'plan_cache_mode=force_custom_plan' = any (p.proconfig) from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'keyword_search_chunks')),
--     ('match_document_chunks keeps search_path empty',
--      (select 'search_path=""' = any (p.proconfig) from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'match_document_chunks')),
--     ('anon still cannot exec match_document_chunks',
--      not has_function_privilege('anon', 'public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer)', 'EXECUTE')),
--     ('anon still cannot exec keyword_search_chunks',
--      not has_function_privilege('anon', 'public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[])', 'EXECUTE'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
