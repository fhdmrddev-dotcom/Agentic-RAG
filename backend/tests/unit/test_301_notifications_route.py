"""Phase 301 (301-01, NOTE-01 / NOTE-05; D-15 / D-27 / D-28 / T-301-01..06) — ``GET /notifications``.

One read-only question: which of MY workflow runs are waiting on me, across every org I belong to?

  * every route on ``notifications.router`` answers 401 + ``WWW-Authenticate: Bearer`` with no
    credential, and reads NOTHING (enumerated, so a later route inherits the same check);
  * the read runs on the shared asyncpg pool with ONE statement — ``LIST_OPEN_SQL`` — and the
    caller from the verified session bound as ``$1``, limit ``$2 = 50``;
  * the body is exactly ``{"notices": [...eight wire fields...], "total": int}``;
  * ``X-Org-Id`` is never consulted: the answer spans every member org (D-15);
  * the module carries no ``run_in_threadpool``, no active-org gate, no user connection, and the
    statement binds ``$1`` in BOTH the recipient predicate and the membership join, with the
    ``('active', 'paused')`` status wall and no question text (source scans).
"""
from __future__ import annotations

import importlib
import inspect
import io
import re
import tokenize
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

CALLER = "00000000-0000-0000-0000-000000000001"  # tests/conftest.py mock_user_data
WIRE_KEYS = {"id", "run_id", "org_id", "org_name", "workflow_name", "kind", "origin", "created_at"}


@pytest.fixture
def mod():
    # Imported per test so a missing module fails each behaviour test on its own (RED).
    return importlib.import_module("app.api.notifications")


class _Recorder:
    def __init__(self, rows=None):
        self.calls: list = []
        self.rows = rows or []

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return self.rows

    async def fetchrow(self, sql, *args):  # pragma: no cover
        raise AssertionError("the list route issues exactly one fetch")

    async def fetchval(self, sql, *args):  # pragma: no cover
        raise AssertionError("the list route issues exactly one fetch")


def _install(monkeypatch, mod, rec: _Recorder):
    class _Pool:
        def acquire(self):
            @asynccontextmanager
            async def _cm():
                yield rec

            return _cm()

        async def fetch(self, sql, *args):
            return await rec.fetch(sql, *args)

    async def fake_pool():
        return _Pool()

    monkeypatch.setattr(mod, "get_pg_pool", fake_pool)


def _client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def _routes(mod):
    return [r for r in mod.router.routes if getattr(r, "methods", None)]


def _row(total: int, **over):
    base = {
        "id": uuid4(),
        "run_id": uuid4(),
        "org_id": uuid4(),
        "org_name": "Acme",
        "workflow_name": "Compliance Gap Report",
        "kind": "question",
        "origin": None,
        "created_at": datetime(2026, 10, 30, 9, 0, tzinfo=timezone.utc),
        "total": total,
    }
    base.update(over)
    return base


# ── §1 mounted, and refused without a bearer (D-15 / T-301-01) ──────────────────


def test_the_router_is_mounted(mod):
    from app.main import app

    mounted = {getattr(r, "path", None) for r in app.routes}
    assert "/notifications" in mounted
    assert {r.path for r in _routes(mod)} >= {"/notifications"}


def test_every_notifications_route_answers_401_without_a_bearer(mod, monkeypatch):
    from app.dependencies import get_current_user
    from app.main import app

    rec = _Recorder()
    _install(monkeypatch, mod, rec)
    routes = _routes(mod)
    assert len(routes) >= 1  # non-vacuity: the enumeration found the router's routes
    saved = app.dependency_overrides.pop(get_current_user, None)
    try:
        client = _client()
        for route in routes:
            path = re.sub(r"\{[^}]+\}", str(uuid4()), route.path)
            for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
                resp = client.request(method, path, headers={"X-Org-Id": str(uuid4())})
                assert resp.status_code == 401, f"{method} {path} -> {resp.status_code}"
                assert resp.headers.get("www-authenticate") == "Bearer"
                assert resp.json() == {"detail": "Not authenticated"}
    finally:
        if saved is not None:
            app.dependency_overrides[get_current_user] = saved
    assert rec.calls == []


# ── §2 one statement on the pool, the caller as $1 (D-27 / T-301-02) ────────────


def test_the_list_runs_list_open_sql_with_the_caller_and_a_limit_of_50(mod, monkeypatch):
    db = importlib.import_module("app.db.notifications")
    rec = _Recorder(rows=[])
    _install(monkeypatch, mod, rec)
    resp = _client().get("/notifications", headers={"Authorization": "Bearer t"})
    assert resp.status_code == 200
    assert len(rec.calls) == 1
    sql, args = rec.calls[0]
    assert sql == db.LIST_OPEN_SQL
    assert args == (UUID(CALLER), 50)


def test_two_rows_answer_the_eight_wire_fields_and_the_server_total(mod, monkeypatch):
    rows = [
        _row(7, kind="question", origin="schedule", org_name="Acme"),
        _row(7, kind="approval", origin=None, org_name="Beta Ltd", workflow_name="Vendor check"),
    ]
    rec = _Recorder(rows=rows)
    _install(monkeypatch, mod, rec)
    resp = _client().get("/notifications", headers={"Authorization": "Bearer t"})
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"notices", "total"}
    assert body["total"] == 7
    assert len(body["notices"]) == 2
    for notice, row in zip(body["notices"], rows):
        assert set(notice) == WIRE_KEYS
        assert notice["id"] == str(row["id"])
        assert notice["run_id"] == str(row["run_id"])
        assert notice["org_id"] == str(row["org_id"])
        assert notice["org_name"] == row["org_name"]
        assert notice["workflow_name"] == row["workflow_name"]
        assert notice["kind"] == row["kind"]
        assert notice["origin"] == row["origin"]
        assert notice["created_at"].startswith("2026-10-30T09:00:00")


def test_no_rows_answer_an_empty_list_and_a_total_of_zero(mod, monkeypatch):
    rec = _Recorder(rows=[])
    _install(monkeypatch, mod, rec)
    resp = _client().get("/notifications", headers={"Authorization": "Bearer t"})
    assert resp.status_code == 200
    assert resp.json() == {"notices": [], "total": 0}


def test_the_org_header_is_never_consulted(mod, monkeypatch):
    """T-301-04: the answer spans every member org, so X-Org-Id changes nothing."""
    rec = _Recorder(rows=[])
    _install(monkeypatch, mod, rec)
    client = _client()
    a = client.get("/notifications", headers={"Authorization": "Bearer t"})
    b = client.get(
        "/notifications", headers={"Authorization": "Bearer t", "X-Org-Id": str(uuid4())}
    )
    assert a.status_code == b.status_code == 200 and a.content == b.content
    assert len(rec.calls) == 2
    assert rec.calls[0] == rec.calls[1]


# ── §3 source scans (D-27 / T-301-05 / T-301-06) ────────────────────────────────


def _code_only(source: str) -> str:
    out = []
    for tok in tokenize.generate_tokens(io.StringIO(source).readline):
        if tok.type in (tokenize.COMMENT, tokenize.STRING):
            continue
        out.append(tok.string)
    return " ".join(out)


def test_the_module_has_no_threadpool_no_active_org_gate_no_user_connection(mod):
    code = _code_only(inspect.getsource(mod))
    for name in ("run_in_threadpool", "get_active_org_id", "get_user_pg_connection"):
        assert name not in code, f"app.api.notifications uses {name}"


def test_the_statement_binds_the_caller_twice_and_walls_ended_runs():
    sql = importlib.import_module("app.db.notifications").LIST_OPEN_SQL
    for needle in ("$1", "n.recipient_id = $1", "m.user_id = $1", "closed_at IS NULL", "('active', 'paused')"):
        assert needle in sql, needle
    for forbidden in ("auth.uid()", "tool_call_id", "messages"):
        assert forbidden not in sql, forbidden
