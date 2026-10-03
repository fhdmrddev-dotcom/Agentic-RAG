"""Phase 272 (D-13) — the retrieval FILTER SEAM: contracts only, as data and as types.

This module is where filtered retrieval lands — never back in ``retrieval_service.py``, whose
extraction 272-01 discharged. 272-01 laid the CONTRACTS; 272-03 adds the resolver
(``resolve_document_scope`` + ``nearby_values`` / ``canonical_stored_values`` /
``top_document_types``) below them, and 272-04 consumes it.

## A default predicate is DATA (D-13)

``DEFAULT_PREDICATES`` names the predicates the retrieval RPCs already hardcode. Each entry says
whether the RPC enforces it (``enforced_in_rpc``) and, when it must be applied in Python instead,
the ViewCondition-shaped ``condition`` the resolver applies. ``requires_resolved_scope`` reads the
tuple and never a predicate's NAME — so Phase 275 appends ``not_archived`` with
``enforced_in_rpc=False`` and every search then resolves a scope. **No branch is added.**
(``tests/unit/test_272_scope_seam.py`` fences that the function body carries no string literal.)

## "No filter" and "matched nothing" are different TYPES (D-18)

* The CALLER passes ``None`` for **no filter** — there is no ScopeResult for that case.
* An empty ``ScopeResult`` (``document_ids == ()``, ``is_empty`` True) means **the filter matched
  nothing**, and a search under it must return nothing.
* ⛔ Never write ``x if x else None`` on document ids. That idiom turns "matched nothing" into
  "search everything" — the Phase 266 CR-01 inversion — and this contract exists to make it
  unwritable rather than merely discouraged.

## Every id or count that leaves this module is RLS-intersected (D-21)

A scope is a SUBSET of what the caller may read, never a widening of it. 272-03's resolver
intersects with the caller's readable set before any id or count leaves here: step 1 (the
service-role client, bounded to the caller's orgs) only PROPOSES candidates; step 2 re-reads them
through ``get_user_pg_connection`` where the ``documents`` RLS policy (migration 154) decides.

## Import-cycle rule (Pitfall 5)

``document_view_resolver`` and ``document_search_service`` are imported FUNCTION-LOCALLY only,
never at module level: ``document_view_resolver`` transitively imports ``harness.scope`` →
``task_service`` → ``tool_dispatcher``, which imports the search tool, which reaches here.
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime
from typing import TYPE_CHECKING, Any, Sequence

from app.dependencies import get_user_pg_connection
from app.utils.folder_utils import _resolve_caller_org_ids

if TYPE_CHECKING:
    from supabase import Client


@dataclass(frozen=True)
class RetrievalPredicate:
    """One default retrieval predicate, as data.

    ``condition`` is a ViewCondition-shaped dict (``{field, op, value, value2, values, unit}``)
    the resolver applies in its step 1, or ``None`` when the predicate is enforced in SQL only.
    ``enforced_in_rpc`` says whether the retrieval RPCs already apply it; a predicate with
    ``enforced_in_rpc=False`` can only be honoured by resolving a scope first.
    """

    name: str
    condition: dict | None
    enforced_in_rpc: bool


# The predicates ``match_document_chunks`` / ``keyword_search_chunks`` hardcode today (migration
# 170 bodies). Each is enforced in the RPC; the resolver applies it in step 1 for COUNT parity in
# 272-03, so a scope's counts agree with what a search under it can actually return.
DEFAULT_PREDICATES: tuple[RetrievalPredicate, ...] = (
    # mig 170:76 / :114 — `AND d.is_latest = true`. Enforced in the RPC; the resolver applies it
    # in step 1 for COUNT parity in 272-03.
    RetrievalPredicate("latest_only", None, True),
    # mig 170:74 / :112 — `AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')`.
    # Enforced in the RPC; the resolver applies it in step 1 for COUNT parity in 272-03.
    RetrievalPredicate("not_source_disconnected", None, True),
    # mig 170:68-72 / :106-110 — the org gate (`current_user_org_ids()`) AND owner-or-visible
    # (`dc.user_id = auth.uid() OR … OR connection_doc_is_visible(…)`). Enforced in the RPC; the
    # resolver applies it in step 1 for COUNT parity in 272-03.
    RetrievalPredicate("caller_visibility", None, True),
)


def requires_resolved_scope(
    conditions: Sequence,
    predicates: Sequence[RetrievalPredicate] = DEFAULT_PREDICATES,
) -> bool:
    """True iff a search must resolve a document scope before it runs.

    That is: the caller supplied at least one condition, OR any predicate cannot be enforced by
    the RPC. Pure, and data-driven — it never inspects a predicate's name.
    """
    return bool(conditions) or any(not p.enforced_in_rpc for p in predicates)


@dataclass(frozen=True)
class ScopeResult:
    """A resolved document scope — always a RESTRICTION (D-18).

    ``document_ids`` empty means **matched nothing**, never "unrestricted": "no filter" is the
    caller passing ``None`` instead of a ScopeResult. ``applied`` holds the canonical conditions
    as applied; ``undated_excluded`` / ``date_field`` report what a date condition left out.
    """

    document_ids: tuple[str, ...]
    applied: tuple[dict, ...]
    undated_excluded: int | None
    date_field: str | None

    @property
    def is_empty(self) -> bool:
        return len(self.document_ids) == 0


# ═════════════════════════════════════════════════════════════════════════════════════════════
# 272-03 — the resolver (D-21 / D-06 / D-11 / D-18 / D-19 / D-20 / D-23)
# ═════════════════════════════════════════════════════════════════════════════════════════════
#
# ⛔ EVERY NUMBER SHOWN TO THE MODEL IS RLS-INTERSECTED. The matched set, the D-06 undated count,
#   the D-11 nearby counts, the D-20 stored spellings and the D-23 document types all come out of
#   a read made under the caller's RLS (``get_user_pg_connection(None, {"id": user_id})`` — the
#   same uid-synthesized context the retrieval RPCs run under). The service-role client is only
#   ever used to PROPOSE candidate ids; no count is taken from it.

# Find's three timestamptz dates resolve through ``FindDate`` (Pitfall 14: BEFORE the compiler, so
# a custom key spelled ``added`` can never shadow them). ``date`` — the document's own date — is NOT
# here: it is the compiler's ``date_typed`` field (D-05). Mirrors document_search_service._DATE_COLUMN.
_DATE_WORDS = ("added", "source_created", "source_modified")
_DATE_FIELD_COLUMN = {
    "added": "created_at",
    "source_created": "source_created_at",
    "source_modified": "source_modified_at",
    "date": "date_typed",
}
# The D-11 month read, one CONSTANT statement per column (the column name is a closed choice, so it
# lives in the SQL text rather than being spliced in).
_MONTH_SQL = {
    "created_at": "SELECT created_at AS v FROM public.documents WHERE id = ANY($1::uuid[])",
    "source_created_at": "SELECT source_created_at AS v FROM public.documents WHERE id = ANY($1::uuid[])",
    "source_modified_at": "SELECT source_modified_at AS v FROM public.documents WHERE id = ANY($1::uuid[])",
    "date_typed": "SELECT date_typed AS v FROM public.documents WHERE id = ANY($1::uuid[])",
}
_RLS_INTERSECT_SQL = "SELECT id::text AS id FROM public.documents WHERE id = ANY($1::uuid[])"
_DIMENSION_SQL = "SELECT metadata->>$2 AS v FROM public.documents WHERE id = ANY($1::uuid[])"
# D-20 — the stored spellings of a metadata key equal to a value ignoring case. Field AND value are
# bind params; parity predicates with retrieval (latest, not source-disconnected).
_STORED_SPELLINGS_SQL = (
    "SELECT DISTINCT metadata->>$1 AS v FROM public.documents "
    "WHERE is_latest AND (source_state IS NULL OR source_state <> 'source_disconnected') "
    "AND lower(metadata->>$1) = lower($2) ORDER BY 1 LIMIT $3"
)
# D-23 — ``document_type_norm`` is migration 074's generated ``lower(metadata->>'document_type')``.
_TOP_TYPES_SQL = (
    "SELECT document_type_norm AS v, count(*) AS n FROM public.documents "
    "WHERE is_latest AND (source_state IS NULL OR source_state <> 'source_disconnected') "
    "AND document_type_norm IS NOT NULL "
    "GROUP BY document_type_norm ORDER BY n DESC, v LIMIT $1"
)
_ISO_RULE = "use YYYY-MM-DD (e.g. 2025-10-01), or between with two YYYY-MM-DD days"
_ISO_DATE_OPS = ("eq", "gte", "lte", "before", "after", "between")


def _empty(applied: Sequence[dict]) -> ScopeResult:
    """The filter matched nothing (D-18) — a RESTRICTION to the empty set, never "no filter"."""
    return ScopeResult(document_ids=(), applied=tuple(applied), undated_excluded=None, date_field=None)


def _iso_day(value: Any) -> bool:
    if not isinstance(value, str) or len(value) != 10:
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def _check_document_date(cond: dict) -> None:
    """Pitfall 12: ``date`` operands reach ``date_typed`` as a PostgREST ``date`` param, and
    ``"October"`` there is a PostgREST 400 that would read as "retrieval unavailable". Refuse it
    as an invalid filter, naming the rule, before anything is sent."""
    from app.services.document_view_resolver import ResolveError

    if cond.get("op") not in _ISO_DATE_OPS:
        return
    operands = [cond.get("value")] + ([cond.get("value2")] if cond.get("op") == "between" else [])
    if not all(_iso_day(v) for v in operands):
        raise ResolveError(detail=f"date filter: {_ISO_RULE}")


def _to_find_date(cond: dict):
    """A date-word condition → ``FindDate`` (``eq`` reads as the whole day: ``between d d``)."""
    from pydantic import ValidationError

    from app.models.document_search import FindDate
    from app.services.document_view_resolver import ResolveError

    op = cond.get("op")
    value, value2 = cond.get("value"), cond.get("value2")
    if op == "eq":
        op, value2 = "between", value
    try:
        return FindDate(which=cond["field"], op=op, value=value, value2=value2, unit=cond.get("unit"))
    except ValidationError as e:
        msg = e.errors()[0].get("msg", str(e)).removeprefix("Value error, ")
        raise ResolveError(detail=f"{cond['field']} filter: {msg} ({_ISO_RULE})")


def _view_condition_kwargs(cond: dict) -> dict:
    return {k: cond[k] for k in ("field", "op", "value", "value2", "values", "unit") if k in cond}


async def _rls_intersect(user_id: str, ids: Sequence[str]) -> list[str]:
    """Step 2 (D-21): the caller's RLS decides which candidates exist for them."""
    if not ids:
        return []
    async with get_user_pg_connection(None, {"id": user_id}) as conn:
        rows = await conn.fetch(_RLS_INTERSECT_SQL, list(ids))
    return [str(r["id"]) for r in rows]


async def resolve_document_scope(
    *,
    user_id: str,
    conditions: Sequence[dict],
    folder_ids: Sequence[str] | None,
    supabase: "Client",
    predicates: Sequence[RetrievalPredicate] = DEFAULT_PREDICATES,
) -> ScopeResult:
    """Resolve Find-style conditions to an RLS-decided document set (D-21, two steps).

    * Step 1 (service role, PROPOSES): the 271 compiler verbatim (``validate_and_compile`` +
      ``apply_fragments``) and Find's ``_apply_dates`` on ``documents``, bounded to the caller's
      orgs (``_resolve_caller_org_ids``, fail-closed), ``is_latest``, not source-disconnected, every
      Python-enforced predicate's ``condition`` (D-13), and — D-19 — the chat folder scope ANDed in.
    * Step 2 (the caller's RLS, DECIDES): ``SELECT id FROM documents WHERE id = ANY($1)`` under
      ``get_user_pg_connection``; an id step 1 proposed that RLS does not return is absent.
    * D-06: with a date condition, ``undated_excluded`` counts the RLS-visible documents that pass
      every NON-date condition and have NULL in that date's column; ``date_field`` names it.
    * D-18: no orgs, ``folder_ids == []`` or zero candidates → an EMPTY ScopeResult. "No filter"
      is the caller passing ``None`` instead of calling this; this never returns ``None``.

    Raises ``ResolveError`` (invalid field / operand / date → 422) and ``SearchTruncatedError``.
    """
    from pydantic import ValidationError

    from app.models.document_search import DocumentSearchRequest
    from app.models.document_view import ViewCondition, ViewFilter
    from app.services.document_search_service import _apply_dates, _fetch_all
    from app.services.document_view_resolver import ResolveError, apply_fragments, validate_and_compile

    applied = [dict(c) for c in conditions]
    if folder_ids is not None and len(folder_ids) == 0:
        return _empty(applied)                       # D-18 / D-19: an empty scope is not "no scope"

    effective = applied + [dict(p.condition) for p in predicates if p.condition is not None]
    date_conds = [c for c in effective if c.get("field") in _DATE_WORDS]
    other_conds = [c for c in effective if c.get("field") not in _DATE_WORDS]
    for c in other_conds:
        if c.get("field") == "date":
            _check_document_date(c)
    finds = [_to_find_date(c) for c in date_conds]
    try:
        dates_req = DocumentSearchRequest(dates=finds) if finds else None
    except ValidationError as e:
        raise ResolveError(detail=e.errors()[0].get("msg", str(e)).removeprefix("Value error, "))

    orgs = await _resolve_caller_org_ids(supabase, user_id)
    if not orgs:
        return _empty(applied)                       # fail-closed: no membership, no documents

    async def _compile(conds: list[dict]) -> list:
        if not conds:
            return []
        flt = ViewFilter(op="and", conditions=[ViewCondition(**_view_condition_kwargs(c)) for c in conds])
        return await validate_and_compile(user_id, flt, supabase)

    fragments = await _compile(other_conds)

    def _builder(frags: list, dreq, null_column: str | None):
        def build(count: bool):
            q = supabase.table("documents").select("id", count="exact" if count else None)
            q = q.in_("org_id", sorted(orgs)).eq("is_latest", True).or_(
                "source_state.is.null,source_state.neq.source_disconnected"
            )
            q = apply_fragments(q, frags)
            if dreq is not None:
                q = _apply_dates(q, dreq)
            if folder_ids is not None:
                q = q.in_("folder_id", list(folder_ids))
            if null_column is not None:
                q = q.is_(null_column, "null")
            return q
        return build

    candidates = [str(r["id"]) for r in await _fetch_all(_builder(fragments, dates_req, None))]
    ids = await _rls_intersect(user_id, candidates) if candidates else []

    # D-06 — the first date condition is the one reported.
    undated: int | None = None
    date_field: str | None = None
    first_date = next((c for c in effective if c.get("field") in _DATE_FIELD_COLUMN), None)
    if first_date is not None:
        date_field = first_date["field"]
        column = _DATE_FIELD_COLUMN[date_field]
        non_date = [c for c in other_conds if c.get("field") != "date"]
        undated_rows = await _fetch_all(_builder(await _compile(non_date), None, column))
        undated = len(await _rls_intersect(user_id, [str(r["id"]) for r in undated_rows]))

    return ScopeResult(
        document_ids=tuple(sorted(ids)),
        applied=tuple(applied),
        undated_excluded=undated,
        date_field=date_field,
    )


def _month_of(v: Any) -> str | None:
    if isinstance(v, (datetime, date)):
        return f"{v.year:04d}-{v.month:02d}"
    return None


def _month_index(ym: str) -> int:
    y, m = ym.split("-")
    return int(y) * 12 + int(m) - 1


def _requested_months(removed: Sequence[dict]) -> tuple[int, int] | None:
    """The requested window, in month indices, from the removed condition(s) (ISO days only)."""
    days = [v for c in removed for v in (c.get("value"), c.get("value2")) if _iso_day(v)]
    if not days:
        return None
    idx = [_month_index(d[:7]) for d in days]
    return min(idx), max(idx)


async def nearby_values(
    *,
    user_id: str,
    conditions: Sequence[dict],
    field: str,
    folder_ids: Sequence[str] | None,
    supabase: "Client",
    limit: int = 3,
) -> list[dict]:
    """D-11 — what DOES exist near a filter that matched nothing, as document-level counts.

    Re-resolves with every condition on ``field`` removed (the same two steps, so RLS decides),
    then reads ``field`` for those documents under RLS. A date field → months
    ``[{"value": "2025-09", "label": "September 2025", "documents": n}]`` ordered by distance from
    the requested window (then by count, then chronologically); a dimension →
    ``[{"value": "<stored value>", "documents": n}]`` ordered by count. Never chunk content.
    """
    removed = [c for c in conditions if c.get("field") == field]
    remaining = [c for c in conditions if c.get("field") != field]
    scope = await resolve_document_scope(
        user_id=user_id, conditions=remaining, folder_ids=folder_ids, supabase=supabase,
    )
    if scope.is_empty:
        return []

    counts: dict[str, int] = {}
    if field in _DATE_FIELD_COLUMN:
        async with get_user_pg_connection(None, {"id": user_id}) as conn:
            rows = await conn.fetch(_MONTH_SQL[_DATE_FIELD_COLUMN[field]], list(scope.document_ids))
        for r in rows:
            ym = _month_of(r["v"])
            if ym is not None:
                counts[ym] = counts.get(ym, 0) + 1
        window = _requested_months(removed)

        def _distance(ym: str) -> int:
            if window is None:
                return 0
            i = _month_index(ym)
            lo, hi = window
            return 0 if lo <= i <= hi else (lo - i if i < lo else i - hi)

        ordered = sorted(counts, key=lambda ym: (_distance(ym), -counts[ym], ym))
        return [
            {
                "value": ym,
                "label": f"{calendar.month_name[int(ym[5:])]} {ym[:4]}",
                "documents": counts[ym],
            }
            for ym in ordered[:limit]
        ]

    async with get_user_pg_connection(None, {"id": user_id}) as conn:
        rows = await conn.fetch(_DIMENSION_SQL, list(scope.document_ids), field)
    for r in rows:
        v = r["v"]
        if v is not None and v != "":
            counts[v] = counts.get(v, 0) + 1
    ordered = sorted(counts, key=lambda v: (-counts[v], v))
    return [{"value": v, "documents": counts[v]} for v in ordered[:limit]]


async def canonical_stored_values(
    *, user_id: str, field: str, value: str, limit: int = 10,
) -> list[str]:
    """D-20 — the stored spellings of ``field`` equal to ``value`` ignoring case, under RLS.

    Field key AND value are bind params (``$1`` / ``$2``) — never interpolated."""
    async with get_user_pg_connection(None, {"id": user_id}) as conn:
        rows = await conn.fetch(_STORED_SPELLINGS_SQL, field, value, limit)
    return [r["v"] for r in rows if r["v"] is not None]


async def top_document_types(*, user_id: str, limit: int = 15) -> list[tuple[str, int]]:
    """D-23 — the caller's most common document types among latest documents, under RLS."""
    async with get_user_pg_connection(None, {"id": user_id}) as conn:
        rows = await conn.fetch(_TOP_TYPES_SQL, limit)
    return [(r["v"], int(r["n"])) for r in rows]
