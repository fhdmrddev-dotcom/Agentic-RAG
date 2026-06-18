"""Phase 113 (VIEW-04) — the net-new filter-AST → metadata_filter compiler.

Wave 0 RED scaffold (Plan 01 Task 1). These tests target the closed
``OPERATOR_REGISTRY`` + ``compile_filter`` + ``validate_fields`` that Task 3
lands in ``app.services.view_filter_compiler`` and the Pydantic AST
(``ViewCondition``/``ViewFilter``) that Task 2 lands in
``app.models.document_view``.

CONVENTION (mirrors ``test_validator_kinds.py`` + ``test_harness_audit_emit.py``):
``from app... import ...`` is INSIDE each test body so a not-yet-existing symbol
never breaks COLLECTION; the suite exits 0 today (xfailed, never errored on
collection). Each test that asserts not-yet-built behavior is
``@pytest.mark.xfail(strict=False)``; Tasks 2-3 un-mark each stub to GREEN (the
098/099/101.1/102 un-mark-on-landing convention).

The assertions are written to the FINAL contract (per <interfaces>): an ``eq``
condition compiles to ``{field: value}``; multiple ``eq`` under ``op:and`` fold
into ONE metadata_filter dict (AND-of-keys, VIEW-04); an empty conditions list
compiles to ``{}`` (no narrowing, D-113-9); an unknown op is rejected at parse
(Pydantic ``Literal``) AND fails closed at compile (``KeyError``); an unknown or
``_``-prefixed field is rejected at save (``validate_fields`` raises
``ValueError``); and a SQL/SSTI/JNDI payload in a VALUE compiles to the exact
literal — never executed / templated (SC#4).
"""

from __future__ import annotations

import pytest


@pytest.mark.xfail(strict=False, reason="Task 2/3: AST + compiler not landed yet")
def test_eq_compiles():
    """SC#2 / D-113-6: a single ``eq`` condition compiles to ``{field: value}``."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="document_type", op="eq", value="invoice")],
    )
    mf = compile_filter(flt)
    assert mf == {"document_type": "invoice"}


@pytest.mark.xfail(strict=False, reason="Task 2/3: AST + compiler not landed yet")
def test_and_folds_conditions():
    """SC#2 / VIEW-04: two ``eq`` under ``op:and`` fold into ONE metadata_filter
    dict (AND-of-keys — JSONB containment is implicitly AND)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    flt = ViewFilter(
        op="and",
        conditions=[
            ViewCondition(field="document_type", op="eq", value="invoice"),
            ViewCondition(field="author", op="eq", value="Acme"),
        ],
    )
    mf = compile_filter(flt)
    assert mf == {"document_type": "invoice", "author": "Acme"}


@pytest.mark.xfail(strict=False, reason="Task 2/3: AST + compiler not landed yet")
def test_empty_filter_no_narrowing():
    """D-113-9: an empty ``conditions`` list compiles to ``{}`` (no narrowing) —
    VALID, not rejected (the caller skips ``.contains()`` entirely)."""
    from app.models.document_view import ViewFilter
    from app.services.view_filter_compiler import compile_filter

    flt = ViewFilter(op="and", conditions=[])
    mf = compile_filter(flt)
    assert mf == {}


@pytest.mark.xfail(strict=False, reason="Task 2/3: AST + compiler not landed yet")
def test_unknown_op_rejected():
    """D-113-6 / Pitfall 5: an unknown op is rejected at BOTH layers —
    Pydantic ``Literal`` rejects at parse, and a registry miss fails closed
    (``KeyError``) at compile (defense-in-depth, never eval'd)."""
    from pydantic import ValidationError

    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    # Layer 1 — Pydantic Literal["eq"] rejects a condition op != "eq" at parse.
    with pytest.raises(ValidationError):
        ViewFilter.model_validate(
            {"op": "and", "conditions": [{"field": "x", "op": "gte", "value": 1}]}
        )

    # Layer 1 — Pydantic Literal["and"] rejects a combinator op != "and" at parse.
    with pytest.raises(ValidationError):
        ViewFilter.model_validate({"op": "or", "conditions": []})

    # Layer 2 — defense-in-depth: a ViewFilter carrying an op NOT in the registry
    # fails closed at compile. We bypass Pydantic validation (construct=no-validate)
    # to simulate an op that slipped past parse, proving the registry miss raises.
    smuggled = ViewFilter.model_construct(
        op="and",
        conditions=[ViewCondition.model_construct(field="x", op="regex", value="1")],
    )
    with pytest.raises(KeyError):
        compile_filter(smuggled)


@pytest.mark.xfail(strict=False, reason="Task 2/3: AST + compiler not landed yet")
def test_unknown_field_rejected_at_save():
    """D-113-10: ``validate_fields`` with a field NOT in the whitelist raises
    ``ValueError`` (router maps to 422 at save)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import validate_fields

    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="not_a_real_field", op="eq", value="x")],
    )
    whitelist = {"document_type", "author", "title"}
    with pytest.raises(ValueError):
        validate_fields(flt, whitelist)

    # A field IN the whitelist passes cleanly (no raise).
    ok = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="document_type", op="eq", value="invoice")],
    )
    validate_fields(ok, whitelist)  # must not raise


@pytest.mark.xfail(strict=False, reason="Task 2/3: AST + compiler not landed yet")
def test_underscore_field_excluded():
    """D-113-8 / Pitfall 3: a ``_``-prefixed field (``_confidence``/``_source``) is
    rejected by ``validate_fields`` — display-only nested keys are NEVER a filter
    dimension (the D-111-9 / D-112-D02 invariant)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import validate_fields

    # Even when "_confidence" is (wrongly) in the whitelist, the reserved-prefix
    # guard rejects it — the exclusion is unconditional.
    whitelist = {"document_type", "_confidence", "_source"}

    conf = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="_confidence", op="eq", value="high")],
    )
    with pytest.raises(ValueError):
        validate_fields(conf, whitelist)

    src = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="_source", op="eq", value="model")],
    )
    with pytest.raises(ValueError):
        validate_fields(src, whitelist)


@pytest.mark.xfail(strict=False, reason="Task 2/3: AST + compiler not landed yet")
def test_injection_value_neutralized():
    """SC#4 (first-class): a SQL/SSTI/JNDI payload in a VALUE compiles to exactly
    that literal — it rides as a JSON literal, never executed / interpolated /
    templated. Byte-for-byte equality of the value is the proof."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    payload = "'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}"
    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="document_type", op="eq", value=payload)],
    )
    mf = compile_filter(flt)
    # Exact literal — no SQL executed, no template rendered, no substitution.
    assert mf == {"document_type": payload}
    assert mf["document_type"] == payload  # byte-for-byte
