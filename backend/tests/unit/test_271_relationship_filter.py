"""Phase 271 (271-01 Task 3) — relationship verbs in BOTH directions, older_matches, the route.

Result-row phrase: ``<result> <verb> <picked P>`` (D-04). An OUTGOING verb (one of the 4
stored ``rel_type`` values) matches rows that are the SOURCE of an edge whose target is in
P's lineage; an INCOMING verb (one of the 4 inverse labels) matches rows that are the TARGET
of an edge whose source is in P's lineage. D-05's named failure — a relationship filter that
matches outgoing links only — is what the asymmetric-edge tests below exist to catch.

P-02 semantics: Latest / Has earlier follow each matched endpoint to its lineage's latest row
and exclude P's own lineage latest; Older versions are row-exact; ``older_matches`` counts the
non-latest endpoints that pass every other filter, and equals the total of the same request
with ``version="older"`` (the Show-them invariant).

The fake PostgREST is imported from the search-core suite (the test_240 precedent).
"""

from __future__ import annotations

import typing

import pytest

from tests.unit.test_271_search_core import (
    CALLER,
    RESULT_KEYS,
    FakePostgrest,
    doc,
    ids,
    patched,  # noqa: F401 — the shared seam-patching fixture
    run,
)

P1 = "dddddddd-0000-4000-8000-000000000001"
P2 = "dddddddd-0000-4000-8000-000000000002"
A = "dddddddd-0000-4000-8000-00000000000a"
B = "dddddddd-0000-4000-8000-00000000000b"
C1 = "dddddddd-0000-4000-8000-0000000000c1"
C2 = "dddddddd-0000-4000-8000-0000000000c2"
NOPE = "dddddddd-0000-4000-8000-0000000000ff"


def _graph():
    documents = [
        doc(P1, filename="P.pdf", version_number=1, is_latest=False),
        doc(P2, filename="P.pdf", version_number=2, is_latest=True),
        doc(A, filename="A.pdf"),
        doc(B, filename="B.pdf"),
        doc(C1, filename="C.pdf", version_number=1, is_latest=False),
        doc(C2, filename="C.pdf", version_number=2, is_latest=True),
    ]

    def edge(src, tgt, rt):
        return {"source_doc_id": src, "target_doc_id": tgt, "rel_type": rt, "user_id": CALLER}

    edges = [
        edge(A, P1, "supersedes"),      # recorded on P's OLD version (D-116-1a)
        edge(P2, B, "references"),
        edge(C1, P2, "supersedes"),     # from C's OLD version
        edge(P2, P1, "supersedes"),     # inside P's own lineage
        edge(C2, A, "amends"),
        edge(B, A, "attached_to"),
    ]
    return FakePostgrest({"documents": documents, "document_relationships": edges})


def _edge_queries(client):
    return [q for q in client.queries if q.table == "document_relationships"]


# ─────────────────────────────── vocabulary pin ───────────────────────────────


def test_the_8_verbs_are_pinned_to_the_inverse_label_map():
    from app.models.document_search import RelVerb
    from app.services.document_relationship_service import _INVERSE_LABEL

    verbs = set(typing.get_args(RelVerb))
    assert verbs == set(_INVERSE_LABEL) | set(_INVERSE_LABEL.values())
    assert len(verbs) == 8


# ─────────────────────────────── outgoing / incoming ───────────────────────────────


@pytest.mark.asyncio
async def test_supersedes_matches_sources_follows_to_latest_and_excludes_self_lineage(patched):
    client = _graph()
    out = await run(client, relationship={"verb": "supersedes", "document_id": P2})
    # A supersedes p1 (old version still counts); C1 supersedes p2 → follows to C2;
    # p2 supersedes p1 is inside P's lineage and contributes nothing.
    assert sorted(ids(out)) == sorted([A, C2])
    (eq,) = _edge_queries(client)
    assert ("eq", "rel_type", "supersedes") in eq.calls
    assert ("eq", "user_id", CALLER) in eq.calls
    (side,) = eq.filters("in_")
    assert side[1] == "target_doc_id" and set(side[2]) == {P1, P2}


@pytest.mark.asyncio
async def test_picking_the_old_version_resolves_forward_to_the_same_answer(patched):
    out = await run(_graph(), relationship={"verb": "supersedes", "document_id": P1})
    assert sorted(ids(out)) == sorted([A, C2])


@pytest.mark.asyncio
async def test_the_two_directions_return_different_sets_on_an_asymmetric_edge(patched):
    """D-05: A supersedes p1. From A's side the INCOMING verb finds P; the outgoing does not."""
    incoming = await run(_graph(), relationship={"verb": "superseded_by", "document_id": A})
    outgoing = await run(_graph(), relationship={"verb": "supersedes", "document_id": A})
    assert ids(incoming) == [P2], "an incoming verb must be non-empty while the edge exists"
    assert P2 not in ids(outgoing)
    assert set(ids(incoming)) != set(ids(outgoing))


@pytest.mark.asyncio
async def test_superseded_by_queries_the_source_side(patched):
    client = _graph()
    await run(client, relationship={"verb": "superseded_by", "document_id": A})
    (eq,) = _edge_queries(client)
    assert ("eq", "rel_type", "supersedes") in eq.calls
    (side,) = eq.filters("in_")
    assert side[1] == "source_doc_id" and side[2] == [A]


@pytest.mark.asyncio
async def test_references_both_directions(patched):
    # p2 references B: "p2 references B" (outgoing, picked B) and "B referenced_by p2"
    # (incoming, picked P).
    assert ids(await run(_graph(), relationship={"verb": "references", "document_id": B})) == [P2]
    assert ids(await run(_graph(), relationship={"verb": "referenced_by", "document_id": B})) == []
    assert ids(await run(_graph(), relationship={"verb": "referenced_by", "document_id": P2})) == [B]
    assert ids(await run(_graph(), relationship={"verb": "references", "document_id": P2})) == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "verb,picked,rel_type,side,expected",
    [
        ("amends", A, "amends", "target_doc_id", [C2]),
        ("amended_by", C2, "amends", "source_doc_id", [A]),
        ("attached_to", A, "attached_to", "target_doc_id", [B]),
        ("has_attachment", B, "attached_to", "source_doc_id", [A]),
        ("references", B, "references", "target_doc_id", [P2]),
        ("referenced_by", P2, "references", "source_doc_id", [B]),
        ("supersedes", P2, "supersedes", "target_doc_id", sorted([A, C2])),
        ("superseded_by", A, "supersedes", "source_doc_id", [P2]),
    ],
)
async def test_each_verb_selects_its_rel_type_and_side(patched, verb, picked, rel_type, side, expected):
    client = _graph()
    out = await run(client, relationship={"verb": verb, "document_id": picked})
    (eq,) = _edge_queries(client)
    assert ("eq", "rel_type", rel_type) in eq.calls
    assert ("eq", "user_id", CALLER) in eq.calls
    (in_call,) = eq.filters("in_")
    assert in_call[1] == side
    assert sorted(ids(out)) == expected


# ─────────────────────────────── version states + older_matches ───────────────────────────────


@pytest.mark.asyncio
async def test_older_is_row_exact(patched):
    out = await run(_graph(), relationship={"verb": "supersedes", "document_id": P2}, version="older")
    assert ids(out) == [C1]
    assert out["documents"][0]["is_latest"] is False


@pytest.mark.asyncio
async def test_older_matches_equals_the_older_total_show_them_invariant(patched):
    latest = await run(_graph(), relationship={"verb": "supersedes", "document_id": P2})
    older = await run(_graph(), relationship={"verb": "supersedes", "document_id": P2}, version="older")
    assert latest["older_matches"] == 1
    assert latest["older_matches"] == older["total"]
    assert older["older_matches"] == 0  # only computed for version=latest


@pytest.mark.asyncio
async def test_older_matches_is_computed_even_when_latest_is_empty(patched):
    """The sketch's worked example: p2 supersedes p1 inside one lineage, picked P, incoming.

    Latest gives nothing (self-lineage excluded); the hint still counts p1; Show them gives p1.
    """
    latest = await run(_graph(), relationship={"verb": "superseded_by", "document_id": P2})
    older = await run(_graph(), relationship={"verb": "superseded_by", "document_id": P2},
                      version="older")
    assert latest["total"] == 0 and latest["documents"] == []
    assert latest["older_matches"] == 1
    assert ids(older) == [P1]


@pytest.mark.asyncio
async def test_older_matches_is_zero_without_a_relationship(patched):
    out = await run(_graph())
    assert out["older_matches"] == 0


# ─────────────────────────────── no oracle, no empty in_ ───────────────────────────────


@pytest.mark.asyncio
async def test_an_unreadable_picked_document_is_the_zero_shape_and_no_edge_query(patched):
    client = _graph()
    out = await run(client, relationship={"verb": "supersedes", "document_id": NOPE})
    empty = await run(FakePostgrest({"documents": []}), name="no-such-file")
    assert set(out) == RESULT_KEYS == set(empty)
    assert out["documents"] == [] and out["total"] == 0 and out["older_matches"] == 0
    assert _edge_queries(client) == []


@pytest.mark.asyncio
async def test_an_empty_allow_list_never_sends_an_empty_in(patched):
    client = _graph()
    out = await run(client, relationship={"verb": "references", "document_id": A})
    assert set(out) == RESULT_KEYS
    assert out["documents"] == [] and out["total"] == 0 and out["older_matches"] == 0
    for q in client.queries:
        assert ("in_", "id", []) not in q.calls


@pytest.mark.asyncio
async def test_the_allow_list_is_applied_inside_both_legs(patched):
    from tests.unit.test_271_search_core import G1, OTHER

    patched["global"] = [G1]
    client = _graph()
    client.tables["documents"].append(doc("dddddddd-0000-4000-8000-0000000000e1", user_id=OTHER, folder_id=G1))
    await run(client, relationship={"verb": "supersedes", "document_id": P2})
    # The latest pipeline's two legs (the older_matches count runs its own own-leg query).
    legs = [q for q in client.first_page_legs() if ("eq", "is_latest", True) in q.calls]
    assert len(legs) == 2
    for q in legs:
        assert ("in_", "id", sorted([A, C2])) in q.calls
    (older_leg,) = [q for q in client.first_page_legs() if ("eq", "is_latest", False) in q.calls]
    assert ("in_", "id", [C1]) in older_leg.calls
    assert ("eq", "user_id", CALLER) in older_leg.calls


# ─────────────────────────────── the route's client reaches the helpers ───────────────────────────────


@pytest.mark.asyncio
async def test_relationship_helpers_receive_the_route_client(patched, monkeypatch):
    import app.services.document_search_service as svc

    seen: dict[str, list] = {"resolve": [], "versions": []}
    real_resolve = svc._resolve_readable_latest
    real_versions = svc._subject_version_ids

    async def spy_resolve(*a, **k):
        seen["resolve"].append(k.get("supabase"))
        return await real_resolve(*a, **k)

    async def spy_versions(*a, **k):
        seen["versions"].append(k.get("supabase"))
        return await real_versions(*a, **k)

    monkeypatch.setattr(svc, "_resolve_readable_latest", spy_resolve)
    monkeypatch.setattr(svc, "_subject_version_ids", spy_versions)
    client = _graph()
    await run(client, relationship={"verb": "supersedes", "document_id": P2})
    assert seen["resolve"] and all(c is client for c in seen["resolve"])
    assert seen["versions"] and all(c is client for c in seen["versions"])


# ─────────────────────────────── the route ───────────────────────────────


def test_router_prefix_and_user_jwt_dependency():
    from app.api import document_search
    from app.dependencies import get_current_user, get_user_supabase_client

    assert document_search.router.prefix == "/document-search"
    posts = [r for r in document_search.router.routes if "POST" in getattr(r, "methods", set())]
    assert len(posts) == 1
    deps = {d.call for d in posts[0].dependant.dependencies}
    assert get_user_supabase_client in deps
    assert get_current_user in deps


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [422, 503])
async def test_route_remaps_core_errors(monkeypatch, status):
    from fastapi import HTTPException

    from app.api import document_search
    from app.models.document_search import DocumentSearchRequest
    from app.services.document_search_service import SearchTruncatedError
    from app.services.document_view_resolver import ResolveError

    async def boom(**_k):
        if status == 503:
            raise SearchTruncatedError()
        raise ResolveError(detail="filter field 'x' is no longer available")

    monkeypatch.setattr(document_search, "search_documents", boom)
    with pytest.raises(HTTPException) as ei:
        await document_search.search(DocumentSearchRequest(), current_user={"id": CALLER}, supabase=object())
    assert ei.value.status_code == status


@pytest.mark.asyncio
async def test_route_passes_the_caller_and_the_client(monkeypatch):
    from app.api import document_search
    from app.models.document_search import DocumentSearchRequest

    got = {}

    async def fake(**k):
        got.update(k)
        return {"documents": [], "total": 0}

    monkeypatch.setattr(document_search, "search_documents", fake)
    client = object()
    body = DocumentSearchRequest()
    await document_search.search(body, current_user={"id": CALLER}, supabase=client)
    assert got == {"caller": CALLER, "req": body, "supabase": client}


def test_main_app_mounts_post_document_search():
    from app.main import app

    hits = [r for r in app.routes if getattr(r, "path", None) == "/document-search"]
    assert hits and any("POST" in r.methods for r in hits)
