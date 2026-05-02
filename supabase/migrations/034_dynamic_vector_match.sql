-- Migration 008b: Dimension-agnostic match_document_chunks
-- Run AFTER 008_hybrid_search.sql
--
-- Removes the hardcoded vector(1536) dimension from match_document_chunks so
-- the function works with any embedding model (nomic-embed-text=768, etc.).
-- Same drop-then-recreate pattern as 007b to avoid PostgREST overload ambiguity.

DROP FUNCTION IF EXISTS public.match_document_chunks(vector(1536), uuid, integer, float, jsonb);
DROP FUNCTION IF EXISTS public.match_document_chunks(vector, uuid, integer, float, jsonb);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector,
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
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
