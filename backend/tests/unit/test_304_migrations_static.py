"""Phase 304-01 — migrations 220 and 221, pinned against their TEXT (D-03..D-09, D-13, D-16, D-35..D-37, D-39, D-42).

Migration 220 gives ``public.api_keys`` a kind (``workflow`` | ``mcp``) and the MCP key's scope
columns, re-issues the column grant (``key_hash`` never named), widens the one run-origin CHECK with
``'mcp'`` (D-37) and adds the two MCP switches (``app_settings.mcp_enabled``,
``organizations.mcp_enabled``, D-35). It adds NO audit literal (D-36).

Migration 221 is narrowing only: ``current_user_org_ids()`` intersects membership with the
transaction-local GUC ``app.acting_org_id`` (D-13), and every membership reader that bypassed the
function is routed through it (``current_user_has_permission`` + six policies, D-39). It also takes
DELETE / TRUNCATE / TRIGGER / REFERENCES on ``public.organizations`` away from the client roles
(D-42, BUG-261030-03).

⚠ Assertions run over the SQL with ``--`` comments STRIPPED, so header prose can neither satisfy nor
break a structural assertion. The applied state is measured by ``scripts/check-migration-220-live.py``
/ ``-221-live.py`` and by ``tests/integration/test_304_acting_org_rls_live.py``.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
SUPPLEMENT = REPO_ROOT / "scripts" / "full-schema-supplement.sql"
LIVE_220 = REPO_ROOT / "scripts" / "check-migration-220-live.py"
LIVE_221 = REPO_ROOT / "scripts" / "check-migration-221-live.py"

CLIENT_COLUMNS_220 = (
    "id, org_id, user_id, label, key_prefix, workflows, expires_at, revoked_at, "
    "revoked_by, last_used_at, created_at, kind, folder_ids, tools, include_external"
)
SIX_POLICIES = (
    ("expert_bundles", "expert_bundles_read_policy"),
    ("expert_bundles", "expert_bundles_write_policy"),
    ("expert_grants", "expert_grants_read_policy"),
    ("expert_grants", "expert_grants_write_policy"),
    ("model_rates", "model_rates_select_policy"),
    ("model_rates", "model_rates_insert_policy"),
)
GUC_READ = "NULLIF(current_setting('app.acting_org_id', true), '')"


def _one(prefix: str, name: str) -> Path:
    matches = sorted(MIGRATIONS.glob(f"{prefix}_*.sql"))
    assert len(matches) == 1, f"expected exactly one {prefix}_*.sql migration, found {matches}"
    assert matches[0].name == name, matches[0].name
    return matches[0]


def _strip_comments(sql: str) -> str:
    out = []
    for line in sql.splitlines():
        idx = line.find("--")
        if idx != -1:
            line = line[:idx]
        if line.strip():
            out.append(line)
    return "\n".join(out)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _raw(prefix: str, name: str) -> str:
    return _one(prefix, name).read_text(encoding="utf-8")


def _flat220() -> str:
    return _norm(_strip_comments(_raw("220", "220_api_keys_kind_and_mcp_switches.sql")))


def _flat221() -> str:
    return _norm(_strip_comments(_raw("221", "221_acting_org_narrowing.sql")))


# ── 220 ────────────────────────────────────────────────────────────────────────


def test_220_adds_the_four_key_columns():
    flat = _flat220()
    for col in (
        "kind text NOT NULL DEFAULT 'workflow'",
        "folder_ids jsonb NULL",
        "tools jsonb NULL",
        "include_external boolean NOT NULL DEFAULT false",
    ):
        assert f"ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS {col}" in flat, col


def test_220_every_check_is_dropped_then_added():
    flat = _flat220()
    for name in (
        "api_keys_kind_check",
        "api_keys_workflows_check",
        "api_keys_mcp_expiry_check",
        "api_keys_folder_ids_check",
        "api_keys_tools_check",
        "api_keys_scope_kind_check",
    ):
        drop = flat.find(f"DROP CONSTRAINT IF EXISTS {name}")
        add = flat.find(f"ADD CONSTRAINT {name}")
        assert drop != -1 and add != -1, name
        assert drop < add, name


def test_220_check_bodies():
    flat = _flat220()
    assert "ADD CONSTRAINT api_keys_kind_check CHECK (kind IN ('workflow', 'mcp'))" in flat
    # D-05: workflows >= 1 only for a workflow key; still always an array.
    m = re.search(r"ADD CONSTRAINT api_keys_workflows_check CHECK \((.*?)\);", flat)
    assert m, "api_keys_workflows_check"
    body = m.group(1)
    assert "jsonb_typeof(workflows) = 'array'" in body
    assert "kind <> 'workflow' OR jsonb_array_length(workflows) >= 1" in body
    # D-07
    assert "ADD CONSTRAINT api_keys_mcp_expiry_check CHECK (kind <> 'mcp' OR expires_at IS NOT NULL)" in flat
    # D-08: NULL = not narrowed, empty refused
    m = re.search(r"ADD CONSTRAINT api_keys_folder_ids_check CHECK \((.*?)\);", flat)
    assert m and "folder_ids IS NULL" in m.group(1) and "jsonb_array_length(folder_ids) >= 1" in m.group(1)
    m = re.search(r"ADD CONSTRAINT api_keys_tools_check CHECK \((.*?)\);", flat)
    assert m, "api_keys_tools_check"
    assert "kind = 'mcp' AND tools IS NOT NULL" in m.group(1)
    assert "jsonb_array_length(tools) >= 1" in m.group(1)
    assert "kind = 'workflow' AND tools IS NULL" in m.group(1)
    m = re.search(r"ADD CONSTRAINT api_keys_scope_kind_check CHECK \((.*?)\);", flat)
    assert m, "api_keys_scope_kind_check"
    assert "kind = 'mcp' OR (folder_ids IS NULL AND include_external = false)" in m.group(1)


def test_220_column_grant_widened_and_never_key_hash():
    flat = _flat220()
    for role in ("PUBLIC", "anon", "authenticated", "service_role"):
        assert f"REVOKE ALL ON TABLE public.api_keys FROM {role};" in flat, role
    grants = re.findall(r"GRANT SELECT \(([^)]*)\) ON (?:TABLE )?public\.api_keys TO authenticated", flat)
    assert len(grants) == 1, grants
    cols = [c.strip() for c in grants[0].split(",")]
    assert "key_hash" not in cols
    assert ", ".join(cols) == CLIENT_COLUMNS_220
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_keys TO service_role;" in flat
    assert not re.search(r"GRANT [A-Z, ]*SELECT[A-Z, ]* ON (?:TABLE )?public\.api_keys TO (authenticated|anon)", flat)
    # No code line names key_hash at all (the grant never does; nothing else should).
    assert "key_hash" not in flat


def test_220_origin_check_gains_mcp_only():
    flat = _flat220()
    assert "DROP CONSTRAINT IF EXISTS workflow_runs_origin_kind_check" in flat
    assert "origin_kind IS NULL OR origin_kind IN ('app', 'schedule', 'key', 'mcp')" in flat
    # D-37: no threads / runs origin column in 304.
    assert not re.search(r"ALTER TABLE public\.(threads|runs) ", flat)


def test_220_both_switch_columns():
    flat = _flat220()
    assert "ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS mcp_enabled boolean NOT NULL DEFAULT true" in flat
    assert "ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS mcp_enabled boolean NOT NULL DEFAULT true" in flat
    # D-35: never added to mig 194's client UPDATE grant.
    assert not re.search(r"GRANT UPDATE \([^)]*mcp_enabled[^)]*\)", flat)


def test_220_adds_no_audit_literal():
    # D-36: the audit CHECK and the assert_action_types_synced lockstep are not touched.
    assert "audit_log_action_type_check" not in _flat220()


def test_220_is_one_transaction():
    flat = _flat220()
    assert flat.startswith("BEGIN;")
    assert flat.rstrip().endswith("COMMIT;")


# ── 221 ────────────────────────────────────────────────────────────────────────


def _function_block(flat: str, sig_head: str) -> str:
    start = flat.find(f"CREATE OR REPLACE FUNCTION {sig_head}")
    assert start != -1, sig_head
    end = flat.find("$function$;", start)
    assert end != -1, sig_head
    return flat[start:end + len("$function$;")]


def test_221_current_user_org_ids_keeps_every_attribute():
    block = _function_block(_flat221(), "public.current_user_org_ids()")
    assert "RETURNS SETOF uuid" in block
    assert "LANGUAGE sql" in block
    assert "STABLE SECURITY DEFINER" in block
    assert "SET search_path TO 'public'" in block
    for banned in ("VOLATILE", "plpgsql", "ROWS ", "COST ", "IMMUTABLE"):
        assert banned not in block, banned
    assert block.count(GUC_READ) == 2, block
    assert f"{GUC_READ} IS NULL" in block
    assert f"org_id = {GUC_READ}::uuid" in block
    assert "WHERE user_id = auth.uid()" in block


def test_221_current_user_has_permission_routes_through_the_function():
    block = _function_block(_flat221(), "public.current_user_has_permission(p_org_id uuid, p_permission_key text)")
    assert "RETURNS boolean" in block
    assert "LANGUAGE sql" in block
    assert "STABLE SECURITY DEFINER" in block
    assert "SET search_path TO 'public'" in block
    assert "m.org_id IN (SELECT public.current_user_org_ids())" in block
    # Every arm of the original kept.
    for arm in ("m.org_id = p_org_id", "m.user_id = auth.uid()", "rp.permission_key = p_permission_key"):
        assert arm in block, arm


def test_221_revoke_public_before_any_grant_after_each_function():
    flat = _flat221()
    for sig in ("public.current_user_org_ids()", "public.current_user_has_permission(uuid, text)"):
        public = flat.find(f"REVOKE EXECUTE ON FUNCTION {sig} FROM PUBLIC;")
        anon = flat.find(f"REVOKE EXECUTE ON FUNCTION {sig} FROM anon;")
        auth = flat.find(f"GRANT EXECUTE ON FUNCTION {sig} TO authenticated;")
        svc = flat.find(f"GRANT EXECUTE ON FUNCTION {sig} TO service_role;")
        assert -1 not in (public, anon, auth, svc), sig
        assert public < anon < auth < svc, sig
    # ...and each function's ACL block follows its own CREATE.
    org_fn = flat.find("CREATE OR REPLACE FUNCTION public.current_user_org_ids()")
    perm_fn = flat.find("CREATE OR REPLACE FUNCTION public.current_user_has_permission(")
    assert org_fn < flat.find("REVOKE EXECUTE ON FUNCTION public.current_user_org_ids() FROM PUBLIC;")
    assert perm_fn < flat.find("REVOKE EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) FROM PUBLIC;")


def _policy_body(flat: str, table: str, name: str) -> str:
    assert f'DROP POLICY IF EXISTS "{name}" ON public.{table};' in flat, name
    m = re.search(rf'CREATE POLICY "{name}" ON public\.{table} (.*?);', flat)
    assert m, name
    return m.group(1)


def test_221_all_six_policies_route_through_the_function():
    flat = _flat221()
    for table, name in SIX_POLICIES:
        body = _policy_body(flat, table, name)
        assert "public.current_user_org_ids()" in body, name
        if name == "model_rates_insert_policy":
            # The role arm must keep reading org_members (role is not in the function).
            assert body.count("org_members") == 1, body
            assert "m.role IN ('admin', 'owner')" in body
        else:
            assert "org_members" not in body, name


def test_221_policies_keep_their_command_and_roles():
    flat = _flat221()
    expected = {
        "expert_bundles_read_policy": "FOR SELECT TO authenticated, service_role",
        "expert_bundles_write_policy": "FOR ALL TO authenticated, service_role",
        "expert_grants_read_policy": "FOR SELECT TO authenticated, service_role",
        "expert_grants_write_policy": "FOR ALL TO authenticated, service_role",
        "model_rates_select_policy": "FOR SELECT TO authenticated, service_role",
        "model_rates_insert_policy": "FOR INSERT TO authenticated, service_role",
    }
    for table, name in SIX_POLICIES:
        assert _policy_body(flat, table, name).startswith(expected[name]), name


def test_221_organizations_revokes_public_first():
    flat = _flat221()
    stmts = [
        f"REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.organizations FROM {r};"
        for r in ("PUBLIC", "anon", "authenticated")
    ]
    at = [flat.find(s) for s in stmts]
    assert -1 not in at, at
    assert at[0] < at[1] < at[2]


def test_221_is_one_transaction_and_touches_no_switch():
    flat = _flat221()
    assert flat.startswith("BEGIN;")
    assert flat.rstrip().endswith("COMMIT;")
    assert "mcp_enabled" not in flat
    assert "audit_log_action_type_check" not in flat


# ── both ───────────────────────────────────────────────────────────────────────


def test_never_push_or_reset_except_the_never_line():
    for prefix, name in (("220", "220_api_keys_kind_and_mcp_switches.sql"), ("221", "221_acting_org_narrowing.sql")):
        hits = [ln for ln in _raw(prefix, name).splitlines() if re.search(r"db push|db reset", ln)]
        assert len(hits) == 1, (name, hits)
        assert "NEVER" in hits[0], (name, hits)


def test_headers_name_the_decisions_and_the_apply_order():
    raw220 = _raw("220", "220_api_keys_kind_and_mcp_switches.sql")
    raw221 = _raw("221", "221_acting_org_narrowing.sql")
    for needle in ("regenerate-full-schema.sh", "get_advisors(security)", "D-36"):
        assert needle in raw220, needle
    for needle in ("regenerate-full-schema.sh", "get_advisors(security)", "D-13", "D-16", "D-39", "D-42",
                   "evidence/explain-acting-org.txt"):
        assert needle in raw221, needle


def test_verify_blocks_cover_the_load_bearing_facts():
    raw220 = _raw("220", "220_api_keys_kind_and_mcp_switches.sql")
    v = raw220[raw220.find("VERIFY"):]
    for needle in (
        "has_column_privilege('authenticated', 'public.api_keys', 'key_hash', 'SELECT')",
        "has_column_privilege('authenticated', 'public.api_keys', 'include_external', 'SELECT')",
        "has_column_privilege('authenticated', 'public.organizations', 'mcp_enabled', 'UPDATE')",
        "'mcp'",
    ):
        assert needle in v, needle
    raw221 = _raw("221", "221_acting_org_narrowing.sql")
    v = raw221[raw221.find("VERIFY"):]
    for needle in ("app.acting_org_id", "has_function_privilege('anon', 'public.current_user_org_ids()', 'EXECUTE')",
                   "has_table_privilege('anon', 'public.organizations', 'DELETE')"):
        assert needle in v, needle


# ── the mirror (pg_dump --no-privileges carries no ACL) ────────────────────────


def test_supplement_mirrors_220_and_221():
    raw = SUPPLEMENT.read_text(encoding="utf-8")
    flat = _norm(_strip_comments(raw))
    assert "migration 220" in raw and "migration 221" in raw
    assert f"GRANT SELECT ({CLIENT_COLUMNS_220}) ON TABLE public.api_keys TO authenticated;" in flat
    for r in ("PUBLIC", "anon", "authenticated"):
        assert f"REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.organizations FROM {r};" in flat, r
    # 220's widened grant comes AFTER 215's original, so the bootstrap ends on the superset.
    assert flat.rfind(f"GRANT SELECT ({CLIENT_COLUMNS_220})") > flat.find("GRANT SELECT (id, org_id, user_id, label")


def test_live_checkers_exist_and_are_select_only():
    for path, verdict in ((LIVE_220, "220 live"), (LIVE_221, "221 live")):
        text = path.read_text(encoding="utf-8")
        assert verdict in text
        assert "postgres_dsn" in text
        code = "\n".join(ln for ln in text.splitlines() if not ln.lstrip().startswith("#"))
        code = re.sub(r'"""[\s\S]*?"""', "", code)
        for verb in ("INSERT ", "UPDATE ", "DELETE ", "ALTER ", "DROP ", "CREATE ", "GRANT ", "REVOKE ", "TRUNCATE "):
            # privilege NAMES may appear as has_*_privilege arguments, quoted
            stripped = re.sub(r"'[A-Z]+'", "''", code.upper())
            assert verb not in stripped, (path.name, verb)
