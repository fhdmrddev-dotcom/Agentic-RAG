"""Phase 292.1 G-4 finding: a FIRST-turn cap pause never showed the Continue card.

Driven in Chrome on 2026-10-24 (G4-1, gemini-3.8-flash, run 1e5b86bc): the run paused, the
carrier held the queued call (``run_is_cap_paused`` = True), and the chat showed no limit line
and no Continue, live or after a reload. ``GET /threads/{id}/workflow`` reported
``cap_paused`` only when ``runs.status == 'cap_paused'``. A first-turn pause finalizes as
``completed`` by design (run_producer LOCK-2), so the reconcile answered ``cap_paused: false``
and cleared the card. Same root cause as 292.1-REVIEW CR-01/CR-02, in a third reader.
The answer must come from the ONE carrier-aware predicate, ``run_is_cap_paused``.
"""

from unittest.mock import AsyncMock, patch

from tests.unit.test_244_cap_paused_lock_bound import _T0, _T1, _get_workflow, _run


def test_a_first_turn_pause_finalized_completed_is_reported(client, mock_execute_result):
    paused = _run("completed", _T1, continues_used=0)
    with patch("app.api.threads.run_is_cap_paused", AsyncMock(return_value=True)) as probe:
        resp, _conn, _tid = _get_workflow(client, mock_execute_result, [paused])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["cap_paused"] is True
    assert body["continues_used"] == 0
    assert probe.await_args.args[1] == paused["run_id"]


def test_a_plain_completed_run_is_not_reported_as_paused(client, mock_execute_result):
    with patch("app.api.threads.run_is_cap_paused", AsyncMock(return_value=False)):
        resp, _conn, _tid = _get_workflow(client, mock_execute_result, [_run("completed", _T1)])
    assert resp.status_code == 200, resp.text
    assert resp.json()["cap_paused"] is False


def test_the_probe_is_never_asked_about_a_live_or_failed_run(client, mock_execute_result):
    for status in ("streaming", "failed", "cancelled", "timed_out"):
        with patch("app.api.threads.run_is_cap_paused", AsyncMock(return_value=True)) as probe:
            resp, _conn, _tid = _get_workflow(client, mock_execute_result, [_run(status, _T1)])
        assert resp.json()["cap_paused"] is False, status
        probe.assert_not_awaited()


def test_an_older_first_turn_pause_under_a_newer_run_is_not_reported(client, mock_execute_result):
    rows = [_run("completed", _T0), _run("streaming", _T1)]
    with patch("app.api.threads.run_is_cap_paused", AsyncMock(return_value=True)):
        resp, _conn, _tid = _get_workflow(client, mock_execute_result, rows)
    assert resp.json()["cap_paused"] is False
