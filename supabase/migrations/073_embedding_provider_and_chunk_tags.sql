-- Phase 111.1: configurable / multi-provider embeddings — app_settings provider/bucket cols,
--   per-chunk embedding-model tags + backfill, match_document_chunks model filter (D-10),
--   resize_embedding_column re-declared as the source of truth (D-04/EMBED-05).
-- Apply via Supabase SQL editor OR psycopg2-direct to :54322 — NEVER db push/db reset (Plan 04 [BLOCKING]).
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE FUNCTION. Re-runnable.

-- 1. app_settings columns (D-06 provider, D-09 #1 extraction provider, D-12 confidence buckets).
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS embedding_provider       text DEFAULT NULL,             -- D-06
  ADD COLUMN IF NOT EXISTS extraction_provider      text DEFAULT NULL,             -- D-09 #1
  ADD COLUMN IF NOT EXISTS confidence_bucket_high   double precision DEFAULT 0.54, -- D-12
  ADD COLUMN IF NOT EXISTS confidence_bucket_medium double precision DEFAULT 0.38; -- D-12

-- 2. document_chunks per-chunk embedding tags (D-10).
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS embedding_model      text,     -- D-10 per-chunk model tag
  ADD COLUMN IF NOT EXISTS embedding_dimensions integer;  -- D-10 per-chunk dims tag

-- 3. Backfill existing rows with the shipped default (D-10 / D-08 back-compat).
--    Existing vectors ARE text-embedding-3-small/1536, so this tag is truthful.
UPDATE public.document_chunks
   SET embedding_model = 'text-embedding-3-small', embedding_dimensions = 1536
 WHERE embedding_model IS NULL;

-- 4. match_document_chunks (D-10): add a trailing p_embedding_model param + ONE WHERE clause.
--    Body copied byte-for-byte from full-schema.sql:120-137; the new param is LAST + defaulted
--    so existing callers stay compatible. KEEP dc.user_id = match_user_id (RLS, V4).
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding public.vector,
  match_user_id uuid,
  match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.3,
  metadata_filter jsonb DEFAULT NULL::jsonb,
  p_folder_ids uuid[] DEFAULT NULL::uuid[],
  p_embedding_model text DEFAULT NULL
) RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id          -- RLS scope (V4 — keep)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)  -- D-10 stale-model filter
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. resize_embedding_column (EMBED-05): re-declared verbatim from full-schema.sql:173-191
--    so the migration is the source of truth (no-op on apply where it already exists).
--    USING NULL NULLs out existing vectors — only call on a true dims change; the re-embed
--    job (Plan 05) then re-embeds all chunks.
CREATE OR REPLACE FUNCTION public.resize_embedding_column(new_dim integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
