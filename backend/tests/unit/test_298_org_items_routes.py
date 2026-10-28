"""Phase 298 (298-01, D-15 / D-16 / D-22 / D-36) — the two org reads the UI needs, without a DB.

``GET /org-items/elsewhere`` — for the caller's OWN items outside the active org, one row per OTHER
org the caller is a member of: the org's name and five counts (folders, Root documents with archived
excluded, non-global workflows, non-eval threads, runs). No active org resolved -> ``[]`` (nothing is
hidden when nothing is narrowed, and there is no "current" org to be "elsewhere" from).

``GET /org-items/folder-labels?ids=…`` — a name and an org name for each requested folder id the
caller can ALREADY see (the unrestricted ``fetch_visible_folders`` set, today's visibility). An id
the caller cannot see is omitted exactly like an id that does not exist (no existence oracle).
``ids`` is at most 50 strict UUIDs; anything else is a 422 for the whole request.

Every route on the router answers 401 with no bearer — enumerated from ``router.routes`` so the
routes later plans add to this router are covered by this same test.

The live two-org proof (and the ``anon`` read of the counts SQL) is
``tests/integration/test_298_two_org_lists_live.py``.
"""
from __future__ import annotations

import importlib
import re
from contextlib import asynccontextmanager
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
ORG_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
F1 = "11111111-1111-4111-8111-111111111111"
F2 = "22222222-2222-4222-8222-222222222222"
F3 = "33333333-3333-4333-8333-333333333333"
USER = {"id": "99999999-9999-4999-8999-999999999999"}


@pytest.fixture
def mod():
    # Imported per test so a missing module fails each behaviour test on its own (RED).
    return importlib.import_module("app.api.org_items")


def _req(org=None):
    return SimpleNamespace(headers={"X-Org-Id": org} if org else {}, state=SimpleNamespace())


def _stub_resolve(monkeypatch, value):
    async def fake(request, current_user):
        return value

    monkeypatch.setattr("app.services.org_lists.resolve_active_org_or_none", fake)


def _row(org_id, name, folders=0, root_documents=0, workflows=0, threads=0, runs=0):
    return {
        "org_id": UUID(org_id), "org_name": name, "folders": folders,
        "root_documents": root_documents, "workflows": workflows, "threads": threads, "runs": runs,
    }


# ── §1 the pure fold + the SQL's predicates ────────────────────────────────────


def test_fold_maps_rows_and_orders_by_name_then_id(mod):
    out = mod.fold_elsewhere_rows([
        _row(ORG_C, "Zeta", folders=1),
        _row(ORG_B, "Acme", folders=2, root_documents=3, workflows=4, threads=5, runs=6),
    ])
    assert [o.org_name for o in out.orgs] == ["Acme", "Zeta"]
    first = out.orgs[0].model_dump()
    assert first == {
        "org_id": ORG_B, "org_name": "Acme", "folders": 2, "root_documents": 3,
        "workflows": 4, "threads": 5, "runs": 6,
    }


def test_fold_of_nothing_is_an_empty_list(mod):
    assert mod.fold_elsewhere_rows([]).model_dump() == {"orgs": []}


def test_the_counts_sql_counts_only_the_callers_own_rows_in_member_orgs(mod):
    sql = re.sub(r"\s+", " ", mod.ELSEWHERE_SQL)
    # only orgs the caller is a member of, never the active one
    assert "JOIN public.org_members m ON m.org_id = o.id AND m.user_id = auth.uid()" in sql
    assert "WHERE o.id <> $1" in sql
    assert "ORDER BY o.name, o.id" in sql
    # the caller's OWN rows, with the lists' own predicates
    assert "f.org_id = o.id AND f.user_id = auth.uid()" in sql
    assert "d.org_id = o.id AND d.user_id = auth.uid() AND d.folder_id IS NULL" in sql
    assert "d.is_latest" in sql and "d.archived_at IS NULL" in sql  # D-36: archived excluded
    assert "w.org_id = o.id AND w.created_by = auth.uid() AND NOT w.is_system_global" in sql
    assert "t.org_id = o.id AND t.user_id = auth.uid() AND t.is_eval = false" in sql
    assert "r.org_id = o.id AND r.user_id = auth.uid()" in sql
    # never the 400-ing gate, always the caller's RLS connection
    src = importlib.import_module("inspect").getsource(mod)
    assert "get_active_org_id" not in src
    assert "get_user_pg_connection" in src


# ── §2 GET /org-items/elsewhere ────────────────────────────────────────────────


async def test_elsewhere_without_an_org_is_empty_and_reads_nothing(mod, monkeypatch):
    @asynccontextmanager
    async def boom(request, current_user):  # pragma: no cover — must not be reached
        raise AssertionError("no active org -> no query")
        yield

    monkeypatch.setattr(mod, "get_user_pg_connection", boom)
    _stub_resolve(monkeypatch, None)
    out = await mod.get_elsewhere_counts(request=_req(), current_user=USER)
    assert out.model_dump() == {"orgs": []}


async def test_elsewhere_with_an_org_binds_it_and_folds_the_rows(mod, monkeypatch):
    calls: list = []

    class Conn:
        async def fetch(self, sql, *args):
            calls.append((sql, args))
            return [_row(ORG_B, "Acme", folders=1, runs=2)]

    @asynccontextmanager
    async def fake_conn(request, current_user):
        assert current_user is USER
        yield Conn()

    monkeypatch.setattr(mod, "get_user_pg_connection", fake_conn)
    _stub_resolve(monkeypatch, ORG_A)
    out = await mod.get_elsewhere_counts(request=_req(ORG_A), current_user=USER)
    assert len(calls) == 1
    assert calls[0] == (mod.ELSEWHERE_SQL, (UUID(ORG_A),))
    assert [(o.org_id, o.folders, o.runs) for o in out.orgs] == [(ORG_B, 1, 2)]


# ── §3 GET /org-items/folder-labels ────────────────────────────────────────────


def test_parse_ids_empty_is_empty(mod):
    assert mod.parse_folder_ids(None) == []
    assert mod.parse_folder_ids("") == []
    assert mod.parse_folder_ids(" , ") == []


def test_parse_ids_dedupes_and_keeps_order(mod):
    assert mod.parse_folder_ids(f"{F2},{F1}, {F2}") == [F2, F1]


@pytest.mark.parametrize("raw", ["not-a-uuid", f"{F1},nope", F1.replace("-", ""), F1 + "0"])
def test_parse_ids_refuses_a_malformed_id_for_the_whole_request(mod, raw):
    with pytest.raises(HTTPException) as e:
        mod.parse_folder_ids(raw)
    assert e.value.status_code == 422


def test_parse_ids_refuses_more_than_fifty(mod):
    ids = ",".join(str(uuid4()) for _ in range(51))
    with pytest.raises(HTTPException) as e:
        mod.parse_folder_ids(ids)
    assert e.value.status_code == 422
    assert len(mod.parse_folder_ids(",".join(str(uuid4()) for _ in range(50)))) == 50


async def _drive_labels(mod, monkeypatch, ids, *, readable_orgs):
    seen_kwargs: list[dict] = []
    name_reads: list = []

    async def fake_fvf(supabase, user_id, **kwargs):
        seen_kwargs.append(kwargs)
        return [
            {"id": F1, "name": "Contracts", "org_id": ORG_A},
            {"id": F2, "name": "Tenders", "org_id": ORG_B},
        ]

    class Conn:
        async def fetch(self, sql, *args):
            name_reads.append((sql, args))
            return [{"id": UUID(o), "name": n} for o, n in readable_orgs.items()]

    @asynccontextmanager
    async def fake_conn(request, current_user):
        yield Conn()

    monkeypatch.setattr(mod, "fetch_visible_folders", fake_fvf)
    monkeypatch.setattr(mod, "get_user_pg_connection", fake_conn)
    out = await mod.get_folder_labels(
        request=_req(ORG_A), ids=ids, current_user=USER, supabase=object()
    )
    return out, seen_kwargs, name_reads


async def test_labels_name_only_visible_folders_with_a_readable_org(mod, monkeypatch):
    out, seen, reads = await _drive_labels(
        mod, monkeypatch, f"{F1},{F2},{F3}", readable_orgs={ORG_A: "Personal", ORG_B: "Acme"}
    )
    assert seen == [{}]  # UNRESTRICTED — today's visibility, nothing new revealed
    assert [label.model_dump() for label in out.labels] == [
        {"id": F1, "name": "Contracts", "org_id": ORG_A, "org_name": "Personal"},
        {"id": F2, "name": "Tenders", "org_id": ORG_B, "org_name": "Acme"},
    ]
    assert len(reads) == 1 and "public.organizations" in reads[0][0]


async def test_labels_omit_a_folder_whose_org_name_is_unreadable(mod, monkeypatch):
    out, _seen, _reads = await _drive_labels(
        mod, monkeypatch, f"{F2},{F1}", readable_orgs={ORG_A: "Personal"}
    )
    assert [label.id for label in out.labels] == [F1]


async def test_labels_for_no_ids_read_nothing(mod, monkeypatch):
    out, seen, reads = await _drive_labels(mod, monkeypatch, "", readable_orgs={})
    assert out.model_dump() == {"labels": []}
    assert seen == [] and reads == []


async def test_labels_for_only_invisible_ids_read_no_org_names(mod, monkeypatch):
    out, _seen, reads = await _drive_labels(mod, monkeypatch, F3, readable_orgs={ORG_A: "x"})
    assert out.model_dump() == {"labels": []}
    assert reads == []


# ── §4 mounted, and refused without a bearer (D-22) ───────────────────────────


def _paths(mod):
    return [r for r in mod.router.routes if getattr(r, "methods", None)]


def test_the_router_is_mounted_with_both_reads(mod):
    from app.main import app

    mounted = {getattr(r, "path", None) for r in app.routes}
    assert {"/org-items/elsewhere", "/org-items/folder-labels"} <= mounted
    assert {r.path for r in _paths(mod)} >= {"/org-items/elsewhere", "/org-items/folder-labels"}


def test_every_org_items_route_answers_401_without_a_bearer(mod):
    from fastapi.testclient import TestClient

    from app.dependencies import get_current_user
    from app.main import app

    routes = _paths(mod)
    assert len(routes) >= 2  # non-vacuity: the enumeration found the router's routes
    saved = app.dependency_overrides.pop(get_current_user, None)
    try:
        client = TestClient(app)
        for route in routes:
            path = re.sub(r"\{[^}]+\}", str(uuid4()), route.path)
            for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
                resp = client.request(method, path, headers={"X-Org-Id": ORG_A})
                assert resp.status_code == 401, f"{method} {path} -> {resp.status_code}"
                assert resp.headers.get("www-authenticate") == "Bearer"
    finally:
        if saved is not None:
            app.dependency_overrides[get_current_user] = saved
