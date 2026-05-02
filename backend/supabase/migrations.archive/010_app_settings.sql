-- Migration 010: Global app_settings table
-- Replaces per-user user_settings with a single global row shared by all users.
-- All columns are nullable — NULL means "use .env default" at runtime.

CREATE TABLE IF NOT EXISTS public.app_settings (
    id              text PRIMARY KEY DEFAULT 'global',
    -- LLM providers (array of provider objects)
    llm_providers           jsonb    DEFAULT '[]'::jsonb,
    -- Embedding
    embedding_model         text,
    embedding_base_url      text,
    embedding_api_key       text,
    embedding_dimensions    integer,
    -- Reranking
    rerank_enabled          boolean,
    rerank_provider         text,
    rerank_api_key          text,
    rerank_model            text,
    rerank_top_n            integer,
    -- Retrieval
    retrieval_top_k         integer,
    retrieval_match_threshold float,
    hybrid_search_enabled   boolean,
    hybrid_candidate_count  integer,
    vector_search_weight    float,
    keyword_search_weight   float,
    rrf_k                   integer,

    updated_at              timestamptz DEFAULT now()
);

-- Seed the single global row
INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;
