"""Phase 304-02 (KEY-02..KEY-06; D-02, D-08, D-09, D-18, D-35) — ``db/api_keys.py`` for MCP keys.

The SQL is the security property (the service-role pool is BYPASSRLS), so the assertions are
about the statements a stub pool captures:

  * the client projection gains ``kind, folder_ids, tools, include_external`` and still never
    carries ``key_hash``;
  * ``create_api_key`` binds the MCP fields as PLAIN lists (no ``json.dumps`` — the mig 123
    string-scalar trap) and the 293 call shape still works unchanged;
  * ``mcp_switches`` is ONE live SELECT keyed by the org (no settings cache, R-09);
  * every new statement is keyed by its owner (``org_id = $N`` or the org's own ``id = $1``).
"""

from __future__ import annotations

import pathlib
import re
from uuid import UUID

import pytest

from app.db import api_keys as db

ORG = UUID("44444444-4444-4444-8444-444444444444")
USER = UUID("33333333-3333-4333-8333-333333333333")
KEY = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
FOLDER = UUID("f0000000-0000-4000-8000-00000000000a")


class _Pool:
    def __init__(self, *, row=None, rows=None, value=None):
        self.calls: list[tuple[str, str, tuple]] = []
        self.row, self.rows, self.value = row, rows or [], value

    async def fetchrow(self, sql, *args):
        self.calls.append(("fetchrow", sql, args))
        return self.row

    async def fetch(self, sql, *args):
        self.calls.append(("fetch", sql, args))
        return self.rows

    async def fetchval(self, sql, *args):
        self.calls.append(("fetchval", sql, args))
        return self.value

    async def execute(self, sql, *args):
        self.calls.append(("execute", sql, args))
        return "UPDATE 1"


def _flat(sql: str) -> str:
    return " ".join(sql.split())


def test_the_projection_ends_with_the_four_mcp_columns_and_never_the_digest():
    assert db._KEY_COLUMN_NAMES[-4:] == ("kind", "folder_ids", "tools", "include_external")
    assert "key_hash" not in db._KEY_COLUMN_NAMES
    assert "key_hash" not in db._KEY_COLUMNS
    assert db._AUTH_COLUMNS.endswith(", key_hash")


async def test_create_binds_the_mcp_fields_as_plain_lists():
    pool = _Pool(row={"id": KEY})
    folders, tools = [str(FOLDER)], ["search_knowledge_base", "read_document"]
    await db.create_api_key(
        pool, org_id=ORG, user_id=USER, label="Claude", key_prefix="srl_mcp_abcd",
        key_hash="0" * 64, workflows=[], expires_at=None,
        kind="mcp", folder_ids=folders, tools=tools, include_external=True,
    )
    (_k, sql, args), = pool.calls
    flat = _flat(sql)
    assert flat.startswith("INSERT INTO api_keys")
    cols = re.search(r"\(([^)]*)\) VALUES", flat).group(1)
    assert [c.strip() for c in cols.split(",")] == [
        "org_id", "user_id", "label", "key_prefix", "key_hash", "workflows", "expires_at",
        "kind", "folder_ids", "tools", "include_external",
    ]
    assert "$11" in flat and "$12" not in flat
    assert args[7] == "mcp"
    assert args[8] == folders and isinstance(args[8], list)
    assert args[9] == tools and isinstance(args[9], list)
    assert args[10] is True
    assert "KEY_HASH" not in flat.upper().split("RETURNING", 1)[-1]


async def test_the_293_create_call_shape_still_makes_a_workflow_key():
    pool = _Pool(row={"id": KEY})
    await db.create_api_key(
        pool, org_id=ORG, user_id=USER, label="Zapier", key_prefix="srl_live_abcd",
        key_hash="0" * 64, workflows=[{"id": "w", "name": "W"}], expires_at=None,
    )
    (_k, _sql, args), = pool.calls
    assert args[7:] == ("workflow", None, None, False)


async def test_an_unnarrowed_mcp_key_binds_null_folders():
    pool = _Pool(row={"id": KEY})
    await db.create_api_key(
        pool, org_id=ORG, user_id=USER, label="Claude", key_prefix="srl_mcp_abcd",
        key_hash="0" * 64, workflows=[], expires_at=None, kind="mcp", tools=["read_document"],
    )
    (_k, _sql, args), = pool.calls
    assert args[8] is None


def test_there_is_no_json_import():
    src = pathlib.Path(db.__file__).read_text(encoding="utf-8")
    assert not re.search(r"^\s*(import json|from json)", src, re.M)
    assert "json.dumps" not in src


async def test_mcp_switches_is_one_live_select_keyed_by_the_org():
    pool = _Pool(row={"org_on": True, "deploy_on": False, "org_name": "Acme"})
    out = await db.mcp_switches(pool, ORG)
    assert out == {"org_on": True, "deploy_on": False, "org_name": "Acme"}
    (kind, sql, args), = pool.calls
    flat = _flat(sql)
    assert kind == "fetchrow"
    assert flat.upper().startswith("SELECT")
    assert "o.mcp_enabled AS org_on" in flat
    assert "app_settings" in flat and "'global'" in flat and "AS deploy_on" in flat
    assert "o.name AS org_name" in flat
    assert "o.id = $1" in flat
    assert args == (ORG,)


async def test_mcp_switches_is_none_for_a_missing_org():
    assert await db.mcp_switches(_Pool(row=None), ORG) is None


async def test_set_org_mcp_enabled_is_one_update_keyed_by_the_org():
    pool = _Pool(value=False)
    out = await db.set_org_mcp_enabled(pool, org_id=ORG, enabled=False)
    assert out is False
    (_k, sql, args), = pool.calls
    flat = _flat(sql)
    assert flat.startswith("UPDATE public.organizations SET mcp_enabled = $2")
    assert "updated_at = now()" in flat
    assert "WHERE id = $1" in flat
    assert flat.endswith("RETURNING mcp_enabled")
    assert args == (ORG, False)


async def test_set_org_mcp_enabled_is_none_for_a_missing_org():
    assert await db.set_org_mcp_enabled(_Pool(value=None), org_id=ORG, enabled=True) is None


async def test_get_key_row_is_by_id_with_an_org_predicate_and_no_digest():
    pool = _Pool(row={"id": KEY, "org_id": ORG})
    out = await db.get_key_row(pool, key_id=KEY, org_id=ORG)
    assert out == {"id": KEY, "org_id": ORG}
    (_k, sql, args), = pool.calls
    flat = _flat(sql)
    assert "WHERE id = $1 AND org_id = $2" in flat
    assert "key_hash" not in flat
    for column in ("revoked_at", "expires_at", "user_id", "kind"):
        assert column in flat
    assert args == (KEY, ORG)


async def test_get_key_row_is_none_for_a_miss():
    assert await db.get_key_row(_Pool(row=None), key_id=KEY, org_id=ORG) is None


async def test_folder_names_is_org_scoped():
    pool = _Pool(rows=[{"id": FOLDER, "name": "Contracts"}])
    out = await db.folder_names(pool, org_id=ORG, folder_ids=[str(FOLDER)])
    assert out == [{"id": FOLDER, "name": "Contracts"}]
    (_k, sql, args), = pool.calls
    flat = _flat(sql)
    assert "FROM folders" in flat
    assert "org_id = $1" in flat
    assert "id = ANY($2::uuid[])" in flat
    assert args == (ORG, [str(FOLDER)])


async def test_folder_names_of_nothing_never_queries():
    pool = _Pool()
    assert await db.folder_names(pool, org_id=ORG, folder_ids=[]) == []
    assert pool.calls == []


@pytest.mark.parametrize(
    "fn, kwargs",
    [
        ("mcp_switches", None),
        ("set_org_mcp_enabled", {"org_id": ORG, "enabled": True}),
        ("get_key_row", {"key_id": KEY, "org_id": ORG}),
        ("folder_names", {"org_id": ORG, "folder_ids": [str(FOLDER)]}),
    ],
)
async def test_every_new_statement_is_keyed_by_its_owner(fn, kwargs):
    pool = _Pool(row={"id": KEY}, rows=[], value=True)
    func = getattr(db, fn)
    if kwargs is None:
        await func(pool, ORG)
    else:
        await func(pool, **kwargs)
    (_k, sql, args), = pool.calls
    flat = _flat(sql)
    assert re.search(r"\b(o\.id|id|org_id)\s*=\s*\$\d", flat), flat
    assert ORG in args
