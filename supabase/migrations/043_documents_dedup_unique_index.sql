-- Migration 043: documents dedup unique index (Phase 071, CQ-DEDUP-01, PRD §6 row 8).
--
-- DESTRUCTIVE: deletes pre-existing duplicate rows (keeps OLDEST ctid per group)
-- BEFORE creating the index. Plan 01 dry-run captured the count of affected rows
-- and surfaced it to the user; user confirmed before this migration was applied.
-- Heuristic: keep OLDEST row per (user_id, content_hash, folder_id) — older rows
-- have more downstream dependents (chunk embeddings, message references).
-- T-071-01-02 mitigation: ctid NOT IN (SELECT MIN(ctid) ...) — oldest wins.

-- (a) One-time DELETE — keeps OLDEST row per (user_id, content_hash, folder_id)
DELETE FROM public.documents
WHERE status != 'failed'
  AND ctid NOT IN (
    SELECT MIN(ctid) FROM public.documents
    WHERE status != 'failed'
    GROUP BY user_id, content_hash, folder_id
  );

-- (b) Partial unique index — race-free dedup going forward
CREATE UNIQUE INDEX IF NOT EXISTS documents_dedup_idx
  ON public.documents (user_id, content_hash, folder_id)
  WHERE status != 'failed';
