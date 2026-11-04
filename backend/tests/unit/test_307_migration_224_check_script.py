"""Phase 307 WR-07 — ``scripts/check-migration-224-live.py`` answers about the SCHEMA, never the data.

* D-08 lets an operator remove a built-in host (and the empty list is allowed), so a live
  ``app_settings('global')`` row without claude.ai is a legitimate state, not a missing migration.
* A non-dict entry in the live list must not crash the check.
* An auth failure (any ``asyncpg.PostgresError`` at connect) is a harness error (exit 2), never a
  traceback with exit 1, which reads as "migration missing".

The catalog is a fake connection answering every check as a live 224 would, so each case moves one
fact only.
"""
from __future__ import annotations

import asyncio
import importlib.util
import pathlib

import asyncpg
import pytest

REPO = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = REPO / "scripts" / "check-migration-224-live.py"
DEFAULT = '[{"host":"claude.ai"},{"host":"claude.com"}]'


def _load():
    spec = importlib.util.spec_from_file_location("check_migration_224_live", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class _Conn:
    def __init__(self, mod, live_hosts: str | None):
        self.mod = mod
        self.live_hosts = live_hosts

    async def fetchval(self, sql, *args):
        if "mcp_oauth_redirect_hosts::text" in sql:
            return self.live_hosts
        if "to_regclass" in sql or "relrowsecurity" in sql or "EXISTS (SELECT 1 FROM pg_indexes" in sql:
            return True
        if "FROM pg_policies" in sql:
            return 0
        if "has_table_privilege('service_role'" in sql:
            return True
        if "has_table_privilege(" in sql or "has_column_privilege(" in sql:
            return False
        if "count(*) FROM information_schema.columns" in sql:
            return 1
        if "conrelid = 'public.api_keys'" in sql:
            return "FOREIGN KEY (oauth_client_id) REFERENCES oauth_clients(id) ON DELETE RESTRICT"
        if "conrelid = 'public.oauth_tokens'" in sql:
            return ("FOREIGN KEY (grant_id) REFERENCES api_keys(id) ON DELETE CASCADE"
                    if "api_keys" in args[0] else
                    "FOREIGN KEY (replaced_by) REFERENCES oauth_tokens(id) ON DELETE SET NULL")
        if "WHERE conname = $1" in sql:
            return {
                "api_keys_oauth_kind_check": "CHECK ((oauth_client_id IS NULL) OR (kind = 'mcp'::text))",
                "app_settings_mcp_oauth_redirect_hosts_array":
                    "CHECK ((jsonb_typeof(mcp_oauth_redirect_hosts) = 'array'::text))",
            }[args[0]]
        if "api_keys_owner_label_active_uq" in sql:
            return ("CREATE UNIQUE INDEX api_keys_owner_label_active_uq ON public.api_keys USING btree "
                    "(org_id) WHERE ((revoked_at IS NULL) AND (oauth_client_id IS NULL))")
        if "api_keys_oauth_org_idx" in sql:
            return "CREATE INDEX api_keys_oauth_org_idx ON public.api_keys (org_id) WHERE (oauth_client_id IS NOT NULL)"
        raise AssertionError(f"unexpected fetchval: {sql}")

    async def fetch(self, sql, *args):
        return [{"column_name": c} for c in self.mod.TABLE_COLUMNS[args[0]]]

    async def fetchrow(self, sql, *args):
        return {"data_type": "jsonb", "is_nullable": "NO", "column_default": f"'{DEFAULT}'::jsonb"}

    async def close(self):
        return None


def _run(monkeypatch, live_hosts):
    mod = _load()
    monkeypatch.chdir(REPO / "backend")   # _check chdirs there; monkeypatch restores the cwd

    async def connect(dsn):
        return _Conn(mod, live_hosts)

    monkeypatch.setattr(asyncpg, "connect", connect)
    return asyncio.run(mod._check())


def test_a_live_224_with_the_default_hosts_is_live(monkeypatch):
    assert _run(monkeypatch, DEFAULT) == []


@pytest.mark.parametrize("live", ['[{"host":"claude.com"}]', "[]"])
def test_wr07_an_operator_removing_a_built_in_host_is_not_a_missing_migration(monkeypatch, live, capsys):
    assert _run(monkeypatch, live) == []
    assert "note:" in capsys.readouterr().out   # said, not failed


def test_wr07_a_non_dict_entry_does_not_crash_the_check(monkeypatch):
    assert _run(monkeypatch, '["claude.ai", {"host": "claude.com"}, 7]') == []


@pytest.mark.parametrize("exc", [
    asyncpg.InvalidPasswordError("password authentication failed"),
    asyncpg.InvalidCatalogNameError('database "x" does not exist'),
    ConnectionRefusedError(10061, "refused"),
])
def test_wr07_an_unreachable_or_refused_database_is_exit_2(monkeypatch, exc, capsys):
    mod = _load()

    async def boom():
        raise exc

    monkeypatch.setattr(mod, "_check", boom)
    assert mod.main() == 2
    assert "FATAL" in capsys.readouterr().out
