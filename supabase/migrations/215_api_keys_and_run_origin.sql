-- 215 — Phase 293 (START-02, START-04; D-01..D-06, D-14..D-17, D-19, D-22, D-23, D-30)
-- API keys for the inbound door, and a run-origin record on every workflow run.
--
-- WHAT. Four things, in this order:
--   1. public.api_keys — one row per API key. A key belongs to ONE member in ONE org (D-01) and
--      names one or more published workflows it may start (a [{id,name}] snapshot, D-02). The
--      secret is shown once, in the create response, and stored here ONLY as a SHA-256 digest
--      (key_hash, D-19); key_prefix is the first 13 characters, kept for display.
--   2. workflow_runs.origin_kind / origin_label / origin_ref — who or what started a run:
--      'app' (a person in the app), 'schedule' (a schedule; label = its name, ref = its id) or
--      'key' (an API key; label = the key label, ref = the key id) (D-22). Old rows are backfilled
--      ONLY where inputs carry a UUID `_schedule_id`, because that is the one origin the past
--      recorded; every other old row stays NULL and renders no origin line (D-23). The columns
--      are then FROZEN by a trigger.
--   3. audit_log_action_type_check gains api_key.create / revoke / start / read / refused (D-16).
--   4. app_settings gains the two per-key limits (D-14) and audit_log an activity index (D-17).
--
-- WHY THE ORIGIN COLUMNS NEED A TRIGGER (T-293-03). workflow_runs carries an owner UPDATE policy
-- and an owner INSERT policy for `authenticated`, so a new column there is client-writable — a
-- member could rewrite "Started by key X" from the browser, the T-294-14 reasoning that moved
-- citation verdicts off messages (211). The trigger ASSIGNS the old values back on UPDATE (it does
-- not RAISE, so every unrelated update of a run row keeps working), and on INSERT it clears the
-- three columns when the writer is a client role (anon / authenticated). The backend writes runs
-- through the asyncpg pool (postgres), which the INSERT arm leaves untouched. The trigger is
-- created AFTER the backfill, or the backfill would be undone by it.
--
-- VISIBILITY. api_keys: owners READ their own rows (org member AND auth.uid() = user_id), through
-- a COLUMN-level grant that never names key_hash, so no client role can read a digest even with a
-- forged policy predicate (T-293-02). There is NO client write path: writes go through the backend
-- pool only (BYPASSRLS). Admin listing (D-04) is a backend route, not a policy.
--
-- NOT A SEED (the 214 reasoning): the app_settings columns carry their defaults (10 starts and 120
-- status reads per key per minute), so there is no INSERT, no docs/OPERATOR.md Step-3 entry and no
-- env var — deploy-artifact parity is unaffected. Bounded 1..60 and 10..600 here AND in
-- PUT /settings (app/api/settings.py), which must agree.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset), and
--       backend/venv/Scripts/python scripts/check-migration-215-live.py.
-- ⚠ PRODUCTION: apply BEFORE the backend that imports the new audit types deploys — boot
--   hard-fails otherwise (assert_action_types_synced) — then run get_advisors(security), a
--   deploy-parity item.
-- ============================================================================

BEGIN;

-- ── 1. public.api_keys ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       uuid NOT NULL,
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label        text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 60),
    key_prefix   text NOT NULL,
    key_hash     text NOT NULL UNIQUE,
    workflows    jsonb NOT NULL CHECK (jsonb_typeof(workflows) = 'array' AND jsonb_array_length(workflows) >= 1),
    expires_at   timestamptz NULL,
    revoked_at   timestamptz NULL,
    revoked_by   uuid NULL,
    last_used_at timestamptz NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.api_keys IS
    'Phase 293 (START-02). One API key per row: one member, one org, one or more published workflows. The secret is never stored; only its SHA-256 digest. Written only by the backend pool.';
COMMENT ON COLUMN public.api_keys.key_prefix IS
    'The first 13 characters of the secret (srl_live_ + 4), shown so a member can tell keys apart.';
COMMENT ON COLUMN public.api_keys.workflows IS
    'Snapshot [{id, name}] of the workflow rows this key may start. NO foreign key on purpose: a deleted workflow still renders as a deleted chip. A key pins the workflow VERSION row it was made for, as schedules do.';
COMMENT ON COLUMN public.api_keys.expires_at IS
    'NULL = never expires. Re-checked on every call, as are revoked_at and the owner''s membership.';

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_owner_label_active_uq
    ON public.api_keys (org_id, user_id, lower(btrim(label))) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS api_keys_org_id_idx
    ON public.api_keys (org_id);

-- The writer always binds org_id; this is only a backstop, exactly as on public.messages.
DROP TRIGGER IF EXISTS api_keys_autofill_org_id ON public.api_keys;
CREATE TRIGGER api_keys_autofill_org_id BEFORE INSERT ON public.api_keys
    FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Default privileges gave anon/authenticated/service_role ALL on a new public table; take them
-- back (PUBLIC first — the CLAUDE.md trap), then grant only what is needed. authenticated gets a
-- COLUMN list that leaves key_hash out; service_role keeps full DML for the backend.
REVOKE ALL ON TABLE public.api_keys FROM PUBLIC;
REVOKE ALL ON TABLE public.api_keys FROM anon;
REVOKE ALL ON TABLE public.api_keys FROM authenticated;
REVOKE ALL ON TABLE public.api_keys FROM service_role;
GRANT SELECT (id, org_id, user_id, label, key_prefix, workflows, expires_at, revoked_at, revoked_by, last_used_at, created_at) ON TABLE public.api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_keys TO service_role;

DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
CREATE POLICY "Users can view their own API keys" ON public.api_keys
    FOR SELECT TO authenticated
    USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));

-- There is NO INSERT / UPDATE / DELETE policy, on purpose: keys are written only by the backend
-- pool (create, revoke, last_used_at), and removed only by the user cascade.

-- ── 2. workflow_runs origin columns ─────────────────────────────────────────
-- Never a bare `origin`: public.messages.origin already exists (deep / harness).
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS origin_kind text;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS origin_label text;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS origin_ref uuid;

ALTER TABLE public.workflow_runs DROP CONSTRAINT IF EXISTS workflow_runs_origin_kind_check;
ALTER TABLE public.workflow_runs ADD CONSTRAINT workflow_runs_origin_kind_check
    CHECK (origin_kind IS NULL OR origin_kind IN ('app', 'schedule', 'key'));

COMMENT ON COLUMN public.workflow_runs.origin_kind IS
    'Phase 293 (START-04). app | schedule | key — what started this run. NULL on runs from before migration 215 that no schedule started. Frozen after insert (workflow_runs_origin_immutable).';
COMMENT ON COLUMN public.workflow_runs.origin_label IS
    'The schedule name or key label, snapshotted at start (renaming later never rewrites history). NULL for app starts and for a deleted schedule.';
COMMENT ON COLUMN public.workflow_runs.origin_ref IS
    'The schedule id or API key id. A key status read is scoped by it (origin_kind = ''key'' AND origin_ref = key id).';

CREATE INDEX IF NOT EXISTS workflow_runs_origin_key_idx
    ON public.workflow_runs (origin_ref) WHERE origin_kind = 'key';

-- ── 3. Backfill (D-23) — ONLY schedule-started rows; BEFORE the trigger exists ─
UPDATE public.workflow_runs wr
   SET origin_kind  = 'schedule',
       origin_ref   = (wr.inputs->>'_schedule_id')::uuid,
       origin_label = (SELECT s.name FROM public.workflow_schedules s
                        WHERE s.id = (wr.inputs->>'_schedule_id')::uuid)
 WHERE wr.origin_kind IS NULL
   AND wr.inputs ? '_schedule_id'
   -- 293-IN-05 (Phase 296): narrowed in place to the canonical 8-4-4-4-12 pattern. It ran locally
   -- only; cloud holds 0 _schedule_id rows (D-17), so 215 is NOT re-applied anywhere.
   AND wr.inputs->>'_schedule_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- ── 4. The freeze (T-293-03) — AFTER the backfill ───────────────────────────
CREATE OR REPLACE FUNCTION public.workflow_runs_origin_immutable()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = ''
AS $fn$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Assign, never RAISE: an unrelated update of a run row must keep working.
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

DROP TRIGGER IF EXISTS workflow_runs_origin_immutable ON public.workflow_runs;
CREATE TRIGGER workflow_runs_origin_immutable BEFORE UPDATE ON public.workflow_runs
    FOR EACH ROW EXECUTE FUNCTION public.workflow_runs_origin_immutable();

DROP TRIGGER IF EXISTS workflow_runs_origin_client_insert ON public.workflow_runs;
CREATE TRIGGER workflow_runs_origin_client_insert BEFORE INSERT ON public.workflow_runs
    FOR EACH ROW EXECUTE FUNCTION public.workflow_runs_origin_immutable();

-- A trigger function is never called directly; take the default EXECUTE away (PUBLIC first —
-- anon inherits from PUBLIC). EXECUTE is checked at CREATE TRIGGER time, not when it fires.
REVOKE EXECUTE ON FUNCTION public.workflow_runs_origin_immutable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.workflow_runs_origin_immutable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.workflow_runs_origin_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_runs_origin_immutable() TO service_role;

-- ── 5. audit_log action types (D-16) — every live literal kept (read from the live CHECK) ──
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    -- 11 legacy actions
    'document.upload', 'document.delete', 'search.query', 'code.execute', 'skill.load',
    'thread.create', 'thread.delete', 'settings.update', 'memory.remember', 'memory.recall', 'feedback.submit',
    -- 8 DM actions (Phase 110 / Migration 071)
    'view.create', 'view.delete', 'relationship.create', 'relationship.delete',
    'classification.apply', 'classification.rule.create', 'metadata.update', 'metadata.field.create',
    -- 2 Connector actions (Phase 223 / Migration 152)
    'connector.call', 'connector.grant',
    -- 3 Connector watch actions (Phase 234 / LIB-08)
    'connector.watch.create', 'connector.watch.delete', 'connector.watch.sync',
    -- 10 Retention + folder actions (Phase 275 / Migration 204)
    'retention.policy.create', 'retention.policy.update', 'retention.policy.delete',
    'retention.hold.create', 'retention.hold.update', 'retention.hold.release',
    'retention.disposition.confirm', 'retention.document.unarchive', 'retention.document.keep',
    'folder.delete',
    -- Phase 293 (D-16) — API keys
    'api_key.create', 'api_key.revoke', 'api_key.start', 'api_key.read', 'api_key.refused'
  ]::text[]));

-- ── 6. app_settings per-key limits (D-14) — schema, not a seed ──────────────
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS api_key_starts_per_minute integer NOT NULL DEFAULT 10;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS api_key_reads_per_minute integer NOT NULL DEFAULT 120;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_api_key_starts_per_minute_bound;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_api_key_starts_per_minute_bound
  CHECK (api_key_starts_per_minute >= 1 AND api_key_starts_per_minute <= 60);

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_api_key_reads_per_minute_bound;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_api_key_reads_per_minute_bound
  CHECK (api_key_reads_per_minute >= 10 AND api_key_reads_per_minute <= 600);

COMMENT ON COLUMN public.app_settings.api_key_starts_per_minute IS
  'Phase 293 (D-14). Runs one API key may start per minute, counted in Redis across every worker. '
  'Default 10. Bounded 1..60 by the API (app/api/settings.py) and by '
  'app_settings_api_key_starts_per_minute_bound.';

COMMENT ON COLUMN public.app_settings.api_key_reads_per_minute IS
  'Phase 293 (D-14). Run status reads one API key may make per minute, counted in Redis across '
  'every worker. Default 120. Bounded 10..600 by the API (app/api/settings.py) and by '
  'app_settings_api_key_reads_per_minute_bound.';

-- ── 7. Key activity index (D-17) — a key's recent calls come from audit_log ─
CREATE INDEX IF NOT EXISTS audit_log_api_key_id_idx
    ON public.audit_log ((metadata->>'api_key_id')) WHERE action_type LIKE 'api_key.%';

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('RLS enabled on api_keys',
--      (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
--        where n.nspname = 'public' and c.relname = 'api_keys')),
--     ('exactly one policy on api_keys, and it is SELECT',
--      (select count(*) = 1 and bool_and(cmd = 'SELECT') from pg_policies
--        where schemaname = 'public' and tablename = 'api_keys')),
--     ('authenticated can SELECT api_keys.id (positive control)',
--      has_column_privilege('authenticated', 'public.api_keys', 'id', 'SELECT')),
--     ('authenticated cannot SELECT api_keys.key_hash',
--      not has_column_privilege('authenticated', 'public.api_keys', 'key_hash', 'SELECT')),
--     ('authenticated cannot INSERT / UPDATE / DELETE api_keys',
--      not has_table_privilege('authenticated', 'public.api_keys', 'INSERT')
--      and not has_table_privilege('authenticated', 'public.api_keys', 'UPDATE')
--      and not has_table_privilege('authenticated', 'public.api_keys', 'DELETE')),
--     ('anon has no privilege on api_keys',
--      not has_table_privilege('anon', 'public.api_keys', 'SELECT')
--      and not has_column_privilege('anon', 'public.api_keys', 'id', 'SELECT')
--      and not has_table_privilege('anon', 'public.api_keys', 'INSERT')),
--     ('service_role can UPDATE api_keys',
--      has_table_privilege('service_role', 'public.api_keys', 'UPDATE')),
--     ('the three origin columns exist on workflow_runs',
--      (select count(*) = 3 from information_schema.columns
--        where table_schema = 'public' and table_name = 'workflow_runs'
--          and column_name in ('origin_kind', 'origin_label', 'origin_ref'))),
--     ('trigger workflow_runs_origin_immutable present',
--      exists (select 1 from pg_trigger where tgname = 'workflow_runs_origin_immutable'
--              and tgrelid = 'public.workflow_runs'::regclass and not tgisinternal)),
--     ('trigger workflow_runs_origin_client_insert present',
--      exists (select 1 from pg_trigger where tgname = 'workflow_runs_origin_client_insert'
--              and tgrelid = 'public.workflow_runs'::regclass and not tgisinternal)),
--     ('trigger function has no PUBLIC EXECUTE',
--      not has_function_privilege('public', 'public.workflow_runs_origin_immutable()', 'EXECUTE')),
--     ('trigger function has no anon EXECUTE',
--      not has_function_privilege('anon', 'public.workflow_runs_origin_immutable()', 'EXECUTE')),
--     ('the five api_key.* literals are in the audit CHECK',
--      (select bool_and(position(x in d.def) > 0)
--         from unnest(array['api_key.create', 'api_key.revoke', 'api_key.start',
--                           'api_key.read', 'api_key.refused']) as x,
--              (select pg_get_constraintdef(oid) as def from pg_constraint
--                where conname = 'audit_log_action_type_check') as d)),
--     ('app_settings.api_key_starts_per_minute exists',
--      exists (select 1 from information_schema.columns where table_schema = 'public'
--              and table_name = 'app_settings' and column_name = 'api_key_starts_per_minute')),
--     ('app_settings.api_key_reads_per_minute exists',
--      exists (select 1 from information_schema.columns where table_schema = 'public'
--              and table_name = 'app_settings' and column_name = 'api_key_reads_per_minute'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
