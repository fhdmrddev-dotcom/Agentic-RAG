"""Phase 075.4 Plan 03 Task 2 — iteration-cap drop guard (T-075.4-05).

When the agent loop reaches the final iteration (force_no_tools = True) AND
the chunk-drain populated tool_calls_buffer, the buffer is silently dropped
under the legacy flow (the tool_choice='none' on the next iteration means
none of the buffered tools ever run). This is a trust-erosion class — the
user sees a completed run but never finds out their last requested tool
was dropped.

Plan 03 fix: on iteration-cap exit, if buffer non-empty:
  - emit SSE system_warning kind='iteration_cap_dropped_tool_calls'
  - logger.warning(...identifier-only fields...)
  - clear the buffer (belt-and-suspenders; force_no_tools already true)

Source-text assertion (the guard lives deep in send_message; the relevant
locals are bound to a per-iteration scope that is hard to drive directly
without a full agent loop fixture).
"""
from __future__ import annotations

import re
from pathlib import Path


def test_iteration_cap_guard_emits_system_warning_and_log() -> None:
    """The end-of-stream drain path MUST guard on force_no_tools + non-empty
    tool_calls_buffer and emit both the SSE system_warning and a
    logger.warning with the canonical format."""
    src = Path(__file__).parent.parent.parent / "app" / "api" / "threads.py"
    text = src.read_text(encoding="utf-8")

    # Canonical kind identifier present
    assert "iteration_cap_dropped_tool_calls" in text, (
        "iteration-cap drop guard must use the canonical kind identifier "
        "'iteration_cap_dropped_tool_calls' (FORWARD-REF #6 Phase 082.5 hook)."
    )

    # Structured log format string MUST contain identifier-only fields:
    # run_id, iteration, dropped count, tool_names. No prompt content / no
    # raw arguments leak (T-073-04 norm extended here).
    assert re.search(
        r'logger\.warning\(\s*\n?\s*"iteration_cap_dropped_tool_calls\s+run=%s\s+iteration=%d\s+dropped=%d\s+tool_names=%s"',
        text,
    ), (
        "Structured log line must match `iteration_cap_dropped_tool_calls "
        "run=%s iteration=%d dropped=%d tool_names=%s` exactly so future log "
        "consumers (Phase 082.5) can pattern-match."
    )

    # SSE emit must be present with kind+message
    assert re.search(
        r"await _emit\(redis, run_id, ['\"]system_warning['\"],\s*\n?\s*kind=['\"]iteration_cap_dropped_tool_calls['\"]",
        text,
    ), "SSE emit must use kind='iteration_cap_dropped_tool_calls'"


def test_iteration_cap_guard_clears_buffer_after_warning() -> None:
    """Belt-and-suspenders: after warning, the buffer is cleared so any
    later code path that inspects tool_calls_buffer sees an empty dict."""
    src = Path(__file__).parent.parent.parent / "app" / "api" / "threads.py"
    text = src.read_text(encoding="utf-8")

    # Look for the canonical clear pattern in the guard region
    # The guard is `if force_no_tools and tool_calls_buffer:` followed by
    # the emit + log, then `tool_calls_buffer = {}` somewhere within.
    m = re.search(
        r"if\s+force_no_tools\s+and\s+tool_calls_buffer:[\s\S]{0,1200}?tool_calls_buffer\s*=\s*\{\}",
        text,
    )
    assert m, (
        "Buffer clear (`tool_calls_buffer = {}`) must follow the "
        "iteration-cap drop warning within ~1200 chars (belt-and-suspenders "
        "guard against any downstream code that re-inspects the buffer)."
    )
