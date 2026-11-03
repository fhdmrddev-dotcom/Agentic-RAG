"""Phase 307-05 (D-08, D-51; T-307-29, T-307-30, T-307-28) — the operator's redirect-host allowlist.

``/admin/mcp-sign-in-hosts`` (``api/oauth_admin.py``): read, add, remove
``app_settings.mcp_oauth_redirect_hosts`` LIVE through asyncpg (never ``load_app_settings``).

* Operator only: the router-level ``require_operator`` (a non-operator reads the byte-identical
  admin 404, never a 200).
* The server validates every host (``validate_redirect_host``) and NEVER rewrites one: a scheme, a
  path, a port, ``*``, whitespace, uppercase, an IP literal, loopback (always allowed, so never
  listed) and a duplicate are each refused with a sentence.
* Each write is ONE SQL statement (no lost update between two operators) and writes ONE operator
  ledger row through ``operator_audit_floor``; a refused write writes none.
* Hidden from every OpenAPI document; included by ``register_mcp`` BEFORE the refuse-mount guard.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app import dependencies as deps


def _mod():
    from app.api import oauth_admin as m  # imported per test so RED is a failure, not a skip

    return m


# ── the pure validator ────────────────────────────────────────────────────────────────────────

VALID = ["claude.ai", "claude.com", "chat.example.co.uk", "xn--bcher-kva.example", "a-b.example.io",
         "x" * 63 + ".example"]


@pytest.mark.parametrize("host", VALID)
def test_a_valid_host_is_returned_unchanged(host):
    assert _mod().validate_redirect_host(host) == (host, None)


@pytest.mark.parametrize(
    "raw, needle",
    [
        ("", "host name"),
        ("https://claude.ai", "https://"),
        ("http://claude.ai", "https://"),
        ("claude.ai/callback", "path"),
        ("claude.ai:443", "port"),
        ("*.claude.ai", "Wildcards"),
        ("claude .ai", "spaces"),
        (" claude.ai", "spaces"),
        ("Claude.ai", "lowercase"),
        ("localhost", "always allowed"),
        ("127.0.0.1", "always allowed"),
        ("[::1]", "always allowed"),
        ("::1", "always allowed"),
        ("10.0.0.1", "IP address"),
        ("[2001:db8::1]", "IP address"),
        ("claude", "valid host name"),
        ("-claude.ai", "valid host name"),
        ("claude-.ai", "valid host name"),
        ("cla_ude.ai", "valid host name"),
        ("bücher.example", "valid host name"),
        ("x" * 64 + ".example", "valid host name"),
        (("a" * 60 + ".") * 5 + "io", "valid host name"),
    ],
)
def test_a_bad_host_is_refused_with_a_sentence(raw, needle):
    host, refusal = _mod().validate_redirect_host(raw)
    assert host is None
    assert refusal and needle in refusal
    assert refusal.endswith(".")


# ── the routes ────────────────────────────────────────────────────────────────────────────────


class _Hosts:
    def __init__(self):
        self.value = [{"host": "claude.ai"}, {"host": "claude.com"}]
        self.writes: list[tuple] = []

    async def get(self, pool):
        return [dict(e) for e in self.value]

    async def add(self, pool, *, host, added_by, added_by_name):
        self.writes.append(("add", host, added_by, added_by_name))
        if any(e["host"] == host for e in self.value):
            return None
        self.value = self.value + [{"host": host, "added_by": added_by, "added_by_name": added_by_name,
                                    "added_at": datetime(2026, 11, 4, tzinfo=timezone.utc).isoformat()}]
        return [dict(e) for e in self.value]

    async def remove(self, pool, *, host):
        self.writes.append(("remove", host))
        if not any(e["host"] == host for e in self.value):
            return None
        self.value = [e for e in self.value if e["host"] != host]
        return [dict(e) for e in self.value]


@pytest.fixture
def world(monkeypatch):
    m = _mod()
    hosts = _Hosts()
    monkeypatch.setattr(m.oauth_db, "get_redirect_hosts", hosts.get)
    monkeypatch.setattr(m.oauth_db, "add_redirect_host", hosts.add)
    monkeypatch.setattr(m.oauth_db, "remove_redirect_host", hosts.remove)
    recorded: list[dict] = []

    async def _write_operator_audit(**kw):
        recorded.append(kw)

    monkeypatch.setattr(deps, "write_operator_audit", _write_operator_audit)
    app = FastAPI()
    app.include_router(m.router)

    async def _operator(request: Request):
        op = {"id": "11111111-1111-4111-8111-111111111111", "email": "op@syrel.example"}
        request.state.operator = op
        return op

    async def _pool():
        return object()

    app.dependency_overrides[deps.require_operator] = _operator
    app.dependency_overrides[deps.get_supabase] = lambda: object()
    app.dependency_overrides[deps.get_pg_pool] = _pool
    return TestClient(app), hosts, recorded


def test_get_lists_hosts_in_stored_order_with_built_in_marked(world):
    client, hosts, recorded = world
    hosts.value.append({"host": "chat.example.com", "added_by": "u1", "added_by_name": "Ada",
                        "added_at": "2026-11-01T10:00:00+00:00"})
    r = client.get("/admin/mcp-sign-in-hosts")
    assert r.status_code == 200, r.text
    assert r.json() == {"hosts": [
        {"host": "claude.ai", "built_in": True, "added_by_name": None, "added_at": None},
        {"host": "claude.com", "built_in": True, "added_by_name": None, "added_at": None},
        {"host": "chat.example.com", "built_in": False, "added_by_name": "Ada",
         "added_at": "2026-11-01T10:00:00Z"},
    ]}
    assert recorded == []  # a read writes no ledger row


def test_add_appends_from_the_servers_answer_and_writes_one_ledger_row(world):
    client, hosts, recorded = world
    r = client.post("/admin/mcp-sign-in-hosts", json={"host": "chat.example.com"})
    assert r.status_code == 200, r.text
    assert [h["host"] for h in r.json()["hosts"]] == ["claude.ai", "claude.com", "chat.example.com"]
    added = r.json()["hosts"][-1]
    assert added["built_in"] is False and added["added_by_name"] == "op@syrel.example"
    (row,) = recorded
    assert row["action"] == "settings.mcp_sign_in_hosts.add"
    assert row["label"] == "Allowed AI tool sign-in to return to chat.example.com"
    assert row["is_write"] is True


@pytest.mark.parametrize("raw", ["https://chat.example.com", "Chat.example.com", "*.example.com", "localhost"])
def test_add_refuses_without_rewriting_and_writes_nothing(world, raw):
    client, hosts, recorded = world
    r = client.post("/admin/mcp-sign-in-hosts", json={"host": raw})
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str) and r.json()["detail"].endswith(".")
    assert hosts.writes == [] and recorded == []


def test_add_refuses_a_duplicate(world):
    client, hosts, recorded = world
    r = client.post("/admin/mcp-sign-in-hosts", json={"host": "claude.ai"})
    assert r.status_code == 422
    assert "already" in r.json()["detail"]
    assert recorded == []


def test_remove_takes_a_built_in_off_and_writes_one_ledger_row(world):
    client, hosts, recorded = world
    r = client.post("/admin/mcp-sign-in-hosts/remove", json={"host": "claude.com"})
    assert r.status_code == 200, r.text
    assert [h["host"] for h in r.json()["hosts"]] == ["claude.ai"]
    (row,) = recorded
    assert row["action"] == "settings.mcp_sign_in_hosts.remove"
    assert row["label"] == "Stopped AI tool sign-in returning to claude.com"


def test_the_empty_list_is_allowed(world):
    client, hosts, recorded = world
    client.post("/admin/mcp-sign-in-hosts/remove", json={"host": "claude.ai"})
    r = client.post("/admin/mcp-sign-in-hosts/remove", json={"host": "claude.com"})
    assert r.status_code == 200 and r.json() == {"hosts": []}


def test_remove_of_an_absent_host_is_404_and_writes_nothing(world):
    client, hosts, recorded = world
    r = client.post("/admin/mcp-sign-in-hosts/remove", json={"host": "nope.example"})
    assert r.status_code == 404
    assert recorded == []


def test_a_non_operator_never_reaches_the_routes(monkeypatch):
    m = _mod()
    app = FastAPI()
    app.include_router(m.router)

    async def _member(request: Request):
        return {"id": "22222222-2222-4222-8222-222222222222", "email": "m@x.co"}

    async def _not_op(uid):
        return False

    app.dependency_overrides[deps.authenticate_operator_request] = _member
    monkeypatch.setattr(deps, "is_operator", _not_op)
    called = []
    monkeypatch.setattr(m.oauth_db, "get_redirect_hosts", lambda pool: called.append(1))
    c = TestClient(app)
    assert c.get("/admin/mcp-sign-in-hosts").status_code == 404
    assert c.post("/admin/mcp-sign-in-hosts", json={"host": "x.example"}).status_code == 404
    assert c.post("/admin/mcp-sign-in-hosts/remove", json={"host": "claude.ai"}).status_code == 404
    assert called == []


def test_the_router_is_operator_gated_hidden_and_audited():
    m = _mod()
    assert any(d.dependency is deps.require_operator for d in m.router.dependencies)
    assert m.router.include_in_schema is False
    import inspect

    src = inspect.getsource(m)
    assert src.count("operator_audit_floor") >= 2
    assert "load_app_settings" not in src  # read live, never the 30 s cache


def test_register_mcp_includes_the_admin_router_even_without_a_public_base(monkeypatch):
    """It is operator policy: editable before BACKEND_PUBLIC_URL is set (the guard mounts nothing else)."""
    from app import mcp as mcp_pkg

    monkeypatch.setattr(mcp_pkg, "mcp_public_base", lambda: None)
    app = FastAPI()
    mcp_pkg.register_mcp(app)
    paths = {getattr(r, "path", None) for r in app.router.routes}
    assert "/admin/mcp-sign-in-hosts" in paths and "/admin/mcp-sign-in-hosts/remove" in paths
    assert "/mcp" not in paths and "/oauth/token" not in paths


# ── the SQL: one statement each ───────────────────────────────────────────────────────────────


class _Pool:
    def __init__(self, value=None):
        self.calls: list[tuple[str, tuple]] = []
        self.value = value

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return self.value


async def test_add_is_one_update_that_refuses_a_duplicate_in_sql():
    from app.db import oauth as db

    pool = _Pool(value=[{"host": "claude.ai"}, {"host": "x.example", "added_by": "u"}])
    out = await db.add_redirect_host(pool, host="x.example", added_by="u", added_by_name="Ada")
    ((sql, args),) = pool.calls
    assert sql.lstrip().upper().startswith("UPDATE PUBLIC.APP_SETTINGS")
    assert "mcp_oauth_redirect_hosts" in sql and "NOT EXISTS" in sql
    assert "id = 'global'" in sql
    assert args[0] == "x.example"
    assert out == [{"host": "claude.ai"}, {"host": "x.example", "added_by": "u"}]
    assert await db.add_redirect_host(_Pool(value=None), host="x", added_by="u", added_by_name="A") is None


async def test_remove_is_one_update():
    from app.db import oauth as db

    pool = _Pool(value=[])
    assert await db.remove_redirect_host(pool, host="claude.ai") == []
    ((sql, args),) = pool.calls
    assert sql.lstrip().upper().startswith("UPDATE PUBLIC.APP_SETTINGS")
    assert "EXISTS" in sql and args == ("claude.ai",)
    assert await db.remove_redirect_host(_Pool(value=None), host="x") is None
