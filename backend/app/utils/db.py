"""Async wrapper around Supabase sync `.execute()` calls (Phase 058 — D-058-03).

Wraps `query.execute()` in `starlette.concurrency.run_in_threadpool` so the
asyncio event loop is not blocked on Postgres round-trips. This is the
SSE-path threadpool wrap referenced in research §A1–A2 — it coexists with
the existing `_patch_postgrest_maybe_single` patch in `main.py:17–40` (both
wrap `execute`; the postgrest patch handles a 204-error edge case at
import time, while `aexec` runs the call off the event loop at request
time).

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
from uuid import UUID

from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)


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
