-- Migration 036: Drop the 5-arg match_document_chunks overload
--
-- Background: migration 023 (rpc_chunk_index) created the canonical
-- 6-arg variant `match_document_chunks(vector, uuid, integer, float, jsonb, uuid[])`
-- which returns `chunk_index` and supports folder scoping. Migration 034
-- (dynamic_vector_match) later created a 5-arg variant without `p_folder_ids`
-- and without `chunk_index` in the return, intended to be dimension-agnostic.
-- Both variants now exist, and PostgREST cannot disambiguate when callers
-- pass `metadata_filter` but omit `p_folder_ids` (the 6-arg's default-NULL
-- collapses the signature, but the 5-arg looks equally valid):
--   PGRST203: Could not choose the best candidate function between [...]
--
-- The 6-arg variant is a strict superset: `p_folder_ids DEFAULT NULL` makes
-- folder scoping optional, and the extra `chunk_index` column in the return
-- is consumed by the new chunk-index callers but harmless to legacy callers
-- that ignore unknown columns. Dropping the 5-arg variant resolves the
-- ambiguity without changing any working code path.

DROP FUNCTION IF EXISTS public.match_document_chunks(
  vector,    -- query_embedding
  uuid,      -- match_user_id
  integer,   -- match_count
  float,     -- match_threshold
  jsonb      -- metadata_filter
);
