"""Phase 304-03 — THE HEADLINE (D-31, SC1): a key acts exactly as its owner, in one org, never more.

The subject is a NON-OWNER member of two orgs (``phase304_fixtures.world``): U is role ``member`` in
X and in Y, and the shared content each arm checks belongs to a co-member — so a version that
passes only for the org owner fails here.

For each read a key can make, the key side (``acting_member_reads``, on the acting-member RLS
connection, principal resolved from a REAL minted ``srl_mcp_`` key) is compared with what the APP
returns for U with X active (the Phase 298 ``X-Org-Id`` lists, called as route handlers with U's
real GoTrue user-JWT client), and nothing of Y may appear.

Run with ``-rs``. :54322 (Postgres) or :54321 (GoTrue) down → the suite SKIPS, and a skip is
reported as NOT RUN, never as a pass (D-15 gate 3, D-31).
"""
from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from app.api import document_relationships as relationships_api
from app.api import document_views as views_api
from app.api import documents as documents_api
from app.api import folders as folders_api
from app.api import workflows as workflows_api
from app.dependencies import get_user_pg_connection
from app.services import acting_member_reads as reads
from app.services import retrieval_service
from app.services.document_relationship_service import _NO_ACCESS_MASK as MASK
from tests.integration._271_gotrue_users import _admin, user_client
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import (  # noqa: F401 — `world` is a fixture
    READ_TOOLS,
    RUN_TOOLS,
    patch_search,
    request_for,
    search_settings,
    world,
)

pytestmark = requires_pg


def _user(w) -> dict:
    return {"id": w.u}


async def _app_folders(w, org) -> set[str]:
    rows = await folders_api.list_folders(
        request=request_for(org), current_user=_user(w), supabase=user_client(w.u_tok)
    )
    return {str(r["id"]) for r in rows}


async def _app_documents(w, org) -> tuple[list[str], int]:
    page = await documents_api.list_documents(
        limit=200, offset=0, folder_id=None, include_archived=False, status_=None,
        order="created_desc", kind=None, current_user=_user(w), supabase=user_client(w.u_tok),
        request=request_for(org),
    )
    return [str(d["id"]) for d in page["documents"]], page["total"]


async def _app_published(w, org) -> list[str]:
    rows = await workflows_api.get_published_workflows(
        project_folder_id=None, scope=None, request=request_for(org), current_user=_user(w)
    )
    return [str(r.id) for r in rows]


# ── non-vacuity: with no acting org, U sees BOTH orgs ─────────────────────────


async def test_non_vacuity_unset_sees_both_orgs(world):
    w = world
    async with get_user_pg_connection(None, {"id": w.u}) as conn:
        folders = {r["id"] for r in await reads.list_acting_folders(conn)}
        docs = {str(r["id"]) for r in await conn.fetch(
            "SELECT id FROM public.library_documents WHERE is_latest AND archived_at IS NULL")}
    assert {w.f, w.f2, w.sx, w.fy, w.sy} <= folders
    assert w.px not in folders  # a co-member's PRIVATE folder is never visible
    assert w.ids("f_doc", "root_x", "sx_doc", "fy_doc", "root_y", "sy_doc") <= docs
    # and the app, with no header, answers the same union — the narrowing below is the key's doing
    assert {w.f, w.fy, w.sx, w.sy} <= await _app_folders(w, None)


# ── folders ────────────────────────────────────────────────────────────────────


async def test_folders_parity(world):
    w = world
    p = await w.principal()
    key = {r["id"] for r in await reads.list_folders(p)}
    app = await _app_folders(w, w.x)
    assert key == app
    assert w.sx in key, "a co-member's org-shared folder must be listed (not owner-only)"
    assert {w.f, w.f2} <= key
    assert not key & {w.fy, w.sy, w.px}


# ── list documents ─────────────────────────────────────────────────────────────


async def test_list_documents_parity(world):
    w = world
    p = await w.principal(include_external=True)
    key = await reads.list_documents(p, limit=200)
    app_ids, app_total = await _app_documents(w, w.x)
    assert [r["id"] for r in key["items"]] == app_ids
    assert key["total"] == app_total
    assert w.docs["sx_doc"] in app_ids, "a co-member's shared document must be listed"
    assert not set(app_ids) & w.ids("fy_doc", "root_y", "sy_doc", "px_doc", "old_x")
    assert w.ids("f_doc", "f2_doc", "ext_doc", "root_x") <= set(app_ids)


async def test_list_documents_pages_and_counts(world):
    w = world
    p = await w.principal(include_external=True)
    full = await reads.list_documents(p, limit=200)
    first = await reads.list_documents(p, limit=2, offset=0)
    second = await reads.list_documents(p, limit=2, offset=2)
    assert first["total"] == second["total"] == full["total"]
    assert [r["id"] for r in first["items"] + second["items"]] == [r["id"] for r in full["items"]][:4]


# ── read a document ────────────────────────────────────────────────────────────


async def test_read_document_parity(world):
    w = world
    p = await w.principal(include_external=True)
    app_ids, _ = await _app_documents(w, w.x)
    for doc_id in app_ids:
        row = await reads.read_document(p, doc_id)
        assert row is not None and row["id"] == doc_id, doc_id
        assert "full_markdown" in row
    # Y's documents, a random id, a malformed id, an unreadable X id and a superseded version:
    # ONE not-found, identical for all.
    for doc_id in [*w.ids("fy_doc", "root_y", "sy_doc", "px_doc", "old_x"), str(uuid4()), "nope"]:
        assert await reads.read_document(p, doc_id) is None, doc_id


# ── workflows ──────────────────────────────────────────────────────────────────


async def test_workflows_parity(world):
    w = world
    p = await w.principal(tools=RUN_TOOLS)
    key = [str(r["id"]) for r in await reads.list_workflows(p)]
    app = await _app_published(w, w.x)
    assert key == app
    assert w.wf["pub_x"] in key
    assert w.wf["pub_y"] not in key and w.wf["draft_x"] not in key


async def test_a_read_only_key_cannot_list_workflows(world):
    w = world
    p = await w.principal(tools=READ_TOOLS)
    assert "list_workflows" not in p.tools
    with pytest.raises(reads.ToolNotGranted):
        await reads.list_workflows(p)


async def test_a_key_without_read_document_cannot_read(world):
    w = world
    p = await w.principal(tools=("list_documents",))
    with pytest.raises(reads.ToolNotGranted):
        await reads.read_document(p, w.docs["f_doc"])
    assert (await reads.list_documents(p, limit=200))["total"] > 0


# ── search (D-40: post-filter, never an allow-list) ────────────────────────────


async def _facts(pool, doc_ids) -> dict[str, tuple[str, bool]]:
    """document id -> (org, connector-fed) — read through the pool, outside both sides."""
    rows = await pool.fetch(
        "SELECT id, org_id, source_connection_id FROM public.documents WHERE id = ANY($1::uuid[])",
        [UUID(i) for i in set(doc_ids)],
    )
    return {str(r["id"]): (str(r["org_id"]), r["source_connection_id"] is not None) for r in rows}


def _hits(rows) -> list[tuple]:
    """A search hit's identity, in order (enriched rows carry no chunk id)."""
    return [(str(r["document_id"]), r.get("chunk_index"), r["content"]) for r in rows]


async def test_search_parity(world, pg_pool, monkeypatch):
    w = world
    patch_search(monkeypatch, w)
    s = search_settings()
    # The app's in-chat search is all-orgs (Q18): run it with NO acting org, then keep org X.
    app, _ = await retrieval_service.search_documents(w.tok_x, w.u, _admin(), user_settings=s)
    facts = await _facts(pg_pool, [r["document_id"] for r in app])
    app_x = [r for r in app if facts[str(r["document_id"])][0] == w.x]
    assert app_x, "non-vacuity: the app finds the X token"
    app_docs = {str(r["document_id"]) for r in app_x}
    assert w.docs["sx_doc"] in app_docs, "a co-member's shared document must be searchable"
    assert w.docs["ext_doc"] in app_docs, "non-vacuity: the connector-fed document ranks"
    assert w.docs["px_doc"] not in app_docs

    with_ext = await reads.search(await w.principal(include_external=True), w.tok_x, user_settings=s)
    assert _hits(with_ext) == _hits(app_x)

    without = await reads.search(await w.principal(), w.tok_x, user_settings=s)
    assert _hits(without) == _hits([r for r in app_x if not facts[str(r["document_id"])][1]])

    # Y's token: the app (all orgs) finds it; the key acting in X finds nothing.
    app_y, _ = await retrieval_service.search_documents(w.tok_y, w.u, _admin(), user_settings=s)
    assert app_y, "non-vacuity: the app finds the Y token"
    assert await reads.search(await w.principal(include_external=True), w.tok_y, user_settings=s) == []


async def test_a_key_without_search_cannot_search(world, monkeypatch):
    w = world
    patch_search(monkeypatch, w)
    p = await w.principal(tools=("list_documents",))
    with pytest.raises(reads.ToolNotGranted):
        await reads.search(p, w.tok_x, user_settings=search_settings())


# ── views ──────────────────────────────────────────────────────────────────────


async def test_views_parity(world, pg_pool, monkeypatch):
    w = world
    patch_search(monkeypatch, w)
    p = await w.principal(include_external=True)
    key_views = {v["id"] for v in await reads.list_views(p)}
    app_rows = await views_api.list_views(current_user=_user(w), supabase=user_client(w.u_tok))
    app_x = {str(v["id"]) for v in app_rows if v.get("is_system_global") or str(v.get("org_id")) == w.x}
    assert key_views == app_x
    assert {w.views["all_x"], w.views["contract_x"], w.views["scoped_x"]} <= key_views
    assert w.views["all_y"] not in key_views

    for label in ("all_x", "contract_x", "scoped_x"):
        view_id = w.views[label]
        key = await reads.view_documents(p, view_id, limit=200)
        app = await views_api.resolve_view(
            view_id, count_only=False, offset=0, limit=200, include_archived=False,
            current_user=_user(w), supabase=user_client(w.u_tok),
        )
        app_ids = [str(d["id"]) for d in app["documents"]]
        facts = await _facts(pg_pool, app_ids)
        app_x_ids = {i for i in app_ids if facts[i][0] == w.x}
        key_ids = {r["id"] for r in key["items"]}
        assert key_ids == app_x_ids, label
        assert key["total"] == len(key_ids), label
        assert not key_ids & w.ids("fy_doc", "root_y", "sy_doc", "px_doc"), label
    # the Contract view filters, the scoped view narrows — both against the app, above; stated plainly:
    contract = {r["id"] for r in (await reads.view_documents(p, w.views["contract_x"], limit=200))["items"]}
    assert w.docs["f2_doc"] not in contract and w.docs["sx_doc"] in contract
    scoped = {r["id"] for r in (await reads.view_documents(p, w.views["scoped_x"], limit=200))["items"]}
    assert scoped == w.ids("f_doc", "f2_doc", "ext_doc")
    # Y's view is not found for a key in X: empty, never Y's documents.
    assert await reads.view_documents(p, w.views["all_y"], limit=200) == {"items": [], "total": 0}


# ── relationships ──────────────────────────────────────────────────────────────


def _edges(result) -> set[tuple]:
    return {
        (r["direction"], r["label"], r["rel_type"], str(r["relationship_id"]),
         _s(r["document_id"]), r["filename"])
        for r in result["documents"]
    }


def _s(v):
    return None if v is None else str(v)


async def test_relationships_parity(world, pg_pool):
    w = world
    p = await w.principal(include_external=True)
    app = await relationships_api.get_relationships(
        document_id=w.docs["f_doc"], current_user=_user(w), supabase=user_client(w.u_tok)
    )
    key = await reads.related_documents(p, w.docs["f_doc"])
    assert key is not None
    assert key["subject"]["document_id"] == str(app["subject"]["document_id"]) == w.docs["f_doc"]
    # The app's rows restricted to org X endpoints: an endpoint in Y renders as the mask on the key.
    y_ids = w.ids("fy_doc", "root_y", "sy_doc")
    expected = {
        (d, lbl, rt, rid, None, MASK) if doc in y_ids else (d, lbl, rt, rid, doc, fn)
        for (d, lbl, rt, rid, doc, fn) in _edges(app)
    }
    assert _edges(key) == expected
    rows = {(r["direction"], _s(r["document_id"]), r["filename"], r["label"]) for r in key["documents"]}
    assert ("outgoing", w.docs["f2_doc"]) in {(a, b) for a, b, _f, _l in rows}
    assert ("incoming", w.docs["root_x"], "superseded_by") in {(a, b, lbl) for a, b, _f, lbl in rows}
    masked = [r for r in key["documents"] if r["document_id"] is None]
    assert len(masked) == 2  # px_doc (unreadable) and fy_doc (another org)
    assert all(r["filename"] == MASK for r in masked)
    assert key["total"] == len(key["documents"]) == 4
    # A Y document as the subject: not found in X.
    assert await reads.related_documents(p, w.docs["fy_doc"]) is None


async def test_the_principal_is_resolved_from_a_real_key(world, pg_pool):
    """The principal under test is the resolver's: pinned to X, and the key row's last_used_at
    moved from NULL to a timestamp (D-26)."""
    w = world
    secret = await w.mint()
    before = await pg_pool.fetchval(
        "SELECT last_used_at FROM public.api_keys WHERE user_id = $1 AND kind = 'mcp'", UUID(w.u))
    assert before is None
    from app.security.mcp_principal import resolve_mcp_principal
    from tests.unit.phase293_inbound_fakes import FakeRedis

    p = await resolve_mcp_principal(secret, pool=pg_pool, redis=FakeRedis())
    assert (p.user_id, p.org_id, p.folder_ids, p.credential_kind) == (w.u, w.x, None, "key")
    after = await pg_pool.fetchval(
        "SELECT last_used_at FROM public.api_keys WHERE id = $1", UUID(p.key_id))
    assert after is not None
