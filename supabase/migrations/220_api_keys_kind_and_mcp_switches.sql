-- 220 — Phase 304 (KEY-02, KEY-03, KEY-06; D-03..D-09, D-35, D-36, D-37)
-- A second KIND of API key (a personal MCP key), its scope columns, and the two MCP switches.
--
-- WHAT. Four things, in this order:
--   1. public.api_keys gains kind ('workflow' | 'mcp', default 'workflow' so every existing row is
--      a workflow key, D-04), folder_ids (jsonb, NULL = not narrowed by folder), tools (jsonb, the
--      MCP tool names the key may call) and include_external (boolean, whether connector-fed
--      content is in scope). Five CHECKs hold the shape:
--        · api_keys_kind_check         — the two kinds;
--        · api_keys_workflows_check    — REPLACED (D-05): workflows is always an array, and has
--                                        >= 1 entry only on a workflow key (an MCP key starts none);
--        · api_keys_mcp_expiry_check   — an MCP key always expires (D-07);
--        · api_keys_folder_ids_check   — NULL or a NON-EMPTY array; an empty array would read as
--                                        "nothing" in one place and "everything" in another (D-08);
--        · api_keys_tools_check        — an MCP key names >= 1 tool, a workflow key names none;
--        · api_keys_scope_kind_check   — folder_ids / include_external are MCP-only.
--   2. The column grant to authenticated is re-issued with the four new columns. key_hash is still
--      never granted (D-09) — REVOKE ALL first (PUBLIC first, the CLAUDE.md trap), then the list.
--   3. workflow_runs_origin_kind_check gains 'mcp' (D-37 supersedes D-10). It is the ONLY origin
--      CHECK; threads and runs have no origin columns and 304 adds none (306 owns them). No writer
--      can produce 'mcp' yet: db/workflows._RUN_ORIGIN_KINDS still refuses it.
--   4. The two switches, both boolean NOT NULL DEFAULT true (D-03, D-35):
--        · app_settings.mcp_enabled   — the deployment switch; only writer PUT /admin/flags.
--        · organizations.mcp_enabled  — the per-org switch; only writer the org-admin route
--          PUT /org/api-keys/mcp-access. It is a dedicated column, NOT organizations.settings,
--          because settings is UPDATE-granted to authenticated (mig 194) and an org admin could
--          flip it through PostgREST with no audit row. A new column is outside that grant
--          automatically; this migration does NOT add it to the grant.
--
-- NO AUDIT LITERAL (D-36). Key lifecycle and refusals reuse the api_key.* types (mig 215) with
-- metadata.kind; the org switch writes settings.update. audit_log_action_type_check is not touched,
-- so the assert_action_types_synced boot hazard does not apply to this migration.
--
-- VISIBILITY. Unchanged: owners READ their own keys (one SELECT policy, mig 215) through the column
-- grant; there is no client write path. Members may READ organizations.mcp_enabled (table SELECT +
-- organizations_select) — the switch is not a secret (D-19) — and may not UPDATE it.
--
-- NOT A SEED (the 214/215 reasoning): both switch columns carry their default, so there is no
-- INSERT, no docs/OPERATOR.md Step-3 entry and no env var — deploy-artifact parity is unaffected.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset), and
--       backend/venv/Scripts/python scripts/check-migration-220-live.py.
-- ⚠ PRODUCTION: paste with Phase 305 (D-30), under per-action operator approval, BEFORE the
--   backend whose key routes write `kind` deploys; then run get_advisors(security) (D-33).
-- ============================================================================

BEGIN;

-- ── 1. api_keys kind + scope columns ────────────────────────────────────────
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'workflow';
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS folder_ids jsonb NULL;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS tools jsonb NULL;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS include_external boolean NOT NULL DEFAULT false;

ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_kind_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_kind_check CHECK (kind IN ('workflow', 'mcp'));

-- D-05: mig 215's inline CHECK is named api_keys_workflows_check (measured).
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_workflows_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_workflows_check CHECK (
    jsonb_typeof(workflows) = 'array'
    AND (kind <> 'workflow' OR jsonb_array_length(workflows) >= 1));

-- D-07
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_mcp_expiry_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_mcp_expiry_check CHECK (kind <> 'mcp' OR expires_at IS NOT NULL);

-- D-08: NULL = not narrowed by folder; an EMPTY array is refused.
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_folder_ids_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_folder_ids_check CHECK (
    folder_ids IS NULL
    OR (jsonb_typeof(folder_ids) = 'array' AND jsonb_array_length(folder_ids) >= 1));

ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_tools_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_tools_check CHECK (
    (kind = 'mcp' AND tools IS NOT NULL AND jsonb_typeof(tools) = 'array' AND jsonb_array_length(tools) >= 1)
    OR (kind = 'workflow' AND tools IS NULL));

ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_scope_kind_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_scope_kind_check CHECK (
    kind = 'mcp' OR (folder_ids IS NULL AND include_external = false));

COMMENT ON COLUMN public.api_keys.key_prefix IS
    'The prefix + 4 characters of the secret (srl_live_ or srl_mcp_), shown so a member can tell keys apart.';
COMMENT ON COLUMN public.api_keys.kind IS
    'Phase 304 (D-04). workflow = starts named published workflows (Phase 293); mcp = a personal MCP key that acts as its owner in one org.';
COMMENT ON COLUMN public.api_keys.folder_ids IS
    'Phase 304 (D-08). MCP keys only. NULL = every folder the owner can see in the org; otherwise a non-empty array of folder ids (each one''s subtree is in scope). Bound as a plain list, never json.dumps.';
COMMENT ON COLUMN public.api_keys.tools IS
    'Phase 304. MCP keys only: a non-empty array of tool names the key may call. NULL on a workflow key.';
COMMENT ON COLUMN public.api_keys.include_external IS
    'Phase 304 (D-23). MCP keys only: whether connector-fed documents (source_connection_id IS NOT NULL) are in scope.';

-- ── 2. D-09: the column grant, re-issued with the new columns — never key_hash ──
REVOKE ALL ON TABLE public.api_keys FROM PUBLIC;
REVOKE ALL ON TABLE public.api_keys FROM anon;
REVOKE ALL ON TABLE public.api_keys FROM authenticated;
REVOKE ALL ON TABLE public.api_keys FROM service_role;
GRANT SELECT (id, org_id, user_id, label, key_prefix, workflows, expires_at, revoked_at, revoked_by, last_used_at, created_at, kind, folder_ids, tools, include_external) ON TABLE public.api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_keys TO service_role;

-- ── 3. D-37: the only origin CHECK gains 'mcp' ──────────────────────────────
ALTER TABLE public.workflow_runs DROP CONSTRAINT IF EXISTS workflow_runs_origin_kind_check;
ALTER TABLE public.workflow_runs ADD CONSTRAINT workflow_runs_origin_kind_check
    CHECK (origin_kind IS NULL OR origin_kind IN ('app', 'schedule', 'key', 'mcp'));

-- ── 4. D-03 / D-35: the two MCP switches — schema, not a seed ───────────────
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS mcp_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS mcp_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.app_settings.mcp_enabled IS
    'Phase 304 (D-03, KEY-06). Deployment-wide MCP switch. Only writer: PUT /admin/flags (operator ledger). Read live on every MCP call, never through the 30 s settings cache.';
COMMENT ON COLUMN public.organizations.mcp_enabled IS
    'Phase 304 (D-35, KEY-06). Per-org MCP switch. Only writer: PUT /org/api-keys/mcp-access (org admin, audited as settings.update). Deliberately OUTSIDE the mig 194 client UPDATE grant.';

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('the four new api_keys columns exist',
--      (select count(*) = 4 from information_schema.columns where table_schema = 'public'
--        and table_name = 'api_keys' and column_name in ('kind', 'folder_ids', 'tools', 'include_external'))),
--     ('authenticated cannot SELECT api_keys.key_hash',
--      not has_column_privilege('authenticated', 'public.api_keys', 'key_hash', 'SELECT')),
--     ('authenticated can SELECT the new columns',
--      has_column_privilege('authenticated', 'public.api_keys', 'kind', 'SELECT')
--      and has_column_privilege('authenticated', 'public.api_keys', 'folder_ids', 'SELECT')
--      and has_column_privilege('authenticated', 'public.api_keys', 'tools', 'SELECT')
--      and has_column_privilege('authenticated', 'public.api_keys', 'include_external', 'SELECT')),
--     ('anon cannot SELECT any api_keys column',
--      not has_column_privilege('anon', 'public.api_keys', 'kind', 'SELECT')
--      and not has_column_privilege('anon', 'public.api_keys', 'id', 'SELECT')
--      and not has_table_privilege('anon', 'public.api_keys', 'SELECT')),
--     ('five 304 CHECKs present',
--      (select count(*) = 5 from pg_constraint where conrelid = 'public.api_keys'::regclass
--        and conname in ('api_keys_kind_check', 'api_keys_mcp_expiry_check', 'api_keys_folder_ids_check',
--                        'api_keys_tools_check', 'api_keys_scope_kind_check'))),
--     ('origin CHECK admits mcp',
--      (select position('''mcp''' in pg_get_constraintdef(oid)) > 0 from pg_constraint
--        where conname = 'workflow_runs_origin_kind_check')),
--     ('both switch columns exist',
--      exists (select 1 from information_schema.columns where table_schema = 'public'
--              and table_name = 'app_settings' and column_name = 'mcp_enabled')
--      and exists (select 1 from information_schema.columns where table_schema = 'public'
--              and table_name = 'organizations' and column_name = 'mcp_enabled')),
--     ('authenticated cannot UPDATE organizations.mcp_enabled',
--      not has_column_privilege('authenticated', 'public.organizations', 'mcp_enabled', 'UPDATE'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
