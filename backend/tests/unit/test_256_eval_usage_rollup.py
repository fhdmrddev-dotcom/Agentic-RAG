"""Phase 256 / METER-05 site 6 (D-256-08) — the eval job's companion ``runs`` row.

``run_eval_job``'s ``finally:`` finalized its companion ``runs`` row with the literal
``input_tokens=None, output_tokens=None`` while every arm's totals were being measured
two frames away (``result.input_tokens_total`` at ``eval_runner_service.py:593-594``) and
persisted per arm to ``eval_results``. The run-level figure was the only one thrown away.

⛔ **THE PRODUCER-SHELL SHAPE OF THE OTHER FIVE SITES MUST NOT BE COPIED HERE, AND THAT IS
THE FINDING THIS FILE PINS.** ``ctx.run_usage_box`` has exactly ONE writer in the whole
tree — ``harness_engine.py:1864``, inside ``run_workflow`` — and this service calls
``run_agent_loop`` DIRECTLY (``:592``), building its own ``RunContext`` at ``:561-576``.
Reaching for the box here would compile, pass a casual review, and produce ``None``
forever: the quietest possible way to fail this requirement. The fence below asserts the
identifier never appears in the module.

THE TWO DECISIONS THIS FILE RECORDS, because both are judgement calls rather than
mechanics and a spend figure with an unnamed hole in it is worse than no figure:

  1. ⭐ **BOTH graded arms are counted.** You were billed for the WITH arm and for the
     WITHOUT arm (D-256-12's own logic), so both belong in a SPEND rollup.
     ⚠ ``with_outcomes`` (``:852-855``) deliberately counts the WITH arm only, and its
     comment says so — that narrowing is right for a **verdict** denominator and wrong
     for a spend total. A token accumulator must NOT inherit it, and must not be solved
     by making ``with_outcomes`` carry tokens (two rollups, two denominators, two
     accumulators).
  2. ⛔ **The judge shot (``_judge_eval_answer``, ``:648``) is NOT counted, and that is
     DECIDED rather than forgotten.** Its usage is measured nowhere in the codebase, so
     counting it would mean instrumenting a seam this requirement does not reach. It is
     registered in ``SEED-300`` with a concrete re-open trigger, and the source says so
     beside the accumulator. Silently folding it in and silently omitting it are the
     same failure.

AND THE INVARIANTS CARRIED OVER FROM THE OTHER FIVE SITES:

  * An absent measurement stays ``None`` to the column. ⛔ Never ``0`` (D-256-06):
    ``NULL`` means *never measured*, ``0`` means *measured as zero*.
  * A ``None`` arm ADDS NOTHING — it neither poisons the sum nor becomes a zero
    (``phase_types._record_run_usage``'s own rule, ``:780-782``).
  * The missing-usage warning fires BEFORE the finalize, one shared identifier-only
    literal (``db/runs.py:93-99`` / T-073-04 / T-256-14).
  * The accumulator is run-LOCAL. ⛔ Never a module global — ``WORKER_COUNT=2`` is the
    shipped default and ``:852`` already cites D-PRD-12 for exactly this (T-256-17).
  * ``eval_results`` (migration 080) is untouched: the per-arm writes at ``:682-683``
    keep receiving each arm's own numbers.

METHOD: every drive runs the REAL ``run_eval_job`` → ``_run_arm`` → ``_run_arm_body``
chain. Only ``run_agent_loop`` and the persistence/emit collaborators are replaced, so
the threading under test is the shipped one end to end.
"""

from __future__ import annotations

import asyncio
import logging
import pathlib
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


_WARNING_FORMAT = "runs.usage missing for run=%s provider=%s model=%s"
_MODULE_REL = "app/services/eval_runner_service.py"

_VERDICT = {"overall_passed": True, "overall_score": 9, "summary": "good", "case_feedback": ""}


def _source() -> str:
    root = pathlib.Path(__file__).resolve().parents[2]
    return (root / _MODULE_REL).read_text(encoding="utf-8")


class _Seq:
    """Records the ORDER of the warning and the finalize. Co-occurrence is not enough."""

    def __init__(self) -> None:
        self.events: list[str] = []
        self.warn_calls: list[tuple] = []

    def warning(self, *args, **kwargs):
        msg = args[0] if args else ""
        if isinstance(msg, str) and msg.startswith("runs.usage missing"):
            self.events.append("warning")
            self.warn_calls.append(args)

    def finalize(self):
        seq = self

        async def _side_effect(*args, **kwargs):
            seq.events.append("finalize")

        return AsyncMock(side_effect=_side_effect)


async def _run_job(arm_totals, *, n_cases=None):
    """Drive the REAL ``run_eval_job`` with ``arm_totals`` handed out one per arm.

    ``arm_totals`` is a list of ``(input_total, output_total)`` in arm order:
    case 1 WITH, case 1 WITHOUT, case 2 WITH, case 2 WITHOUT, …
    """
    import app.services.eval_runner_service as ers

    seq = _Seq()
    finalize = seq.finalize()
    run_id = uuid.uuid4()
    n_cases = n_cases if n_cases is not None else len(arm_totals) // 2
    cases = [
        {"id": f"case-{i}", "prompt": f"prompt {i}", "expected_behavior": "does the thing"}
        for i in range(n_cases)
    ]

    handed: list = list(arm_totals)
    persisted: list[dict] = []

    async def _fake_loop(ctx, emit=None, emit_terminal=None, spawn=None):
        in_tok, out_tok = handed.pop(0)
        return SimpleNamespace(
            full_content_final="an answer",
            input_tokens_total=in_tok,
            output_tokens_total=out_tok,
        )

    async def _fake_persist(supabase, **kwargs):
        persisted.append(kwargs)

    redis = MagicMock()
    redis.get = AsyncMock(return_value=None)
    redis.zrem = AsyncMock(return_value=None)

    with (
        patch.object(ers, "run_agent_loop", _fake_loop),
        patch.object(ers, "get_model_capability", MagicMock(return_value=object())),
        patch.object(ers, "_resolve_eval_org_id", AsyncMock(return_value=None)),
        patch.object(ers, "_create_eval_thread", AsyncMock(return_value="eval-thread")),
        patch.object(ers, "_reset_thread_to_prompt", AsyncMock(return_value=None)),
        patch.object(ers, "_gather_tool_evidence", AsyncMock(return_value="")),
        patch.object(ers, "_judge_eval_answer", AsyncMock(return_value=dict(_VERDICT))),
        patch.object(ers, "_persist_result", _fake_persist),
        patch.object(ers, "_emit_eval", AsyncMock(return_value=None)),
        patch.object(ers, "_emit_terminal", AsyncMock(return_value=None)),
        patch.object(ers, "_update_eval_run_status", AsyncMock(return_value=None)),
        patch.object(ers, "_release_inflight_if_owned", AsyncMock(return_value=None)),
        patch.object(ers, "finalize_run", finalize),
        patch(
            "app.models.user_settings.load_app_settings_async",
            AsyncMock(return_value=None),
        ),
        patch(
            "app.services.harness.validator_kinds.resolve_judge_model",
            MagicMock(return_value="judge-model"),
        ),
        patch.object(ers.logger, "warning", seq.warning),
    ):
        await ers.run_eval_job(
            run_id=run_id,
            skill_id="skill-1",
            skill_version={"name": "s", "description": "d"},
            cases=cases,
            provider="openai",
            model="gpt-5.5",
            current_user={"id": "user-1"},
            user_settings=None,
            redis=redis,
            supabase=MagicMock(),
            pool=MagicMock(),
        )

    assert finalize.await_count == 1, (
        f"the eval job must finalize its companion runs row exactly once; "
        f"got {finalize.await_count}"
    )
    assert not handed, (
        f"the drive did not consume every arm — {len(handed)} totals left over, so the "
        "arm count under test is not the one this case describes"
    )
    return finalize.await_args.kwargs, seq, persisted


# ===========================================================================
# 1. BOTH graded arms count — you were billed for both
# ===========================================================================


@pytest.mark.asyncio
async def test_the_rollup_sums_every_arm_of_every_case():
    kwargs, _seq, _p = await _run_job(
        [(10, 1), (20, 2), (30, 3), (40, 4)]  # c1 WITH, c1 WITHOUT, c2 WITH, c2 WITHOUT
    )
    assert kwargs["input_tokens"] == 100, (
        "expected 10+20+30+40; a total of 40 means only the WITH arms were counted and "
        "the spend rollup inherited with_outcomes' VERDICT narrowing (D-256-12)"
    )
    assert kwargs["output_tokens"] == 10


@pytest.mark.asyncio
async def test_the_without_arm_is_counted_and_is_not_thrown_away():
    """``:901-908`` discards the WITHOUT arm's return entirely — its SPEND must not be."""
    kwargs, _seq, _p = await _run_job([(0, 0), (77, 7)])
    assert kwargs["input_tokens"] == 77, (
        "the WITHOUT arm's tokens are missing from the rollup — its verdict is "
        "deliberately not counted, but the provider still billed for it"
    )
    assert kwargs["output_tokens"] == 7


# ===========================================================================
# 2. None is not zero, and a None arm adds nothing
# ===========================================================================


@pytest.mark.asyncio
async def test_a_job_that_measured_nothing_writes_none_never_zero():
    kwargs, _seq, _p = await _run_job([(None, None), (None, None)])
    assert kwargs["input_tokens"] is None, (
        f"wrote {kwargs['input_tokens']!r}; a 0 would claim the eval run was free "
        "(D-256-06 — NULL means never measured)"
    )
    assert kwargs["output_tokens"] is None


@pytest.mark.asyncio
async def test_a_none_arm_adds_nothing_and_does_not_poison_the_sum():
    kwargs, _seq, _p = await _run_job([(50, 5), (None, None)])
    assert kwargs["input_tokens"] == 50, (
        "a None arm must ADD NOTHING — not become a zero, and not erase the arm that "
        "WAS measured (phase_types._record_run_usage:780-782)"
    )
    assert kwargs["output_tokens"] == 5


@pytest.mark.asyncio
async def test_a_partially_measured_job_keeps_the_unmeasured_half_none():
    kwargs, _seq, _p = await _run_job([(9, None), (None, None)])
    assert kwargs["input_tokens"] == 9
    assert kwargs["output_tokens"] is None


# ===========================================================================
# 3. The warning contract — before the finalize, identifiers only
# ===========================================================================


@pytest.mark.asyncio
async def test_the_missing_usage_warning_fires_before_the_finalize():
    _kwargs, seq, _p = await _run_job([(None, None), (None, None)])
    assert seq.events == ["warning", "finalize"], (
        f"expected the missing-usage warning BEFORE the finalize; recorded {seq.events}"
    )


@pytest.mark.asyncio
async def test_the_warning_carries_the_shipped_literal_with_identifier_args():
    _kwargs, seq, _p = await _run_job([(None, None), (None, None)])
    assert len(seq.warn_calls) == 1
    args = seq.warn_calls[0]
    assert args[0] == _WARNING_FORMAT, (
        f"a VARIANT wording ({args[0]!r}) makes the shared T-073-04 pin vacuous"
    )
    for arg in args[1:]:
        assert not isinstance(arg, int), (
            f"an int ({arg!r}) reached the missing-usage warning — IDENTIFIERS ONLY"
        )


@pytest.mark.asyncio
async def test_no_warning_when_the_job_measured_something():
    """The vacuity control."""
    _kwargs, seq, _p = await _run_job([(1, 1), (1, 1)])
    assert seq.events == ["finalize"], f"recorded {seq.events}"


# ===========================================================================
# 4. T-256-17 — run-local, never shared between concurrent jobs
# ===========================================================================


@pytest.mark.asyncio
async def test_two_concurrent_jobs_do_not_see_each_others_totals():
    a, b = await asyncio.gather(
        _run_job([(100, 10), (100, 10)]),
        _run_job([(1, 1), (1, 1)]),
    )
    assert a[0]["input_tokens"] == 200, (
        f"job A read {a[0]['input_tokens']}, not 200 — a shared accumulator would have "
        "folded job B's spend into it (T-256-17 / D-PRD-12, WORKER_COUNT=2)"
    )
    assert b[0]["input_tokens"] == 2, (
        f"job B read {b[0]['input_tokens']}, not 2 — see above"
    )


def test_there_is_no_module_global_token_accumulator():
    """Asserted on the MODULE, not only on a drive — a global can hide behind one run."""
    import app.services.eval_runner_service as ers

    for name, value in vars(ers).items():
        if "token" not in name.lower():
            continue
        assert not isinstance(value, (list, dict, set)), (
            f"module-level mutable {name!r} looks like a shared token accumulator; run "
            "state must be run-LOCAL (D-PRD-12 — the comment at :852 says so already)"
        )

    for i, line in enumerate(_source().splitlines(), start=1):
        if line.startswith((" ", "\t", "#")) or not line.strip():
            continue
        code = line.split("#", 1)[0]
        if "=" not in code or "==" in code:
            continue
        lhs = code.split("=", 1)[0].strip().split(":")[0].strip()
        assert "token" not in lhs.lower(), (
            f"{_MODULE_REL}:{i} declares module-level token state ({lhs!r}); "
            "WORKER_COUNT=2 is the shipped default (T-256-17)"
        )


# ===========================================================================
# 5. Source fences — the box, the judge shot, and eval_results
# ===========================================================================


def test_the_eval_path_never_reaches_for_ctx_run_usage_box():
    """⛔ Its ONE writer is harness_engine.py:1864, which this path never executes."""
    assert "run_usage_box" not in _source(), (
        "eval_runner_service references ctx.run_usage_box — the box is unreachable "
        "from this path (it never calls run_workflow), so the value would be None "
        "forever while looking correct"
    )


def test_the_judge_shot_exclusion_is_named_in_the_source_with_its_register_entry():
    """T-256-19 — accepted, NAMED. An unnamed hole is the thing this phase prevents."""
    src = _source()
    assert "SEED-300" in src, (
        "the judge-shot exclusion must name SEED-300 in the source; a future reader "
        "must be able to tell a decision from an oversight"
    )


@pytest.mark.asyncio
async def test_the_judge_shot_is_not_folded_into_the_rollup():
    """Every arm's rollup contribution is its LOOP total — the judge adds nothing.

    The judge is called once per graded arm in this drive, so a rollup that had
    silently included judge usage could not equal the loop totals exactly.
    """
    kwargs, _seq, _p = await _run_job([(11, 1), (22, 2)])
    assert (kwargs["input_tokens"], kwargs["output_tokens"]) == (33, 3), (
        "the rollup is not exactly the sum of the two arms' loop totals — something "
        "else (the judge shot?) is being folded in without being named"
    )


@pytest.mark.asyncio
async def test_the_per_arm_eval_results_writes_still_carry_their_own_numbers():
    """⛔ ``eval_results`` (migration 080) is untouched — this is a RUN-level addition."""
    _kwargs, _seq, persisted = await _run_job([(10, 1), (20, 2)])
    assert [(p["input_tokens"], p["output_tokens"]) for p in persisted] == [(10, 1), (20, 2)], (
        "the per-arm eval_results writes changed — the run-level rollup must not "
        "re-plumb the per-arm persistence"
    )
