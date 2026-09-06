"""Phase 114 (VIEW-03) — the additive VIEW-03 operators for the filter compiler.

Imported ONCE by :mod:`app.services.view_filter_compiler` at the documented
``view_filter_compiler.py:79`` SEAM so its ``@register_operator`` side-effects
populate the closed ``OPERATOR_REGISTRY``. Phase 113 registered ONLY ``eq``; this
module adds ``gte`` / ``lte`` / ``one_of`` / ``contains`` / ``is_empty`` /
``within_next`` / ``older_than`` / ``before`` / ``after`` / ``between`` — PURELY
ADDITIVELY. The registry just gains members; the closed dispatch (and its
fail-closed ``KeyError``, Pitfall 5) stays closed.

Each operator fn takes a validated :class:`~app.models.document_view.ViewCondition`
and returns a :class:`~app.services.view_filter_compiler.Fragment` (or a list).
The fn is a PURE transform — NO SQL, NO ``.format()``, NO field-name
interpolation. Every VALUE rides as a bound ``Fragment.value``/``value2`` literal
(SC#4); the resolve route's ``_apply`` is the sole place a builder call happens.

Leg selection (R-114-A / Pitfall 3):
  * promoted ``date`` → the typed indexed ``date_typed`` column (range/date ops);
  * promoted ``document_type`` → ``document_type_norm`` (lowercased value, indexed);
  * ``language`` (already lowercase at write) → custom leg, lowercased value;
  * free-text (``title``/``author``/``summary``) → custom leg, ``ilike``;
  * custom number/date/string/enum → the custom ``metadata->>'field'`` cast/ILIKE leg.

Relative-date operators (``within_next``/``older_than``) DEFER the today→today+N
window math to the resolve route (Plan 02, server clock per D-114-16) — they carry
``value`` = N and ``unit`` only; the dates are NEVER baked here (a saved relative
view must drift with the calendar).
"""

from __future__ import annotations

from app.services.view_filter_compiler import (
    FREE_TEXT_FIELDS,
    NORMALIZED_LOWER_FIELDS,
    PROMOTED_TYPED_COLUMNS,
    Fragment,
    _lower,  # IN-01: single-sourced from the compiler (no duplicate-drift risk)
    register_operator,
)


# ── helpers ────────────────────────────────────────────────────────────────────
def _is_promoted_date(field: str) -> bool:
    """``date`` is promoted to the indexed ``date_typed`` column."""
    return field == "date"


def _range_fragment(field: str, builder: str, value: object) -> Fragment:
    """Build a ``gte``/``lte`` Fragment, choosing the typed (indexed) leg for the
    promoted ``date`` field and the custom (cast) leg for custom number/date."""
    if _is_promoted_date(field):
        return Fragment(leg="typed", field=PROMOTED_TYPED_COLUMNS[field],
                        builder=builder, value=value)
    # custom number/date — non-indexed cast leg on metadata->>'field'
    return Fragment(leg="custom", field=field, builder=builder, value=value)


# ── range operators ─────────────────────────────────────────────────────────────
@register_operator("gte")
def _op_gte(cond) -> Fragment:
    """``gte`` — ``>=`` on a date (typed/indexed) or a custom number (cast leg)."""
    return _range_fragment(cond.field, "gte", cond.value)


@register_operator("lte")
def _op_lte(cond) -> Fragment:
    """``lte`` — ``<=`` on a date (typed/indexed) or a custom number (cast leg)."""
    return _range_fragment(cond.field, "lte", cond.value)


# ── fixed-date before / after (= lte / gte on a fixed ISO date) ──────────────────
@register_operator("before")
def _op_before(cond) -> Fragment:
    """``before`` — a fixed date upper bound (``date_typed <= D``)."""
    return _range_fragment(cond.field, "lte", cond.value)


@register_operator("after")
def _op_after(cond) -> Fragment:
    """``after`` — a fixed date lower bound (``date_typed >= D``)."""
    return _range_fragment(cond.field, "gte", cond.value)


# ── between (carries value + value2) ─────────────────────────────────────────────
@register_operator("between")
def _op_between(cond) -> Fragment:
    """``between`` — ``D1 <= field <= D2``. One Fragment carrying value + value2
    (the resolve route chains ``.gte(value).lte(value2)`` on the same column)."""
    if _is_promoted_date(cond.field):
        return Fragment(leg="typed", field=PROMOTED_TYPED_COLUMNS[cond.field],
                        builder="gte", value=cond.value, value2=cond.value2)
    return Fragment(leg="custom", field=cond.field, builder="gte",
                    value=cond.value, value2=cond.value2)


# ── one_of (OR-group over one field, D-113-7) ────────────────────────────────────
@register_operator("one_of")
def _op_one_of(cond) -> Fragment:
    """``one_of`` — case-insensitive membership over ONE field (D-113-7 / D-114-10).

    An OR-group Fragment (``builder="or_"``) carrying the lowercased membership
    list for normalized fields (``document_type``/``language``); the resolve route
    expands it into ``.or_(field.eq.v1,field.eq.v2,...)`` on a typed column where
    promoted, else ``.in_``/``.or_`` on ``metadata->>'field'``."""
    raw = cond.values or []
    lowered = [_lower(v) for v in raw] if cond.field in NORMALIZED_LOWER_FIELDS else list(raw)
    leg = "typed" if cond.field in PROMOTED_TYPED_COLUMNS else "custom"
    field = PROMOTED_TYPED_COLUMNS.get(cond.field, cond.field)
    # IN-02: the membership rides ONLY in `values` — the resolve route reads
    # `frag.values` for the .in_/.or_ branch. Setting `value` to the list too is
    # misleading (every other op's `value` is a scalar) and invites a future bug.
    return Fragment(leg=leg, field=field, builder="or_", values=lowered)


# ── contains (substring ILIKE %v%, D-114-11) ─────────────────────────────────────
@register_operator("contains")
def _op_contains(cond) -> Fragment:
    """``contains`` — substring match (``ILIKE %v%``, D-114-11), case-insensitive.

    The ``%v%`` wildcards ride in the bound VALUE (no f-string SQL). On the promoted
    ``document_type_norm`` column we still ``ilike`` (substring, not exact)."""
    pattern = f"%{cond.value}%"
    if cond.field in PROMOTED_TYPED_COLUMNS:
        return Fragment(leg="typed", field=PROMOTED_TYPED_COLUMNS[cond.field],
                        builder="ilike", value=pattern)
    return Fragment(leg="custom", field=cond.field, builder="ilike", value=pattern)


# ── is_empty (absent OR ''/[], D-114-12) ─────────────────────────────────────────
@register_operator("is_empty")
def _op_is_empty(cond) -> Fragment:
    """``is_empty`` — a field the model never extracted (key absent) OR set to
    ``''``/``[]`` counts as empty (D-114-12). Carries a DISTINCT ``builder="is_empty"``
    (NOT ``"or_"``, which the resolve route reserves for ``one_of`` membership) so the
    dispatch is unambiguous: the resolve route expands it to an ``.or_(…is.null,…eq.,
    …eq.[])`` predicate on ``metadata->>'field'`` (or is.null on typed columns)."""
    leg = "typed" if cond.field in PROMOTED_TYPED_COLUMNS else "custom"
    field = PROMOTED_TYPED_COLUMNS.get(cond.field, cond.field)
    return Fragment(leg=leg, field=field, builder="is_empty")


# ── relative-date (carry N + unit; window math DEFERRED to resolve, D-114-16) ────
@register_operator("within_next")
def _op_within_next(cond) -> Fragment:
    """``within_next`` — "expiring within N {unit}" (today → today+N, EXCLUDES
    overdue; D-114-5). The window is computed SERVER-SIDE at resolve time from the
    server clock (D-114-16) — this Fragment carries ONLY N (``value``) + ``unit``,
    NEVER a baked date (a saved relative view must drift with the calendar). The
    resolve route (Plan 02) reads ``builder="within_next"`` + value + value2(=unit)
    and expands it to ``.gte(today).lte(today+N)`` on ``date_typed``."""
    return Fragment(leg="typed", field=PROMOTED_TYPED_COLUMNS["date"],
                    builder="within_next", value=cond.value, value2=cond.unit)


@register_operator("older_than")
def _op_older_than(cond) -> Fragment:
    """``older_than`` — document age ``date < today-N`` (D-114-4). Window computed
    server-side at resolve time (D-114-16); carries ONLY N + ``unit``. The resolve
    route expands to ``.lt(today-N)`` on ``date_typed`` — STRICT (WR-03): a doc dated
    EXACTLY ``today-N`` is excluded, matching the D-114-4 ``<`` contract."""
    return Fragment(leg="typed", field=PROMOTED_TYPED_COLUMNS["date"],
                    builder="older_than", value=cond.value, value2=cond.unit)
