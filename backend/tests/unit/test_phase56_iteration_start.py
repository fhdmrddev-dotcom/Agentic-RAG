"""Unit tests for Phase 56 iteration_start SSE event (D-04).

TDD RED phase: tests are written against behaviors not yet in production code.
They WILL FAIL until Task 3 (threads.py patch) is applied.

Tests:
  - test_iteration_start_emitted_at_loop_top: iteration_start fires before
    planning on every loop pass (iterations 0, 1, 2).
  - test_iteration_start_zero_indexed: first emission carries iteration=0
    (frontend adds +1 for display per Pitfall 1 in 056-RESEARCH.md).
  - test_threads_py_emits_iteration_start_at_loop_top: source-inspect threads.py
    to confirm the literal string appears AND is positioned before 'if iteration > 0'.
"""
import json
import asyncio
import os
import sys

import pytest

# ---------------------------------------------------------------------------
# Path setup — mirror pattern from test_streaming_reliability.py
# ---------------------------------------------------------------------------
backend_path = os.path.join(os.path.dirname(__file__), "..", "..")
if os.path.abspath(backend_path) not in sys.path:
    sys.path.insert(0, os.path.abspath(backend_path))


# ---------------------------------------------------------------------------
# CLASS 1: Mock-based behavioural tests for iteration_start
# ---------------------------------------------------------------------------

class TestIterationStartEvent:
    """Behavioural tests using a mock async generator that mirrors event_stream()."""

    @pytest.mark.asyncio
    async def test_iteration_start_emitted_at_loop_top(self):
        """For max_iterations=3, three iteration_start events are yielded, each
        appearing BEFORE the planning event of the same iteration.

        Expected event order (5 yields total):
          idx 0: iteration_start iteration=0  (no planning on iteration 0)
          idx 1: iteration_start iteration=1
          idx 2: planning        iteration=1
          idx 3: iteration_start iteration=2
          idx 4: planning        iteration=2
        """
        async def mock_event_stream(max_iter: int):
            for iteration in range(max_iter):
                # D-04: emit iteration_start at the very top
                yield f"data: {json.dumps({'type': 'iteration_start', 'iteration': iteration})}\n\n"
                # Existing planning event — fires only from iteration 1 onward
                if iteration > 0:
                    yield f"data: {json.dumps({'type': 'planning', 'iteration': iteration})}\n\n"

        events = [chunk async for chunk in mock_event_stream(3)]

        # Extract parsed objects
        parsed_events = []
        for e in events:
            # Strip "data: " prefix and trailing "\n\n"
            payload = e[len("data: "):].strip()
            parsed_events.append(json.loads(payload))

        # 3 iteration_start + 2 planning (planning fires at iterations 1, 2)
        assert len(parsed_events) == 5, (
            f"Expected 5 events total, got {len(parsed_events)}: {parsed_events}"
        )

        # Verify all three iteration_start events are present
        iter_start_events = [e for e in parsed_events if e["type"] == "iteration_start"]
        assert len(iter_start_events) == 3, (
            f"Expected 3 iteration_start events, got {len(iter_start_events)}"
        )

        # Verify iteration values are 0, 1, 2
        assert [e["iteration"] for e in iter_start_events] == [0, 1, 2], (
            f"iteration_start iteration fields should be [0,1,2], "
            f"got {[e['iteration'] for e in iter_start_events]}"
        )

        # Verify iteration_start appears before planning in the same iteration pass
        # Event 0: iteration_start(0), Event 1: iteration_start(1), Event 2: planning(1)
        assert parsed_events[0]["type"] == "iteration_start"
        assert parsed_events[0]["iteration"] == 0
        assert parsed_events[1]["type"] == "iteration_start"
        assert parsed_events[1]["iteration"] == 1
        assert parsed_events[2]["type"] == "planning"
        assert parsed_events[2]["iteration"] == 1

    @pytest.mark.asyncio
    async def test_iteration_start_zero_indexed(self):
        """The very first iteration_start event must carry iteration=0 (not 1).

        Frontend adds +1 for display (Pitfall 1 in 056-RESEARCH.md). If the
        backend emits 1 for the first event, the user would see 'Step 2'.
        """
        async def mock_event_stream(max_iter: int = 3):
            for iteration in range(max_iter):
                yield f"data: {json.dumps({'type': 'iteration_start', 'iteration': iteration})}\n\n"
                if iteration > 0:
                    yield f"data: {json.dumps({'type': 'planning', 'iteration': iteration})}\n\n"

        first_yield = None
        async for chunk in mock_event_stream():
            first_yield = chunk
            break

        assert first_yield is not None, "Generator yielded nothing"
        payload = first_yield[len("data: "):].strip()
        parsed = json.loads(payload)
        assert parsed["type"] == "iteration_start", (
            f"First yield must be iteration_start, got type={parsed.get('type')}"
        )
        assert parsed["iteration"] == 0, (
            f"First iteration_start must carry iteration=0 (0-indexed), got {parsed['iteration']}"
        )


# ---------------------------------------------------------------------------
# CLASS 2: Source-inspection tests against production threads.py
# ---------------------------------------------------------------------------

class TestIterationStartInProductionSource:
    """Source-inspect threads.py to confirm iteration_start is emitted correctly."""

    def test_threads_py_emits_iteration_start_at_loop_top(self):
        """Verify threads.py source contains the iteration_start emission AND
        that it is positioned BEFORE the 'if iteration > 0:' planning block.

        Strategy: find the line numbers for:
          1. The 'for iteration in range(max_iterations)' loop header
          2. The first 'iteration_start' yield after it
          3. The 'planning' event yield
        Assert: (1) < (2) < (3) in line number order.
        """
        import inspect
        import app.api.threads as threads_module

        source = inspect.getsource(threads_module)
        assert "'type': 'iteration_start'" in source, (
            "threads.py must contain the literal string \"'type': 'iteration_start'\" — "
            "the iteration_start SSE event is not yet emitted (Task 3 not done)."
        )

        lines = source.splitlines()

        # Find the line index of the for-iteration loop
        loop_line_idx = None
        for i, line in enumerate(lines):
            if "for iteration in range(max_iterations)" in line:
                loop_line_idx = i
                break
        assert loop_line_idx is not None, (
            "Could not find 'for iteration in range(max_iterations)' in threads.py"
        )

        # Find the first iteration_start yield AFTER the loop header
        iter_start_line_idx = None
        for i in range(loop_line_idx + 1, len(lines)):
            if "iteration_start" in lines[i]:
                iter_start_line_idx = i
                break
        assert iter_start_line_idx is not None, (
            "Could not find 'iteration_start' yield after the for-loop header in threads.py"
        )

        # Find the first planning event yield AFTER iteration_start
        planning_line_idx = None
        for i in range(iter_start_line_idx + 1, len(lines)):
            if "'type': 'planning'" in lines[i]:
                planning_line_idx = i
                break
        assert planning_line_idx is not None, (
            "Could not find \"'type': 'planning'\" yield after the iteration_start line in threads.py"
        )

        assert iter_start_line_idx < planning_line_idx, (
            f"iteration_start (line {iter_start_line_idx}) must appear BEFORE planning "
            f"(line {planning_line_idx}) in the for-iteration loop body"
        )
