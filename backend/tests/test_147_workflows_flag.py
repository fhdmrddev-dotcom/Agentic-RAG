"""Phase 147 (FLAG-01 / D-05) — the workflows kill-switch blocks NEW launches only.

D-05 shape rule: switches stop NEW work; the Kill button is the tool for in-flight work.
So the ``workflows_enabled()`` guard sits at the send_message workflow-KICKOFF seam
(inside the ``body.workflow_definition_id is not None`` branch) and fires BEFORE any
user-message insert or ``create_workflow_run`` — a refused launch leaves NO partial run
row and NO blank message. A plain Deep send (no ``workflow_definition_id``) never enters
that branch, so Deep chat is byte-identical to today regardless of the flag.

These tests target the guard SURGICALLY: each fails early (403 refusal / 404 not-found /
500 empty-insert) BEFORE the run/redis machinery, so no live Redis/Postgres is needed.
"""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

USER_ID = "00000000-0000-0000-0000-000000000001"
THREAD_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()


def _thread_row(thread_id=None):
    # No active_workflow_run_id key → _existing_anchor is None (no in-flight lock).
    return {"id": thread_id or THREAD_ID, "user_id": USER_ID, "title": "New Chat"}


def _message_row(role="user", content="Hello"):
    return {
        "id": str(uuid4()),
        "thread_id": THREAD_ID,
        "user_id": USER_ID,
        "role": role,
        "content": content,
        "created_at": NOW,
    }


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


def test_new_kickoff_refused_when_workflows_off(client, auth_headers, mock_builder):
    """A NEW workflow launch with the flag OFF → a plain 403 refusal BEFORE any insert:
    only the thread-ownership SELECT ran (no user-message insert, no run row)."""
    mock_builder.execute.side_effect = [_make_result(_thread_row())]  # thread ownership only
    with patch("app.api.threads.workflows_enabled", return_value=False):
        resp = client.post(
            f"/threads/{THREAD_ID}/messages",
            headers=auth_headers,
            json={"content": "run it", "workflow_definition_id": str(uuid4())},
        )
    assert resp.status_code == 403
    assert "disabled by the administrator" in resp.json()["detail"]
    # Fail-closed BEFORE the user-message insert / run-row creation: exactly one DB call.
    assert mock_builder.execute.call_count == 1


def test_new_kickoff_proceeds_when_workflows_on(client, auth_headers, mock_builder):
    """With the flag ON the guard is a no-op → the kickoff proceeds PAST it into definition
    resolution (here a 404 not-found, NOT the 403 refusal) — proving the guard didn't fire."""
    mock_builder.execute.side_effect = [
        _make_result(_thread_row()),   # thread ownership
        _make_result(None),            # workflow_definitions resolve → not found
    ]
    with patch("app.api.threads.workflows_enabled", return_value=True):
        resp = client.post(
            f"/threads/{THREAD_ID}/messages",
            headers=auth_headers,
            json={"content": "run it", "workflow_definition_id": str(uuid4())},
        )
    assert resp.status_code == 404, "flag ON must not 403 — the guard is a no-op"
    assert resp.json()["detail"] == "Workflow not found"


def test_plain_deep_message_unaffected_by_flag(client, auth_headers, mock_builder):
    """A plain Deep send (no workflow_definition_id) never enters the kickoff branch, so the
    workflows kill-switch is NEVER consulted even when OFF (byte-identical Deep). The send
    fails at the empty user-message insert (500) — BEFORE any run/redis work — which is
    sufficient to prove it passed the kickoff region without a 403."""
    wf_gate = MagicMock(return_value=False)  # workflows OFF
    mock_builder.execute.side_effect = [
        _make_result(_thread_row()),   # thread ownership (Deep: no anchor)
        _make_result([]),              # user-message insert returns empty → 500 (pre-run/redis)
    ]
    with patch("app.api.threads.workflows_enabled", wf_gate):
        resp = client.post(
            f"/threads/{THREAD_ID}/messages",
            headers=auth_headers,
            json={"content": "Hello"},   # NO workflow_definition_id → Deep
        )
    assert resp.status_code != 403, "a Deep send must never hit the workflow-disabled refusal"
    wf_gate.assert_not_called()  # the kill-switch is never touched on the Deep path
