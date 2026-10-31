"""Phase 305-01 (D-39 / D-40 / D-54 / D-55 / D-56) — migration 222, read as text.

Pins the shape of ``supabase/migrations/222_mcp_usage_limits_and_redaction.sql`` without a
database: the deny-all ``mcp_usage`` table, the CHECK-bounded searches knob, the per-org
redaction column outside mig 194's UPDATE grant, and the things it must NOT carry (an audit
literal, a SECURITY DEFINER function, a client UPDATE grant on organizations). The live proof
is tests/integration/test_305_schema_privileges_live.py.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase"
    / "migrations"
    / "222_mcp_usage_limits_and_redaction.sql"
)


def _raw() -> str:
    assert MIGRATION.exists(), f"{MIGRATION.name} does not exist yet"
    return MIGRATION.read_text(encoding="utf-8")


def _code() -> str:
    """The SQL with every ``--`` comment line and trailing comment removed, whitespace collapsed."""
    lines = []
    for ln in _raw().splitlines():
        stripped = ln.split("--", 1)[0]
        if stripped.strip():
            lines.append(stripped)
    return re.sub(r"\s+", " ", " ".join(lines))


def _table_body() -> str:
    m = re.search(
        r"CREATE TABLE IF NOT EXISTS public\.mcp_usage \((.*?)\);", _code(), re.IGNORECASE
    )
    assert m, "CREATE TABLE IF NOT EXISTS public.mcp_usage (...) not found"
    return m.group(1)


def test_transaction_wrapped():
    code = _code()
    assert re.search(r"\bBEGIN;", code) and re.search(r"\bCOMMIT;", code)
    assert code.index("BEGIN;") < code.index("COMMIT;")


@pytest.mark.parametrize(
    "column_sql",
    [
        r"id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)",
        r"org_id uuid NOT NULL",
        r"user_id uuid NOT NULL",
        r"api_key_id uuid NULL REFERENCES public\.api_keys\(id\) ON DELETE SET NULL",
        r"tool text NOT NULL",
        r"model text NOT NULL",
        r"provider text NOT NULL",
        r"input_tokens integer NULL",
        r"output_tokens integer NOT NULL DEFAULT 0",
        r"status text NOT NULL CHECK \(status IN \('completed', 'failed'\)\)",
        r"started_at timestamptz NOT NULL DEFAULT now\(\)",
    ],
)
def test_mcp_usage_columns(column_sql):
    assert re.search(column_sql, _table_body(), re.IGNORECASE), column_sql


def test_mcp_usage_index_on_org_and_started_at():
    assert re.search(
        r"CREATE INDEX IF NOT EXISTS \w+ ON public\.mcp_usage \(org_id, started_at\)",
        _code(),
        re.IGNORECASE,
    )


def test_mcp_usage_is_deny_all_to_clients():
    code = _code()
    assert "ALTER TABLE public.mcp_usage ENABLE ROW LEVEL SECURITY;" in code
    for role in ("PUBLIC", "anon", "authenticated", "service_role"):
        assert f"REVOKE ALL ON TABLE public.mcp_usage FROM {role};" in code, role
    # PUBLIC is revoked first (the CLAUDE.md trap).
    assert code.index("REVOKE ALL ON TABLE public.mcp_usage FROM PUBLIC;") < code.index(
        "REVOKE ALL ON TABLE public.mcp_usage FROM anon;"
    )
    assert "GRANT ALL ON TABLE public.mcp_usage TO service_role;" in code
    assert not re.search(r"GRANT [^;]* ON TABLE public\.mcp_usage TO (anon|authenticated)", code)
    assert not re.search(r"CREATE POLICY [^;]* ON public\.mcp_usage", code, re.IGNORECASE)


def test_searches_knob_and_its_bound():
    code = _code()
    assert re.search(
        r"ADD COLUMN IF NOT EXISTS api_key_searches_per_minute integer NOT NULL DEFAULT 30",
        code,
    )
    assert "DROP CONSTRAINT IF EXISTS app_settings_api_key_searches_per_minute_bound" in code
    assert re.search(
        r"ADD CONSTRAINT app_settings_api_key_searches_per_minute_bound "
        r"CHECK \(api_key_searches_per_minute >= 1 AND api_key_searches_per_minute <= 120\)",
        code,
    )


def test_pii_redaction_column():
    assert re.search(
        r"ALTER TABLE public\.organizations ADD COLUMN IF NOT EXISTS pii_redaction_enabled "
        r"boolean NOT NULL DEFAULT false",
        _code(),
    )


def test_no_client_update_grant_on_organizations():
    assert not re.search(r"GRANT [^;]*UPDATE[^;]* ON (TABLE )?public\.organizations", _code(), re.IGNORECASE)


def test_no_audit_literal_and_no_security_definer():
    code = _code()
    assert "audit_log_action_type_check" not in code
    assert not re.search(r"security\s+definer", code, re.IGNORECASE)
    assert not re.search(r"CREATE (OR REPLACE )?FUNCTION", code, re.IGNORECASE)


def test_header_names_the_production_paste_order_and_advisors():
    raw = _raw()
    header = raw[: raw.index("BEGIN;")]
    assert re.search(r"220\s*->\s*221\s*->\s*222", header), "cloud paste order 220 -> 221 -> 222"
    assert "get_advisors(security)" in header
    assert "D-40" in header
    assert "regenerate-full-schema.sh" in header and "--reset" in header
