"""Phase 308.1-03 (BUG-261107-01, D-11 / D-14 / D-17 / D-20) — the four reads the golden sweep and
the publish follow read stand on, proven against a REAL Postgres.

* ``find_stranded_golden_runs`` — an ``active`` golden run whose producer heartbeat
  (``updated_at``) is older than the lease. No active-step requirement: a worker can die BETWEEN
  steps (previous step completed, next one pending, run still active).
* ``find_stranded_publish_tails`` — a golden run that ENDED while its publish record still reads
  ``running`` (the worker died before claiming the tail), or a ``finishing`` claim older than the
  lease (the worker died mid-tail). A terminal run needs NO staleness check: the periodic
  reconciler finalises a dead golden run and writes a fresh ``updated_at`` while doing it.
* ``latest_publish_attempt`` — the caller's newest golden run carrying a record for a draft;
  another user's never.
* ``find_publish_receipt`` — the newest ``harness_audit`` metadata of one kind for one run
  (``write_audit`` stores it double-encoded; the reader decodes it to a dict).

Every statement runs against session-local TEMP tables (a temp table shadows ``public`` on the
search path) with the app pool's jsonb codec, so nothing shared is written (worktree rule 4).
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


async def _temp_conn():
    conn = await _connect()
    # The app pool's codec, verbatim (dependencies._init_pg_connection).
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await conn.execute(
        "CREATE TEMP TABLE workflow_runs ("
        " id uuid PRIMARY KEY, thread_id uuid, definition_id uuid, user_id uuid,"
        " status text, is_golden_run boolean, metadata jsonb, inputs jsonb,"
        " definition_snapshot jsonb, created_at timestamptz DEFAULT now(),"
        " updated_at timestamptz DEFAULT now(), claimed_at timestamptz)"
    )
    await conn.execute(
        "CREATE TEMP TABLE harness_audit (id uuid DEFAULT gen_random_uuid(), run_id uuid,"
        " user_id uuid, event_type text, metadata jsonb, created_at timestamptz DEFAULT now())"
    )
    return conn


def _record(state="running", **over):
    rec = {
        "state": state,
        "stage0_token": "tok-SECRET-308",
        "golden_input": "GOLDEN-INPUT-308",
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
    status="active",
    golden=True,
    publish=None,
    metadata=None,
    definition_id=None,
    user_id=None,
    created_ago=0.0,
    updated_ago=0.0,
    snapshot=None,
):
    run_id = uuid.uuid4()
    meta = metadata if metadata is not None else ({"publish": publish} if publish is not None else None)
    await conn.execute(
        "INSERT INTO workflow_runs (id, thread_id, definition_id, user_id, status, is_golden_run,"
        " metadata, definition_snapshot, created_at, updated_at) VALUES ("
        " $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb,"
        " now() - make_interval(secs => $9::float8), now() - make_interval(secs => $10::float8))",
        run_id,
        uuid.uuid4(),
        definition_id or uuid.uuid4(),
        user_id or uuid.uuid4(),
        status,
        golden,
        meta,
        snapshot,
        float(created_ago),
        float(updated_ago),
    )
    return run_id


def _ids(rows):
    return {r["run_id"] for r in rows}


# ── find_stranded_golden_runs ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_stale_active_golden_run_is_stranded_with_or_without_a_record():
    from app.db.workflows import find_stranded_golden_runs

    conn = await _temp_conn()
    try:
        definition_id, user_id = uuid.uuid4(), uuid.uuid4()
        with_record = await _insert(
            conn, publish=_record(), updated_ago=LEASE + 60, definition_id=definition_id,
            user_id=user_id, created_ago=900,
        )
        orphan = await _insert(conn, updated_ago=LEASE + 60)
        rows = await find_stranded_golden_runs(conn, LEASE)
        by_id = {r["run_id"]: r for r in rows}
        assert set(by_id) == {with_record, orphan}
        assert by_id[with_record]["has_publish"] is True
        assert by_id[orphan]["has_publish"] is False
        assert by_id[with_record]["definition_id"] == definition_id
        assert by_id[with_record]["user_id"] == user_id
        assert by_id[with_record]["created_at"] is not None
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_a_string_scalar_record_is_not_a_record():
    from app.db.workflows import find_stranded_golden_runs

    conn = await _temp_conn()
    try:
        run_id = await _insert(
            conn, metadata={"publish": json.dumps(_record())}, updated_ago=LEASE + 60
        )
        rows = await find_stranded_golden_runs(conn, LEASE)
        assert [r["has_publish"] for r in rows if r["run_id"] == run_id] == [False]
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_fresh_terminal_and_non_golden_runs_are_never_stranded():
    from app.db.workflows import find_stranded_golden_runs

    conn = await _temp_conn()
    try:
        await _insert(conn, publish=_record(), updated_ago=10)  # a live producer's beat
        await _insert(conn, publish=_record(), status="completed", updated_ago=LEASE + 60)
        await _insert(conn, publish=_record(), status="failed", updated_ago=LEASE + 60)
        await _insert(conn, publish=_record(), status="paused", updated_ago=LEASE + 60)
        await _insert(conn, golden=False, updated_ago=LEASE + 60)
        assert await find_stranded_golden_runs(conn, LEASE) == []
    finally:
        await conn.close()


# ── find_stranded_publish_tails ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_terminal_run_whose_record_still_reads_running_is_a_stranded_tail_however_fresh():
    from app.db.workflows import find_stranded_publish_tails

    conn = await _temp_conn()
    try:
        # updated_at FRESH: the reconciler just finalised it — no staleness requirement.
        ended = {
            s: await _insert(conn, publish=_record(), status=s, updated_ago=1)
            for s in ("completed", "failed", "cancelled")
        }
        rows = await find_stranded_publish_tails(conn, LEASE)
        assert _ids(rows) == set(ended.values())
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_a_stale_finishing_claim_is_a_stranded_tail_and_a_fresh_one_is_not():
    from app.db.workflows import find_stranded_publish_tails

    conn = await _temp_conn()
    try:
        stale = await _insert(conn, status="completed", publish=_record(
            "finishing", finishing_at="2020-01-01T00:00:00+00:00"))
        await _insert(conn, status="completed", publish=_record("finishing"))
        await conn.execute(
            "UPDATE workflow_runs SET metadata = jsonb_set(metadata, '{publish,finishing_at}',"
            " to_jsonb(now())) WHERE id <> $1",
            stale,
        )
        assert _ids(await find_stranded_publish_tails(conn, LEASE)) == {stale}
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_done_active_and_non_golden_rows_are_never_stranded_tails():
    from app.db.workflows import find_stranded_publish_tails

    conn = await _temp_conn()
    try:
        await _insert(conn, status="completed", publish=_record("done"))
        await _insert(conn, status="active", publish=_record(), updated_ago=LEASE + 60)
        await _insert(conn, status="active", publish=_record(
            "finishing", finishing_at="2020-01-01T00:00:00+00:00"))
        await _insert(conn, status="completed", golden=False, publish=_record())
        await _insert(conn, status="completed")  # no record at all
        await _insert(conn, status="completed", metadata={"publish": json.dumps(_record())})
        assert await find_stranded_publish_tails(conn, LEASE) == []
    finally:
        await conn.close()


# ── latest_publish_attempt ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_latest_attempt_is_the_callers_newest_record_for_that_draft():
    from app.db.workflows import latest_publish_attempt

    conn = await _temp_conn()
    try:
        definition_id, me, other = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        await _insert(conn, status="completed", publish=_record("done"),
                      definition_id=definition_id, user_id=me, created_ago=600)
        newest = await _insert(conn, publish=_record(), definition_id=definition_id, user_id=me,
                               created_ago=60, snapshot={"phases": []})
        # Newer still, but NOT mine, NOT a record, and NOT this draft — none may win.
        await _insert(conn, publish=_record(), definition_id=definition_id, user_id=other)
        await _insert(conn, definition_id=definition_id, user_id=me)
        await _insert(conn, publish=_record(), user_id=me)
        row = await latest_publish_attempt(conn, definition_id=definition_id, user_id=me)
        assert row["run_id"] == newest
        assert row["state"] == "running"
        assert row["verdict"] is None
        assert row["status"] == "active"
        assert row["definition_snapshot"] == {"phases": []}
        assert row["created_at"] is not None
        # The token and the golden input never leave the database layer.
        flat = json.dumps(row, default=str)
        assert "tok-SECRET-308" not in flat and "GOLDEN-INPUT-308" not in flat
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_another_users_attempt_is_never_the_latest():
    from app.db.workflows import latest_publish_attempt

    conn = await _temp_conn()
    try:
        definition_id = uuid.uuid4()
        await _insert(conn, publish=_record(), definition_id=definition_id, user_id=uuid.uuid4())
        assert await latest_publish_attempt(
            conn, definition_id=definition_id, user_id=uuid.uuid4()
        ) is None
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_a_done_attempt_carries_its_verdict():
    from app.db.workflows import latest_publish_attempt

    conn = await _temp_conn()
    try:
        definition_id, me = uuid.uuid4(), uuid.uuid4()
        verdict = {"published": True, "version": 3, "golden_run_id": "x"}
        await _insert(conn, status="completed", publish=_record("done", verdict=verdict),
                      definition_id=definition_id, user_id=me)
        row = await latest_publish_attempt(conn, definition_id=definition_id, user_id=me)
        assert row["state"] == "done" and row["verdict"] == verdict
    finally:
        await conn.close()


# ── 308.1 review CR-02: an unfinished record is in flight only while it is really alive ─────────


async def _set_finishing_at(conn, run_id, ago_seconds: float):
    await conn.execute(
        "UPDATE workflow_runs SET metadata = jsonb_set(metadata, '{publish,finishing_at}',"
        " to_jsonb(now() - make_interval(secs => $2::float8))) WHERE id = $1",
        run_id,
        float(ago_seconds),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("ended", ["completed", "failed", "cancelled"])
async def test_a_running_record_on_an_ended_run_is_not_in_flight(ended):
    """CR-02: a Stop, a DB blip before the tail claim, or a dead tail left ``running`` on an ENDED
    run. Counting it as in flight handed that dead run back to every POST for two hours."""
    from app.db.workflows import active_publish_attempt

    conn = await _temp_conn()
    try:
        definition_id, me = uuid.uuid4(), uuid.uuid4()
        await _insert(conn, status=ended, publish=_record("running"),
                      definition_id=definition_id, user_id=me, created_ago=60)
        assert await active_publish_attempt(
            conn, definition_id=definition_id, user_id=me,
            max_age_seconds=7200, lease_seconds=LEASE,
        ) is None
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_a_live_running_attempt_and_a_fresh_tail_claim_are_in_flight_a_stale_claim_is_not():
    from app.db.workflows import active_publish_attempt

    conn = await _temp_conn()
    try:
        me = uuid.uuid4()
        live_def, fresh_def, stale_def = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        live = await _insert(conn, status="active", publish=_record("running"),
                             definition_id=live_def, user_id=me, created_ago=60)
        fresh = await _insert(conn, status="completed", publish=_record("finishing"),
                              definition_id=fresh_def, user_id=me, created_ago=60)
        await _set_finishing_at(conn, fresh, 5)
        stale = await _insert(conn, status="completed", publish=_record("finishing"),
                              definition_id=stale_def, user_id=me, created_ago=900)
        await _set_finishing_at(conn, stale, LEASE + 60)

        async def _active(definition_id):
            return await active_publish_attempt(
                conn, definition_id=definition_id, user_id=me,
                max_age_seconds=7200, lease_seconds=LEASE,
            )

        assert (await _active(live_def))["run_id"] == live
        assert (await _active(fresh_def))["run_id"] == fresh
        assert await _active(stale_def) is None
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_the_latest_attempt_says_whether_its_tail_is_stranded():
    """CR-02 (c): the follow read is where a stranded tail is noticed while both workers are up,
    so the read reports it: ``running`` on an ended run, or a ``finishing`` claim past the lease."""
    from app.db.workflows import latest_publish_attempt

    conn = await _temp_conn()
    try:
        me = uuid.uuid4()
        cases = {}
        for name, status, state, finishing_ago in [
            ("running_on_ended", "cancelled", "running", None),
            ("running_on_live", "active", "running", None),
            ("finishing_stale", "completed", "finishing", LEASE + 60),
            ("finishing_fresh", "completed", "finishing", 5),
            ("done", "completed", "done", None),
        ]:
            definition_id = uuid.uuid4()
            run_id = await _insert(conn, status=status, publish=_record(state),
                                   definition_id=definition_id, user_id=me)
            if finishing_ago is not None:
                await _set_finishing_at(conn, run_id, finishing_ago)
            cases[name] = definition_id
        got = {
            name: (await latest_publish_attempt(
                conn, definition_id=d, user_id=me, lease_seconds=LEASE))["tail_stranded"]
            for name, d in cases.items()
        }
        assert got == {
            "running_on_ended": True,
            "running_on_live": False,
            "finishing_stale": True,
            "finishing_fresh": False,
            "done": False,
        }
    finally:
        await conn.close()


# ── find_publish_receipt ────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_receipt_finder_reads_the_newest_receipt_of_that_kind_for_that_run():
    from app.db.workflows import find_publish_receipt, write_audit

    conn = await _temp_conn()
    try:
        run_id, other = uuid.uuid4(), uuid.uuid4()
        user = uuid.uuid4()
        # Written through the REAL writer, so the double-encoding is the real one.
        await write_audit(conn, run_id, user_id=user, event_type="publish_succeeded",
                          metadata={"version": 1})
        await conn.execute("UPDATE harness_audit SET created_at = now() - interval '1 minute'")
        await write_audit(conn, run_id, user_id=user, event_type="publish_succeeded",
                          metadata={"version": 2})
        await write_audit(conn, run_id, user_id=user, event_type="run_failed",
                          metadata={"reason": "why"})
        await write_audit(conn, other, user_id=user, event_type="publish_succeeded",
                          metadata={"version": 9})
        assert await find_publish_receipt(conn, run_id, "publish_succeeded") == {"version": 2}
        assert await find_publish_receipt(conn, run_id, "run_failed") == {"reason": "why"}
        assert await find_publish_receipt(conn, run_id, "publish_blocked") is None
    finally:
        await conn.close()
