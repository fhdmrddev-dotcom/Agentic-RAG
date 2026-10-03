"""Phase 272 code-review fixes (272-REVIEW.md) — one section per finding, each driven RED first.

Every case here failed against the code the review read (HEAD ``a84f6e9e5``) and passes after its
``fix(272): <ID>`` commit. The sections are kept apart so a later change can retire ONE finding's
fence by name without touching the rest.

No database: ``defs`` / ``whitelist`` / ``number_fields`` are passed explicitly and every resolver
edge is patched where it is USED (``search_documents_tool``), the 272-04 convention. The
behaviour that needs real stored data (CR-01's array match) is proven on the live local DB in
``tests/integration/test_272_scope_rls.py``.
"""
from __future__ import annotations

import pytest

import app.services.search_documents_tool as sdt
from app.services import retrieval_scope as rscope

USER = "user-1"

DEFS = [
    {"field_key": "legal_entity", "field_type": "enum", "options": ["Acme GmbH", "Beta Ltd"], "enabled": True},
    {"field_key": "client", "field_type": "string", "options": None, "enabled": True},
    {"field_key": "amount", "field_type": "number", "options": None, "enabled": True},
    {"field_key": "contract_end", "field_type": "date", "options": None, "enabled": True},
]
BUILTINS = {"title", "author", "date", "document_type", "topics", "language", "summary"}
WHITELIST = BUILTINS | {"legal_entity", "client", "amount", "contract_end"}
NUMBER_FIELDS = {"amount"}


def _conds(*entries, metadata_filter=None):
    args: dict = {"query": "q", "filters": list(entries)}
    if metadata_filter is not None:
        args["metadata_filter"] = metadata_filter
    parsed = sdt.parse_filter_args(args)
    assert isinstance(parsed, list), parsed
    return parsed


async def _validate(*entries, stored=None, calls=None, monkeypatch=None, metadata_filter=None):
    if monkeypatch is not None:
        async def _fake(*, user_id, field, value, limit=10):
            if calls is not None:
                calls.append((field, value))
            return list((stored or {}).get(field, {}).get(value.lower(), []))

        monkeypatch.setattr(sdt, "canonical_stored_values", _fake)
    return await sdt.validate_and_canonicalise(
        _conds(*entries, metadata_filter=metadata_filter), user_id=USER, supabase=object(),
        defs=DEFS, whitelist=WHITELIST, number_fields=NUMBER_FIELDS,
    )


# ═════════════════════════════════════════════════════════════════════════════════════════════
# CR-01 — `topics` is a stored ARRAY: `eq` must match an element, `one_of` is refused
# ═════════════════════════════════════════════════════════════════════════════════════════════


async def test_cr01_topics_one_of_is_refused_naming_eq():
    r = await _validate({"field": "topics", "op": "one_of", "values": ["tax", "audit"]})
    assert isinstance(r, sdt.FilterRefusal), r
    assert r.field == "topics"
    assert "eq" in r.allowed
    assert "list" in r.message and "eq" in r.message


@pytest.mark.parametrize("op", ["gte", "lte", "before", "after"])
async def test_cr01_topics_range_ops_are_refused(op):
    r = await _validate({"field": "topics", "op": op, "value": "tax"})
    assert isinstance(r, sdt.FilterRefusal) and r.field == "topics"


async def test_cr01_topics_eq_contains_and_is_empty_are_accepted():
    out = await _validate(
        {"field": "topics", "op": "eq", "value": "tax"},
        {"field": "topics", "op": "contains", "value": "aud"},
        {"field": "topics", "op": "is_empty"},
    )
    assert out == [
        {"field": "topics", "op": "eq", "value": "tax"},
        {"field": "topics", "op": "contains", "value": "aud"},
        {"field": "topics", "op": "is_empty"},
    ]


def test_cr01_a_legacy_topics_list_keeps_its_pre_272_all_of_meaning():
    # Pre-272 the legacy metadata_filter was `metadata @> {...}`: a list meant EVERY listed topic.
    parsed = _conds(metadata_filter={"topics": ["tax", "audit"]})
    assert [(c.field, c.op, c.value) for c in parsed] == [("topics", "eq", "tax"), ("topics", "eq", "audit")]


def test_cr01_the_resolver_matches_an_array_element_not_the_array_text():
    # The compiler's `eq` is a scalar `@>` containment, which never matches an array; the resolver
    # hands it a case-insensitive match on the JSON-quoted ELEMENT instead (`%"tax"%` matches
    # `["Tax", "audit"]` and never `["taxation"]`).
    assert rscope._compiler_condition({"field": "topics", "op": "eq", "value": "tax"}) == {
        "field": "topics", "op": "contains", "value": '"tax"',
    }
    # LIKE metacharacters in the value are literal, never wildcards.
    assert rscope._compiler_condition({"field": "topics", "op": "eq", "value": "50%_off"}) == {
        "field": "topics", "op": "contains", "value": '"50\\%\\_off"',
    }
    # Every other field is handed through untouched.
    same = {"field": "legal_entity", "op": "eq", "value": "Acme GmbH"}
    assert rscope._compiler_condition(same) == same


def test_cr01_the_resolver_refuses_a_list_op_it_cannot_honour():
    from app.services.document_view_resolver import ResolveError

    with pytest.raises(ResolveError, match="list"):
        rscope._compiler_condition({"field": "topics", "op": "one_of", "values": ["tax"]})


def test_cr01_the_schema_says_topics_is_a_list():
    from app.services.openai_service import SEARCH_DOCUMENTS_TOOL

    desc = SEARCH_DOCUMENTS_TOOL["function"]["parameters"]["properties"]["filters"]["description"]
    assert "`topics` is a list" in desc


def test_cr01_list_fields_are_exactly_the_list_typed_builtins():
    from app.models.document import DocumentMetadata

    listy = {n for n, f in DocumentMetadata.model_fields.items() if "list" in str(f.annotation).lower()}
    assert set(rscope.LIST_FIELDS) == listy == {"topics"}
