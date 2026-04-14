-- Migration 025: Add document versioning columns and update retrieval RPCs
-- Adds version_number and is_latest to documents table.
-- Updates match_document_chunks and keyword_search_chunks to exclude non-latest chunks.
-- Re-uploading a file creates a new version row; old version is_latest is set to false.

-- Add versioning columns to documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_latest boolean NOT NULL DEFAULT true;

-- Partial index for efficient latest-version lookups
CREATE INDEX IF NOT EXISTS documents_latest_idx
  ON public.documents (user_id, filename, is_latest)
  WHERE is_latest = true;

-- Recreate match_document_chunks with is_latest filter
-- Must DROP before recreating — PostgreSQL forbids changing a function if return type changes
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
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- Recreate keyword_search_chunks with is_latest filter
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
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         ts_rank_cd(dc.search_vector, tsq)::float AS rank
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND dc.search_vector @@ tsq
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;
