-- 079_skill_versions_and_test_cases.sql
-- Phase 132 Plan 01 (VER-01 / EVAL-01) — Skill Eval Studio persistence foundation.
--
-- Creates the two owner-scoped tables that the v3.2 Skill Eval Studio is built on:
--   * public.skill_versions   — per-skill, append-only version history (VER-01). Every content
--                               save of a skill (name/description/instructions) captures an
--                               immutable snapshot via a zero-app-code AFTER INSERT OR UPDATE
--                               trigger on public.skills (D-01 — the single safe-by-construction
--                               capture path covering all 6 verified write paths). This is a NEW
--                               table, DISTINCT from the workflow-scoped skill_snapshots machinery
--                               (D-04) — it does not reuse or extend it.
--   * public.skill_test_cases — the editable eval test-case table (EVAL-01). Cases bind to the
--                               SKILL via skill_id (NOT to a version) so they stay freely
--                               editable/deletable before any run (D-07). Free-text
--                               expected_behavior, NOT an assertion (D-06). NO provider/model
--                               columns (D-08).
--
-- FORWARD-COMPAT (D-10): both tables use stable UUID PKs as FK targets for Phase 133
--   (eval_runs.skill_version_id -> skill_versions.id; results -> skill_test_cases.id). ONLY these
--   two tables are created here — NO eval_runs/result/ratings tables (D-09).
--
-- OWNERSHIP / SERVICE-ROLE / RLS SEMANTICS (077 precedent, D-03-R3 / D-12):
--   The backend writes to public.skills via the SERVICE-ROLE client, which BYPASSES RLS. The
--   capture trigger therefore runs in a context where auth.uid() is NULL — so it sources user_id
--   from NEW.user_id (the authenticated owner of the skill row), NEVER auth.uid() (T-132-03).
--   RLS here is owner-only (NO is_global branch — D-12): version history is the author's private
--   authoring artifact, never visible to consumers of a global skill (T-132-01). The app-code
--   .eq("user_id", …) filter is the real runtime gate; this RLS is defense-in-depth for any
--   future RLS-respecting (anon/authenticated) reader.
--
-- IMMUTABILITY (D-03-R2): a skill_versions row can NOT be UPDATEd (BEFORE UPDATE block trigger,
--   raises 23514 — T-132-02), but it DOES cascade away when its skill is deleted (FK ON DELETE
--   CASCADE — NO BEFORE DELETE block trigger, which would 500 skill deletion).
--
-- Apply via the Supabase SQL editor (NEVER `supabase db push` / `db reset` — they wipe local dev
--   data), then regenerate `supabase/full-schema.sql` with `bash scripts/regenerate-full-schema.sh`
--   (NO --reset). Commit BOTH the migration and the regenerated full-schema.sql per CLAUDE.md.
--   This file is AUTHORED ONLY here; Plan 01 Task 3 (autonomous:false, blocking-human) applies it
--   + commits the regenerated full-schema.sql.

-- ============================================================
-- (1) skill_versions — per-skill append-only version history (D-03 discrete columns)
-- ============================================================
CREATE TABLE public.skill_versions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),               -- stable FK target for Phase 133 (D-10)
    skill_id       uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version_number integer NOT NULL,
    name           text NOT NULL,
    description    text NOT NULL DEFAULT '',
    instructions   text NOT NULL DEFAULT '',
    source         text NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('manual', 'import', 'tuner', 'self_improve', 'backfill')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    -- guards the COALESCE(MAX)+1 race per D-03-R3: a concurrent collision becomes a benign
    -- retryable 23505 rather than a silent lost/duplicate version (T-132-04).
    CONSTRAINT skill_versions_skill_num_unique UNIQUE (skill_id, version_number)
    -- NO updated_at — append-only.
);

CREATE INDEX idx_skill_versions_skill_id ON public.skill_versions (skill_id);
CREATE INDEX idx_skill_versions_user_id  ON public.skill_versions (user_id);

COMMENT ON TABLE public.skill_versions IS
  'Per-skill APPEND-ONLY version history (VER-01, D-01/D-03). One row captured per skill content '
  'save (name/description/instructions) by the AFTER INSERT OR UPDATE trigger on public.skills — '
  'toggles (is_enabled/is_global) capture NO version (D-02). Immutable (BEFORE UPDATE block '
  'trigger, 23514) but cascades on skill delete (D-03-R2). user_id sourced from NEW.user_id, NEVER '
  'auth.uid() (NULL under service-role, T-132-03). RLS is owner-only defense-in-depth (D-12); the '
  'app-code owner filter is the real runtime gate (service-role bypasses RLS). Distinct from the '
  'workflow-scoped skill_snapshots table (D-04). Stable id is the Phase 133 FK target (D-10).';

-- ============================================================
-- (2) skill_test_cases — editable eval test cases bound to the SKILL (D-05 / D-07)
-- ============================================================
CREATE TABLE public.skill_test_cases (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),            -- stable FK target for Phase 133 (D-10)
    skill_id          uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt            text NOT NULL,
    expected_behavior text NOT NULL DEFAULT '',                             -- free text, NOT an assertion (D-06)
    order_index       integer NOT NULL DEFAULT 0,
    name              text,                                                  -- optional label
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
    -- NO provider/model columns (D-08).
);

CREATE INDEX idx_skill_test_cases_skill_id ON public.skill_test_cases (skill_id);
CREATE INDEX idx_skill_test_cases_user_id  ON public.skill_test_cases (user_id);

COMMENT ON TABLE public.skill_test_cases IS
  'Editable eval test cases (EVAL-01, D-05). Bind to the SKILL via skill_id (NOT a version) so '
  'cases stay freely editable/deletable before any run (D-07). expected_behavior is free text, '
  'NOT an assertion (D-06); NO provider/model columns (D-08). Owner-only RLS (D-12). Stable id is '
  'the Phase 133 results FK target (D-10).';

-- ============================================================
-- (3) Version-capture trigger — the single zero-app-code capture path (D-01)
-- ============================================================
CREATE OR REPLACE FUNCTION public.capture_skill_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp   -- definer-function hardening (T-132-05)
AS $$
DECLARE
  next_num integer;
BEGIN
  -- D-02: on UPDATE, capture a version ONLY when the content trifecta changes. A
  -- toggle-only flip (is_enabled / is_global) MUST NOT version.
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

DROP TRIGGER IF EXISTS skills_capture_version ON public.skills;
CREATE TRIGGER skills_capture_version
  AFTER INSERT OR UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.capture_skill_version();

-- ============================================================
-- (4) Append-only enforcement on skill_versions (D-03-R2)
-- BEFORE UPDATE only — NO BEFORE DELETE (DELETE must flow through the FK cascade so deleting a
-- skill removes its versions; a DELETE block would 500 skill deletion).
-- ============================================================
CREATE OR REPLACE FUNCTION public.skill_versions_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'skill_versions row % is append-only and immutable; insert a new version instead',
    OLD.id
    USING ERRCODE = 'check_violation';   -- SQLSTATE 23514, distinguishable in tests
END;
$$;

DROP TRIGGER IF EXISTS skill_versions_no_update ON public.skill_versions;
CREATE TRIGGER skill_versions_no_update
  BEFORE UPDATE ON public.skill_versions
  FOR EACH ROW EXECUTE FUNCTION public.skill_versions_block_mutation();

-- ============================================================
-- (5) skill_test_cases.updated_at — reuse existing set_updated_at() (014_folders.sql), do NOT redefine
-- ============================================================
DROP TRIGGER IF EXISTS skill_test_cases_set_updated_at ON public.skill_test_cases;
CREATE TRIGGER skill_test_cases_set_updated_at
  BEFORE UPDATE ON public.skill_test_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- (6) RLS — owner-only (D-12, NO is_global branch). Defense-in-depth; service-role writes bypass RLS.
-- ============================================================

-- skill_versions: SELECT-only owner policy. NO write policies — the capture trigger writes via
-- service-role (bypasses RLS) and the append-only block trigger is the mutation gate.
ALTER TABLE public.skill_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skill versions"
  ON public.skill_versions FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view own skill versions" ON public.skill_versions IS
  'Owner-only (NO is_global branch, D-12). Defense-in-depth: the service-role writer bypasses RLS '
  'and the app-code .eq("user_id", …) filter is the real runtime gate (077 precedent, D-03-R3).';

-- skill_test_cases: full owner CRUD policies (these rows are authored by the owner directly).
ALTER TABLE public.skill_test_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skill test cases"
  ON public.skill_test_cases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own skill test cases"
  ON public.skill_test_cases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own skill test cases"
  ON public.skill_test_cases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own skill test cases"
  ON public.skill_test_cases FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- (7) v1 backfill (D-11) — LAST. INSERTs directly into skill_versions, so it does NOT fire the
-- skills capture trigger (no double-capture). source = 'backfill'.
-- ============================================================
INSERT INTO public.skill_versions (skill_id, user_id, version_number, name, description, instructions, source)
SELECT id, user_id, 1, name, description, instructions, 'backfill'
  FROM public.skills;
