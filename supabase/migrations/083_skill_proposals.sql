-- 083_skill_proposals.sql
-- Phase 135 Plan 01 (SI-01) — Self-improvement loop persistence: the skill_proposals table.
--
-- Creates the single owner-scoped table that anchors the whole self-improvement loop. One row per
-- proposed instruction-body edit for a skill:
--   * public.skill_proposals — the proposed instructions + the proposer's rationale + an honest
--                              evidence summary + the D-07 lifecycle status. FKs into skills (the
--                              target), skill_versions (base = what the diff is against; new = the
--                              draft version created ONLY on approval, source='self_improve'), and
--                              eval_runs (source = the run whose evidence drove the proposal / D-13
--                              baseline; re_eval = the auto re-eval / D-12, which Phase 136 can
--                              consume). status is a durable 7-value lifecycle enum
--                              (proposed/rejected/approved/re_evaling/promoted/not_promoted/
--                              interrupted) so a backend that dies mid-re-eval leaves a recoverable
--                              'interrupted'/'re_evaling' row, never a lost proposal.
--
-- WHY new_skill_version_id is created ONLY on approval (Plan 05, RESEARCH Pitfall #2):
--   The version row is INSERTed at approval time (source='self_improve'), never for an unapproved
--   draft — so skill_versions history stays clean of rejected/abandoned drafts. Rejections keep
--   their full audit trail HERE (status='rejected'), with new_skill_version_id staying NULL.
--
-- OWNERSHIP / SERVICE-ROLE / RLS SEMANTICS (035/079/080/081 precedent, D-07):
--   The backend writes this table via the SERVICE-ROLE client (the SI-01 proposer + review router,
--   Plans 04/05), which BYPASSES RLS. RLS here is owner-only SELECT defense-in-depth (T-135-07); the
--   app-code .eq("user_id", …) filter is the real runtime gate. There are NO INSERT/UPDATE/DELETE
--   policies — only the service-role router writes (035/079/080/081 precedent), so a client can never
--   forge or mutate a proposal/version-draft row (T-135-01).
--
-- Apply via the Supabase SQL editor OR psycopg2 against the local DB at 127.0.0.1:54322, then rebuild
--   supabase/full-schema.sql with `bash scripts/regenerate-full-schema.sh` (NO --reset — the default
--   live-DB dump preserves dev data) and commit the migration + regenerated full-schema.sql together.
--   Do NOT use the destructive Supabase-CLI path that wipes and replays the whole local database
--   (`supabase db push` / `db reset`) — it destroys local dev data (CLAUDE.md migration discipline,
--   D-17). Filename matches <digits>_name.sql (no letter suffix — those are silently skipped by the
--   Supabase CLI). This file is AUTHORED in Task 1; Task 2 applies it live + commits the regenerated
--   full-schema.sql alongside it.

-- ============================================================
-- (1) skill_proposals — one durable row per proposed instruction-body edit (SI-01, D-07).
-- FKs: base version (diff-against, NOT NULL), new version (approval-only, nullable), source + re-eval
-- runs (nullable). status is the durable 7-value lifecycle enum.
-- ============================================================
CREATE TABLE public.skill_proposals (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id              uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    base_skill_version_id uuid NOT NULL REFERENCES public.skill_versions(id) ON DELETE CASCADE,  -- what the diff is against
    new_skill_version_id  uuid REFERENCES public.skill_versions(id) ON DELETE SET NULL,          -- created only on approval (source='self_improve')
    re_eval_run_id        uuid REFERENCES public.eval_runs(id) ON DELETE SET NULL,               -- the auto re-eval (D-12); Phase 136 can consume
    source_eval_run_id    uuid REFERENCES public.eval_runs(id) ON DELETE SET NULL,               -- the run whose evidence drove the proposal (D-13 baseline)
    user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    proposed_instructions text NOT NULL,
    rationale             text NOT NULL DEFAULT '',
    evidence_summary      text NOT NULL DEFAULT '',   -- honest "which evidence drove this" (D-10)
    status                text NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed','rejected','approved','re_evaling','promoted','not_promoted','interrupted')),
    override_forced       boolean NOT NULL DEFAULT false,  -- D-06 force-promote-with-evidence recorded
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_skill_proposals_skill_id ON public.skill_proposals (skill_id);
CREATE INDEX idx_skill_proposals_user_id  ON public.skill_proposals (user_id);

COMMENT ON TABLE public.skill_proposals IS
  'One durable row per proposed skill-instruction edit (SI-01, D-07). proposed_instructions + '
  'rationale + evidence_summary + the 7-value lifecycle status (proposed/rejected/approved/'
  're_evaling/promoted/not_promoted/interrupted). base_skill_version_id (NOT NULL) is what the diff '
  'is against; new_skill_version_id is INSERTed ONLY on approval (source=''self_improve'', Plan 05) so '
  'skill_versions history stays clean of unapproved drafts; rejections keep their audit trail here '
  'with new_skill_version_id NULL. source_eval_run_id = the run whose evidence drove the proposal '
  '(D-13 baseline); re_eval_run_id = the auto re-eval (D-12, Phase 136 can consume). override_forced '
  'records a D-06 force-promote-with-evidence. Owner-only RLS SELECT is defense-in-depth; the '
  'service-role SI-01 router writes (bypasses RLS) and the app-code .eq("user_id") filter is the real '
  'gate (T-135-07). NO write policies — only the service-role router writes (T-135-01).';

-- skill_proposals.updated_at — reuse the existing set_updated_at() (014_folders.sql), exactly as
-- 079/081 did. Do NOT redefine the function.
DROP TRIGGER IF EXISTS skill_proposals_set_updated_at ON public.skill_proposals;
CREATE TRIGGER skill_proposals_set_updated_at
  BEFORE UPDATE ON public.skill_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- (2) RLS — owner-only SELECT (defense-in-depth; service-role writes bypass RLS).
-- NO INSERT/UPDATE/DELETE policies — all writes go through the service-role SI-01 router
-- (035/079/080/081 precedent); app-code .eq("user_id") is the real gate (T-135-07 / T-135-01).
-- ============================================================
ALTER TABLE public.skill_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skill proposals"
  ON public.skill_proposals FOR SELECT USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view own skill proposals" ON public.skill_proposals IS
  'Owner-only (D-07). Defense-in-depth: the service-role SI-01 router bypasses RLS and the app-code '
  '.eq("user_id", …) filter is the real runtime gate (035/079/080/081 precedent, T-135-07).';
