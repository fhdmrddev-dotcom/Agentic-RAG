"""D-067.4-R3-03: assert generate_suggestions is wrapped in run_in_threadpool.

CLAUDE.md D-v2.5-01 mandates: "no blocking I/O directly inside async handlers."
generate_suggestions makes a synchronous client.chat.completions.create call —
when invoked unwrapped inside agent_runner's async context, it blocks the
single uvicorn worker for the full LLM round-trip duration.

Static-source check pattern mirrored from test_063_legacy_path_deleted.py
(`inspect.getsource` + literal-substring assert) and from
test_phase56_iteration_start.py (line-number-ordering scan).

Two tests:
1. test_generate_suggestions_is_wrapped_in_run_in_threadpool — regex match
   for `run_in_threadpool(\\s*generate_suggestions` in threads.py source.
2. test_run_in_threadpool_imported_at_threads_module_top — assert the
   `from starlette.concurrency import run_in_threadpool` line appears within
   the first 80 lines of module source (currently module-local at ~line 637).

RED on master (pre-Plan 01):
    Test 1 FAILS: the call is `generate_suggestions(...)` directly inside
                  async agent_runner, NOT `run_in_threadpool(generate_suggestions, ...)`.
    Test 2 FAILS only if the import is module-local; if Plan 01 already hoisted,
                  this test passes — it serves as a forward-looking guard.

GREEN after Plan 01: both tests pass.
"""
import inspect
import re

import app.api.threads as threads_module
import app.services.agent_loop as agent_loop_module


def test_generate_suggestions_is_wrapped_in_run_in_threadpool():
    """Assert the agent-loop source contains `run_in_threadpool(\\n    generate_suggestions,`
    (or equivalent inline form).

    D-067.4-R3-03 / CLAUDE.md D-v2.5-01: the synchronous LLM round-trip must
    not block the uvicorn event loop.

    RED on master (pre-Plan 01): the call is `generate_suggestions(...)`
    directly inside async agent_runner. After Plan 01 the call site is
    `await run_in_threadpool(generate_suggestions, ...)`.

    Phase 089-03 (G-5 verbatim move): the suggestion-gen block (incl. the
    run_in_threadpool wrap) moved with the loop body into
    agent_loop.py::run_agent_loop — grep there.
    """
    source = inspect.getsource(agent_loop_module)

    # The literal substring that must appear post-fix. Two acceptable forms:
    # (a) multi-line:  await run_in_threadpool(\n    generate_suggestions,
    # (b) single-line: await run_in_threadpool(generate_suggestions,
    pattern = re.compile(
        r"run_in_threadpool\(\s*generate_suggestions",
        re.MULTILINE,
    )
    assert pattern.search(source), (
        "generate_suggestions is not wrapped in run_in_threadpool — "
        "D-067.4-R3-03 / CLAUDE.md D-v2.5-01 not complete. "
        "Pattern looked for: r'run_in_threadpool\\(\\s*generate_suggestions'"
    )


def test_run_in_threadpool_imported_at_threads_module_top():
    """run_in_threadpool import is hoisted to module top (NOT module-local).

    Currently (`threads.py:637` — pre-Plan 01) the import is module-local
    inside thread deletion. Post-Plan 01 hoist to top so multiple call sites
    share it.

    Pre-Plan 01 master state: top-level import at line ~12 already exists
    (used by the existing `generate_thread_title` wrap at line ~1027), and
    the module-local re-import at line ~637 must be DELETED. This test asserts
    the top-level import is present within the first 80 lines.
    """
    source = inspect.getsource(threads_module)
    lines = source.splitlines()
    # First match wins
    for i, line in enumerate(lines[:80]):
        if "from starlette.concurrency import run_in_threadpool" in line:
            return  # PASS — top-level import found
    raise AssertionError(
        "run_in_threadpool not imported at module top within the first 80 lines — "
        "Plan 01 must hoist the import (currently module-local at ~line 637)."
    )
