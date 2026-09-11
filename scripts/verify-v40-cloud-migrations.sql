-- v4.0 cloud migration verification — READ ONLY, writes nothing.
-- Paste into the Supabase SQL editor (cloud), or run it over the Supabase MCP
-- (`execute_sql` — reads need no approval), and read the output.
--
-- ⚠⚠ REPAIRED 2026-09-11 (Phase 242, D-242-05). THIS SCRIPT PRODUCED TWO FALSE `FAIL`s AND
--    BOTH WOULD HAVE BEEN BELIEVED. It is the tool the phase was built to trust, and a checker
--    that fails closed on its own blind spot is worse than no checker. What changed, and why:
--
--  1. THE `156` GRANT CHECK READ THE WRONG CATALOG.  It asked
--     `information_schema.column_privileges`, which by SQL-standard definition shows ONLY the
--     grants VISIBLE TO THE CONNECTING ROLE — so under any role that is neither grantor nor
--     grantee it returns EMPTY FOR EVERY COLUMN, not just for the one being asked about. That is
--     exactly what happened: the row read `*** FAIL ***` while the database was perfectly correct.
--     Re-read authoritatively from `pg_attribute.attacl`, the column's real ACL, it carries
--     `authenticated=arw/postgres, service_role=arw/postgres` — migration 156's exact grant set,
--     deliberately wider than every other column on the table (which carry `r` only).
--     ⭐ Third time the `connector_connections` column-grant trap has been in play on this table,
--        and the FIRST time the checker was the thing at fault.
--     The row below now reads `attacl` directly AND corroborates with `has_column_privilege`,
--     which answers the question that actually matters — *can `authenticated` read this column* —
--     regardless of whether the grant was expressed at column, table or PUBLIC level.
--
--  2. THE `176` ROW ASSERTED ABSENCE, AND THAT WINDOW CLOSED ON 2026-09-10.  It was written to
--     guard the pre-deploy window: 176 was deliberately withheld until Phase 241's UAT row 5 had
--     run, so `ok` meant "still absent". Row 5 was driven on a local substitute and its cloud
--     window is permanently closed (`241-HUMAN-UAT.md`, retired in writing at `dbd63864b`); the
--     fifteen migrations went to cloud as one batch during the v4.0 production prep. So the
--     inverted row was reporting `*** FAIL ***` for the SUCCESS case.
--     ⛔ The polarity is now PRESENCE, permanently. Do not flip it back — there is no environment
--        left in which "176 absent" is the correct state.
--
-- Expected now, on any database that has had the full v4.0 set applied: EVERY row PASS.
-- A `*** FAIL ***` means that migration genuinely has not landed — apply it by pasting into the
-- SQL editor in numeric order, NEVER `supabase db push` / `db reset`.

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

  -- ⚠ REPAIRED (D-242-05). `information_schema.column_privileges` shows only the grants the
  --   CONNECTING role can see, so it returns empty for every column under a role that is neither
  --   grantor nor grantee — a false FAIL that says nothing about the database. `pg_attribute.attacl`
  --   is the column's real ACL and is readable by anyone who can read the catalog.
  ('156', 'that column carries an explicit column-level GRANT to authenticated (the 118 trap)',
   exists(select 1
          from pg_attribute a
          join pg_class c on c.oid = a.attrelid
          join pg_namespace n on n.oid = c.relnamespace,
               lateral unnest(coalesce(a.attacl, '{}'::aclitem[])) as acl
          where n.nspname='public' and c.relname='connector_connections'
            and a.attname='default_ingest_visibility'
            and split_part(acl::text, '=', 1) = 'authenticated'
            and split_part(split_part(acl::text, '=', 2), '/', 1) like '%r%')),

  -- The corroborating half: the question that actually matters, answered by Postgres itself and
  -- independent of HOW the grant was expressed (column, table, or PUBLIC).
  ('156', 'authenticated can in fact SELECT that column (has_column_privilege)',
   has_column_privilege('authenticated', 'public.connector_connections',
                        'default_ingest_visibility', 'SELECT')),

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

  -- ⚠ POLARITY CHANGED 2026-09-11 (D-242-05), and it does not change back. This row used to
  --   assert the knobs were ABSENT — a deliberate inversion guarding the pre-deploy window while
  --   176 was withheld for Phase 241's UAT row 5. That window closed on 2026-09-10 when the
  --   fifteen migrations went to cloud in one batch, so the inverted row began reporting
  --   `*** FAIL ***` for the SUCCESS case. There is no environment left in which absence is
  --   correct.
  ('176', 'app_settings.hnsw_ef_search + hnsw_iterative_scan PRESENT',
   (select count(*) from information_schema.columns
    where table_schema='public' and table_name='app_settings'
      and column_name in ('hnsw_ef_search','hnsw_iterative_scan')) = 2),

  -- ⚠⚠ ADDED 2026-09-11 (Phase 242 code review, WR-09). THIS SCRIPT'S HEADER CLAIMS "every row
  --    PASS" MEANS PARITY, AND IT HAD NO ROW FOR THE ONE MIGRATION THAT IS A SECURITY FIX.
  --    `177_rls_app_settings_user_settings.sql` (BUG-260911-01) enables RLS on `app_settings` and
  --    `user_settings` and takes `anon` off both, after they were found world-readable AND
  --    world-WRITABLE in production. Its own header records the reason nothing caught it: every
  --    gate in this project reads through the SERVICE ROLE, so no test ever makes a request as
  --    `anon`. **A parity checker with no row for it has exactly the blind spot 177 exists to
  --    close** — so it gets four rows, not one, and they assert the OUTCOME (can anon do it?)
  --    rather than the mechanism.
  --    ⭐ Measured 2026-09-11: all four PASS in production. 177 is APPLIED to cloud.
  ('177', 'app_settings has RLS enabled',
   (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='app_settings')),

  ('177', 'user_settings has RLS enabled',
   (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='user_settings')),

  ('177', 'anon can NEITHER read nor write app_settings',
   not has_table_privilege('anon','public.app_settings','SELECT')
   and not has_table_privilege('anon','public.app_settings','UPDATE')),

  -- ⚠ The PUBLIC trap, and why this row asserts the outcome: functions are granted EXECUTE to
  --   PUBLIC by default, so REVOKE … FROM anon is a NO-OP while the PUBLIC grant stands. 177
  --   measured that the hard way. `resize_embedding_column` DELETES EVERY VECTOR IN THE CORPUS.
  ('177', 'anon cannot execute resize_embedding_column (deletes every vector)',
   not has_function_privilege('anon','public.resize_embedding_column(integer)','EXECUTE')),

  -- ⛔ Phase 242's own migration. It is DELIBERATELY not applied to cloud yet — a production write
  --    needs per-action operator approval — so this row is EXPECTED TO FAIL until it is applied,
  --    and that is the one FAIL in this script that is not a defect. Low urgency: cloud holds 100
  --    and 50, both in range, so the constraint is a backstop against a future hand-edit.
  ('178', 'app_settings bound CHECKs present (EXPECTED FAIL until 178 is applied to cloud)',
   (select count(*) from pg_constraint
    where conname in ('app_settings_multimodal_max_vision_calls_bound',
                      'app_settings_vision_max_pages_bound')) = 2)

)
select mig,
       case when ok then 'PASS' else '*** FAIL ***' end as status,
       what
from c
order by mig, what;
