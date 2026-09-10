-- v4.0 cloud migration verification — READ ONLY, writes nothing.
-- Paste into the Supabase SQL editor (cloud) and send back the output.
--
-- Expected at Stage B: every row ok=true INCLUDING the last one, because
-- migration 176 is deliberately withheld until Phase 241's UAT row 5 has run.
-- Expected after Stage E: the last row flips to ok=false — that row asserts
-- 176 is ABSENT, so it is the one check that is supposed to invert.

with c(mig, what, ok) as (values

  ('153', 'table ingestion_jobs',
   to_regclass('public.ingestion_jobs') is not null),

  ('154', 'documents.source_connection_id',
   exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='documents'
            and column_name='source_connection_id')),

  ('154', 'documents.ingest_visibility',
   exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='documents'
            and column_name='ingest_visibility')),

  ('154', 'fn connection_doc_is_visible',
   exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname='connection_doc_is_visible')),

  ('154', 'match_document_chunks REPLACED (calls the visibility fn)',
   exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname='match_document_chunks'
            and pg_get_functiondef(p.oid) like '%connection_doc_is_visible%')),

  ('154', 'keyword_search_chunks REPLACED (calls the visibility fn)',
   exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname='keyword_search_chunks'
            and pg_get_functiondef(p.oid) like '%connection_doc_is_visible%')),

  ('155', 'connector_connections.default_ingest_visibility',
   exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='connector_connections'
            and column_name='default_ingest_visibility')),

  ('156', 'that column is GRANTed to authenticated (the 118 trap)',
   exists(select 1 from information_schema.column_privileges
          where table_schema='public' and table_name='connector_connections'
            and column_name='default_ingest_visibility'
            and grantee='authenticated' and privilege_type='SELECT')),

  ('166', 'app_settings.vision_model + vision_max_pages',
   (select count(*) from information_schema.columns
    where table_schema='public' and table_name='app_settings'
      and column_name in ('vision_model','vision_max_pages')) = 2),

  ('167', 'resize_embedding_column also resizes skill_embeddings',
   exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname='resize_embedding_column'
            and pg_get_functiondef(p.oid) like '%skill_embeddings%')),

  ('168', 'table connector_watches',
   to_regclass('public.connector_watches') is not null),

  ('169', 'table connector_watch_items',
   to_regclass('public.connector_watch_items') is not null),

  ('170', 'documents.source_state',
   exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='documents'
            and column_name='source_state')),

  ('171', 'no-op placeholder — nothing to assert',
   true),

  ('172', 'table connector_sync_runs',
   to_regclass('public.connector_sync_runs') is not null),

  ('173', 'classification_rules.rule_scope',
   exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='classification_rules'
            and column_name='rule_scope')),

  ('174', 'app_settings.source_max_file_size_mb',
   exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='app_settings'
            and column_name='source_max_file_size_mb')),

  ('175', 'documents.thread_key',
   exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='documents'
            and column_name='thread_key')),

  ('176', 'HNSW knobs still ABSENT (must stay false until UAT row 5 runs)',
   (select count(*) from information_schema.columns
    where table_schema='public' and table_name='app_settings'
      and column_name in ('hnsw_ef_search','hnsw_iterative_scan')) = 0)

)
select mig,
       case when ok then 'PASS' else '*** FAIL ***' end as status,
       what
from c
order by mig, what;
