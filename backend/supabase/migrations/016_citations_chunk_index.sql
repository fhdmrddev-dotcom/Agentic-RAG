-- Migration 016: Add chunk_index to match_document_chunks RPC for Phase 26 citations
-- Must DROP first because RETURNS TABLE shape changed (added chunk_index column)
DROP FUNCTION IF EXISTS match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[]);

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count integer DEFAULT 5,
  match_threshold float DEFAULT 0.3,
  metadata_filter jsonb DEFAULT NULL,
  p_folder_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, similarity float, chunk_index integer)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    dc.chunk_index
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (
      metadata_filter IS NULL
      OR d.metadata @> metadata_filter
    )
    AND (
      p_folder_ids IS NULL
      OR d.folder_id = ANY(p_folder_ids)
    )
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
