"""Phase 119 — DGOV-01 — UNIT edge cases for the low-confidence Python scan (D-119-5).

The low-confidence signal is NOT PostgREST-expressible, so ``_fetch_low_confidence`` does a
Python scan over the caller's latest docs. A field counts as low-confidence metadata only when
it mirrors the detail panel's ``isLow`` (``DocumentDetailPanel.resolveFieldState``):

  * its ``metadata._confidence[field]`` is numeric (not ``bool``) and ``< 0.5``
    (``0.0`` is a LEGITIMATE low value — never a truthiness test; the cutoff IS the
    ``ConfidenceChip`` ``TIER.MED`` low cutoff, no second constant), AND
  * the field actually HAS a value (``metadata[field]`` is not empty) — an empty/unextracted
    field is MISSING metadata, not LOW-confidence metadata, so the panel hides it and the
    governance signal must not report it (BUG-260620: docs surfaced here whose opened panel
    showed nothing low because the only "low" fields were blank ``date``/``author``), AND
  * the field was not user-confirmed (``metadata._source[field] != "user"``), AND
  * the key is not ``_``-prefixed (internal keys are never fields).

Other guards: a missing ``_confidence`` key does NOT raise (the doc is skipped); non-numeric /
``None`` / ``bool`` values are guarded.

These drive ``_fetch_low_confidence`` through a MagicMock supabase builder (the
``test_knowledge_health.py`` precedent) with seeded ``metadata`` rows, asserting which docs
land in ``items`` and that no scan input ever raises.

Wave-0 scaffold: imports are inside the test bodies and tolerated-skip until Task 2 ships
``document_governance.py`` — the suite exits 0 before then and turns GREEN once it lands.
"""
from unittest.mock import MagicMock

import pytest


def _doc(doc_id, *, confidence, values=None, source=None, filename="d.pdf", folder_id=None):
    """A documents row whose `metadata._confidence` is the per-field score map.

    `values` populates the actual `metadata[field]` values (a low field needs a real value to
    count — see the empty-field guard); `source` populates `metadata._source` (a "user" field
    is suppressed). By default a field referenced in `confidence` has a non-empty placeholder
    value so the legacy "score-only" fixtures still exercise the low path.
    """
    meta = {}
    if values is not None:
        meta.update(values)
    if confidence is not None:
        meta["_confidence"] = confidence
        # Auto-populate a value for any scored field not explicitly given one, so a fixture that
        # only cares about the SCORE still has a (non-empty) value and reaches the low path.
        if values is None:
            for field in confidence:
                if not field.startswith("_"):
                    meta.setdefault(field, "x")
    if source is not None:
        meta["_source"] = source
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
    sb = _supabase_returning([_doc("z", confidence={"title": 0.0}, values={"title": "t"})])
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
    sb = _supabase_returning([
        _doc("hi", confidence={"title": 0.9, "author": 0.5}, values={"title": "t", "author": "a"})
    ])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)
    assert "hi" not in _ids(out), "0.5 is the cutoff: >= 0.5 is NOT low"


def test_any_field_below_cutoff_surfaces():
    """A doc with ANY populated field < 0.5 surfaces even if other fields are high."""
    gov = _import_gov_or_skip()
    sb = _supabase_returning([
        _doc("mix", confidence={"title": 0.9, "author": 0.4}, values={"title": "t", "author": "a"})
    ])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)
    assert "mix" in _ids(out)


def test_empty_valued_low_field_does_not_surface():
    """BUG-260620 regression: a low-confidence score on an EMPTY field is MISSING metadata, not
    LOW-confidence metadata — the panel hides it, so the governance signal must NOT report it.

    This is the exact live defect: `date`/`author` extracted as `None` carried a 0.1 score and
    falsely flagged the doc, so the card surfaced docs whose opened panel showed every field >= 0.9.
    """
    gov = _import_gov_or_skip()
    sb = _supabase_returning([
        # author scored 0.1 but its value is None (blank) → must NOT count.
        _doc("blank", confidence={"author": 0.1, "date": 0.2},
             values={"title": "present", "author": None, "date": ""}),
    ])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)
    assert "blank" not in _ids(out), (
        "a low score on an empty/unextracted field must NOT surface (it's missing, not low)"
    )


def test_empty_low_but_populated_low_still_surfaces():
    """Non-vacuity twin: a doc with BOTH an empty low field AND a populated low field still
    surfaces — and `low_fields` contains ONLY the populated one."""
    gov = _import_gov_or_skip()
    sb = _supabase_returning([
        _doc("partial", confidence={"author": 0.1, "title": 0.3},
             values={"title": "present", "author": None}),
    ])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)
    assert "partial" in _ids(out)
    item = next(it for it in out["items"] if it["document_id"] == "partial")
    assert set(item["low_fields"]) == {"title"}, "the empty `author` must be excluded from low_fields"


def test_user_confirmed_low_field_does_not_surface():
    """A field the user confirmed (`_source[field] == "user"`) is authoritative — its original
    extraction score must not flag the doc (mirror of the panel's `source !== "user"` guard)."""
    gov = _import_gov_or_skip()
    sb = _supabase_returning([
        _doc("usr", confidence={"author": 0.2}, values={"author": "Jane Doe"},
             source={"author": "user"}),
    ])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)
    assert "usr" not in _ids(out), "a user-confirmed field must not surface as low-confidence"


def test_underscore_prefixed_confidence_key_ignored():
    """A `_`-prefixed key inside `_confidence` is never a real field and must be ignored."""
    gov = _import_gov_or_skip()
    sb = _supabase_returning([_doc("u", confidence={"_internal": 0.1}, values={"title": "t"})])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)
    assert "u" not in _ids(out)


def test_non_numeric_none_and_bool_values_are_guarded():
    """Non-numeric / None / bool values never crash the scan and never count as low.

    `True`/`False` are `int` subclasses (`isinstance(True, int)` is True) so a naive
    `v < 0.5` would treat `False` (== 0) as a low score — the `not isinstance(v, bool)`
    guard must exclude them. A string value would raise on `<` without the numeric guard.
    """
    gov = _import_gov_or_skip()
    sb = _supabase_returning([
        _doc("strval", confidence={"title": "n/a"}, values={"title": "t"}),   # string → guarded
        _doc("noneval", confidence={"title": None}, values={"title": "t"}),    # None → guarded
        _doc("boolval", confidence={"verified": False}, values={"verified": "y"}),  # bool → guarded
    ])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)  # must not raise
    assert _ids(out).isdisjoint({"strval", "noneval", "boolval"}), (
        "non-numeric / None / bool confidence values must be guarded, not counted as low"
    )


def test_response_shape_is_paginated_contract():
    """The low-conf fetch returns the `{items, total, offset, limit}` paginated shape."""
    gov = _import_gov_or_skip()
    sb = _supabase_returning([_doc("a", confidence={"title": 0.4}, values={"title": "t"})])
    out = gov._fetch_low_confidence(sb, _UID, 0, 20)
    assert set(out.keys()) == {"items", "total", "offset", "limit"}
    assert out["total"] == len(out["items"]) or out["total"] >= 1
