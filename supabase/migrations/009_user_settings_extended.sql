-- Module 6.1: Extend user_settings with LLM providers, embedding, reranking, retrieval config
-- All new columns are nullable — NULL means "use env default"

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS llm_providers          jsonb    DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS embedding_base_url     text,
  ADD COLUMN IF NOT EXISTS embedding_api_key      text,
  ADD COLUMN IF NOT EXISTS embedding_dimensions   integer,
  ADD COLUMN IF NOT EXISTS rerank_enabled         boolean,
  ADD COLUMN IF NOT EXISTS rerank_provider        text,
  ADD COLUMN IF NOT EXISTS rerank_api_key         text,
  ADD COLUMN IF NOT EXISTS rerank_model           text,
  ADD COLUMN IF NOT EXISTS rerank_top_n           integer,
  ADD COLUMN IF NOT EXISTS retrieval_top_k        integer,
  ADD COLUMN IF NOT EXISTS retrieval_match_threshold float,
  ADD COLUMN IF NOT EXISTS hybrid_search_enabled  boolean,
  ADD COLUMN IF NOT EXISTS hybrid_candidate_count integer,
  ADD COLUMN IF NOT EXISTS vector_search_weight   float,
  ADD COLUMN IF NOT EXISTS keyword_search_weight  float,
  ADD COLUMN IF NOT EXISTS rrf_k                  integer;
