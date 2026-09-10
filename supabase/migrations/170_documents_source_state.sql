-- 170_documents_source_state.sql
-- Phase 234: The Watch Loop — The Library Reads By Itself (VIS-03 / VIS-04 / VIS-05 / D-4)
--
-- 1. Adds source_state column to public.documents tracking source-side lifecycle state:
--      'live'                    -> verified present at external source
--      'missing_at_source'       -> deleted/moved at source; retained in Library (VIS-03)
--      'unauthorized_at_source'  -> unshared/permission revoked at source (VIS-04)
--      'source_disconnected'     -> parent connection was disconnected/revoked (VIS-05)
--
-- 2. Updates search DEFINER RPCs (match_document_chunks, keyword_search_chunks) to filter
--    out 'source_disconnected' documents while retaining them in Library management view.
--
-- 3. Widens audit_log_action_type_check with watch lifecycle actions:
--    'connector.watch.create', 'connector.watch.delete', 'connector.watch.sync'.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`.
-- ============================================================================

BEGIN;

-- ── 1. Column & Constraint ───────────────────────────────────────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_state text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_source_state_check'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_source_state_check
      CHECK (source_state IS NULL OR source_state IN ('live', 'missing_at_source', 'unauthorized_at_source', 'source_disconnected'));
  END IF;
END $$;

COMMENT ON COLUMN public.documents.source_state IS
  'Phase 234 (VIS-03 / VIS-04 / VIS-05): External source lifecycle state. '
  'live = synced and present · missing_at_source = deleted/moved externally (retained in Library, VIS-03) · '
  'unauthorized_at_source = unshared/revoked (VIS-04) · source_disconnected = connection disconnected (VIS-05). '
  'NULL for manually uploaded documents.';

CREATE INDEX IF NOT EXISTS idx_documents_source_state
  ON public.documents (source_state)
  WHERE source_state IS NOT NULL;

-- ── 2. Search RPCs (Filtered for source_disconnected) ────────────────────────
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector,
  match_user_id uuid,
  match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.3,
  metadata_filter jsonb DEFAULT NULL::jsonb,
  p_folder_ids uuid[] DEFAULT NULL::uuid[],
  p_embedding_model text DEFAULT NULL::text
)
 RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding OPERATOR(public.<=>) query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())          -- D-164-01 org gate (indexed, mig 107)
    AND (                                                               -- PRAG-01 within-org visibility
      dc.user_id = auth.uid()                                          --   owner (session-derived, NOT match_user_id)
      OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
      OR public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility)  -- Phase 231 VIS-01
    )
    AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')  -- Phase 234 VIS-05
    AND 1 - (dc.embedding OPERATOR(public.<=>) query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)  -- D-10 stale-model filter
  ORDER BY dc.embedding OPERATOR(public.<=>) query_embedding
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.keyword_search_chunks(
  search_query text,
  match_user_id uuid,
  match_count integer DEFAULT 20,
  metadata_filter jsonb DEFAULT NULL::jsonb,
  p_folder_ids uuid[] DEFAULT NULL::uuid[]
)
 RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, rank double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  tsq tsquery;
BEGIN
  tsq := plainto_tsquery('english', search_query);
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         ts_rank_cd(dc.search_vector, tsq)::float AS rank
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())          -- D-164-01 org gate (indexed, mig 107)
    AND (                                                               -- PRAG-01 within-org visibility
      dc.user_id = auth.uid()                                          --   owner (session-derived, NOT match_user_id)
      OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
      OR public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility)  -- Phase 231 VIS-01
    )
    AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')  -- Phase 234 VIS-05
    AND dc.search_vector @@ tsq
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY rank DESC
  LIMIT match_count;
END;
$function$;

-- ── 3. Audit Log Actions ─────────────────────────────────────────────────────
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    -- 11 legacy actions
    'document.upload', 'document.delete', 'search.query', 'code.execute', 'skill.load',
    'thread.create', 'thread.delete', 'settings.update', 'memory.remember', 'memory.recall', 'feedback.submit',
    -- 8 DM actions (Phase 110 / Migration 071)
    'view.create', 'view.delete', 'relationship.create', 'relationship.delete',
    'classification.apply', 'classification.rule.create', 'metadata.update', 'metadata.field.create',
    -- 2 Connector actions (Phase 223 / Migration 152)
    'connector.call', 'connector.grant',
    -- 3 Connector watch actions (Phase 234 / LIB-08)
    'connector.watch.create', 'connector.watch.delete', 'connector.watch.sync'
  ]::text[]));

COMMIT;
