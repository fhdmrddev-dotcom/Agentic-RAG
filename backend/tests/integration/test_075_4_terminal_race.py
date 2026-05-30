"""Phase 075.4 Plan 03 Task 2 — terminal-status race fix (T-075.4-04).

Before Plan 03:
  - threads.py:~3221 awaited ``_emit(redis, run_id, 'done')`` (inline emit)
  - _shielded_finalize step 2 awaited ``_emit_terminal(... 'done')`` (sentinel)
  - _shielded_finalize step 3 awaited ``finalize_run(...)`` (UPDATE runs.status='completed')

Frontend saw the inline 'done' SSE event BEFORE the DB row's
status='completed' UPDATE landed → race window where a fresh
GET /threads/{id}/snapshot returned status='streaming' for ~tens-of-ms,
spiking 100ms+ on slow hosts.

Plan 03 fix:
  1. REMOVE the inline ``_emit(redis, run_id, 'done')`` at L:~3221.
  2. Inside _shielded_finalize, SWAP step-2 (terminal sentinel) and step-3
     (finalize_run UPDATE) so the sentinel emit fires AFTER the DB UPDATE
     lands. Phase 067.4 Rule 3 (suggestion events emit BEFORE terminal
     sentinel) preserved because the suggestion block lives in the agent
     loop body, not the finalizer.

Verified via source-text assertions on threads.py + light structural
assertions on _shielded_finalize ordering.
"""
from __future__ import annotations

import re
from pathlib import Path


def test_inline_done_emit_at_line_3221_removed() -> None:
    """The inline ``_emit(redis, run_id, 'done')`` at the agent-loop-end
    region MUST be gone — terminal sentinel inside _shielded_finalize is
    now the sole owner of 'done' SSE emit."""
    src = Path(__file__).parent.parent.parent / "app" / "api" / "threads.py"
    text = src.read_text(encoding="utf-8")
    # Match the canonical inline emit literal (no other matches existed
    # pre-fix — the sentinel goes through _emit_terminal, not _emit).
    assert not re.search(
        r"await\s+_emit\(\s*redis\s*,\s*run_id\s*,\s*['\"]done['\"]\s*\)",
        text,
    ), (
        "Inline _emit(redis, run_id, 'done') MUST be removed. The terminal "
        "sentinel inside _shielded_finalize (step 3 post-fix) is now the "
        "sole emitter — fires AFTER finalize_run UPDATE so SSE 'done' "
        "implies DB committed (T-075.4-04 race closed)."
    )


def test_shielded_finalize_step_order_finalize_run_before_sentinel() -> None:
    """Inside _shielded_finalize the asyncpg finalize_run UPDATE MUST be
    awaited BEFORE the _emit_terminal sentinel call so the SSE wire reflects
    DB-committed state."""
    src = Path(__file__).parent.parent.parent / "app" / "api" / "threads.py"
    text = src.read_text(encoding="utf-8")

    # Locate the _shielded_finalize function body
    m = re.search(
        r"async def _shielded_finalize\(\):[\s\S]*?(?=\n {16}try:\s*\n {20}await asyncio\.shield)",
        text,
    )
    assert m, "Could not locate _shielded_finalize body"
    body = m.group(0)

    # Find positions of finalize_run( and _emit_terminal( in the body
    finalize_pos = body.find("await finalize_run(")
    sentinel_pos = body.find("await _emit_terminal(")

    assert finalize_pos != -1, "finalize_run call missing from _shielded_finalize"
    assert sentinel_pos != -1, "_emit_terminal call missing from _shielded_finalize"
    assert finalize_pos < sentinel_pos, (
        f"Plan 075.4-03 T-075.4-04: finalize_run UPDATE (pos {finalize_pos}) "
        f"MUST be awaited BEFORE _emit_terminal sentinel (pos {sentinel_pos}) "
        "so SSE 'done' implies DB-committed state. The race-fix swaps the "
        "legacy step-2/step-3 order."
    )


def test_suggestion_emit_still_precedes_terminal_sentinel() -> None:
    """Phase 067.4 Rule 3 invariant: suggestion events at the agent-loop-end
    region MUST emit BEFORE the terminal sentinel.

    Verified by checking the suggestions block is in the AGENT-LOOP BODY
    (not inside _shielded_finalize), so it always runs before the finally:
    that triggers _shielded_finalize.

    Phase 089 Plan 03 (G-5 verbatim move): the suggestion emit + the entire
    agent-loop body MOVED verbatim into ``app.services.agent_loop.run_agent_loop``
    (the producer-shell ``_shielded_finalize`` STAYS in threads.py). The Rule 3
    invariant is preserved structurally: ``run_agent_loop`` runs to completion
    (emitting suggestions) BEFORE it returns to ``agent_runner``, whose ``finally``
    then triggers ``_shielded_finalize`` (the terminal sentinel owner). So the
    assertion is now split across the two modules: the suggestion emit lives in
    ``run_agent_loop`` (agent_loop.py), and ``_shielded_finalize`` lives in
    threads.py — the loop module ALWAYS completes before the finalizer.
    """
    loop_src = (
        Path(__file__).parent.parent.parent / "app" / "services" / "agent_loop.py"
    )
    loop_text = loop_src.read_text(encoding="utf-8")
    threads_src = Path(__file__).parent.parent.parent / "app" / "api" / "threads.py"
    threads_text = threads_src.read_text(encoding="utf-8")

    # Locate suggestion emit — now in run_agent_loop (agent_loop.py)
    sugg_match = re.search(
        r"await\s+_emit\(redis,\s*run_id,\s*['\"]suggestions['\"],\s*questions=questions\[:3\]\)",
        loop_text,
    )
    assert sugg_match, (
        "suggestion emit not found in agent_loop.py — Phase 089-03 moved the "
        "agent-loop body (incl. the suggestions block) into run_agent_loop."
    )
    sugg_pos = sugg_match.start()

    # The suggestion emit must live inside run_agent_loop (the agent body that
    # always runs to completion before returning to agent_runner's finally).
    run_loop_def = loop_text.find("async def run_agent_loop(")
    assert run_loop_def != -1
    assert sugg_pos > run_loop_def, (
        "Suggestion emit must live inside run_agent_loop (the agent body which "
        "always completes before agent_runner's finally triggers _shielded_finalize)."
    )

    # _shielded_finalize (the terminal-sentinel owner) STAYS in threads.py.
    assert "async def _shielded_finalize():" in threads_text, (
        "_shielded_finalize must STAY in threads.py (producer-shell concern) — "
        "it owns the terminal sentinel that fires AFTER run_agent_loop returns."
    )
