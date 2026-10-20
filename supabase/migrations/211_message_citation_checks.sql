-- 211 — Phase 294 (DEC-03, D-13..D-17)
-- Table: public.message_citation_checks — one stored citation-check result per assistant message
--
-- WHAT. "Check citations" (Phase 294) asks a decision engine (Jev via OpenRouter, or OpenAI
-- Decisions) whether each cited claim in an assistant answer is supported by the passage it cites.
-- The result (a verdict + the engine's confidence per claim, version 1 of the wire shape in
-- backend/app/models/citation_check.py) is stored ONCE per message here. A re-check REPLACES the
-- row (INSERT … ON CONFLICT (message_id) DO UPDATE), and the POST answer is the RETURNING row, so
-- the live answer and a reload GET are the same object by construction.
--
-- WHY A TABLE, NOT A JSONB COLUMN ON public.messages (the 202 reasoning, re-checked):
--   * messages has REPLICA IDENTITY FULL and sits in the realtime publication, so every stored
--     verdict would be re-broadcast on every message row change;
--   * messages carries an owner UPDATE policy — a verdict column there would be CLIENT-WRITABLE,
--     so a user could forge "supported" from the browser (T-294-14);
--   * the messages writer path (db/runs.py insert_assistant_message) has inherited-failing tests.
--
-- VISIBILITY. Exactly the parent message's: ONE SELECT policy whose predicate is the messages
-- SELECT predicate verbatim (full-schema.sql "Users can view their own messages"). There is NO
-- client write path — no INSERT/UPDATE/DELETE policy, and anon and authenticated hold no write privilege.
-- The backend writes through the asyncpg pool, which connects as postgres and BYPASSES RLS, so
-- backend/app/services/citation_check_service.py binds message_id / thread_id / user_id / org_id
-- from the message row the user-JWT client could read — never from the request.
--
-- NOT in the realtime publication: the UI reads checks with one batched GET per thread view.
--
-- The engine CHECK equals backend/app/models/citation_check.py's CheckEngineId
-- (test_294_citation_claims asserts it).
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Locally: backend/venv/Scripts/python scripts/apply_migration_211.py (127.0.0.1 only).
-- Then: bash scripts/regenerate-full-schema.sh (no --reset).
-- ⚠ PRODUCTION: apply BEFORE the backend that reads/writes this table deploys, then run
--   get_advisors(security) — a deploy-parity item.
-- ============================================================================

BEGIN;

-- ── 1. public.message_citation_checks ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_citation_checks (
    message_id   uuid PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
    thread_id    uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id       uuid NOT NULL,
    engine       text NOT NULL CHECK (engine IN ('jev', 'openai_decisions')),
    model        text NOT NULL,
    result       jsonb NOT NULL,
    input_tokens integer,
    cost_usd     numeric,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.message_citation_checks IS
    'Stored citation-check result per assistant message (Phase 294, DEC-03). One row per message; a re-check replaces it. Visibility mirrors public.messages; written only by the backend pool.';
COMMENT ON COLUMN public.message_citation_checks.message_id IS
    'The assistant message that was checked. ON DELETE CASCADE.';
COMMENT ON COLUMN public.message_citation_checks.user_id IS
    'The message owner. Part of the RLS predicate (auth.uid() = user_id), as on messages.';
COMMENT ON COLUMN public.message_citation_checks.org_id IS
    'The tenancy boundary, bound from the message row; the autofill trigger stamps it when absent, exactly as messages.';
COMMENT ON COLUMN public.message_citation_checks.engine IS
    'The decision engine that ran the check. Must equal CheckEngineId in backend/app/models/citation_check.py.';
COMMENT ON COLUMN public.message_citation_checks.result IS
    'CitationCheckResult version 1: claims (ordinal, n, sentence, verdict, confidence), counts, usage. Never model-written prose.';
COMMENT ON COLUMN public.message_citation_checks.input_tokens IS
    'Engine input tokens summed over the check''s calls; NULL when unknown (never 0 for unknown).';
COMMENT ON COLUMN public.message_citation_checks.cost_usd IS
    'Engine cost in USD for the check, unquantised; NULL when unknown.';

CREATE INDEX IF NOT EXISTS idx_message_citation_checks_user
    ON public.message_citation_checks (user_id);

-- ── 2. Org autofill — exactly as public.messages has it ─────────────────────
DROP TRIGGER IF EXISTS message_citation_checks_autofill_org_id ON public.message_citation_checks;
CREATE TRIGGER message_citation_checks_autofill_org_id BEFORE INSERT ON public.message_citation_checks
    FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

-- ── 3. updated_at — the shared function (no new function, so no EXECUTE to revoke) ─
DROP TRIGGER IF EXISTS message_citation_checks_set_updated_at ON public.message_citation_checks;
CREATE TRIGGER message_citation_checks_set_updated_at BEFORE UPDATE ON public.message_citation_checks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. RLS + privileges: owners READ; only the backend writes ───────────────
ALTER TABLE public.message_citation_checks ENABLE ROW LEVEL SECURITY;

-- Default privileges gave anon/authenticated/service_role ALL on a new public table; take them
-- back (PUBLIC first — the CLAUDE.md trap), then grant only what is needed. service_role gets
-- UPDATE (a re-check replaces the row); no client role gets any write.
REVOKE ALL ON TABLE public.message_citation_checks FROM PUBLIC;
REVOKE ALL ON TABLE public.message_citation_checks FROM anon;
REVOKE ALL ON TABLE public.message_citation_checks FROM authenticated;
REVOKE ALL ON TABLE public.message_citation_checks FROM service_role;
GRANT SELECT ON TABLE public.message_citation_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_citation_checks TO service_role;

DROP POLICY IF EXISTS "Users can view their own citation checks" ON public.message_citation_checks;
CREATE POLICY "Users can view their own citation checks" ON public.message_citation_checks
    FOR SELECT TO authenticated
    USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));

-- There is NO INSERT / UPDATE / DELETE policy, on purpose: rows are written only by the backend
-- pool, and removed only by the message / thread / user cascades.

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('RLS enabled on message_citation_checks',
--      (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
--        where n.nspname = 'public' and c.relname = 'message_citation_checks')),
--     ('exactly one policy on message_citation_checks',
--      (select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'message_citation_checks')),
--     ('the one policy is SELECT',
--      (select bool_and(cmd = 'SELECT') from pg_policies where schemaname = 'public' and tablename = 'message_citation_checks')),
--     ('anon cannot SELECT',
--      not has_table_privilege('anon', 'public.message_citation_checks', 'SELECT')),
--     ('authenticated can SELECT',
--      has_table_privilege('authenticated', 'public.message_citation_checks', 'SELECT')),
--     ('authenticated cannot INSERT',
--      not has_table_privilege('authenticated', 'public.message_citation_checks', 'INSERT')),
--     ('authenticated cannot UPDATE',
--      not has_table_privilege('authenticated', 'public.message_citation_checks', 'UPDATE')),
--     ('authenticated cannot DELETE',
--      not has_table_privilege('authenticated', 'public.message_citation_checks', 'DELETE')),
--     ('service_role can UPDATE',
--      has_table_privilege('service_role', 'public.message_citation_checks', 'UPDATE')),
--     ('org autofill trigger present',
--      exists (select 1 from pg_trigger where tgname = 'message_citation_checks_autofill_org_id'
--              and tgrelid = 'public.message_citation_checks'::regclass and not tgisinternal)),
--     ('updated_at trigger present',
--      exists (select 1 from pg_trigger where tgname = 'message_citation_checks_set_updated_at'
--              and tgrelid = 'public.message_citation_checks'::regclass and not tgisinternal)),
--     ('not in supabase_realtime',
--      not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
--                  and schemaname = 'public' and tablename = 'message_citation_checks'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
