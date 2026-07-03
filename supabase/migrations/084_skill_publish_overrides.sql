-- 084_skill_publish_overrides.sql
-- Phase 136 Plan 01 (GATE-01) — Skill publish gate: the append-only override audit table.
--
-- Creates the single owner-scoped, APPEND-ONLY table that records every "published without a
-- passing eval" force-publish (D-01/D-02). One row per override — a user who force-publishes,
-- unshares, edits, and force-publishes again accrues honest history (D-09 gates EVERY re-share,
-- so overrides can repeat and each one must be independently visible):
--   * public.skill_publish_overrides — which skill (FK), which version was live at the moment of
--                                      override (nullable FK — SET NULL survives version pruning),
--                                      who (auth.users FK), the gate_state the gate read at that
--                                      moment ('never_evaled' | 'latest_failed' |
--                                      'passed_on_older_version'), a gate_snapshot jsonb carrying
--                                      the honest counts ({measured, passed, reason, ...}), and
--                                      created_at = the "when" (D-01). No updated_at, no trigger —
--                                      append-only rows are never mutated.
--
-- The gate compute (publish_gate_service.compute_publish_gate) reads the MOST-RECENT row per
-- skill (order created_at desc, limit 1) as PublishGate.last_override so the eval surface can
-- show an honest "published without passing eval" status (D-02/D-06).
--
-- OWNERSHIP / SERVICE-ROLE / RLS SEMANTICS (035/079/080/081/083 precedent):
--   The backend writes this table via the SERVICE-ROLE client (the gated toggle_global handler,
--   Plan 02), which BYPASSES RLS. RLS here is owner-only SELECT defense-in-depth (T-136-04); the
--   app-code .eq("user_id", …) filter is the real runtime gate. There are NO INSERT/UPDATE/DELETE
--   policies — only the service-role handler writes, so a client can never forge, mutate, or
--   delete an override record (the audit trail is non-repudiable).
--
-- Apply via the Supabase SQL editor OR psycopg2 against the local DB at 127.0.0.1:54322, then
--   rebuild supabase/full-schema.sql with `bash scripts/regenerate-full-schema.sh` (NO --reset —
--   the default live-DB dump preserves dev data) and commit the migration + regenerated
--   full-schema.sql together (D-11). Do NOT use the destructive Supabase-CLI path that wipes and
--   replays the whole local database (`supabase db push` / `db reset`) — it destroys local dev
--   data (CLAUDE.md migration discipline). Filename matches <digits>_name.sql (no letter suffix —
--   those are silently skipped by the Supabase CLI).

-- ============================================================
-- (1) skill_publish_overrides — one APPEND-ONLY row per force-publish-past-the-gate (D-01/D-02).
-- ============================================================
CREATE TABLE public.skill_publish_overrides (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id         uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    skill_version_id uuid REFERENCES public.skill_versions(id) ON DELETE SET NULL,  -- live version at override time
    user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gate_state       text NOT NULL,                          -- 'never_evaled' | 'latest_failed' | 'passed_on_older_version'
    gate_snapshot    jsonb NOT NULL DEFAULT '{}'::jsonb,     -- honest counts at the moment of override ({measured, passed, reason})
    created_at       timestamptz NOT NULL DEFAULT now()      -- the "when" (D-01)
);

CREATE INDEX idx_skill_publish_overrides_skill_id ON public.skill_publish_overrides (skill_id);
CREATE INDEX idx_skill_publish_overrides_user_id  ON public.skill_publish_overrides (user_id);

COMMENT ON TABLE public.skill_publish_overrides IS
  'One APPEND-ONLY row per skill force-publish past an unmet publish gate (GATE-01, D-01/D-02). '
  'gate_state = what the gate read at the moment of override (never_evaled/latest_failed/'
  'passed_on_older_version); gate_snapshot = the honest counts jsonb; created_at = the when. '
  'skill_version_id (nullable, SET NULL) pins which version was live when overridden. The gate '
  'compute reads the most-recent row per skill as PublishGate.last_override so the eval surface '
  'shows an honest "published without passing eval" status (D-02/D-06). Owner-only RLS SELECT is '
  'defense-in-depth; the service-role toggle handler writes (bypasses RLS) and the app-code '
  '.eq("user_id") filter is the real gate (T-136-04). NO write policies — clients can never '
  'forge, mutate, or delete an override record (035/079/080/081/083 precedent).';

-- ============================================================
-- (2) RLS — owner-only SELECT (defense-in-depth; service-role writes bypass RLS).
-- NO INSERT/UPDATE/DELETE policies — all writes go through the service-role toggle handler
-- (035/079/080/081/083 precedent); app-code .eq("user_id") is the real gate (T-136-04).
-- ============================================================
ALTER TABLE public.skill_publish_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own publish overrides"
  ON public.skill_publish_overrides FOR SELECT USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view own publish overrides" ON public.skill_publish_overrides IS
  'Owner-only (D-02). Defense-in-depth: the service-role toggle handler bypasses RLS and the '
  'app-code .eq("user_id", …) filter is the real runtime gate (035/079/080/081/083 precedent, '
  'T-136-04).';
