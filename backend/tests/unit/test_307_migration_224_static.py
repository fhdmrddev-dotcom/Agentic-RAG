"""Phase 307-01 (D-33 / D-15 / D-53 / D-08) — migration 224, read as text.

Pins the shape of ``supabase/migrations/224_mcp_oauth_grants.sql`` without a database: the two
deny-all tables (``oauth_clients``, ``oauth_tokens``), the grant column on ``api_keys`` with its
kind CHECK and RESTRICT foreign key, the label index recreated under the SAME name with grants left
out, and the redirect-host allowlist column on ``app_settings`` — plus everything it must NOT carry
(a policy, a SECURITY DEFINER function, a widened ``authenticated`` column grant, a seed row). The
live proof is tests/integration/test_307_schema_privileges_live.py.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

MIGRATIONS = Path(__file__).resolve().parents[3] / "supabase" / "migrations"
MIGRATION = MIGRATIONS / "224_mcp_oauth_grants.sql"
NEW_TABLES = ("oauth_clients", "oauth_tokens")


def _raw() -> str:
    assert MIGRATION.exists(), f"{MIGRATION.name} does not exist yet"
    return MIGRATION.read_text(encoding="utf-8")


def _code() -> str:
    """The SQL with every ``--`` comment removed and whitespace collapsed."""
    lines = []
    for ln in _raw().splitlines():
        stripped = ln.split("--", 1)[0]
        if stripped.strip():
            lines.append(stripped)
    return re.sub(r"\s+", " ", " ".join(lines))


def _table_body(table: str) -> str:
    m = re.search(
        rf"CREATE TABLE IF NOT EXISTS public\.{table} \((.*?)\);", _code(), re.IGNORECASE
    )
    assert m, f"CREATE TABLE IF NOT EXISTS public.{table} (...) not found"
    return m.group(1)


def test_filename_is_digits_underscore_name():
    assert re.fullmatch(r"\d+_[a-z0-9_]+\.sql", MIGRATION.name)
    assert len([p for p in MIGRATIONS.glob("224_*.sql")]) == 1


def test_transaction_wrapped():
    code = _code()
    assert re.search(r"\bBEGIN;", code) and re.search(r"\bCOMMIT;", code)
    assert code.index("BEGIN;") < code.index("COMMIT;")


@pytest.mark.parametrize(
    "column_sql",
    [
        r"id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)",
        r"client_id text NOT NULL UNIQUE CHECK \(char_length\(client_id\) BETWEEN 1 AND 2048\)",
        r"kind text NOT NULL CHECK \(kind IN \('dcr', 'cimd'\)\)",
        r"client_name text NULL CHECK \(client_name IS NULL OR char_length\(client_name\) <= 200\)",
        r"client_uri text NULL CHECK \(client_uri IS NULL OR char_length\(client_uri\) <= 2048\)",
        r"redirect_uris jsonb NOT NULL CHECK \(jsonb_typeof\(redirect_uris\) = 'array' AND "
        r"jsonb_array_length\(redirect_uris\) BETWEEN 1 AND 10\)",
        r"metadata_fetched_at timestamptz NULL",
        r"metadata_expires_at timestamptz NULL",
        r"created_at timestamptz NOT NULL DEFAULT now\(\)",
        r"last_grant_at timestamptz NULL",
    ],
)
def test_oauth_clients_columns(column_sql):
    assert re.search(column_sql, _table_body("oauth_clients"), re.IGNORECASE), column_sql


@pytest.mark.parametrize(
    "column_sql",
    [
        r"id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)",
        r"grant_id uuid NOT NULL REFERENCES public\.api_keys\(id\) ON DELETE CASCADE",
        r"kind text NOT NULL CHECK \(kind IN \('access', 'refresh'\)\)",
        r"token_hash text NOT NULL UNIQUE",
        r"resource text NOT NULL",
        r"expires_at timestamptz NOT NULL",
        r"created_at timestamptz NOT NULL DEFAULT now\(\)",
        r"used_at timestamptz NULL",
        r"replaced_by uuid NULL REFERENCES public\.oauth_tokens\(id\) ON DELETE SET NULL",
        r"revoked_at timestamptz NULL",
    ],
)
def test_oauth_tokens_columns(column_sql):
    assert re.search(column_sql, _table_body("oauth_tokens"), re.IGNORECASE), column_sql


def test_oauth_tokens_indexes():
    code = _code()
    assert re.search(
        r"CREATE INDEX IF NOT EXISTS oauth_tokens_grant_idx ON public\.oauth_tokens \(grant_id\)", code
    )
    assert re.search(
        r"CREATE INDEX IF NOT EXISTS oauth_tokens_replaced_by_idx ON public\.oauth_tokens \(replaced_by\)",
        code,
    )


@pytest.mark.parametrize("table", NEW_TABLES)
def test_new_tables_are_deny_all_to_clients(table):
    code = _code()
    assert f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;" in code
    for role in ("PUBLIC", "anon", "authenticated", "service_role"):
        assert f"REVOKE ALL ON TABLE public.{table} FROM {role};" in code, role
    assert code.index(f"REVOKE ALL ON TABLE public.{table} FROM PUBLIC;") < code.index(
        f"REVOKE ALL ON TABLE public.{table} FROM anon;"
    )
    assert f"GRANT ALL ON TABLE public.{table} TO service_role;" in code
    assert not re.search(rf"GRANT [^;]* ON TABLE public\.{table} TO (anon|authenticated)", code)


def test_no_policy_and_no_security_definer():
    code = _code()
    assert not re.search(r"CREATE POLICY", code, re.IGNORECASE)
    assert not re.search(r"security\s+definer", _raw(), re.IGNORECASE)
    assert not re.search(r"CREATE (OR REPLACE )?FUNCTION", code, re.IGNORECASE)
    assert "audit_log_action_type_check" not in code


def test_grant_column_on_api_keys():
    code = _code()
    assert re.search(
        r"ALTER TABLE public\.api_keys ADD COLUMN IF NOT EXISTS oauth_client_id uuid NULL "
        r"REFERENCES public\.oauth_clients\(id\) ON DELETE RESTRICT",
        code,
    )
    assert "ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_oauth_kind_check;" in code
    assert re.search(
        r"ADD CONSTRAINT api_keys_oauth_kind_check CHECK \(oauth_client_id IS NULL OR kind = 'mcp'\)",
        code,
    )
    assert re.search(
        r"CREATE INDEX IF NOT EXISTS api_keys_oauth_org_idx ON public\.api_keys \(org_id\) "
        r"WHERE oauth_client_id IS NOT NULL",
        code,
    )
    # the clients table exists before the column that references it
    assert code.index("CREATE TABLE IF NOT EXISTS public.oauth_clients") < code.index(
        "ADD COLUMN IF NOT EXISTS oauth_client_id"
    )
    # and the column exists before the tokens table (which references api_keys) is created
    assert code.index("ADD COLUMN IF NOT EXISTS oauth_client_id") < code.index(
        "CREATE TABLE IF NOT EXISTS public.oauth_tokens"
    )


def test_label_index_recreated_under_the_same_name_without_grants():
    code = _code()
    assert code.count("api_keys_owner_label_active_uq") >= 2
    drop = code.index("DROP INDEX IF EXISTS public.api_keys_owner_label_active_uq;")
    create = re.search(
        r"CREATE UNIQUE INDEX (IF NOT EXISTS )?api_keys_owner_label_active_uq ON public\.api_keys "
        r"\(org_id, user_id, lower\(btrim\(label\)\)\) WHERE revoked_at IS NULL AND oauth_client_id IS NULL;",
        code,
    )
    assert create, "label index not recreated with the grant predicate"
    assert drop < create.start()


def test_redirect_host_allowlist_column():
    code = _code()
    assert re.search(
        r"ALTER TABLE public\.app_settings ADD COLUMN IF NOT EXISTS mcp_oauth_redirect_hosts jsonb "
        r"NOT NULL DEFAULT '\[\{\"host\": ?\"claude\.ai\"\}, ?\{\"host\": ?\"claude\.com\"\}\]'(::jsonb)?",
        code,
    ), "allowlist column with the two built-in hosts"
    assert "DROP CONSTRAINT IF EXISTS app_settings_mcp_oauth_redirect_hosts_array" in code
    assert re.search(
        r"ADD CONSTRAINT app_settings_mcp_oauth_redirect_hosts_array "
        r"CHECK \(jsonb_typeof\(mcp_oauth_redirect_hosts\) = 'array'\)",
        code,
    )
    assert re.search(r"COMMENT ON COLUMN public\.app_settings\.mcp_oauth_redirect_hosts", code)


def test_no_seed_and_no_widened_column_grant():
    code = _code()
    assert not re.search(r"INSERT INTO (public\.)?app_settings", code, re.IGNORECASE)
    assert not re.search(r"GRANT [^;]*\([^)]*oauth_client_id[^)]*\)", code, re.IGNORECASE)
    assert not re.search(r"GRANT [^;]* ON TABLE public\.api_keys TO authenticated", code)


def test_header_names_the_production_order_and_never_push():
    raw = _raw()
    header = raw[: raw.index("BEGIN;")]
    assert re.search(r"220\s*->\s*221\s*->\s*222\s*->\s*223\s*->\s*224", header)
    assert "get_advisors(security)" in header
    for d in ("D-33", "D-15", "D-53", "D-08"):
        assert d in header, d
    assert "regenerate-full-schema.sh" in header and "--reset" in header
    assert "NO AUDIT LITERAL" in header and "NOT A SEED" in header
    # `db push` / `db reset` appear only in the NEVER sentence
    for ln in raw.splitlines():
        if re.search(r"db (push|reset)", ln):
            assert "NEVER" in ln, ln
