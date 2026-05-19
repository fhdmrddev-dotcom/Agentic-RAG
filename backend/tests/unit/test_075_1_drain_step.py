"""Phase 075.1 Plan 02 Task 2 — deterministic unit tests for drain_step.

Pure-function test suite for the line-buffer accumulator helper extracted
from the sandbox drain loop in ``backend/app/api/threads.py`` (Phase 075
D-075-06 + D-075-07 + D-075-08). Pre-extraction, the accumulator logic
lived inline in the ``while True`` drain consumer at lines ~2426-2477 and
could only be exercised through a Docker-required integration test. After
extraction, ``drain_step(item, state) -> (emit_calls, new_state)`` is a
pure function (no async, no Docker) covered by these tests.

Contract under test:
- ``stdout_chunk`` and ``stderr_chunk`` items both flow through the same
  line-buffer (split on ``\\n``, normalize ``\\r\\n`` → ``\\n``, retain
  trailing partial line in state).
- Each emit-call tuple is ``(event_type, content, captured_at)`` where
  ``event_type`` is ``"code_stdout"`` for stdout chunks and
  ``"code_stderr"`` for stderr chunks.
- State is a dict ``{"stdout_partial": str, "stderr_partial": str}``.
- The captured_at timestamp on each emit MUST be the item's captured_at
  (not a new monotonic reading — Pitfall: timestamps must be source-
  authoritative so SC #2's monotonic invariant holds).

These tests guard against accidental regressions in the line-buffer
itself; the post-completion safety-net (Test 6 in the plan brief) is
covered by the integration test in Task 3 because it requires the
``_done`` branch's interaction with the loop counters.
"""
from __future__ import annotations

import pytest


@pytest.fixture
def fresh_state() -> dict:
    """A fresh accumulator state — both partial buffers empty."""
    return {"stdout_partial": "", "stderr_partial": ""}


def test_stdout_two_complete_lines_emits_two_events(fresh_state):
    """Two complete lines in one chunk → two code_stdout emits."""
    from app.api.threads import drain_step

    item = {"type": "stdout_chunk", "content": "a\nb\n", "captured_at": 1.0}
    emits, new_state = drain_step(item, fresh_state)

    assert emits == [
        ("code_stdout", "a", 1.0),
        ("code_stdout", "b", 1.0),
    ]
    assert new_state == {"stdout_partial": "", "stderr_partial": ""}


def test_stdout_partial_line_buffers_no_emit(fresh_state):
    """A chunk with no newline → no emit, partial buffered."""
    from app.api.threads import drain_step

    item = {"type": "stdout_chunk", "content": "abc", "captured_at": 1.0}
    emits, new_state = drain_step(item, fresh_state)

    assert emits == []
    assert new_state == {"stdout_partial": "abc", "stderr_partial": ""}


def test_stdout_crlf_normalized_to_lf(fresh_state):
    """\\r\\n MUST collapse to \\n so no bare \\r leaks into emitted content."""
    from app.api.threads import drain_step

    item = {"type": "stdout_chunk", "content": "a\r\nb\r\n", "captured_at": 1.0}
    emits, new_state = drain_step(item, fresh_state)

    assert emits == [
        ("code_stdout", "a", 1.0),
        ("code_stdout", "b", 1.0),
    ]
    # Defensive: no bare \r anywhere in emitted content.
    for _et, content, _ca in emits:
        assert "\r" not in content, f"bare \\r leaked: {content!r}"
    assert new_state == {"stdout_partial": "", "stderr_partial": ""}


def test_stdout_combines_with_prior_partial():
    """Prior partial + new chunk's prefix glued at the first \\n boundary."""
    from app.api.threads import drain_step

    prior_state = {"stdout_partial": "abc", "stderr_partial": ""}
    item = {"type": "stdout_chunk", "content": "def\n", "captured_at": 2.5}
    emits, new_state = drain_step(item, prior_state)

    assert emits == [("code_stdout", "abcdef", 2.5)]
    assert new_state == {"stdout_partial": "", "stderr_partial": ""}


def test_stderr_path_mirrors_stdout(fresh_state):
    """stderr_chunk items emit code_stderr; line-buffer uses stderr_partial."""
    from app.api.threads import drain_step

    item = {"type": "stderr_chunk", "content": "err1\nerr2\n", "captured_at": 3.0}
    emits, new_state = drain_step(item, fresh_state)

    assert emits == [
        ("code_stderr", "err1", 3.0),
        ("code_stderr", "err2", 3.0),
    ]
    assert new_state == {"stdout_partial": "", "stderr_partial": ""}


def test_stderr_partial_uses_stderr_buffer_only(fresh_state):
    """Partial stderr line is buffered in stderr_partial, not stdout_partial."""
    from app.api.threads import drain_step

    item = {"type": "stderr_chunk", "content": "incomplete-err", "captured_at": 4.0}
    emits, new_state = drain_step(item, fresh_state)

    assert emits == []
    assert new_state == {"stdout_partial": "", "stderr_partial": "incomplete-err"}


def test_unknown_item_type_no_emit_state_unchanged(fresh_state):
    """An item.type the helper doesn't recognise is a no-op (caller handles)."""
    from app.api.threads import drain_step

    item = {"type": "_done", "captured_at": 5.0}
    emits, new_state = drain_step(item, fresh_state)

    assert emits == []
    # State pass-through — the caller is responsible for terminal handling.
    assert new_state == {"stdout_partial": "", "stderr_partial": ""}


def test_captured_at_is_source_authoritative(fresh_state):
    """Emit captured_at MUST equal item.captured_at (preserves SC #2 monotonic)."""
    from app.api.threads import drain_step

    item = {"type": "stdout_chunk", "content": "x\n", "captured_at": 12345.678}
    emits, _ = drain_step(item, fresh_state)
    assert emits == [("code_stdout", "x", 12345.678)]
