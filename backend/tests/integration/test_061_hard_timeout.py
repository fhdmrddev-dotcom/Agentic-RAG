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
    """Defense-in-depth: the per-call asyncio.timeout(per_call_budget) wraps appear at least once each."""
    src = _THREADS_PY.read_text(encoding="utf-8")
    n = src.count("async with asyncio.timeout(per_call_budget)")
    assert n >= 2, (
        f"Expected >=2 occurrences of `async with asyncio.timeout(per_call_budget)` "
        f"(Anthropic + OpenAI paths per D-066-02); found {n}. The wrapper deletion "
        f"in test_legacy_outer_wrapper_is_gone passing without these replacements "
        f"means the per-call timer is missing — runs would never time out."
    )


def test_sdk_close_methods_present():
    """D-066-11: stream.close() and _ant_gen.close() appear in threads.py."""
    src = _THREADS_PY.read_text(encoding="utf-8")
    assert "stream.close()" in src, (
        "D-066-11 regression: OpenAI Stream.close() call missing. LangSmith "
        "would record GeneratorExit on TimeoutError without this."
    )
    assert "_ant_gen.close()" in src, (
        "D-066-11 regression: Anthropic _ant_gen.close() call missing."
    )
