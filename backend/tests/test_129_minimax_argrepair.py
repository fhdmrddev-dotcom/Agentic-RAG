"""Phase 129 Plan 02 (MP-04 / D-01 / D-03) — MiniMax truncated-tool-args repair.

Unit coverage of the MiniMax-gated arg-validity guard at the agent-loop
round-trip seam (agent_loop.py ~2046, before messages.append). Root cause is
CONFIRMED truncation (run 2c711ee4, output_tokens=8192 = the cap): MiniMax-M3
runs out of output budget mid-`arguments` and emits a truncated (invalid) JSON
string, yet still reports finish_reason="tool_calls" (so the existing length
guards never fire — Pitfall 2).

The D-01 ladder under test:
  invalid args under provider=="minimax"
    → ONE bounded re-ask (drop bad turn, corrective nudge, continue)
    → recovered (quiet tool_args_recovered signal) OR honest bad_request fail.
  Never a silent swallow, never a fabricated/partial dispatch (no brace-balancing).
  D-14 RED LINE: for non-MiniMax providers the guard NEVER fires.

The guard's decision logic lives in the pure, side-effect-free helpers
`minimax_argrepair_decision` + `_minimax_args_all_valid` (agent_loop.py module
scope); the inline seam delegates to them. These tests pin the REAL helpers (not
a re-implementation) plus the I/O contract (nudge text, recovered event name,
honest-fail copy) so the round-trip seam's behavior is fully covered without
driving the entire streaming agent loop.

Test-id names are the exact rows from 129-RESEARCH §"Phase Requirements → Test Map".
"""
import pytest

from app.services.agent_loop import (
    MINIMAX_ARGREPAIR_NUDGE,
    _minimax_args_all_valid,
    minimax_argrepair_decision,
)
from app.services.provider_gateway import message_for_kind


# ─────────────────────────────────────────────────────────────────────────────
# Tool-call fixtures (shape: the buffered tool_calls list at agent_loop.py:2047,
# `tool_calls = list(tool_calls_buffer.values())` — each tc is a dict with a
# string `arguments` exactly as openai_compat assembles it).
# ─────────────────────────────────────────────────────────────────────────────

def _tc(arguments: str, *, name: str = "execute_code", tid: str = "call_1") -> dict:
    """One buffered tool_call dict in the round-trip-seam shape."""
    return {"id": tid, "name": name, "arguments": arguments}


# A well-formed args string (valid JSON object).
_VALID_ARGS = '{"code": "print(1)"}'

# A TRUNCATED args string — the live failure mode. The model hit the output-token
# cap mid-`code`, so the JSON object is cut off and never closed. This is invalid
# JSON that CANNOT be coerced (only a fresh re-ask is honest — never brace-balance).
_TRUNCATED_ARGS = '{"code": "import pandas as pd\\nprint(pd.DataFrame({\'a\': [1, 2, 3'


def _valid_calls() -> list[dict]:
    return [_tc(_VALID_ARGS)]


def _truncated_calls() -> list[dict]:
    return [_tc(_TRUNCATED_ARGS)]


# ─────────────────────────────────────────────────────────────────────────────
# 1. test_valid_args_pass_through — well-formed MiniMax args → no-op ("ok")
# ─────────────────────────────────────────────────────────────────────────────

def test_valid_args_pass_through():
    """Well-formed MiniMax args: guard is a no-op, the round-trip append proceeds,
    no re-ask, no recovered signal."""
    assert _minimax_args_all_valid(_valid_calls()) is True
    decision = minimax_argrepair_decision(
        "minimax", _valid_calls(), argrepair_retries=0, argrepair_pending=False
    )
    assert decision == "ok", "valid MiniMax args must fall through to the normal append"

    # Multi-tool: each tool_call is validated independently — all valid → ok.
    multi = [_tc(_VALID_ARGS, tid="c1"), _tc('{"query": "x"}', name="search_documents", tid="c2")]
    assert _minimax_args_all_valid(multi) is True
    assert minimax_argrepair_decision("minimax", multi, 0, False) == "ok"


# ─────────────────────────────────────────────────────────────────────────────
# 2. test_truncated_args_detected — invalid args under minimax → "reask"
# ─────────────────────────────────────────────────────────────────────────────

def test_truncated_args_detected():
    """A truncated/invalid args string under provider=="minimax" is DETECTED
    (json.loads fails) and triggers the re-ask path (bad turn not appended,
    counter would increment, continue). Independent of finish_reason."""
    assert _minimax_args_all_valid(_truncated_calls()) is False, (
        "the truncated args string must NOT validate as JSON"
    )
    decision = minimax_argrepair_decision(
        "minimax", _truncated_calls(), argrepair_retries=0, argrepair_pending=False
    )
    assert decision == "reask", "invalid MiniMax args with budget must re-ask"

    # Multi-tool: ONE truncated call among valid ones still trips the guard
    # (per-tool-call validation — the SC#10 multi-tool axis).
    mixed = [_tc(_VALID_ARGS, tid="c1"), _tc(_TRUNCATED_ARGS, tid="c2")]
    assert _minimax_args_all_valid(mixed) is False
    assert minimax_argrepair_decision("minimax", mixed, 0, False) == "reask"

    # The corrective nudge is a re-ask instruction (NOT a brace-balanced/fabricated
    # dispatch) — it asks the model to re-emit complete arguments and split if large.
    assert "re-emit" in MINIMAX_ARGREPAIR_NUDGE.lower()
    assert "split" in MINIMAX_ARGREPAIR_NUDGE.lower()


# ─────────────────────────────────────────────────────────────────────────────
# 3. test_non_minimax_unaffected — D-14 RED LINE (openai/anthropic/google no-op)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("provider", ["openai", "anthropic", "google"])
def test_non_minimax_unaffected(provider):
    """The SAME invalid-args shape under a non-MiniMax provider does NOT trigger
    the guard — the round-trip is byte-identical to today (D-14 RED LINE).

    Even with invalid args AND an argrepair_pending flag, a non-MiniMax provider
    always returns "ok" (the guard is gated strictly on _resolved_provider ==
    "minimax"). The malformed turn is appended unchanged for these providers —
    that is the pre-Phase-129 behavior, deliberately preserved."""
    # Invalid args under a non-MiniMax provider → still "ok" (guard gated out).
    assert (
        minimax_argrepair_decision(
            provider, _truncated_calls(), argrepair_retries=0, argrepair_pending=False
        )
        == "ok"
    ), f"{provider}: the guard must NEVER fire for non-MiniMax providers"

    # Even a stale pending flag + invalid args must not produce a recovered/reask/
    # honest_fail decision for a non-MiniMax provider.
    assert (
        minimax_argrepair_decision(
            provider, _truncated_calls(), argrepair_retries=1, argrepair_pending=True
        )
        == "ok"
    )

    # Valid args under a non-MiniMax provider: also "ok" (no recovered emit ever
    # fires for non-MiniMax, even if pending were somehow set).
    assert (
        minimax_argrepair_decision(provider, _valid_calls(), 1, True) == "ok"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4. test_reask_bounded_separate_counter — max 1, distinct from _provider_retries
# ─────────────────────────────────────────────────────────────────────────────

def test_reask_bounded_separate_counter():
    """The re-ask is bounded to exactly 1 and uses a SEPARATE single-shot counter
    that does NOT consume `_provider_retries` (Pitfall 3)."""
    # First strike (retries==0): re-ask is allowed.
    assert (
        minimax_argrepair_decision("minimax", _truncated_calls(), 0, False) == "reask"
    )
    # After the one re-ask (retries==1), still-invalid args do NOT re-ask again —
    # the budget is exhausted and the decision is honest_fail (cap == 1).
    assert (
        minimax_argrepair_decision("minimax", _truncated_calls(), 1, True)
        == "honest_fail"
    ), "the re-ask must be capped at exactly 1 (no loop)"
    # Higher counter values also honest-fail (defensive — never loops).
    assert (
        minimax_argrepair_decision("minimax", _truncated_calls(), 2, True)
        == "honest_fail"
    )

    # The repair counter is its OWN run-scoped variable, distinct from the
    # transient-error budget. Prove at the source level that the seam increments
    # `_minimax_argrepair_retries` (NOT `_provider_retries`) on the reask branch,
    # and that the counter is initialized alongside _empty_retries (top-of-run),
    # not inside the per-iteration block where _provider_retries resets.
    import inspect
    import app.services.agent_loop as al

    src = inspect.getsource(al)
    assert "_minimax_argrepair_retries = 0" in src, "counter must be init'd run-scoped"
    assert "_minimax_argrepair_retries += 1" in src, "reask must bump the repair counter"
    # The repair branch must NOT touch the transient-error budget.
    assert "_provider_retries += 1" not in src.split("_argrepair_decision == \"reask\"")[-1].split("elif")[0], (
        "the reask branch must not consume _provider_retries (Pitfall 3)"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. test_still_malformed_honest_fail — exhausted budget → honest bad_request copy
# ─────────────────────────────────────────────────────────────────────────────

def test_still_malformed_honest_fail():
    """Invalid → re-ask → still invalid → honest `message_for_kind("bad_request")`
    copy surfaced; no silent swallow, no partial dispatch."""
    decision = minimax_argrepair_decision(
        "minimax", _truncated_calls(), argrepair_retries=1, argrepair_pending=True
    )
    assert decision == "honest_fail"

    # The honest-fail surfaces the EXISTING fixed bad_request copy (no raw 400
    # detail interpolation for this known kind — T-129-06 Information-Disclosure).
    copy = message_for_kind("bad_request")
    assert copy == (
        "*Model parameter error — this model may not support the current "
        "configuration.*"
    )
    # Sanity: the copy carries no leaked raw provider detail / no tool_call_id.
    assert "tool_call_id" not in copy
    assert "json string" not in copy

    # The honest-fail decision is NOT a fabricated/partial dispatch — the seam
    # never brace-balances or re-escapes the truncated string. Prove the source
    # never attempts string repair on the truncated args (no brace-balancing).
    import inspect
    import app.services.agent_loop as al

    src = inspect.getsource(al)
    # The honest-fail branch reaches message_for_kind("bad_request") and breaks.
    assert 'message_for_kind("bad_request")' in src
    # No brace-balancing / partial-JSON reconstruction helpers exist.
    assert "rstrip('}')" not in src and "+ '}'" not in src and '+ "}"' not in src


# ─────────────────────────────────────────────────────────────────────────────
# 6. test_recovered_signal_emitted — invalid → re-ask → valid → one quiet signal
# ─────────────────────────────────────────────────────────────────────────────

def test_recovered_signal_emitted():
    """Invalid → re-ask → valid → exactly one quiet `tool_args_recovered` signal.

    The decision after a successful re-ask (args now valid AND a prior re-ask is
    pending) is "recovered" — the seam then emits ONE quiet tool_args_recovered
    event on the run SSE channel via the Deep-side _emit before the normal append."""
    # After the re-ask, the next turn's args are valid AND pending is set → recovered.
    decision = minimax_argrepair_decision(
        "minimax", _valid_calls(), argrepair_retries=1, argrepair_pending=True
    )
    assert decision == "recovered"

    # Without a pending re-ask, valid args are just "ok" (no recovered signal on a
    # happy-path run that never truncated).
    assert (
        minimax_argrepair_decision("minimax", _valid_calls(), 0, False) == "ok"
    )

    # The recovered branch emits exactly ONE tool_args_recovered event (Phase-122
    # family, Deep-side _emit — NOT the harness forced_emit substrate). Pin the
    # event name + the single-emit shape at the source.
    import inspect
    import app.services.agent_loop as al

    src = inspect.getsource(al)
    recovered_branch = src.split('_argrepair_decision == "recovered"')[-1].split("messages.append")[0]
    assert recovered_branch.count("tool_args_recovered") == 1, (
        "exactly one tool_args_recovered emit on the recovered branch"
    )
    # It is a quiet audit signal, NOT a user-facing error delta — the recovered
    # branch does not emit a 'delta' or 'error' event.
    assert "'delta'" not in recovered_branch and "'error'" not in recovered_branch
    # It uses the Deep-side _emit (one XADD on run:{run_id}), never the harness
    # forced_emit substrate the Deep loop bypasses. Check for an actual CALL
    # (the word also appears in the explanatory comment), so match `forced_emit(`
    # and the harness-only `_emit_audit(` — neither may be invoked here.
    assert "forced_emit(" not in recovered_branch
    assert "_emit_audit(" not in recovered_branch
    assert "await _emit(" in recovered_branch, (
        "the recovered signal must use the Deep-side _emit"
    )
