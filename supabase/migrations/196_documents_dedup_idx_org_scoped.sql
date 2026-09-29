-- 196 — Phase 266 review WR-04 (completes D-266-18)
-- Index: public.documents_dedup_idx — widened to (org_id, user_id, content_hash, COALESCE(folder_id, …))
--
-- WHY. Migration 195 org-scoped documents_completed_hash_unique_idx and made mint_document_row's
-- dedup check and on_conflict="link" re-query org-scoped (D-266-18). The SECOND user-scoped unique
-- index on documents was missed: it stayed (user_id, content_hash, COALESCE(folder_id, 0…0)).
-- Folder ids never repeat across orgs, so only the ROOT (folder_id NULL → the zero uuid) collides.
-- For an org-scoped caller (import_service, watch_service, email_attachments) minting into the
-- root while the same user holds those bytes at root in ANOTHER org:
--   1. the org-scoped dedup check misses;
--   2. the insert 23505s on documents_dedup_idx;
--   3. the org-scoped link re-query finds nothing;
--   4. the call raises a false 409 "File already exists in this folder" — every watch cycle.
-- A watch whose folder was deleted lands at the root (FK ON DELETE SET NULL), so this is reachable
-- without anyone choosing the root.
--
-- The new key is STRICTLY LOOSER than the old one (one more column, same predicate), so no
-- existing row can violate it. documents.org_id is NOT NULL, so no NULL-distinctness gap opens.
-- CONCURRENTLY is deliberately NOT used: it cannot run inside this transaction (or the SQL editor
-- paste), and public.documents is small enough for a brief build lock — the 195 precedent.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS public.documents_dedup_idx;
CREATE UNIQUE INDEX documents_dedup_idx
    ON public.documents USING btree (
        org_id,
        user_id,
        content_hash,
        COALESCE(folder_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE (status <> 'failed'::text);

COMMIT;
