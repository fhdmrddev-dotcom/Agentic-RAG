-- Migration 016: Add folder_id scope to threads + update match_document_chunks RPC

-- Add folder_id column to threads (ON DELETE SET NULL: thread survives folder deletion)
ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS threads_folder_id_idx ON public.threads(folder_id);

-- Update match_document_chunks to accept optional folder_ids array
-- Using Python-side subtree resolution, so RPC takes uuid[] not single uuid
DROP FUNCTION IF EXISTS public.match_document_chunks(vector, uuid, integer, float, jsonb);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector,
  match_user_id   uuid,
  match_count     integer DEFAULT 5,
  match_threshold float   DEFAULT 0.3,
  metadata_filter jsonb   DEFAULT NULL,
  p_folder_ids    uuid[]  DEFAULT NULL
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
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
