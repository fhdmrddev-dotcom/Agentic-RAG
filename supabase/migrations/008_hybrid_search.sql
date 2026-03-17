-- Migration 008: Module 6 - Hybrid Search & Reranking
-- Run in Supabase SQL editor before starting the backend.
-- Apply BEFORE 008b_dynamic_vector_match.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add search_vector column for full-text search
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GIN index for fast full-text search
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS document_chunks_search_vector_idx
  ON public.document_chunks USING gin(search_vector);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger to auto-populate search_vector on INSERT or UPDATE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_search_vector ON public.document_chunks;
CREATE TRIGGER trg_update_search_vector
  BEFORE INSERT OR UPDATE OF content
  ON public.document_chunks
  FOR EACH ROW EXECUTE FUNCTION public.update_search_vector();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Backfill existing rows
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.document_chunks
SET search_vector = to_tsvector('english', COALESCE(content, ''))
WHERE search_vector IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. keyword_search_chunks RPC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.keyword_search_chunks(
  search_query    text,
  match_user_id   uuid,
  match_count     integer DEFAULT 20,
  metadata_filter jsonb   DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, rank float)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tsq tsquery;
BEGIN
  tsq := plainto_tsquery('english', search_query);
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    ts_rank_cd(dc.search_vector, tsq)::float AS rank
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND dc.search_vector @@ tsq
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. resize_embedding_column helper (manual-use only, never called automatically)
--    Usage: SELECT resize_embedding_column(768);
--    WARNING: drops all existing embeddings — re-ingestion required after running
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resize_embedding_column(new_dim integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Drop the HNSW index
  DROP INDEX IF EXISTS public.document_chunks_embedding_idx;
  -- Alter column type (NULLs out existing embeddings — incompatible dimensions)
  EXECUTE format(
    'ALTER TABLE public.document_chunks ALTER COLUMN embedding TYPE vector(%s) USING NULL',
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
