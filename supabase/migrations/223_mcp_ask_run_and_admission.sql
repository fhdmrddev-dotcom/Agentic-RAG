-- 223 — Phase 306 (MCP-05, MCP-06, GUARD-01; D-31, D-04, D-35, D-36)
-- Ask the agent and run workflows over MCP: where a thread says what started it, how long an
-- MCP ask may wait, and how many outside runs may be in flight at once.
--
-- WHAT. Two things, in this order:
--   1. public.threads origin (D-31) — origin_kind / origin_label / origin_ref, the workflow_runs
--      shape from mig 215 copied onto threads. An MCP ask (MCP-05) starts a thread of its own and
--      a thread had no origin until now (only workflow_runs did). origin_kind is CHECKed to
--      app | schedule | key | mcp (the mig 220 'mcp' literal). A partial index serves "the
--      threads this MCP key started" (origin_ref WHERE origin_kind = 'mcp'). FROZEN by
--      public.threads_origin_immutable(): an UPDATE keeps the old origin for EVERY role, and a
--      client-role INSERT (anon / authenticated, the owner insert policy) gets NULL origin — only
--      the backend's service-role pool can stamp one. Assign, never RAISE: an unrelated update of
--      a thread row (title, folder, active run) must keep working. A trigger function is never
--      called directly, so EXECUTE is taken from PUBLIC first (anon inherits from PUBLIC — the
--      CLAUDE.md trap), then anon, authenticated, and granted to service_role.
--      threads carries no column-level grant (measured in full-schema.sql: no GRANT on threads at
--      all; client access is the table-level default + the four owner policies), so the new
--      columns need no grant line — they are read exactly as every other threads column is.
--   2. Four app_settings knobs — each integer NOT NULL DEFAULT n with a _bound CHECK:
--        mcp_ask_wait_seconds          DEFAULT 30, 5..45 (D-04 / D-36: the ask's wait budget;
--                                      D-36 supersedes D-04's 55 so a reply always lands inside
--                                      a client's 60 s tool timeout)
--        outside_inflight_per_key      DEFAULT 2, 1..50 (D-35: admission, per credential)
--        outside_inflight_per_org      DEFAULT 4, 1..50 (D-35: admission, per org)
--        outside_inflight_per_provider DEFAULT 6, 1..50 (D-35: admission, per provider)
--      Three bounds agree for each: this CHECK, the API's 400 (app/api/settings.py) and the UI
--      clamp (ApiKeyLimits.tsx) — the two code bounds land in 306-02.
--
-- NO AUDIT LITERAL. audit_log_action_type_check is not touched, so the assert_action_types_synced
-- boot hazard does not apply. The one function is SECURITY INVOKER (the default) and trigger-only.
--
-- NOT A SEED — DEFAULTs only (the 214/215/220/222 reasoning): there is no INSERT, no
-- docs/OPERATOR.md Step-3 entry and no env var, so deploy-artifact parity is unaffected.
--
-- Apply discipline (CLAUDE.md): applied LOCAL first by pasting into the Supabase SQL editor (or
-- one psql / asyncpg session). Never the Supabase CLI's push or reset commands. Idempotent: safe
-- to paste twice. Then: bash scripts/regenerate-full-schema.sh (no --reset), and
--       backend/venv/Scripts/python scripts/check-migration-223-live.py.
-- ⚠ PRODUCTION (D-25 / D-31): the cloud paste is OWED to the operator and comes AFTER
--   220 -> 221 -> 222 -> 223, IN THAT ORDER, each under its own per-action operator approval,
--   BEFORE the 306 backend deploys; then run get_advisors(security). Phase 306 does not deploy
--   itself.
-- ============================================================================

BEGIN;

-- ── 1. D-31: threads origin — columns, CHECK, partial index ─────────────────
-- Never a bare `origin`: public.messages.origin already exists (deep / harness).
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS origin_kind text;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS origin_label text;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS origin_ref uuid;

ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS threads_origin_kind_check;
ALTER TABLE public.threads ADD CONSTRAINT threads_origin_kind_check
    CHECK (origin_kind IS NULL OR origin_kind IN ('app', 'schedule', 'key', 'mcp'));

COMMENT ON COLUMN public.threads.origin_kind IS
    'Phase 306 (D-31, MCP-05). app | schedule | key | mcp — what started this thread. NULL on threads from before migration 223 and on every thread a client inserts. Frozen after insert (threads_origin_immutable).';
COMMENT ON COLUMN public.threads.origin_label IS
    'The key label (or schedule name), snapshotted at start: renaming later never rewrites history.';
COMMENT ON COLUMN public.threads.origin_ref IS
    'The API key id (or schedule id) that started this thread. An MCP read is scoped by it (origin_kind = ''mcp'' AND origin_ref = key id).';

CREATE INDEX IF NOT EXISTS threads_mcp_origin_ref_idx
    ON public.threads (origin_ref) WHERE origin_kind = 'mcp';

-- ── 2. D-31 / T-306-08: the freeze ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.threads_origin_immutable()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = ''
AS $fn$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Assign, never raise: an unrelated update of a thread row must keep working.
        NEW.origin_kind := OLD.origin_kind;
        NEW.origin_label := OLD.origin_label;
        NEW.origin_ref := OLD.origin_ref;
    ELSIF current_user IN ('anon', 'authenticated') THEN
        -- A client-role INSERT (the owner insert policy) may not claim an origin.
        NEW.origin_kind := NULL;
        NEW.origin_label := NULL;
        NEW.origin_ref := NULL;
    END IF;
    RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS threads_origin_freeze_update ON public.threads;
CREATE TRIGGER threads_origin_freeze_update BEFORE UPDATE ON public.threads
    FOR EACH ROW EXECUTE FUNCTION public.threads_origin_immutable();

DROP TRIGGER IF EXISTS threads_origin_freeze_insert ON public.threads;
CREATE TRIGGER threads_origin_freeze_insert BEFORE INSERT ON public.threads
    FOR EACH ROW EXECUTE FUNCTION public.threads_origin_immutable();

-- T-306-23: PUBLIC first (anon inherits from PUBLIC). EXECUTE is checked at CREATE TRIGGER time,
-- not when the trigger fires, so no client role needs it.
REVOKE EXECUTE ON FUNCTION public.threads_origin_immutable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.threads_origin_immutable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.threads_origin_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.threads_origin_immutable() TO service_role;

-- ── 3. D-04 / D-36: the MCP ask's wait budget — schema, not a seed ──────────
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS mcp_ask_wait_seconds integer NOT NULL DEFAULT 30;
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_mcp_ask_wait_seconds_bound;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_mcp_ask_wait_seconds_bound
  CHECK (mcp_ask_wait_seconds >= 5 AND mcp_ask_wait_seconds <= 45);
COMMENT ON COLUMN public.app_settings.mcp_ask_wait_seconds IS
  'Phase 306 (D-04, D-36). Seconds an MCP ask_agent call waits for the answer before it returns '
  'a still-working reply. Default 30. Bounded 5..45 by three agreeing bounds: '
  'app_settings_mcp_ask_wait_seconds_bound, the API 400 (app/api/settings.py) and the UI clamp.';

-- ── 4. D-35: outside-run admission — schema, not a seed ─────────────────────
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS outside_inflight_per_key integer NOT NULL DEFAULT 2;
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_outside_inflight_per_key_bound;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_outside_inflight_per_key_bound
  CHECK (outside_inflight_per_key >= 1 AND outside_inflight_per_key <= 50);
COMMENT ON COLUMN public.app_settings.outside_inflight_per_key IS
  'Phase 306 (D-35, GUARD-01). Outside (MCP / API-key) runs one credential may have in flight at '
  'once. Default 2. Bounded 1..50 by three agreeing bounds: '
  'app_settings_outside_inflight_per_key_bound, the API 400 (app/api/settings.py) and the UI clamp.';

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS outside_inflight_per_org integer NOT NULL DEFAULT 4;
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_outside_inflight_per_org_bound;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_outside_inflight_per_org_bound
  CHECK (outside_inflight_per_org >= 1 AND outside_inflight_per_org <= 50);
COMMENT ON COLUMN public.app_settings.outside_inflight_per_org IS
  'Phase 306 (D-35, GUARD-01). Outside (MCP / API-key) runs one organization may have in flight '
  'at once. Default 4. Bounded 1..50 by three agreeing bounds: '
  'app_settings_outside_inflight_per_org_bound, the API 400 (app/api/settings.py) and the UI clamp.';

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS outside_inflight_per_provider integer NOT NULL DEFAULT 6;
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_outside_inflight_per_provider_bound;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_outside_inflight_per_provider_bound
  CHECK (outside_inflight_per_provider >= 1 AND outside_inflight_per_provider <= 50);
COMMENT ON COLUMN public.app_settings.outside_inflight_per_provider IS
  'Phase 306 (D-35, GUARD-01). Outside (MCP / API-key) runs one model provider may have in flight '
  'at once, across every org. Default 6. Bounded 1..50 by three agreeing bounds: '
  'app_settings_outside_inflight_per_provider_bound, the API 400 (app/api/settings.py) and the UI clamp.';

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('threads has the three origin columns',
--      (select count(*) = 3 from information_schema.columns where table_schema = 'public'
--        and table_name = 'threads' and column_name in ('origin_kind', 'origin_label', 'origin_ref'))),
--     ('origin_kind CHECK names mcp',
--      (select pg_get_constraintdef(oid) like '%''mcp''%' from pg_constraint
--        where conname = 'threads_origin_kind_check')),
--     ('the mcp origin index exists',
--      exists (select 1 from pg_indexes where indexname = 'threads_mcp_origin_ref_idx')),
--     ('both freeze triggers exist',
--      (select count(*) = 2 from pg_trigger where tgrelid = 'public.threads'::regclass
--        and tgname in ('threads_origin_freeze_update', 'threads_origin_freeze_insert'))),
--     ('anon cannot EXECUTE the freeze function',
--      not has_function_privilege('anon', 'public.threads_origin_immutable()', 'EXECUTE')),
--     ('authenticated cannot EXECUTE the freeze function',
--      not has_function_privilege('authenticated', 'public.threads_origin_immutable()', 'EXECUTE')),
--     ('the four knobs read 30 / 2 / 4 / 6',
--      (select mcp_ask_wait_seconds = 30 and outside_inflight_per_key = 2
--              and outside_inflight_per_org = 4 and outside_inflight_per_provider = 6
--         from public.app_settings limit 1))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
