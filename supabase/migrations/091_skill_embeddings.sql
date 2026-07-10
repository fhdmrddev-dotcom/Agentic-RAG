-- 091_skill_embeddings.sql
-- Phase 140 Plan 01 (TRIG-02 / STRETCH) — Smart-Dispatch Relevance Pre-Filter schema foundation.
--
-- Creates the persistence + ranking substrate the hot-path skill pre-filter (Plan 04) needs to
-- keep the injected "## Available Skills" catalog within a configurable token budget WITHOUT ever
-- starving a should-fire skill (SC#1/SC#3):
--   * public.skill_embeddings   — one vector per skill (sibling table mirroring documents→
--                                 document_chunks, mig 002). Owner-only RLS; writes are
--                                 service-role (RLS bypassed) and hand-scoped by the backfill job
--                                 (V4). Ships EMPTY — SQL cannot call the embedding API, so the
--                                 Plan 02 job populates it; absence of a row == D-05 fail-open.
--   * public.match_skills       — SECURITY DEFINER cosine RPC (mirrors match_document_chunks,
--                                 mig 073). LEFT JOINs the owner+global enabled skill set to its
--                                 vector and returns a per-skill similarity (NULL when the skill
--                                 has no current-model vector → fail-open, ranked last-but-kept).
--                                 Its WHERE clause is the BYTE-EXACT clone of today's catalog scope
--                                 (agent_loop.py:1207-1208) — the ONLY cross-user access gate for a
--                                 definer function (T-140-01 / Pitfall 3). NEVER widen it.
--   * two mark-stale triggers   — zero-app-code, kind-blind staleness (the Phase 139 CR-01 lesson:
--                                 a DB trigger fires uniformly on ALL write paths; hooking each
--                                 app-code write path drops a stale vector on a missed route).
--                                 stale_skill_embedding (on skills, name/description change) +
--                                 stale_skill_embedding_from_case (on skill_test_cases) delete the
--                                 vector so the Plan 02 job re-embeds it. Mirrors capture_skill_version
--                                 (mig 079): SECURITY DEFINER + search_path pin + IS DISTINCT FROM gate.
--   * app_settings.skill_catalog_max_tokens — the global budget knob (mirrors harness_judge_model,
--                                 mig 086). DEFAULT 1500; 0 = disable (inject-all kill switch, D-04).
--
-- Apply via the Supabase SQL editor (or psycopg2-direct to :54322) — never the destructive local-DB
--   CLI commands that wipe dev data (see CLAUDE.md migration discipline). After applying, regenerate
--   supabase/full-schema.sql via `bash scripts/regenerate-full-schema.sh` (no --reset) and commit BOTH.
--   This file is AUTHORED here (Plan 01); the live-DB apply + regenerated full-schema.sql commit is the
--   [BLOCKING] Plan 05 (autonomous:false) — the DB-CHECK test (test_140_migration_091.py) is RED until then.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS + CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS /
--   CREATE TRIGGER + ADD COLUMN IF NOT EXISTS + DROP POLICY IF EXISTS / CREATE POLICY. Re-runnable.

-- ============================================================
-- (1) skill_embeddings — one vector per skill (mirror document_chunks, mig 002, MINUS the ANN index)
-- ============================================================
-- NO HNSW/IVF index: skills are tens–hundreds of rows; a seq scan over the LEFT JOIN in match_skills
-- is sub-millisecond. (document_chunks needs HNSW because a corpus is 100k+ chunks — 3 orders larger.)
CREATE TABLE IF NOT EXISTS public.skill_embeddings (
    skill_id             uuid PRIMARY KEY REFERENCES public.skills(id) ON DELETE CASCADE,
    user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    embedding            public.vector(1536),           -- matches text-embedding-3-small default (1536 dims)
    embedding_model      text,                          -- D-10 cross-vector-space guard (stale-model filter)
    embedding_dimensions integer,
    source_text_hash     text NOT NULL,                 -- sha256(description + should_fire prompts + name); staleness only
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_embeddings_user_id ON public.skill_embeddings (user_id);

COMMENT ON TABLE public.skill_embeddings IS
  'One embedding row per skill (TRIG-02, Phase 140). Sibling to skills, mirroring documents→'
  'document_chunks (mig 002) but with NO ANN index (skills are tens–hundreds of rows). Ships EMPTY '
  '(SQL cannot call the embedding API) — the skill_embedding_service backfill job (Plan 02) populates '
  'it; absence of a row == D-05 fail-open. Owner-only RLS (defense-in-depth); the service-role backfill '
  'writer bypasses RLS and hand-scopes .eq("user_id", …) (V4). embedding_model is the D-10 stale-model '
  'tag; source_text_hash is a non-crypto staleness fingerprint.';

-- ============================================================
-- (2) RLS — owner-only SELECT (defense-in-depth; service-role writes bypass RLS, hand-scoped by the job)
-- ============================================================
ALTER TABLE public.skill_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own skill embeddings" ON public.skill_embeddings;
CREATE POLICY "Users can view own skill embeddings"
  ON public.skill_embeddings FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view own skill embeddings" ON public.skill_embeddings IS
  'Owner-only SELECT. Defense-in-depth: the backfill writer runs as service-role (bypasses RLS) and '
  'hand-scopes .eq("user_id", …); the match_skills RPC WHERE clause is the real cross-user gate (V4).';

-- ============================================================
-- (3) match_skills — SECURITY DEFINER cosine RPC (mirror match_document_chunks, mig 073)
-- ============================================================
-- LEFT JOIN so a skill with no current-model vector returns similarity NULL → fail-open (D-05), kept
-- LAST via NULLS LAST (never dropped by the RPC). The WHERE clause is the BYTE-EXACT clone of today's
-- catalog scope (agent_loop.py:1207-1208): (s.user_id = match_user_id OR s.is_global = true) AND
-- s.is_enabled = true. A SECURITY DEFINER function bypasses RLS, so this body is the ONLY cross-user
-- access gate (T-140-01 / Pitfall 3) — NEVER widen it. No match_count/match_threshold: the trim happens
-- in Python (Plan 04); the RPC only ranks. text-embedding-3 vectors are L2-normalized, so <=> (cosine)
-- ranks identically to a dot product.
CREATE OR REPLACE FUNCTION public.match_skills(
  query_embedding   public.vector,
  match_user_id     uuid,
  p_embedding_model text DEFAULT NULL       -- D-10 stale-model guard; LAST param, NULL-defaulted (additive)
) RETURNS TABLE(id uuid, name text, description text, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp       -- definer-function hardening (T-140-EL / T-132-05)
    AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.description,
         CASE WHEN se.embedding IS NULL THEN NULL
              ELSE 1 - (se.embedding <=> query_embedding) END AS similarity
  FROM public.skills s
  LEFT JOIN public.skill_embeddings se
         ON se.skill_id = s.id
        AND (p_embedding_model IS NULL OR se.embedding_model = p_embedding_model)  -- D-10 stale-model filter
  WHERE (s.user_id = match_user_id OR s.is_global = true)   -- BYTE-EXACT clone of today's catalog scope (V4)
    AND s.is_enabled = true
  ORDER BY similarity DESC NULLS LAST, s.name;   -- NULL sim (no vector) = fail-open, ranked last-but-kept
END;
$$;

COMMENT ON FUNCTION public.match_skills(public.vector, uuid, text) IS
  'Cosine ranking of the owner+global enabled skill set against a query vector (TRIG-02, Phase 140). '
  'Mirrors match_document_chunks (mig 073). LEFT JOIN → NULL similarity for a skill with no current-model '
  'vector (fail-open keep, NULLS LAST). WHERE clause is the byte-exact clone of agent_loop.py:1207-1208; '
  'as a SECURITY DEFINER body it is the ONLY cross-user gate (T-140-01) — never widen it.';

-- ============================================================
-- (4) stale_skill_embedding — mark-stale on skill CONTENT change (mirror capture_skill_version gate, mig 079)
-- ============================================================
-- Only name/description live in the D-01 embed source on skills (NOT instructions — they are not embedded),
-- so a toggle-only (is_enabled/is_global) or instructions-only UPDATE leaves the vector valid. On a genuine
-- content change, DELETE the row → the Plan 02 job re-embeds it. INSERT needs no trigger (a new skill has no
-- vector yet; absence == fail-open until the job runs).
CREATE OR REPLACE FUNCTION public.stale_skill_embedding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp   -- definer-function hardening (T-140-EL / T-132-05)
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (
       NEW.name        IS DISTINCT FROM OLD.name
    OR NEW.description IS DISTINCT FROM OLD.description
  ) THEN
    RETURN NEW;  -- instructions/toggle-only change → vector stays valid, no invalidation
  END IF;
  DELETE FROM public.skill_embeddings WHERE skill_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stale_skill_embedding ON public.skills;
CREATE TRIGGER stale_skill_embedding
  AFTER UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.stale_skill_embedding();

-- ============================================================
-- (5) stale_skill_embedding_from_case — mark-stale on test-case change (should_fire prompts are D-01 source)
-- ============================================================
-- skill_test_cases.prompt values are part of the D-01 embed source, so ANY insert/update/delete of a case
-- invalidates the owning skill's vector. COALESCE(NEW, OLD) covers the DELETE branch (NEW is NULL).
CREATE OR REPLACE FUNCTION public.stale_skill_embedding_from_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp   -- definer-function hardening (T-140-EL / T-132-05)
AS $$
BEGIN
  DELETE FROM public.skill_embeddings WHERE skill_id = COALESCE(NEW.skill_id, OLD.skill_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS stale_skill_embedding_from_case ON public.skill_test_cases;
CREATE TRIGGER stale_skill_embedding_from_case
  AFTER INSERT OR UPDATE OR DELETE ON public.skill_test_cases
  FOR EACH ROW EXECUTE FUNCTION public.stale_skill_embedding_from_case();

-- ============================================================
-- (6) app_settings.skill_catalog_max_tokens — the global budget knob (mirror harness_judge_model, mig 086)
-- ============================================================
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS skill_catalog_max_tokens integer NOT NULL DEFAULT 1500;  -- 0 = disable (inject-all kill switch, D-04)

-- NOTE: NO SQL backfill here — SQL cannot call the embedding API, so skill_embeddings ships EMPTY; the
--   skill_embedding_service job (Plan 02) populates it. "Absence of a row == stale" degrades cleanly to
--   D-05 fail-open until the job runs. This differs from mig 079's INSERT…SELECT backfill precisely
--   because vectors require a network round-trip that no migration can make.
