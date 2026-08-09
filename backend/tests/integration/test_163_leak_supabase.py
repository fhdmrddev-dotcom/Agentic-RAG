"""Phase 163 (TEN-02 / D-08) — the supabase-py two-user LEAK CORE (RED until 163-05 applies 107+108).

The SECOND DB path of the crux proof: the per-request user-JWT supabase-py client (anon key +
the user's Bearer, NEVER a mutation of the ``get_supabase()`` singleton — Pitfall 2) reads 0 of
another user's rows once the Wave-4 swap flips PostgREST to role ``authenticated``.

Two independent proofs:
  * BEHAVIORAL — supabase-py fluent reads (``.table().select().eq().execute()``) run over an
    asyncpg connection carrying user B's RLS context via the Phase-111.1 ``SupabaseTxnAdapter``
    bridge (harness ``as_user_supabase_txn``), so the REAL membership-RLS WHERE clause hits REAL
    two-user rows — not a MagicMock. ``.execute()`` is synchronous (supabase-py is sync), so it
    is called inside ``run_in_threadpool`` exactly as production does (D-v2.5-01); the adapter
    then schedules the SQL back onto the running test loop. The POSITIVE CONTROL (B sees its OWN
    row) doubles as the path's auth.uid()-liveness guard — a NULL uid would make B's own row
    vanish too, so an over-restricting / NULL-uid harness fails loudly instead of 0-for-everyone.
  * STRUCTURAL — ``get_user_supabase`` builds a NEW anon+Bearer client per request and never
    re-creates or mutates the shared service-role singleton (the cross-request identity-bleed
    guard); two requests get two distinct clients, neither of which is the singleton.

STATE CONTRACT: RED *now* — GREEN after plan 163-05. For THIS plan the bar is
``pytest ... --collect-only``. Skip-guarded on local Postgres :54322.
"""
from __future__ import annotations

from uuid import uuid4

import pytest
from starlette.concurrency import run_in_threadpool

from tests.integration._rls_harness import as_user_supabase_txn, requires_pg

pytestmark = requires_pg


# Same representative seeded set as the asyncpg core — each user owns exactly one row here.
_SEEDED_TABLES = (
    ("documents", "doc_id"),
    ("folders", "folder_id"),
    ("threads", "thread_id"),
    ("skills", "skill_id"),
)


async def _select_ids(adapter, table: str, row_id: str) -> list:
    """Run ``.table(table).select('id').eq('id', row_id).execute()`` the way the app does —
    synchronously inside ``run_in_threadpool`` so the sync ``.execute()`` runs on a worker
    thread and the adapter schedules its asyncpg coroutine back onto the running test loop.
    Returns the ``.data`` list (0-length == not visible under RLS)."""
    def _call():
        return adapter.table(table).select("id").eq("id", row_id).execute()

    res = await run_in_threadpool(_call)
    return res.data


async def _assert_isolated_supabase(pool, viewer: dict, other: dict) -> None:
    """Per-request supabase-py path: positive control (viewer sees its OWN row) then isolation
    (0 of ``other``'s row) across the seeded set. The positive control is the path's fail-loud
    guard — under RLS a NULL auth.uid() hides the viewer's own row too, so 0-for-everyone
    surfaces here rather than false-greening the isolation assertion."""
    async with as_user_supabase_txn(pool, viewer["uid"]) as sb:
        for table, id_key in _SEEDED_TABLES:
            own = await _select_ids(sb, table, viewer[id_key])
            assert len(own) == 1, (
                f"positive-control failure (PostgREST path): {viewer['uid']} cannot see its "
                f"OWN {table} row {viewer[id_key]} — a NULL-uid / over-restricting bridge "
                f"would false-green the isolation assertion below."
            )
            leaked = await _select_ids(sb, table, other[id_key])
            assert len(leaked) == 0, (
                f"cross-org leak (PostgREST path): {viewer['uid']} reads {other['uid']}'s "
                f"{table} row {other[id_key]}."
            )


# ── behavioral isolation, both directions ──

@pytest.mark.asyncio
async def test_supabase_user_b_reads_zero_of_user_a(pg_pool, two_orgs_two_users):
    """Per-request supabase-py client: user B reads 0 of user A's rows across the seeded
    table set (and sees its OWN — non-vacuous)."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    await _assert_isolated_supabase(pg_pool, viewer=b, other=a)


@pytest.mark.asyncio
async def test_supabase_user_a_reads_zero_of_user_b(pg_pool, two_orgs_two_users):
    """Symmetric direction on the PostgREST path."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    await _assert_isolated_supabase(pg_pool, viewer=a, other=b)


# ── structural: per-request client, no singleton mutation (Pitfall 2) ──

@pytest.mark.asyncio
async def test_per_request_client_does_not_mutate_singleton():
    """``get_user_supabase`` builds a NEW anon+Bearer client per request and NEVER re-creates
    or mutates the ``get_supabase()`` service-role singleton — the guard against one user's
    token bleeding into a concurrent request / a WORKER_COUNT=2 worker (Pitfall 2).

    Client construction is offline (no network), but env may lack the local anon key on a
    machine without the stack, so construction failure SKIPS rather than errors."""
    from app.dependencies import get_supabase, get_user_supabase

    uid_a, uid_b = str(uuid4()), str(uuid4())
    try:
        singleton_before = get_supabase()
        client_b = get_user_supabase(None, {"id": uid_b}, f"tok-{uid_b}")
        client_a = get_user_supabase(None, {"id": uid_a}, f"tok-{uid_a}")
        singleton_after = get_supabase()
    except Exception as e:  # noqa: BLE001 — missing local anon/service key etc.
        pytest.skip(f"supabase client construction unavailable: {type(e).__name__}: {e}")

    assert singleton_before is singleton_after, (
        "get_supabase() singleton was re-created — a per-request build must not touch it"
    )
    assert client_b is not singleton_before, (
        "per-request client must NOT be the shared service-role singleton (that BYPASSES RLS)"
    )
    assert client_a is not singleton_before
    assert client_a is not client_b, (
        "each request must get its OWN client — a shared, mutated client bleeds identity"
    )
