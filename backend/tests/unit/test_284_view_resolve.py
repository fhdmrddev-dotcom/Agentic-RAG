"""Phase 284 (284-04 Task 2 — FIX-11; D-10, R-02) — saved views and filters page; the agent keeps its path.

``document_view_resolver.resolve_filter`` serves two callers with opposite needs:

  * the ROUTES (``GET /document-views/{id}/resolve``, ``POST /document-views/resolve``) run on the
    caller's USER JWT and now opt in with ``via_view=True``: ONE ranged ``count="exact"`` read of
    migration 207's ``library_documents`` (``{documents, total, offset, limit}``), and a
    ``count_only`` that is ONE head read — so neither is cut near 1,000 any more;
  * the AGENT tool ``query_documents_by_view`` runs on the SERVICE ROLE, which reads ZERO rows from
    that view (``auth.uid()`` is NULL — fail-closed, R-02). It keeps the two caller-scoped legs
    (``via_view=False``, the default), now reading each leg top-N and an exact total from three
    ``count="exact"`` head reads (own + global − own-in-global-folders).

The agent's answer must not change (a change would owe the 8-row cross-provider UAT scoreboard), so
the PRE-284 algorithm is kept below as a test-local ORACLE, copied verbatim from PLAN_BASE
``0ae58d8bd`` (``backend/app/services/document_view_resolver.py``, ``resolve_filter``), and the tool's
JSON output is compared BYTE FOR BYTE against it for fixtures of ≤ 50 rows with distinct
``created_at``.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from tests.unit.test_271_search_core import (
    CALLER,
    G1,
    OTHER,
    VIEW,
    FakePostgrest,
    doc,
    patched,  # noqa: F401 — the shared seam-patching fixture
)


@pytest.fixture
def glob(patched, monkeypatch):
    """Patch the resolver's own ``get_globally_visible_folder_ids`` (the agent's two-leg path)."""
    import app.services.document_view_resolver as resolver

    async def _global(_supabase, _uid):
        return list(patched["global"])

    monkeypatch.setattr(resolver, "get_globally_visible_folder_ids", _global)
    return patched


def _empty():
    from app.models.document_view import ViewFilter

    return ViewFilter(op="and", conditions=[])


def _type_filter(value):
    from app.models.document_view import ViewCondition, ViewFilter

    return ViewFilter(op="and", conditions=[ViewCondition(field="document_type", op="eq", value=value)])


async def _resolve(client, **kw):
    from app.services.document_view_resolver import resolve_filter

    kw.setdefault("flt", _empty())
    kw.setdefault("folder_scope", None)
    kw.setdefault("count_only", False)
    return await resolve_filter(caller=CALLER, supabase=client, **kw)


def _rows(n, *, start=0, **kw):
    return [doc(f"d-{i:04d}", created_at=f"2024-01-01T{(i // 3600) % 24:02d}:{(i // 60) % 60:02d}:{i % 60:02d}+00:00",
                **kw) for i in range(start, start + n)]


# ─────────────────────────────── via_view=True (the routes) ───────────────────────────────


@pytest.mark.asyncio
async def test_the_route_strategy_is_one_ranged_read_of_the_view(glob):
    client = FakePostgrest({"documents": _rows(60)})
    out = await _resolve(client, via_view=True, offset=25, limit=25, include_archived=False)
    reads = [q for q in client.queries if q.table == VIEW]
    assert len(reads) == 1
    (read,) = reads
    assert read.count_mode == "exact"
    assert ("eq", "is_latest", True) in read.calls
    assert ("is_", "archived_at", "null") in read.calls
    assert read.orders == [("created_at", True, None), ("id", True, None)]
    assert read._range == (25, 49)
    assert "full_markdown" not in read.cols and read.cols != "*"
    assert [q for q in client.queries if q.table == "documents"] == []
    assert set(out) == {"documents", "total", "offset", "limit"}
    assert (out["total"], out["offset"], out["limit"]) == (60, 25, 25)
    assert [d["id"] for d in out["documents"]] == [f"d-{i:04d}" for i in range(34, 9, -1)]


@pytest.mark.asyncio
async def test_include_archived_true_keeps_archived_rows(glob):
    rows = _rows(3)
    rows[0]["archived_at"] = "2026-10-01T00:00:00+00:00"
    client = FakePostgrest({"documents": rows})
    shown = await _resolve(client, via_view=True, limit=25, include_archived=True)
    hidden = await _resolve(client, via_view=True, limit=25, include_archived=False)
    assert shown["total"] == 3 and hidden["total"] == 2


@pytest.mark.asyncio
async def test_the_route_count_only_is_one_head_read_and_exact_above_max_rows(glob):
    client = FakePostgrest({"documents": _rows(1500)}, max_rows=1000)
    out = await _resolve(client, via_view=True, count_only=True)
    assert out == {"total": 1500}  # the old count_only topped out near 1,000 per leg
    (read,) = [q for q in client.queries if q.table == VIEW]
    assert read.cols == "id" and read.count_mode == "exact" and read._limit == 1
    assert [q for q in client.queries if q.table == "documents"] == []


@pytest.mark.asyncio
async def test_the_route_strategy_walks_every_page_with_an_exact_total(glob):
    client = FakePostgrest({"documents": _rows(1500)}, max_rows=1000)
    seen: list[str] = []
    offset = 0
    while True:
        page = await _resolve(client, via_view=True, offset=offset, limit=200)
        assert page["total"] == 1500
        seen += [d["id"] for d in page["documents"]]
        offset += 200
        if offset >= page["total"]:
            break
    assert len(seen) == len(set(seen)) == 1500


@pytest.mark.asyncio
async def test_the_route_strategy_applies_the_fragment_walk(glob):
    rows = _rows(4)
    rows[1]["document_type_norm"] = "contract"
    rows[3]["document_type_norm"] = "contract"
    client = FakePostgrest({"documents": rows})
    out = await _resolve(client, flt=_type_filter("Contract"), via_view=True, limit=25)
    (read,) = [q for q in client.queries if q.table == VIEW]
    assert ("eq", "document_type_norm", "contract") in read.calls
    assert sorted(d["id"] for d in out["documents"]) == ["d-0001", "d-0003"]


# ─────────────────────────────── via_view=False (the agent) ───────────────────────────────


@pytest.mark.asyncio
async def test_the_agent_strategy_never_names_the_view(glob):
    glob["global"] = [G1]
    rows = _rows(10) + [doc("g", user_id=OTHER, folder_id=G1)]
    client = FakePostgrest({"documents": rows})
    await _resolve(client, count_only=True, retrievable_only=True)
    await _resolve(client, limit=5, retrievable_only=True)
    assert [q for q in client.queries if q.table == VIEW] == []


@pytest.mark.asyncio
async def test_the_agent_legs_read_top_n_and_the_total_is_exact(glob):
    glob["global"] = [G1]
    own = _rows(1200)
    mine_in_shared = doc("both", folder_id=G1, created_at="2030-01-01T00:00:00+00:00")
    theirs = [doc(f"t-{i:04d}", user_id=OTHER, folder_id=G1,
                  created_at=f"2025-06-01T00:{i // 60:02d}:{i % 60:02d}+00:00") for i in range(30)]
    client = FakePostgrest({"documents": own + [mine_in_shared] + theirs}, max_rows=1000)

    total = await _resolve(client, count_only=True)
    assert total == {"total": 1200 + 1 + 30}, "own + global − own-in-global, exact past max_rows"
    heads = [q for q in client.queries if q.count_mode == "exact"]
    assert len(heads) == 3 and all(q._limit == 1 and q.cols == "id" for q in heads)

    client.queries.clear()
    page = await _resolve(client, limit=20)
    legs = [q for q in client.queries if q.table == "documents" and q.cols == "*"]
    assert len(legs) == 2
    for q in legs:
        assert q.orders == [("created_at", True, None)]
        assert q._limit == 20
    ids = [d["id"] for d in page["documents"]]
    assert len(ids) == 20 and len(set(ids)) == 20
    assert ids[0] == "both" and ids[1:21] == [f"t-{i:04d}" for i in range(29, 10, -1)]


# ─────────────────────────────── the byte-identity oracle (PLAN_BASE) ───────────────────────────────


async def _pre284_resolve_filter(*, caller, flt, folder_scope, count_only, supabase, retrievable_only=False):
    """VERBATIM copy of ``resolve_filter`` at PLAN_BASE ``0ae58d8bd`` (docstring and comments trimmed;
    every executable line unchanged). The oracle the agent's answer is compared against."""
    import app.services.document_view_resolver as r

    fragments = await r.validate_and_compile(caller, flt, supabase)
    subtree = None
    if folder_scope:
        raw_subtree = await r.resolve_project_subtree(folder_scope, supabase=supabase, user_id=caller)
        if raw_subtree:
            visible_ids = {f["id"] for f in await r.fetch_visible_folders(supabase, caller)}
            reachable = [fid for fid in raw_subtree if fid in visible_ids]
            subtree = reachable or None

    def _apply(q):
        q = r.apply_fragments(q, fragments, subtree)
        return q.eq(r.RETRIEVABLE_COLUMN, True) if retrievable_only else q

    global_folder_ids = await r.get_globally_visible_folder_ids(supabase, caller)

    if count_only:
        own_ids = {
            d["id"]
            for d in (await r.aexec(_apply(
                supabase.table("documents").select("id")
                .eq("user_id", caller).eq("is_latest", True)
            ))).data or []
        }
        glob_ids: set[str] = set()
        if global_folder_ids:
            glob_ids = {
                d["id"]
                for d in (await r.aexec(_apply(
                    supabase.table("documents").select("id")
                    .in_("folder_id", global_folder_ids).eq("is_latest", True)
                ))).data or []
            }
        return {"total": len(own_ids | glob_ids)}

    own = _apply(
        supabase.table("documents")
        .select("*")
        .eq("user_id", caller)
        .eq("is_latest", True)
    )
    own_docs = (await r.aexec(own)).data or []

    global_docs: list[dict] = []
    if global_folder_ids:
        glob = _apply(
            supabase.table("documents")
            .select("*")
            .in_("folder_id", global_folder_ids)
            .eq("is_latest", True)
        )
        global_docs = (await r.aexec(glob)).data or []

    seen: set[str] = set()
    merged: list[dict] = []
    for d in own_docs + global_docs:
        if d["id"] not in seen:
            seen.add(d["id"])
            merged.append(d)
    merged.sort(key=lambda d: d["created_at"], reverse=True)
    return {"documents": merged, "total": len(merged)}


def _agent_fixture():
    """≤ 50 rows, distinct created_at, every leg exercised: own, a colleague's shared-folder rows,
    one OWN row inside the shared folder (the overlap), a hidden row, an older version, a
    non-retrievable row, and metadata the compact rows read."""
    rows = []
    for i in range(28):
        rows.append(doc(f"own-{i:02d}", created_at=f"2024-03-{i + 1:02d}T10:00:00+00:00",
                        metadata={"document_type": "contract" if i % 2 else "invoice",
                                  "date": f"2023-0{1 + i % 9}-15", "author": f"Author {i}"},
                        document_type_norm="contract" if i % 2 else "invoice"))
    for i in range(12):
        rows.append(doc(f"glob-{i:02d}", user_id=OTHER, folder_id=G1,
                        created_at=f"2024-04-{i + 1:02d}T09:00:00+00:00",
                        metadata={"document_type": "contract", "author": "Colleague"},
                        document_type_norm="contract"))
    rows.append(doc("own-in-shared", folder_id=G1, created_at="2024-05-01T08:00:00+00:00",
                    metadata={"document_type": "contract"}, document_type_norm="contract"))
    rows.append(doc("hidden", user_id=OTHER, created_at="2024-05-02T08:00:00+00:00"))
    rows.append(doc("old", is_latest=False, created_at="2024-05-03T08:00:00+00:00"))
    gone = doc("gone", created_at="2024-05-04T08:00:00+00:00")
    gone["retrievable"] = False
    rows.append(gone)
    for r in rows:
        r.setdefault("retrievable", True)
    assert len(rows) <= 50
    assert len({r["created_at"] for r in rows}) == len(rows)
    return rows


async def _tool_output(monkeypatch, client, args, resolver):
    import app.services.tools.documents as td

    td._ensure_resolver()
    monkeypatch.setattr(td, "resolve_filter", resolver)
    ctx = SimpleNamespace(current_user={"id": CALLER}, supabase=client)
    return (await td._handle_query_documents_by_view(args, ctx)).result


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "args",
    [
        {"filter": {"op": "and", "conditions": []}},
        {"filter": {"op": "and", "conditions": []}, "limit": 5},
        {"filter": {"op": "and", "conditions": []}, "limit": 50},
        {"filter": {"op": "and", "conditions": []}, "limit": 1},
        {"filter": {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "contract"}]}},
        {"filter": {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "contract"}]},
         "limit": 7},
        {"filter": {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "nothing"}]}},
    ],
    ids=["default-20", "limit-5", "limit-50", "limit-1", "contract", "contract-7", "no-match"],
)
async def test_the_agent_answer_is_byte_identical_to_pre_284(glob, monkeypatch, args):
    from app.services.document_view_resolver import resolve_filter

    glob["global"] = [G1]
    before = await _tool_output(monkeypatch, FakePostgrest({"documents": _agent_fixture()}), args,
                                _pre284_resolve_filter)
    after = await _tool_output(monkeypatch, FakePostgrest({"documents": _agent_fixture()}), args,
                               resolve_filter)
    assert after == before
    parsed = json.loads(after)
    assert parsed["mode"] == "results"
    if args.get("filter", {}).get("conditions") == []:
        assert parsed["total"] == 28 + 12 + 1, "own + colleague's shared + own-in-shared, retrievable only"


@pytest.mark.asyncio
async def test_the_agent_tool_passes_its_limit_and_slices_nothing(glob, monkeypatch):
    import inspect

    import app.services.tools.documents as td

    src = inspect.getsource(td._handle_query_documents_by_view)
    assert "via_view=False" in src
    assert "[:limit]" not in src
    calls: list[dict] = []

    async def spy(**kw):
        calls.append(kw)
        return {"total": 0} if kw.get("count_only") else {"documents": [], "total": 0}

    td._ensure_resolver()
    monkeypatch.setattr(td, "resolve_filter", spy)
    ctx = SimpleNamespace(current_user={"id": CALLER}, supabase=FakePostgrest({"documents": []}))
    await td._handle_query_documents_by_view({"filter": {"op": "and", "conditions": []}, "limit": 9}, ctx)
    listing = [c for c in calls if not c.get("count_only")]
    assert len(listing) == 1
    assert listing[0]["limit"] == 9 and listing[0]["via_view"] is False


# ─────────────────────────────── the routes ───────────────────────────────


@pytest.mark.asyncio
async def test_both_routes_opt_into_the_view_and_pass_their_paging(monkeypatch):
    import app.api.document_views as routes
    from app.models.document_view import AdHocResolve

    calls: list[dict] = []

    async def spy(**kw):
        calls.append(kw)
        return {"total": 0} if kw.get("count_only") else {"documents": [], "total": 0, "offset": 0, "limit": 25}

    async def _view(view_id, caller, supabase=None):
        return {"id": view_id, "user_id": caller, "filter_expr": {"op": "and", "conditions": []},
                "folder_scope": None}

    monkeypatch.setattr(routes, "resolve_filter", spy)
    monkeypatch.setattr(routes.document_view_service, "get_view", _view)
    user = {"id": CALLER}
    await routes.resolve_view(view_id="v1", offset=50, limit=200, include_archived=False,
                              current_user=user, supabase=object())
    await routes.resolve_view(view_id="v1", count_only=True, current_user=user, supabase=object())
    await routes.resolve_adhoc(AdHocResolve(filter_expr={"op": "and", "conditions": []}, offset=25,
                                            limit=100, include_archived=False),
                               current_user=user, supabase=object())
    assert all(c["via_view"] is True for c in calls)
    assert (calls[0]["offset"], calls[0]["limit"], calls[0]["include_archived"]) == (50, 200, False)
    assert calls[1]["count_only"] is True and calls[1]["include_archived"] is True
    assert (calls[2]["offset"], calls[2]["limit"], calls[2]["include_archived"]) == (25, 100, False)


def test_the_paging_is_bounded():
    from pydantic import ValidationError

    from app.models.document_view import AdHocResolve

    body = {"filter_expr": {"op": "and", "conditions": []}}
    ok = AdHocResolve(**body)
    assert (ok.offset, ok.limit, ok.include_archived, ok.count_only) == (0, 25, True, False)
    for bad in ({"limit": 201}, {"limit": 0}, {"offset": -1}):
        with pytest.raises(ValidationError):
            AdHocResolve(**body, **bad)


@pytest.mark.asyncio
async def test_a_resolve_error_is_still_remapped_and_an_unseen_view_is_still_404(monkeypatch):
    from fastapi import HTTPException

    import app.api.document_views as routes
    from app.services.document_view_resolver import ResolveError

    async def boom(**_kw):
        raise ResolveError(detail="filter field 'x' is no longer available")

    async def _none(*_a, **_k):
        return None

    monkeypatch.setattr(routes, "resolve_filter", boom)
    monkeypatch.setattr(routes.document_view_service, "get_view", _none)
    with pytest.raises(HTTPException) as e404:
        await routes.resolve_view(view_id="nope", current_user={"id": CALLER}, supabase=object())
    assert e404.value.status_code == 404
    from app.models.document_view import AdHocResolve

    with pytest.raises(HTTPException) as e422:
        await routes.resolve_adhoc(AdHocResolve(filter_expr={"op": "and", "conditions": []}),
                                   current_user={"id": CALLER}, supabase=object())
    assert e422.value.status_code == 422
