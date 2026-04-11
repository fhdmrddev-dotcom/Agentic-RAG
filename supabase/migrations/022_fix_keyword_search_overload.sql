-- Migration 022: Drop the old 4-parameter overload of keyword_search_chunks
-- Migration 008 created it without p_folder_ids; migration 020 added p_folder_ids
-- via CREATE OR REPLACE but with a new signature, which created a second overload.
-- PostgREST (PGRST203) cannot disambiguate two overloads with the same base params.
-- Fix: drop the old overload — the 5-param version (with p_folder_ids DEFAULT NULL)
-- is a strict superset and handles both cases.

DROP FUNCTION IF EXISTS public.keyword_search_chunks(
  text,   -- search_query
  uuid,   -- match_user_id
  integer,-- match_count
  jsonb   -- metadata_filter
);
