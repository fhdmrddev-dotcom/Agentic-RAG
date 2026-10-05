-- 202 — Phase 273 (ART-01..05, I-5, D-08, UI-D-03)
-- Table: public.message_artifacts — the store of agent-authored artifacts (chart | table | metric)
--
-- WHAT. `show_artifact` (Phase 273) lets the agent put an interactive chart, table or single metric
-- under its answer. Each emission is ONE immutable row here; the live `artifact` SSE event carries
-- the INSERT's RETURNING row and reload reads the same row back, so live == reload by construction.
--
-- WHY A TABLE, NOT A JSONB COLUMN ON public.messages (RESEARCH §Alternatives):
--   * messages has REPLICA IDENTITY FULL and sits in the realtime publication, so every artifact
--     (up to 256 KiB) would be re-broadcast on every message row change;
--   * messages carries an owner UPDATE policy — an artifact column there would be client-writable,
--     which breaks D-08 (an artifact is immutable once shown);
--   * the messages writer path (db/runs.py insert_assistant_message) has inherited-failing tests
--     (test_db_runs.py, frozen in 273-BASELINES.md) — adding a column there grows a red surface.
--
-- VISIBILITY (I-5). Exactly the parent message's: ONE SELECT policy whose predicate is the messages
-- SELECT predicate verbatim (full-schema.sql "Users can view their own messages"). There is NO
-- client write path — no INSERT/UPDATE/DELETE policy and no write grant to anon or authenticated.
-- The backend writes through the asyncpg pool, which connects as postgres and BYPASSES RLS, so
-- backend/app/db/artifacts.py binds thread_id AND user_id on every read.
--
-- IMMUTABILITY (D-08), and the one exemption it needs. No role is granted UPDATE, and a BEFORE
-- UPDATE trigger raises — the belt against the superuser pool. But an UNCONDITIONAL raise would make
-- every thread delete fail: DELETE public.threads cascades to public.runs (runs_thread_id_fkey
-- ON DELETE CASCADE), and deleting a runs row fires this table's `run_id ON DELETE SET NULL` as an
-- UPDATE here; deleting a root artifact fires its child's `parent_id ON DELETE SET NULL` the same
-- way. Postgres does not promise those referential actions run after the thread cascade has already
-- removed the artifact rows, and the same path fires on a user delete (auth.users → threads / runs
-- CASCADE). So the trigger RETURNs NEW for exactly that update — run_id and/or parent_id set to
-- NULL, every other column unchanged — and raises on everything else. Content columns (id,
-- thread_id, user_id, org_id, tool_call_id, label, component, spec, caption, row_count,
-- spec_version, created_at) stay immutable. Written in the POSITIVE form
-- `IF <cond> THEN RETURN NEW; END IF; RAISE …` — a NULL condition falls through to the raise.
-- Accepted width: a hand-written `SET parent_id = NULL` (or run_id = NULL) is indistinguishable
-- from FK upkeep and is allowed; it changes no content. Referential actions run as the table
-- owner, so no UPDATE grant is needed for them.
-- Rejected alternatives: `run_id ON DELETE CASCADE` deletes a stored artifact whenever its run row
-- goes while the message still references it (reload would show `missing`); dropping the FK leaves
-- dangling run ids. Neither fixes parent_id. At planning (re-checked at 273-01) the app has no
-- direct runs-row delete — `DELETE /runs/{id}` is a cancel verb — and a future one is covered by
-- the same exemption.
--
-- LABELS (UI-D-03). `chart N` / `table N` / `metric N` is assigned by the server at INSERT, per
-- component per thread, under a transaction-scoped advisory lock; UNIQUE (thread_id, label) is the
-- belt. Never recomputed.
--
-- The component CHECK, row_count and octet_length caps equal backend/app/models/artifact.py's
-- ARTIFACT_COMPONENTS / MAX_ROWS / MAX_SPEC_BYTES (test_273_migration_202_shape asserts it).
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset).
-- ⚠ PRODUCTION: apply BEFORE the backend that writes this table deploys, then run
--   get_advisors(security) — a deploy-parity item.
-- ============================================================================

BEGIN;

-- ── 1. public.message_artifacts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_artifacts (
    id           text PRIMARY KEY CHECK (id ~ '^a_[0-9a-z]{10}$'),
    thread_id    uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id       uuid NOT NULL,
    run_id       uuid REFERENCES public.runs(run_id) ON DELETE SET NULL,
    tool_call_id text,
    parent_id    text REFERENCES public.message_artifacts(id) ON DELETE SET NULL,
    label        text NOT NULL CHECK (label ~ '^(chart|table|metric) [1-9][0-9]*$'),
    component    text NOT NULL CHECK (component IN ('chart', 'table', 'metric')),
    spec         jsonb NOT NULL,
    caption      jsonb NOT NULL,
    row_count    integer NOT NULL CHECK (row_count BETWEEN 1 AND 500),
    spec_version smallint NOT NULL DEFAULT 1,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT message_artifacts_spec_size CHECK (octet_length(spec::text) <= 262144),
    CONSTRAINT message_artifacts_thread_label_key UNIQUE (thread_id, label)
);

COMMENT ON TABLE public.message_artifacts IS
    'Agent-authored artifacts (chart | table | metric) shown under an assistant answer (Phase 273, ART-01..05). One immutable row per show_artifact emission. Visibility mirrors public.messages; written only by the backend pool.';
COMMENT ON COLUMN public.message_artifacts.id IS
    'Server-generated id a_ + 10 chars of [0-9a-z]. The FIRST key of the tool result, so a persisted result maps back to its row on reload.';
COMMENT ON COLUMN public.message_artifacts.thread_id IS
    'The thread the artifact was shown in. ON DELETE CASCADE: a thread delete removes its artifacts.';
COMMENT ON COLUMN public.message_artifacts.user_id IS
    'The thread owner. Part of the RLS predicate (auth.uid() = user_id), as on messages.';
COMMENT ON COLUMN public.message_artifacts.org_id IS
    'The tenancy boundary. Passed explicitly from the validated active org when known; otherwise stamped by the autofill trigger, exactly as messages.';
COMMENT ON COLUMN public.message_artifacts.run_id IS
    'The run that emitted it. ON DELETE SET NULL — the one column (with parent_id) the immutability trigger lets referential upkeep null.';
COMMENT ON COLUMN public.message_artifacts.tool_call_id IS
    'The provider tool-call id, for audit only. NOT a join key: Gemini repeats call_{idx} across turns.';
COMMENT ON COLUMN public.message_artifacts.parent_id IS
    'The artifact a by-reference emission (from_artifact) was derived from. ON DELETE SET NULL.';
COMMENT ON COLUMN public.message_artifacts.label IS
    'chart N / table N / metric N — assigned at INSERT per component per thread under an advisory lock, never recomputed (UI-D-03). A from_artifact alias.';
COMMENT ON COLUMN public.message_artifacts.component IS
    'The closed component set (I-1). Must equal ARTIFACT_COMPONENTS in backend/app/models/artifact.py.';
COMMENT ON COLUMN public.message_artifacts.spec IS
    'The validated spec (spec_version 1): title, columns, rows, chart | metric encoding. Never a free props bag (D-02).';
COMMENT ON COLUMN public.message_artifacts.caption IS
    'Server-derived caption: row_count, sources, source_count, lineage (D-04). Never model-written.';
COMMENT ON COLUMN public.message_artifacts.row_count IS
    'Rows in spec.rows. 1..500; above the cap the call is refused, never truncated (D-09).';
COMMENT ON COLUMN public.message_artifacts.spec_version IS
    'Wire-contract version of spec. 1.';
COMMENT ON COLUMN public.message_artifacts.created_at IS
    'Emission time. Orders a thread''s artifacts.';

CREATE INDEX IF NOT EXISTS idx_message_artifacts_thread
    ON public.message_artifacts (thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_artifacts_org
    ON public.message_artifacts (org_id);
CREATE INDEX IF NOT EXISTS idx_message_artifacts_run
    ON public.message_artifacts (run_id);
CREATE INDEX IF NOT EXISTS idx_message_artifacts_parent
    ON public.message_artifacts (parent_id);

-- ── 2. Org autofill — exactly as public.messages has it ─────────────────────
DROP TRIGGER IF EXISTS message_artifacts_autofill_org_id ON public.message_artifacts;
CREATE TRIGGER message_artifacts_autofill_org_id BEFORE INSERT ON public.message_artifacts
    FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

-- ── 3. Immutability with the FK-upkeep exemption (D-08) ─────────────────────
CREATE OR REPLACE FUNCTION public.message_artifacts_immutable()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = ''
AS $fn$
BEGIN
    -- The ONLY permitted change: referential upkeep nulling run_id and/or parent_id.
    IF (to_jsonb(NEW) - 'run_id' - 'parent_id') = (to_jsonb(OLD) - 'run_id' - 'parent_id')
       AND (NEW.run_id IS NULL OR NEW.run_id IS NOT DISTINCT FROM OLD.run_id)
       AND (NEW.parent_id IS NULL OR NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id)
    THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'message_artifacts rows are immutable once shown (D-08)'
        USING ERRCODE = 'insufficient_privilege';
END;
$fn$;

DROP TRIGGER IF EXISTS message_artifacts_immutable ON public.message_artifacts;
CREATE TRIGGER message_artifacts_immutable BEFORE UPDATE ON public.message_artifacts
    FOR EACH ROW EXECUTE FUNCTION public.message_artifacts_immutable();

-- A trigger function is never called directly; take the default EXECUTE away (PUBLIC first —
-- anon inherits from PUBLIC). EXECUTE is checked at CREATE TRIGGER time, not when it fires.
REVOKE EXECUTE ON FUNCTION public.message_artifacts_immutable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.message_artifacts_immutable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.message_artifacts_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.message_artifacts_immutable() TO service_role;

-- ── 4. RLS + privileges: owners READ; only the backend writes (I-5) ─────────
ALTER TABLE public.message_artifacts ENABLE ROW LEVEL SECURITY;

-- Default privileges gave anon/authenticated ALL on a new public table; take them back
-- (PUBLIC first — the CLAUDE.md trap), then grant only what is needed. No UPDATE anywhere (D-08).
-- ⚠ service_role is revoked too: Supabase's default privileges grant it ALL on a new table, and a
-- GRANT adds privileges without removing any — so without this line service_role still held
-- UPDATE. Measured: the first local apply read `*** FAIL *** service_role cannot UPDATE`.
REVOKE ALL ON TABLE public.message_artifacts FROM PUBLIC;
REVOKE ALL ON TABLE public.message_artifacts FROM anon;
REVOKE ALL ON TABLE public.message_artifacts FROM authenticated;
REVOKE ALL ON TABLE public.message_artifacts FROM service_role;
GRANT SELECT ON TABLE public.message_artifacts TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.message_artifacts TO service_role;

DROP POLICY IF EXISTS "Users can view their own message artifacts" ON public.message_artifacts;
CREATE POLICY "Users can view their own message artifacts" ON public.message_artifacts
    FOR SELECT TO authenticated
    USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));

-- There is NO INSERT / UPDATE / DELETE policy, on purpose: rows are written only by the backend
-- pool, and removed only by the thread / user cascades.

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('RLS enabled on message_artifacts',
--      (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
--        where n.nspname = 'public' and c.relname = 'message_artifacts')),
--     ('exactly one policy on message_artifacts',
--      (select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'message_artifacts')),
--     ('the one policy is SELECT',
--      (select bool_and(cmd = 'SELECT') from pg_policies where schemaname = 'public' and tablename = 'message_artifacts')),
--     ('anon cannot SELECT',
--      not has_table_privilege('anon', 'public.message_artifacts', 'SELECT')),
--     ('authenticated can SELECT',
--      has_table_privilege('authenticated', 'public.message_artifacts', 'SELECT')),
--     ('authenticated cannot INSERT',
--      not has_table_privilege('authenticated', 'public.message_artifacts', 'INSERT')),
--     ('authenticated cannot UPDATE',
--      not has_table_privilege('authenticated', 'public.message_artifacts', 'UPDATE')),
--     ('service_role cannot UPDATE',
--      not has_table_privilege('service_role', 'public.message_artifacts', 'UPDATE')),
--     ('immutability trigger present',
--      exists (select 1 from pg_trigger where tgname = 'message_artifacts_immutable'
--              and tgrelid = 'public.message_artifacts'::regclass and not tgisinternal)),
--     ('org autofill trigger present',
--      exists (select 1 from pg_trigger where tgname = 'message_artifacts_autofill_org_id'
--              and tgrelid = 'public.message_artifacts'::regclass and not tgisinternal)),
--     ('trigger body carries the FK-upkeep exemption',
--      (select position('- ''run_id'' - ''parent_id''' in p.prosrc) > 0 from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'message_artifacts_immutable')),
--     ('anon cannot exec the trigger function',
--      not has_function_privilege('anon', 'public.message_artifacts_immutable()', 'EXECUTE'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
