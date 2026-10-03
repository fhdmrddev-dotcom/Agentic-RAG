"""Phase 272 (D-13) — the retrieval FILTER SEAM: contracts only, as data and as types.

This module is where filtered retrieval lands — never back in ``retrieval_service.py``, whose
extraction 272-01 discharged. In 272-01 it carries CONTRACTS ONLY; 272-03 adds the resolver
(``resolve_document_scope``) and 272-04 consumes it. There is deliberately no resolver body here.

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

A scope is a SUBSET of what the caller may read, never a widening of it. 272-03's resolver must
intersect with the caller's readable set before any id or count leaves here.

## Import-cycle rule (Pitfall 5)

``document_view_resolver`` and ``document_search_service`` are imported FUNCTION-LOCALLY only,
never at module level: ``document_view_resolver`` transitively imports ``harness.scope`` →
``task_service`` → ``tool_dispatcher``, which imports the search tool, which reaches here.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


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
