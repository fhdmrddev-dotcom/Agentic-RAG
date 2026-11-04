"""Phase 308-01 — ``scripts/check-migration-225-live.py`` answers about the SCHEMA, one fact at a time.

The catalog is a fake connection answering every check as a live 225 would; each case moves ONE fact
and asserts the script names exactly that fact (exit 1). An unreachable / refusing database is a
harness error (exit 2), never "migration missing".
"""
from __future__ import annotations

import asyncio
import importlib.util
import pathlib

import asyncpg
import pytest

REPO = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = REPO / "scripts" / "check-migration-225-live.py"
NINE = [
    f"webhook.endpoint.{v}"
    for v in ("created", "updated", "deleted", "enabled", "disabled",
              "secret_rolled", "test_sent", "delivery_resent", "auto_disabled")
]


def _load():
    assert SCRIPT.exists(), f"{SCRIPT.name} does not exist yet"
    spec = importlib.util.spec_from_file_location("check_migration_225_live", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class _Conn:
    """A live-225 catalog. ``broken`` names the one fact this case moves."""

    def __init__(self, mod, broken: str | None = None):
        self.mod = mod
        self.broken = broken

    async def fetchval(self, sql, *args):
        b = self.broken
        if "to_regclass" in sql:
            return not (b == "missing_table" and "webhook_deliveries" in sql)
        if "to_regprocedure" in sql:
            return True
        if "relrowsecurity" in sql:
            return True
        if "FROM pg_policies" in sql:
            return 1 if (b == "policy" and args and args[0] == "webhook_endpoints") else 0
        if "has_table_privilege" in sql:
            role = args[0]
            if role == "service_role":
                return True
            return b == "client_priv" and role == "authenticated" and "webhook_events" in sql
        if "has_function_privilege" in sql:
            return b == "public_execute" and args[0] == "public" and "webhook_emit_run_event" in args[1]
        if "prosecdef" in sql:
            return True
        if "proconfig" in sql:
            return ['search_path=""']
        if "FROM pg_trigger" in sql:
            return 1
        if "is_nullable" in sql:
            return "YES"
        if "information_schema.columns" in sql:
            return 1
        if "contype = 'f'" in sql:
            return "FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id) ON DELETE CASCADE"
        if "FROM pg_indexes" in sql:
            return True
        if "WHERE conname = $1" in sql:
            return {
                "notifications_kind_check":
                    "CHECK ((kind = ANY (ARRAY['question'::text, 'approval'::text, 'webhook_disabled'::text])))",
                "notifications_closed_reason_check":
                    "CHECK (((closed_reason IS NULL) OR (closed_reason = ANY (ARRAY['answered'::text, "
                    "'run_ended'::text, 'endpoint_enabled'::text]))))",
                "notifications_kind_shape_check": "CHECK (((kind = ANY (...)) AND (run_id IS NOT NULL)))",
                "audit_log_action_type_check":
                    "CHECK ((action_type = ANY (ARRAY[" + ", ".join(f"'{t}'::text" for t in NINE) + "])))",
            }[args[0]]
        raise AssertionError(f"unexpected fetchval: {sql} {args}")

    async def fetch(self, sql, *args):
        return [{"column_name": c} for c in self.mod.TABLE_COLUMNS[args[0]]]

    async def close(self):
        return None


def _run(monkeypatch, broken=None):
    mod = _load()
    monkeypatch.chdir(REPO / "backend")

    async def connect(dsn):
        return _Conn(mod, broken)

    monkeypatch.setattr(asyncpg, "connect", connect)
    return asyncio.run(mod._check())


def test_a_live_225_is_live(monkeypatch, capsys):
    assert _run(monkeypatch) == []
    mod = _load()

    async def ok():
        return []

    monkeypatch.setattr(mod, "_check", ok)
    assert mod.main() == 0
    assert "225 live" in capsys.readouterr().out


@pytest.mark.parametrize(
    ("broken", "named"),
    [
        ("missing_table", "public.webhook_deliveries table"),
        ("client_priv", "authenticated holds"),
        ("policy", "webhook_endpoints must carry NO policy"),
        ("public_execute", "public may EXECUTE public.webhook_emit_run_event()"),
    ],
)
def test_one_moved_fact_is_named(monkeypatch, broken, named):
    missing = _run(monkeypatch, broken)
    assert missing, f"{broken}: the script passed"
    assert any(named in m for m in missing), missing


def test_a_missing_fact_exits_1(monkeypatch, capsys):
    mod = _load()

    async def some():
        return ["public.webhook_events table"]

    monkeypatch.setattr(mod, "_check", some)
    assert mod.main() == 1
    assert "NOT live" in capsys.readouterr().out


@pytest.mark.parametrize("exc", [
    asyncpg.InvalidPasswordError("password authentication failed"),
    ConnectionRefusedError(10061, "refused"),
])
def test_an_unreachable_database_is_exit_2(monkeypatch, exc, capsys):
    mod = _load()

    async def boom():
        raise exc

    monkeypatch.setattr(mod, "_check", boom)
    assert mod.main() == 2
    assert "FATAL" in capsys.readouterr().out
