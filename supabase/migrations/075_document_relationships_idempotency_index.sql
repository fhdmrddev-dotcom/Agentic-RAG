-- 075_document_relationships_idempotency_index.sql — Phase 116 (REL-01 / D-116-6).
-- Add the ADDITIVE partial unique index that makes typed-link creation idempotent and
-- race-immune: a `(user_id, source_doc_id, target_doc_id, rel_type)` tuple may exist at
-- most once. The service's `create_relationship` catches the resulting 23505 unique-
-- violation and returns the existing edge (the upsert that returns the existing row),
-- so a duplicate create is a no-op that returns the same link — never a 409, never a
-- second row. The index is the ONLY race-immune guarantee (the 23505-catch handles the
-- TOCTOU window two concurrent creates open; the index is what makes that window
-- collapse to one winner + one re-fetch).
--
-- ADDITIVE ONLY: this CREATEs an index on the already-live `public.document_relationships`
-- table (shipped by migration 071). It adds NO column, NO RLS policy, NO constraint that
-- could reject an existing row — `document_relationships` has no unique constraint today
-- (071 §2.2), and no duplicate tuples exist yet (the table is empty in dev), so the
-- index builds without conflict. `IF NOT EXISTS` makes a re-apply a no-op (idempotent).
--
-- Apply by pasting this whole file into the Supabase SQL editor (or psycopg2 to local
-- :54322 per the 100/099/101.1/102/110/111/114 precedent) — NEVER `supabase db push` /
-- `db reset` (preserves dev data); then `bash scripts/regenerate-full-schema.sh`
-- (no --reset), commit migration + regenerated full-schema.sql together.
-- Plan 04 (operator, autonomous:false / BLOCKING) applies it + regenerates full-schema.sql.
-- This plan (116-01) ONLY AUTHORS the file — it is NOT applied here, and
-- supabase/full-schema.sql is NOT touched here (Plan 04 regenerates it).

CREATE UNIQUE INDEX IF NOT EXISTS document_relationships_idempotency_idx
    ON public.document_relationships (user_id, source_doc_id, target_doc_id, rel_type);
