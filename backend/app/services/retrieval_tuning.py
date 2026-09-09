"""Phase 241 (QUEUE-06 / D-10 / D-11) — apply the operator's HNSW scan knobs to one request.

⭐ **THIS MODULE EXISTS SO THAT THE LANDING ON `retrieval_service.py` STAYS A CALL.** That file
FIRES G-5 (18 / 10 / 423) and its extraction has been **OWED since Phase 231**; `D-11` takes a
deliberate SECOND milestone landing on it, and the ROADMAP's standing note says a THIRD must
propose the extraction before adding behaviour. Every line of logic the knobs need lives here.
⛔ **This module is NOT that owed extraction and must never be read as one.**

## Why a session GUC rather than a constant in the SQL

`match_document_chunks` (migration 154:148-174) applies SEVEN predicates INSIDE the
``ORDER BY … <=> … LIMIT`` scan, so with the shipped ``hnsw.ef_search = 40`` the index walks 40
GLOBAL candidates, discards with seven predicates, and only then takes `hybrid_candidate_count`.
A ``SET hnsw.ef_search`` baked into the function body would need zero Python — and could never be
changed from the Settings UI, which is exactly what the operator asked for (D-09).

## The two invariants this module carries

1. ⛔ **The GUC NAME is a hardcoded literal inside the statement text; only the VALUE is an
   asyncpg bind parameter** — ``SELECT set_config('hnsw.ef_search', $1, true)``. Postgres has no
   bind-parameter form for a parameter NAME, so a name built from a caller's string would be a
   direct injection into a ``SET``. `ef_search` is coerced through ``int()`` and `iterative_scan`
   is checked against the three-member tuple BEFORE either is bound (threat T-241-14).

2. ⛔ **``set_config``'s third argument is ``true`` — LOCAL to the transaction.**
   ``get_user_pg_connection`` (``dependencies.py:159-177``) already opens
   ``async with conn.transaction()`` and its own docstring states *"the COMMIT at context exit
   auto-reverts every SET LOCAL"*. These knobs ride that existing transaction and add no new
   plumbing, so they cannot leak to the next borrower of the pooled connection (threat T-241-15).
   ``false`` here would leak a scan budget across users.

## And one deliberate behaviour, pinned by a test rather than left to be discovered

When the effective values ARE the pgvector server defaults, **this function issues nothing**. It
would otherwise cost two extra round trips on every single search to assert what is already true,
and — worse — it would silently override a server whose ``postgresql.conf`` had been tuned away
from 40 by somebody who meant it. Nothing stored => nothing touched.

⚠ ``hnsw.iterative_scan`` **DOES NOT EXIST below pgvector 0.8**, and cloud parity is UNVERIFIED
(D-14). Each knob is therefore applied in its OWN ``try``: an unrecognised parameter degrades the
TUNING and never the SEARCH (threat T-241-17). That is what lets 241-04's cloud parity check be a
measurement rather than a prerequisite.
"""

from __future__ import annotations

import logging

import asyncpg

from app.config import settings
from app.models.user_settings import HNSW_ITERATIVE_SCAN_VALUES

logger = logging.getLogger(__name__)

#: The pgvector server defaults, measured live 2026-09-10 (pgvector 0.8.0 / PG 17.6). A value
#: equal to these is a no-op — see the module docstring.
_SERVER_DEFAULT_EF_SEARCH = 40
_SERVER_DEFAULT_ITERATIVE_SCAN = "off"

#: ⛔ Errors that mean *"this server cannot do this tuning"* rather than *"this search failed"*.
#: `UndefinedObjectError` is what a pre-0.8 pgvector raises for `hnsw.iterative_scan`;
#: `InvalidParameterValueError` is what a known parameter raises for a value it will not take.
_TUNING_UNAVAILABLE = (
    asyncpg.exceptions.UndefinedObjectError,
    asyncpg.exceptions.InvalidParameterValueError,
)


async def _set_local(conn, statement: str, value: str, *, guc: str) -> bool:
    """Issue ONE ``set_config`` and swallow only the *tuning-unavailable* errors.

    ``statement`` is a module-private constant with the GUC name already inside it — the caller
    never composes it, which is invariant (1) above expressed in the signature.
    """
    try:
        await conn.execute(statement, value)
        return True
    except _TUNING_UNAVAILABLE as exc:
        # ⚠ WARNING, once, naming the knob — never an exception. A search must not fail because
        # a server is older than the tuning we would have liked to apply.
        logger.warning(
            "HNSW tuning unavailable on this server: %s could not be set to %r (%s). "
            "The search continues untuned; hnsw.iterative_scan requires pgvector 0.8+.",
            guc,
            value,
            exc.__class__.__name__,
        )
        return False


# ⛔ ONE CONSTANT PER GUC, AND THE NAME IS INSIDE IT. Written out rather than generated from a
#    list, so no code path exists in which a name arrives from anywhere but this file.
_SQL_EF_SEARCH = "SELECT set_config('hnsw.ef_search', $1, true)"
_SQL_ITERATIVE_SCAN = "SELECT set_config('hnsw.iterative_scan', $1, true)"
_SQL_MAX_SCAN_TUPLES = "SELECT set_config('hnsw.max_scan_tuples', $1, true)"
_SQL_SCAN_MEM_MULTIPLIER = "SELECT set_config('hnsw.scan_mem_multiplier', $1, true)"


async def apply_hnsw_session_knobs(
    conn,
    *,
    ef_search: int | str | None = None,
    iterative_scan: str | None = None,
) -> None:
    """Apply the operator's HNSW knobs to the CURRENT transaction on ``conn``.

    Call this INSIDE the ``async with get_user_pg_connection(...)`` block and before the scan it
    is meant to widen. Never raises: a knob this server cannot take is logged and skipped.

    Args:
        conn: an asyncpg connection already inside a transaction.
        ef_search: how many candidate vectors the index walks before the query's filters are
            applied. ``None``, or the server default, issues nothing.
        iterative_scan: one of ``off`` / ``strict_order`` / ``relaxed_order``. Anything else —
            including a value hand-written into the settings column — issues nothing.
    """
    if ef_search is not None:
        try:
            resolved_ef = int(ef_search)
        except (TypeError, ValueError):
            logger.warning("Ignoring an unusable hnsw.ef_search value: %r", ef_search)
            resolved_ef = _SERVER_DEFAULT_EF_SEARCH
        if resolved_ef != _SERVER_DEFAULT_EF_SEARCH:
            await _set_local(conn, _SQL_EF_SEARCH, str(resolved_ef), guc="hnsw.ef_search")

    if iterative_scan is None or iterative_scan == _SERVER_DEFAULT_ITERATIVE_SCAN:
        return

    if iterative_scan not in HNSW_ITERATIVE_SCAN_VALUES:
        # ⛔ THE SECOND DOOR. `PATCH /settings` already refuses a mode outside the enum, but this
        #    value is also READ BACK OUT of a database column that a hand-edit in the SQL editor
        #    could have written. The value is a bind parameter either way — this is about not
        #    asking the server to do something nobody chose.
        logger.warning(
            "Ignoring an hnsw.iterative_scan value outside the pgvector enum: %r", iterative_scan
        )
        return

    applied = await _set_local(
        conn, _SQL_ITERATIVE_SCAN, iterative_scan, guc="hnsw.iterative_scan"
    )
    if not applied:
        return

    # ⛔ THE MEMORY COMPANIONS, AND THEY ARE HARDCODED ON PURPOSE (D-09 / T-241-16). They matter
    #    only once iterative scan is ON — an unbounded scan is a memory footgun, not a tuning
    #    choice with a safe bounded control — so they come from `config.py` and there is no
    #    settings column, no request field and no UI control that can reach them.
    await _set_local(
        conn,
        _SQL_MAX_SCAN_TUPLES,
        str(settings.hnsw_max_scan_tuples),
        guc="hnsw.max_scan_tuples",
    )
    await _set_local(
        conn,
        _SQL_SCAN_MEM_MULTIPLIER,
        str(settings.hnsw_scan_mem_multiplier),
        guc="hnsw.scan_mem_multiplier",
    )
