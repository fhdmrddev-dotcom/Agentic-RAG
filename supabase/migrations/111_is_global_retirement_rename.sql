-- 111_is_global_retirement_rename.sql
-- Phase 165 (MIG-02) — retire the legacy pre-org global boolean via the D-165-01 SEMANTIC SPLIT.
--
-- WHAT THIS DOES:
--   Value-preservingly renames the six legacy global-flag columns to their correct post-org names —
--   a semantic split, NOT a uniform rename:
--     * folders / skills                    → is_org_shared     (a genuine user org-share toggle)
--     * workflow_definitions / document_views / classification_rules / metadata_field_definitions
--                                           → is_system_global  (only ever platform-seed content)
--   plus the DEFINER visibility fn rename folder_is_globally_visible → folder_is_org_shared, the two
--   trigger fns that name the old column, and the Storage skill-files read policy. This file is the
--   SOURCE OF TRUTH for the whole phase — the backend/frontend/test renames (plans 02–09) mirror the
--   column names established here.
--
-- WHY THE SPLIT (not uniform is_org_shared) — D-165-01:
--   On the four write-locked tables the mig-108/109 INSERT/UPDATE write checks hard-set the flag = false
--   for authenticated writers, so a true value there is ONLY EVER seed/service-role platform content that
--   mig 109 lifts OUT of the org gate (universal). Renaming those to the org-scoped is_org_shared would
--   regress the 15 seeded workflows to the seed org (the exact mig-109 Test-7 bug). is_system_global keeps
--   them cross-org-universal BY CONSTRUCTION with zero data movement. folders/skills are genuine
--   user-owned org-share toggles → is_org_shared. (Operator-ratified deviation from 160-ADR §2, which
--   assumed a uniform rename before mig-109's 15 universal workflows existed.)
--   skills.is_system is NOT renamed (D-165-02) — it is the load-bearing skills universal allow-list
--   (load_skill tie-break / mig-109 badge-spoof WITH-CHECK / mig-087 seeding). is_system_global appears
--   as a column name ONLY on the four write-locked tables.
--
-- AUTO-PROPAGATION FACT (why this migration is short + transcription-risk-free):
--   PostgreSQL ALTER TABLE … RENAME COLUMN stores column references in RLS USING/WITH-CHECK clauses,
--   CHECK constraints, and indexes as parsed node-trees keyed on attribute-number, so a rename
--   AUTO-PROPAGATES to every mig-108/109 SELECT + INSERT/UPDATE-WITH-CHECK policy, the mfd_reachable
--   CHECK, and all indexes with the correct NEW per-table name. Do NOT hand-re-create those policies —
--   hand-transcription is the over-widening vector (T-165-01, the high-severity cross-org-leak threat).
--   Auto-propagation preserves mig-109 semantics VERBATIM. What does NOT auto-propagate: FUNCTION bodies
--   (pg_proc.prosrc is TEXT, parsed at runtime) — the DEFINER + trigger fns naming the old column are
--   explicitly CREATE OR REPLACE'd (§2), and the storage-policy reconciliation is a real semantic change
--   requiring explicit DROP + CREATE (§3).
--
-- DEV-SERVER NOTE (W1): plans 02–09 commit code that reads the RENAMED columns BEFORE this migration is
--   applied (Wave 2, plan 165-10). A running uvicorn/vite dev server would 500 on folder/skill/view/
--   workflow endpoints in the window between the Wave-1 commits and the apply. Operator STOPS any running
--   backend/frontend dev server before Wave 1 and restarts only AFTER plan 165-10 applies + regenerates.
--
-- ── APPLY DISCIPLINE (CLAUDE.md) — AUTHORED HERE, OPERATOR-APPLIED ──────────────────────────────
--   NOT applied in this plan. Applied LOCAL by the OPERATOR pasting this whole file into the Supabase
--   SQL editor @ :54322 as ONE execution (pure DDL, BEGIN…COMMIT is fine) at the [BLOCKING] Wave-2 gate
--   (plan 165-10) — AFTER 110. NEVER `supabase db push` / `db reset` (preserves dev data). AFTER
--   applying: run `bash scripts/regenerate-full-schema.sh` (NO --reset — live-DB dump) and commit this
--   migration + the regenerated supabase/full-schema.sql together (D-165-06). NEVER hand-edit
--   full-schema.sql. Re-paste-safe: every statement is RENAME / CREATE OR REPLACE / DROP-IF-EXISTS+CREATE.
--
-- ── CLOUD PARITY / DEPLOYMENT-ARTIFACT PARITY ───────────────────────────────────────────────────
--   111 joins the pending cloud set (099 → … → 110 → 111) + SECRETS_ENCRYPTION_KEY, applied to
--   production only at the next operator-gated push, in order. Do NOT apply to cloud now. Schema-only
--   value-preserving rename — seeds NO reference data, touches NO env var / bundled service / sandbox
--   tag — so it is NOT seed-bearing and owes NO docs/OPERATOR.md or check-deploy-drift.sh change (D-16
--   satisfied by exclusion, as migs 105/106/107/108/109/110).

BEGIN;

-- ================================================================================================
-- §1 — Column renames (6 value-preserving ALTER TABLE … RENAME COLUMN — the D-165-01 semantic split)
--   RENAME COLUMN is value-preserving (never drop+add): live row values + NOT NULL + DEFAULT + the
--   per-table universal-branch (=true) and write-lock (=false) RLS predicates all carry across unchanged
--   via attribute-number node-trees (see AUTO-PROPAGATION FACT). Do NOT hand-re-create the mig-108/109
--   SELECT + WITH-CHECK policies, the mfd_reachable CHECK, or the indexes — the rename carries the NEW
--   per-table name into each of them automatically (T-165-01: hand-transcription would over-widen).
--   skills.is_system is deliberately NOT touched (D-165-02 — the skills universal allow-list).
-- ================================================================================================
ALTER TABLE public.folders                    RENAME COLUMN is_global TO is_org_shared;
ALTER TABLE public.skills                     RENAME COLUMN is_global TO is_org_shared;
ALTER TABLE public.workflow_definitions       RENAME COLUMN is_global TO is_system_global;
ALTER TABLE public.document_views             RENAME COLUMN is_global TO is_system_global;
ALTER TABLE public.classification_rules       RENAME COLUMN is_global TO is_system_global;
ALTER TABLE public.metadata_field_definitions RENAME COLUMN is_global TO is_system_global;

-- ================================================================================================
-- §2 — Function / trigger bodies (TEXT — do NOT auto-follow the rename)
--   pg_proc.prosrc is TEXT parsed at runtime, so it does NOT follow RENAME COLUMN. The four DEFINER
--   retrieval/visibility fns + the two trigger fns naming the old column are explicitly CREATE OR
--   REPLACE'd here, and folder_is_globally_visible is OID-preservingly ALTER FUNCTION … RENAME'd (so its
--   dependent documents/folders/document_chunks SELECT policies — which reference it by OID in their
--   node-trees — auto-follow to the new name; NO policy re-create needed). Ordering is load-bearing:
--   (a) fix the folder fn body → (b) rename the folder fn → (c)/(d) rewrite its text-bodied callers to
--   the new name → (e)/(f)/(g) the remaining bodies. Every DEFINER fn copies the mig-110 SECURITY DEFINER
--   + SET search_path (='' for the audit-pinned four; ='public','pg_temp' for capture_skill_version as
--   it stands today) + OPERATOR(public.<=>) + schema-qualified objects VERBATIM — the search-path safety
--   (CVE-2018-1058) is NOT weakened by this rename (T-165-04).
--   Catch-all (Task 2g): a grep of the migrations + full-schema for trigger/function bodies naming the old
--   column found ONLY (f) workflow_definitions_block_published_update (a real column ref) and
--   (g) capture_skill_version (a comment-only ref, the toggle-flip guard) — no additional trigger fns.
--   (The COMMENT ON TABLE public.skill_versions doc-string also names the old flag but is a table comment,
--   not a function body — out of this migration's DDL scope; regenerated full-schema will reflect the rest.)
-- ================================================================================================

-- (a) folder_is_globally_visible — fix the body against the renamed folders column FIRST (OID kept). ---
--     Copies the mig-110 §4 body verbatim; only the three folder-column tokens become is_org_shared.
CREATE OR REPLACE FUNCTION public.folder_is_globally_visible(p_folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, is_org_shared
    FROM public.folders
    WHERE id = p_folder_id

    UNION ALL

    SELECT f.id, f.parent_id, f.is_org_shared
    FROM public.folders f
    INNER JOIN ancestors a ON f.id = a.parent_id
  )
  SELECT COALESCE(bool_or(is_org_shared), false) FROM ancestors;
$$;

-- (b) OID-preserving rename → folder_is_org_shared. The documents/folders/document_chunks SELECT policies
--     reference this fn by OID in their node-trees, so they auto-follow; do NOT re-create those policies.
ALTER FUNCTION public.folder_is_globally_visible(uuid) RENAME TO folder_is_org_shared;

-- (c) match_document_chunks — mig-110 §1 verbatim; ONLY the visibility call is renamed to the new fn. ---
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
      OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
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

-- (d) keyword_search_chunks — mig-110 §2 verbatim; ONLY the visibility call is renamed to the new fn. ---
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
      OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
    )
    AND dc.search_vector @@ tsq
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- (e) match_skills — mig-110 §3 verbatim; is_system stays the UNIVERSAL escape (D-165-02), the org-gated
--     owner branch's user toggle becomes is_org_shared. FIX-A shape (is_system OUTSIDE the org gate) kept.
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
  -- FIX-A (mig 109): is_system = true is a UNIVERSAL escape OUTSIDE the org gate; the
  -- owner OR user-is_org_shared branch stays INSIDE the org gate (owner keys on auth.uid()).
  WHERE ( (s.is_system = true)
          OR (s.org_id = ANY (SELECT public.current_user_org_ids())
              AND (s.user_id = auth.uid() OR s.is_org_shared = true)) )
    AND s.is_enabled = true
  ORDER BY similarity DESC NULLS LAST, s.name;   -- NULL sim (no vector) = fail-open, ranked last-but-kept
END;
$$;

-- (f) workflow_definitions_block_published_update — trigger fn (INVOKER, no search_path) verbatim from
--     full-schema; the published-immutability guard column becomes is_system_global (write-locked table).
CREATE OR REPLACE FUNCTION public.workflow_definitions_block_published_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status = 'published' AND (
        NEW.slug             IS DISTINCT FROM OLD.slug
     OR NEW.version          IS DISTINCT FROM OLD.version
     OR NEW.name             IS DISTINCT FROM OLD.name
     OR NEW.description       IS DISTINCT FROM OLD.description
     OR NEW.status           IS DISTINCT FROM OLD.status
     OR NEW.definition       IS DISTINCT FROM OLD.definition
     OR NEW.created_by       IS DISTINCT FROM OLD.created_by
     OR NEW.is_system_global IS DISTINCT FROM OLD.is_system_global
     OR NEW.org_id           IS DISTINCT FROM OLD.org_id
  ) THEN
    RAISE EXCEPTION
      'workflow_definitions row % is published and immutable; create a new version instead',
      OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- (g) capture_skill_version — trigger fn (DEFINER, search_path 'public','pg_temp' — preserved verbatim);
--     body is byte-identical to full-schema, ONLY the toggle-flip comment names the renamed skills column.
CREATE OR REPLACE FUNCTION public.capture_skill_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  next_num integer;
BEGIN
  -- D-02: on UPDATE, capture a version ONLY when the content trifecta changes. A
  -- toggle-only flip (is_enabled / is_org_shared) MUST NOT version.
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
         NEW.name         IS DISTINCT FROM OLD.name
      OR NEW.description  IS DISTINCT FROM OLD.description
      OR NEW.instructions IS DISTINCT FROM OLD.instructions
    ) THEN
      RETURN NEW;  -- toggle-only / no content change → no version
    END IF;
  END IF;

  -- COALESCE(MAX)+1 per skill; the UNIQUE(skill_id, version_number) constraint turns any
  -- concurrent collision into a benign retryable 23505 (D-03-R3 / T-132-04).
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_num
    FROM public.skill_versions
   WHERE skill_id = NEW.id;

  INSERT INTO public.skill_versions
    (skill_id, user_id, version_number, name, description, instructions, source)
  VALUES
    (NEW.id, NEW.user_id, next_num, NEW.name, NEW.description, NEW.instructions, 'manual');
    -- user_id = NEW.user_id (NOT auth.uid() — NULL under service-role, D-03-R3 / T-132-03).
    -- source 'manual': the trigger cannot distinguish write paths (D-03-R1); the 5-value enum
    -- stays for forward-compat (import/tuner/self_improve/backfill set by other paths).

  RETURN NEW;
END;
$$;

-- Closing §2 note: the RLS SELECT/WITH-CHECK policies + the mfd_reachable CHECK + all indexes are
-- intentionally NOT re-created in this migration — RENAME COLUMN (§1) auto-propagated them verbatim, and
-- the folder-fn dependents auto-follow the OID-preserving ALTER FUNCTION RENAME (b). Every DEFINER
-- search_path pin + OPERATOR(public.<=>) + is_system universal escape is preserved exactly as mig-110/109.
-- ================================================================================================

-- ================================================================================================
-- §3 — Storage skill-files read-policy reconciliation (semantic change — explicit DROP + CREATE)
--   Unlike table RLS, storage.objects policies are NOT affected by a public.skills column rename, and the
--   FIX-A universal escape (is_system) was never in this bucket policy — it currently keys ONLY on the
--   old org-gated branch. Reconcile it to the mig-109 skill_files table-RLS shape: the is_system branch
--   keeps the built-in skill-creator's files cross-org readable (mirrors the mig-109 skill_files universal
--   escape); the is_org_shared branch value-preservingly carries the renamed original global branch. The
--   owner-folder read + the INSERT/DELETE storage policies (owner-only, no old-flag reference) are untouched.
-- ================================================================================================
DROP POLICY IF EXISTS "Users can read own skill files" ON storage.objects;
CREATE POLICY "Users can read own skill files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'skill-files'
    AND (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.skill_files sf
        JOIN public.skills s ON s.id = sf.skill_id
        WHERE sf.file_path = name AND (s.is_system = true OR s.is_org_shared = true)
      )
    )
  );

COMMIT;

-- Closing note: 111 value-preservingly renames the six legacy global columns per the D-165-01 split
-- (folders/skills → is_org_shared; workflow_definitions/document_views/classification_rules/
-- metadata_field_definitions → is_system_global), leaving skills.is_system untouched (D-165-02). The
-- mig-108/109 SELECT + WITH-CHECK policies, the mfd_reachable CHECK, and the indexes are intentionally
-- NOT re-created here — RENAME COLUMN auto-propagated them verbatim (T-165-01 over-widening avoided).
-- §2 (Task 2) rewrites the DEFINER + trigger fn bodies (TEXT — do not auto-follow) and renames
-- folder_is_globally_visible → folder_is_org_shared OID-preservingly. §3 reconciles the storage
-- skill-files read policy onto the mig-109 is_system-universal + is_org_shared shape. One BEGIN/COMMIT
-- atomic, re-paste-safe. Apply AFTER 110 at the Wave-2 [BLOCKING] gate (plan 165-10); then regenerate
-- full-schema no-reset + commit both same-commit. 111 joins the pending cloud set (099→111) — not now.
