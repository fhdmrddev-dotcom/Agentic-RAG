-- 167_resize_skill_embeddings_with_chunks.sql
--
-- ── WHAT THIS FIXES ───────────────────────────────────────────────────────────────────
-- `resize_embedding_column(new_dim)` (mig 073, re-declared verbatim in mig 140) ALTERs
-- `public.document_chunks` and NOTHING ELSE. But `document_chunks` is not the only table
-- holding vectors produced by the configured embedding model: `public.skill_embeddings`
-- (mig 091) holds one vector per skill, written by the SAME embedding path
-- (`backend/app/services/skill_embedding_service.py` -> `embed_texts`), and its column is
-- pinned at the literal `vector(1536)` that mig 091 chose to match text-embedding-3-small.
--
-- So switching the embedding model to any NON-1536 model — the exact operation
-- `resize_embedding_column` exists to support — resizes `document_chunks` to the new
-- width and leaves `skill_embeddings` at 1536. Document search recovers when the re-embed
-- job finishes; SKILL retrieval does not, because every subsequent skill-embedding write
-- raises a pgvector dimension-mismatch on insert. ⚠ THE FAILURE IS SILENT AT THE POINT OF
-- THE SWITCH: nothing writes `skill_embeddings` during the settings save, so the operator
-- sees a green re-embed and a healthy library, and only discovers the break the next time
-- the skill-catalog backfill runs. MEASURED on the live local DB 2026-09-05: 6017 chunks
-- vs 4 skill rows — the small table is exactly the one nobody notices.
--
-- ── WHY BOTH TABLES BELONG IN ONE FUNCTION ────────────────────────────────────────────
-- Because they share ONE knob. `app_settings.embedding_dimensions` is a single value and
-- `embed_texts` sends no `dimensions` param to any provider, so every vector the app
-- writes is the configured model's native width. Two tables that must agree on a width,
-- resized by two different mechanisms, is drift waiting to happen — and the drift is
-- exactly the bug above. One function, both tables, one width.
--
-- ⚠ `skill_embeddings` deliberately has NO ANN index (mig 091 comment: "mirror
-- document_chunks, MINUS the ANN index" — 4 rows do not warrant one), so unlike
-- `document_chunks` there is no index to drop and recreate here. Do not add one to make
-- the two arms look symmetric; the asymmetry is the correct shape.
--
-- ── WHAT THE CALLER MUST STILL DO ─────────────────────────────────────────────────────
-- NULLing the skill vectors is the whole point (a 1536-d vector is meaningless in a
-- 1024-d space), and `skill_embedding_service` already re-embeds any row whose
-- `embedding_model` is stale — the D-10 cross-vector-space guard. Setting
-- `embedding_model` to NULL alongside the vector makes those rows stale by that existing
-- predicate, so the established backfill picks them up with NO new code. Do not invent a
-- second staleness mechanism.
--
-- ── HOW THIS IS APPLIED ───────────────────────────────────────────────────────────────
-- Paste this ENTIRE file into the Supabase SQL editor — ⚠ NEVER `supabase db push` /
-- `supabase db reset` (both wipe local dev data; CLAUDE.md forbids them). Then run
-- `bash scripts/regenerate-full-schema.sh` with NO `--reset` and commit the regenerated
-- artifact. Never hand-edit `supabase/full-schema.sql`.
--
-- ⚠ CLOUD PARITY: this migration must be pasted into the CLOUD Supabase SQL editor in the
-- SAME operation that deploys a backend allowed to change embedding dimensions, or a
-- cloud dims change re-breaks skill retrieval exactly as described above.
--
-- BEGIN/COMMIT wrapping (mig 115 WR-01, inherited by 121/140): without it the CREATE OR
-- REPLACE would run in its own implicit transaction when pasted, and a dropped session
-- could leave the function half-replaced. CREATE OR REPLACE makes a re-paste safe.

BEGIN;

CREATE OR REPLACE FUNCTION public.resize_embedding_column(new_dim integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- ── document_chunks (verbatim from mig 140 — unchanged behaviour) ──────────────────
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

  -- ── skill_embeddings (NEW in mig 167) ─────────────────────────────────────────────
  -- The second table fed by the same embedding knob. No ANN index exists on it by
  -- design (mig 091), so there is nothing to drop or recreate — only the width changes.
  -- embedding_model is NULLed in the SAME statement so the row becomes stale by the
  -- EXISTING D-10 predicate and the established skill-embedding backfill re-embeds it.
  -- embedding_dimensions is NULLed for the same reason: a recorded width for a vector
  -- that no longer exists is the same lie embedded_at was on document_chunks.
  EXECUTE format(
    'ALTER TABLE public.skill_embeddings
       ALTER COLUMN embedding TYPE vector(%s) USING NULL,
       ALTER COLUMN embedding_model TYPE text USING NULL,
       ALTER COLUMN embedding_dimensions TYPE integer USING NULL',
    new_dim
  );
END;
$$;

COMMENT ON FUNCTION public.resize_embedding_column(integer) IS
  'Phase mig 167: resizes the vector column of BOTH tables fed by app_settings.embedding_dimensions '
  '— document_chunks (with HNSW drop/recreate) and skill_embeddings (no ANN index by design, mig 091). '
  'Called ONLY on a true dims change (backend/app/services/reembed_service.py gates on dims_changed). '
  'Every vector in both tables is NULLed by the ALTER: an old-width vector is meaningless in the new '
  'space. document_chunks.embedded_at and skill_embeddings.embedding_model/.embedding_dimensions are '
  'NULLed alongside so no row claims an index time or a model for a vector that no longer exists — '
  'and so skill rows become stale by the existing D-10 predicate and are picked up by the established '
  'skill_embedding_service backfill with no second staleness mechanism. ⚠ Before mig 167 this function '
  'covered document_chunks ONLY, so any non-1536 model silently broke skill-embedding writes with a '
  'pgvector dimension mismatch while document search recovered normally.';

COMMIT;
