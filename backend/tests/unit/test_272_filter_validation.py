"""Phase 272-04 Task 1 (D-03 / D-04 / D-05 / D-20 / D-26) — parse, validate and canonicalise filters.

``search_documents`` takes Find's condition list as ``filters`` (272-02's argument contract), and
the legacy ``metadata_filter`` is mapped onto ``eq`` conditions — ONE compiler, never a second
dialect (D-03). Before anything is resolved, every condition is either:

* **canonicalised** to what the stored data actually holds (D-20 — an enum value matched to its
  option's spelling, a free custom string matched to its stored spelling(s), a number coerced), or
* **refused** with the values the model could use instead (D-04), so *"you misspelled it"* is never
  reported as *"no documents"*.

``date`` is the document's own date (the compiler's ``date_typed``, D-05); ``added`` /
``source_created`` / ``source_modified`` are Find's timestamptz date words, and a custom field keyed
like one of them is SHADOWED by the date word (Pitfall 14). A non-ISO date operand is refused
before PostgREST could see it (Pitfall 12).

No database: ``defs`` / ``whitelist`` / ``number_fields`` are passed explicitly and
``canonical_stored_values`` is patched where it is USED (``search_documents_tool``).
"""
from __future__ import annotations

import ast
import pathlib
import typing

import pytest

import app.services.search_documents_tool as sdt
from app.models.document_view import ViewCondition

USER = "user-1"

DEFS = [
    {"field_key": "legal_entity", "field_type": "enum", "options": ["Acme GmbH", "Beta Ltd"], "enabled": True},
    {"field_key": "client", "field_type": "string", "options": None, "enabled": True},
    {"field_key": "amount", "field_type": "number", "options": None, "enabled": True},
    # Pitfall 14: a custom def keyed like a date word — the date word must win.
    {"field_key": "added", "field_type": "string", "options": None, "enabled": True},
]
BUILTINS = {"title", "author", "date", "document_type", "topics", "language", "summary"}
WHITELIST = BUILTINS | {"legal_entity", "client", "amount", "added"}
NUMBER_FIELDS = {"amount"}


def _conds(*entries):
    parsed = sdt.parse_filter_args({"query": "q", "filters": list(entries)})
    assert isinstance(parsed, list), parsed
    return parsed


async def _validate(*entries, stored=None, calls=None, monkeypatch=None):
    if monkeypatch is not None:
        async def _fake(*, user_id, field, value, limit=10):
            if calls is not None:
                calls.append((field, value))
            return list((stored or {}).get(field, []))

        monkeypatch.setattr(sdt, "canonical_stored_values", _fake)
    return await sdt.validate_and_canonicalise(
        _conds(*entries), user_id=USER, supabase=object(),
        defs=DEFS, whitelist=WHITELIST, number_fields=NUMBER_FIELDS,
    )


# ── parse_filter_args (D-03) ───────────────────────────────────────────────────────────────────


def test_filters_parse_into_conditions():
    parsed = sdt.parse_filter_args({
        "query": "q",
        "filters": [{"field": "date", "op": "between", "value": "2025-10-01", "value2": "2025-10-31", "junk": 1}],
    })
    assert isinstance(parsed, list) and len(parsed) == 1
    c = parsed[0]
    assert (c.field, c.op, c.value, c.value2) == ("date", "between", "2025-10-01", "2025-10-31")


def test_metadata_filter_maps_onto_eq_conditions_after_filters():
    parsed = sdt.parse_filter_args({
        "query": "q",
        "filters": [{"field": "legal_entity", "op": "eq", "value": "Acme GmbH"}],
        "metadata_filter": {"author": "Smith", "date": "2025-10-03"},
    })
    assert [(c.field, c.op, c.value) for c in parsed] == [
        ("legal_entity", "eq", "Acme GmbH"),
        ("author", "eq", "Smith"),
        ("date", "eq", "2025-10-03"),
    ]


def test_neither_argument_is_no_conditions():
    assert sdt.parse_filter_args({"query": "q"}) == []
    assert sdt.parse_filter_args({"query": "q", "filters": None, "metadata_filter": None}) == []
    assert sdt.parse_filter_args({"query": "q", "filters": [], "metadata_filter": {}}) == []


def test_filters_not_a_list_is_refused():
    r = sdt.parse_filter_args({"query": "q", "filters": {"field": "date"}})
    assert isinstance(r, sdt.FilterRefusal)
    assert "list" in r.message


def test_an_entry_missing_op_is_refused():
    r = sdt.parse_filter_args({"query": "q", "filters": [{"field": "date", "value": "2025-10-01"}]})
    assert isinstance(r, sdt.FilterRefusal)
    assert r.field == "date"
    assert "op" in r.message


def test_an_unknown_op_is_refused_with_the_valid_ops():
    r = sdt.parse_filter_args({"query": "q", "filters": [{"field": "date", "op": "around", "value": "x"}]})
    assert isinstance(r, sdt.FilterRefusal)
    assert set(r.allowed) == set(typing.get_args(ViewCondition.model_fields["op"].annotation))


def test_the_op_literal_is_derived_from_view_condition_not_retyped():
    ours = set(typing.get_args(sdt.SearchCondition.model_fields["op"].annotation))
    theirs = set(typing.get_args(ViewCondition.model_fields["op"].annotation))
    assert ours == theirs and len(ours) == 11


# ── D-04: unknown field ─────────────────────────────────────────────────────────────────────────


async def test_an_unknown_field_is_refused_with_every_valid_field():
    r = await _validate({"field": "legal_entityy", "op": "eq", "value": "Acme GmbH"})
    assert isinstance(r, sdt.FilterRefusal)
    assert r.field == "legal_entityy"
    assert r.allowed == sorted(WHITELIST | {"date", "added", "source_created", "source_modified"})
    assert "legal_entityy" in r.message


# ── D-04 / D-20: enum ───────────────────────────────────────────────────────────────────────────


async def test_an_enum_value_is_matched_to_its_stored_spelling():
    out = await _validate({"field": "legal_entity", "op": "eq", "value": "acme gmbh"})
    assert out == [{"field": "legal_entity", "op": "eq", "value": "Acme GmbH"}]


async def test_an_enum_value_outside_its_options_is_refused_with_the_options():
    r = await _validate({"field": "legal_entity", "op": "eq", "value": "Acme Corp"})
    assert isinstance(r, sdt.FilterRefusal)
    assert r.allowed == ["Acme GmbH", "Beta Ltd"]
    assert "Acme Corp" in r.message and "Acme GmbH" in r.message


async def test_enum_one_of_is_canonicalised_element_wise():
    out = await _validate({"field": "legal_entity", "op": "one_of", "values": ["ACME GMBH", "beta ltd"]})
    assert out == [{"field": "legal_entity", "op": "one_of", "values": ["Acme GmbH", "Beta Ltd"]}]
    r = await _validate({"field": "legal_entity", "op": "one_of", "values": ["Acme GmbH", "Gamma"]})
    assert isinstance(r, sdt.FilterRefusal) and r.allowed == ["Acme GmbH", "Beta Ltd"]


# ── D-20: free custom strings ───────────────────────────────────────────────────────────────────


async def test_a_free_custom_string_takes_its_one_stored_spelling(monkeypatch):
    calls: list = []
    out = await _validate(
        {"field": "client", "op": "eq", "value": "acme gmbh"},
        stored={"client": ["ACME Gmbh"]}, calls=calls, monkeypatch=monkeypatch,
    )
    assert out == [{"field": "client", "op": "eq", "value": "ACME Gmbh"}]
    assert calls == [("client", "acme gmbh")]


async def test_two_stored_spellings_become_one_of(monkeypatch):
    out = await _validate(
        {"field": "client", "op": "eq", "value": "acme"},
        stored={"client": ["ACME", "Acme"]}, monkeypatch=monkeypatch,
    )
    assert out == [{"field": "client", "op": "one_of", "values": ["ACME", "Acme"]}]


async def test_a_spelling_with_a_quote_or_comma_never_rides_one_of(monkeypatch):
    # 271 WR-04: `.in_()` does not escape `"` / `,` / `(` / `)` inside a value.
    out = await _validate(
        {"field": "client", "op": "eq", "value": "Acme, Inc"},
        stored={"client": ["ACME, INC", "Acme, Inc"]}, monkeypatch=monkeypatch,
    )
    assert out == [{"field": "client", "op": "eq", "value": "Acme, Inc"}]  # the exact-case match
    out = await _validate(
        {"field": "client", "op": "eq", "value": "acme (eu)"},
        stored={"client": ["ACME (EU)", "Acme (Eu)"]}, monkeypatch=monkeypatch,
    )
    assert out == [{"field": "client", "op": "eq", "value": "ACME (EU)"}]  # no exact match → the first


async def test_no_stored_spelling_keeps_the_value_as_given(monkeypatch):
    out = await _validate(
        {"field": "client", "op": "eq", "value": "Nobody Ltd"}, stored={}, monkeypatch=monkeypatch,
    )
    assert out == [{"field": "client", "op": "eq", "value": "Nobody Ltd"}]


# ── numbers ─────────────────────────────────────────────────────────────────────────────────────


async def test_a_number_field_is_coerced():
    assert await _validate({"field": "amount", "op": "eq", "value": "5"}) == [
        {"field": "amount", "op": "eq", "value": 5}
    ]
    out = await _validate({"field": "amount", "op": "eq", "value": "5.5"})
    assert out == [{"field": "amount", "op": "eq", "value": 5.5}]
    assert isinstance(out[0]["value"], float)


async def test_a_non_number_on_a_number_field_is_refused():
    r = await _validate({"field": "amount", "op": "eq", "value": "five"})
    assert isinstance(r, sdt.FilterRefusal) and r.field == "amount"


# ── built-ins pass through (the compiler already handles their case) ───────────────────────────


async def test_builtins_pass_through_untouched(monkeypatch):
    calls: list = []
    out = await _validate(
        {"field": "author", "op": "eq", "value": "smith"},
        {"field": "title", "op": "contains", "value": "Board"},
        {"field": "document_type", "op": "eq", "value": "Report"},
        {"field": "language", "op": "eq", "value": "EN"},
        stored={"author": ["Smith"]}, calls=calls, monkeypatch=monkeypatch,
    )
    assert out == [
        {"field": "author", "op": "eq", "value": "smith"},
        {"field": "title", "op": "contains", "value": "Board"},
        {"field": "document_type", "op": "eq", "value": "Report"},
        {"field": "language", "op": "eq", "value": "EN"},
    ]
    assert calls == [], "built-ins never need a stored-spelling lookup"


# ── dates (D-05, Pitfall 12) ────────────────────────────────────────────────────────────────────


async def test_the_document_date_accepts_iso_days():
    out = await _validate({"field": "date", "op": "between", "value": "2025-10-01", "value2": "2025-10-31"})
    assert out == [{"field": "date", "op": "between", "value": "2025-10-01", "value2": "2025-10-31"}]


@pytest.mark.parametrize(
    "entry",
    [
        {"field": "date", "op": "between", "value": "October", "value2": "2025-10-31"},
        {"field": "date", "op": "eq", "value": "2025-10"},
        {"field": "date", "op": "after", "value": "Oct 1 2025"},
        {"field": "added", "op": "before", "value": "last week"},
        {"field": "source_modified", "op": "between", "value": "2025-10-01", "value2": "2025-10"},
    ],
)
async def test_a_non_iso_date_is_refused_naming_the_rule(entry):
    r = await _validate(entry)
    assert isinstance(r, sdt.FilterRefusal)
    assert "YYYY-MM-DD" in r.message and "between" in r.message


async def test_between_without_an_end_is_refused():
    r = await _validate({"field": "date", "op": "between", "value": "2025-10-01"})
    assert isinstance(r, sdt.FilterRefusal) and "value2" in r.message


@pytest.mark.parametrize("op", ["eq", "gte", "lte"])
async def test_a_date_word_with_an_equality_or_range_op_is_refused(op):
    r = await _validate({"field": "source_created", "op": op, "value": "2025-10-01"})
    assert isinstance(r, sdt.FilterRefusal)
    for word in ("before", "after", "between"):
        assert word in r.message
    assert {"before", "after", "between"} <= set(r.allowed)


async def test_relative_date_spans_are_coerced_to_whole_numbers():
    out = await _validate({"field": "added", "op": "within_next", "value": "7", "unit": "days"})
    assert out == [{"field": "added", "op": "within_next", "value": 7, "unit": "days"}]
    out = await _validate({"field": "date", "op": "older_than", "value": "3", "unit": "months"})
    assert out == [{"field": "date", "op": "older_than", "value": 3, "unit": "months"}]
    r = await _validate({"field": "added", "op": "within_next", "value": "seven", "unit": "days"})
    assert isinstance(r, sdt.FilterRefusal)


async def test_a_custom_field_keyed_like_a_date_word_is_shadowed_by_the_date_word(monkeypatch):
    # Pitfall 14 — `added` is a def here, but the date word wins: it is treated as Find's
    # timestamptz date (so `eq` is refused as a DATE op), and never routed as a custom string.
    calls: list = []
    r = await _validate(
        {"field": "added", "op": "eq", "value": "yesterday"}, stored={"added": ["Yesterday"]},
        calls=calls, monkeypatch=monkeypatch,
    )
    assert isinstance(r, sdt.FilterRefusal) and "between" in r.message
    out = await _validate(
        {"field": "added", "op": "between", "value": "2025-10-01", "value2": "2025-10-31"},
        calls=calls, monkeypatch=monkeypatch,
    )
    assert out == [{"field": "added", "op": "between", "value": "2025-10-01", "value2": "2025-10-31"}]
    assert calls == []


# ── source fence (import-cycle rule, Pitfall 5) ─────────────────────────────────────────────────


def test_no_module_level_import_of_the_resolver_compiler_or_search_service():
    path = pathlib.Path(sdt.__file__)
    tree = ast.parse(path.read_text(encoding="utf-8"))
    forbidden = {
        "app.services.document_view_resolver",
        "app.services.document_search_service",
        "app.services.view_filter_compiler",
    }
    offenders = [
        ast.dump(node) for node in tree.body
        if isinstance(node, ast.ImportFrom) and node.module in forbidden
    ]
    assert offenders == []
