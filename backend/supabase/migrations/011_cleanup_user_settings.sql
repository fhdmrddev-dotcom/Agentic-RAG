-- Migration 011: Clean up user_settings table
-- Remove all app-configuration columns (now in app_settings table).
-- user_settings is reserved for user-specific UI preferences only (theme, language, etc.)
-- Nothing in this table should overlap with .env config.

ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS embedding_model,
  DROP COLUMN IF EXISTS llm_providers,
  DROP COLUMN IF EXISTS embedding_base_url,
  DROP COLUMN IF EXISTS embedding_api_key,
  DROP COLUMN IF EXISTS embedding_dimensions,
  DROP COLUMN IF EXISTS rerank_enabled,
  DROP COLUMN IF EXISTS rerank_provider,
  DROP COLUMN IF EXISTS rerank_api_key,
  DROP COLUMN IF EXISTS rerank_model,
  DROP COLUMN IF EXISTS rerank_top_n,
  DROP COLUMN IF EXISTS retrieval_top_k,
  DROP COLUMN IF EXISTS retrieval_match_threshold,
  DROP COLUMN IF EXISTS hybrid_search_enabled,
  DROP COLUMN IF EXISTS hybrid_candidate_count,
  DROP COLUMN IF EXISTS vector_search_weight,
  DROP COLUMN IF EXISTS keyword_search_weight,
  DROP COLUMN IF EXISTS rrf_k;

-- user_settings now has only: user_id, created_at, updated_at
-- Add a generic preferences JSONB column for future user-specific UI preferences
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb;
