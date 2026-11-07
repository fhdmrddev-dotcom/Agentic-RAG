"""Phase 308.1-02 (BUG-261107-01, D-05 / D-09 / D-10 / D-17) — the publish attempt record and the
exactly-once tail claim, proven against a REAL Postgres.

The golden run now outlives the publish request, so what the post-run stages need lives on the run
row, under ONE key: ``workflow_runs.metadata.publish``. Two workers can race for the same attempt
(both see the run end, or a sweep re-claims a stale one), so the tail is claimed by ONE conditional
``UPDATE … RETURNING`` that moves ``state`` ``running -> finishing``; only the winner judges and
flips.

The SQL tests run the REAL statements against a session-local TEMP ``workflow_runs`` (a temp table
shadows ``public`` on the search path), with the SAME jsonb codec the app pool installs
(``dependencies._init_pg_connection``), so the string-scalar trap is real here and nothing shared
is written. The lock test uses advisory locks only (no table at all).
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid

import pytest

_DSN = os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
LEASE = 300


async def _connect():
    import asyncpg

    try:
        conn = await asyncio.wait_for(asyncpg.connect(_DSN), timeout=2.0)
    except Exception:  # noqa: BLE001
        pytest.skip(f"local Postgres not reachable on {_DSN}")
    return conn


async def _temp_runs_conn():
    conn = await _connect()
    # The app pool's codec, verbatim (dependencies._init_pg_connection): plain dicts in, dicts out.
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await conn.execute(
        "CREATE TEMP TABLE workflow_runs ("
        " id uuid PRIMARY KEY, thread_id uuid, definition_id uuid, user_id uuid,"
        " status text, is_golden_run boolean, metadata jsonb, inputs jsonb,"
        " definition_snapshot jsonb, created_at timestamptz DEFAULT now(),"
        " updated_at timestamptz DEFAULT now(), claimed_at timestamptz)"
    )
    return conn


def _record(state="running", **over):
    rec = {
        "state": state,
        "stage0_token": "tok-1",
        "golden_input": "AFM-0431",
        "definition_id": str(uuid.uuid4()),
        "requested_by": str(uuid.uuid4()),
        "finishing_at": None,
        "verdict": None,
    }
    rec.update(over)
    return rec


async def _insert(
    conn,
    *,
    golden=True,
    metadata=None,
    definition_id=None,
    user_id=None,
    created_ago=0.0,
    inputs=None,
    snapshot=None,
):
    run_id = uuid.uuid4()
    await conn.execute(
        "INSERT INTO workflow_runs (id, thread_id, definition_id, user_id, status, is_golden_run,"
        " metadata, inputs, definition_snapshot, created_at) VALUES ("
        " $1, $2, $3, $4, 'active', $5, $6::jsonb, $7::jsonb, $8::jsonb,"
        " now() - make_interval(secs => $9::float8))",
        run_id,
        uuid.uuid4(),
        definition_id or uuid.uuid4(),
        user_id or uuid.uuid4(),
        golden,
        metadata,
        inputs,
        snapshot,
        float(created_ago),
    )
    return run_id


async def _publish_of(conn, run_id):
    return await conn.fetchval("SELECT metadata->'publish' FROM workflow_runs WHERE id = $1", run_id)


# ── write_publish_attempt: a plain dict, merged, never a string scalar ──────────────────────────


@pytest.mark.asyncio
async def test_the_attempt_is_written_as_an_object_and_keeps_the_other_keys():
    from app.db.workflows import write_publish_attempt

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(
            conn, metadata={"max_tokens_per_run": 5000, "circuit_breaker": {"tripped": False}}
        )
        rec = _record()
        await write_publish_attempt(conn, run_id, rec)
        kind = await conn.fetchval(
            "SELECT jsonb_typeof(metadata->'publish') FROM workflow_runs WHERE id = $1", run_id
        )
        assert kind == "object"
        meta = await conn.fetchval("SELECT metadata FROM workflow_runs WHERE id = $1", run_id)
        assert meta["max_tokens_per_run"] == 5000
        assert meta["circuit_breaker"] == {"tripped": False}
        assert meta["publish"] == rec
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_the_attempt_is_written_onto_a_null_metadata():
    from app.db.workflows import write_publish_attempt

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, metadata=None)
        await write_publish_attempt(conn, run_id, _record())
        assert (await _publish_of(conn, run_id))["state"] == "running"
    finally:
        await conn.close()


# ── claim_publish_tail: exactly one winner ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_two_racing_claims_on_one_running_attempt_produce_one_winner():
    from app.db.workflows import claim_publish_tail

    # One session: the TEMP table is per-session, so both claimers share it (the 261106 shape).
    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, metadata={"publish": _record("running")})
        results = [
            await claim_publish_tail(conn, run_id, LEASE),
            await claim_publish_tail(conn, run_id, LEASE),
        ]
        winners = [r for r in results if r is not None]
        assert len(winners) == 1, results
        assert results[1] is None
        won = winners[0]
        assert won["state"] == "finishing"
        assert won["finishing_at"]
        assert won["stage0_token"] == "tok-1"  # the record rides the claim back
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_a_fresh_finishing_attempt_is_not_claimable():
    from app.db.workflows import claim_publish_tail

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, metadata={"publish": _record("running")})
        assert await claim_publish_tail(conn, run_id, LEASE) is not None
        assert await claim_publish_tail(conn, run_id, LEASE) is None
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_a_stale_finishing_attempt_is_claimable_again():
    """D-17 crash recovery: a worker that died while finishing leaves a stale ``finishing``."""
    from app.db.workflows import claim_publish_tail

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, metadata={"publish": _record("finishing")})
        await conn.execute(
            "UPDATE workflow_runs SET metadata = jsonb_set(metadata, '{publish,finishing_at}',"
            " to_jsonb(now() - make_interval(secs => $2::float8))) WHERE id = $1",
            run_id,
            float(LEASE + 5),
        )
        won = await claim_publish_tail(conn, run_id, LEASE)
        assert won is not None and won["state"] == "finishing"
        # ...and it is fresh again now, so a third claimer loses.
        assert await claim_publish_tail(conn, run_id, LEASE) is None
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_a_done_attempt_is_never_claimed():
    from app.db.workflows import claim_publish_tail

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, metadata={"publish": _record("done", verdict={"published": True})})
        assert await claim_publish_tail(conn, run_id, LEASE) is None
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_a_non_golden_row_is_never_claimed():
    from app.db.workflows import claim_publish_tail

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, golden=False, metadata={"publish": _record("running")})
        assert await claim_publish_tail(conn, run_id, LEASE) is None
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_a_string_scalar_attempt_is_never_claimed():
    """The pre-dumped-string trap: ``->>`` on a jsonb STRING returns NULL, so it never matches."""
    from app.db.workflows import claim_publish_tail

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, metadata={"publish": json.dumps(_record("running"))})
        kind = await conn.fetchval(
            "SELECT jsonb_typeof(metadata->'publish') FROM workflow_runs WHERE id = $1", run_id
        )
        assert kind == "string"  # the planted shape is real
        assert await claim_publish_tail(conn, run_id, LEASE) is None
    finally:
        await conn.close()


# ── finish_publish_attempt: only from finishing, exactly once ───────────────────────────────────


@pytest.mark.asyncio
async def test_the_verdict_is_written_once_and_only_from_finishing():
    from app.db.workflows import claim_publish_tail, finish_publish_attempt

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, metadata={"publish": _record("running")})
        verdict = {"published": False, "blocked_stage": "judge", "golden_run_id": str(run_id)}
        # Not claimed yet: still ``running``, so the verdict write refuses.
        assert await finish_publish_attempt(conn, run_id, verdict) is False
        assert await claim_publish_tail(conn, run_id, LEASE) is not None
        assert await finish_publish_attempt(conn, run_id, verdict) is True
        rec = await _publish_of(conn, run_id)
        assert rec["state"] == "done"
        assert rec["verdict"] == verdict
        kind = await conn.fetchval(
            "SELECT jsonb_typeof(metadata->'publish'->'verdict') FROM workflow_runs WHERE id = $1",
            run_id,
        )
        assert kind == "object"
        # A second write changes nothing.
        assert await finish_publish_attempt(conn, run_id, {"published": True}) is False
        assert (await _publish_of(conn, run_id))["verdict"] == verdict
    finally:
        await conn.close()


# ── load_publish_attempt ────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_load_returns_the_golden_row_with_decoded_inputs_and_snapshot():
    from app.db.workflows import load_publish_attempt

    conn = await _temp_runs_conn()
    try:
        inputs = {"kickoff_prompt": "AFM-0431"}
        snapshot = {"name": "wf", "phases": []}
        rec = _record()
        # ``inputs`` lands as a jsonb STRING SCALAR in production (create_workflow_run
        # pre-dumps it); the snapshot is an object, but older rows are strings too.
        run_id = await _insert(
            conn, metadata={"publish": rec}, inputs=json.dumps(inputs), snapshot=json.dumps(snapshot)
        )
        got = await load_publish_attempt(conn, run_id)
        assert got is not None
        assert got["run_id"] == run_id
        assert got["inputs"] == inputs
        assert got["definition_snapshot"] == snapshot
        assert got["publish"] == rec
        assert got["status"] == "active"
        for key in ("thread_id", "definition_id", "user_id", "created_at"):
            assert got[key] is not None, key

        run2 = await _insert(conn, metadata={"publish": rec}, inputs=inputs, snapshot=snapshot)
        got2 = await load_publish_attempt(conn, run2)
        assert got2["inputs"] == inputs and got2["definition_snapshot"] == snapshot
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_load_returns_none_for_a_non_golden_or_missing_row():
    from app.db.workflows import load_publish_attempt

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, golden=False, metadata={"publish": _record()})
        assert await load_publish_attempt(conn, run_id) is None
        assert await load_publish_attempt(conn, uuid.uuid4()) is None
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_load_reports_a_golden_row_with_no_record_as_publish_none():
    """A pre-308.1 golden orphan carries no record; the sweep (308.1-03) must be able to see that."""
    from app.db.workflows import load_publish_attempt

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, metadata=None)
        got = await load_publish_attempt(conn, run_id)
        assert got is not None and got["publish"] is None
    finally:
        await conn.close()


# ── active_publish_attempt: the one-attempt-per-draft lookup (D-10) ─────────────────────────────


@pytest.mark.asyncio
async def test_active_attempt_is_this_users_newest_running_or_finishing_one():
    from app.db.workflows import active_publish_attempt

    conn = await _temp_runs_conn()
    try:
        definition_id, user_id, other_user = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        await _insert(
            conn, definition_id=definition_id, user_id=user_id,
            metadata={"publish": _record("running")}, created_ago=60,
        )
        newest = await _insert(
            conn, definition_id=definition_id, user_id=user_id,
            metadata={"publish": _record("finishing")}, created_ago=10,
        )
        got = await active_publish_attempt(
            conn, definition_id=definition_id, user_id=user_id, max_age_seconds=7200
        )
        assert got is not None
        assert got["run_id"] == newest
        assert got["state"] == "finishing"
        assert await active_publish_attempt(
            conn, definition_id=definition_id, user_id=other_user, max_age_seconds=7200
        ) is None
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_active_attempt_ignores_done_old_and_non_golden_rows():
    from app.db.workflows import active_publish_attempt

    conn = await _temp_runs_conn()
    try:
        definition_id, user_id = uuid.uuid4(), uuid.uuid4()
        await _insert(conn, definition_id=definition_id, user_id=user_id,
                      metadata={"publish": _record("done")})
        await _insert(conn, definition_id=definition_id, user_id=user_id,
                      metadata={"publish": _record("running")}, created_ago=7300)
        await _insert(conn, definition_id=definition_id, user_id=user_id, golden=False,
                      metadata={"publish": _record("running")})
        await _insert(conn, definition_id=definition_id, user_id=user_id,
                      metadata={"publish": json.dumps(_record("running"))})
        assert await active_publish_attempt(
            conn, definition_id=definition_id, user_id=user_id, max_age_seconds=7200
        ) is None
    finally:
        await conn.close()


# ── publish_attempt_lock: one check-and-create at a time per draft (D-10 / Pitfall 6) ──────────


@pytest.mark.asyncio
async def test_the_attempt_lock_is_held_inside_and_released_after():
    import asyncpg

    from app.db.workflows import publish_attempt_lock

    probe = await _connect()
    try:
        pool = await asyncpg.create_pool(_DSN, min_size=1, max_size=2)
    except Exception:  # noqa: BLE001
        await probe.close()
        pytest.skip(f"local Postgres not reachable on {_DSN}")
    definition_id = uuid.uuid4()
    try_sql = "SELECT pg_try_advisory_lock(hashtextextended($1::text, 3081))"
    unlock_sql = "SELECT pg_advisory_unlock(hashtextextended($1::text, 3081))"
    try:
        async with publish_attempt_lock(pool, definition_id):
            assert await probe.fetchval(try_sql, str(definition_id)) is False
        assert await probe.fetchval(try_sql, str(definition_id)) is True
        await probe.fetchval(unlock_sql, str(definition_id))
    finally:
        await pool.close()
        await probe.close()


@pytest.mark.asyncio
async def test_the_attempt_lock_is_released_when_the_body_raises():
    import asyncpg

    from app.db.workflows import publish_attempt_lock

    probe = await _connect()
    try:
        pool = await asyncpg.create_pool(_DSN, min_size=1, max_size=2)
    except Exception:  # noqa: BLE001
        await probe.close()
        pytest.skip(f"local Postgres not reachable on {_DSN}")
    definition_id = uuid.uuid4()
    try_sql = "SELECT pg_try_advisory_lock(hashtextextended($1::text, 3081))"
    unlock_sql = "SELECT pg_advisory_unlock(hashtextextended($1::text, 3081))"
    try:
        with pytest.raises(RuntimeError):
            async with publish_attempt_lock(pool, definition_id):
                raise RuntimeError("boom")
        assert await probe.fetchval(try_sql, str(definition_id)) is True
        await probe.fetchval(unlock_sql, str(definition_id))
    finally:
        await pool.close()
        await probe.close()
