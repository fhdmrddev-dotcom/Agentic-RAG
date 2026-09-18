"""Phase 256 (METER-06 / D-256-11 / D-256-12) — FENCE 2: the forced-emit leg is COUNTED.

``forced_emit`` drives the SAME ``open_stream`` gateway as every other LLM leg, receives
the SAME ``usage`` / ``usage_delta`` events — and, before this phase, dropped both on the
floor. Every ``llm_emit`` phase in every published workflow was a real, billed provider
call that no column in this product could see.

⛔ **THESE CASES DRIVE THE REAL MODULE BEHAVIOURALLY OVER A FAKE EVENT STREAM.** They do
NOT grep ``forced_emit.py`` for the string ``usage_delta``. *"Presence assertions cannot
see content drift"* — an ``elif et == "usage": pass`` satisfies a grep and ships the exact
defect this fence exists to stop. The subject is the shipped ``_drain`` and the shipped
``forced_emit`` ladder; only the gateway is faked.

⚠ The two facts these cases separate, and why the separation IS the information:

  - **A no-usage stream yields ``(None, None)``, NEVER ``(0, 0)``.** Source-proven
    reachable at ``provider_gateway/openai_compat.py:482-494`` — *"Only emit when a usage
    payload was seen"* — an adapter that serves SIX of the eight providers and emits no
    ``usage_delta`` at all. So "the provider told us nothing" is the COMMON path here, not
    an edge case, and writing a ``0`` for it is a repudiation defect (T-256-20): an
    invented measurement that reads as a real one forever.
  - **A measured ``0`` yields ``0``, never ``None``.** This module is the MEASURER; the
    distinction between *"we counted, and it was zero"* and *"we never counted"* is the
    whole of what it produces. The summer one layer up (``_record_run_usage``) collapses
    both to "add nothing" — which is correct THERE and would be a lie HERE.

⚠ D-256-12 — **EVERY RUNG OF THE RECOVERY LADDER COUNTS, INCLUDING THE FAILED ONES.** You
were billed for each shot the provider served, whether or not it validated. Counting only
the winning rung systematically under-reports the runs that cost the MOST (a
``force_strict`` model that 400s twice before recovering), and the under-report is
invisible — the number still looks like a number.

CONVENTION (this repo's): ``from app.services... import ...`` INSIDE each test body, so a
not-yet-existing symbol never breaks COLLECTION.
"""

from __future__ import annotations

import json

import pytest


# ── the three shipped emission shapes, as synthetic gateway event lists ────────
#
# Shape 1 — openai_compat (openai / openrouter / deepseek / moonshot / minimax / zhipu):
#           ONE terminal ``usage`` carrying accumulated totals; NO ``usage_delta`` at all.
# Shape 2 — anthropic: an initial ``usage`` then a ramp of ``usage_delta`` outputs.
# Shape 3 — google: cumulative-per-chunk converted by the adapter into ``usage_delta``.


_VALID_FM = {
    "scalars": [
        {
            "key": "project_name",
            "value": "Meridian",
            "source_chunk_id": "chunk-1",
            "source_doc": "brief.docx",
            "source_page": 1,
        }
    ],
    "rows": [],
}


def _usage(input_tokens: int, output_tokens: int) -> dict:
    return {
        "type": "usage",
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "reasoning_tokens": 0,
    }


def _tool_call_events(emitter: str, *, usage: list[dict] | None = None) -> list[dict]:
    """A shot that COMMITTED the forced tool call (a winning rung)."""
    return [
        {
            "type": "finish",
            "finish_reason": "tool_calls",
            "tool_calls": [
                {"id": "call_1", "name": emitter, "arguments": json.dumps(_VALID_FM)}
            ],
        },
        *(usage or []),
    ]


def _prose_events(*, usage: list[dict] | None = None) -> list[dict]:
    """A shot that narrated unrecoverable prose — the rung FAILS validation and the
    ladder descends. ⛔ The provider still served it and still billed for it."""
    return [
        {"type": "delta", "content": "I cannot produce that from the provided sources."},
        {"type": "finish", "finish_reason": "stop", "tool_calls": []},
        *(usage or []),
    ]


# ══════════════════════════════════════════════════════════════════════════════
#  Part 1 — ``_drain``: the two arms, driven over real event streams
# ══════════════════════════════════════════════════════════════════════════════


def test_drain_reads_a_single_terminal_usage_event():
    """Shape 1 (``openai_compat``, six of eight providers): one terminal ``usage``
    carrying the accumulated totals, and no deltas at all."""
    from app.services.forced_emit import _drain

    events = [
        {"type": "delta", "content": "working"},
        {"type": "finish", "finish_reason": "stop", "tool_calls": []},
        _usage(1200, 340),
    ]
    content, tool_calls, finish_reason, in_tok, out_tok = _drain(iter(events))

    assert (in_tok, out_tok) == (1200, 340)
    # The pre-existing three fields are untouched by the widening.
    assert content == "working"
    assert tool_calls == []
    assert finish_reason == "stop"


def test_drain_accumulates_usage_then_usage_deltas():
    """Shape 2/3 (anthropic / google): an initial ``usage`` establishes the input count
    and the first output count; each subsequent ``usage_delta`` ADDS output. The
    ``if in_tok is None`` first-event branch behaves like ``task_service._drain``'s."""
    from app.services.forced_emit import _drain

    events = [
        _usage(500, 3),
        {"type": "usage_delta", "output_tokens": 7},
        {"type": "usage_delta", "output_tokens": 11},
        {"type": "finish", "finish_reason": "stop", "tool_calls": []},
    ]
    _c, _tc, _fr, in_tok, out_tok = _drain(iter(events))

    assert in_tok == 500
    assert out_tok == 21, "the deltas must ACCUMULATE onto the initial usage, not replace it"


def test_drain_handles_a_usage_delta_arriving_first():
    """A ``usage_delta`` before any ``usage`` must seed ``out_tok`` rather than being
    dropped — the ``if out_tok is None`` branch of the delta arm."""
    from app.services.forced_emit import _drain

    events = [
        {"type": "usage_delta", "output_tokens": 4},
        {"type": "usage_delta", "output_tokens": 6},
        {"type": "finish", "finish_reason": "stop", "tool_calls": []},
    ]
    _c, _tc, _fr, in_tok, out_tok = _drain(iter(events))

    assert out_tok == 10
    # ⛔ No ``usage`` event ever arrived, so the INPUT count is genuinely unknown.
    assert in_tok is None


def test_drain_yields_none_when_the_provider_emitted_no_usage_at_all():
    """⭐ T-256-20. ``openai_compat.py:485`` emits a ``usage`` event ONLY when a usage
    payload was seen, so a completed shot with no usage is COMMON, not theoretical.

    ⛔ The answer is ``(None, None)`` — *"we never counted"*. A ``(0, 0)`` here is an
    invented measurement that would read as a real one forever, in a column built to
    prevent exactly that."""
    from app.services.forced_emit import _drain

    events = [
        {"type": "delta", "content": "no usage payload was ever seen"},
        {"type": "finish", "finish_reason": "stop", "tool_calls": []},
    ]
    _c, _tc, _fr, in_tok, out_tok = _drain(iter(events))

    assert in_tok is None
    assert out_tok is None
    # The negative assertion, stated separately: a ``0``-initialised accumulator passes
    # every other case in this file and fails ONLY here.
    assert in_tok != 0
    assert out_tok != 0


def test_drain_preserves_a_genuinely_measured_zero():
    """The mirror of the case above, and the reason the accumulators cannot simply be
    truthiness-tested: a provider that measured and reported ``0`` is a DIFFERENT fact
    from one that reported nothing. This module is the measurer; the distinction is its
    entire output."""
    from app.services.forced_emit import _drain

    events = [
        _usage(0, 0),
        {"type": "finish", "finish_reason": "stop", "tool_calls": []},
    ]
    _c, _tc, _fr, in_tok, out_tok = _drain(iter(events))

    assert in_tok == 0
    assert out_tok == 0
    assert in_tok is not None, "a measured 0 must NOT collapse to 'never measured'"
    assert out_tok is not None


def test_drain_sums_repeated_usage_events_within_one_shot():
    """Two ``usage`` events in one shot SUM (the canonical ``task_service`` behaviour) —
    they do not overwrite."""
    from app.services.forced_emit import _drain

    events = [
        _usage(100, 10),
        _usage(50, 5),
        {"type": "finish", "finish_reason": "stop", "tool_calls": []},
    ]
    _c, _tc, _fr, in_tok, out_tok = _drain(iter(events))

    assert (in_tok, out_tok) == (150, 15)


# ══════════════════════════════════════════════════════════════════════════════
#  Part 2 — the LADDER: every rung's spend, failed rungs included (D-256-12)
# ══════════════════════════════════════════════════════════════════════════════


@pytest.fixture()
def _ladder(monkeypatch):
    """Patch the gateway ``open_stream`` with a QUEUE of per-rung event lists, so a
    multi-rung descent can be driven deterministically offline.

    A queued entry of ``"RAISE"`` makes that rung's provider call throw — the
    ``:466-473`` exception arm that ``continue``s to the next rung.
    """
    import app.services.forced_emit as fe

    state: dict = {"queue": [], "calls": 0, "requests": []}

    async def _fake_open_stream(provider, request):
        from app.services.provider_gateway import CallingMode

        state["calls"] += 1
        state["requests"].append(request)
        events = state["queue"].pop(0) if state["queue"] else []
        if events == "RAISE":
            raise RuntimeError("synthetic provider 400")
        return iter(events), CallingMode.NATIVE

    monkeypatch.setattr(fe, "open_stream", _fake_open_stream)
    # ``force_strict`` gives the full THREE-rung ladder:
    #   strict_force → non_strict_force → coerce → honest fail.
    monkeypatch.setattr(
        fe,
        "get_model_capability",
        lambda model: {"emit_tier": "force_strict", "provider": "openai"},
    )
    return state


async def _run(emitter="render_template", model="gpt-5.4"):
    from app.services.forced_emit import forced_emit

    return await forced_emit(
        messages=[{"role": "user", "content": "fill the template"}],
        model=model,
        provider="openai",
        emitter=emitter,
        tools=[{"function": {"name": emitter, "parameters": {}}}],
        user_settings=None,
    )


async def test_the_winning_rung_alone_carries_the_token_keys(_ladder):
    """The success return at the top of the ladder carries both token keys."""
    _ladder["queue"] = [_tool_call_events("render_template", usage=[_usage(900, 120)])]

    result = await _run()

    assert result["failure"] is None
    assert result["emit_rung"] == "strict_force"
    assert result["input_tokens"] == 900
    assert result["output_tokens"] == 120
    assert _ladder["calls"] == 1


async def test_a_three_rung_descent_sums_every_shot_the_provider_served(_ladder):
    """⭐ D-256-12. Two rungs FAIL validation and the third wins — and you were billed
    for all three. The reported total is the sum of all three shots.

    ⛔ Counting only the winning rung (300/30 here) would under-report by 2× on exactly
    the runs that cost the most, and nothing downstream could ever tell."""
    _ladder["queue"] = [
        _prose_events(usage=[_usage(100, 10)]),   # strict_force — failed validation
        _prose_events(usage=[_usage(200, 20)]),   # non_strict_force — failed validation
        _tool_call_events("render_template", usage=[_usage(300, 30)]),  # coerce — won
    ]

    result = await _run()

    assert result["failure"] is None
    assert result["emit_rung"] == "coerce"
    assert _ladder["calls"] == 3
    assert result["input_tokens"] == 600, "failed rungs were billed and must be counted"
    assert result["output_tokens"] == 60


async def test_an_exhausted_ladder_still_reports_its_spend(_ladder):
    """⭐ The honest-failure floor (``_failure()``) CARRIES the summed totals of every
    attempted shot. A failure that reports no spend is the invisible under-report: the
    run cost the most and the ledger says it cost nothing."""
    _ladder["queue"] = [
        _prose_events(usage=[_usage(100, 10)]),
        _prose_events(usage=[_usage(200, 20)]),
        _prose_events(usage=[_usage(300, 30)]),
    ]

    result = await _run()

    assert result["emitted"] is None
    assert result["failure"] == "model_failed_to_emit"
    assert result["emit_rung"] is None
    assert _ladder["calls"] == 3
    assert result["input_tokens"] == 600
    assert result["output_tokens"] == 60


async def test_a_raising_rung_does_not_lose_the_surviving_rungs_spend(_ladder):
    """The ``:466-473`` exception arm ``continue``s. The raised rung contributes nothing
    measurable (the drain never returned), but it must not RESET what was already
    counted, nor prevent the later rungs from counting."""
    _ladder["queue"] = [
        "RAISE",                                                        # strict_force 400s
        _prose_events(usage=[_usage(70, 7)]),                           # non_strict_force
        _tool_call_events("render_template", usage=[_usage(300, 30)]),  # coerce won
    ]

    result = await _run()

    assert result["failure"] is None
    assert result["input_tokens"] == 370
    assert result["output_tokens"] == 37


async def test_a_truncated_rung_is_still_a_billed_rung(_ladder):
    """The D-08 layer-4 truncation guard REJECTS the emission and descends — but the
    provider generated (and charged for) every one of those output tokens."""
    _ladder["queue"] = [
        [
            {"type": "delta", "content": '{"scalars": [{"key": "a", "value": "b"'},
            {"type": "finish", "finish_reason": "length", "tool_calls": []},
            _usage(400, 4000),
        ],
        _tool_call_events("render_template", usage=[_usage(100, 10)]),
    ]

    result = await _run()

    assert result["failure"] is None
    assert result["input_tokens"] == 500
    assert result["output_tokens"] == 4010


async def test_a_ladder_that_measured_nothing_reports_none_not_zero(_ladder):
    """⭐ The ladder-level mirror of the drain's no-usage case. A winning shot whose
    provider emitted no usage payload yields ``None`` for both keys.

    ⛔ Never ``0``. ``0`` would be indistinguishable from a free call, and a downstream
    reader summing it would produce a total that silently excludes this run."""
    _ladder["queue"] = [_tool_call_events("render_template")]  # no usage events at all

    result = await _run()

    assert result["failure"] is None
    assert result["input_tokens"] is None
    assert result["output_tokens"] is None


async def test_a_failed_ladder_that_measured_nothing_also_reports_none(_ladder):
    """The same distinction on the failure floor: ``_failure()`` must not manufacture a
    ``0`` for a ladder nobody could measure."""
    _ladder["queue"] = [_prose_events(), _prose_events(), _prose_events()]

    result = await _run()

    assert result["failure"] == "model_failed_to_emit"
    assert result["input_tokens"] is None
    assert result["output_tokens"] is None


async def test_the_accumulator_is_run_local_and_never_leaks_between_calls(_ladder):
    """⛔ ``WORKER_COUNT=2`` is the shipped default and these coroutines interleave. The
    accumulator is a FUNCTION-LOCAL, so a second ``forced_emit`` call starts from
    nothing — it never inherits the first call's total."""
    _ladder["queue"] = [_tool_call_events("render_template", usage=[_usage(900, 120)])]
    first = await _run()

    _ladder["queue"] = [_tool_call_events("render_template", usage=[_usage(5, 1)])]
    second = await _run()

    assert first["input_tokens"] == 900
    assert second["input_tokens"] == 5, "a module-level accumulator would read 905 here"
    assert second["output_tokens"] == 1


def test_no_module_level_token_accumulator_exists():
    """The structural half of the case above, asserted on the module object rather than
    on source text: no module-level name holds a running token total."""
    import app.services.forced_emit as fe

    for name in ("in_tok", "out_tok", "ladder_in_tok", "ladder_out_tok",
                 "TOTAL_INPUT_TOKENS", "TOTAL_OUTPUT_TOKENS"):
        assert not hasattr(fe, name), (
            f"forced_emit.{name} is module-level state — two concurrent runs would "
            "cross-contaminate each other's token totals"
        )


def test_no_token_value_reaches_a_log_format_string():
    """T-073-04 / T-256-24: this leg adds NO log line carrying a token VALUE. The
    module's log calls stay identifier-only."""
    import inspect

    import app.services.forced_emit as fe

    src = inspect.getsource(fe)
    for forbidden in ("tokens=%", "input_tokens=%", "output_tokens=%", "usage=%"):
        assert forbidden not in src, (
            f"a log format string carrying {forbidden!r} would put token values in logs"
        )
