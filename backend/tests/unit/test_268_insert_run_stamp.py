"""Phase 268 (METER-08 / D-268-04 / D-268-05 / D-268-07 / D-268-19) — the stamp at the ONE insert.

Every ``runs`` row is born in ``app.db.runs.insert_run``. From 268 on it carries:

* ``expert_attributed = true`` — ALWAYS, in SQL, so no caller can forget it. ``false`` is the
  column default and means only "Not recorded (before 268)" (D-268-06, never backfilled).
* ``expert_id`` — the access-checked Expert the caller passes (a Deep chat run), or NULL
  (= "No Expert" once attributed) for harness / eval / golden / resume shells.
* ``org_id`` — the validated active org when the caller has one; NULL falls to the mig-106
  autofill trigger, so a single-org / no-header caller is byte-identical to base.
* a SUB-AGENT row (``parent_run_id`` set) copies its parent's ``org_id``, ``expert_id`` and
  ``expert_attributed`` IN SQL (``LEFT JOIN public.runs p``) — the call site passes nothing.

These are SQL-shape + bound-argument assertions against a mock pool. What they do NOT prove:
that Postgres evaluates the statement as intended. ``tests/integration/test_268_two_org_rows.py``
drives the same writer against the real database for that.

⚠ ``test_db_runs.py``'s three shape tests are in the inherited 71 reds (267-BASELINES.md) —
this file does not rely on or repair them.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.db.runs import insert_assistant_message, insert_run
from tests.integration._run_helpers import _build_mock_pg_pool


def _norm(sql: str) -> str:
    return " ".join(sql.split())


@pytest.mark.asyncio
async def test_root_run_binds_org_and_expert_and_writes_attributed_true_in_sql():
    pool = _build_mock_pg_pool()
    run_id, thread_id, user_id = uuid4(), uuid4(), uuid4()
    org_b, expert_e = uuid4(), uuid4()

    await insert_run(
        pool,
        run_id=run_id,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="gpt-4o",
        provider="openai",
        org_id=org_b,
        expert_id=expert_e,
    )

    assert pool.execute.await_count == 1, "ONE statement — the parent copy is not a second query"
    sql, *args = pool.execute.call_args[0]
    flat = _norm(sql)
    assert "INSERT INTO runs" in flat
    assert "expert_id" in flat and "expert_attributed" in flat and "org_id" in flat
    assert "LEFT JOIN public.runs p ON p.run_id = $8::uuid" in flat
    # expert_attributed is decided in SQL, never bound: a caller cannot pass false.
    assert "THEN true ELSE COALESCE(p.expert_attributed, true) END" in flat
    assert args[7] is None, "$8 = parent_run_id (None on a root run)"
    assert args[8] == org_b, "$9 = the validated active org"
    assert args[9] == expert_e, "$10 = the access-checked Expert"
    assert len(args) == 10


@pytest.mark.asyncio
async def test_sub_agent_reads_org_expert_and_attributed_from_the_parent_row_in_sql():
    pool = _build_mock_pg_pool()
    parent = uuid4()

    await insert_run(
        pool,
        run_id=uuid4(),
        thread_id=uuid4(),
        user_id=uuid4(),
        status="streaming",
        model="gpt-4o",
        provider="openai",
        parent_run_id=parent,
    )

    sql, *args = pool.execute.call_args[0]
    flat = _norm(sql)
    assert args[7] == parent, "$8 = parent_run_id"
    assert args[8] is None and args[9] is None, "the call site passes nothing extra"
    assert "COALESCE(p.org_id, $9::uuid)" in flat, "a sub-agent takes its PARENT's org"
    assert "CASE WHEN $8::uuid IS NULL THEN $10::uuid ELSE p.expert_id END" in flat
    assert "CASE WHEN $8::uuid IS NULL THEN true ELSE COALESCE(p.expert_attributed, true) END" in flat


@pytest.mark.asyncio
async def test_no_org_no_expert_binds_none_for_both_and_still_attributes():
    """Single-org / no-header / harness callers: NULL org falls to the trigger; (NULL, true) = No Expert."""
    pool = _build_mock_pg_pool()
    await insert_run(
        pool,
        run_id=uuid4(),
        thread_id=uuid4(),
        user_id=uuid4(),
        status="streaming",
        model="unknown",
        provider="harness",
    )
    sql, *args = pool.execute.call_args[0]
    assert args[8] is None and args[9] is None
    assert "expert_attributed" in _norm(sql)


@pytest.mark.asyncio
async def test_insert_run_uses_placeholders_only():
    """T-073-02 / T-268-01: no value is interpolated; $1..$10 all appear."""
    pool = _build_mock_pg_pool()
    marker_org = uuid4()
    await insert_run(
        pool,
        run_id=uuid4(),
        thread_id=uuid4(),
        user_id=uuid4(),
        status="streaming",
        model="gpt-4o",
        provider="openai",
        org_id=marker_org,
    )
    sql, *_ = pool.execute.call_args[0]
    for n in range(1, 11):
        assert f"${n}" in sql, f"missing placeholder ${n}"
    assert str(marker_org) not in sql, "a bound value leaked into the SQL text"


@pytest.mark.asyncio
async def test_insert_assistant_message_binds_the_org_when_given():
    pool = _build_mock_pg_pool()
    org_b = uuid4()
    await insert_assistant_message(
        pool, thread_id=uuid4(), user_id=uuid4(), content="hi", org_id=org_b,
    )
    sql, *args = pool.fetchval.call_args[0]
    flat = _norm(sql)
    assert "org_id" in flat
    assert "$11" in flat
    assert args[-1] == org_b
    assert str(org_b) not in sql


@pytest.mark.asyncio
async def test_insert_assistant_message_binds_none_when_org_omitted():
    """None still gets the trigger's value: it short-circuits only on NEW.org_id IS NOT NULL."""
    pool = _build_mock_pg_pool()
    await insert_assistant_message(pool, thread_id=uuid4(), user_id=uuid4(), content="hi")
    _sql, *args = pool.fetchval.call_args[0]
    assert args[-1] is None
    assert len(args) == 11


@pytest.mark.asyncio
async def test_register_run_start_forwards_org_and_expert_unchanged(monkeypatch):
    from app.services import run_lifecycle

    seen: dict = {}

    async def _fake_insert_run(pool, **kwargs):
        seen.update(kwargs)

    monkeypatch.setattr(run_lifecycle, "insert_run", _fake_insert_run)

    class _Redis:
        async def zadd(self, *a, **k):
            return 1

    org_b, expert_e = uuid4(), uuid4()
    await run_lifecycle.register_run_start(
        pool=object(),
        redis=_Redis(),
        run_id=uuid4(),
        thread_id=uuid4(),
        user_id=uuid4(),
        model="gpt-4o",
        provider="openai",
        org_id=org_b,
        expert_id=expert_e,
    )
    assert seen["org_id"] == org_b
    assert seen["expert_id"] == expert_e
    assert seen["status"] == "streaming" and seen["parent_run_id"] is None
