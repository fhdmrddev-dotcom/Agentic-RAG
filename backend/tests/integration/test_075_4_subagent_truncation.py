"""Phase 075.4 Plan 03 Task 2 — sub-agent / iteration trim warning surfacing.

Pre-Plan-03: ``trim_messages_to_fit`` (threads.py:~1666 region, inside
each iteration of the agent loop) silently dropped older messages to fit
context window. User saw no signal — invariant ambiguity is the trust-
erosion class T-075.4 mitigates.

Plan 03 fix: when post-trim len < pre-trim len, emit
``_emit(redis, run_id, 'system_warning', kind='context_truncated', message=...)``
inline with the dropped count.

D-075.4-E1: also persist as ``role: 'system', kind: 'context_truncated'``
``messages`` row so the warning survives reload. (Persistence path requires
migration 048 to widen messages_role_check; until then INSERT fails-silent
via try/except — SSE event is the user-visible signal regardless.)

Source-text assertions cover the emit + closure-var presence; the
persistence call shape is also verified by grep.
"""
from __future__ import annotations

import re
from pathlib import Path


def test_iteration_trim_emits_system_warning_when_messages_dropped() -> None:
    """The iteration-level trim_messages_to_fit caller MUST be guarded:
    capture pre-len, call trim, compare post-len, emit system_warning when
    len decreased."""
    src = Path(__file__).parent.parent.parent / "app" / "api" / "threads.py"
    text = src.read_text(encoding="utf-8")

    # Canonical kind identifier present
    assert "context_truncated" in text, (
        "Trim guard must use the canonical kind identifier 'context_truncated' "
        "(FORWARD-REF #6 Phase 082.5 hook)."
    )

    # SSE emit with kind='context_truncated' present
    assert re.search(
        r"await _emit\(redis,\s*run_id,\s*['\"]system_warning['\"],\s*\n?\s*kind=['\"]context_truncated['\"]",
        text,
    ), "SSE emit `kind='context_truncated'` not found"

    # The pre-trim length capture + post-trim comparison must appear
    # in proximity. Use a permissive match: any local var name as long as
    # the pattern is `<n> = len(messages); messages = trim_messages_to_fit(...)
    # ; if len(messages) < <n>:`
    m = re.search(
        r"_pre_trim_len\s*=\s*len\(messages\)[\s\S]{0,400}?"
        r"messages\s*=\s*trim_messages_to_fit\([\s\S]{0,200}?\)[\s\S]{0,200}?"
        r"if\s+len\(messages\)\s*<\s*_pre_trim_len",
        text,
    )
    assert m, (
        "Iteration trim must capture _pre_trim_len before trim, then guard "
        "the system_warning emit on len(messages) < _pre_trim_len."
    )


def test_persisted_system_warnings_closure_var_present() -> None:
    """The closure-local accumulator for system warnings (so they can be
    persisted at finalize time) MUST be declared in send_message scope."""
    src = Path(__file__).parent.parent.parent / "app" / "api" / "threads.py"
    text = src.read_text(encoding="utf-8")

    # Plan-locked variable name: _persisted_system_warnings
    assert re.search(
        r"_persisted_system_warnings\s*:\s*list\[dict\]\s*=\s*\[\]",
        text,
    ), (
        "Closure var `_persisted_system_warnings: list[dict] = []` must be "
        "declared next to persisted_tool_calls (D-075.4-E1)."
    )


def test_persist_system_message_helper_or_inline_insert_present() -> None:
    """A helper or inline INSERT path for system_warning rows must exist —
    the warning record is captured at finalize time so it survives reload.

    Until migration 048 widens messages_role_check, the INSERT may fail
    on the CHECK constraint; the code SHOULD wrap in try/except and log
    on failure (fail-silent — SSE event remains the user-visible signal).
    """
    src = Path(__file__).parent.parent.parent / "app" / "api" / "threads.py"
    text = src.read_text(encoding="utf-8")

    # Either a helper name OR a hand-rolled INSERT path with role="system"
    has_helper = "_persist_system_message" in text
    has_inline = bool(re.search(
        r'role\s*=\s*[\'"]system[\'"]|"role"\s*:\s*[\'"]system[\'"]',
        text,
    ))
    assert has_helper or has_inline, (
        "Either define _persist_system_message helper or include an inline "
        "INSERT with role='system' for the persistence path (D-075.4-E1)."
    )
