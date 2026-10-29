"""Phase 299 (299-01, D-06 / D-08 / D-11 / T-299-01 / T-299-06) — ``GET /links/{kind}/{id}``.

One read-only question: may the caller open this thread, workflow, run or Expert, and in which of
their orgs? Everything else is ONE answer — ``404 {"detail": "Not found"}``:

  * a malformed id, an unknown kind (or a wrongly-cased one) is that 404 with ZERO SQL calls;
  * a nonexistent id and an id the caller may not open take the SAME statement with the SAME
    arity, and come back with equal status, equal body bytes and equal headers once ``date`` is
    removed (no existence oracle);
  * thread + workflow run on ``get_user_pg_connection`` (RLS); run + Expert run on the pool with
    the caller bound as ``$2`` (planner corrections P1 / P2) — recording seams prove which;
  * no 401-less route: every route on ``links.router`` answers 401 + ``WWW-Authenticate: Bearer``
    without a credential (enumerated, so a later route is covered by this same test);
  * the module never imports the 400-ing active-org gate, the capability gate or the 403-ing
    visibility gate (source scan with comments stripped).
"""
from __future__ import annotations

import importlib
import inspect
import io
import re
import tokenize
from contextlib import asynccontextmanager
from uuid import UUID, uuid4

import pytest

ORG_A = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
CALLER = "00000000-0000-0000-0000-000000000001"  # tests/conftest.py mock_user_data
KINDS = ("thread", "workflow", "run", "expert")


@pytest.fixture
def mod():
    # Imported per test so a missing module fails each behaviour test on its own (RED).
    return importlib.import_module("app.api.links")


class _Recorder:
    """One fake connection shared by both seams; ``via`` records which seam handed it out."""

    def __init__(self, row=None):
        self.calls: list = []
        self.via: list = []
        self.row = row

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        return self.row

    async def fetch(self, sql, *args):  # pragma: no cover — the resolver never lists
        raise AssertionError("the resolver issues exactly one fetchrow")

    async def fetchval(self, sql, *args):  # pragma: no cover
        raise AssertionError("the resolver issues exactly one fetchrow")


def _install(monkeypatch, mod, rec: _Recorder):
    @asynccontextmanager
    async def fake_user_conn(request, current_user):
        rec.via.append("rls")
        yield rec

    class _Pool:
        def acquire(self):
            @asynccontextmanager
            async def _cm():
                rec.via.append("pool")
                yield rec

            return _cm()

        async def fetchrow(self, sql, *args):
            rec.via.append("pool")
            return await rec.fetchrow(sql, *args)

    async def fake_pool():
        return _Pool()

    monkeypatch.setattr(mod, "get_user_pg_connection", fake_user_conn)
    monkeypatch.setattr(mod, "get_pg_pool", fake_pool)


def _client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def _hdrs(resp):
    return {k: v for k, v in resp.headers.items() if k.lower() != "date"}


# ── §1 mounted, and refused without a bearer (D-11) ─────────────────────────────


def _routes(mod):
    return [r for r in mod.router.routes if getattr(r, "methods", None)]


def test_the_router_is_mounted(mod):
    from app.main import app

    mounted = {getattr(r, "path", None) for r in app.routes}
    assert "/links/{kind}/{item_id}" in mounted
    assert {r.path for r in _routes(mod)} >= {"/links/{kind}/{item_id}"}


def test_every_links_route_answers_401_without_a_bearer(mod, monkeypatch):
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
            path = route.path.replace("{kind}", "thread")
            path = re.sub(r"\{[^}]+\}", str(uuid4()), path)
            for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
                resp = client.request(method, path, headers={"X-Org-Id": str(ORG_A)})
                assert resp.status_code == 401, f"{method} {path} -> {resp.status_code}"
                assert resp.headers.get("www-authenticate") == "Bearer"
    finally:
        if saved is not None:
            app.dependency_overrides[get_current_user] = saved
    assert rec.calls == []


# ── §2 malformed input is the same 404 with zero SQL ────────────────────────────


@pytest.mark.parametrize(
    "path",
    [
        "/links/thread/not-a-uuid",
        f"/links/bogus/{uuid4()}",
        f"/links/THREAD/{uuid4()}",
        f"/links/run/{str(uuid4())[:-1]}",
        f"/links/expert/{uuid4()}x",
    ],
)
def test_malformed_input_is_the_one_404_and_reads_nothing(mod, monkeypatch, path):
    rec = _Recorder()
    _install(monkeypatch, mod, rec)
    resp = _client().get(path, headers={"Authorization": "Bearer t"})
    assert resp.status_code == 404
    assert resp.content == b'{"detail":"Not found"}'
    assert rec.calls == [] and rec.via == []


def test_the_not_found_body_is_one_constant(mod):
    assert mod.NOT_FOUND_DETAIL == "Not found"


# ── §3 missing and forbidden are indistinguishable (D-08) ───────────────────────


@pytest.mark.parametrize("kind", KINDS)
def test_missing_and_forbidden_take_one_statement_and_answer_identically(mod, monkeypatch, kind):
    """The fake returns None both times: once for an id that does not exist, once for an id the
    statement's predicate refuses. Same SQL text, same arity, same status/body/headers."""
    client = _client()
    answers = []
    for item in (uuid4(), uuid4()):  # "missing", "forbidden"
        rec = _Recorder(row=None)
        _install(monkeypatch, mod, rec)
        resp = client.get(f"/links/{kind}/{item}", headers={"Authorization": "Bearer t"})
        assert len(rec.calls) == 1
        sql, args = rec.calls[0]
        answers.append((sql, len(args), resp.status_code, resp.content, _hdrs(resp), rec.via))
        assert args[0] == item
    (s1, n1, st1, b1, h1, v1), (s2, n2, st2, b2, h2, v2) = answers
    assert s1 == s2 and n1 == n2
    assert st1 == st2 == 404
    assert b1 == b2 == b'{"detail":"Not found"}'
    assert h1 == h2
    assert v1 == v2


@pytest.mark.parametrize("kind", KINDS)
def test_each_kind_runs_on_its_connection_type(mod, monkeypatch, kind):
    from app.services import link_resolver

    rec = _Recorder(row=None)
    _install(monkeypatch, mod, rec)
    item = uuid4()
    _client().get(f"/links/{kind}/{item}", headers={"Authorization": "Bearer t"})
    if kind in link_resolver.POOL_KINDS:
        assert rec.via == ["pool"]
        assert rec.calls[0][1] == (item, UUID(CALLER))  # $2 = the caller, from the session
    else:
        assert rec.via == ["rls"]
        assert rec.calls[0][1] == (item,)
    assert rec.calls[0][0] == link_resolver.SQL_BY_KIND[kind]


def test_the_org_header_is_never_consulted(mod, monkeypatch):
    rec = _Recorder(row=None)
    _install(monkeypatch, mod, rec)
    item = uuid4()
    client = _client()
    a = client.get(f"/links/run/{item}", headers={"Authorization": "Bearer t"})
    b = client.get(
        f"/links/run/{item}", headers={"Authorization": "Bearer t", "X-Org-Id": "not-an-org"}
    )
    assert a.status_code == b.status_code == 404 and a.content == b.content
    assert rec.calls[0] == rec.calls[1]


# ── §4 a found row ──────────────────────────────────────────────────────────────


def test_a_found_thread_answers_its_target(mod, monkeypatch):
    item = uuid4()
    rec = _Recorder(row={"id": item, "title": "Q3 notes", "org_id": ORG_A, "org_name": "Acme"})
    _install(monkeypatch, mod, rec)
    resp = _client().get(f"/links/thread/{item}", headers={"Authorization": "Bearer t"})
    assert resp.status_code == 200
    assert resp.json() == {
        "kind": "thread", "id": str(item), "org_id": str(ORG_A), "org_name": "Acme",
        "title": "Q3 notes", "state": None, "audience": "only_you",
    }


def test_an_uppercase_uuid_is_accepted(mod, monkeypatch):
    item = uuid4()
    rec = _Recorder(row={"id": item, "title": "T", "org_id": ORG_A, "org_name": "Acme"})
    _install(monkeypatch, mod, rec)
    resp = _client().get(f"/links/thread/{str(item).upper()}", headers={"Authorization": "Bearer t"})
    assert resp.status_code == 200
    assert rec.calls[0][1] == (item,)


def test_a_found_global_workflow_has_no_org(mod, monkeypatch):
    item = uuid4()
    rec = _Recorder(row={"id": item, "title": "Starter", "status": "published",
                         "is_system_global": True, "org_id": ORG_A, "org_name": None})
    _install(monkeypatch, mod, rec)
    body = _client().get(f"/links/workflow/{item}", headers={"Authorization": "Bearer t"}).json()
    assert (body["org_id"], body["org_name"], body["state"], body["audience"]) == (
        None, None, "published", "everyone",
    )


# ── §5 the gates that would leak shape are absent (T-299-06) ────────────────────


def _code_only(source: str) -> str:
    out = []
    for tok in tokenize.generate_tokens(io.StringIO(source).readline):
        if tok.type in (tokenize.COMMENT, tokenize.STRING):
            continue
        out.append(tok.string)
    return " ".join(out)


def test_no_active_org_capability_or_visibility_gate_in_the_module(mod):
    from app.services import link_resolver

    for module in (mod, link_resolver):
        code = _code_only(inspect.getsource(module))
        for name in ("get_active_org_id", "require_capability", "require_visible"):
            assert name not in code, f"{module.__name__} uses {name}"
        assert "str(exc" not in code.replace(" ", "")


def test_no_422_or_403_leaves_the_route(mod):
    code = _code_only(inspect.getsource(mod))
    assert "HTTP_403" not in code and "HTTP_422" not in code
    assert "403" not in code and "422" not in code
