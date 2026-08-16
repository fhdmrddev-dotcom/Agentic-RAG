"""Phase 194.1 plan 02 (D-09 AMENDED) — the stopped-run receipt on the UNGATED thread frame.

WHAT THIS FILE DEFENDS
----------------------
``GET /threads/{id}/workflow`` gained three additive-optional fields —
``last_run_status`` / ``last_run_created_at`` / ``last_run_updated_at`` — keyed to the
ALREADY-RESOLVED ``phases_source_run_id`` (the anchor-then-latest id that also sources
``phases`` and ``last_workflow_run_id``). No new route, no ``CANVAS_GATED_PATHS`` edit, no
migration and NO extra database round trip.

WHY THE FIELDS EXIST. ``run_status`` is populated only inside
``if active_workflow_run_id is not None:``. ``finish_run`` NULLs that anchor in the same
transaction as the terminal status, so after a stop the frame reads ``run_status = None`` /
``mode = "deep"`` / ``locked = False`` while ``phases[]`` and ``last_workflow_run_id`` BOTH
survive. That gap is these three fields.

UNIT-ONLY BY CONSTRUCTION — no local Supabase, no DB mutation. CLAUDE.md's worktree rule 4
requires a DB-mutating suite to serialize; this plan is declared parallel-safe precisely
because it does not mutate. Every read is answered by the conftest mocked asyncpg pool.

⚠ HONEST SCOPE OF THE CROSS-USER CASE — READ THIS BEFORE STRENGTHENING IT
------------------------------------------------------------------------
194-11 recorded the finding (``api/runs.py:1220-1231``): *one clause tested in a world where
a sibling clause also holds has never been tested.* That warning applies here and the
limitation is stated rather than papered over.

In THIS mocked-pool shape the ownership clause is **not behaviourally isolatable**. The
conftest Supabase builder is a ``MagicMock`` whose ``.eq()`` returns itself and whose
``.execute()`` returns ``mock_execute_result.data`` regardless of any filter — so deleting
``.eq("user_id", …)`` from production source changes the mock's answer by exactly nothing.
A "foreign thread -> 404" case therefore reds under NO plant to the ownership clause; it is
satisfied by the route's shipped ownership gate alone, which runs FIRST on ``threads``.

So the coverage below is split, and each half is labelled for what it actually proves:
  * ``test_another_accounts_thread_answers_404_and_never_a_run_row`` proves the BEHAVIOUR
    (404, body parity, and — the part that is genuinely about this plan — that none of the
    three new fields leaks into the error body).
  * ``test_the_ownership_clause_is_applied_on_the_same_query_as_the_id`` proves the CLAUSE
    STRUCTURALLY, by asserting the ``user_id`` filter was actually invoked with the caller's
    id. That one IS falsifiable: deleting the clause from production source reds it.
The real access boundary is RLS plus the shipped gate; a mocked unit test cannot stand in
for either, and this docblock exists so nobody later reads these cases as if it could.
"""

from __future__ import annotations

import inspect
import re
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest


# The two timestamps every arm below is keyed to. Distinct values on purpose: a swap
# between created_at and updated_at must be visible, not merely type-correct.
_CREATED = datetime(2026, 8, 16, 12, 0, 0, tzinfo=timezone.utc)
_UPDATED = datetime(2026, 8, 16, 12, 2, 18, tzinfo=timezone.utc)


def _patched_pool(pool):
    """Both seams, per the Phase 163 note in test_thread_workflow_endpoint.py.

    Patching ``app.api.threads.get_pg_pool`` ALONE records nothing and every read silently
    returns ``None`` — several older tests in that file are red at HEAD for exactly that
    reason. Both are patched here so the reads actually reach the mock.
    """
    return (
        patch("app.api.threads.get_pg_pool", AsyncMock(return_value=pool)),
        patch("app.dependencies.get_pg_pool", AsyncMock(return_value=pool)),
    )


# ── ARM B — the stopped thread, which is the whole point of the plan ──────────────────

def test_stopped_thread_reports_the_cancelled_run_with_both_timestamps(
    client, mock_asyncpg_pool, mock_execute_result
):
    """A thread whose workflow was CANCELLED and whose anchor is NULL reports the stop.

    This is ARM B: ``finish_run`` cleared the anchor, so ``phases_source_run_id`` falls
    through to the thread's latest ``workflow_runs`` row.

    Falsifiable: delete ``last_run_status = latest_wf["status"]`` from ARM B (P1) or key the
    three fields off ``active_workflow_run_id`` instead of ``phases_source_run_id`` (P2) and
    this goes red — the anchor is NULL here, which is precisely the state it must serve.
    """
    thread_id = uuid.uuid4()
    last_run_id = uuid.uuid4()
    mock_execute_result.data = {"id": str(thread_id), "active_workflow_run_id": None}
    # fetchrow order with no anchor: (1) deep cap_paused probe; (2) latest workflow_runs row.
    mock_asyncpg_pool.set_fetchrow_results([
        None,
        {"id": last_run_id, "status": "cancelled",
         "created_at": _CREATED, "updated_at": _UPDATED},
    ])
    mock_asyncpg_pool.set_fetch_results([[]])

    p1, p2 = _patched_pool(mock_asyncpg_pool)
    with p1, p2:
        resp = client.get(f"/threads/{thread_id}/workflow")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    # The anchor is legitimately gone — this is the state the receipt could not serve.
    assert body["active_workflow_run_id"] is None
    assert body["mode"] == "deep"
    # …and the stop is now on the wire.
    assert body["last_run_status"] == "cancelled"
    assert body["last_run_created_at"] is not None
    assert body["last_run_updated_at"] is not None
    # The two timestamps are DISTINCT and in order — an elapsed reading, not one value twice.
    assert body["last_run_created_at"] != body["last_run_updated_at"]
    assert body["last_run_created_at"] < body["last_run_updated_at"]
    # Keyed to the SAME already-resolved id that sources last_workflow_run_id.
    assert body["last_workflow_run_id"] == str(last_run_id)


def test_run_status_stays_none_on_the_stopped_thread(
    client, mock_asyncpg_pool, mock_execute_result
):
    """The NEW field did not overwrite the OLD one — the swap the docblock warns about.

    ``run_status`` is the LIVE anchor's status and must stay ``None`` here; ``last_run_status``
    is the LAST run's. Both are plain ``str | None`` so a swap TYPECHECKS, which is exactly why
    this case exists rather than being left to review.

    Falsifiable: assign ``run_status = last_run_status`` in the response construction (P3) and
    this goes red while every other case in this file stays green.
    """
    thread_id = uuid.uuid4()
    mock_execute_result.data = {"id": str(thread_id), "active_workflow_run_id": None}
    mock_asyncpg_pool.set_fetchrow_results([
        None,
        {"id": uuid.uuid4(), "status": "cancelled",
         "created_at": _CREATED, "updated_at": _UPDATED},
    ])
    mock_asyncpg_pool.set_fetch_results([[]])

    p1, p2 = _patched_pool(mock_asyncpg_pool)
    with p1, p2:
        resp = client.get(f"/threads/{thread_id}/workflow")

    body = resp.json()
    assert body["last_run_status"] == "cancelled"
    # The live-anchor field is UNMOVED. These two must not be able to become one field.
    assert body["run_status"] is None
    assert body["locked"] is False
    assert body["mode"] == "deep"


# ── ARM A — the live anchor ───────────────────────────────────────────────────────────

def test_live_anchor_reports_that_runs_status_and_both_timestamps(
    client, mock_asyncpg_pool, mock_execute_result
):
    """With a LIVE anchor the three fields come from ARM A's widened joined SELECT.

    ARM A already read ``wr.status``; the plan added ``wr.created_at`` / ``wr.updated_at`` to
    the same query. Falsifiable: drop either assignment from the ``if wf_row is not None:``
    block and this reds.
    """
    thread_id = uuid.uuid4()
    run_id = uuid.uuid4()
    mock_execute_result.data = {"id": str(thread_id), "active_workflow_run_id": str(run_id)}
    mock_asyncpg_pool.set_fetchrow_results([
        {
            "status": "active",
            "created_at": _CREATED,
            "updated_at": _UPDATED,
            "continues_used": 0,
            "definition_slug": "wf",
            "definition_name": "WF",
            "current_phase_slug": "a",
            "current_phase_index": 0,
            "total_phases": 3,
        },
        {"run_id": uuid.uuid4(), "status": "streaming"},  # F2 producer probe — non-terminal
        None,                                             # deep cap_paused probe
    ])
    mock_asyncpg_pool.set_fetch_results([[]])

    p1, p2 = _patched_pool(mock_asyncpg_pool)
    with p1, p2:
        resp = client.get(f"/threads/{thread_id}/workflow")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["last_run_status"] == "active"
    assert body["last_run_created_at"] is not None
    assert body["last_run_updated_at"] is not None
    # On the live arm the two statuses AGREE — and that is not the same claim as them being
    # the same field, which the stopped-thread case above disproves.
    assert body["run_status"] == "active"
    # Keyed to the anchor while the anchor exists (never "always the latest row").
    assert body["last_workflow_run_id"] == str(run_id) == body["active_workflow_run_id"]


# ── The Deep thread — three Nones, the shape phases_list already has ──────────────────

def test_pure_deep_thread_reports_all_three_as_none(
    client, mock_asyncpg_pool, mock_execute_result
):
    """A thread that never held a workflow run yields three ``None``s, not an error.

    The locals are initialized beside the shipped ``run_status = None``, so the absent case has
    ONE spelling. Falsifiable: remove the initializers and this raises ``UnboundLocalError``.
    """
    thread_id = uuid.uuid4()
    mock_execute_result.data = {"id": str(thread_id), "active_workflow_run_id": None}
    # (1) deep cap_paused probe -> None; (2) latest workflow_runs row -> None (never ran one).
    mock_asyncpg_pool.set_fetchrow_results([None, None])
    mock_asyncpg_pool.set_fetch_results([[]])

    p1, p2 = _patched_pool(mock_asyncpg_pool)
    with p1, p2:
        resp = client.get(f"/threads/{thread_id}/workflow")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["mode"] == "deep"
    assert body["last_run_status"] is None
    assert body["last_run_created_at"] is None
    assert body["last_run_updated_at"] is None
    # The precedent field behaves identically — the three are its siblings, not a new shape.
    assert body["last_workflow_run_id"] is None


# ── Access control ────────────────────────────────────────────────────────────────────

def test_another_accounts_thread_answers_404_and_never_a_run_row(
    client, mock_asyncpg_pool, mock_execute_result
):
    """A thread id the caller does not own answers 404 — never a run row, never a 403.

    ⚠ SCOPE: this proves the BEHAVIOUR only. Per the module docblock, the mocked Supabase
    builder cannot distinguish a filtered query from an unfiltered one, so this case is
    satisfied by the shipped ownership gate alone and would NOT red under a plant to the
    ownership clause. The structural half is the next test.

    What it DOES prove about this plan: none of the three new fields appears in the error
    body. Body parity, not merely status parity — the 194-11 lesson.
    """
    thread_id = uuid.uuid4()
    mock_execute_result.data = None  # the ownership-scoped select found nothing

    p1, p2 = _patched_pool(mock_asyncpg_pool)
    with p1, p2:
        resp = client.get(f"/threads/{thread_id}/workflow")

    assert resp.status_code == 404
    assert resp.status_code != 403
    # BODY parity, not only the code.
    assert resp.json() == {"detail": "Thread not found"}
    # No run-shaped data of any kind crossed the boundary.
    raw = resp.text
    for leaked in ("last_run_status", "last_run_created_at", "last_run_updated_at",
                   "last_workflow_run_id", "cancelled"):
        assert leaked not in raw, f"{leaked!r} leaked into a 404 body"


def test_the_ownership_clause_is_applied_on_the_same_query_as_the_id(
    client, mock_execute_result, mock_builder
):
    """The ``user_id`` filter is applied on the SAME query as ``id`` — asserted structurally.

    This is the half of the cross-user story that IS falsifiable in a mocked-pool test:
    deleting ``.eq("user_id", current_user["id"])`` from the route reds this while the 404 case
    above stays green. That asymmetry is the whole point of splitting them.

    Same-query (never fetch-then-compare) is the shipped posture recorded at
    ``workflow_runs.py:192-206``: a two-step check would answer a foreign id along a different,
    separately-failing path than a nonexistent one, which is a probe channel.
    """
    from tests.conftest import mock_user_data

    thread_id = uuid.uuid4()
    mock_execute_result.data = None  # 404 — we are asserting the FILTER, not the payload

    with patch("app.api.threads.get_pg_pool", AsyncMock()), \
         patch("app.dependencies.get_pg_pool", AsyncMock()):
        client.get(f"/threads/{thread_id}/workflow")

    filters = {c.args[0]: c.args[1] for c in mock_builder.eq.call_args_list if len(c.args) == 2}
    assert "user_id" in filters, (
        "the ownership clause is absent — the route would answer for any account's thread"
    )
    assert filters["user_id"] == mock_user_data["id"]
    assert filters.get("id") == str(thread_id)


def test_the_route_body_never_answers_403(client):
    """404 — NEVER 403 — on every miss, so there is no existence oracle.

    Scoped to ``get_thread_workflow``'s own body rather than the whole module, because
    ``threads.py`` is a large router and a module-wide count would be a claim about code this
    plan does not touch.
    """
    import app.api.threads as threads_module

    src = inspect.getsource(threads_module.get_thread_workflow)
    assert "HTTP_403" not in src
    assert "403" not in src
    # …and the 404 it does raise is present, so the absence above is not vacuous.
    assert "HTTP_404_NOT_FOUND" in src


# ── The SELECTs themselves — the only place a widening is observable in a mocked test ──

def test_both_arms_select_the_three_columns_and_buy_no_extra_round_trip(
    client, mock_asyncpg_pool, mock_execute_result
):
    """The widened SELECTs actually NAME the three columns, and the query COUNT is unmoved.

    ⚠ WHY THIS CASE EXISTS. The mocked pool answers with a fixture dict regardless of the SQL
    text, so removing a column from a SELECT list is INVISIBLE to every other case in this
    file — the fixture still carries the key. This case reads the recorded SQL instead, which
    is what makes plant P1 ("delete ``status`` from ARM B's SELECT") able to fire at all.

    It also pins the no-extra-round-trip property that the whole D-09 amendment rests on: the
    three fields ride SELECTs the route already issued.
    """
    thread_id = uuid.uuid4()
    mock_execute_result.data = {"id": str(thread_id), "active_workflow_run_id": None}
    mock_asyncpg_pool.set_fetchrow_results([
        None,
        {"id": uuid.uuid4(), "status": "cancelled",
         "created_at": _CREATED, "updated_at": _UPDATED},
    ])
    mock_asyncpg_pool.set_fetch_results([[]])

    p1, p2 = _patched_pool(mock_asyncpg_pool)
    with p1, p2:
        resp = client.get(f"/threads/{thread_id}/workflow")
    assert resp.status_code == 200, resp.text

    workflow_run_selects = [
        sql for sql, _ in mock_asyncpg_pool.calls
        if "workflow_runs" in sql and "SELECT" in sql.upper()
    ]
    assert workflow_run_selects, "ARM B's SELECT was not recorded — the seam is not patched"
    armb = workflow_run_selects[-1]
    for col in ("status", "created_at", "updated_at"):
        assert re.search(rf"\b{col}\b", armb), f"ARM B's SELECT does not read {col!r}: {armb}"

    # ONE read of workflow_runs on this arm — the widening is a projection, not a second query.
    assert len(workflow_run_selects) == 1, (
        f"expected exactly one workflow_runs read on the no-anchor arm, saw "
        f"{len(workflow_run_selects)}: {workflow_run_selects}"
    )


def test_arm_a_selects_the_two_new_columns_on_the_query_it_already_issued(
    client, mock_asyncpg_pool, mock_execute_result
):
    """ARM A's joined SELECT reads ``created_at``/``updated_at`` beside the ``status`` it had.

    Falsifiable in the same way as the case above, and for the same reason: the fixture cannot
    tell you what the query asked for.
    """
    thread_id = uuid.uuid4()
    run_id = uuid.uuid4()
    mock_execute_result.data = {"id": str(thread_id), "active_workflow_run_id": str(run_id)}
    mock_asyncpg_pool.set_fetchrow_results([
        {
            "status": "active", "created_at": _CREATED, "updated_at": _UPDATED,
            "continues_used": 0, "definition_slug": "wf", "definition_name": "WF",
            "current_phase_slug": "a", "current_phase_index": 0, "total_phases": 3,
        },
        {"run_id": uuid.uuid4(), "status": "streaming"},
        None,
    ])
    mock_asyncpg_pool.set_fetch_results([[]])

    p1, p2 = _patched_pool(mock_asyncpg_pool)
    with p1, p2:
        resp = client.get(f"/threads/{thread_id}/workflow")
    assert resp.status_code == 200, resp.text

    joined = [sql for sql, _ in mock_asyncpg_pool.calls if "workflow_definitions" in sql]
    assert joined, "ARM A's joined SELECT was not recorded"
    for col in ("wr.status", "wr.created_at", "wr.updated_at"):
        assert col in joined[0], f"ARM A's SELECT does not read {col!r}"
