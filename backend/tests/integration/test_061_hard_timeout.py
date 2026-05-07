"""Phase 061 D-061-01 -> Phase 066 D-066-01: legacy 120s wrapper deletion guard.

Phase 061 introduced `async with asyncio.timeout(settings.run_hard_timeout_seconds)`
at threads.py:855 to bound abandoned producer runs (D-061-01). Phase 066
DELETES that wrapper (D-066-01) and replaces it with per-LLM-call timers
inside the iteration loop (D-066-02). The agent loop now has no hard
total cap — matches Claude/ChatGPT UX.

This file used to verify the wrapper's behavior (`test_120s_timeout_fires_full_finally`).
Phase 066 repurposes it to a deletion guard: the wrapper line is gone, AND
the legacy setting `Settings.run_hard_timeout_seconds` is gone. Re-introduction
of either would silently regress to the Gap-006 architecture.

The new lifecycle behavior is covered by:
- tests/integration/test_066_per_call_timer.py (per-call timer fires correctly)
- tests/integration/test_066_terminal_classification.py (timed_out terminal mapping)
- tests/integration/test_066_sse_terminal.py (SSE wire-format)
- tests/integration/test_066_langsmith_clean.py (no GeneratorExit leak)
"""
from pathlib import Path


# Resolve project root from this test file's location:
# backend/tests/integration/test_061_hard_timeout.py -> ../../../
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_THREADS_PY = _PROJECT_ROOT / "backend" / "app" / "api" / "threads.py"
_CONFIG_PY = _PROJECT_ROOT / "backend" / "app" / "config.py"


def test_legacy_outer_wrapper_is_gone():
    """D-066-01: the asyncio.timeout(settings.run_hard_timeout_seconds) wrapper at threads.py:~855 is DELETED."""
    src = _THREADS_PY.read_text(encoding="utf-8")
    # The exact source line that used to live at threads.py:855
    assert "asyncio.timeout(settings.run_hard_timeout_seconds)" not in src, (
        "Phase 066 D-066-01 deletion regression: the outer 120s asyncio.timeout "
        "wrapper at threads.py:~855 is back. This is the bug Gap-006 reported "
        "and Plan 02 fixed. Re-deletion required."
    )


def test_legacy_setting_run_hard_timeout_seconds_is_gone():
    """D-066-01 + Plan 02 SUMMARY: Settings.run_hard_timeout_seconds field is removed.

    The env var name `RUN_HARD_TIMEOUT_SECONDS` is silently parsed-and-ignored
    by Pydantic Settings (`extra='ignore'` at config.py:129) so legacy deploys
    don't error at startup. But the field itself is gone — references should
    fail at import time.
    """
    src = _CONFIG_PY.read_text(encoding="utf-8")
    # The class-attribute declaration line
    assert "run_hard_timeout_seconds: int" not in src, (
        "Phase 066 deletion regression: Settings.run_hard_timeout_seconds field "
        "is back. Plan 02 removed it; per-call budgets live on MODEL_CAPABILITIES "
        "now. Re-deletion required."
    )


def test_per_call_timer_replacements_present():
    """Defense-in-depth: per-call deadline reaches BOTH provider branches.

    Phase 067.1 Plan 01 Track A: the per-call asyncio.timeout previously
    appeared verbatim as `async with asyncio.timeout(per_call_budget)` in
    each branch. Track A factored it into the
    ``_drain_stream_with_close_on_cancel`` helper (threads.py:~155). The
    contract is preserved: both Anthropic and OpenAI branches still bound
    SDK iteration by the per-call deadline — the bind happens via the
    helper's second positional arg ``per_call_budget`` at the call sites.
    """
    src = _THREADS_PY.read_text(encoding="utf-8")
    # Track A invariant: helper exists exactly once.
    assert src.count("async def _drain_stream_with_close_on_cancel(") == 1, (
        "Track A regression: helper _drain_stream_with_close_on_cancel "
        "missing or duplicated. Both provider branches must route iteration "
        "through the helper (PATTERNS.md parity rule)."
    )
    # Both branches must call the helper with per_call_budget bound. The
    # helper's per-iteration `async with asyncio.timeout(timeout_seconds)`
    # consumes that arg — same effective contract as the inline form.
    n_calls = src.count("await _drain_stream_with_close_on_cancel(")
    assert n_calls >= 2, (
        f"Expected >=2 call sites of `await _drain_stream_with_close_on_cancel(...)` "
        f"(Anthropic + OpenAI paths per D-066-02 + Track A parity rule); "
        f"found {n_calls}. Without these the per-call timer is missing — "
        f"runs would never time out."
    )
    # The helper itself wraps the iteration in an asyncio.timeout.
    assert "async with asyncio.timeout(timeout_seconds)" in src, (
        "Track A regression: _drain_stream_with_close_on_cancel must wrap "
        "queue consumption in `async with asyncio.timeout(timeout_seconds)`. "
        "Without it the helper would never raise TimeoutError on stalled streams."
    )


def test_sdk_close_methods_present():
    """D-066-11 + Phase 067.1 Plan 01 Track A: SDK close() bind reaches both branches.

    Track A binds the close call via ``close_fn=`` keyword on the helper
    invocation: ``close_fn=stream.close`` (OpenAI) and
    ``close_fn=_ant_gen.close`` (Anthropic). The helper invokes the bound
    callable from the main thread on cancel BEFORE the producer's
    for-loop cleanup propagates GeneratorExit into _TracedStream.__iter__.
    """
    src = _THREADS_PY.read_text(encoding="utf-8")
    assert "close_fn=stream.close" in src, (
        "D-066-11 regression: OpenAI Stream.close() bind missing on the "
        "_drain_stream_with_close_on_cancel call. LangSmith would record "
        "GeneratorExit on TimeoutError without this."
    )
    assert "close_fn=_ant_gen.close" in src, (
        "D-066-11 regression: Anthropic _ant_gen.close() bind missing on the "
        "_drain_stream_with_close_on_cancel call."
    )
