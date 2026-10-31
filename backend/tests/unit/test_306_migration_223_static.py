"""Phase 306-01 (D-31 / D-04 / D-35 / D-36 / T-306-08 / T-306-23 / T-306-26) — migration 223, as text.

Pins the shape of ``supabase/migrations/223_mcp_ask_run_and_admission.sql`` without a database:
the three ``threads.origin_*`` columns and their CHECK (now naming ``mcp``), the partial index on
an MCP origin, the freeze trigger (UPDATE keeps the old origin for every role; a client INSERT
gets none) with EXECUTE taken from PUBLIC first, and the four bounded ``app_settings`` knobs —
DEFAULTs only, never a seed row. The live proof is
``tests/integration/test_306_migration_223_live.py``.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
MIGRATION = MIGRATIONS / "223_mcp_ask_run_and_admission.sql"
SUPPLEMENT = REPO_ROOT / "scripts" / "full-schema-supplement.sql"

KNOBS = (
    # (column, default, low, high)
    ("mcp_ask_wait_seconds", 30, 5, 45),
    ("outside_inflight_per_key", 2, 1, 50),
    ("outside_inflight_per_org", 4, 1, 50),
    ("outside_inflight_per_provider", 6, 1, 50),
)
FN = "public.threads_origin_immutable()"


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


def test_file_name_is_cli_safe_and_unique():
    assert re.fullmatch(r"\d+_[a-z0-9_]+\.sql", MIGRATION.name)
    assert [p.name for p in MIGRATIONS.glob("223_*.sql")] == [MIGRATION.name]


def test_transaction_wrapped():
    code = _code()
    assert re.search(r"\bBEGIN;", code) and re.search(r"\bCOMMIT;", code)
    assert code.index("BEGIN;") < code.index("COMMIT;")


@pytest.mark.parametrize("col,typ", [
    ("origin_kind", "text"), ("origin_label", "text"), ("origin_ref", "uuid"),
])
def test_threads_origin_columns(col, typ):
    assert f"ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS {col} {typ};" in _code()


def test_origin_kind_check_names_exactly_the_four_kinds():
    code = _code()
    assert "ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS threads_origin_kind_check;" in code
    m = re.search(
        r"ADD CONSTRAINT threads_origin_kind_check CHECK \(origin_kind IS NULL OR origin_kind IN "
        r"\(([^)]*)\)\)",
        code,
    )
    assert m, "threads_origin_kind_check not found"
    kinds = re.findall(r"'([a-z]+)'", m.group(1))
    assert kinds == ["app", "schedule", "key", "mcp"]


def test_partial_index_on_an_mcp_origin():
    assert re.search(
        r"CREATE INDEX IF NOT EXISTS threads_mcp_origin_ref_idx ON public\.threads \(origin_ref\) "
        r"WHERE origin_kind = 'mcp';",
        _code(),
    )


def test_the_freeze_function():
    code = _code()
    m = re.search(
        r"CREATE OR REPLACE FUNCTION public\.threads_origin_immutable\(\) RETURNS trigger "
        r"LANGUAGE plpgsql SET search_path = '' AS \$fn\$(.*?)\$fn\$;",
        code,
    )
    assert m, "threads_origin_immutable() not found with SET search_path = ''"
    body = m.group(1)
    assert "IF TG_OP = 'UPDATE' THEN" in body
    for col in ("origin_kind", "origin_label", "origin_ref"):
        assert f"NEW.{col} := OLD.{col};" in body, col
        assert f"NEW.{col} := NULL;" in body, col
    assert "ELSIF current_user IN ('anon', 'authenticated') THEN" in body
    assert body.index("OLD.origin_kind") < body.index("ELSIF current_user")
    assert "RAISE" not in body.upper().replace("RAISE_", "")  # assign, never raise
    assert not re.search(r"security\s+definer", code, re.IGNORECASE)


@pytest.mark.parametrize("name,when", [
    ("threads_origin_freeze_update", "BEFORE UPDATE"),
    ("threads_origin_freeze_insert", "BEFORE INSERT"),
])
def test_triggers_are_idempotent(name, when):
    code = _code()
    drop = f"DROP TRIGGER IF EXISTS {name} ON public.threads;"
    create = (
        f"CREATE TRIGGER {name} {when} ON public.threads FOR EACH ROW EXECUTE FUNCTION {FN};"
    )
    assert drop in code and create in code
    assert code.index(drop) < code.index(create)


def test_execute_taken_from_public_first_then_granted_to_service_role():
    code = _code()
    lines = [
        f"REVOKE EXECUTE ON FUNCTION {FN} FROM PUBLIC;",
        f"REVOKE EXECUTE ON FUNCTION {FN} FROM anon;",
        f"REVOKE EXECUTE ON FUNCTION {FN} FROM authenticated;",
        f"GRANT EXECUTE ON FUNCTION {FN} TO service_role;",
    ]
    positions = [code.index(line) for line in lines]
    assert positions == sorted(positions)
    assert not re.search(rf"GRANT EXECUTE ON FUNCTION {re.escape(FN)} TO (anon|authenticated|PUBLIC)", code)


def test_supplement_mirrors_the_function_acl_once():
    text = SUPPLEMENT.read_text(encoding="utf-8")
    assert text.count(f"REVOKE EXECUTE ON FUNCTION {FN} FROM PUBLIC;") == 1
    assert text.count(f"GRANT EXECUTE ON FUNCTION {FN} TO service_role;") == 1
    assert "-- migration 223" in text


@pytest.mark.parametrize("col,default,low,high", KNOBS)
def test_app_settings_knob(col, default, low, high):
    code = _code()
    assert (
        f"ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS {col} integer NOT NULL "
        f"DEFAULT {default};"
    ) in code
    assert f"DROP CONSTRAINT IF EXISTS app_settings_{col}_bound;" in code
    assert (
        f"ADD CONSTRAINT app_settings_{col}_bound CHECK ({col} >= {low} AND {col} <= {high});"
    ) in code
    assert f"COMMENT ON COLUMN public.app_settings.{col} IS" in code


def test_defaults_only_never_a_seed_and_never_the_cli():
    raw = _raw()
    assert not re.search(r"INSERT INTO public\.app_settings", raw, re.IGNORECASE)
    assert not re.search(r"UPDATE public\.app_settings", _code(), re.IGNORECASE)
    assert not re.search(r"db (push|reset)", raw)


def test_no_audit_literal_and_no_table_grant_widening():
    code = _code()
    assert "audit_log_action_type_check" not in code
    assert not re.search(r"GRANT [^;]* ON (TABLE )?public\.threads", code, re.IGNORECASE)


def test_header_names_the_cloud_order_and_the_regen():
    raw = _raw()
    header = raw[: raw.index("BEGIN;")]
    assert re.search(r"220\s*->\s*221\s*->\s*222\s*->\s*223", header)
    assert "D-31" in header and "D-35" in header and "D-36" in header
    assert "NOT A SEED" in header
    assert "regenerate-full-schema.sh" in header and "--reset" in header
    assert "get_advisors(security)" in header
