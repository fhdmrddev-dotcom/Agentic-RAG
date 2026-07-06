-- 090_skill_proposals_description_kind.sql
-- Phase 139 Plan 01 (SI-02) — description-only self-improve proposer: extend skill_proposals.
--
-- SI-02 REUSES the SI-01 substrate (D-11): ONE proposals table, ONE lifecycle status enum, ONE audit
-- trail — filtered by a new `kind` discriminator ('instruction' | 'description'). This migration is a
-- pure ADDITIVE `ALTER TABLE public.skill_proposals` (the table already exists — mig 083). It adds the
-- description-side columns + a provenance FK + relaxes the instruction NOT-NULL, then installs a
-- kind-gated partial CHECK so exactly one of (proposed_instructions | proposed_description) is present
-- per row. NO new status value (description proposals only ever use proposed/rejected/approved/
-- promoted — D-07; the existing 7-value CHECK already covers them). NO new RLS policy (the 083
-- owner-only SELECT scopes every column; service-role router writes bypass RLS — D-11).
--
-- WHY source_tuner_run_id is PROVENANCE-ONLY (RESEARCH Pitfall 1, Pattern 1):
--   tuner_runs is a latest-wins singleton — CONSTRAINT tuner_runs_skill_unique UNIQUE (skill_id),
--   upserted on_conflict='skill_id', so the row MUTATES on every Tuner re-run. A proposal that
--   rendered its scoreboard live through this FK would silently change after a re-run. So the FK is
--   AUDIT/provenance ONLY (ON DELETE SET NULL); the evidence the card displays is COPIED inline into
--   scoreboard_snapshot at propose-time (Plan 139-02) and never follows the mutable FK.
--
-- NO BACKFILL NEEDED: existing rows are all instruction proposals — the `kind` DEFAULT 'instruction'
--   backfills them, and every existing row already satisfies (proposed_instructions IS NOT NULL AND
--   proposed_description IS NULL), so the new partial CHECK validates against current data cleanly.
--
-- Apply via the Supabase SQL editor OR psycopg2 against the local DB at 127.0.0.1:54322, then rebuild
--   supabase/full-schema.sql with `bash scripts/regenerate-full-schema.sh` (NO --reset — the default
--   live-DB dump preserves dev data) and commit the migration + regenerated full-schema.sql together.
--   Do NOT use the destructive Supabase-CLI path that wipes and replays the whole local database
--   (`supabase db push` / `db reset`) — it destroys local dev data (CLAUDE.md migration discipline).
--   Filename matches <digits>_name.sql (no letter suffix — those are silently skipped by the Supabase
--   CLI). This file is AUTHORED here; the live apply + full-schema regen happens in Plan 139-03.

-- ============================================================
-- (1) Additive columns — the kind discriminator + the description-side + provenance FK.
-- ============================================================
ALTER TABLE public.skill_proposals
    ADD COLUMN kind text NOT NULL DEFAULT 'instruction'
        CHECK (kind IN ('instruction','description')),                 -- which arm of the loop wrote this row
    ADD COLUMN proposed_description text,                              -- the winning DESCRIPTION snapshot (nullable)
    ADD COLUMN scoreboard_snapshot  jsonb,                            -- IMMUTABLE proposed-vs-current per-provider cells, copied inline at propose-time
    ADD COLUMN source_tuner_run_id  uuid
        REFERENCES public.tuner_runs(id) ON DELETE SET NULL;          -- PROVENANCE ONLY — evidence lives in scoreboard_snapshot, never read live through this FK

-- Relax proposed_instructions so a kind='description' row (no instructions) persists. The kind-gated
-- CHECK below re-imposes the invariant per-kind.
ALTER TABLE public.skill_proposals
    ALTER COLUMN proposed_instructions DROP NOT NULL;

-- ============================================================
-- (2) Kind-gated integrity — exactly one of (instructions | description) present per row.
-- Partial CHECK, matching the 079/083 strong-invariant style. Existing instruction rows satisfy the
-- 'instruction' branch (see NO BACKFILL note above), so this validates against current data.
-- ============================================================
ALTER TABLE public.skill_proposals
    ADD CONSTRAINT skill_proposals_kind_fields CHECK (
        (kind = 'instruction' AND proposed_instructions IS NOT NULL AND proposed_description IS NULL)
        OR
        (kind = 'description' AND proposed_description IS NOT NULL AND proposed_instructions IS NULL)
    );

-- ============================================================
-- (3) Column comments (083 style).
-- ============================================================
COMMENT ON COLUMN public.skill_proposals.kind IS
  'Discriminator (SI-02, D-11): ''instruction'' (SI-01 loop — proposed_instructions set) or '
  '''description'' (SI-02 Trigger-Tuner-winner loop — proposed_description set). Enforced together '
  'with the presence invariant by the skill_proposals_kind_fields CHECK. Defaults ''instruction'' so '
  'pre-existing rows backfill correctly.';

COMMENT ON COLUMN public.skill_proposals.proposed_description IS
  'The proposed skill DESCRIPTION (SI-02) — the held-out per-provider WINNING description snapshotted '
  'from a Trigger Tuner run at propose-time. NULL for kind=''instruction'' rows. On approval it is '
  'written to skills.description (the 079/132 trigger versions it — no draft INSERT, no re-eval; D-07).';

COMMENT ON COLUMN public.skill_proposals.scoreboard_snapshot IS
  'IMMUTABLE proposed-vs-current per-provider scoreboard cells, COPIED inline at propose-time (SI-02, '
  'RESEARCH Pitfall 1). This — NOT source_tuner_run_id — is the evidence the proposal card renders, '
  'because tuner_runs is a latest-wins singleton (UNIQUE(skill_id)) that mutates on re-run.';

COMMENT ON COLUMN public.skill_proposals.source_tuner_run_id IS
  'PROVENANCE-ONLY FK to the tuner_runs row that produced this description proposal (ON DELETE SET '
  'NULL). The displayed evidence is scoreboard_snapshot (copied inline); this FK is audit lineage '
  'only and MUST NOT be read live for the scoreboard — the tuner_runs row is overwritten latest-wins '
  'on every re-run (RESEARCH Pitfall 1, Pattern 1).';

COMMENT ON CONSTRAINT skill_proposals_kind_fields ON public.skill_proposals IS
  'Kind-gated presence invariant (SI-02): an ''instruction'' row has proposed_instructions and no '
  'proposed_description; a ''description'' row has proposed_description and no proposed_instructions. '
  'DB-level integrity gate below the route validation (T-139-02).';
