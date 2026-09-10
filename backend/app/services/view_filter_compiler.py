"""The filter-AST → WHERE-fragment compiler — net-new in Phase 113, widened in 114.

A PURE module (no I/O, no DB, no ``eval``, no string interpolation of field names
OR values). It transforms a validated :class:`~app.models.document_view.ViewFilter`
AST into an ordered ``list[Fragment]`` of bound WHERE-fragment descriptors. The
resolve route's ``_apply`` is the SOLE place a supabase-py builder call happens —
every attacker-controlled VALUE rides as a bound PostgREST param (``.eq``/``.gte``/
``.lte``/``.ilike``/...), and every FIELD name is a whitelisted constant. It is
NEVER concatenated into SQL or rendered as a template (SC#4).

Two mechanisms, both cloned from shipped harness code:

1. **Closed operator registry** (mirrors ``harness/validators.py`` ``VALIDATOR_REGISTRY``
   + ``@register_validator``): a closed ``OPERATOR_REGISTRY`` dict + a
   ``register_operator`` decorator. Phase 113 registered ONLY ``eq``; an op not in
   the registry fails closed (``KeyError``) at compile — never ``eval``'d /
   ``getattr``'d / dynamically imported. Phase 114 adds ``gte`` / ``lte`` /
   ``one_of`` / ``contains`` / ``is_empty`` / relative-date operators PURELY
   ADDITIVELY by importing :mod:`app.services.view_operators_extra` ONCE (the seam
   below) — the registry just gains members; the closed dispatch stays closed.

2. **Bound-literal parameterization** (mirrors ``harness/freshness.py``'s
   ``ANY($1::uuid[])`` ``$N``-placeholder discipline): every operator fn returns a
   :class:`Fragment` whose ``value``/``value2`` are plain bound literals. The
   resolve route binds them as PostgREST params via the builder named by
   ``Fragment.builder`` — the compiler itself never touches SQL. There is no
   f-string SQL, no ``.format()``-into-query anywhere here.

R-114-A — the one place Phase 113's "purely additive, ``eq`` untouched" promise
deliberately bends: case-insensitive text matching (D-114-10) widens the compiler
output from "one ``metadata @> $1::jsonb`` containment dict" to "an ordered list of
bound Fragment descriptors." Containment (``leg="containment"``) survives ONLY for
boolean/number ``eq`` where case-sensitive exact is correct; everything else maps
to a typed-column leg (the promoted ``document_type_norm``/``date_typed``) or a
custom ``metadata->>'field'`` leg. Treated as a tested contract change, not a
silent regression.

Field-name safety lives in :func:`validate_fields` (save-time): a ``_``-prefixed
field (``_confidence`` / ``_source`` — display-only nested keys, the D-111-9 /
D-112-D02 invariant) or a field not in the live whitelist raises ``ValueError``
(the router maps it to 422). This mirrors ``documents.py:1401`` exactly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from app.models.document_view import ViewFilter

__all__ = [
    "Fragment",
    "OPERATOR_REGISTRY",
    "PROMOTED_TYPED_COLUMNS",
    "NORMALIZED_LOWER_FIELDS",
    "FREE_TEXT_FIELDS",
    "register_operator",
    "compile_filter",
    "validate_fields",
    "validate_operands",
]


# ── leg-selection field sets (R-114-A / Pitfall 3) ─────────────────────────────
# The hot fields promoted to typed columns in Postgres (R-114-B / Phase 237 RULES-02).
# The compiler maps these field names to their typed column name; the resolve route's
# ``_apply`` reads ``Fragment.field`` as a CONSTANT column name on the indexed fast path.
PROMOTED_TYPED_COLUMNS: dict[str, str] = {
    "document_type": "document_type_norm",
    "date": "date_typed",
    "source_connection_id": "source_connection_id",
    "ingest_visibility": "ingest_visibility",
    "source_state": "source_state",
    "path": "file_path",
    "file_path": "file_path",
    # Phase 240 (SRC-05 / D-240-07) — the conversation key is a TYPED column, not a metadata
    # probe. ⚠ The distinction is not cosmetic: `documents_thread_key_idx` is only reachable
    # from the typed leg. A `metadata->>` custom leg returns the same rows and scans the table —
    # the right answer with the wrong plan, invisible until the corpus is large, which is
    # precisely the class of defect Phase 241 exists to measure.
    "thread_key": "thread_key",
}

# Fields stored lowercase at write path or matched case-insensitively. For these we
# just LOWERCASE THE QUERY VALUE and use ``.eq`` — NOT ``ilike``, preserving indexes.
NORMALIZED_LOWER_FIELDS: frozenset[str] = frozenset({
    "document_type",
    "language",
    "source_system",
    "ingest_visibility",
    "source_state",
})

# Genuinely un-normalized free-text fields → case-insensitive ``ilike`` on BOTH
# sides (D-114-10). These are the only fields that warrant ILIKE for ``eq``.
FREE_TEXT_FIELDS: frozenset[str] = frozenset({"title", "author", "summary"})


# ── WHERE-fragment descriptor (the widened compiler output, R-114-A) ───────────
@dataclass
class Fragment:
    """A single bound WHERE-fragment descriptor — data only, NO SQL.

    ``leg`` picks which ``_apply`` leg consumes it:
      * ``"typed"``       — a promoted indexed column (``document_type_norm`` /
        ``date_typed`` / ``source_connection_id`` / ...); ``field`` is the CONSTANT
        typed column name.
      * ``"custom"``      — a ``metadata->>'field'`` access; ``field`` is the
        WHITELISTED original field name (re-validated at resolve, never raw input).
      * ``"containment"`` — the surviving ``metadata @> {field: value}`` ``@>``
        fast path (boolean/number ``eq`` only); ``field`` is the original key.

    ``builder`` names the supabase-py PostgREST builder the resolve route calls
    (``eq``/``gte``/``lte``/``ilike``/``is_``/``or_``/``contains``). ``value`` (and
    ``value2`` for ``between``) are BOUND LITERALS — they ride as PostgREST params,
    never interpolated (SC#4). ``values`` carries an OR-group membership list (for
    ``one_of``/``is_empty`` where ``builder="or_"``).
    """

    leg: str  # "typed" | "custom" | "containment"
    field: str  # typed column name | whitelisted metadata key | containment key
    builder: str  # "eq" | "gte" | "lte" | "ilike" | "is_" | "or_" | "contains"
    value: object = None  # bound literal
    value2: object = None  # bound literal (between upper bound)
    values: list | None = None  # OR-group membership (one_of / is_empty legs)


# ── closed operator registry (mirror harness/validators.py VALIDATOR_REGISTRY) ─
# op -> fn(condition) -> Fragment | list[Fragment]. A CLOSED dict: an op not present
# is NEVER eval'd / dynamically imported — compile_filter raises KeyError on a
# registry miss (fail closed, defense-in-depth even though the Pydantic Literal on
# ViewCondition.op already rejects unknown ops at parse).
OPERATOR_REGISTRY: dict[str, Callable[..., object]] = {}


def register_operator(op: str) -> Callable[[Callable[..., object]], Callable[..., object]]:
    """Decorator: register an operator fn under ``op`` in :data:`OPERATOR_REGISTRY`.

    The registered fn takes a :class:`~app.models.document_view.ViewCondition` and
    returns a :class:`Fragment` or a ``list[Fragment]`` (data only, no SQL).
    """

    def deco(fn: Callable[..., object]) -> Callable[..., object]:
        OPERATOR_REGISTRY[op] = fn
        return fn

    return deco


@register_operator("eq")
def _op_eq(cond) -> Fragment:
    """``eq`` — case-insensitive equality (D-114-10), leg chosen by field kind.

    * promoted typed columns → typed leg on the promoted column (e.g.
      document_type_norm, source_connection_id, ingest_visibility, source_state, file_path).
    * normalized lower fields (e.g. language, source_system) → custom leg, ``.eq`` with lowercased value.
    * free-text (title/author/summary) → custom leg, ``.ilike`` for case-insensitive exact.
    * boolean/number/anything else custom → the ``@>`` containment fast path.
    """
    field, value = cond.field, cond.value
    if field in PROMOTED_TYPED_COLUMNS:
        target_col = PROMOTED_TYPED_COLUMNS[field]
        val = _lower(value) if field in NORMALIZED_LOWER_FIELDS else value
        return Fragment(leg="typed", field=target_col, builder="eq", value=val)
    if field in NORMALIZED_LOWER_FIELDS:
        return Fragment(leg="custom", field=field, builder="eq", value=_lower(value))
    if field in FREE_TEXT_FIELDS:
        return Fragment(leg="custom", field=field, builder="ilike", value=value)
    # boolean / number / custom string / enum / topics → containment @> fast path
    return Fragment(leg="containment", field=field, builder="contains", value=value)


def _lower(value: object) -> object:
    """Lowercase a string VALUE for case-insensitive matching on a normalized
    field; leave non-strings (numbers/booleans) untouched."""
    return value.lower() if isinstance(value, str) else value


# Phase 114 SEAM: add the additive operators by importing the extra ops module ONCE
# here so its @register_operator("gte") / ("one_of") / ... side-effects populate the
# registry. The import is deliberately AT THE END of module init (after Fragment +
# register_operator are defined) to avoid a circular import.
from . import view_operators_extra  # noqa: E402,F401


def compile_filter(flt: ViewFilter) -> list[Fragment]:
    """Compile every condition into an ordered ``list[Fragment]`` (resolve-time).

    Each condition maps through the closed registry to ONE Fragment or a list of
    Fragments (``one_of``/``is_empty`` may yield an OR-group fragment). The flat-AND
    AST (D-113-7) is preserved as the order of the returned list — ``_apply`` chains
    the builder calls (PostgREST ANDs filters). An empty ``conditions`` list returns
    ``[]`` — the caller applies no narrowing (D-113-9). An op NOT in
    :data:`OPERATOR_REGISTRY` raises ``KeyError`` (fail closed, Pitfall 5).
    """
    fragments: list[Fragment] = []
    for c in flt.conditions:
        fn = OPERATOR_REGISTRY.get(c.op)  # closed lookup; unknown -> None
        if fn is None:
            raise KeyError(f"operator {c.op!r} not registered")  # FAIL CLOSED
        result = fn(c)
        if isinstance(result, list):
            fragments.extend(result)
        else:
            fragments.append(result)
    return fragments  # [] when empty -> caller applies no narrowing


# Operators that impose an ORDER comparison (range). On a custom field these resolve
# to `metadata->>'field' <op> value`, where `->>` returns TEXT — so the comparison is
# LEXICAL, not numeric (WR-01). For ISO `YYYY-MM-DD` dates that happens to sort
# correctly as text, but for NUMBERS it is silently wrong ("9" > "100"). PostgREST /
# supabase-py cannot express a `::numeric` cast on a json-path selector (sanitize_param
# quotes the `::`, turning it into a quoted identifier — verified), so range ops on a
# CUSTOM NUMBER field are rejected at validate time rather than returning wrong rows.
_RANGE_OPS: frozenset[str] = frozenset({"gte", "lte", "between", "before", "after"})

# Operators requiring a scalar `value` operand (WR-02 — a missing scalar would reach
# `getattr(q, builder)(col, None)` and emit a malformed/over-broad filter).
_SCALAR_REQUIRED_OPS: frozenset[str] = frozenset(
    {"eq", "gte", "lte", "before", "after", "contains"}
)


def validate_operands(flt: ViewFilter, number_custom_fields: set[str] | None = None) -> None:
    """Validate per-operator operand presence + type-safety (WR-01 / WR-02 — 114 review).

    Raises ``ValueError`` (the router maps it to 422) so a hand-crafted or
    malformed AST can NEVER reach ``_apply`` and emit a wrong/over-broad PostgREST
    filter. The client guards the happy path, but the server is the trust boundary
    (T-114-05-01) — these checks run at SAVE, UPDATE, and RESOLVE.

    WR-01 — a range operator (``gte``/``lte``/``between``/``before``/``after``) on a
    CUSTOM NUMBER field is rejected: the custom leg compares ``metadata->>'field'``
    LEXICALLY (text), not numerically, and a clean numeric cast is not expressible via
    supabase-py builders. (The promoted built-in ``date`` uses the typed ``date_typed``
    column — numerically correct — so it is exempt; ISO dates also sort correctly as
    text.) ``number_custom_fields`` is the set of custom field_keys whose
    ``field_type`` is ``number`` (assembled by the router); ``None``/empty means no
    numeric custom fields are known, so the check is a no-op.

    WR-02 — operand-presence checks:
      * ``one_of`` requires a non-empty ``values`` list (an empty list → ``.in_(col,
        [])``, a malformed/over-broad PostgREST ``in.()``);
      * ``between`` requires BOTH ``value`` and ``value2``;
      * ``eq``/``gte``/``lte``/``before``/``after``/``contains`` require a scalar
        ``value``;
      * relative ops (``within_next``/``older_than``) require a numeric ``value`` (N).
    """
    numeric = number_custom_fields or set()
    for c in flt.conditions:
        # WR-01: range op on a custom number field → lexically wrong, reject.
        if c.op in _RANGE_OPS and c.field in numeric:
            raise ValueError(
                f"range filters are not supported on the numeric field {c.field!r} "
                "(only equality is available for custom number fields)"
            )
        # WR-02: operand-presence per operator.
        if c.op == "one_of":
            if not c.values:
                raise ValueError(f"{c.op!r} requires at least one value")
        elif c.op == "between":
            if c.value is None or c.value2 is None:
                raise ValueError("'between' requires both a start and an end value")
        elif c.op in ("within_next", "older_than"):
            if not isinstance(c.value, (int, float)) or isinstance(c.value, bool):
                raise ValueError(f"{c.op!r} requires a numeric amount")
        elif c.op in _SCALAR_REQUIRED_OPS:
            if c.value is None:
                raise ValueError(f"{c.op!r} requires a value")
        # is_empty takes no operand — nothing to check.


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
