"""Phase 118 (CLASS-02) — the pure in-Python AST→bool matcher per-operator agreement proof.

The load-bearing 118 contract: ``classification_matcher.match_metadata`` evaluates a
``ViewFilter`` AST against a metadata dict IN PYTHON (the doc is not persisted at the
ingest call site, so the Phase 113/114 SQL compiler cannot be reused). Its per-operator
results MUST agree with the documented Phase 113/114 SQL normalization (Pitfall 2 —
"would match N" preview ≈ on-upload match):

  * ``eq`` normalized (``document_type``/``language``) — case-insensitive (both lowercase).
  * ``eq`` free-text (``title``/``author``/``summary``) — case-insensitive (the ``ilike`` leg).
  * ``one_of`` — case-insensitive membership.
  * ``contains`` — case-insensitive substring.
  * ``gte``/``lte``/``before``/``after``/``between`` — ISO-date-string comparison.
  * ``is_empty`` — key absent OR value in ``("", [])`` → True.
  * ``within_next``/``older_than`` — relative window from ``date.today()`` (server clock).
  * flat AND — a 2-condition rule matches iff BOTH conditions match.
  * empty rule — ``ViewFilter(op="and", conditions=[])`` → False (never auto-suggest blindly).
  * ``build_suggestion`` — the D-118-5 single-object shape (NO confidence key; frozen
    ``condition_summary``; ``suggested_folder_name`` resolved fresh, None/"(deleted)" if gone).

This file is GREEN in THIS plan (Task 2 lands the matcher). The matcher is PURE: no eval,
no DB in ``match_metadata``, reuses ``ViewFilter.model_validate`` (op-reject) +
``view_filter_compiler.validate_fields`` (``_``-prefix + whitelist guard).

CONVENTION (mirrors test_114_view_filter_compiler): ``from app... import ...`` is INSIDE
each test body so a not-yet-built symbol never breaks COLLECTION.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

# The built-in metadata field whitelist the matcher validates against. Mirrors
# ``set(DocumentMetadata.model_fields)`` — the closed set of built-in keys the ingest
# pass already trusts (documents.py:_METADATA_BUILTINS). Custom field_keys are added
# by the caller; for the unit tests the built-ins suffice.
_WHITELIST = {
    "document_type",
    "language",
    "title",
    "author",
    "summary",
    "date",
    "topics",
    "page_count",
}


def _f(*conditions: dict) -> dict:
    """A flat-AND ViewFilter dict from a list of condition dicts."""
    return {"op": "and", "conditions": list(conditions)}


def _c(field: str, op: str, **kw) -> dict:
    return {"field": field, "op": op, **kw}


# ── eq normalized (document_type / language — case-insensitive, both lowercase) ──
def test_eq_normalized_case_insensitive():
    from app.services.classification_matcher import match_metadata

    rule = _f(_c("document_type", "eq", value="Invoice"))
    assert match_metadata(rule, {"document_type": "invoice"}, _WHITELIST) is True
    assert match_metadata(rule, {"document_type": "Invoice"}, _WHITELIST) is True
    assert match_metadata(rule, {"document_type": "receipt"}, _WHITELIST) is False


def test_eq_language_normalized():
    from app.services.classification_matcher import match_metadata

    rule = _f(_c("language", "eq", value="EN"))
    assert match_metadata(rule, {"language": "en"}, _WHITELIST) is True
    assert match_metadata(rule, {"language": "fr"}, _WHITELIST) is False


# ── eq free-text (title/author/summary — case-insensitive ilike leg) ────────────
def test_eq_free_text_case_insensitive():
    from app.services.classification_matcher import match_metadata

    rule = _f(_c("author", "eq", value="acme corp"))
    assert match_metadata(rule, {"author": "Acme Corp"}, _WHITELIST) is True
    assert match_metadata(rule, {"author": "ACME CORP"}, _WHITELIST) is True
    assert match_metadata(rule, {"author": "Globex"}, _WHITELIST) is False


# ── one_of (case-insensitive membership over a normalized field) ────────────────
def test_one_of_case_insensitive_membership():
    from app.services.classification_matcher import match_metadata

    rule = _f(_c("document_type", "one_of", values=["Invoice", "Receipt"]))
    assert match_metadata(rule, {"document_type": "invoice"}, _WHITELIST) is True
    assert match_metadata(rule, {"document_type": "receipt"}, _WHITELIST) is True
    assert match_metadata(rule, {"document_type": "report"}, _WHITELIST) is False


# ── contains (case-insensitive substring) ───────────────────────────────────────
def test_contains_case_insensitive_substring():
    from app.services.classification_matcher import match_metadata

    rule = _f(_c("author", "contains", value="acme"))
    assert match_metadata(rule, {"author": "The Acme Corporation"}, _WHITELIST) is True
    assert match_metadata(rule, {"author": "ACME LLC"}, _WHITELIST) is True
    assert match_metadata(rule, {"author": "Globex"}, _WHITELIST) is False


# ── range ops on ISO dates (gte/lte/before/after/between sort correctly) ─────────
def test_range_ops_iso_date_comparison():
    from app.services.classification_matcher import match_metadata

    assert match_metadata(
        _f(_c("date", "gte", value="2026-01-01")), {"date": "2026-06-01"}, _WHITELIST
    ) is True
    assert match_metadata(
        _f(_c("date", "gte", value="2026-01-01")), {"date": "2025-12-31"}, _WHITELIST
    ) is False
    assert match_metadata(
        _f(_c("date", "lte", value="2026-12-31")), {"date": "2026-06-01"}, _WHITELIST
    ) is True
    assert match_metadata(
        _f(_c("date", "before", value="2026-06-01")), {"date": "2026-01-01"}, _WHITELIST
    ) is True
    assert match_metadata(
        _f(_c("date", "after", value="2026-01-01")), {"date": "2026-06-01"}, _WHITELIST
    ) is True
    assert match_metadata(
        _f(_c("date", "between", value="2026-01-01", value2="2026-12-31")),
        {"date": "2026-06-01"}, _WHITELIST,
    ) is True
    assert match_metadata(
        _f(_c("date", "between", value="2026-01-01", value2="2026-03-31")),
        {"date": "2026-06-01"}, _WHITELIST,
    ) is False


# ── is_empty (key absent OR value in ("", []) → True; present non-empty → False) ─
def test_is_empty_semantics():
    from app.services.classification_matcher import match_metadata

    rule = _f(_c("summary", "is_empty"))
    assert match_metadata(rule, {}, _WHITELIST) is True            # key absent
    assert match_metadata(rule, {"summary": ""}, _WHITELIST) is True    # empty string
    assert match_metadata(rule, {"summary": []}, _WHITELIST) is True    # empty list
    assert match_metadata(rule, {"summary": "has text"}, _WHITELIST) is False


# ── relative-date window from date.today() (server clock) ────────────────────────
def test_within_next_relative_window():
    from app.services.classification_matcher import match_metadata

    today = date.today()
    in_10 = (today + timedelta(days=10)).isoformat()
    in_40 = (today + timedelta(days=40)).isoformat()
    rule = _f(_c("date", "within_next", value=30, unit="days"))
    assert match_metadata(rule, {"date": in_10}, _WHITELIST) is True    # within next 30 days
    assert match_metadata(rule, {"date": in_40}, _WHITELIST) is False   # beyond the window


def test_older_than_relative_window():
    from app.services.classification_matcher import match_metadata

    today = date.today()
    long_ago = (today - timedelta(days=400)).isoformat()
    recent = (today - timedelta(days=10)).isoformat()
    rule = _f(_c("date", "older_than", value=1, unit="months"))
    assert match_metadata(rule, {"date": long_ago}, _WHITELIST) is True   # older than 1 month
    assert match_metadata(rule, {"date": recent}, _WHITELIST) is False    # recent


# ── flat AND (a 2-condition rule matches iff BOTH match) ─────────────────────────
def test_flat_and_requires_all_conditions():
    from app.services.classification_matcher import match_metadata

    rule = _f(
        _c("document_type", "eq", value="invoice"),
        _c("author", "contains", value="acme"),
    )
    assert match_metadata(
        rule, {"document_type": "invoice", "author": "Acme Corp"}, _WHITELIST
    ) is True
    # one condition fails → no match
    assert match_metadata(
        rule, {"document_type": "invoice", "author": "Globex"}, _WHITELIST
    ) is False
    assert match_metadata(
        rule, {"document_type": "receipt", "author": "Acme Corp"}, _WHITELIST
    ) is False


# ── empty rule matches nothing (never auto-suggest blindly) ──────────────────────
def test_empty_rule_matches_nothing():
    from app.services.classification_matcher import match_metadata

    assert match_metadata({"op": "and", "conditions": []}, {"document_type": "invoice"}, _WHITELIST) is False
    assert match_metadata({"op": "and", "conditions": []}, {}, _WHITELIST) is False


# ── _-prefixed provenance keys are NEVER a match dimension (validate_fields reject) ─
def test_underscore_prefixed_field_rejected():
    from app.services.classification_matcher import match_metadata

    rule = _f(_c("_confidence", "eq", value="0.9"))
    with pytest.raises(ValueError):
        match_metadata(rule, {"_confidence": {"document_type": 0.9}}, _WHITELIST)


# ── unknown op rejected at parse (ViewFilter Literal op-discriminator) ───────────
def test_unknown_op_rejected_at_parse():
    from pydantic import ValidationError

    from app.services.classification_matcher import match_metadata

    rule = _f(_c("document_type", "xor", value="invoice"))
    with pytest.raises(ValidationError):
        match_metadata(rule, {"document_type": "invoice"}, _WHITELIST)


# ── build_suggestion — the D-118-5 single-object shape (NO confidence key) ───────
def test_build_suggestion_shape_no_confidence():
    from app.services import classification_matcher

    rule = {
        "id": "rule-123",
        "name": "Invoices",
        "match_expr": _f(
            _c("document_type", "eq", value="invoice"),
            _c("author", "contains", value="acme"),
        ),
        "suggest_folder_id": "folder-abc",
    }

    # A stub supabase whose folder lookup returns a readable folder named "Invoices".
    class _Resp:
        def __init__(self, data):
            self.data = data

    class _Q:
        def __init__(self, data):
            self._data = data

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def or_(self, *_a, **_k):
            return self

        def maybe_single(self):
            return self

        def execute(self):
            return _Resp(self._data)

    class _SB:
        def table(self, _name):
            return _Q({"id": "folder-abc", "name": "Invoices"})

    sugg = classification_matcher.build_suggestion(rule, _SB(), "11111111-1111-1111-1111-111111111111")

    assert set(sugg.keys()) == {
        "rule_id",
        "rule_name",
        "condition_summary",
        "suggested_folder_id",
        "suggested_folder_name",
        "status",
    }, f"build_suggestion must produce exactly the D-118-5 key set; got {sorted(sugg.keys())}"
    assert "confidence" not in sugg, "build_suggestion must NEVER carry a confidence key (provenance not %)"
    assert sugg["rule_id"] == "rule-123"
    assert sugg["rule_name"] == "Invoices"
    assert sugg["status"] == "suggested"
    assert sugg["suggested_folder_id"] == "folder-abc"
    assert sugg["suggested_folder_name"] == "Invoices"
    # condition_summary is a human-readable AST render carrying both conditions, frozen.
    assert "document_type" in sugg["condition_summary"]
    assert "author" in sugg["condition_summary"]


def test_build_suggestion_deleted_folder_resolves_none():
    from app.services import classification_matcher

    rule = {
        "id": "rule-9",
        "name": "Orphan",
        "match_expr": _f(_c("document_type", "eq", value="invoice")),
        "suggest_folder_id": None,   # FK ON DELETE SET NULL → folder gone (Pitfall 5)
    }

    class _SB:
        def table(self, _name):
            raise AssertionError("no folder lookup when suggest_folder_id is None")

    sugg = classification_matcher.build_suggestion(rule, _SB(), "11111111-1111-1111-1111-111111111111")
    assert sugg["suggested_folder_id"] is None
    assert sugg["suggested_folder_name"] is None
