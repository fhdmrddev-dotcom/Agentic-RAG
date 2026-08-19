"""Phase 200 Plan 03 Task 1 — the CHARACTERIZATION PIN on the human-input executor.

⚠ THIS FILE IS COMMITTED **BEFORE** THE EXTRACTION EXISTS, AND THAT IS ITS ENTIRE
VALUE. The discipline is quoted verbatim from
``frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx``:

    "A baseline taken after the edit proves the edit against itself."

``192.2-02`` did exactly this — the characterization pin was committed ONE COMMIT
BEFORE the seam existed, then passed with a ``git diff --numstat`` of NOTHING.
**That numstat of nothing IS the proof**, and it is the artifact plan ``200-03``
Task 2 is measured against.

WHAT IS PINNED — THE CURRENT (DEFECTIVE) BEHAVIOUR, NOT THE FIXED ONE.
This is a CHARACTERIZATION pin, not a correctness pin. Pinning the *fixed*
behaviour would make the extraction unprovable (the file could not pass both
before and after) and would put two concerns in one file. So the timeout case
below pins the DEFECT — ``BUG-260816-06`` — on purpose:

  * ``test_normal_answer_path_shape``            — GREEN parity, survives both commits
  * ``test_choice_click_resolves_option_text``   — GREEN parity (BUG-260607-01's
                                                    shipped defense; it must survive
                                                    the move UNTOUCHED)
  * ``test_choice_click_out_of_range_stays_empty`` — GREEN parity
  * ``test_shutdown_branch_raises_cancelled_error`` — GREEN parity. This is the
        precedent that ALREADY does the right thing: it raises specifically so the
        phase stays ``active`` and the durable prompt row stays pending (096-09).
  * ``test_timeout_returns_empty_answer_THE_DEFECT`` — ⚠ **THE ONE CASE THAT IS
        EXPECTED TO RED-FLIP IN THE D-10 COMMIT, AND THE ONLY CASE THAT MAY.**
        See its own docblock.
  * ``test_timeout_clamps_to_hard_cap``          — GREEN parity on the clamp; it
        pins the argument handed to the block primitive, not the return value, so
        it survives D-10 unchanged.

⚠ THE PATCH TARGET IS RESOLVED FROM THE FUNCTION'S OWN ``__module__``, NEVER
SPELLED AS A MODULE NAME. ``_exec_llm_human_input`` binds
``subscribe_for_response`` as a module GLOBAL (``from app.services.ask_user_service
import subscribe_for_response`` at its home module's top), so a patch must target
whichever module currently HOSTS the function — ``harness.phase_types`` before the
D-13 cut, ``harness.human_input`` after it. Naming either one literally would make
this file break on the very commit it exists to prove innocent. ``_home()`` below
follows the function instead, so the pin is MOVE-INVARIANT BY CONSTRUCTION.

NO LIVE DB AND NO LIVE REDIS. The operator's dev Postgres and Redis are LIVE and
must not be touched, so this file is safe to run concurrently with anything:
``ctx.supabase`` is ``None`` (which skips the durable prompt-row INSERT outright),
the redis stand-in records nothing, and the block primitive is patched.

⚠ AND THE PARAGRAPH ABOVE DELIBERATELY DOES NOT SPELL THE TWO PORT NUMBERS.
Plan 200-03's own acceptance criterion greps this file for them, and a docblock
that names the thing it forbids fails its own guard while being perfectly correct
prose — the ``PhaseFormPanel.test.tsx`` trap (RESEARCH Pitfall 6), which has caught
three authors already. The ports are the local-infra defaults recorded in
``CLAUDE.md``; they belong there, not here.
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest


class _NoopRedis:
    """Minimal redis stand-in (the executor never reaches a real XADD here)."""

    async def xadd(self, *args, **kwargs):
        return "0-0"


def _executor():
    """The human-input executor, reached through its ONE registry-visible name.

    Imported from ``phase_types`` deliberately: after the D-13 cut that name is a
    re-import of the extracted module's object, so this accessor is exactly the
    "ONE object, not two" property the extraction claims — asserted implicitly on
    every case in this file rather than only in the dedicated identity check.
    """
    from app.services.harness.phase_types import _exec_llm_human_input

    return _exec_llm_human_input


def _home():
    """The MODULE that currently hosts the executor — see the file docblock."""
    return sys.modules[_executor().__module__]


def _phase(config_dict):
    from app.models.harness import PhaseSpec

    return PhaseSpec.model_validate(
        {"slug": "p0", "phase_index": 0, "config": config_dict}
    )


def _ctx(**overrides):
    """The minimal run-ctx bag this executor reads substrate off of.

    ``supabase=None`` is load-bearing: it is the guard the shipped executor already
    checks before the durable prompt-row INSERT, so no database is reached.
    """
    defaults = dict(
        redis=_NoopRedis(),
        run_id=uuid.uuid4(),
        producer_run_id=uuid.uuid4(),
        thread_id=str(uuid.uuid4()),
        supabase=None,
        pool=None,
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        emit=AsyncMock(),
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _human_phase(**config):
    base = {"phase_type": "llm_human_input", "prompt": "Which doc?", "timeout_seconds": 300}
    base.update(config)
    return _phase(base)


# ═══════════════════════════════════════════════════════════════════════════
# GREEN PARITY — these five must pass identically before AND after the D-13 cut
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_normal_answer_path_shape():
    """The answer path's return SHAPE — ``text`` / ``answer`` / ``tool_call_id``.

    ``tool_call_id`` is asserted to be the SAME id handed to the block primitive:
    the durable prompt row, the subscribe channel and the resume matcher all key
    off it, so a move that re-minted it would break resume silently.
    """
    captured = {}

    async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
        captured["tool_call_id"] = tool_call_id
        captured["timeout"] = timeout_seconds
        return {"kind": "response", "response_text": "Doc B", "choice_index": 1}

    phase = _human_phase(options=["Doc A", "Doc B"])
    with patch.object(_home(), "subscribe_for_response", _fake_subscribe):
        out = await _executor()(phase, {}, _ctx())

    assert out["text"] == "Which doc?"
    assert out["answer"] == "Doc B"
    assert out["tool_call_id"] == captured["tool_call_id"]
    assert captured["timeout"] == 300


@pytest.mark.asyncio
async def test_choice_click_resolves_option_text():
    """BUG-260607-01's SHIPPED defense — it must survive the move untouched.

    A choice-click answer arrives as ``{response_text: "", choice_index: N}``; the
    executor resolves ``options[N]`` so the workflow never advances on a silently
    empty answer when the person actually chose.
    """

    async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
        return {"kind": "response", "response_text": "", "choice_index": 1}

    phase = _human_phase(options=["Doc A", "Doc B"])
    with patch.object(_home(), "subscribe_for_response", _fake_subscribe):
        out = await _executor()(phase, {}, _ctx())

    assert out["answer"] == "Doc B"


@pytest.mark.asyncio
async def test_choice_click_out_of_range_stays_empty():
    """BUG-260607-01's guard rail: an out-of-range index degrades to ``""`` — no
    crash and, critically, no WRONG option picked."""

    async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
        return {"kind": "response", "response_text": "", "choice_index": 9}

    phase = _human_phase(options=["Doc A", "Doc B"])
    with patch.object(_home(), "subscribe_for_response", _fake_subscribe):
        out = await _executor()(phase, {}, _ctx())

    assert out["answer"] == ""


@pytest.mark.asyncio
async def test_shutdown_branch_raises_cancelled_error():
    """096-09 — THE PRECEDENT THAT ALREADY DOES THE RIGHT THING.

    A ``{"kind": "shutdown"}`` payload comes ONLY from the graceful-shutdown
    broadcast. The executor raises ``asyncio.CancelledError`` **specifically so the
    phase stays ``active`` and the durable prompt row stays pending** — the engine's
    escape handler skips prompt-expiry while ``is_app_shutting_down()``, so the boot
    sweep re-emits the SAME prompt.

    ⚠ This branch must be left EXACTLY AS IT IS by the D-10 commit. D-10's pause is
    a DIFFERENT disposition and must NOT reuse ``CancelledError`` — outside a
    shutdown that same raise routes into ``_expire_pending_ask_user`` (killing the
    prompt) and ``cancel_phase`` (flipping the step to ``cancelled``).
    """

    async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
        return {"kind": "shutdown"}

    phase = _human_phase()
    with patch.object(_home(), "subscribe_for_response", _fake_subscribe):
        with pytest.raises(asyncio.CancelledError):
            await _executor()(phase, {}, _ctx())


@pytest.mark.asyncio
async def test_timeout_clamps_to_hard_cap():
    """The 1800 s hard cap (``settings.ask_user_max_timeout_seconds``) still clamps.

    Pins the ARGUMENT handed to the block primitive, never the return value, so it
    is unaffected by the D-10 commit's change to what a timeout DOES.
    """
    from app.config import settings

    captured = {}

    async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
        captured["timeout"] = timeout_seconds
        return {"kind": "response", "response_text": "ok", "choice_index": None}

    phase = _human_phase(timeout_seconds=99999)
    with patch.object(_home(), "subscribe_for_response", _fake_subscribe):
        await _executor()(phase, {}, _ctx())

    assert captured["timeout"] == settings.ask_user_max_timeout_seconds


# ═══════════════════════════════════════════════════════════════════════════
# ⚠ THE DEFECT — THE ONE CASE EXPECTED TO RED-FLIP IN THE D-10 COMMIT
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_timeout_returns_empty_answer_THE_DEFECT():
    """⚠ CHARACTERIZATION OF ``BUG-260816-06`` — **THIS CASE IS EXPECTED TO RED-FLIP
    IN THE D-10 COMMIT, AND IT IS THE ONLY CASE IN THIS FILE THAT MAY.**

    It is pinned as a DEFECT, deliberately, not as a contract. Measured today:

      1. ``subscribe_for_response(...)`` returns ``None`` (nobody answered inside
         ``HumanInputConfig.timeout_seconds``, which DEFAULTS TO 300 —
         ``models/harness.py:135``).
      2. The shutdown branch does not fire (``payload`` is falsy).
      3. ``answer`` stays ``""``; the ``kind == "response"`` branch does not fire.
      4. The executor **returns normally**.
      5. ``_run_phase_with_gates`` wraps that in ``PhaseOutcome("completed", ...)``.
      6. ``run_workflow`` calls ``complete_phase`` — the human step reads
         ``completed`` and the NEXT phase receives ``""`` as the human's answer.

    ⇒ **A HUMAN GATE THAT FAILS OPEN.** Four of five real runs of
    ``doc_qa_scoped_098uat`` completed their approval step with ``answer: ""`` at
    exactly the five-minute mark.

    When D-10 lands, this case is REWRITTEN (not deleted) to assert the pause. The
    split — five cases untouched, this one rewritten — is what proves *"the
    extraction changed nothing; the fix changed one thing"*.
    """

    async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
        return None  # nobody answered

    phase = _human_phase(options=["Approve", "Reject"])
    with patch.object(_home(), "subscribe_for_response", _fake_subscribe):
        out = await _executor()(phase, {}, _ctx())

    # The defect, stated as an assertion so its removal is a visible event.
    assert out["answer"] == ""
    assert out["text"] == "Which doc?"
    assert isinstance(out["tool_call_id"], str)
