"""Phase 267 (D-267-09 / D-267-10 / PACK-23) — transcript-only system rows have ONE home and
never reach a model.

``TRANSCRIPT_EVENT_KINDS`` lives in ``app.models.message``. ``_reconstruct_history`` skips a
``role='system'`` row whose ``tool_calls[0].kind`` is in it; every OTHER system kind is emitted
exactly as at base (the allowlist does not widen the skip), and a ``handoff`` USER row reaches the
model as plain user content.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.models.message import MessageResponse, TRANSCRIPT_EVENT_KINDS
from app.services.agent_loop import _reconstruct_history


def test_the_allowlist_is_exactly_the_two_transcript_kinds():
    assert TRANSCRIPT_EVENT_KINDS == frozenset({"expert_changed", "expert_handoff"})
    assert isinstance(TRANSCRIPT_EVENT_KINDS, frozenset)


def test_handoff_is_deliberately_not_a_transcript_kind():
    """The handoff row is a USER row the model must see (D-267-15)."""
    assert "handoff" not in TRANSCRIPT_EVENT_KINDS


def _sys(kind: str, content: str = "event") -> dict:
    return {"role": "system", "content": content, "tool_calls": [{"kind": kind}]}


def test_transcript_event_rows_never_reach_the_model():
    rows = [
        {"role": "user", "content": "What was Q3 revenue?", "tool_calls": None},
        _sys("expert_changed", "Now: HR Advisor"),
        {"role": "assistant", "content": "It was $124.5M.", "tool_calls": None},
        _sys("expert_handoff", "Asked Contract Reviewer in a new chat"),
    ]
    out = _reconstruct_history(rows)
    assert out == [
        {"role": "user", "content": "What was Q3 revenue?"},
        {"role": "assistant", "content": "It was $124.5M."},
    ]


def test_every_other_system_kind_is_emitted_exactly_as_at_base():
    """The allowlist does NOT widen the skip: context_truncated still reaches history."""
    rows = [_sys("context_truncated", "Earlier messages were trimmed.")]
    assert _reconstruct_history(rows) == [
        {"role": "system", "content": "Earlier messages were trimmed."}
    ]


def test_a_system_row_without_a_kind_is_unchanged():
    rows = [{"role": "system", "content": "legacy", "tool_calls": None}]
    assert _reconstruct_history(rows) == [{"role": "system", "content": "legacy"}]


def test_a_handoff_user_row_reaches_history_as_plain_user_content():
    content = "Handoff from 'Q3 review':\n- revenue was $124.5M"
    rows = [
        {
            "role": "user",
            "content": content,
            "tool_calls": [{"kind": "handoff", "source_thread_id": str(uuid4()), "summary": ["x"]}],
        }
    ]
    assert _reconstruct_history(rows) == [{"role": "user", "content": content}]


def test_a_user_row_carrying_a_transcript_kind_is_NOT_skipped():
    """The skip is keyed on role='system' too — a user row is always the model's."""
    rows = [{"role": "user", "content": "hi", "tool_calls": [{"kind": "expert_changed"}]}]
    assert _reconstruct_history(rows) == [{"role": "user", "content": "hi"}]


def test_message_response_accepts_the_system_role():
    """BUG-260528-01 class: a narrow Literal would 500 the snapshot on an allowlisted row."""
    now = datetime.now(timezone.utc)
    m = MessageResponse(
        id=uuid4(),
        thread_id=uuid4(),
        user_id=uuid4(),
        role="system",
        content="Now: HR Advisor",
        created_at=now,
        updated_at=now,
        tool_calls=[{"kind": "expert_changed"}],
    )
    assert m.role == "system"
