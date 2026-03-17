-- Migration 007: Module 4 - Document Metadata Extraction
-- Run in Supabase SQL editor before starting the backend.

ALTER TABLE public.documents ADD COLUMN metadata jsonb;

-- GIN index for fast @> containment queries on metadata
CREATE INDEX documents_metadata_gin_idx ON public.documents USING gin(metadata);

-- Drop the old function signature first to avoid overload ambiguity in PostgREST.
-- CREATE OR REPLACE with a new parameter creates a second overload, not a replacement.
DROP FUNCTION IF EXISTS public.match_document_chunks(vector, uuid, integer, float);

-- Replace match_document_chunks RPC with metadata-filter-aware version.
-- metadata_filter IS NULL short-circuits → zero cost for unfiltered calls.
-- Existing callers that omit the parameter receive NULL and are unaffected.
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_count     integer DEFAULT 5,
  match_threshold float   DEFAULT 0.3,
  metadata_filter jsonb   DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, similarity float)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
