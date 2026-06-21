"""Phase 119 — DGOV-01 — UNIT edge cases for the low-confidence Python scan (D-119-5).

The low-confidence signal is NOT PostgREST-expressible (a doc is low-conf if ANY value in
``metadata._confidence`` is ``< 0.5``), so ``_fetch_low_confidence`` does a Python scan over
the caller's latest docs. This file pins the scan's edge-case discipline (RESEARCH A4):

  * ``0.0`` is a LEGITIMATE low confidence value — it MUST count (never a truthiness test).
  * a missing ``_confidence`` key does NOT raise — the doc is skipped.
  * non-numeric / ``None`` / ``bool`` values are guarded
    (``isinstance(v, (int, float)) and not isinstance(v, bool)``).
  * the ``0.5`` cutoff is the ``ConfidenceChip`` ``TIER.MED`` low cutoff (no second constant).

These drive ``_fetch_low_confidence`` through a MagicMock supabase builder (the
``test_knowledge_health.py`` precedent) with seeded ``metadata`` rows, asserting which docs
land in ``items`` and that no scan input ever raises.

Wave-0 scaffold: imports are inside the test bodies and tolerated-skip until Task 2 ships
``document_governance.py`` — the suite exits 0 before then and turns GREEN once it lands.
"""
from unittest.mock import MagicMock

import pytest


def _doc(doc_id, *, confidence, filename="d.pdf", folder_id=None):
    """A documents row whose `metadata._confidence` is the per-field score map."""
    meta = {}
    if confidence is not None:
        meta["_confidence"] = confidence
    return {
        "id": doc_id,
        "filename": filename,
        "folder_id": folder_id,
        "metadata": meta,
    }


def _supabase_returning(rows):
    """A fluent supabase mock whose every query `.execute()` returns `rows`."""
    result = MagicMock()
    result.data = rows
    result.count = len(rows)
    b = MagicMock()
    for m in ("select", "insert", "update", "delete", "eq", "neq", "in_",
              "not_", "order", "limit", "single", "maybe_single", "is_",
              "or_", "gte", "lt", "lte", "range"):
        getattr(b, m).return_value = b
    b.execute.return_value = result
    b.execute.side_effect = None
    sb = MagicMock()
    sb.table.return_value = b
    return sb


def _import_gov_or_skip():
    try:
        from app.api import document_governance as gov  # noqa: WPS433
    except Exception:  # pragma: no cover - Wave-0
        pytest.skip("document_governance router not yet built (Wave-0 scaffold)")
    return gov


_UID = "00000000-0000-0000-0000-000000000001"


def _ids(out):
    return {it.get("document_id") for it in out["items"]}


def test_zero_point_zero_counts_as_low():
    """`0.0` is a real low-confidence score — it MUST be reported (no truthiness test)."""
    gov = _import_gov_or_skip()
    sb = _supabase_returning([_doc("z", confidence={"title": 0.0})])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)
    assert "z" in _ids(out), "a 0.0 confidence field must count as low (never `if v:`-skipped)"


def test_missing_confidence_does_not_error_and_is_skipped():
    """A doc with no `_confidence` key must NOT raise and must NOT surface as low-conf."""
    gov = _import_gov_or_skip()
    sb = _supabase_returning([_doc("nokey", confidence=None)])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)  # must not raise
    assert "nokey" not in _ids(out)


def test_all_high_fields_excluded():
    """A doc whose every field is >= 0.5 is NOT low-confidence."""
    gov = _import_gov_or_skip()
    sb = _supabase_returning([_doc("hi", confidence={"title": 0.9, "author": 0.5})])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)
    assert "hi" not in _ids(out), "0.5 is the cutoff: >= 0.5 is NOT low"


def test_any_field_below_cutoff_surfaces():
    """A doc with ANY field < 0.5 surfaces even if other fields are high."""
    gov = _import_gov_or_skip()
    sb = _supabase_returning([_doc("mix", confidence={"title": 0.9, "author": 0.4})])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)
    assert "mix" in _ids(out)


def test_non_numeric_none_and_bool_values_are_guarded():
    """Non-numeric / None / bool values never crash the scan and never count as low.

    `True`/`False` are `int` subclasses (`isinstance(True, int)` is True) so a naive
    `v < 0.5` would treat `False` (== 0) as a low score — the `not isinstance(v, bool)`
    guard must exclude them. A string value would raise on `<` without the numeric guard.
    """
    gov = _import_gov_or_skip()
    sb = _supabase_returning([
        _doc("strval", confidence={"title": "n/a"}),       # string → guarded (no raise)
        _doc("noneval", confidence={"title": None}),        # None → guarded
        _doc("boolval", confidence={"verified": False}),    # bool False (==0) → guarded out
    ])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)  # must not raise
    assert _ids(out).isdisjoint({"strval", "noneval", "boolval"}), (
        "non-numeric / None / bool confidence values must be guarded, not counted as low"
    )


def test_response_shape_is_paginated_contract():
    """The low-conf fetch returns the `{items, total, offset, limit}` paginated shape."""
    gov = _import_gov_or_skip()
    sb = _supabase_returning([_doc("a", confidence={"title": 0.4})])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)
    assert set(out.keys()) == {"items", "total", "offset", "limit"}
    assert out["total"] == len(out["items"]) or out["total"] >= 1
