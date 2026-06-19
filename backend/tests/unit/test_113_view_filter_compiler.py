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

R-114-A — the compile-output contract WIDENED in Phase 114: ``compile_filter`` now
returns an ordered ``list[Fragment]`` of bound WHERE-fragment descriptors, NOT a
single ``metadata @> $1::jsonb`` containment dict. The three containment-dict
tests below were rewritten to the Fragment shape (an ``eq`` on ``document_type``
→ ONE typed-leg Fragment on the promoted ``document_type_norm`` column with a
lowercased value; two AND conditions → an ordered two-Fragment list; an empty
``conditions`` list → ``[]``). The SC#4 injection test stays green in spirit — the
SQL/SSTI/JNDI payload rides as the exact BOUND LITERAL in the Fragment value
(byte-for-byte), never executed / interpolated / templated. The ``op``/field-name
guards (``test_unknown_op_rejected``, ``test_unknown_field_rejected_at_save``,
``test_underscore_field_excluded``) are unchanged — an unknown op is rejected at
parse (Pydantic ``Literal``) AND fails closed at compile (``KeyError``); an unknown
or ``_``-prefixed field is rejected at save by ``validate_fields`` (``ValueError``).
"""

from __future__ import annotations

import pytest


def test_eq_compiles():
    """SC#2 / D-113-6 / R-114-A: a single ``eq`` condition compiles to ONE typed-leg
    Fragment. The widened contract (114): ``compile_filter`` returns a
    ``list[Fragment]``, not a ``{field: value}`` containment dict. ``document_type``
    rides the promoted, indexed ``document_type_norm`` column with a LOWERCASED
    value (case-insensitive exact, D-114-10)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="document_type", op="eq", value="invoice")],
    )
    frags = compile_filter(flt)
    assert isinstance(frags, list) and len(frags) == 1
    f = frags[0]
    assert f.leg == "typed"
    assert f.field == "document_type_norm"
    assert f.builder == "eq"
    assert f.value == "invoice"


def test_and_folds_conditions():
    """SC#2 / VIEW-04 / R-114-A: two conditions under ``op:and`` produce an ORDERED
    ``list[Fragment]`` — one Fragment per AND condition (flat-AND preserved; the
    resolve route chains the builder calls, PostgREST ANDs filters). ``document_type``
    → indexed typed leg (lowercased); ``author`` (free-text) → case-insensitive
    ``ilike`` custom leg (D-114-10)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    flt = ViewFilter(
        op="and",
        conditions=[
            ViewCondition(field="document_type", op="eq", value="invoice"),
            ViewCondition(field="author", op="eq", value="Acme"),
        ],
    )
    frags = compile_filter(flt)
    assert isinstance(frags, list) and len(frags) == 2
    # Order preserved (flat AND).
    dt, author = frags
    assert dt.leg == "typed" and dt.field == "document_type_norm" and dt.value == "invoice"
    assert author.leg == "custom" and author.field == "author" and author.builder == "ilike"


def test_empty_filter_no_narrowing():
    """D-113-9 / R-114-A: an empty ``conditions`` list compiles to ``[]`` (no
    narrowing) — VALID, not rejected (the caller applies no filter)."""
    from app.models.document_view import ViewFilter
    from app.services.view_filter_compiler import compile_filter

    flt = ViewFilter(op="and", conditions=[])
    frags = compile_filter(flt)
    assert frags == []


def test_unknown_op_rejected():
    """D-113-6 / Pitfall 5: an unknown op is rejected at BOTH layers —
    Pydantic ``Literal`` rejects at parse, and a registry miss fails closed
    (``KeyError``) at compile (defense-in-depth, never eval'd)."""
    from pydantic import ValidationError

    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    # Layer 1 — the Literal-discriminated ``ViewCondition.op`` rejects a condition op
    # outside the closed set at parse. R-114-A: ``gte`` is now a VALID widened
    # operator, so the example is swapped to ``regex`` (genuinely not in the Literal).
    with pytest.raises(ValidationError):
        ViewFilter.model_validate(
            {"op": "and", "conditions": [{"field": "x", "op": "regex", "value": 1}]}
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


def test_injection_value_neutralized():
    """SC#4 (first-class): a SQL/SSTI/JNDI payload in a VALUE rides as a BOUND
    LITERAL in the Fragment — never executed / interpolated / templated. R-114-A:
    only the wrapper shape changed (``list[Fragment]`` not a dict); the byte-for-byte
    value check is preserved. ``title`` (free-text, ``ilike`` exact, no wildcards) is
    used so the value is untouched — the typed ``document_type`` leg lowercases its
    value (case-insensitivity), which is not the right field for a byte-for-byte
    proof."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    payload = "'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}"
    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="title", op="eq", value=payload)],
    )
    frags = compile_filter(flt)
    # Exact literal in the bound Fragment value — no SQL executed, no template
    # rendered, no substitution. The resolve route binds frags[0].value as a
    # PostgREST param; it is never concatenated into SQL.
    assert len(frags) == 1
    assert frags[0].value == payload  # byte-for-byte — the payload rides as a literal
    assert frags[0].field == "title"  # field name is a constant, never interpolated
