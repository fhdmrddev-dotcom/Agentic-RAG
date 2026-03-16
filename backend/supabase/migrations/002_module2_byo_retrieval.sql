-- Migration 002: Module 2 - BYO Retrieval
-- Run in Supabase SQL editor

-- Remove Responses API column
ALTER TABLE public.threads DROP COLUMN IF EXISTS openai_thread_id;

-- Documents table (file metadata)
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  chunk_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- document_chunks table (embedded text segments)
CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_index integer NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- HNSW index for cosine similarity search
CREATE INDEX document_chunks_embedding_idx ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- RLS on document_chunks
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chunks"
  ON public.document_chunks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chunks"
  ON public.document_chunks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chunks"
  ON public.document_chunks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chunks"
  ON public.document_chunks FOR DELETE
  USING (auth.uid() = user_id);

-- RPC function for pgvector cosine similarity search
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count integer DEFAULT 5,
  match_threshold float DEFAULT 0.3
)
RETURNS TABLE (id uuid, document_id uuid, content text, similarity float)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content,
         1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  WHERE dc.user_id = match_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Enable Realtime for documents table
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
