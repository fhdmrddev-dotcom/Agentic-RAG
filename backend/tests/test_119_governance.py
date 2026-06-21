"""Phase 119 — DGOV-01 — empty-shape unit tests for the governance `_fetch_*` helpers.

The positive-empty contract the frontend cards consume: a clean library returns
``{"items": [], "total": 0, "offset": 0, "limit": 20}`` from each of the three signal
fetchers (broken / unclassified / low-confidence). When ``total == 0`` the card renders
the "all clear" positive empty state — never an error.

MagicMock-builder UNIT pattern (the ``test_knowledge_health.py`` precedent): the supabase
client is a fluent-chainable mock; each ``_fetch_*`` is exercised with empty data and the
exact response shape is asserted.

Wave-0 scaffold (Phase 111/116 convention): authored BEFORE the router (Task 2) lands. The
import is inside each test body and tolerated-skip if the module is absent, so the suite
exits 0 before Task 2 and the tests turn GREEN the moment ``document_governance.py`` ships.
"""
from unittest.mock import MagicMock

import pytest


def _empty_result(count=0):
    r = MagicMock()
    r.data = []
    r.count = count
    return r


def _empty_builder():
    """A fluent-chainable supabase query builder mock returning empty data."""
    b = MagicMock()
    for m in ("select", "insert", "update", "delete", "eq", "neq", "in_",
              "not_", "order", "limit", "single", "maybe_single", "is_",
              "or_", "gte", "lt", "lte", "range"):
        getattr(b, m).return_value = b
    # `.not_.in_(...)` chains through a nested attribute as well.
    b.not_.in_.return_value = b
    b.execute.return_value = _empty_result()
    b.execute.side_effect = None
    return b


def _empty_supabase():
    sb = MagicMock()
    builder = _empty_builder()
    sb.table.return_value = builder
    sb.rpc.return_value = builder
    return sb


def _import_gov_or_skip():
    try:
        from app.api import document_governance as gov  # noqa: WPS433
    except Exception:  # pragma: no cover - Wave-0: router not yet built
        pytest.skip("document_governance router not yet built (Wave-0 scaffold)")
    return gov


def test_empty_shapes_unclassified():
    """`_fetch_unclassified` returns the positive-empty shape for a clean library."""
    gov = _import_gov_or_skip()
    sb = _empty_supabase()
    out = gov._fetch_unclassified(sb, "00000000-0000-0000-0000-000000000001", 0, 20)
    assert out == {"items": [], "total": 0, "offset": 0, "limit": 20}


def test_empty_shapes_low_confidence():
    """`_fetch_low_confidence` returns the positive-empty shape for a clean library."""
    gov = _import_gov_or_skip()
    sb = _empty_supabase()
    out = gov._fetch_low_confidence(sb, "00000000-0000-0000-0000-000000000001", 0, 20)
    assert out == {"items": [], "total": 0, "offset": 0, "limit": 20}


@pytest.mark.asyncio
async def test_empty_shapes_broken_relationships():
    """`_fetch_broken_relationships` (the ONE async fetch) returns the positive-empty
    shape when the caller owns no edges."""
    gov = _import_gov_or_skip()
    sb = _empty_supabase()
    out = await gov._fetch_broken_relationships(
        sb, "00000000-0000-0000-0000-000000000001", 0, 20
    )
    assert out == {"items": [], "total": 0, "offset": 0, "limit": 20}


def test_empty_shapes_keys_present():
    """Every `_fetch_*` shape carries exactly the four pagination keys (the
    `PaginationControls` contract)."""
    gov = _import_gov_or_skip()
    sb = _empty_supabase()
    out = gov._fetch_unclassified(sb, "00000000-0000-0000-0000-000000000001", 0, 20)
    assert set(out.keys()) == {"items", "total", "offset", "limit"}
    assert out["offset"] == 0 and out["limit"] == 20
