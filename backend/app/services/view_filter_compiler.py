"""The filter-AST → metadata_filter compiler — the net-new component of Phase 113.

A PURE module (no I/O, no DB, no ``eval``, no string interpolation of field names
OR values). It transforms a validated :class:`~app.models.document_view.ViewFilter`
AST into a single ``metadata_filter`` jsonb dict that the resolve route binds as
one ``$1::jsonb`` via supabase-py ``.contains("metadata", filter_dict)``
(``metadata @> $1::jsonb``). The attacker-controlled value rides as a JSON literal
matched by ``@>`` — it is NEVER concatenated into SQL or rendered as a template
(SC#4).

Two mechanisms, both cloned from shipped harness code:

1. **Closed operator registry** (mirrors ``harness/validators.py`` ``VALIDATOR_REGISTRY``
   + ``@register_validator``): a closed ``OPERATOR_REGISTRY`` dict + a
   ``register_operator`` decorator. Phase 113 registers ONLY ``eq``; an op not in
   the registry fails closed (``KeyError``) at compile — never ``eval``'d /
   ``getattr``'d / dynamically imported. Phase 114 adds ``gte`` / ``lte`` /
   ``one_of`` / ``contains`` / ``is_empty`` / relative-date operators PURELY
   ADDITIVELY by importing an extra ops module ONCE (the seam noted below) — the
   ``eq`` path and the AST shape are untouched (D-113-6 "no compiler rewrite").

2. **Bound-literal parameterization** (mirrors ``harness/freshness.py``'s
   ``ANY($1::uuid[])`` ``$N``-placeholder discipline): the ``eq`` path produces a
   plain ``{field: value}`` dict contribution. The resolve route binds the folded
   dict as a single param via ``.contains()`` — the compiler itself never touches
   SQL. There is no f-string SQL, no ``.format()``-into-query anywhere here.

Field-name safety lives in :func:`validate_fields` (save-time): a ``_``-prefixed
field (``_confidence`` / ``_source`` — display-only nested keys, the D-111-9 /
D-112-D02 invariant) or a field not in the live whitelist raises ``ValueError``
(the router maps it to 422). This mirrors ``documents.py:1401`` exactly.
"""

from __future__ import annotations

from typing import Callable

from app.models.document_view import ViewFilter

__all__ = [
    "OPERATOR_REGISTRY",
    "register_operator",
    "compile_filter",
    "validate_fields",
]


# ── closed operator registry (mirror harness/validators.py VALIDATOR_REGISTRY) ─
# op -> fn(field, value) -> partial metadata_filter contribution. A CLOSED dict:
# an op not present is NEVER eval'd / dynamically imported — compile_filter raises
# KeyError on a registry miss (fail closed, defense-in-depth even though Pydantic
# Literal["eq"] already rejects unknown ops at parse).
OPERATOR_REGISTRY: dict[str, Callable[[str, object], dict]] = {}


def register_operator(op: str) -> Callable[
    [Callable[[str, object], dict]], Callable[[str, object], dict]
]:
    """Decorator: register an operator fn under ``op`` in :data:`OPERATOR_REGISTRY`."""

    def deco(fn: Callable[[str, object], dict]) -> Callable[[str, object], dict]:
        OPERATOR_REGISTRY[op] = fn
        return fn

    return deco


@register_operator("eq")
def _op_eq(field: str, value: object) -> dict:
    """``eq`` contributes ``{field: value}`` to the metadata_filter jsonb.

    The value is placed into a plain dict UNCHANGED — it is later bound as one
    ``$1::jsonb`` param by the resolve route's ``.contains()`` call, never
    interpolated into SQL or a JSON literal string (SC#4).
    """
    return {field: value}


# Phase 114 SEAM: add the additive operators by importing an extra module ONCE
# here (e.g. ``from . import view_operators_extra  # noqa: F401``) so its
# @register_operator("gte") / ("one_of") / ... side-effects populate the registry.
# Phase 113 registers ONLY ``eq`` + the AST honors ONLY ``and`` — no rewrite of
# this file is needed to widen the operator set (D-113-6).


def compile_filter(flt: ViewFilter) -> dict:
    """Fold every condition into ONE ``metadata_filter`` jsonb dict (resolve-time).

    The ``eq``-only path is AND-of-keys (JSONB containment is implicitly AND), so
    multiple ``eq`` conditions under ``op:and`` merge into ``{k1: v1, k2: v2}``
    (VIEW-04). An empty ``conditions`` list returns ``{}`` — the caller skips
    ``.contains()`` entirely (no narrowing, D-113-9). An op NOT in
    :data:`OPERATOR_REGISTRY` raises ``KeyError`` (fail closed, Pitfall 5).
    """
    metadata_filter: dict = {}
    for c in flt.conditions:
        fn = OPERATOR_REGISTRY.get(c.op)  # closed lookup; unknown -> None
        if fn is None:
            raise KeyError(f"operator {c.op!r} not registered")  # FAIL CLOSED
        metadata_filter.update(fn(c.field, c.value))  # eq -> {field: value}
    return metadata_filter  # {} when empty -> caller skips .contains()


def validate_fields(flt: ViewFilter, whitelist: set[str]) -> None:
    """Save-time field validation (D-113-10). Raises ``ValueError`` (router → 422).

    A ``_``-prefixed field is rejected UNCONDITIONALLY — ``_confidence`` / ``_source``
    are display-only nested provenance keys, NEVER a filter dimension (the D-111-9 /
    D-112-D02 invariant; mirrors ``documents.py:1401``). A field not in the live
    whitelist (built-ins ∪ enabled custom defs, assembled by the router) is also
    rejected. A field valid-at-save but later deleted naturally matches zero docs
    via ``@>`` at resolve — non-fatal, handled at the resolve layer, not here.
    """
    for c in flt.conditions:
        if c.field.startswith("_"):
            raise ValueError(f"field {c.field!r} is not filterable (reserved prefix)")
        if c.field not in whitelist:
            raise ValueError(f"unknown filter field {c.field!r}")
