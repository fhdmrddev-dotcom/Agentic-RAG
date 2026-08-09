"""Phase 163 — shared RLS integration-test harness.

The reusable substrate every ``test_163_*.py`` file imports so the SET-LOCAL-as-user
shape, the supabase-py-over-asyncpg bridge, the fail-loud ``auth.uid()`` preflight, and
the Postgres skip-guard live in ONE place (no per-file re-derivation).

Design invariants:
  * The role swap + both-GUC-forms sequence is NOT re-implemented here — it is imported
    verbatim from ``app.dependencies._apply_rls_user_context`` so the request factory
    (``get_user_pg_connection``) and the leak / cluster tests can never drift.
  * ``assert_auth_uid`` is a FAIL-LOUD preflight: a NULL ``auth.uid()`` (wrong GUC
    variant or a forgotten role swap) false-passes an isolation assertion at "0 rows",
    so it MUST raise BEFORE any isolation check runs (RESEARCH D-08 design, step 2).
  * Everything is skip-guarded on the local Postgres :54322 — a machine without the
    stack up skips these live tests instead of erroring.
"""
from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import pytest

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

# The single source of truth for the role-first + both-GUC-forms + is_local=true shape.
# Importing the APP function (not a copy) guarantees the harness and the request factory
# apply an IDENTICAL RLS context — a divergence here would silently weaken the leak proof.
from app.dependencies import _apply_rls_user_context

# ── DSN + skip-guard (moved here so every test_163_* shares it) ─────────────────

PG_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def pg_reachable(dsn: str = PG_TEST_DSN) -> bool:
    if asyncpg is None:
        return False
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()

# Reusable marker: decorate any live test_163_* test with @requires_pg.
requires_pg = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {PG_TEST_DSN} not reachable; skipping live Phase-163 RLS test",
)


# ── SET-LOCAL-as-user (asyncpg path) ───────────────────────────────────────────

@asynccontextmanager
async def open_user_conn(pool, uid: str) -> AsyncIterator["asyncpg.Connection"]:
    """Acquire a pooled connection, open a transaction, and turn RLS ON as ``uid``.

    Mirrors ``get_user_pg_connection`` but takes an explicit ``pool`` (the test pool
    fixture) so any test_163_* can run as a user against any pool. The COMMIT at exit
    auto-reverts every ``SET LOCAL`` (``is_local=true``).
    """
    async with pool.acquire() as conn:
        async with conn.transaction():
            await _apply_rls_user_context(conn, uid)
            yield conn


async def as_user_asyncpg(pool, uid: str, sql: str, *args) -> list:
    """Run one SELECT under RLS as ``uid`` (role-first + both GUC forms). Returns rows.

    For a two-user leak assertion: as user B, ``len(as_user_asyncpg(pool, B, sql_over_A))``
    must be 0. For a count query use ``rows[0][0]``.
    """
    async with open_user_conn(pool, uid) as conn:
        return await conn.fetch(sql, *args)


async def as_user_fetchval(pool, uid: str, sql: str, *args) -> Any:
    """Convenience: run one query under RLS as ``uid`` and return a single scalar."""
    async with open_user_conn(pool, uid) as conn:
        return await conn.fetchval(sql, *args)


@asynccontextmanager
async def as_user_supabase_txn(pool, uid: str):
    """Yield a supabase-py-shaped adapter whose SQL runs INSIDE a ``uid`` RLS txn.

    Bridges the supabase-py fluent surface (``.table(...).select(...).eq(...).execute()``)
    onto an asyncpg connection carrying the user's RLS context, so the real RLS WHERE
    clause hits real two-user rows (not a MagicMock). Reuses the Phase-111.1
    ``SupabaseTxnAdapter`` bridge. Consumed by the Wave-4 supabase-path leak test.
    """
    from tests.integration._reembed_adapter import SupabaseTxnAdapter

    async with open_user_conn(pool, uid) as conn:
        yield SupabaseTxnAdapter(conn)


# ── fail-loud auth.uid() preflight ─────────────────────────────────────────────

async def assert_auth_uid(conn, expected_uid: str):
    """Assert ``SELECT auth.uid()`` == ``expected_uid`` BEFORE any isolation assertion.

    FAIL-LOUD: a NULL ``auth.uid()`` means the role swap didn't take or the GUC variant
    is wrong — and a NULL uid would false-PASS an isolation check at "0 rows". Raising
    here converts that silent false-green into a loud failure (RESEARCH D-08, step 2).
    Returns the resolved uid on success.
    """
    got = await conn.fetchval("SELECT auth.uid()")
    assert got is not None, (
        "auth.uid() resolved to NULL — the SET LOCAL ROLE swap or the JWT-claim GUC did "
        "not take. A NULL uid false-passes isolation at '0 rows'; refusing to proceed."
    )
    assert str(got) == str(expected_uid), (
        f"auth.uid()={got!r} != expected {expected_uid!r} — wrong claims on this connection"
    )
    return got


# ── auth.uid() live-variant probe ──────────────────────────────────────────────

async def probe_auth_uid_variant(pool) -> dict:
    """Record which GUC form(s) THIS database's ``auth.uid()`` reads (D-02 arbitration).

    Reads ``pg_get_functiondef('auth.uid()'::regprocedure)`` and reports whether the
    body references the legacy per-claim ``request.jwt.claim.sub``, the JSON blob
    ``request.jwt.claims``, or both. Both-forms is why ``get_user_pg_connection`` sets
    both unconditionally — this makes the choice variant-independent by construction.
    """
    body = await pool.fetchval(
        "SELECT pg_get_functiondef('auth.uid()'::regprocedure)"
    )
    body_l = (body or "").lower()
    return {
        "reads_legacy": "request.jwt.claim.sub" in body_l,
        "reads_json": "request.jwt.claims" in body_l,
        "definition": body,
    }


__all__ = [
    "PG_TEST_DSN",
    "PG_AVAILABLE",
    "requires_pg",
    "pg_reachable",
    "open_user_conn",
    "as_user_asyncpg",
    "as_user_fetchval",
    "as_user_supabase_txn",
    "assert_auth_uid",
    "probe_auth_uid_variant",
    "json",
]
