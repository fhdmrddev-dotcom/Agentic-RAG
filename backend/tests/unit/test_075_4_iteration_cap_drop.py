"""Phase 075.4 Plan 03 Task 2 — iteration-cap guard (T-075.4-05).

ORIGINAL (075.4): on the final iteration (force_no_tools=True) with a non-empty
tool_calls_buffer, the buffered tools were silently DROPPED — a trust-erosion
class. 075.4's fix surfaced an `iteration_cap_dropped_tool_calls` warning + log
and cleared the buffer.

SUPERSEDED by Phase 092 (092-03 / SC#4): the DROP is replaced with PERSIST. The
cap site now persists the buffered calls to a durable role='system' carrier row
(kind='iteration_cap_paused') BEFORE clearing the buffer, finalizes the run
'cap_paused' (non-terminal), and emits a NON-terminal cap_paused SSE event so a
Continue (POST /runs/{id}/continue) can CONSUME them. These source-text
assertions track the 092 contract — the buffer is no longer "dropped on the
floor", it is PERSISTED-then-paused.

Source-text assertion (the guard lives deep in run_agent_loop; the relevant
locals are bound to a per-iteration scope that is hard to drive directly without
a full agent loop fixture).
"""
from __future__ import annotations

import re
from pathlib import Path


def _agent_loop_src() -> str:
    src = Path(__file__).parent.parent.parent / "app" / "services" / "agent_loop.py"
    return src.read_text(encoding="utf-8")


def test_iteration_cap_guard_persists_then_pauses() -> None:
    """092 SC#4: the cap guard PERSISTS the buffered calls (cap_paused) instead of
    dropping them. The guard must call persist_cap_paused (durable carrier +
    non-terminal cap_paused event) on the force_no_tools + non-empty-buffer path."""
    text = _agent_loop_src()

    # 092 canonical kind identifier present (replaces the 075.4 drop kind).
    assert "iteration_cap_paused" in text, (
        "092 SC#4: the cap path must use the 'iteration_cap_paused' kind "
        "(durable carrier + non-terminal pause) — the buffered tools are "
        "PERSISTED for Continue, not dropped."
    )

    # The guard region invokes persist_cap_paused (the consume-not-drop entry).
    assert re.search(
        r"if\s+force_no_tools\s+and\s+tool_calls_buffer:[\s\S]{0,2000}?persist_cap_paused\(",
        text,
    ), (
        "The force_no_tools + non-empty-buffer guard must call "
        "persist_cap_paused() to persist the dropped calls before clearing the "
        "buffer (092 SC#4 — consume, not re-drop)."
    )


def test_iteration_cap_guard_clears_buffer_after_persist() -> None:
    """The buffer is still cleared AFTER the persist (belt-and-suspenders) so the
    downstream `if not tool_calls_buffer:` short-circuit skips the tool round —
    the calls are durable in the carrier row, not re-executed in this iteration."""
    text = _agent_loop_src()

    # persist_cap_paused(...) must be followed by `tool_calls_buffer = {}` within
    # the guard region (persist FIRST, then clear — SC#4 ordering).
    m = re.search(
        r"persist_cap_paused\([\s\S]{0,800}?tool_calls_buffer\s*=\s*\{\}",
        text,
    )
    assert m, (
        "`tool_calls_buffer = {}` must follow the persist_cap_paused() call "
        "(persist BEFORE clear — the dropped calls are durable first, then the "
        "in-memory buffer is zeroed; 092 SC#4)."
    )
