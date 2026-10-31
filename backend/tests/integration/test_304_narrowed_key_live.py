"""Phase 304-03 — a NARROWED key (D-32, SC3): nothing outside its ticked folders is reached.

One driven arm per read path (search, read_document, list_documents, view_documents,
related_documents), plus the rules narrowing must keep:

  · a subfolder created AFTER the key was minted is in scope on the next call (D-21);
  · a co-member's org-shared folder is OUT unless it is itself ticked (D-22);
  · connector-fed documents (``source_connection_id IS NOT NULL``) are OUT unless
    ``include_external`` — by document provenance, even inside a ticked folder (D-40);
  · a ticked folder the member can no longer see leaves NOTHING, never everything (D-08);
  · an archived or source-gone document (``retrievable`` false) leaves every read (D-46);
  · a narrowed key lists only the saved views scoped inside its subtree (D-47).

Every arm also shows the un-narrowed key reaching the thing the narrowed key may not — so no arm
passes on an empty seed. The principal is always resolved from a real minted key.

Run with ``-rs``; a skip is NOT RUN, never a pass.
"""
from __future__ import annotations

from uuid import UUID

from app.services import acting_member_reads as reads
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import (  # noqa: F401 — `world` is a fixture
    patch_search,
    search_settings,
    world,
)

pytestmark = requires_pg


async def _list_ids(p) -> set[str]:
    page = await reads.list_documents(p, limit=200)
    assert page["total"] == len(page["items"])
    return {r["id"] for r in page["items"]}


async def _search_docs(p, w) -> set[str]:
    return {str(r["document_id"]) for r in await reads.search(p, w.tok_x, user_settings=search_settings())}


# ── one arm per read path ──────────────────────────────────────────────────────


async def test_narrowed_search_reaches_only_the_ticked_subtree(world, monkeypatch):
    w = world
    patch_search(monkeypatch, w)
    everything = await _search_docs(await w.principal(include_external=True), w)
    assert w.ids("root_x", "sx_doc") <= everything, "non-vacuity: the un-narrowed key reaches them"
    narrowed = await _search_docs(await w.principal(folder_ids=[w.f], include_external=True), w)
    assert narrowed == w.ids("f_doc", "f2_doc", "ext_doc")
    assert await _search_docs(await w.principal(folder_ids=[w.f]), w) == w.ids("f_doc", "f2_doc")


async def test_narrowed_read_document_refuses_outside_the_subtree(world):
    w = world
    wide = await w.principal(include_external=True)
    p = await w.principal(folder_ids=[w.f])
    for label in ("f_doc", "f2_doc"):
        assert (await reads.read_document(p, w.docs[label]))["id"] == w.docs[label]
    for label in ("root_x", "sx_doc"):
        assert await reads.read_document(wide, w.docs[label]) is not None  # non-vacuity
        assert await reads.read_document(p, w.docs[label]) is None, label


async def test_narrowed_list_documents_is_the_subtree(world):
    w = world
    assert w.ids("root_x", "sx_doc") <= await _list_ids(await w.principal())
    assert await _list_ids(await w.principal(folder_ids=[w.f])) == w.ids("f_doc", "f2_doc")
    assert await _list_ids(await w.principal(folder_ids=[w.f2])) == w.ids("f2_doc")
    assert {f["id"] for f in await reads.list_folders(await w.principal(folder_ids=[w.f]))} == {w.f, w.f2}


async def test_narrowed_view_documents_is_cut_to_the_subtree(world, monkeypatch):
    w = world
    patch_search(monkeypatch, w)
    wide = await w.principal()
    p = await w.principal(folder_ids=[w.f])

    async def ids(principal, view):
        return {r["id"] for r in (await reads.view_documents(principal, w.views[view], limit=200))["items"]}

    assert w.ids("root_x", "sx_doc") <= await ids(wide, "all_x")
    assert await ids(p, "all_x") == w.ids("f_doc", "f2_doc")
    assert await ids(p, "contract_x") == w.ids("f_doc")
    # a view scoped to F, through a key ticked to F2: the intersection, never the union
    assert await ids(await w.principal(folder_ids=[w.f2]), "scoped_x") == w.ids("f2_doc")


async def test_narrowed_related_documents_masks_an_endpoint_outside_the_subtree(world):
    w = world
    wide = await w.principal()
    unmasked_wide = {r["document_id"] for r in (await reads.related_documents(wide, w.docs["f_doc"]))["documents"]}
    assert w.docs["root_x"] in unmasked_wide  # non-vacuity: the un-narrowed key names root_x

    p = await w.principal(folder_ids=[w.f])
    rel = await reads.related_documents(p, w.docs["f_doc"])
    by_doc = {r["document_id"] for r in rel["documents"]}
    assert w.docs["f2_doc"] in by_doc
    assert w.docs["root_x"] not in by_doc
    incoming = [r for r in rel["documents"] if r["direction"] == "incoming"]
    assert len(incoming) == 1 and incoming[0]["document_id"] is None
    assert incoming[0]["filename"] == "linked document (no access)"
    # the subject itself outside the key's subtree: not found
    assert await reads.related_documents(await w.principal(folder_ids=[w.f2]), w.docs["f_doc"]) is None


# ── the rules narrowing keeps ──────────────────────────────────────────────────


async def test_a_subfolder_created_after_the_key_is_included(world):
    w = world
    p = await w.principal(folder_ids=[w.f])
    assert await _list_ids(p) == w.ids("f_doc", "f2_doc")
    later = await w.folder(w.u, w.x, "F3-later", parent=w.f)
    await w.doc("later_doc", w.u, w.x, folder=later)
    assert w.docs["later_doc"] in await _list_ids(p)  # the SAME principal, the next call
    assert later in {f["id"] for f in await reads.list_folders(p)}
    assert (await reads.read_document(p, w.docs["later_doc"]))["id"] == w.docs["later_doc"]


async def test_a_co_members_shared_folder_needs_its_own_tick(world):
    w = world
    assert w.docs["sx_doc"] in await _list_ids(await w.principal())  # un-narrowed: in
    assert w.docs["sx_doc"] not in await _list_ids(await w.principal(folder_ids=[w.f]))
    ticked = await w.principal(folder_ids=[w.f, w.sx])
    assert w.docs["sx_doc"] in await _list_ids(ticked)
    assert w.sx in {f["id"] for f in await reads.list_folders(ticked)}
    assert (await reads.read_document(ticked, w.docs["sx_doc"]))["id"] == w.docs["sx_doc"]


async def test_connector_fed_documents_need_include_external(world, monkeypatch):
    w = world
    patch_search(monkeypatch, w)
    ext = w.docs["ext_doc"]
    for folder_ids in (None, [w.f]):  # un-narrowed, and inside a ticked folder: provenance decides
        off = await w.principal(folder_ids=folder_ids)
        on = await w.principal(folder_ids=folder_ids, include_external=True)
        assert ext not in await _list_ids(off) and ext in await _list_ids(on)
        assert await reads.read_document(off, ext) is None
        assert (await reads.read_document(on, ext))["id"] == ext
        assert ext not in await _search_docs(off, w) and ext in await _search_docs(on, w)
        off_view = {r["id"] for r in (await reads.view_documents(off, w.views["all_x"], limit=200))["items"]}
        on_view = {r["id"] for r in (await reads.view_documents(on, w.views["all_x"], limit=200))["items"]}
        assert ext not in off_view and ext in on_view


async def test_a_vanished_ticked_folder_returns_nothing_never_everything(world, pg_pool, monkeypatch):
    w = world
    patch_search(monkeypatch, w)
    gone = await w.folder(w.u, w.x, "G-vanishing")
    p = await w.principal(folder_ids=[gone], include_external=True)
    await pg_pool.execute("DELETE FROM public.folders WHERE id = $1", UUID(gone))
    assert p.folder_ids == (gone,)  # the key still names it; the scope it composes is ()

    assert await reads.list_folders(p) == []
    assert await reads.list_documents(p, limit=200) == {"items": [], "total": 0}
    assert await reads.read_document(p, w.docs["f_doc"]) is None
    assert await reads.search(p, w.tok_x, user_settings=search_settings()) == []
    assert await reads.view_documents(p, w.views["all_x"], limit=200) == {"items": [], "total": 0}
    assert await reads.related_documents(p, w.docs["f_doc"]) is None


# ── 304-REVIEW WR-01 / D-46: the agent rule, ``documents.retrievable`` (mig 205) ───────────────


async def _not_retrievable(w, pg_pool) -> tuple[str, str]:
    """An ARCHIVED document and a SOURCE-GONE one, both U's, both in ticked F, both linked from
    f_doc — so every read below would reach them if ``retrievable`` were not applied."""
    arch = await w.doc("arch_doc", w.u, w.x, folder=w.f, doc_type="Contract", minutes_ago=35)
    gone = await w.doc("gone_doc", w.u, w.x, folder=w.f, doc_type="Contract", minutes_ago=36)
    await pg_pool.execute("UPDATE public.documents SET archived_at = now() WHERE id = $1", UUID(arch))
    await pg_pool.execute(
        "UPDATE public.documents SET source_state = 'missing_at_source' WHERE id = $1", UUID(gone)
    )
    await w.edge(w.u, w.x, "f_doc", "arch_doc", "references")
    await w.edge(w.u, w.x, "f_doc", "gone_doc", "references")
    flags = {str(r["id"]): r["retrievable"] for r in await pg_pool.fetch(
        "SELECT id, retrievable FROM public.documents WHERE id = ANY($1::uuid[])", [UUID(arch), UUID(gone)]
    )}
    assert flags == {arch: False, gone: False}, flags  # non-vacuity: the seed is what it claims
    return arch, gone


async def test_archived_and_source_gone_documents_leave_every_acting_read(world, pg_pool, monkeypatch):
    w = world
    patch_search(monkeypatch, w)
    arch, gone = await _not_retrievable(w, pg_pool)
    for p in (await w.principal(), await w.principal(folder_ids=[w.f])):
        # non-vacuity: a retrievable sibling in the same folder IS read, listed and linked
        assert (await reads.read_document(p, w.docs["f_doc"]))["id"] == w.docs["f_doc"]
        assert w.docs["f_doc"] in await _list_ids(p)

        assert {arch, gone}.isdisjoint(await _list_ids(p))
        view = {r["id"] for r in (await reads.view_documents(p, w.views["all_x"], limit=200))["items"]}
        assert w.docs["f_doc"] in view and {arch, gone}.isdisjoint(view)
        for did in (arch, gone):
            assert await reads.read_document(p, did) is None, did
            assert await reads.related_documents(p, did) is None, did

        rel = await reads.related_documents(p, w.docs["f_doc"])
        assert {arch, gone}.isdisjoint({r["document_id"] for r in rel["documents"]})
        # both edges are still there — masked, exactly like an endpoint the key cannot read
        masked = [r for r in rel["documents"] if r["direction"] == "outgoing" and r["document_id"] is None]
        assert len(masked) == 4, masked  # fy_doc (other org), px_doc (private), arch_doc, gone_doc


# ── 304-REVIEW WR-04 / D-47: a narrowed key lists only the views inside its subtree ────────────


async def test_a_narrowed_key_lists_only_the_views_inside_its_subtree(world):
    w = world
    g = await w.folder(w.u, w.x, "G-outside")
    await w.view("scoped_f2", w.u, w.x, folder_scope=w.f2)
    await w.view("scoped_g", w.u, w.x, folder_scope=g)

    async def view_ids(principal) -> set[str]:
        return {v["id"] for v in await reads.list_views(principal)}

    wide = await view_ids(await w.principal())
    mine_x = {w.views[k] for k in ("all_x", "contract_x", "scoped_x", "scoped_f2", "scoped_g")}
    assert mine_x <= wide  # the all-folders key is unchanged: every view, scoped or not
    assert w.views["all_y"] not in wide  # still one org

    # ticked F: F and F2 are its subtree; unscoped views and G's view are hidden (D-47, fail closed)
    narrowed = await reads.list_views(await w.principal(folder_ids=[w.f]))
    assert {v["id"] for v in narrowed} == {w.views["scoped_x"], w.views["scoped_f2"]}
    assert {v["folder_scope"] for v in narrowed} == {w.f, w.f2}
    # ticked F2 only: the view scoped to F lies OUTSIDE the key's subtree, so it is hidden too
    assert await view_ids(await w.principal(folder_ids=[w.f2])) == {w.views["scoped_f2"]}
