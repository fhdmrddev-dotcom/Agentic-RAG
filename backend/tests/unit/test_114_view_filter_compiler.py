"""Phase 114 (VIEW-03) — the widened filter-AST → Fragment compiler.

Wave 0 RED scaffold (Plan 01 Task 1). These tests target the widened
``compile_filter`` (returns ``list[Fragment]``) + the ``Fragment`` dataclass
that Task 2 lands in ``app.services.view_filter_compiler``, the additive
operators (``gte``/``lte``/``one_of``/``contains``/``is_empty``/relative-date)
that Task 2 registers in ``app.services.view_operators_extra`` via the
``view_filter_compiler.py:79`` SEAM, and the additively-widened AST
(``ViewCondition.op`` Literal + optional ``value2``/``values``/``unit``) that
Task 1 lands in ``app.models.document_view``.

CONVENTION (mirrors ``test_113_view_filter_compiler.py`` + the 098/099/101.1/102
un-mark-on-landing convention): ``from app... import ...`` is INSIDE each test
body so a not-yet-existing symbol never breaks COLLECTION; the suite exits 0
today (xfailed, never errored on collection). Each test that asserts
not-yet-built behavior is ``@pytest.mark.xfail(strict=False)``; Task 2 un-marks
each stub to GREEN. The relative-date WINDOW math (today→today+N) is deferred to
the resolve route (Plan 02, server clock per D-114-16) — those tests stay
``xfail(strict=False)`` through this plan (the compiler only carries N + unit).

The assertions are written to the FINAL contract (per the RESEARCH §"Operator →
Fragment Mapping" table): ``compile_filter`` returns an ordered ``list[Fragment]``
(one or more per condition); each ``Fragment`` carries ``leg`` ∈
{typed,custom,containment}, ``field`` (a whitelisted name — never interpolated
into raw SQL), ``builder`` ∈ {eq,gte,lte,ilike,is_,or_,contains}, ``value`` (a
bound literal), and an optional ``value2`` (for ``between``). ``document_type``
matches case-INSENSITIVELY via a lowercased VALUE on the typed
``document_type_norm`` leg (indexed, D-114-10); free-text matches via ``ilike``.
A SQL/SSTI payload rides as the exact bound literal in the Fragment (SC#4); an
op not in the registry still fails closed (``KeyError``, Pitfall 5).
"""

from __future__ import annotations

import pytest

# ── AST widening (Task 1 — lands in this plan, NOT xfailed) ────────────────────


def test_ast_accepts_all_eleven_operators():
    """Task 1 / D-113-6: the widened ``ViewCondition.op`` Literal accepts each of
    the eleven VIEW-03 operators additively (no shape break)."""
    from app.models.document_view import ViewCondition, ViewFilter

    ops = [
        "eq",
        "gte",
        "lte",
        "one_of",
        "contains",
        "is_empty",
        "within_next",
        "older_than",
        "before",
        "after",
        "between",
    ]
    for op in ops:
        # ``value`` is now optional (is_empty carries none); a scalar is always valid.
        ViewFilter(
            op="and",
            conditions=[ViewCondition(field="date", op=op, value=1)],
        )


def test_pre_114_eq_row_still_parses():
    """Task 1 / D-113-6 payoff: a pre-114 stored row
    ``{op:and, conditions:[{field, op:eq, value}]}`` validates unchanged under the
    additively-widened AST (the new operators are additive Literal members; the
    optional operands default-absent)."""
    from app.models.document_view import ViewFilter

    row = {
        "op": "and",
        "conditions": [{"field": "document_type", "op": "eq", "value": "invoice"}],
    }
    flt = ViewFilter.model_validate(row)
    assert flt.conditions[0].op == "eq"
    assert flt.conditions[0].value == "invoice"
    # Optional operands default absent (so old rows have no value2/values/unit).
    assert flt.conditions[0].value2 is None
    assert flt.conditions[0].values is None
    assert flt.conditions[0].unit is None


def test_or_combinator_still_rejected():
    """Task 1: ``ViewFilter.op`` stays ``Literal["and"]`` — ``or`` is still rejected
    at parse (OR/NOT deferred)."""
    from pydantic import ValidationError

    from app.models.document_view import ViewFilter

    with pytest.raises(ValidationError):
        ViewFilter.model_validate({"op": "or", "conditions": []})


def test_one_of_carries_values_between_carries_value2():
    """Task 1: ``one_of`` carries an optional ``values`` list; ``between`` carries an
    optional ``value2``; relative ops carry an optional ``unit`` — all additive."""
    from app.models.document_view import ViewCondition, ViewFilter

    flt = ViewFilter(
        op="and",
        conditions=[
            ViewCondition(field="document_type", op="one_of", values=["invoice", "receipt"]),
            ViewCondition(field="date", op="between", value="2026-01-01", value2="2026-12-31"),
            ViewCondition(field="date", op="within_next", value=90, unit="days"),
        ],
    )
    assert flt.conditions[0].values == ["invoice", "receipt"]
    assert flt.conditions[1].value2 == "2026-12-31"
    assert flt.conditions[2].unit == "days"


# ── widened compiler output: per-operator Fragment (Task 2 — xfail until landed) ─


def test_eq_document_type_typed_leg_lowercased():
    """Task 2 / D-114-10: ``eq`` on ``document_type`` → a typed-leg Fragment on
    ``document_type_norm`` with a LOWERCASED value (indexed, case-insensitive)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="document_type", op="eq", value="Invoice")],
    )
    frags = compile_filter(flt)
    assert isinstance(frags, list) and len(frags) == 1
    f = frags[0]
    assert f.leg == "typed"
    assert f.field == "document_type_norm"
    assert f.builder == "eq"
    assert f.value == "invoice"  # lowercased query value (Pitfall 3 — indexed path)


def test_eq_boolean_custom_keeps_containment():
    """Task 2: ``eq`` on a boolean custom field keeps the ``@>`` containment fast
    path (case-sensitive exact is correct there)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="is_signed", op="eq", value=True)],
    )
    frags = compile_filter(flt)
    assert len(frags) == 1
    assert frags[0].leg == "containment"
    assert frags[0].value is True


def test_eq_free_text_ilike():
    """Task 2 / D-114-10: ``eq`` on free-text (title) → a case-insensitive ``ilike``
    Fragment (the un-normalized fields get lower-on-both-sides semantics)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="title", op="eq", value="Annual Report")],
    )
    frags = compile_filter(flt)
    assert len(frags) == 1
    assert frags[0].builder == "ilike"
    assert frags[0].leg == "custom"


def test_gte_lte_on_date_typed_leg():
    """Task 2: ``gte``/``lte`` on the built-in ``date`` → typed-leg Fragments on
    ``date_typed`` (the indexed range fast path)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    gte = compile_filter(
        ViewFilter(op="and", conditions=[ViewCondition(field="date", op="gte", value="2026-01-01")])
    )
    lte = compile_filter(
        ViewFilter(op="and", conditions=[ViewCondition(field="date", op="lte", value="2026-12-31")])
    )
    assert gte[0].leg == "typed" and gte[0].field == "date_typed" and gte[0].builder == "gte"
    assert lte[0].leg == "typed" and lte[0].field == "date_typed" and lte[0].builder == "lte"


def test_gte_on_custom_number_cast_leg():
    """Task 2: ``gte`` on a custom number field → a custom-leg cast Fragment on
    ``metadata->>'field'`` (correct but non-indexed)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    frags = compile_filter(
        ViewFilter(op="and", conditions=[ViewCondition(field="page_count", op="gte", value=10)])
    )
    assert frags[0].leg == "custom"
    assert frags[0].field == "page_count"
    assert frags[0].builder == "gte"
    assert frags[0].value == 10


def test_one_of_or_group_lowercased():
    """Task 2 / D-113-7 / D-114-10: ``one_of`` on ``document_type`` → an OR-group
    Fragment over one field with lowercased values."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    frags = compile_filter(
        ViewFilter(
            op="and",
            conditions=[
                ViewCondition(field="document_type", op="one_of", values=["Invoice", "Receipt"])
            ],
        )
    )
    # An OR-group fragment carries the lowercased membership list as its value(s).
    assert len(frags) == 1
    f = frags[0]
    assert f.builder == "or_"
    assert "invoice" in (f.value if isinstance(f.value, (list, tuple)) else [])
    assert "receipt" in (f.value if isinstance(f.value, (list, tuple)) else [])


def test_contains_ilike_substring():
    """Task 2 / D-114-11: ``contains`` → an ``ilike`` ``%v%`` substring Fragment."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    frags = compile_filter(
        ViewFilter(op="and", conditions=[ViewCondition(field="title", op="contains", value="report")])
    )
    assert frags[0].builder in ("ilike", "contains")
    # The substring wildcards ride in the bound value (no f-string SQL).
    assert "report" in str(frags[0].value)


def test_is_empty_or_group():
    """D-114-12: ``is_empty`` → a custom-leg Fragment with a DISTINCT
    ``builder="is_empty"`` marker (absent OR ``''``/``[]``).

    Plan 02 contract: ``is_empty`` carries ``builder="is_empty"`` (NOT ``"or_"``,
    which the resolve route reserves for ``one_of`` membership) so the resolve-route
    dispatch is unambiguous — it expands ``is_empty`` to an ``.or_(…is.null,…eq.,…eq.[])``
    predicate whose RHS tokens are HARD-CODED, never user input."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    frags = compile_filter(
        ViewFilter(op="and", conditions=[ViewCondition(field="author", op="is_empty")])
    )
    assert len(frags) == 1
    assert frags[0].leg == "custom" and frags[0].field == "author"
    assert frags[0].builder == "is_empty", "is_empty carries its own distinct builder marker"


def test_between_carries_value2():
    """Task 2: ``between`` on ``date`` → a Fragment carrying value + value2 on
    ``date_typed``."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    frags = compile_filter(
        ViewFilter(
            op="and",
            conditions=[
                ViewCondition(field="date", op="between", value="2026-01-01", value2="2026-12-31")
            ],
        )
    )
    # between may yield one Fragment with value+value2, or two bound fragments.
    vals = [(f.value, f.value2) for f in frags]
    assert any("2026-01-01" in str(v) for v, _ in vals)
    assert any("2026-12-31" in str(v2) for _, v2 in vals) or any(
        "2026-12-31" in str(v) for v, _ in vals
    )


def test_before_after_compile_to_date_bounds():
    """Task 2: fixed ``before``/``after`` on ``date`` → ``lte``/``gte`` typed-leg
    Fragments on ``date_typed``."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    before = compile_filter(
        ViewFilter(op="and", conditions=[ViewCondition(field="date", op="before", value="2026-06-01")])
    )
    after = compile_filter(
        ViewFilter(op="and", conditions=[ViewCondition(field="date", op="after", value="2026-06-01")])
    )
    assert before[0].builder == "lte" and before[0].field == "date_typed"
    assert after[0].builder == "gte" and after[0].field == "date_typed"


# ── relative-date: compiler carries N + unit; WINDOW math deferred to Plan 02 ───


@pytest.mark.xfail(strict=False, reason="Relative-date window math deferred to Plan 02 (server clock, D-114-16)")
def test_within_next_window_math_deferred():
    """Plan 02 (D-114-16): the today→today+N window is computed server-side at
    resolve time. The compiler only carries N + unit; this asserts the resolved
    window (a Plan-02 behavior) — stays xfail through Plan 01."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    frags = compile_filter(
        ViewFilter(
            op="and",
            conditions=[ViewCondition(field="date", op="within_next", value=90, unit="days")],
        )
    )
    # Plan 02 resolves these to today/today+90 bound dates; here they are still N+unit.
    assert any(getattr(f, "value", None) is not None for f in frags)
    # The window resolution itself (a date string) is NOT present in Plan 01 output.
    assert any("-" in str(getattr(f, "value", "")) for f in frags)  # xfail until Plan 02


# ── case-insensitive matching (Task 2) ─────────────────────────────────────────


def test_case_insensitive_document_type_value_lowercased():
    """Task 2 / D-114-10 / Pitfall 3: ``document_type`` is matched by a LOWERCASED
    query value on the indexed typed leg — NOT ``ilike`` (which would defeat the
    btree index)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    frags = compile_filter(
        ViewFilter(op="and", conditions=[ViewCondition(field="document_type", op="eq", value="INVOICE")])
    )
    f = frags[0]
    assert f.leg == "typed"
    assert f.builder == "eq"  # indexed exact, NOT ilike
    assert f.value == "invoice"


def test_case_insensitive_free_text_ilike():
    """Task 2 / D-114-10: a genuinely un-normalized free-text field (author) gets
    a case-insensitive ``ilike`` Fragment, not value-lowercasing."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    frags = compile_filter(
        ViewFilter(op="and", conditions=[ViewCondition(field="author", op="eq", value="Acme")])
    )
    assert frags[0].builder == "ilike"
    assert frags[0].leg == "custom"


# ── SC#4 injection rides as a bound literal in the new Fragment shape (Task 2) ──


def test_injection_value_rides_as_bound_literal():
    """SC#4: a SQL/SSTI/JNDI payload in a VALUE compiles to exactly that literal in
    the Fragment ``value`` — never executed / interpolated / templated. The bound
    literal is preserved byte-for-byte (the typed leg lowercases ``document_type``,
    so the payload is asserted on a free-text field where the value is untouched)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    payload = "'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}"
    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="title", op="eq", value=payload)],
    )
    frags = compile_filter(flt)
    f = frags[0]
    # The payload rides as a bound literal — for ``ilike`` the wildcards are absent
    # on an ``eq`` (case-insensitive exact), so the literal contains the payload verbatim.
    assert payload in str(f.value)  # byte-for-byte present, never templated/executed


def test_unknown_op_still_fails_closed_after_widening():
    """Task 2 / Pitfall 5: after the widening, a smuggled op NOT in the registry
    still fails closed (``KeyError``). The widened Literal just gains members; the
    closed dispatch stays closed."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import compile_filter

    smuggled = ViewFilter.model_construct(
        op="and",
        conditions=[ViewCondition.model_construct(field="x", op="regex", value="1")],
    )
    with pytest.raises(KeyError):
        compile_filter(smuggled)


# ── operand validation (114 review WR-01 / WR-02) ──────────────────────────────


def test_validate_operands_rejects_range_on_custom_number():
    """WR-01: a range op on a CUSTOM NUMBER field is rejected (the custom leg compares
    metadata->>'field' lexically, not numerically — no clean cast via supabase-py)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import validate_operands

    for op in ("gte", "lte", "between", "before", "after"):
        flt = ViewFilter(
            op="and",
            conditions=[ViewCondition(field="amount", op=op, value=100, value2=200)],
        )
        with pytest.raises(ValueError, match="numeric field"):
            validate_operands(flt, number_custom_fields={"amount"})


def test_validate_operands_allows_eq_on_custom_number():
    """WR-01: equality (and is_empty) on a custom number field is still allowed —
    only ORDER comparisons are lexically wrong."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import validate_operands

    validate_operands(
        ViewFilter(op="and", conditions=[ViewCondition(field="amount", op="eq", value=100)]),
        number_custom_fields={"amount"},
    )
    validate_operands(
        ViewFilter(op="and", conditions=[ViewCondition(field="amount", op="is_empty")]),
        number_custom_fields={"amount"},
    )


def test_validate_operands_allows_range_on_builtin_date():
    """WR-01: the promoted built-in ``date`` uses the typed date_typed column (numeric/
    indexed, correct) — range ops on it are NOT rejected (date is not a custom number)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import validate_operands

    validate_operands(
        ViewFilter(op="and", conditions=[ViewCondition(field="date", op="between",
                                                       value="2026-01-01", value2="2026-12-31")]),
        number_custom_fields={"amount"},  # date is not in the numeric set
    )


def test_validate_operands_rejects_empty_one_of():
    """WR-02: an empty ``one_of`` membership list (→ .in_(col, []) malformed/over-broad)
    is rejected rather than reaching _apply."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import validate_operands

    for empty in ([], None):
        flt = ViewFilter(
            op="and",
            conditions=[ViewCondition(field="document_type", op="one_of", values=empty)],
        )
        with pytest.raises(ValueError, match="at least one value"):
            validate_operands(flt)


def test_validate_operands_requires_between_bounds():
    """WR-02: ``between`` requires BOTH a start and an end value."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import validate_operands

    # missing value2
    with pytest.raises(ValueError, match="both a start and an end"):
        validate_operands(
            ViewFilter(op="and", conditions=[ViewCondition(field="date", op="between", value="2026-01-01")])
        )
    # missing value
    with pytest.raises(ValueError, match="both a start and an end"):
        validate_operands(
            ViewFilter(op="and", conditions=[ViewCondition(field="date", op="between", value2="2026-12-31")])
        )


def test_validate_operands_requires_scalar_for_eq_gte():
    """WR-02: ``eq``/``gte``/``lte``/``before``/``after``/``contains`` require a scalar
    value — a missing scalar would reach getattr(q, builder)(col, None)."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import validate_operands

    for op in ("eq", "gte", "lte", "before", "after", "contains"):
        with pytest.raises(ValueError, match="requires a value"):
            validate_operands(
                ViewFilter(op="and", conditions=[ViewCondition(field="title", op=op)])
            )


def test_validate_operands_relative_requires_numeric_amount():
    """WR-02: relative ops (within_next/older_than) require a numeric N amount."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import validate_operands

    # valid numeric N passes
    validate_operands(
        ViewFilter(op="and", conditions=[ViewCondition(field="date", op="within_next", value=90, unit="days")])
    )
    # missing N rejected
    with pytest.raises(ValueError, match="numeric amount"):
        validate_operands(
            ViewFilter(op="and", conditions=[ViewCondition(field="date", op="older_than", unit="days")])
        )


def test_validate_operands_happy_path_no_raise():
    """A well-formed multi-condition filter (no custom numbers) validates cleanly."""
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.view_filter_compiler import validate_operands

    validate_operands(
        ViewFilter(
            op="and",
            conditions=[
                ViewCondition(field="document_type", op="eq", value="invoice"),
                ViewCondition(field="document_type", op="one_of", values=["invoice", "receipt"]),
                ViewCondition(field="date", op="between", value="2026-01-01", value2="2026-12-31"),
                ViewCondition(field="author", op="is_empty"),
                ViewCondition(field="date", op="within_next", value=30, unit="days"),
            ],
        ),
        number_custom_fields=set(),
    )
