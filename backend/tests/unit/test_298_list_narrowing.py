"""Phase 298 (298-01, ORG-01..04 / D-01..D-06, D-32) — every named list follows the active org.

WHAT THIS PINS. A two-org user's lists are per-org: with ``X-Org-Id = A`` the folder tree, the
Root and every non-folder read of ``GET /documents``, the summary, the chat history and the run
log answer about org A only. Without an org (no header, or one naming an org the caller is NOT a
member of) every one of them is BYTE-IDENTICAL to today — never a 400, never an empty set (D-03).

THE POLARITY IS THE WHOLE POINT, and it is asymmetric on purpose:
  * an org resolved      -> the route adds ONE predicate (or the folder seam gets ONE keyword);
  * no org resolved      -> NOTHING is added. Not ``restrict_org_ids=None``, not ``set()``.
    ``set()`` means "owned folders only" (the fail-closed authorizer polarity of
    ``threads._authorize_thread_folder``) and would silently hide every org-shared folder from a
    list route; ``restrict_org_ids=None`` would break the seam-contract rule that an
    unrestricted call is byte-identical on the wire (``harness/scope.py`` WR-05).

The one shared helper, ``fetch_visible_folders``, is NOT edited (D-02/D-06). Its source is pinned
by sha256 below, recorded from the base commit before any 298 code was written.

Every route is driven directly with a recording fake supabase and a stubbed resolver
(``app.services.org_lists.resolve_active_org_or_none``) — no database. The live two-org proof is
``tests/integration/test_298_two_org_lists_live.py``.
"""
from __future__ import annotations

import hashlib
import importlib
import inspect
from contextlib import asynccontextmanager
from types import SimpleNamespace
from uuid import UUID

import pytest

ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
USER = {"id": "11111111-1111-4111-8111-111111111111"}

#: sha256 of ``inspect.getsource(fetch_visible_folders)`` measured at the base commit
#: ``828d884b1`` (2026-10-28) BEFORE any Phase 298 code existed. D-02/D-06: the helper's body,
#: positional signature and ``restrict_org_ids`` default stay byte-identical. If this reds, the
#: list narrowing leaked into the shared helper — move it back to ``org_lists.py``.
FETCH_VISIBLE_FOLDERS_BASE_SHA256 = (
    "5c331f0875dadfc1e5f1d2753d9bc6ad71c0614d8ed24a0ec3ae6096e73bdbc7"
)


# ── fakes ──────────────────────────────────────────────────────────────────────


class _Rec:
    """A chainable supabase query builder that records every call, in order."""

    def __init__(self, log: list):
        self.log = log

    def __getattr__(self, name):
        def _call(*args, **kwargs):
            self.log.append((name, args, kwargs))
            return self

        return _call

    def execute(self):
        self.log.append(("execute", (), {}))
        return SimpleNamespace(data=[], count=0)


class FakeSupabase:
    def __init__(self):
        self.log: list = []

    def table(self, name):
        self.log.append(("table", (name,), {}))
        return _Rec(self.log)


def _req(org: str | None = None):
    headers = {"X-Org-Id": org} if org else {}
    return SimpleNamespace(headers=headers, state=SimpleNamespace())


@pytest.fixture
def org_lists():
    # Imported per test so a missing module fails each behaviour test on its own (RED).
    return importlib.import_module("app.services.org_lists")


def _stub_resolve(monkeypatch, value):
    calls: list = []

    async def fake(request, current_user):
        calls.append(request)
        return value

    monkeypatch.setattr("app.services.org_lists.resolve_active_org_or_none", fake)
    return calls


def _org_eqs(log):
    return [c for c in log if c[0] == "eq" and c[1] and c[1][0] == "org_id"]


# ── §1 the helpers ─────────────────────────────────────────────────────────────


async def test_folder_kw_is_empty_when_no_org_resolves(org_lists, monkeypatch):
    _stub_resolve(monkeypatch, None)
    assert await org_lists.folder_kw(_req(), USER) == {}


async def test_folder_kw_is_empty_for_a_falsy_org_never_set(org_lists, monkeypatch):
    _stub_resolve(monkeypatch, "")
    kw = await org_lists.folder_kw(_req(), USER)
    assert kw == {}
    assert "restrict_org_ids" not in kw


async def test_folder_kw_narrows_to_the_one_resolved_org(org_lists, monkeypatch):
    _stub_resolve(monkeypatch, ORG_A)
    assert await org_lists.folder_kw(_req(ORG_A), USER) == {"restrict_org_ids": {ORG_A}}


def test_by_org_without_an_org_returns_the_identical_query(org_lists):
    log: list = []
    q = _Rec(log)
    assert org_lists.by_org(q, None) is q
    assert log == []


def test_by_org_with_an_org_adds_exactly_one_predicate(org_lists):
    log: list = []
    org_lists.by_org(_Rec(log), ORG_A)
    assert log == [("eq", ("org_id", ORG_A), {})]


async def test_root_upload_org_is_none_for_a_foldered_upload_without_resolving(org_lists, monkeypatch):
    async def boom(request, current_user):  # pragma: no cover — must not be reached
        raise AssertionError("a foldered upload must not resolve the org (280-03 arm)")

    monkeypatch.setattr("app.services.org_lists.resolve_active_org_or_none", boom)
    assert await org_lists.root_upload_org(_req(ORG_A), USER, "f1") is None


@pytest.mark.parametrize("folder_id", [None, ""])
async def test_root_upload_org_is_the_active_org_for_a_root_upload(org_lists, monkeypatch, folder_id):
    _stub_resolve(monkeypatch, ORG_A)
    assert await org_lists.root_upload_org(_req(ORG_A), USER, folder_id) == ORG_A
    _stub_resolve(monkeypatch, None)
    assert await org_lists.root_upload_org(_req(), USER, folder_id) is None


async def test_active_org_uuid_is_a_uuid_or_none(org_lists, monkeypatch):
    _stub_resolve(monkeypatch, ORG_A)
    assert await org_lists.active_org_uuid(_req(ORG_A), USER) == UUID(ORG_A)
    _stub_resolve(monkeypatch, None)
    assert await org_lists.active_org_uuid(_req(), USER) is None


async def test_a_non_member_header_resolves_none_through_the_real_resolver(org_lists, monkeypatch):
    """D-03 through the REAL ``resolve_active_org_or_none``: the membership read finds no row, so
    the org is None and the folder keyword is empty — today's answer, never a 400."""
    class Conn:
        async def fetchrow(self, sql, *args):
            assert "org_members" in sql
            return None

    @asynccontextmanager
    async def fake_conn(request, current_user):
        yield Conn()

    monkeypatch.setattr("app.dependencies.get_user_pg_connection", fake_conn)
    assert await org_lists.active_org(_req(ORG_A), USER) is None
    assert await org_lists.folder_kw(_req(ORG_A), USER) == {}


async def test_a_malformed_header_resolves_none(org_lists):
    assert await org_lists.active_org(_req("not-a-uuid"), USER) is None


def test_org_lists_never_imports_the_400ing_gate(org_lists):
    src = inspect.getsource(org_lists)
    assert "get_active_org_id" not in src
    assert "resolve_active_org_or_none" in src


# ── §2 GET /folders and /folders/{id}/children ────────────────────────────────


def _record_fvf(monkeypatch):
    seen: list[dict] = []

    async def fake_fvf(supabase, user_id, **kwargs):
        seen.append(kwargs)
        return [
            {"id": "f1", "name": "b", "parent_id": None, "user_id": USER["id"], "is_org_shared": False},
            {"id": "f2", "name": "a", "parent_id": "f1", "user_id": USER["id"], "is_org_shared": False},
        ]

    monkeypatch.setattr("app.api.folders.fetch_visible_folders", fake_fvf)
    return seen


async def test_list_folders_forwards_the_org_restriction_under_a_header(org_lists, monkeypatch):
    from app.api import folders as folders_api

    seen = _record_fvf(monkeypatch)
    _stub_resolve(monkeypatch, ORG_A)
    out = await folders_api.list_folders(request=_req(ORG_A), current_user=USER, supabase=None)
    assert seen == [{"restrict_org_ids": {ORG_A}}]
    assert [f["id"] for f in out] == ["f2", "f1"]  # never post-filtered, only sorted


@pytest.mark.parametrize("header", [None, ORG_A])  # ORG_A here = a NON-member header -> None
async def test_list_folders_forwards_no_kwarg_without_a_resolved_org(org_lists, monkeypatch, header):
    from app.api import folders as folders_api

    seen = _record_fvf(monkeypatch)
    _stub_resolve(monkeypatch, None)
    await folders_api.list_folders(request=_req(header), current_user=USER, supabase=None)
    assert seen == [{}]


async def test_list_children_forwards_the_org_restriction_under_a_header(org_lists, monkeypatch):
    from app.api import folders as folders_api

    seen = _record_fvf(monkeypatch)
    _stub_resolve(monkeypatch, ORG_A)
    out = await folders_api.list_children(
        folder_id="f1", request=_req(ORG_A), current_user=USER, supabase=None
    )
    assert seen == [{"restrict_org_ids": {ORG_A}}]
    assert [f["id"] for f in out] == ["f2"]


async def test_list_children_forwards_no_kwarg_without_a_resolved_org(org_lists, monkeypatch):
    from app.api import folders as folders_api

    seen = _record_fvf(monkeypatch)
    _stub_resolve(monkeypatch, None)
    await folders_api.list_children(folder_id="f1", request=_req(), current_user=USER, supabase=None)
    assert seen == [{}]


# ── §3 GET /documents (D-32: every non-folder read AND a folder read) ──────────


async def _list_documents(request, folder_id=None, status_=None):
    from app.api import documents as documents_api

    sb = FakeSupabase()
    out = await documents_api.list_documents(
        limit=25, offset=0, folder_id=folder_id, include_archived=False, status_=status_,
        order="created_desc", kind=None, current_user=USER, supabase=sb, request=request,
    )
    return out, sb.log


@pytest.mark.parametrize(
    "folder_id,status_",
    [(None, None), ("root", None), (None, "in_flight"), ("22222222-2222-4222-8222-222222222222", None)],
)
async def test_list_documents_narrows_every_read_under_a_header(org_lists, monkeypatch, folder_id, status_):
    _stub_resolve(monkeypatch, ORG_A)
    out, log = await _list_documents(_req(ORG_A), folder_id, status_)
    assert out["documents"] == []
    assert _org_eqs(log) == [("eq", ("org_id", ORG_A), {})]


@pytest.mark.parametrize("folder_id", [None, "root"])
async def test_list_documents_adds_no_org_predicate_without_one(org_lists, monkeypatch, folder_id):
    _stub_resolve(monkeypatch, None)
    _out, log = await _list_documents(_req(), folder_id)
    assert _org_eqs(log) == []


# ── §4 GET /threads ────────────────────────────────────────────────────────────

_TODAY_THREADS_CHAIN = [
    ("table", ("threads",), {}),
    ("select", ("*",), {}),
    ("eq", ("user_id", USER["id"]), {}),
    ("eq", ("is_eval", False), {}),
    ("order", ("updated_at",), {"desc": True}),
    ("execute", (), {}),
]


async def test_list_threads_adds_the_org_before_the_order(org_lists, monkeypatch):
    from app.api import threads as threads_api

    _stub_resolve(monkeypatch, ORG_A)
    sb = FakeSupabase()
    await threads_api.list_threads(request=_req(ORG_A), current_user=USER, supabase=sb)
    expected = list(_TODAY_THREADS_CHAIN)
    expected.insert(4, ("eq", ("org_id", ORG_A), {}))
    assert sb.log == expected


async def test_list_threads_without_an_org_is_todays_chain(org_lists, monkeypatch):
    from app.api import threads as threads_api

    _stub_resolve(monkeypatch, None)
    sb = FakeSupabase()
    await threads_api.list_threads(request=_req(), current_user=USER, supabase=sb)
    assert sb.log == _TODAY_THREADS_CHAIN


# ── §5 GET /workflow-runs ──────────────────────────────────────────────────────


async def _list_runs(request):
    from app.api import workflow_runs as runs_api

    sb = FakeSupabase()
    out = await runs_api.list_workflow_runs(
        slug=None, limit=50, offset=0, current_user=USER, supabase=sb, request=request
    )
    return out, sb.log


async def test_list_workflow_runs_narrows_under_a_header(org_lists, monkeypatch):
    _stub_resolve(monkeypatch, ORG_A)
    out, log = await _list_runs(_req(ORG_A))
    assert out.runs == []
    assert _org_eqs(log) == [("eq", ("org_id", ORG_A), {})]


async def test_list_workflow_runs_without_an_org_adds_nothing(org_lists, monkeypatch):
    _stub_resolve(monkeypatch, None)
    _out, log = await _list_runs(_req())
    assert _org_eqs(log) == []


# ── §6 the shared helper is untouched ──────────────────────────────────────────


def test_fetch_visible_folders_source_is_byte_identical_to_base():
    from app.utils.folder_utils import fetch_visible_folders

    src = inspect.getsource(fetch_visible_folders)
    assert hashlib.sha256(src.encode("utf-8")).hexdigest() == FETCH_VISIBLE_FOLDERS_BASE_SHA256
