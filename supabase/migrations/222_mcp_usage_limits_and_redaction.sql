-- 222 — Phase 305 (MCP-01..07, KEY-07, GUARD-02, GUARD-03; D-39, D-40, D-54, D-55, D-56)
-- The MCP server's three pieces of schema: where an MCP call's spend is recorded, how many
-- searches a key may run per minute, and the per-org switch for PII redaction.
--
-- WHAT. Three things, in this order:
--   1. public.mcp_usage (D-55) — one row per embedding (or rerank) call an MCP tool makes, so the
--      spend page can show MCP traffic beside chat runs. A runs row cannot carry it: runs.thread_id
--      is NOT NULL with a cascade FK to threads (a thread per call would pollute history), runs has
--      no key column, and runs_select_own would expose the row to the member. Columns follow the
--      runs shape; user_id copies runs.user_id's FK (auth.users ON DELETE CASCADE) and org_id
--      copies runs.org_id, which has NO foreign key (measured in full-schema.sql), so neither does
--      this. api_key_id is SET NULL on key delete so spend survives a deleted key.
--      Deny-all to every client role: RLS on, NO policy, REVOKE ALL (PUBLIC first, the CLAUDE.md
--      trap), GRANT to service_role — the 218 notification_deliveries block, copied.
--   2. app_settings.api_key_searches_per_minute (D-54) — the "expensive" per-key bucket
--      (search_knowledge_base), DEFAULT 30, CHECK 1..120. Three bounds agree: this CHECK, the API's
--      400 (app/api/settings.py) and the UI clamp (ApiKeyLimits.tsx). The cheap bucket keeps
--      api_key_reads_per_minute (mig 215).
--   3. organizations.pii_redaction_enabled (D-36 / D-56) — boolean NOT NULL DEFAULT false, the
--      per-org switch for redacting what MCP tools return. Its only writer is
--      PUT /org/api-keys/pii-redaction (org admin, audited as settings.update + metadata.event
--      pii_redaction). A new column is outside mig 194's client UPDATE grant automatically; this
--      migration does NOT add it to that grant (the 220 mcp_enabled precedent).
--
-- NO AUDIT LITERAL (D-26 / D-53 / D-36). MCP calls reuse api_key.read / api_key.refused with
-- metadata.kind = 'mcp'; the switch writes settings.update. audit_log_action_type_check is not
-- touched, so the assert_action_types_synced boot hazard does not apply. No function is created,
-- so there is no SECURITY DEFINER surface either.
--
-- VISIBILITY. mcp_usage: nobody but the backend (service-role pool). Its only writer is
-- app/db/mcp_usage.py; its only reader is the per_root spend CTE (admin spend page, service role).
-- pii_redaction_enabled: members may READ it exactly as they read mcp_enabled (table SELECT +
-- organizations_select) and may not UPDATE it.
--
-- NOT A SEED — DEFAULTs only (the 214/215/220 reasoning): there is no INSERT, no docs/OPERATOR.md
-- Step-3 entry and no env var, so deploy-artifact parity is unaffected.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset), and
--       backend/venv/Scripts/python scripts/check-migration-222-live.py.
-- ⚠ PRODUCTION (D-40): paste 220 -> 221 -> 222, IN THAT ORDER, each under its own per-action
--   operator approval, BEFORE the 304+305 backend deploys; then run get_advisors(security).
--   Phase 305 does not deploy itself.
-- ============================================================================

BEGIN;

-- ── 1. D-55: public.mcp_usage — deny-all to every client role ───────────────
CREATE TABLE IF NOT EXISTS public.mcp_usage (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    api_key_id      uuid NULL REFERENCES public.api_keys(id) ON DELETE SET NULL,
    tool            text NOT NULL,
    model           text NOT NULL,
    provider        text NOT NULL,
    input_tokens    integer NULL,
    output_tokens   integer NOT NULL DEFAULT 0,
    status          text NOT NULL CHECK (status IN ('completed', 'failed')),
    started_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mcp_usage IS
    'Phase 305 (D-55, GUARD-02). One row per provider call an MCP tool makes (the embedding of a search, a rerank), so MCP spend joins the per_root spend CTE as a second leg. Only writer: app/db/mcp_usage.py (service-role pool). Only reader: the per_root spend CTE. Deny-all to every client role (RLS on, no policy).';
COMMENT ON COLUMN public.mcp_usage.input_tokens IS
    'Measured provider usage (prompt tokens). NULL = the provider returned none (honest unmeasured, never estimated).';

CREATE INDEX IF NOT EXISTS mcp_usage_org_started_idx
    ON public.mcp_usage (org_id, started_at);

ALTER TABLE public.mcp_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mcp_usage FROM PUBLIC;
REVOKE ALL ON TABLE public.mcp_usage FROM anon;
REVOKE ALL ON TABLE public.mcp_usage FROM authenticated;
REVOKE ALL ON TABLE public.mcp_usage FROM service_role;
GRANT ALL ON TABLE public.mcp_usage TO service_role;

-- No policy at all on mcp_usage: deny-all to clients (D-55).

-- ── 2. D-54: the expensive per-key bucket — schema, not a seed ──────────────
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS api_key_searches_per_minute integer NOT NULL DEFAULT 30;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_api_key_searches_per_minute_bound;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_api_key_searches_per_minute_bound
  CHECK (api_key_searches_per_minute >= 1 AND api_key_searches_per_minute <= 120);

COMMENT ON COLUMN public.app_settings.api_key_searches_per_minute IS
  'Phase 305 (D-54). Searches one MCP key may run per minute (the expensive bucket), counted in '
  'Redis across every worker. Default 30. Bounded 1..120 by three agreeing bounds: '
  'app_settings_api_key_searches_per_minute_bound, the API 400 (app/api/settings.py) and the UI clamp.';

-- ── 3. D-36 / D-56: the per-org PII redaction switch — schema, not a seed ───
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS pii_redaction_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.pii_redaction_enabled IS
    'Phase 305 (D-36, D-56, GUARD-03). Per-org switch: redact personal data from what MCP tools return. Only writer: PUT /org/api-keys/pii-redaction (org admin, audited as settings.update + metadata.event pii_redaction). Deliberately OUTSIDE the mig 194 client UPDATE grant.';

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('mcp_usage exists with RLS on',
--      (select relrowsecurity from pg_class where oid = 'public.mcp_usage'::regclass)),
--     ('mcp_usage has no policy',
--      (select count(*) = 0 from pg_policies where schemaname = 'public' and tablename = 'mcp_usage')),
--     ('no client role holds a privilege on mcp_usage',
--      not has_table_privilege('anon', 'public.mcp_usage', 'SELECT')
--      and not has_table_privilege('anon', 'public.mcp_usage', 'INSERT')
--      and not has_table_privilege('authenticated', 'public.mcp_usage', 'SELECT')
--      and not has_table_privilege('authenticated', 'public.mcp_usage', 'INSERT')
--      and not has_table_privilege('authenticated', 'public.mcp_usage', 'UPDATE')
--      and not has_table_privilege('authenticated', 'public.mcp_usage', 'DELETE')),
--     ('service_role writes mcp_usage',
--      has_table_privilege('service_role', 'public.mcp_usage', 'INSERT')),
--     ('the searches knob exists with its bound',
--      exists (select 1 from pg_constraint
--              where conname = 'app_settings_api_key_searches_per_minute_bound')),
--     ('pii_redaction_enabled exists, default false',
--      (select column_default = 'false' from information_schema.columns where table_schema = 'public'
--        and table_name = 'organizations' and column_name = 'pii_redaction_enabled')),
--     ('authenticated cannot UPDATE organizations.pii_redaction_enabled',
--      not has_column_privilege('authenticated', 'public.organizations', 'pii_redaction_enabled', 'UPDATE')),
--     ('anon cannot UPDATE organizations.pii_redaction_enabled',
--      not has_column_privilege('anon', 'public.organizations', 'pii_redaction_enabled', 'UPDATE'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
