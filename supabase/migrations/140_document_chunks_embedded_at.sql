-- 140_document_chunks_embedded_at.sql
-- Phase 217.1 (BE-1 / LIB-01) — document_chunks.embedded_at: the honest "when were the
-- vectors for THIS chunk written" timestamp every Indexing-tab fact (Plans 09/10) reads.
--
-- WHY THIS IS OWED AT ALL. `created_at` on document_chunks is the CHUNKING timestamp —
-- written once when the chunk row is inserted — and it never moves on a re-embed. After
-- the first re-index, "when was this chunk last embedded" is a DIFFERENT fact, and
-- printing `created_at` as `Last indexed` is the *Embedding Quality 92%* lie in a new
-- shape: a number that names a time it is not.
--
-- ⚠ NO BACKFILL — THIS IS A DECISION (D-217.1-13 / D-217.1-35), NOT AN OVERSIGHT, AND IT
-- IS RECORDED HERE BECAUSE THE SCHEMA IS WHERE THE NEXT PERSON WILL ASK. Every
-- document_chunks row that predates this migration keeps `embedded_at` NULL forever. A
-- NULL reads "never indexed" honestly; a backfilled `created_at` would claim a re-embed
-- time that never happened. The two client-facing states are structurally distinct and
-- must stay so: `never` (no vector ever written) versus `time not recorded` (a pre-140
-- chunk that HAS a vector).
--
-- ⚠ THE COLUMN DECLARES NO `default` CLAUSE, FOR THE SAME REASON. A `default now()`
-- would backfill every existing row at ALTER time in Postgres 11+, destroying the
-- "never indexed" arm before it ever existed — a backfill by accident is still a
-- backfill. `backend/tests/test_migration_140.py` asserts the absence as a NEGATIVE
-- control, because a test that only proves the column exists cannot tell a no-backfill
-- migration from a backfilled one.
--
-- ⚠ THE COLUMN IS NULLABLE. A `not null` column would have REQUIRED a backfill (or a
-- default) to be addable at all, so the nullability is not a convenience — it is part of
-- the proof that no backfill happened, and the migration test asserts
-- `is_nullable = 'YES'`.
--
-- ── THE FOUR WRITE SITES (D-217.1-35 corrects D-217.1-13's two: a two-site plan leaves
-- table/image chunks NULL forever, and the Folders row would then read `never` for a
-- folder that IS indexed):
--   1. backend/app/api/documents.py:2296-2308      — INSERT — main text chunks
--   2. backend/app/services/multimodal_service.py:423-432 — INSERT — table chunks
--      (also covers `backfill_document_table_chunks` for free, which delegates here)
--   3. backend/app/services/multimodal_service.py:896-908 — INSERT — image chunks
--   4. backend/app/services/reembed_service.py:187-202   — UPDATE — the re-embed path
--
-- ── resize_embedding_column IS REPAIRED ────────────────────────────────────────────────
-- `resize_embedding_column` (mig 073, called on a dims-change re-embed) already NULLs
-- every vector via `USING NULL` on the ALTER. It must NULL `embedded_at` in the SAME
-- statement family, or a chunk with no vector would still show a stale `Last indexed` for
-- a vector that no longer exists. Re-declared here verbatim + the new column (the
-- established idiom — mig 073 already re-declares it from full-schema.sql).
--
-- ── NO RLS WORK IS OWED, and a reviewer will ask, so it is answered here.
-- `document_chunks` already has a live `authenticated` SELECT policy
-- (full-schema.sql:5253-5256) whose predicate is owner OR globally-visible-folder, and
-- it names no column list. `ADD COLUMN` therefore touches no policy — the new column
-- inherits the same access rule as every existing column. ⚠ This is CHECKED, not
-- assumed: `backend/tests/test_migration_140.py` probes `information_schema.columns`
-- and asserts a fresh RLS-enforced SELECT of `embedded_at` on an owned row succeeds (the
-- `connector_connections` column-grant trap).
--
-- ── HOW THIS IS APPLIED ─────────────────────────────────────────────────────────────────
-- Apply by pasting the ENTIRE file into the Supabase SQL editor — ⚠ NEVER `supabase db
-- push` / `supabase db reset` (both wipe local dev data; CLAUDE.md forbids them). Then
-- run `bash scripts/regenerate-full-schema.sh` with NO `--reset`, and commit the
-- regenerated artifact. Never hand-edit `supabase/full-schema.sql`.
--
-- ⚠ CLOUD PARITY (for the eventual operator-triggered promotion, NOT now): this
-- migration must be pasted into the CLOUD Supabase SQL editor in the SAME operation that
-- deploys this backend, or the widened `.insert()`/`.update()` payloads write a column
-- the cloud DB does not have.
--
-- BEGIN/COMMIT wrapping (migration 115's review finding WR-01, inherited by 121):
-- without it the ALTER would run in its own implicit transaction when pasted, and a
-- dropped session could leave the table half-migrated. `IF NOT EXISTS` makes a re-paste
-- safe.

BEGIN;

ALTER TABLE public.document_chunks
    ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

COMMENT ON COLUMN public.document_chunks.embedded_at IS
  'Phase 217.1 (BE-1 / LIB-01): the instant THIS chunk''s vector was written, set at all FOUR document_chunks write sites — main ingest (backend/app/api/documents.py:2296), table chunks (backend/app/services/multimodal_service.py:423), image chunks (multimodal_service.py:896) and the re-embed UPDATE (backend/app/services/reembed_service.py:187). NULLABLE and NOT BACKFILLED (D-217.1-13): a pre-140 chunk keeps NULL forever, which reads "never indexed" — distinct from "time not recorded". created_at is the CHUNKING time and does not move on a re-embed; using it would print a lie after the first re-index. resize_embedding_column NULLs it alongside the vector on a dims change.';

-- resize_embedding_column: re-declared so a dims-change re-embed NULLs embedded_at
-- alongside the vector it already NULLs (a chunk whose vector was dropped must not keep
-- a stale Last indexed). Verbatim from 073 + the new column in the same USING NULL family.
CREATE OR REPLACE FUNCTION public.resize_embedding_column(new_dim integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Drop the HNSW index
  DROP INDEX IF EXISTS public.document_chunks_embedding_idx;
  -- Alter column type (NULLs out existing embeddings + their embedded_at — incompatible
  -- dimensions mean the vector no longer exists, so "last indexed" is a lie)
  EXECUTE format(
    'ALTER TABLE public.document_chunks
       ALTER COLUMN embedding TYPE vector(%s) USING NULL,
       ALTER COLUMN embedded_at TYPE timestamptz USING NULL',
    new_dim
  );
  -- Recreate HNSW index
  EXECUTE format(
    'CREATE INDEX document_chunks_embedding_idx ON public.document_chunks
     USING hnsw (embedding vector_cosine_ops)
     WITH (m = 16, ef_construction = 64)'
  );
END;
$$;

COMMIT;
