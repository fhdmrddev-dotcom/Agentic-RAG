-- 110_secdef_org_scope_audit.sql
-- Phase 164 (TEN-03 / PRAG-01) — the SQL half of the two-halves-that-must-land-together SECDEF audit.
--
-- WHAT THIS DOES:
--   1. Re-CREATEs the four SECURITY DEFINER retrieval/sharing functions (match_document_chunks,
--      keyword_search_chunks, match_skills, folder_is_globally_visible) with (a) an in-body ORG
--      predicate derived server-side from public.current_user_org_ids()/auth.uid() — NEVER from a
--      caller-supplied arg (D-164-01) — and (b) a pinned, minimal search_path (SET search_path = '')
--      with every object schema-qualified + the pgvector distance operator written OPERATOR(public.<=>)
--      so it resolves under the empty path and still matches the HNSW vector_cosine_ops index.
--   2. Widens the document_chunks SELECT RLS (PRAG-01 / D-164-07) additively on the mig-108 owner-only
--      baseline to mirror the documents folder-visibility EXISTS branch (direct-read path only).
--
-- WHY IT IS INERT UNTIL PLAN 04 (the load-bearing coupling — D-164-02):
--   The in-body predicate reflects the CALLER's org ONLY when the RPC runs on a connection where
--   auth.uid() resolves the caller (the Phase-163 asyncpg user-context / user-JWT client). The
--   producer today invokes these RPCs on the service-role connection (auth.uid() = NULL →
--   current_user_org_ids() empty → 0 rows for everyone). That is the DESIGNED fail-closed transient
--   window: Plan 164-04 routes the producer's retrieval calls onto the asyncpg user-context so
--   auth.uid() resolves. Do NOT "fix" a service-role smoke returning 0 rows here — apply this FIRST so
--   Plan 04's swap can be tested against the org-scoped bodies. Over-restrict, never over-share.
--
-- PER-FUNCTION DEFINER-RETENTION JUSTIFICATION (D-164-03 — the "audit" is a recorded rationale, not a
-- flip to INVOKER):
--   * match_document_chunks / keyword_search_chunks — retained DEFINER: they run on the pgvector HNSW /
--     GIN hot path; DEFINER avoids re-evaluating document_chunks RLS per candidate row under the
--     CONCUR-01 <1s gate and keeps the HNSW index plan stable. The in-body org predicate
--     (org_id = ANY(current_user_org_ids()) + the owner/folder-visibility branch) is now the isolation
--     guard; the pinned search_path='' + OPERATOR(public.<=>) closes the DEFINER search-path-hijack
--     class (CVE-2018-1058 — an attacker-controlled search_path shadowing a called object/operator).
--   * match_skills — retained DEFINER: same catalog hot-path / stable-planning rationale; the in-body
--     predicate is the ONLY cross-user gate (a DEFINER body bypasses skills RLS). is_system stays a
--     UNIVERSAL escape OUTSIDE the org gate (mig 109 FIX-A) so the built-in skill-creator is not trapped
--     in the seed org (the 163-UAT Test-7 regression). search_path pinned; pg_temp dropped (a caller
--     could otherwise shadow a called object via temp objects).
--   * folder_is_globally_visible — retained DEFINER: it must read folders it walks regardless of the
--     caller's per-row folder RLS (it is the ancestor-walk primitive the visibility branch composes
--     with). It gets NO org predicate — the org gate lives in the CALLING body/policy that wraps it.
--     Audit = pin search_path='' + schema-qualify public.folders.
--
-- CREATE OR REPLACE (no DROP — Pitfall 6): every signature is byte-identical to the live definition, so
--   a plain CREATE OR REPLACE (adding/altering only the body + the SET search_path clause) applies with
--   no return-type/param change and no cascade to dependent policies.
--
-- NAMING: keys on LIVE column names is_global / is_system / folder_is_globally_visible (163-D-05). The
--   is_org_shared / is_system_global / folder_is_org_shared renames are Phase 165 (MIG-02) — do NOT
--   pre-rename here.
--
-- ── APPLY DISCIPLINE (CLAUDE.md) — 164 COMMAND OVERRIDE (operator-authorized THIS session, D-164-08) ──
--   Applied LOCAL to :54322 by a DIRECT psycopg2 execute of THIS ONE file (OR by pasting it whole into
--   the Supabase SQL editor as ONE execution — pure DDL, BEGIN…COMMIT is fine). The operator granted
--   direct-apply for Phase 164 (CONTEXT <specifics> autonomy directive). NEVER `supabase db push` /
--   `db reset` / `migration up` (destroys/replays dev data — the grant is direct-apply, not reset/push).
--   AFTER applying: run `bash scripts/regenerate-full-schema.sh` (NO --reset — live-DB dump) and commit
--   this migration + the regenerated supabase/full-schema.sql together (D-06). NEVER hand-edit
--   full-schema.sql.
--
-- ── CLOUD PARITY / DEPLOYMENT-ARTIFACT PARITY ───────────────────────────────────────────────────
--   110 joins the pending cloud set (099 → … → 109 → 110) + SECRETS_ENCRYPTION_KEY, applied to
--   production only at the next operator-gated push, in order. Do NOT apply to cloud now. Schema-only
--   (function + policy DDL) — seeds NO reference data, touches NO env var / bundled service / sandbox
--   tag — so it is NOT seed-bearing and owes NO docs/OPERATOR.md or check-deploy-drift.sh change (D-16
--   satisfied by exclusion, as migs 105/106/107/108/109).

BEGIN;

-- ================================================================================================
-- §1 — match_document_chunks (DEFINER; +search_path=''; org gate + within-org folder-visibility)
--   Signature byte-identical to live (mig 073). REPLACE `WHERE dc.user_id = match_user_id` with the
--   org gate + the mig-108 documents-SELECT visibility branch (owner keys on auth.uid(), NOT the
--   caller-supplied match_user_id). match_user_id stays in the signature (backward-compat / index
--   shape) but is NO LONGER the scoping key. Distance operator qualified OPERATOR(public.<=>) so it
--   resolves under search_path='' and still matches the HNSW vector_cosine_ops index.
-- ================================================================================================
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
    SET search_path = ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding OPERATOR(public.<=>) query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())          -- D-164-01 org gate (indexed, mig 107)
    AND (                                                               -- PRAG-01 within-org visibility
      dc.user_id = auth.uid()                                          --   owner (session-derived, NOT match_user_id)
      OR (d.folder_id IS NOT NULL AND public.folder_is_globally_visible(d.folder_id))
    )
    AND 1 - (dc.embedding OPERATOR(public.<=>) query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)  -- D-10 stale-model filter
  ORDER BY dc.embedding OPERATOR(public.<=>) query_embedding
  LIMIT match_count;
END;
$$;

-- ================================================================================================
-- §2 — keyword_search_chunks (DEFINER; +search_path=''; org gate + within-org folder-visibility)
--   Signature byte-identical to live (mig 025): returns (id, document_id, content, chunk_index, rank).
--   @@ / plainto_tsquery / ts_rank_cd live in pg_catalog → resolve fine under search_path='' (no
--   OPERATOR() wrapping needed). Same org-gate replacement as §1.
-- ================================================================================================
CREATE OR REPLACE FUNCTION public.keyword_search_chunks(
  search_query text,
  match_user_id uuid,
  match_count integer DEFAULT 20,
  metadata_filter jsonb DEFAULT NULL::jsonb,
  p_folder_ids uuid[] DEFAULT NULL::uuid[]
) RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, rank double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = ''
    AS $$
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
      OR (d.folder_id IS NOT NULL AND public.folder_is_globally_visible(d.folder_id))
    )
    AND dc.search_vector @@ tsq
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- ================================================================================================
-- §3 — match_skills (DEFINER; search_path public,pg_temp → ''; is_system OUTSIDE the org gate)
--   Signature byte-identical to live (mig 091): (query_embedding, match_user_id, p_embedding_model)
--   → (id, name, description, similarity). Distance operator qualified OPERATOR(public.<=>). REPLACE
--   the WHERE with the mig-109 FIX-A shape: is_system=true is a UNIVERSAL read escape OUTSIDE the org
--   gate (else the built-in skill-creator vanishes cross-org — the 163-UAT Test-7 regression); the
--   owner/is_global branch stays INSIDE the org gate (owner keys on auth.uid(), NOT match_user_id).
-- ================================================================================================
CREATE OR REPLACE FUNCTION public.match_skills(
  query_embedding public.vector,
  match_user_id uuid,
  p_embedding_model text DEFAULT NULL
) RETURNS TABLE(id uuid, name text, description text, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.description,
         CASE WHEN se.embedding IS NULL THEN NULL
              ELSE 1 - (se.embedding OPERATOR(public.<=>) query_embedding) END AS similarity
  FROM public.skills s
  LEFT JOIN public.skill_embeddings se
         ON se.skill_id = s.id
        AND (p_embedding_model IS NULL OR se.embedding_model = p_embedding_model)  -- D-10 stale-model filter
  -- FIX-A (mig 109:70-73): is_system = true is a UNIVERSAL escape OUTSIDE the org gate; the
  -- owner OR user-is_global branch stays INSIDE the org gate (owner keys on auth.uid()).
  WHERE ( (s.is_system = true)
          OR (s.org_id = ANY (SELECT public.current_user_org_ids())
              AND (s.user_id = auth.uid() OR s.is_global = true)) )
    AND s.is_enabled = true
  ORDER BY similarity DESC NULLS LAST, s.name;   -- NULL sim (no vector) = fail-open, ranked last-but-kept
END;
$$;

-- ================================================================================================
-- §4 — folder_is_globally_visible (DEFINER sql STABLE; search_path public → ''; NO org predicate)
--   Pure ancestor-walk primitive — the org gate lives in the CALLING body/policy that wraps it.
--   Audit = pin search_path='' + schema-qualify public.folders (signature/body otherwise unchanged).
-- ================================================================================================
CREATE OR REPLACE FUNCTION public.folder_is_globally_visible(p_folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, is_global
    FROM public.folders
    WHERE id = p_folder_id

    UNION ALL

    SELECT f.id, f.parent_id, f.is_global
    FROM public.folders f
    INNER JOIN ancestors a ON f.id = a.parent_id
  )
  SELECT COALESCE(bool_or(is_global), false) FROM ancestors;
$$;

-- ================================================================================================
-- §5 — document_chunks SELECT RLS widening (PRAG-01 / D-164-07)
--   Additive on the mig-108 owner-only baseline: mirror the documents folder-visibility branch via an
--   EXISTS point-lookup on the parent documents PK. This fires on the DIRECT-read path ONLY (retrieval
--   is DEFINER and never evaluates document_chunks RLS), so it is CONCUR-01-safe. Only the SELECT
--   policy changes; the INSERT/UPDATE/DELETE document_chunks policies are deliberately untouched.
-- ================================================================================================
DROP POLICY IF EXISTS "Users can view their own chunks" ON public.document_chunks;
CREATE POLICY "Users can view their own chunks" ON public.document_chunks FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND ((auth.uid() = user_id)
              OR EXISTS (SELECT 1 FROM public.documents d
                          WHERE d.id = document_chunks.document_id
                            AND d.folder_id IS NOT NULL
                            AND public.folder_is_globally_visible(d.folder_id))));

COMMIT;

-- Closing note: 110 org-scopes the three retrieval DEFINER bodies in-body (D-164-01 — server-derived
-- from current_user_org_ids()/auth.uid(), never the spoofable match_user_id) and pins all four
-- search_paths to '' with OPERATOR(public.<=>) on the pgvector distance (D-164-03 — closes
-- CVE-2018-1058), keeping is_system a UNIVERSAL escape OUTSIDE the org gate in match_skills (mig 109
-- FIX-A) and widening the document_chunks SELECT RLS to mirror the folder-visibility predicate for
-- direct reads (PRAG-01 / D-164-07). All four re-CREATEs are byte-identical-signature CREATE OR REPLACE
-- (no DROP, no cascade). The migration is INERT on the service-role producer connection until Plan
-- 164-04 routes retrieval onto the asyncpg user-context — apply this FIRST. Apply direct via
-- psycopg2/SQL-editor (NEVER db push/reset), then regenerate full-schema no-reset + commit both
-- same-commit. 110 joins the pending cloud set (099→110) — do NOT apply to cloud now.
