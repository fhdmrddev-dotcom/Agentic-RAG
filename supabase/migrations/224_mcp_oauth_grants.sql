-- 224 — Phase 307 (OAUTH-05, OAUTH-06; D-33, D-15, D-53, D-08)
-- Sign in from Claude.ai and Claude Desktop: the schema an OAuth grant stands on.
--
-- WHAT. Five things, in this order:
--   1. public.oauth_clients — one row per OAuth client that has registered (DCR) or that we have
--      fetched a metadata document for (CIMD). client_id is the opaque DCR id or the CIMD https URL.
--      Deny-all to every client role: RLS on, NO policy, REVOKE ALL (PUBLIC first, the CLAUDE.md
--      trap), GRANT to service_role — the 222 mcp_usage block, copied.
--   2. api_keys.oauth_client_id (D-15) — a GRANT is an api_keys row of kind 'mcp' that names the
--      client it was approved for. The row's key_hash is the digest of a random secret nobody is
--      ever shown, so the grant can never be presented as a key. ON DELETE RESTRICT: a client a
--      grant still names cannot vanish under it. CHECK api_keys_oauth_kind_check pins grants to
--      kind 'mcp'. A partial index serves the connected-apps lists.
--   3. api_keys_owner_label_active_uq (D-53) — recreated under the SAME NAME (db/api_keys.py
--      catches it by name) with grants left out: approving Claude twice must not collide on the
--      label "Claude", while two personal keys with one label still do.
--   4. public.oauth_tokens — access and refresh tokens, sha256 hex digests only, each tied to its
--      grant (ON DELETE CASCADE) and to the resource it was issued for. replaced_by links a used
--      refresh token to its successor (the rotation chain). Deny-all, as 1.
--   5. app_settings.mcp_oauth_redirect_hosts (D-08) — the redirect-host allowlist, DEFAULT the two
--      built-in hosts claude.ai and claude.com. Read live by app/db/oauth.py.
--
-- NO AUDIT LITERAL (D-28). Grants reuse api_key.create / api_key.revoke / api_key.read /
-- api_key.refused with metadata.credential = 'oauth'. audit_log_action_type_check is not touched,
-- so the assert_action_types_synced boot hazard does not apply. No function is created, so there
-- is no definer-rights EXECUTE surface either.
--
-- VISIBILITY. oauth_clients, oauth_tokens: nobody but the backend (service-role pool). Their only
-- writer is app/db/oauth.py. api_keys.oauth_client_id is NOT added to the authenticated column
-- grant (mig 215 / 220): members read their grants through the backend, never through PostgREST.
--
-- NOT A SEED — DEFAULTs only (the 214/215/220/222 reasoning): there is no INSERT, no
-- docs/OPERATOR.md Step-3 entry and no env var (D-32), so deploy-artifact parity is unaffected.
--
-- Apply discipline (CLAUDE.md): paste into the local Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset), and
--       backend/venv/Scripts/python scripts/check-migration-224-live.py.
-- ⚠ PRODUCTION (D-33): paste 220 -> 221 -> 222 -> 223 -> 224, IN THAT ORDER, each under its own
--   per-action operator approval, BEFORE the 307 backend deploys; then run get_advisors(security).
--   Phase 307 does not deploy itself.
-- ============================================================================

BEGIN;

-- ── 1. public.oauth_clients — deny-all to every client role ─────────────────
CREATE TABLE IF NOT EXISTS public.oauth_clients (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           text NOT NULL UNIQUE CHECK (char_length(client_id) BETWEEN 1 AND 2048),
    kind                text NOT NULL CHECK (kind IN ('dcr', 'cimd')),
    client_name         text NULL CHECK (client_name IS NULL OR char_length(client_name) <= 200),
    client_uri          text NULL CHECK (client_uri IS NULL OR char_length(client_uri) <= 2048),
    redirect_uris       jsonb NOT NULL CHECK (jsonb_typeof(redirect_uris) = 'array' AND jsonb_array_length(redirect_uris) BETWEEN 1 AND 10),
    metadata_fetched_at timestamptz NULL,
    metadata_expires_at timestamptz NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    last_grant_at       timestamptz NULL
);

COMMENT ON TABLE public.oauth_clients IS
    'Phase 307 (D-33, OAUTH-05). One row per OAuth client: registered (dcr) or fetched from its metadata document (cimd, client_id = the https URL). Only writer: app/db/oauth.py (service-role pool). Deny-all to every client role (RLS on, no policy).';
COMMENT ON COLUMN public.oauth_clients.metadata_expires_at IS
    'CIMD only: when the cached metadata document must be fetched again (D-06). NULL for dcr.';
COMMENT ON COLUMN public.oauth_clients.last_grant_at IS
    'When a member last approved this client. NULL = never approved; an unused dcr row is pruned.';

ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.oauth_clients FROM PUBLIC;
REVOKE ALL ON TABLE public.oauth_clients FROM anon;
REVOKE ALL ON TABLE public.oauth_clients FROM authenticated;
REVOKE ALL ON TABLE public.oauth_clients FROM service_role;
GRANT ALL ON TABLE public.oauth_clients TO service_role;

-- No policy at all on oauth_clients: deny-all to clients (D-33).

-- ── 2. D-15: a grant is an api_keys row that names its client ───────────────
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS oauth_client_id uuid NULL REFERENCES public.oauth_clients(id) ON DELETE RESTRICT;

ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_oauth_kind_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_oauth_kind_check CHECK (oauth_client_id IS NULL OR kind = 'mcp');

CREATE INDEX IF NOT EXISTS api_keys_oauth_org_idx ON public.api_keys (org_id) WHERE oauth_client_id IS NOT NULL;

COMMENT ON COLUMN public.api_keys.oauth_client_id IS
    'Phase 307 (D-15). Set = this row is an OAuth GRANT approved for that client, not a personal key. Its key_hash is the digest of a random secret nobody is shown, and the resolver refuses it on the key path (wrong_kind). Read only by the backend: NOT in the authenticated column grant.';

-- ── 3. D-53: the label index, same NAME, grants left out ────────────────────
DROP INDEX IF EXISTS public.api_keys_owner_label_active_uq;
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_owner_label_active_uq ON public.api_keys (org_id, user_id, lower(btrim(label))) WHERE revoked_at IS NULL AND oauth_client_id IS NULL;

-- ── 4. public.oauth_tokens — deny-all to every client role ──────────────────
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id    uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('access', 'refresh')),
    token_hash  text NOT NULL UNIQUE,
    resource    text NOT NULL,
    expires_at  timestamptz NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    used_at     timestamptz NULL,
    replaced_by uuid NULL REFERENCES public.oauth_tokens(id) ON DELETE SET NULL,
    revoked_at  timestamptz NULL
);

COMMENT ON TABLE public.oauth_tokens IS
    'Phase 307 (D-17, D-19, D-46). OAuth access and refresh tokens as sha256 hex digests ONLY (never the token), each tied to its grant (api_keys row, cascade) and the resource it was issued for. Only writer: app/db/oauth.py (service-role pool). Deny-all to every client role (RLS on, no policy).';
COMMENT ON COLUMN public.oauth_tokens.replaced_by IS
    'A used refresh token''s successor (the rotation chain). A used token presented again outside the bounded grace revokes the whole grant (D-19).';

CREATE INDEX IF NOT EXISTS oauth_tokens_grant_idx ON public.oauth_tokens (grant_id);
CREATE INDEX IF NOT EXISTS oauth_tokens_replaced_by_idx ON public.oauth_tokens (replaced_by);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.oauth_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.oauth_tokens FROM anon;
REVOKE ALL ON TABLE public.oauth_tokens FROM authenticated;
REVOKE ALL ON TABLE public.oauth_tokens FROM service_role;
GRANT ALL ON TABLE public.oauth_tokens TO service_role;

-- No policy at all on oauth_tokens: deny-all to clients (D-33).

-- ── 5. D-08: the redirect-host allowlist — schema, not a seed ───────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS mcp_oauth_redirect_hosts jsonb NOT NULL DEFAULT '[{"host":"claude.ai"},{"host":"claude.com"}]'::jsonb;

ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_mcp_oauth_redirect_hosts_array;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_mcp_oauth_redirect_hosts_array CHECK (jsonb_typeof(mcp_oauth_redirect_hosts) = 'array');

COMMENT ON COLUMN public.app_settings.mcp_oauth_redirect_hosts IS
    'Phase 307 (D-08). Hosts an OAuth client may redirect to over https. Entries {host, added_by?, added_by_name?, added_at?}; entries without added_by are built in (claude.ai, claude.com). Read live by app/db/oauth.py, never through load_app_settings.';

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('oauth_clients exists with RLS on',
--      (select relrowsecurity from pg_class where oid = 'public.oauth_clients'::regclass)),
--     ('oauth_tokens exists with RLS on',
--      (select relrowsecurity from pg_class where oid = 'public.oauth_tokens'::regclass)),
--     ('neither new table has a policy',
--      (select count(*) = 0 from pg_policies where schemaname = 'public'
--        and tablename in ('oauth_clients', 'oauth_tokens'))),
--     ('no client role holds a privilege on the new tables',
--      not has_table_privilege('anon', 'public.oauth_clients', 'SELECT')
--      and not has_table_privilege('authenticated', 'public.oauth_clients', 'SELECT')
--      and not has_table_privilege('anon', 'public.oauth_tokens', 'SELECT')
--      and not has_table_privilege('authenticated', 'public.oauth_tokens', 'SELECT')),
--     ('service_role writes both',
--      has_table_privilege('service_role', 'public.oauth_clients', 'INSERT')
--      and has_table_privilege('service_role', 'public.oauth_tokens', 'INSERT')),
--     ('authenticated cannot read api_keys.oauth_client_id',
--      not has_column_privilege('authenticated', 'public.api_keys', 'oauth_client_id', 'SELECT')),
--     ('the label index leaves grants out',
--      (select indexdef like '%oauth_client_id IS NULL%' from pg_indexes
--        where indexname = 'api_keys_owner_label_active_uq')),
--     ('the allowlist column exists',
--      exists (select 1 from information_schema.columns where table_schema = 'public'
--        and table_name = 'app_settings' and column_name = 'mcp_oauth_redirect_hosts'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
