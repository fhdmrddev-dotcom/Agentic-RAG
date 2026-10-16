-- ============================================================================
-- 209 — Phase 285 (Watch and Re-upload Close Out): FIX-12, FIX-13, FIX-14.
-- The phase's ONLY schema + data change.
--
-- WHAT EACH SECTION DOES
--   1. connector_watch_items.failed_attempts (FIX-12, D-01). Consecutive failed reads of a watched
--      file. watch_service.sync_watch reads a `failed` item again on later syncs until this reaches
--      3; a success resets it to 0, and so does a version change at the source. Before 209 a file
--      whose download failed once was never read again (BUG-261014-02).
--   2. connector_watch_items.minted (FIX-13, D-06). True only when THIS watch minted the document
--      the item points at (the minter answered is_duplicate=false). A purge deletes minted,
--      unshared documents only. Default false = KEPT by a purge: data loss is the bug class being
--      fixed (BUG-261014-03), so an unknown row fails safe.
--   3. A ONE-SHOT backfill of `minted` for legacy items. D-07 as written ("the document's
--      source_connection_id equals the watch's connection_id AND metadata.source.external_id
--      equals the item's external_id") was REFINED by orchestrator ruling 1, because measured on
--      the local DB it would mark 8 rows minted that the watch did not mint: 7 documents on the
--      `CV` watch created six days BEFORE the watch existed, and one created 3 minutes before the
--      `Finance` watch. The manual import door stamps the same provenance a watch mint does, and
--      the watch only dedup-linked those rows. So a legacy item is marked minted only when ALSO
--        - its document was created at or after its watch, AND
--        - its document was created in the 10 minutes before the item was first seen
--          (the longest genuine mint-to-item gap measured was 1.58 s).
--      Every other item stays minted=false and is kept by a purge. The backfill runs only on the
--      apply that ADDS the column (v_fresh), so a re-run never overwrites a marker the runtime
--      wrote since.
--   4. The D-14 heal (FIX-14, BUG-261014-04). A document stuck `pending` with no ingestion_jobs
--      row for more than 1 hour absorbs every later same-bytes upload. If its bytes are in
--      storage it gets a pending job; otherwise it is marked failed with a plain message, so the
--      next same-bytes upload mints and ingests. A row with no bytes is NEVER enqueued (an empty
--      document would "complete", BUG-260905-08). The 1-hour bound keeps it clear of live
--      uploads. Enqueue first, then fail what is left, in one transaction.
--
-- Counts are printed with RAISE NOTICE. Idempotent: a second apply adds nothing, skips the
-- backfill and heals 0 rows.
--
-- No GRANT, no anon, no RLS change: connector_watch_items keeps RLS and its table-level grants,
-- which cover new columns; it has no column-level grants. No function is created (DO blocks
-- only), so D-19's SECURITY INVOKER / REVOKE FROM PUBLIC rule has nothing to apply to.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor, or locally with
-- scripts/apply_migration_209.py (loopback only). NEVER `supabase db push` / `db reset`.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset).
-- ============================================================================

BEGIN;

-- ── 1-3. Columns, the nonneg CHECK, and the ONE-SHOT minted backfill ─────────────────────────
DO $$
DECLARE
  v_fresh  boolean := NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'connector_watch_items'
               AND column_name = 'minted');
  v_minted int := 0;
  v_linked int := 0;
BEGIN
  ALTER TABLE public.connector_watch_items
    ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS minted boolean NOT NULL DEFAULT false;

  IF v_fresh THEN
    UPDATE public.connector_watch_items i
       SET minted = true
      FROM public.connector_watches w, public.documents d
     WHERE w.id = i.watch_id AND d.id = i.document_id
       AND d.source_connection_id = w.connection_id
       AND d.metadata->'source'->>'external_id' = i.external_id
       AND d.created_at >= w.created_at
       AND d.created_at BETWEEN i.first_seen_at - interval '10 minutes' AND i.first_seen_at;
    GET DIAGNOSTICS v_minted = ROW_COUNT;
    SELECT count(*) INTO v_linked FROM public.connector_watch_items
     WHERE document_id IS NOT NULL AND NOT minted;
    RAISE NOTICE '209 backfill: % item(s) marked minted, % linked item(s) will be kept by a purge',
      v_minted, v_linked;
  ELSE
    RAISE NOTICE '209 backfill: skipped, columns already present (one-shot)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'connector_watch_items_failed_attempts_nonneg') THEN
    ALTER TABLE public.connector_watch_items
      ADD CONSTRAINT connector_watch_items_failed_attempts_nonneg CHECK (failed_attempts >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.connector_watch_items.failed_attempts IS
  'Phase 285 (FIX-12): consecutive failed reads of this item. Reset to 0 on success or a source version change; reads stop at 3 while state stays failed.';
COMMENT ON COLUMN public.connector_watch_items.minted IS
  'Phase 285 (FIX-13): true only when THIS watch minted document_id (minter is_duplicate=false). Purge deletes minted, unshared documents only. Default false = kept.';

-- ── 4. Heal stuck pending rows (D-14). Enqueue FIRST, then fail what is left. ────────────────
-- 209 HEAL BEGIN
DO $$
DECLARE
  v_enqueued int := 0;
  v_failed   int := 0;
BEGIN
  INSERT INTO public.ingestion_jobs (document_id, user_id, org_id)
  SELECT d.id, d.user_id, d.org_id
    FROM public.documents d
   WHERE d.status = 'pending'
     AND d.created_at < now() - interval '1 hour'
     AND NOT EXISTS (SELECT 1 FROM public.ingestion_jobs j WHERE j.document_id = d.id)
     AND EXISTS (SELECT 1 FROM storage.objects o
                  WHERE o.bucket_id = 'documents' AND o.name = d.file_path);
  GET DIAGNOSTICS v_enqueued = ROW_COUNT;

  UPDATE public.documents d
     SET status = 'failed', ingestion_step = 'failed',
         error_message = 'This file was never read, because its upload did not finish. Please upload it again.'
   WHERE d.status = 'pending'
     AND d.created_at < now() - interval '1 hour'
     AND NOT EXISTS (SELECT 1 FROM public.ingestion_jobs j WHERE j.document_id = d.id)
     AND NOT EXISTS (SELECT 1 FROM storage.objects o
                      WHERE o.bucket_id = 'documents' AND o.name = d.file_path);
  GET DIAGNOSTICS v_failed = ROW_COUNT;

  RAISE NOTICE '209 heal: % stuck row(s) enqueued (bytes present), % marked failed (no bytes)',
    v_enqueued, v_failed;
END $$;
-- 209 HEAL END

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--   with checks(what, ok) as (values
--     ('failed_attempts int NOT NULL DEFAULT 0', exists(select 1 from information_schema.columns where table_schema='public' and table_name='connector_watch_items' and column_name='failed_attempts' and data_type='integer' and is_nullable='NO' and column_default='0')),
--     ('minted boolean NOT NULL DEFAULT false', exists(select 1 from information_schema.columns where table_schema='public' and table_name='connector_watch_items' and column_name='minted' and data_type='boolean' and is_nullable='NO' and column_default='false')),
--     ('nonneg CHECK present', exists(select 1 from pg_constraint where conname='connector_watch_items_failed_attempts_nonneg')),
--     ('no minted item points at a doc older than its watch', not exists(select 1 from public.connector_watch_items i join public.connector_watches w on w.id=i.watch_id join public.documents d on d.id=i.document_id where i.minted and d.created_at < w.created_at)),
--     ('no column-level ACL appeared', not exists(select 1 from pg_attribute where attrelid='public.connector_watch_items'::regclass and attacl is not null)),
--     ('authenticated keeps table UPDATE', has_table_privilege('authenticated','public.connector_watch_items','UPDATE')),
--     ('anon has no SELECT', not has_table_privilege('anon','public.connector_watch_items','SELECT')),
--     ('no stuck pending row older than 1h without a job', not exists(select 1 from public.documents d where d.status='pending' and d.created_at < now()-interval '1 hour' and not exists(select 1 from public.ingestion_jobs j where j.document_id=d.id)))
--   ) select case when ok then 'PASS' else 'FAIL' end as status, what from checks;
