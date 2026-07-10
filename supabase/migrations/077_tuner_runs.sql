-- 077_tuner_runs.sql
-- Phase 123.1 Plan 01 (TRIG-01 / D-07 / D-08) — durable latest-per-skill tuner result.
--
-- Substrate for the Skill Trigger Tuner's result persistence (D-07). Until now the tuner's
-- scoreboard lived ONLY in Redis (``tuner_result:{run_id}``, TTL 600s) and was lost on refresh
-- (BUG-260624-01 HIGH #3). This table is the DURABLE companion to that ephemeral Redis stash —
-- exactly one row per skill (the LATEST run), upserted on ``skill_id`` so a re-run OVERWRITES
-- (latest-wins, never accumulates — resolved A3 = one shared latest per skill). The GET-latest
-- route reads this for rehydration-on-open (Plan 04). Mirrors the ``runs`` table framing
-- (035_runs_table.sql): a durable record that survives the Redis TTL.
--
-- OWNERSHIP / GLOBAL-SKILL SEMANTICS (T-123.1-05 accept):
--   ``user_id`` = whoever LAST ran the tuner for this skill. The SELECT policy is by-skill
--   (owner OR the skill is global), so for a GLOBAL skill the single latest row is visible to
--   ANY user who can see the skill — its ``user_id`` is just "the last runner", NOT an access
--   gate. Low risk: global skills are an explicitly shared scope.
--
-- RLS: ONE SELECT policy mirroring the skill_files child-of-skills form (017_skills.sql:73-82).
--   NO INSERT/UPDATE/DELETE policies — the background job writes via the SERVICE-ROLE client
--   which bypasses RLS by design (035_runs_table.sql pattern). The app-code owner-scope gate
--   (``_fetch_owned_or_global_skill``) is the SOLE read-side leak gate; this RLS is
--   defense-in-depth for any future RLS-respecting (anon/authenticated) reader.
--
-- Apply via the Supabase SQL editor (never ``supabase db push`` / ``db reset`` — they wipe
-- local dev data), then regenerate ``supabase/full-schema.sql`` with
-- ``bash scripts/regenerate-full-schema.sh`` (NO --reset). This file is AUTHORED ONLY here;
-- Plan 01 Task 2 (autonomous:false, blocking-human) applies it + commits the regenerated
-- full-schema.sql per CLAUDE.md.

-- ============================================================
-- tuner_runs table — exactly one row per skill (UNIQUE(skill_id) latest-wins upsert key)
-- ============================================================
CREATE TABLE public.tuner_runs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id      uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- whoever last ran it
    run_id        uuid NOT NULL,                                              -- the ephemeral run-buffer id
    scoreboard    jsonb NOT NULL DEFAULT '{}',                                -- the full TunerScoreboard
    builder_model text NOT NULL DEFAULT '',                                   -- attribution: the model that wrote candidates
    target_count  integer NOT NULL DEFAULT 0,                                 -- attribution: N provider columns scored
    case_count    integer NOT NULL DEFAULT 0,                                 -- attribution: benchmark cases used
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tuner_runs_skill_unique UNIQUE (skill_id)                      -- D-07 / A3: one shared latest per skill
);

CREATE INDEX idx_tuner_runs_user_id ON public.tuner_runs (user_id);

COMMENT ON TABLE public.tuner_runs IS
  'Durable latest-per-skill Skill Trigger Tuner result (D-07). Exactly one row per skill '
  '(UNIQUE(skill_id) — upsert on_conflict=skill_id overwrites latest-wins). user_id = whoever '
  'last ran it; for a GLOBAL skill the SELECT-by-skill is identical for all global viewers '
  '(user_id is the last-runner attribution, NOT an access gate — T-123.1-05). Companion to the '
  'ephemeral Redis tuner_result:{run_id} stash — survives a Redis flush.';

-- ============================================================
-- tuner_runs RLS — child-of-skills SELECT (owner OR the skill is global), mirrors skill_files
-- (017_skills.sql:73-82). NO write policies: service-role writes bypass RLS (035 pattern).
-- ============================================================
ALTER TABLE public.tuner_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tuner runs on own or global skills"
  ON public.tuner_runs FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.skills
      WHERE skills.id = tuner_runs.skill_id
        AND skills.is_global = true
    )
  );
