-- Migration 051: NULL-safe dedup unique index (Phase 078, CQ-DEDUP-01, D-078-03).
--
-- Migration 043 created documents_dedup_idx on (user_id, content_hash, folder_id)
-- but PostgreSQL treats NULL != NULL in unique indexes, so root-level uploads
-- (folder_id IS NULL) bypass the constraint. This migration drops and recreates
-- the index using COALESCE to map NULL -> a sentinel UUID.
--
-- One-time duplicate cleanup for root-level rows (same pattern as migration 043).

-- (a) Delete root-level duplicates that now conflict under COALESCE semantics
DELETE FROM public.documents
WHERE status != 'failed'
  AND folder_id IS NULL
  AND ctid NOT IN (
    SELECT MIN(ctid) FROM public.documents
    WHERE status != 'failed'
      AND folder_id IS NULL
    GROUP BY user_id, content_hash
  );

-- (b) Drop the old index
DROP INDEX IF EXISTS public.documents_dedup_idx;

-- (c) Recreate with COALESCE — NULL folder_id maps to sentinel UUID
CREATE UNIQUE INDEX documents_dedup_idx
  ON public.documents (user_id, content_hash, COALESCE(folder_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status != 'failed';
