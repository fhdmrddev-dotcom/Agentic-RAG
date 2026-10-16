"""Async wrapper around Supabase sync `.execute()` calls (Phase 058 — D-058-03).

Wraps `query.execute()` in `starlette.concurrency.run_in_threadpool` so the
asyncio event loop is not blocked on Postgres round-trips. This is the
SSE-path threadpool wrap referenced in research §A1–A2: `aexec` runs the
call off the event loop at request time and returns its result unchanged.

A `.maybe_single()` query that matches 0 rows returns `None` from
`.execute()` (postgrest 2.29), so read its row through `maybe_row` below
rather than `.data`. (Phase 280 / D-30 deleted the `main.py` postgrest patch
this paragraph used to describe: it wrapped `SyncSingleRequestBuilder`, not
the maybe_single builder, for an error code postgrest never produces.)

Usage:
    from app.utils.db import aexec
    response = await aexec(
        supabase.table("messages")
        .select("role, content")
        .eq("thread_id", tid)
    )
    rows = response.data or []

The helper accepts a query object (NOT a callable) and calls `.execute` on
it inside the threadpool. This keeps call sites symmetric with the sync
`.execute()` they replace.
"""

import logging
from types import SimpleNamespace
from uuid import UUID

from postgrest.exceptions import APIError
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

#: PostgREST's answer to a ``count=exact`` read whose offset is past the end: HTTP 416, code
#: PGRST103, "An offset of X was requested, but there are only Y rows." (measured live —
#: ``tests/integration/test_284_offset_past_end_live.py``). ``offset == total`` is a plain 200.
RANGE_NOT_SATISFIABLE = "PGRST103"


def coerce_uid(user_id) -> str:
    """Coerce ``user_id`` to a canonical UUID string before it is interpolated into a
    PostgREST ``.or_()`` / ``.eq.`` filter grammar.

    Service-role reads bypass RLS, so the in-app ``user_id.eq.<uuid>`` predicate is the
    SOLE owner-scoping gate. Wrapping the value in ``UUID(...)`` makes that one
    runtime-value-into-DSL spot safe by construction: any value that is not a
    well-formed UUID raises ``ValueError`` instead of breaking out of the
    ``user_id.eq.<...>`` term. The shared home for the helper the view / relationship /
    rule services each carried their own copy of (Phase 118 AR-118-01 hoist).
    """
    return str(UUID(str(user_id)))


def maybe_row(resp):
    """The row a ``.maybe_single()`` query found, or ``None``.

    Measured (Phase 280, BUG-261012-02): postgrest 2.29's
    ``SyncMaybeSingleRequestBuilder.execute`` returns ``None`` — not a response whose ``.data``
    is ``None`` — when the query matches 0 rows. Reading ``.data`` straight off that result is an
    ``AttributeError``, which reaches the client as a 500 (and without CORS headers) instead of
    the handler's own 404/403 branch. Every ``maybe_single()`` read goes through this, or through
    an explicit None-guard; ``tests/unit/test_280_maybe_row_fence.py`` pins that over
    ``backend/app``.
    """
    return resp.data if resp is not None else None


async def aexec(query):
    """Run a sync supabase-py query off the event loop.

    Args:
        query: A Supabase query builder (the result of
            `supabase.table(...).select(...).eq(...)` etc., before
            `.execute()` is called).

    Returns:
        The same response object `query.execute()` would have returned —
        typically with `.data` (list[dict] or dict) and `.count` (int|None).
    """
    return await run_in_threadpool(query.execute)


async def aexec_page(build, *, offset: int, limit: int):
    """One page of a ``count="exact"`` read: ``build().range(offset, offset + limit - 1)``.

    284-REVIEW CR-01. A page past the end is a valid question — the list shrank under an open
    page (Include archived turned off, a Realtime delete, a re-chunk) — and its answer is "no
    rows, and here is the total". PostgREST instead answers 416 / ``PGRST103``, which postgrest-py
    raises as ``APIError`` and every paged route used to turn into a 500 (so "Try again" re-asked
    the same impossible page forever). This is the ONE home of that answer:

      * ``build`` is a zero-argument factory returning a FRESH builder with the select
        (``count="exact"``), every filter and the order, but NO range — builders mutate in
        place, so the count re-read needs its own;
      * on ``PGRST103`` the same filters are re-read with ``.limit(1)`` (offset 0 is always
        satisfiable) for the exact count, and the result is ``data=[]`` with that count;
      * any other error is raised unchanged.

    Returns the response ``aexec`` would (``.data`` / ``.count``), or a ``SimpleNamespace`` of
    the same two attributes for the past-the-end page.
    """
    try:
        return await aexec(build().range(offset, offset + limit - 1))
    except APIError as e:
        if getattr(e, "code", None) != RANGE_NOT_SATISFIABLE:
            raise
    head = await aexec(build().limit(1))
    return SimpleNamespace(data=[], count=getattr(head, "count", None))
