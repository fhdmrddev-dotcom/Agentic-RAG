-- Migration 023: Add chunk_index to match_document_chunks and keyword_search_chunks RPCs
-- The document_chunks table has chunk_index since migration 002 but both RPCs omitted it.
-- Without it, retrieval_service._enrich_with_filenames always gets chunk_index=None,
-- and citation cards always show "Full document" instead of "Chunk N".
-- Must DROP before recreating — PostgreSQL forbids changing return type via CREATE OR REPLACE.

DROP FUNCTION IF EXISTS public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[]);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector,
  match_user_id   uuid,
  match_count     integer DEFAULT 5,
  match_threshold float   DEFAULT 0.3,
  metadata_filter jsonb   DEFAULT NULL,
  p_folder_ids    uuid[]  DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, chunk_index integer, similarity float)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


DROP FUNCTION IF EXISTS public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[]);

CREATE OR REPLACE FUNCTION public.keyword_search_chunks(
  search_query    text,
  match_user_id   uuid,
  match_count     integer DEFAULT 20,
  metadata_filter jsonb   DEFAULT NULL,
  p_folder_ids    uuid[]  DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, chunk_index integer, rank float)
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
    dc.chunk_index,
    ts_rank_cd(dc.search_vector, tsq)::float AS rank
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND dc.search_vector @@ tsq
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;
