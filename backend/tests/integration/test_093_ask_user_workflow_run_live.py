"""Phase 093 / Plan 04 — ask_user round-trip workflow_run-id fallback (F10) — live DB.

D-07 / D-08: a harness ``llm_human_input`` prompt's tool_call carries the
WORKFLOW_RUN id (ctx.run_id), NOT a ``runs`` row. The current
``POST /runs/{id}/ask_user_response`` endpoint (runs.py Step-1 SELECT) keys the
path id against the ``runs`` table only → 404 for harness. Plan 04 adds an
owner-scoped, thread-anchor-confirmed ``workflow_runs`` fallback — the EXACT
pattern the Continue endpoint already uses (continue_run Step-1 fallback) — then
persists/emits/publishes under the workflow_run id so it matches the harness
subscribe channel ``ask_user:{workflow_run_id}:{tcid}``.

This module drives the endpoint COROUTINE directly (``submit_ask_user_response``)
against the LIVE local Supabase — the service-role supabase client (PostgREST on
:54321) + a fresh asyncpg pool (:54322) seed/inspect the SAME Postgres. It does
NOT need the backend HTTP server running, only the local Supabase containers
(which auto-start). A recording fake Redis captures the Step-4 ``publish`` channel
so we can prove the answer publishes under the workflow_run id.

GREEN contract (093-04 lands the endpoint branch):
  1. POSTing an answer where {id} is a workflow_runs.id (NOT a runs row) under the
     OWNING user (thread anchor pointing at it) resolves via the workflow_runs
     fallback → 200, persists an ask_user_response messages row, AND publishes on
     ``ask_user:{workflow_run_id}:{tcid}`` (so the harness subscribe wakes).
  2. The Deep path (a real runs.run_id) still returns 200 (existing Step-1 SELECT
     path — D-08, the protected working path is unaffected) and publishes on
     ``ask_user:{run_id}:{tcid}``.
  3. A workflow_run id owned by ANOTHER user returns 404 (NEVER 403 — no existence
     leak; T-093-IDOR). Same indistinguishable 404 as a non-existent id.
  4. A workflow_run id that is NOT the thread's current anchor returns 404
     (anchor-confirm gate — owner alone is not enough).

Modeled on test_092_subagent_parent_fk_live.py's PG-skip guard + seeded
auth.users/threads fixture. Skips cleanly (never errors) when local Postgres
:54322 (or the Supabase REST gate) is unreachable.
"""
from __future__ import annotations

import asyncio
import json
import os
from uuid import UUID, uuid4

import asyncpg
import pytest
import pytest_asyncio
from fastapi import HTTPException


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    """Probe local Postgres availability without raising. Used by skipif guard."""
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    """Synchronous wrapper for the async probe (used by pytest.mark.skipif)."""
    import asyncio as _a
    try:
        loop = _a.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live ask_user workflow_run tests",
)


# ----------------------------------------------------------------------------
# Recording fake Redis — captures the Step-4 publish channel (and never raises).
# ----------------------------------------------------------------------------

class _RecordingRedis:
    """Minimal async Redis stand-in for the endpoint's Step-3 (_emit → xadd) and
    Step-4 (publish_response → publish). Records every publish channel/payload so
    the test can assert the answer publishes under the resolved id. Both endpoint
    steps wrap failures in try/except, so a partial stand-in is safe — but we make
    xadd/publish succeed so the assertion is meaningful, not coincidental."""

    def __init__(self) -> None:
        self.published: list[tuple[str, str]] = []
        self.xadds: list[tuple[str, dict]] = []

    async def xadd(self, stream, fields, **kwargs):  # noqa: ANN001
        self.xadds.append((stream, fields))
        return b"0-1"

    async def publish(self, channel, payload):  # noqa: ANN001
        self.published.append((channel, payload))
        return 0  # no live subscriber in this DB-only test


# ----------------------------------------------------------------------------
# Fixtures (mirrors test_092_subagent_parent_fk_live.py — LIVE pool, NOT mock)
# ----------------------------------------------------------------------------

@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322.

    Function scope (NOT session) is REQUIRED — pytest-asyncio creates a fresh
    event loop per test, and asyncpg pools are loop-bound.
    """
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def two_users(pg_pool):
    """Seed two throwaway auth.users + a thread for each; clean up afterward.

    Yields ((owner_thread, owner_user), (other_thread, other_user)). The owner pair
    drives the happy-path + Deep cases; the other pair drives the IDOR 404 case.
    """
    owner_user, owner_thread = uuid4(), uuid4()
    other_user, other_thread = uuid4(), uuid4()
    try:
        for uid, tid, tag in (
            (owner_user, owner_thread, "owner"),
            (other_user, other_thread, "other"),
        ):
            await pg_pool.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                uid, f"phase-093-{tag}-{uid}@test.local",
            )
            await pg_pool.execute(
                "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, $3)",
                tid, uid, f"phase-093 ask_user {tag} thread",
            )
    except Exception as e:
        pytest.skip(f"two_users fixture setup failed: {type(e).__name__}: {e}")
    yield ((owner_thread, owner_user), (other_thread, other_user))
    for tid, uid in ((owner_thread, owner_user), (other_thread, other_user)):
        for sql in (
            # Clear the anchor first (threads.active_workflow_run_id FKs workflow_runs).
            ("UPDATE threads SET active_workflow_run_id = NULL WHERE id = $1", tid),
            ("DELETE FROM messages WHERE thread_id = $1", tid),
            ("DELETE FROM runs WHERE thread_id = $1", tid),
            ("DELETE FROM workflow_phases WHERE workflow_run_id IN "
             "(SELECT id FROM workflow_runs WHERE thread_id = $1)", tid),
            ("DELETE FROM workflow_runs WHERE thread_id = $1", tid),
            ("DELETE FROM threads WHERE id = $1", tid),
            ("DELETE FROM auth.users WHERE id = $1", uid),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


def _read_local_supabase_env() -> "tuple[str, str] | None":
    """Read the REAL local Supabase URL + service-role key from backend/.env.

    The root tests/conftest.py forces SUPABASE_URL=https://test.supabase.co (a
    fake cloud host) at import time so the rest of the suite runs against a mock
    client. This live test needs the ACTUAL local Supabase REST gate, so it reads
    the two values straight from backend/.env (the same source the non-pytest
    settings load resolves), bypassing the conftest override. Returns None if
    either value is absent (→ caller skips). Secrets are never printed.
    """
    # backend/.env relative to this file: tests/integration/ → ../../.env
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(env_path):
        return None
    url = key = None
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k == "SUPABASE_URL":
                    url = v
                elif k == "SUPABASE_SERVICE_ROLE_KEY":
                    key = v
    except OSError:
        return None
    if not url or not key:
        return None
    return url, key


def _supabase_or_skip():
    """Build a service-role supabase client against the REAL local Supabase, or skip.

    Mirrors app.dependencies.get_supabase (create_client against the local
    Supabase REST URL :54321 with the service-role key) but sources URL+key from
    backend/.env so the conftest's fake cloud URL never reaches this test. Probes
    the REST gate (a trivial owner-scoped SELECT) and skips cleanly on ANY connect
    failure so this test never hard-fails on a transport gap (constraint: live DB
    unreachable → SKIP, not FAIL).
    """
    creds = _read_local_supabase_env()
    if creds is None:
        pytest.skip("local SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in backend/.env")
    url, key = creds
    try:
        from supabase import create_client
        client = create_client(url, key)
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"supabase service-role client unavailable: {type(e).__name__}: {e}")
    # Probe reachability synchronously — a transport/DNS failure here means the
    # local REST gate is down → skip (never hard-fail).
    try:
        client.table("threads").select("id").limit(1).execute()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"local Supabase REST gate unreachable: {type(e).__name__}: {e}")
    return client


async def _seed_workflow_run(pg_pool, *, thread_id, user_id, set_anchor: bool):
    """Insert a minimal workflow_runs row; optionally point the thread anchor at it.

    Uses a real published workflow_definitions seed for definition_id (FK). Returns
    the new workflow_runs.id (UUID). The anchor is what gates the F10 fallback
    (owner alone is insufficient — the row's thread must carry this id as its
    active_workflow_run_id).
    """
    def_id = await pg_pool.fetchval(
        "SELECT id FROM workflow_definitions WHERE status = 'published' LIMIT 1"
    )
    if def_id is None:
        pytest.skip("no published workflow_definitions seed present (migration 061)")
    wf_id = await pg_pool.fetchval(
        """
        INSERT INTO workflow_runs (thread_id, definition_id, status, inputs, model, user_id)
        VALUES ($1, $2, 'active', $3::jsonb, $4, $5)
        RETURNING id
        """,
        thread_id, def_id, json.dumps({"kickoff_prompt": "f10 live test"}), None, user_id,
    )
    if set_anchor:
        await pg_pool.execute(
            "UPDATE threads SET active_workflow_run_id = $1 WHERE id = $2",
            wf_id, thread_id,
        )
    return wf_id


async def _call_endpoint(run_id: UUID, *, user_id: UUID, supabase, redis):
    """Invoke submit_ask_user_response directly as a coroutine (no HTTP server)."""
    from app.api.runs import submit_ask_user_response, AskUserResponseBody
    body = AskUserResponseBody(
        tool_call_id="tc-f10-live",
        response_text="confirmed",
        choice_index=None,
    )
    return await submit_ask_user_response(
        run_id=run_id,
        body=body,
        current_user={"id": str(user_id)},
        supabase=supabase,
        redis=redis,
    )


# ----------------------------------------------------------------------------
# F10 closure gates (live DB) — GREEN now that 093-04 landed the endpoint branch
# ----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ask_user_answer_resolves_via_workflow_run_fallback(pg_pool, two_users):
    """POSTing an answer where {id} is a workflow_runs.id (NOT a runs row) under the
    OWNING user (thread anchor pointing at it) resolves via the workflow_runs
    fallback → 200, persists an ask_user_response messages row, AND publishes on
    ``ask_user:{workflow_run_id}:{tcid}`` so the harness subscribe wakes."""
    (owner_thread, owner_user), _other = two_users
    supabase = _supabase_or_skip()
    redis = _RecordingRedis()

    wf_id = await _seed_workflow_run(
        pg_pool, thread_id=owner_thread, user_id=owner_user, set_anchor=True,
    )

    result = await _call_endpoint(wf_id, user_id=owner_user, supabase=supabase, redis=redis)
    assert result == {"status": "ok"}  # 200 — resolved via the workflow_runs fallback

    # The ask_user_response messages row persisted under the workflow_run's thread.
    # Inspect the JSONB tool_calls via path operators (codec-independent) so the
    # assertion does not depend on the asyncpg jsonb param encoder.
    msg_count = await pg_pool.fetchval(
        "SELECT count(*) FROM messages "
        "WHERE thread_id = $1 "
        "AND tool_calls -> 0 ->> 'kind' = 'ask_user_response' "
        "AND tool_calls -> 0 ->> 'tool_call_id' = 'tc-f10-live'",
        owner_thread,
    )
    assert msg_count == 1, "an ask_user_response messages row must persist under the wf thread"

    # The answer published on the harness subscribe channel keyed by the WORKFLOW_RUN id.
    expected_channel = f"ask_user:{wf_id}:tc-f10-live"
    assert any(ch == expected_channel for ch, _ in redis.published), (
        f"publish must hit {expected_channel!r}; got {redis.published!r}"
    )


@pytest.mark.asyncio
async def test_deep_runs_id_path_still_200(pg_pool, two_users):
    """The Deep path (a real runs.run_id) still returns 200 — the existing Step-1
    SELECT path is unaffected (D-08, protected working path) — and publishes on
    ``ask_user:{run_id}:{tcid}`` keyed by the runs id (BRANCH, never replace)."""
    (owner_thread, owner_user), _other = two_users
    supabase = _supabase_or_skip()
    redis = _RecordingRedis()

    from app.db.runs import insert_run
    run_id = uuid4()
    await insert_run(
        pg_pool,
        run_id=run_id,
        thread_id=owner_thread,
        user_id=owner_user,
        # A Deep ask_user pause keeps the run 'streaming' (the handler blocks on
        # the subscribe). 'paused' is not a valid runs.status (runs_status_check).
        status="streaming",
        model="gpt-5.4-mini",
        provider="openai",
        parent_run_id=None,
    )

    result = await _call_endpoint(run_id, user_id=owner_user, supabase=supabase, redis=redis)
    assert result == {"status": "ok"}  # Deep Step-1 runs SELECT succeeds — unchanged

    expected_channel = f"ask_user:{run_id}:tc-f10-live"
    assert any(ch == expected_channel for ch, _ in redis.published), (
        f"Deep publish must hit {expected_channel!r}; got {redis.published!r}"
    )


@pytest.mark.asyncio
async def test_other_users_workflow_run_returns_404_no_leak(pg_pool, two_users):
    """A workflow_run id owned by ANOTHER user returns 404 (NEVER 403 — no existence
    leak; T-093-IDOR). The fallback is .eq('user_id', current_user) scoped, so the
    owner-mismatch response is INDISTINGUISHABLE from a non-existent id."""
    (_owner_thread, owner_user), (other_thread, other_user) = two_users
    supabase = _supabase_or_skip()
    redis = _RecordingRedis()

    # A workflow_run owned by `other_user`, anchored on `other_thread`.
    wf_id = await _seed_workflow_run(
        pg_pool, thread_id=other_thread, user_id=other_user, set_anchor=True,
    )

    # The OWNER (not `other_user`) POSTs the answer for `other`'s workflow_run id.
    with pytest.raises(HTTPException) as exc_info:
        await _call_endpoint(wf_id, user_id=owner_user, supabase=supabase, redis=redis)
    assert exc_info.value.status_code == 404, (
        "a cross-user workflow_run id MUST return 404 — never 403 (no existence leak)"
    )
    assert exc_info.value.status_code != 403
    # Nothing published, nothing persisted under the attacker's identity.
    assert redis.published == []


@pytest.mark.asyncio
async def test_non_existent_id_returns_404(pg_pool, two_users):
    """A wholly non-existent id returns the SAME 404 as a cross-user id — the
    no-leak contract: 'not yours' and 'doesn't exist' are indistinguishable."""
    (_owner_thread, owner_user), _other = two_users
    supabase = _supabase_or_skip()
    redis = _RecordingRedis()

    with pytest.raises(HTTPException) as exc_info:
        await _call_endpoint(uuid4(), user_id=owner_user, supabase=supabase, redis=redis)
    assert exc_info.value.status_code == 404
    assert redis.published == []


@pytest.mark.asyncio
async def test_workflow_run_not_thread_anchor_returns_404(pg_pool, two_users):
    """A workflow_run id OWNED by the caller but NOT the thread's current anchor
    returns 404 — the anchor-confirm gate (owner alone is insufficient; only the
    thread's live active_workflow_run_id resolves)."""
    (owner_thread, owner_user), _other = two_users
    supabase = _supabase_or_skip()
    redis = _RecordingRedis()

    # Owner's workflow_run, but the thread anchor is NOT pointed at it.
    wf_id = await _seed_workflow_run(
        pg_pool, thread_id=owner_thread, user_id=owner_user, set_anchor=False,
    )

    with pytest.raises(HTTPException) as exc_info:
        await _call_endpoint(wf_id, user_id=owner_user, supabase=supabase, redis=redis)
    assert exc_info.value.status_code == 404, (
        "owner-but-non-anchor workflow_run must 404 (anchor-confirm gate)"
    )
    assert redis.published == []
