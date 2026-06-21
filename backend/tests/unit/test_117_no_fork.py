"""Phase 117 Wave-0 — the D-117-7 "share, do NOT fork" source-grep guard.

The single most important invariant of this phase: the leak-safe outgoing+incoming read
traversal must have exactly ONE implementation — ``document_relationship_service``. The
agent handler (Task 3) and the new GET route (Plan 02) both CALL it; neither re-implements
it. A fork would silently re-open the SC#1 cross-user leak (the 115 D-115-6 / D-117-7
precedent), and the secure-phase two-user test exists to catch exactly that drift.

This clones the spirit of ``test_115_resolver_extraction.py`` (the source-text guard) and
asserts the two traversal-IMPLEMENTATION tokens live ONLY in the service, never in the
route file:

  * ``"linked document (no access)"`` — the leak-safe mask string (D-117-8). Constructing
    it in the route means the route forked the per-viewer masking.
  * ``.in_(`` — the own-scoped edge query over the subject's version set. Constructing it
    in the route means the route forked the edge traversal.

NOTE on ``_resolve_readable_latest`` (the faithful guard scoping, documented in the
117-01-SUMMARY): unlike the two tokens above, ``_resolve_readable_latest`` LEGITIMATELY
appears in ``document_relationships.py`` today — the Phase-116 POST create handler calls
the SHARED resolver for its visible-both gate. That is the "share, don't fork" pattern
working CORRECTLY (mirrors how ``document_views.py`` calls the shared ``resolve_filter``),
NOT a fork. So this guard does NOT forbid ``_resolve_readable_latest`` in the route — only
the two tokens that uniquely identify a FORKED READ TRAVERSAL (the mask + the edge query).

Also asserts the shared ``get_related_documents`` is importable + callable (the extraction
landed). The route file may not exist yet (Plan 02) — its read is skip-guarded so this file
passes while RED; the route assertion goes GREEN once Plan 02's route stays fork-free.
"""

import os

import pytest

_MASK = "linked document (no access)"
_EDGE_QUERY_TOKEN = ".in_("

_ROUTE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "app", "api", "document_relationships.py"
)
_SERVICE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "app", "services", "document_relationship_service.py"
)


def _read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@pytest.mark.xfail(
    strict=False, reason="Task 2 extracts get_related_documents into the service; GREEN once it lands."
)
def test_shared_get_related_documents_is_importable_and_callable():
    """The extracted read core exists in the service module (Task 2 GREEN target)."""
    from app.services.document_relationship_service import get_related_documents

    assert callable(get_related_documents)


@pytest.mark.xfail(
    strict=False,
    reason="Task 2 relocates the mask + lifts the .in_() edge query into the service; GREEN once it lands.",
)
def test_mask_and_edge_query_live_only_in_the_service():
    """The two traversal-IMPLEMENTATION tokens appear in the SERVICE (where the read lives)."""
    service_src = _read(_SERVICE_PATH)
    assert _MASK in service_src, (
        "the leak-safe mask must be defined in document_relationship_service (the read core)"
    )
    assert _EDGE_QUERY_TOKEN in service_src, (
        "the own-scoped .in_() edge query over the version set must live in the service"
    )


def test_route_does_not_fork_the_read_traversal():
    """The route file must NOT contain the forked-read tokens (mask + .in_() edge query).

    The route legitimately CALLS the shared fn (Plan 02) and may call the shared
    _resolve_readable_latest for the create gate (Phase 116 — share, not fork); it must
    NEVER re-implement the masking or the edge traversal. Skip-guarded until the route file
    exists; the assertion is GREEN as long as Plan 02's GET route stays a thin wrapper.
    """
    if not os.path.exists(_ROUTE_PATH):  # pragma: no cover — route ships in Plan 02
        pytest.skip("document_relationships.py route not present yet (Plan 02)")

    route_src = _read(_ROUTE_PATH)
    assert _MASK not in route_src, (
        f"FORK DETECTED: {_MASK!r} must live ONLY in document_relationship_service, never the route"
    )
    assert _EDGE_QUERY_TOKEN not in route_src, (
        f"FORK DETECTED: the {_EDGE_QUERY_TOKEN!r} edge query must live ONLY in the service, never the route"
    )
