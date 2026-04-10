-- Migration 020: Add folder scope filtering to keyword_search_chunks RPC
-- Mirrors the folder_ids support added to match_document_chunks in migration 016.

CREATE OR REPLACE FUNCTION public.keyword_search_chunks(
  search_query    text,
  match_user_id   uuid,
  match_count     integer DEFAULT 20,
  metadata_filter jsonb   DEFAULT NULL,
  p_folder_ids    uuid[]  DEFAULT NULL
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
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;
