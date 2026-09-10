"""Phase 234 (LIB-08 / QUEUE-03) — Unit tests for app.db.watches.

Tests:
1. create_watch, get_watch, list_watches, update_watch, delete_watch CRUD & scoping.
2. claim_due_watches atomic transaction with FOR UPDATE SKIP LOCKED and leased_until guard.
3. release_watch and record_skipped_still_running lease lifecycle.
4. connector_watch_items upsert, retrieval, and lifecycle state updates.
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from app.db.watches import (
    bulk_update_item_states,
    claim_due_watches,
    create_watch,
    delete_watch,
    get_watch,
    get_watch_item_by_external_id,
    get_watch_items,
    last_success_by_watch,
    list_sync_runs,
    list_watches,
    recent_runs_by_watch,
    record_skipped_still_running,
    release_watch,
    update_item_state,
    update_watch,
    upsert_watch_item,
)


@pytest.mark.asyncio
async def test_create_watch_mock():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    user_id = uuid4()
    org_id = uuid4()
    conn_id = uuid4()
    watch_id = uuid4()
    expected_row = {
        "id": watch_id,
        "user_id": user_id,
        "org_id": org_id,
        "connection_id": conn_id,
        "source_folder_id": "folder-123",
        "source_folder_name": "Invoices",
        "source_drive_id": None,
        "library_folder_id": None,
        "interval_minutes": 30,
        "next_run_at": datetime.now(timezone.utc),
        "leased_until": None,
        "is_active": True,
        "last_run_at": None,
        "last_status": None,
        "last_error": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    con.fetchrow.return_value = expected_row

    res = await create_watch(
        pool,
        user_id=user_id,
        connection_id=conn_id,
        source_folder_id="folder-123",
        source_folder_name="Invoices",
        org_id=org_id,
        interval_minutes=30,
    )

    assert res["id"] == watch_id
    assert res["source_folder_name"] == "Invoices"
    assert con.fetchrow.called
    call_args = con.fetchrow.call_args[0]
    assert "INSERT INTO connector_watches" in call_args[0]
    # Check that interval floor is enforced: min 5m
    assert call_args[8] == 30


@pytest.mark.asyncio
async def test_get_and_list_watches_scoped():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    watch_id = uuid4()
    user_id = uuid4()
    org_id = uuid4()

    con.fetchrow.return_value = {"id": watch_id, "user_id": user_id, "org_id": org_id}
    res = await get_watch(pool, watch_id, user_id=user_id, org_id=org_id)
    assert res is not None
    assert res["id"] == watch_id
    sql = con.fetchrow.call_args[0][0]
    assert "user_id = $2" in sql
    assert "org_id = $3" in sql

    con.fetch.return_value = [{"id": watch_id, "user_id": user_id, "org_id": org_id}]
    watches = await list_watches(pool, user_id=user_id, org_id=org_id)
    assert len(watches) == 1
    sql_list = con.fetch.call_args[0][0]
    assert "user_id = $1" in sql_list
    assert "org_id = $2" in sql_list


@pytest.mark.asyncio
async def test_update_and_delete_watch():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    watch_id = uuid4()
    user_id = uuid4()

    con.fetchrow.return_value = {"id": watch_id, "interval_minutes": 60, "is_active": False}
    updated = await update_watch(pool, watch_id, user_id=user_id, interval_minutes=60, is_active=False)
    assert updated["interval_minutes"] == 60
    assert updated["is_active"] is False

    con.execute.return_value = "DELETE 1"
    ok = await delete_watch(pool, watch_id, user_id=user_id)
    assert ok is True

    con.execute.return_value = "DELETE 0"
    ok_miss = await delete_watch(pool, watch_id, user_id=user_id)
    assert ok_miss is False


@pytest.mark.asyncio
async def test_claim_due_watches_atomic_transaction():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con
    tx = MagicMock()
    tx.__aenter__ = AsyncMock(return_value=tx)
    tx.__aexit__ = AsyncMock(return_value=None)
    con.transaction = MagicMock(return_value=tx)

    watch_id = uuid4()
    due_rows = [
        {
            "id": watch_id,
            "org_id": uuid4(),
            "user_id": uuid4(),
            "connection_id": uuid4(),
            "source_folder_id": "folder-1",
            "source_folder_name": "DriveFolder",
            "source_drive_id": None,
            "library_folder_id": None,
            "interval_minutes": 30,
            "next_run_at": datetime.now(timezone.utc),
            "leased_until": None,
        }
    ]
    con.fetch.return_value = due_rows

    claimed = await claim_due_watches(pool, limit=5, lease_seconds=300)

    assert len(claimed) == 1
    assert claimed[0]["id"] == watch_id
    # Assert query executed inside transaction with FOR UPDATE SKIP LOCKED
    fetch_sql = con.fetch.call_args[0][0]
    assert "FOR UPDATE SKIP LOCKED" in fetch_sql
    assert "WHERE is_active = true" in fetch_sql

    # Assert update executed inside transaction setting leased_until and advancing next_run_at
    update_sql = con.execute.call_args[0][0]
    assert "leased_until = now() +" in update_sql
    assert "next_run_at = now() +" in update_sql
    assert "last_status = 'running'" in update_sql


@pytest.mark.asyncio
async def test_release_and_skip_still_running():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    watch_id = uuid4()

    await release_watch(pool, watch_id, status="success")
    assert con.execute.called
    # ⚠ Phase 235: release_watch now issues TWO statements — the lease UPDATE and the
    # connector_sync_runs row beside it. `call_args` is the LAST call, so the UPDATE is
    # pinned by POSITION here; asserting on `call_args` would silently start asserting
    # against the run-row insert instead.
    update_sql = con.execute.call_args_list[0][0][0]
    assert "leased_until = NULL" in update_sql
    assert "last_status = $2" in update_sql

    con.execute.reset_mock()
    await record_skipped_still_running(pool, watch_id)
    assert con.execute.called
    assert "last_status = 'skipped_still_running'" in con.execute.call_args[0][0]


@pytest.mark.asyncio
async def test_watch_items_upsert_and_lifecycle():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    watch_id = uuid4()
    item_id = uuid4()
    user_id = uuid4()
    doc_id = uuid4()

    con.fetchrow.return_value = {
        "id": item_id,
        "watch_id": watch_id,
        "external_id": "file-abc",
        "name": "Report.pdf",
        "state": "present",
        "document_id": doc_id,
    }

    item = await upsert_watch_item(
        pool,
        watch_id=watch_id,
        external_id="file-abc",
        name="Report.pdf",
        user_id=user_id,
        document_id=doc_id,
        state="present",
    )
    assert item["external_id"] == "file-abc"
    upsert_sql = con.fetchrow.call_args[0][0]
    assert "ON CONFLICT (watch_id, external_id) DO UPDATE" in upsert_sql

    con.fetch.return_value = [item]
    items = await get_watch_items(pool, watch_id)
    assert len(items) == 1

    con.fetchrow.return_value = item
    single = await get_watch_item_by_external_id(pool, watch_id, "file-abc")
    assert single["name"] == "Report.pdf"

    await update_item_state(pool, item_id, state="missing")
    assert "SET state = $2" in con.execute.call_args[0][0]

    await bulk_update_item_states(pool, [item_id], state="missing")
    assert "WHERE id = ANY($1::uuid[])" in con.execute.call_args[0][0]


# ── Phase 235 (SURF-02 / D-235-06 / D-235-07 / D-235-08) — connector_sync_runs ──
#
# The counts dict `watch_service.py:203` computes was logged and then discarded by
# `tick():111`. These cases pin the home it now has: every release of a watch writes
# exactly ONE bounded run row, and the two reads that serve it carry an owner predicate
# in the SQL itself, because the asyncpg pool path is NOT RLS-gated.
#
# ⚠ THESE ARE SHAPE ASSERTIONS, AND THAT IS STATED RATHER THAN IMPLIED. The pool is a
# MagicMock, so nothing here proves the prune actually deletes a row in Postgres — it
# proves the statement carries the prune and binds `retain` as a PARAMETER rather than
# interpolating it. The live behaviour is exercised by the operator's applied migration
# and by the phase's G-4 rows.


def _pool_and_con():
    """The file's own double: a MagicMock pool whose acquire() yields an AsyncMock con."""
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con
    return pool, con


def _insert_call(con):
    """The run-row statement is the SECOND execute — the first is the lease UPDATE."""
    return con.execute.call_args_list[1][0]


@pytest.mark.asyncio
async def test_release_watch_success_writes_all_six_counts():
    pool, con = _pool_and_con()
    watch_id = uuid4()

    await release_watch(
        pool,
        watch_id,
        status="success",
        counts={"new": 3, "modified": 2, "renamed": 1, "missing": 4, "restored": 5, "errors": 6},
        listing_complete=True,
    )

    # The UPDATE it always did, unchanged and FIRST.
    update_sql = con.execute.call_args_list[0][0][0]
    assert "UPDATE connector_watches" in update_sql
    assert "leased_until = NULL" in update_sql

    # ...and one run row beside it.
    assert con.execute.call_count == 2
    args = _insert_call(con)
    assert "INSERT INTO connector_sync_runs" in args[0]
    assert args[1] == watch_id            # $1 watch_id
    assert args[5] == "success"           # $5 status
    assert args[8] is True                # $8 listing_complete
    assert list(args[9:15]) == [3, 2, 1, 4, 5, 6]  # $9..$14, table order


@pytest.mark.asyncio
async def test_release_watch_failure_still_writes_a_row():
    """A crash-shaped failure is history too — counts 0, listing incomplete, cause carried."""
    pool, con = _pool_and_con()
    watch_id = uuid4()

    await release_watch(
        pool,
        watch_id,
        status="failed",
        error="Source access unauthorized: 403",
        counts=None,
        failure_cause="token_revoked",
    )

    assert con.execute.call_count == 2
    args = _insert_call(con)
    assert args[5] == "failed"
    assert args[6] == "token_revoked"
    assert args[7] == "Source access unauthorized: 403"
    assert args[8] is False               # listing_complete defaults false
    assert list(args[9:15]) == [0, 0, 0, 0, 0, 0]


@pytest.mark.asyncio
async def test_release_watch_prunes_in_the_same_statement():
    pool, con = _pool_and_con()

    await release_watch(pool, uuid4(), status="success", retain=3)

    sql = _insert_call(con)[0]
    # ONE statement: the insert is a CTE and the delete hangs off it.
    assert "WITH ins AS (" in sql
    assert "DELETE FROM connector_sync_runs" in sql
    assert "ORDER BY started_at DESC" in sql
    # ⛔ The bound MUST be a parameter. An f-string here would be T-235-04.
    assert "LIMIT 3" not in sql
    # `args[0]` is the SQL, so `$n` is `args[n]`: retain is `$15`.
    assert _insert_call(con)[15] == 3


@pytest.mark.asyncio
async def test_release_watch_retain_defaults_to_the_settings_knob():
    from app.config import settings

    assert settings.watch_run_history_retention == 200

    pool, con = _pool_and_con()
    await release_watch(pool, uuid4(), status="success")
    assert _insert_call(con)[15] == settings.watch_run_history_retention


@pytest.mark.asyncio
async def test_release_watch_swallows_a_failed_history_insert():
    """⭐ Losing a history row must NEVER turn a successful sync into a failed one."""
    pool, con = _pool_and_con()
    con.execute.side_effect = [None, RuntimeError("connector_sync_runs is not there")]

    # No raise. The UPDATE that preceded it stands.
    await release_watch(pool, uuid4(), status="success", counts={"new": 1})

    assert con.execute.call_count == 2


@pytest.mark.asyncio
async def test_list_sync_runs_is_owner_predicated():
    pool, con = _pool_and_con()
    watch_id = uuid4()
    user_id = uuid4()
    con.fetch.return_value = [{"id": uuid4(), "watch_id": watch_id, "status": "success"}]

    rows = await list_sync_runs(pool, watch_id, user_id=user_id, limit=50)

    assert len(rows) == 1
    sql = con.fetch.call_args[0][0]
    assert "FROM connector_sync_runs" in sql
    assert "watch_id = $1" in sql
    # T-235-01: the pool path is NOT RLS-gated, so a watch_id guess must return nothing.
    assert "user_id = $2" in sql
    assert "ORDER BY started_at DESC" in sql
    assert con.fetch.call_args[0][1] == watch_id
    assert con.fetch.call_args[0][2] == user_id


@pytest.mark.asyncio
async def test_recent_runs_by_watch_is_one_windowed_query():
    pool, con = _pool_and_con()
    w1, w2 = uuid4(), uuid4()
    user_id = uuid4()
    con.fetch.return_value = [
        {"id": uuid4(), "watch_id": w1, "status": "failed", "started_at": datetime.now(timezone.utc)},
        {"id": uuid4(), "watch_id": w1, "status": "success", "started_at": datetime.now(timezone.utc)},
        {"id": uuid4(), "watch_id": w2, "status": "success", "started_at": datetime.now(timezone.utc)},
    ]

    grouped = await recent_runs_by_watch(pool, [w1, w2], user_id=user_id, per_watch=5)

    # ONE query, not one per watch — the verdict reads N watches at once.
    assert con.fetch.call_count == 1
    sql = con.fetch.call_args[0][0]
    assert "ROW_NUMBER() OVER (PARTITION BY watch_id ORDER BY started_at DESC)" in sql
    assert "watch_id = ANY(" in sql
    assert "user_id = $2" in sql

    assert set(grouped) == {str(w1), str(w2)}
    assert len(grouped[str(w1)]) == 2
    assert grouped[str(w1)][0]["status"] == "failed"


@pytest.mark.asyncio
async def test_recent_runs_by_watch_empty_input_issues_no_query():
    pool, con = _pool_and_con()
    assert await recent_runs_by_watch(pool, [], user_id=uuid4()) == {}
    assert con.fetch.call_count == 0


# ══ Phase 235 plan 14 (gap G2) — the UNBOUNDED last-success lookup ════════════
#
# ⭐ WHY A SECOND READ AT ALL, beside `recent_runs_by_watch` which already returns rows.
# That one is WINDOWED — five rows per watch — because it feeds a verdict that only needs the
# leading failure streak, and it is polled from every page by every signed-in user. A source
# that has failed more ticks than the window is deep therefore has NO success inside it, and
# the verdict reports `last_good_at = None`. Every surface then renders nothing, while SC#2's
# sentence is "says when it last succeeded". These cases pin the unbounded answer, and they
# pin the two properties that make it safe to add: the owner predicate is in the SQL, and
# there is no query at all when there is nothing to ask about.


@pytest.mark.asyncio
async def test_last_success_by_watch_is_one_unbounded_aggregate():
    pool, con = _pool_and_con()
    w1, w2 = uuid4(), uuid4()
    user_id = uuid4()
    older = datetime(2026, 1, 1, tzinfo=timezone.utc)
    newer = datetime(2026, 6, 1, tzinfo=timezone.utc)
    con.fetch.return_value = [
        {"watch_id": w1, "last_success_at": older},
        {"watch_id": w2, "last_success_at": newer},
    ]

    found = await last_success_by_watch(pool, [w1, w2], user_id=user_id)

    # ONE query for the whole set, exactly like its windowed sibling.
    assert con.fetch.call_count == 1
    sql = con.fetch.call_args[0][0]
    assert "MAX(started_at)" in sql
    assert "GROUP BY watch_id" in sql
    assert "watch_id = ANY(" in sql
    # ⛔ T-235c-04 — the asyncpg pool path is NOT RLS-gated, so the owner predicate lives in
    # the SQL itself, in this read exactly as in the two shipped ones.
    assert "user_id = $2" in sql
    # ⭐ THE property this function exists for: no window, no LIMIT, no ROW_NUMBER.
    assert "ROW_NUMBER" not in sql
    assert "LIMIT" not in sql

    # Non-vacuity: the status literal in the SQL is the one the verdict calls a success. If
    # `health_verdict.SUCCESS_STATUS` ever moved, this aggregate would silently answer about a
    # status nothing writes, and every assertion above would still pass.
    from app.services.sources.health_verdict import SUCCESS_STATUS

    assert SUCCESS_STATUS == "success"
    assert f"status = '{SUCCESS_STATUS}'" in sql

    assert found == {str(w1): older, str(w2): newer}


@pytest.mark.asyncio
async def test_last_success_by_watch_omits_a_watch_that_never_succeeded():
    """⛔ ABSENCE, never a `None` sitting in a value slot.

    A caller must not be able to confuse "has never succeeded" with "was not asked about" —
    and the api layer's fill is `verdict_value or looked_up.get(id)`, which a present-with-None
    would turn into a silent no-op that reads exactly like a fix.
    """
    pool, con = _pool_and_con()
    has_one, never = uuid4(), uuid4()
    when = datetime(2026, 2, 3, tzinfo=timezone.utc)
    # The GROUP BY over a status-filtered set returns no row at all for `never`; the second
    # entry is the defensive arm — a NULL aggregate is dropped, never stored as None.
    con.fetch.return_value = [
        {"watch_id": has_one, "last_success_at": when},
        {"watch_id": uuid4(), "last_success_at": None},
    ]

    found = await last_success_by_watch(pool, [has_one, never], user_id=uuid4())

    assert found == {str(has_one): when}
    assert str(never) not in found
    assert None not in found.values()


@pytest.mark.asyncio
async def test_last_success_by_watch_empty_input_issues_no_query():
    """A healthy instance has zero stopped sources, so this must cost zero round trips."""
    pool, con = _pool_and_con()
    assert await last_success_by_watch(pool, [], user_id=uuid4()) == {}
    assert con.fetch.call_count == 0
    assert pool.acquire.call_count == 0


@pytest.mark.asyncio
async def test_last_success_by_watch_coerces_str_ids():
    """The caller holds ids read back out of a row; a `str` must not raise at the driver."""
    pool, con = _pool_and_con()
    w1 = uuid4()
    user_id = uuid4()
    con.fetch.return_value = []

    await last_success_by_watch(pool, [str(w1)], user_id=str(user_id))

    bound_ids, bound_user = con.fetch.call_args[0][1], con.fetch.call_args[0][2]
    assert bound_ids == [w1]
    assert all(isinstance(i, UUID) for i in bound_ids)
    assert bound_user == user_id
