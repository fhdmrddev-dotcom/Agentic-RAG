"""Phase 118 (CLASS-02) — the PURE in-Python AST→bool classification matcher.

The load-bearing 118 primitive. The Phase 113/114 SQL compiler
(:func:`app.services.view_filter_compiler.compile_filter`) produces ``list[Fragment]``
consumed ONLY by the resolve route's PostgREST-builder calls against a PERSISTED
``documents`` table — but at the ingest call site the doc is NOT YET PERSISTED, so the
compiler cannot be reused. This module is the thin in-Python evaluator: it compares a
user-authored ``ViewFilter`` AST against an in-memory ``metadata`` dict and returns a
``bool``.

It REUSES (does NOT reinvent):
  * :meth:`app.models.document_view.ViewFilter.model_validate` — the ``Literal``
    op-discriminator rejects an unknown op at PARSE (Pitfall 5: no op-ladder, no eval).
  * :func:`app.services.view_filter_compiler.validate_fields` — the ``_``-prefix +
    whitelist guard (a ``_confidence`` / ``_source`` / ``_classification`` provenance key
    can NEVER be a match dimension; T-118-01-02).

It MIRRORS the compiler's per-operator NORMALIZATION exactly (Pitfall 2 — so the
builder's "would match N" SQL preview agrees with the on-upload in-Python match):
  * ``eq``        — case-insensitive for ``document_type``/``language`` (both stored
    lowercase) and free-text (``title``/``author``/``summary``, the ``ilike`` leg);
    exact for boolean/number.
  * ``one_of``    — case-insensitive membership.
  * ``contains``  — case-insensitive substring.
  * ``gte``/``lte``/``before``/``after``/``between`` — ISO-date-string comparison
    (text sort sorts ISO ``YYYY-MM-DD`` correctly; range-on-custom-number is rejected at
    ``validate_operands`` and never reaches the matcher).
  * ``is_empty``  — key absent OR value in ``("", [])`` → True.
  * ``within_next``/``older_than`` — a relative window from ``date.today()`` (the same
    server-clock math the resolve route uses, D-114-16).

SECURITY (T-118-01-01): ``match_metadata`` NEVER eval()s, NEVER interpolates, and NEVER
touches the DB — a bound dict value is compared with Python operators only. ``ViewFilter``
parse-reject + ``validate_fields`` are the two trust-boundary guards.

``build_suggestion`` builds the D-118-5 single suggestion object — provenance, NO
fabricated confidence %. It resolves ``suggested_folder_name`` FRESH from the
own+global folder read (the FK is ``ON DELETE SET NULL``; Pitfall 5: None/"(deleted)" if
the folder is gone).
"""

from __future__ import annotations

from datetime import date, timedelta

from app.models.document_view import ViewCondition, ViewFilter
from app.services import view_filter_compiler
from app.utils.db import coerce_uid

# Fields stored lowercase at every write path (mirror NORMALIZED_LOWER_FIELDS in the
# compiler — document_type/language) — the eq/one_of value is lowercased on BOTH sides.
_NORMALIZED_LOWER = view_filter_compiler.NORMALIZED_LOWER_FIELDS
# Genuinely un-normalized free-text fields → case-insensitive eq (the compiler's ilike leg).
_FREE_TEXT = view_filter_compiler.FREE_TEXT_FIELDS

_FOLDER_DELETED_NAME = None  # a NULL/unreadable suggested folder renders as None (Pitfall 5)


# ── public API ───────────────────────────────────────────────────────────────────
def match_metadata(match_expr: dict, metadata: dict, whitelist: set[str]) -> bool:
    """Evaluate a rule's ``match_expr`` AST against a doc's ``metadata`` dict (PURE).

    Parses via ``ViewFilter.model_validate`` (Literal op-reject), runs
    ``view_filter_compiler.validate_fields`` (``_``-prefix + whitelist guard), then
    returns ``all(_match_one(c, metadata))`` over the flat-AND conditions (D-113-7). An
    empty rule (no conditions) returns ``False`` — never auto-suggest blindly.

    Raises ``pydantic.ValidationError`` on an unknown op (parse-reject) and ``ValueError``
    on a ``_``-prefixed / unknown field (the ingest pass catches both and degrades).
    NEVER eval()s, interpolates, or touches the DB.
    """
    flt = ViewFilter.model_validate(match_expr)          # Literal op-reject at parse (Pitfall 5)
    view_filter_compiler.validate_fields(flt, whitelist)  # _-prefix + whitelist guard (reuse)
    if not flt.conditions:
        return False                                     # empty rule matches nothing
    return all(_match_one(c, metadata) for c in flt.conditions)  # flat AND (D-113-7)


def build_suggestion(rule: dict, supabase, user_id) -> dict:
    """Build the D-118-5 single suggestion object — provenance, NO confidence %.

    ``condition_summary`` is a human-readable render of the matched AST, FROZEN at
    suggest-time (the rule may be edited/deleted later — the suggestion shows the
    condition that MATCHED, not live state). ``suggested_folder_name`` is resolved FRESH
    from ``suggest_folder_id`` via the own+global folder read (clone of
    ``move_document``'s folder lookup) → ``None`` if the folder is NULL or unreadable
    (the FK is ``ON DELETE SET NULL``; Pitfall 5).
    """
    suggest_folder_id = rule.get("suggest_folder_id")
    folder_name = _resolve_folder_name(suggest_folder_id, supabase, user_id)
    return {
        "rule_id": rule.get("id"),
        "rule_name": rule.get("name"),
        "condition_summary": _render_condition_summary(rule.get("match_expr") or {}),
        "suggested_folder_id": suggest_folder_id,
        "suggested_folder_name": folder_name,
        "status": "suggested",
        # prior_folder_id is stamped at ACCEPT time (Undo, D-118-6), NOT here.
    }


# ── per-operator matcher (MIRRORS view_filter_compiler / view_operators_extra) ─────
def _match_one(cond: ViewCondition, metadata: dict) -> bool:
    op = cond.op
    field = cond.field
    present = field in metadata
    value = metadata.get(field)

    if op == "is_empty":
        # key absent OR value in ("", []) → True (D-114-12).
        return (not present) or value in ("", [], None)

    if op == "eq":
        return _eq(field, cond.value, value, present)

    if op == "one_of":
        return _one_of(field, cond.values or [], value, present)

    if op == "contains":
        if not present or value is None:
            return False
        return str(cond.value).lower() in str(value).lower()

    if op in ("gte", "lte", "before", "after"):
        return _range(op, cond.value, value, present)

    if op == "between":
        return _between(cond.value, cond.value2, value, present)

    if op in ("within_next", "older_than"):
        return _relative(op, cond.value, cond.unit, value, present)

    # An op outside the closed set never reaches here (ViewFilter Literal already
    # rejected it at parse). Fail closed if somehow reached.
    return False


def _norm(field: str, v: object) -> object:
    """Lowercase a string value when matching a normalized/free-text field (mirror the
    compiler's _lower + ilike legs); leave non-strings untouched."""
    if isinstance(v, str) and (field in _NORMALIZED_LOWER or field in _FREE_TEXT):
        return v.lower()
    return v


def _eq(field: str, rule_value: object, doc_value: object, present: bool) -> bool:
    if not present:
        return False
    return _norm(field, doc_value) == _norm(field, rule_value)


def _one_of(field: str, rule_values: list, doc_value: object, present: bool) -> bool:
    if not present:
        return False
    candidates = {_norm(field, v) for v in rule_values}
    return _norm(field, doc_value) in candidates


def _range(op: str, rule_value: object, doc_value: object, present: bool) -> bool:
    if not present or doc_value is None or rule_value is None:
        return False
    # ISO-date strings sort correctly as text; numbers/other comparables compare directly.
    try:
        if op in ("gte", "after"):
            return doc_value >= rule_value
        # lte / before
        return doc_value <= rule_value
    except TypeError:
        return False


def _between(low: object, high: object, doc_value: object, present: bool) -> bool:
    if not present or doc_value is None or low is None or high is None:
        return False
    try:
        return low <= doc_value <= high
    except TypeError:
        return False


def _relative(op: str, n: object, unit: str | None, doc_value: object, present: bool) -> bool:
    if not present or doc_value is None or not isinstance(n, (int, float)) or isinstance(n, bool):
        return False
    doc_date = _parse_iso_date(doc_value)
    if doc_date is None:
        return False
    delta = _window_timedelta(int(n), unit)
    today = date.today()
    if op == "within_next":
        # today → today+N (EXCLUDES overdue; D-114-5).
        return today <= doc_date <= (today + delta)
    # older_than: date < today-N (STRICT, D-114-4).
    return doc_date < (today - delta)


def _window_timedelta(n: int, unit: str | None) -> timedelta:
    if unit == "weeks":
        return timedelta(weeks=n)
    if unit == "months":
        return timedelta(days=30 * n)   # approximate-month window (mirror the resolve clock)
    return timedelta(days=n)            # default + "days"


def _parse_iso_date(v: object) -> date | None:
    if isinstance(v, date):
        return v
    if not isinstance(v, str):
        return None
    try:
        # Accept "YYYY-MM-DD" (and "YYYY-MM-DDTHH:MM:SS…" by taking the date head).
        return date.fromisoformat(v[:10])
    except ValueError:
        return None


# ── condition_summary render (frozen provenance, no confidence %) ──────────────────
_OP_SYMBOL = {
    "eq": "=",
    "one_of": "in",
    "contains": "contains",
    "gte": ">=",
    "lte": "<=",
    "before": "before",
    "after": "after",
    "between": "between",
    "is_empty": "is empty",
    "within_next": "within next",
    "older_than": "older than",
}


def _render_condition_summary(match_expr: dict) -> str:
    """Render a human-readable AST string (provenance shown in the panel — never a %)."""
    try:
        flt = ViewFilter.model_validate(match_expr)
    except Exception:  # noqa: BLE001 — a bad AST never blocks the suggestion render
        return ""
    parts: list[str] = []
    for c in flt.conditions:
        sym = _OP_SYMBOL.get(c.op, c.op)
        if c.op == "is_empty":
            parts.append(f"{c.field} is empty")
        elif c.op == "one_of":
            vals = ", ".join(str(v) for v in (c.values or []))
            parts.append(f"{c.field} in [{vals}]")
        elif c.op == "between":
            parts.append(f"{c.field} between {c.value} and {c.value2}")
        elif c.op in ("within_next", "older_than"):
            parts.append(f"{c.field} {sym} {c.value} {c.unit or 'days'}")
        else:
            parts.append(f"{c.field} {sym} {c.value}")
    return " AND ".join(parts)


# ── fresh suggested-folder name resolve (own+global; Pitfall 5) ────────────────────
def _resolve_folder_name(folder_id, supabase, user_id) -> str | None:
    """Resolve the suggested folder's name FRESH (own+global). Returns ``None`` if the
    folder_id is NULL or the folder is unreadable/deleted (FK ON DELETE SET NULL).

    Clones the ``move_document`` folder readability lookup (documents.py:1326-1333):
    own OR global, the SOLE owner gate (service-role bypasses RLS).
    """
    if not folder_id:
        return _FOLDER_DELETED_NAME
    try:
        resp = (
            supabase.table("folders")
            .select("id,name")
            .eq("id", str(folder_id))
            .or_(f"user_id.eq.{coerce_uid(user_id)},is_org_shared.eq.true")  # AR-118-01: coerced
            .maybe_single()
            .execute()
        )
    except Exception:  # noqa: BLE001 — an unreadable/deleted folder degrades to None, never raises
        return _FOLDER_DELETED_NAME
    data = getattr(resp, "data", None)
    if not data:
        return _FOLDER_DELETED_NAME
    return data.get("name")
