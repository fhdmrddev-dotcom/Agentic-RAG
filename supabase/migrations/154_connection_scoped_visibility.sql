-- 154_connection_scoped_visibility.sql
-- Phase 231: Connection-Scoped Visibility (VIS-01 / TRUST-04 / D-5)
--
-- Until this migration, EVERY document in the corpus was deliberately placed by a person who
-- could already read it. That is the entire reason ownership-based RLS was sound. A watched
-- connection breaks it: documents arrive that nobody chose to upload. This is where the
-- milestone stops being a feature and becomes a permission model.
--
-- ⚠⚠ H-1 — THE ORDER OF WIDENING IS THE WHOLE RISK, and it is why this is ONE transaction:
--     the two RLS policies widen FIRST, the two SECURITY DEFINER bodies LAST.
--     The dangerous direction (DEFINER first) makes the agent cite chunks the Library refuses
--     to show. The safe direction is merely annoying — the Library lists a row retrieval will
--     not yet quote. Both are transient inside BEGIN/COMMIT; the ORDER still matters, because
--     a failure part-way must leave the annoying state, never the leaking one.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`.
-- ============================================================================

BEGIN;

-- ── 1. The two net-new columns ──────────────────────────────────────────────
-- No backfill and none needed: every existing row has source_connection_id NULL,
-- which the predicate below reads as "this predicate has nothing to say about me",
-- leaving today's owner-or-shared-folder behaviour byte-identical for all 77 rows.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_connection_id uuid
    REFERENCES public.connector_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ingest_visibility text NOT NULL DEFAULT 'private';

-- Enum-shaped, never a boolean (069-A's extensible-audience contract, applied inbound).
-- A boolean here is what makes adding a third scope later a re-ingest instead of a migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_ingest_visibility_check'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_ingest_visibility_check
      CHECK (ingest_visibility IN ('private', 'org', 'dept'));
  END IF;
END $$;

COMMENT ON COLUMN public.documents.source_connection_id IS
  'Phase 231 (TRUST-04): the connection that PLACED this document, or NULL when a person '
  'uploaded it. Carried into citations so machine-placed knowledge is distinguishable from '
  'knowledge somebody chose to upload. ON DELETE SET NULL — deleting a connection must never '
  'delete knowledge (D-4 freezes, it does not purge).';

COMMENT ON COLUMN public.documents.ingest_visibility IS
  'Phase 231 (VIS-01): who can read a document this connection brought in. Enum-shaped, never '
  'a boolean. private = owner only · org = anyone in the org · dept = INERT (D-5, see '
  'connection_doc_is_visible). Meaningless when source_connection_id IS NULL.';

CREATE INDEX IF NOT EXISTS idx_documents_source_connection
  ON public.documents (source_connection_id)
  WHERE source_connection_id IS NOT NULL;

-- ── 2. ONE swappable resolver — the four sites must never re-derive this ────
-- 069-A's contract: audience resolution sits behind a single function. This is what makes the
-- four-site lockstep STRUCTURAL rather than a copy-paste discipline nobody can audit.
--
-- ⚠ It FAILS CLOSED by construction: NULL connection → false, unrecognised value → false.
--   An unrecognised state is not a pass (the findIndex → -1 fail-open lesson).
-- ⚠ It does NOT re-check org membership. Every call site already gates on
--   current_user_org_ids(); duplicating that here would create a second place to get it wrong.

CREATE OR REPLACE FUNCTION public.connection_doc_is_visible(
  p_source_connection_id uuid,
  p_ingest_visibility    text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    -- Not from a connection: this predicate has nothing to say. The owner arm still applies.
    WHEN p_source_connection_id IS NULL THEN false

    -- Everyone in the org. The caller's org gate has already run.
    WHEN p_ingest_visibility = 'org' THEN true

    -- D-5 — THE INERT DEPARTMENT BRANCH.
    -- Decided by the operator 2026-09-05: present but inert. It is written now because a second
    -- scope added AFTER this predicate is set is a re-ingest, not a migration.
    --
    -- ⭐ It is DERIVED, not hard-coded true: while no department membership exists there is no
    --    narrower answer to give, so it reads org-wide — which is exactly today's behaviour.
    --    The moment departments become real, this branch STOPS granting org-wide on its own and
    --    must be replaced with a real membership check. That is deliberate: the inert branch
    --    fails CLOSED on activation rather than silently over-sharing the day someone adds a
    --    department. No UI offers this value, so no row carries it today.
    WHEN p_ingest_visibility = 'dept' THEN NOT EXISTS (SELECT 1 FROM public.dept_members)

    -- 'private', and anything unrecognised.
    ELSE false
  END;
$function$;

COMMENT ON FUNCTION public.connection_doc_is_visible(uuid, text) IS
  'Phase 231 (VIS-01): the ONE connection-scoped visibility predicate. All four enforcement '
  'sites call it; none re-derives it. Fails closed on NULL and on any unrecognised value. Does '
  'NOT re-check org membership — every caller already gates on current_user_org_ids().';

-- ── 3. SITES 1 & 2 — the RLS POLICIES, widened FIRST (H-1) ─────────────────

DROP POLICY IF EXISTS "Users can view own or global-folder documents" ON public.documents;
CREATE POLICY "Users can view own or global-folder documents" ON public.documents
  FOR SELECT TO authenticated
  USING (
    (org_id IN (SELECT public.current_user_org_ids()))
    AND (
      (auth.uid() = user_id)
      OR ((folder_id IS NOT NULL) AND public.folder_is_org_shared(folder_id))
      OR public.connection_doc_is_visible(source_connection_id, ingest_visibility)
    )
  );

DROP POLICY IF EXISTS "Users can view their own chunks" ON public.document_chunks;
CREATE POLICY "Users can view their own chunks" ON public.document_chunks
  FOR SELECT TO authenticated
  USING (
    (org_id IN (SELECT public.current_user_org_ids()))
    AND (
      (auth.uid() = user_id)
      OR (EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = document_chunks.document_id
              AND (
                ((d.folder_id IS NOT NULL) AND public.folder_is_org_shared(d.folder_id))
                OR public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility)
              )
         ))
    )
  );

-- ── 4. SITES 3 & 4 — the SECURITY DEFINER bodies, widened LAST (H-1) ───────
-- These bypass RLS, so they are the sites that can make the agent quote what the Library hides.
-- They go last, and they add the SAME third arm — never a re-derived one.
--
-- ⚠ Both bodies below are the VERBATIM shipped definitions (dumped from pg_get_functiondef)
--   with exactly ONE line added. Everything else — plpgsql, the return-type column list, the
--   0.3 threshold default, plainto_tsquery/ts_rank_cd, the D-10 stale-model filter, the comment
--   text — is preserved byte-for-byte. A reconstruction from memory got FIVE of those wrong.

CREATE OR REPLACE FUNCTION public.match_document_chunks(query_embedding vector, match_user_id uuid, match_count integer DEFAULT 5, match_threshold double precision DEFAULT 0.3, metadata_filter jsonb DEFAULT NULL::jsonb, p_folder_ids uuid[] DEFAULT NULL::uuid[], p_embedding_model text DEFAULT NULL::text)
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
    AND 1 - (dc.embedding OPERATOR(public.<=>) query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)  -- D-10 stale-model filter
  ORDER BY dc.embedding OPERATOR(public.<=>) query_embedding
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.keyword_search_chunks(search_query text, match_user_id uuid, match_count integer DEFAULT 20, metadata_filter jsonb DEFAULT NULL::jsonb, p_folder_ids uuid[] DEFAULT NULL::uuid[])
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
    AND dc.search_vector @@ tsq
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY rank DESC
  LIMIT match_count;
END;
$function$;

COMMIT;
