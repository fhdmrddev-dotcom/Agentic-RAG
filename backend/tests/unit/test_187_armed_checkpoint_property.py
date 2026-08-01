"""Phase 187 (SC#6 / SPEC Req 7 / SEED-137) — THE ARMED-CHECKPOINT PROPERTY.

**This file is the SC#6 property test and it was written BEFORE any fix exists.** Plan
187-01 exists for exactly one reason: the Phase-185 lesson is *"verify the PROPERTY not
the PATCH, and observe falsification RED first"*. A property test whose first run happens
after the fix proves nothing at all, so the RED observation is a separate, committed,
auditable step (Task 3 fills the ``## RED signature observed on HEAD`` section below).

THE PROPERTY, in one line::

    armed(phase)  ⇒  the person was asked, on ``subscribe_for_response``, BEFORE the body

WHAT MAKES THIS A PROPERTY AND NOT AN EXAMPLE
---------------------------------------------
The guarantee SPEC Req 7 locks is *"a property of the phase, not a position in a list"*.
So the test quantifies over **author-declared validator SETS** — an author controls
``phase.validators`` entirely, and the engine must not let that control disable a
governance gate. :data:`CASES` is the space: nine sets covering the empty set, each
``timing="pre"`` disposition (``ask_user`` / ``fail_run`` / ``skip_to_phase``), a
``post``-only set, a mixed pre+post set, two multi-``pre`` permutations, and a typed
refusal of the armed prompt itself.

**The space is an explicit table rather than ``hypothesis``.** Measured: ``hypothesis`` is
not a backend dependency (it is in no requirements file and not importable in
``backend/venv``), and the interesting axis here is a small, enumerable, *named* set of
author dispositions — every row below is a shape a real author can write, and each one is
worth being able to name in a failure report. A generator would trade that legibility for
coverage of a space that has nine meaningful points.

THE OBSERVABLE IS **BODY INVOCATION**, NEVER "WAS A VALIDATOR PRESENT"
----------------------------------------------------------------------
``_execute_phase`` is replaced by a spy that records *whether* it ran and *when* (a
monotonic order index). Asserting on the shape of ``phase.validators`` would test the
patch; asserting that the risky step's body did not execute without a human answer tests
the property. This is the ``body_ran`` sentinel shape from
``test_pre_post_timing.py:60-109``, driving the REAL ``_run_phase_with_gates``.

THE PHASE UNDER TEST IS THE **EFFECTIVE** PHASE
-----------------------------------------------
Every drive builds a RAW ``PhaseSpec`` with ``action_risk_armed=True`` and the author's
validator set, then passes it through ``grounding.effective_phase(raw, total_phases=4)``
before handing it to ``_run_phase_with_gates`` — which is exactly what ``run_workflow``
does at its ONE synthesis call site (``harness_engine.py:1336-1339``). This construction
is load-bearing: a *raw* armed phase with ``validators=[]`` never had an armed gate at
all, so a test that skipped ``effective_phase`` would be measuring a phase the engine
never runs and could not reproduce the HEAD bypass.

THE ARMED PROMPT IS **IDENTIFIED BY THE COMPOSER**, NEVER RE-TYPED
-------------------------------------------------------------------
``grounding._approval_sentence`` is imported and called; the sentence it returns is
matched against the ``ask_user_prompt`` emit's ``prompt`` kwarg, and the emit is joined to
its ``subscribe_for_response`` await by ``tool_call_id``. No fragment of that sentence is
written down here. Its honesty rules are already pinned character-identically by
``test_185_engine_attachment.py:407-451``; duplicating even a substring would create a
second copy that can drift.

REAL VALIDATOR KINDS, NO ``run_gates`` FAKE
--------------------------------------------
Every author gate below is a **registered** kind driven to a deterministic verdict with no
I/O, so ``run_gates`` runs for real (the ``timing`` filter, the FULL-list ``idx``
invariant and first-failure-wins at ``validators.py:230-249`` are all exercised, not
simulated):

* ``structure_check`` / ``mode: loose`` — a pure substring scan over ``_output_text``.
  ``sections=["__SECTION_NEVER_PRESENT__"]`` FAILS deterministically (the pre-gate output
  is ``{"_phase_inputs": …}``, whose ``text`` is ``""``); ``sections=[]`` PASSES
  deterministically (nothing can be missing).
* ``citations_required`` / ``mode: presence``, ``min_markers: 0`` — the marker count is
  ``0 >= 0``, so it PASSES with no judge call and no network.

Because no fake is installed, the plan's conditional
``fake_run_gates_agrees_with_the_real_one`` companion test is not needed — there is no
fake to pin.

MOCK COMPLETENESS (``feedback_mock_completeness``): every network dependency is mocked —
``harness_engine.write_audit`` (kept addressable, P3 filters its ``await_args_list``),
``harness_engine._emit``, ``ctx.emit`` and
``app.services.ask_user_service.subscribe_for_response``.

Imports INSIDE the body, per this suite's convention.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest


# ── the workflow shape every case is driven against ──────────────────────────
# A 4-phase workflow whose step 2 is the armed one. ``total_phases`` and
# ``phase_index`` both feed ``_approval_sentence``; they are constants here so the
# expected sentence is a pure function of the case-independent fixture.
TOTAL_PHASES = 4
ARMED_SLUG = "send-the-notice"
ARMED_NAME = "Send the renewal notice"
ARMED_PHASE_INDEX = 1

# The exact presented approval label lives in ONE place in the engine
# (``_ACTION_RISK_APPROVE_CHOICE``) precisely so a rename cannot separate the label from
# the gate that reads it. It is imported, never re-typed — see ``_approve_label()``.

# A section name no output can contain — the deterministic FAIL lever for
# ``structure_check`` / loose mode.
_NEVER_PRESENT = "__SECTION_NEVER_PRESENT__"


def _pre_gate(on_failure: str, *, passes: bool = False) -> dict:
    """A ``timing="pre"`` author gate with a deterministic verdict and no I/O.

    ``structure_check`` / loose mode is a case-insensitive substring scan over
    ``_output_text(output)``. The pre-gate output the engine passes is
    ``{"_phase_inputs": accumulated}``, which has no ``"text"`` key, so the scanned text
    is ``""``: a non-empty section list can never be found (FAIL) and an empty one can
    never be missing (PASS).
    """
    return {
        "kind": "structure_check",
        "timing": "pre",
        "on_failure": on_failure,
        "config": {"mode": "loose", "sections": [] if passes else [_NEVER_PRESENT]},
    }


def _post_gate_passing() -> dict:
    """A ``timing="post"`` author gate that passes over the spy body's output."""
    return {
        "kind": "structure_check",
        "timing": "post",
        "on_failure": "fail_run",
        "config": {"mode": "loose", "sections": []},
    }


def _post_citations_passing() -> dict:
    """``citations_required`` in ``presence`` mode with ``min_markers: 0``.

    Deterministic PASS with no judge call and no network: the branch counts markers and
    returns ``GateResult(True, None)`` on ``n >= need`` where ``need`` is ``0``. This is
    the kind the plan names for the mixed pre+post row; the mode is chosen so the row
    measures the PRE-side property rather than a post-gate verdict.
    """
    return {
        "kind": "citations_required",
        "timing": "post",
        "on_failure": "fail_run",
        "config": {"mode": "presence", "min_markers": 0},
    }


# The engine's approval label, scripted as an answer. Resolved lazily (import-in-body
# convention) by ``_approve_label()``; the sentinel below is swapped for the real literal
# inside ``_drive`` so the CASES table stays import-free at module scope.
APPROVE = "<<THE ENGINE'S APPROVE LABEL>>"


# ── THE SPACE ────────────────────────────────────────────────────────────────
#
# Each row carries:
#   id                          — the stable parametrize id (named in the RED signature)
#   author_validators           — the AUTHOR's declared set (the engine APPENDS the armed
#                                 spec to it inside ``effective_phase``)
#   answers                     — scripted ``subscribe_for_response`` payloads, consumed
#                                 in CALL ORDER. ``APPROVE`` is substituted for the
#                                 engine's own approve literal at drive time.
#   reaches_body_without_arming — EXPLICIT on every row, no default. "Would control
#                                 reach the executor body if arming did not exist?" This
#                                 is what makes P2 targetable: a row that an author's own
#                                 gate legitimately routes AWAY from the body is not a
#                                 row where a missing armed prompt is a bypass.
#   why                         — the mechanism, in one sentence, for the failure report.
CASES: tuple[dict, ...] = (
    {
        "id": "no_author_validators",
        "author_validators": (),
        "answers": (APPROVE,),
        "reaches_body_without_arming": True,
        "why": (
            "The author declared nothing, so the armed spec effective_phase appends is "
            "the only pre gate. The regression net for the whole property."
        ),
    },
    {
        "id": "pre_ask_user_proceed",
        "author_validators": (_pre_gate("ask_user"),),
        "answers": ("Proceed anyway", APPROVE),
        "reaches_body_without_arming": True,
        "why": (
            "THE KNOWN HEAD BYPASS (SEED-137). run_gates returns the author's failure "
            "FIRST (validators.py:248), the finding is not an action_risk one, so the "
            "ask_user Proceed returns None and harness_engine.py:739 falls through to "
            "the body — the armed gate at the END of the list is never reached and the "
            "person is never asked."
        ),
    },
    {
        "id": "pre_fail_run",
        "author_validators": (_pre_gate("fail_run"),),
        "answers": (APPROVE,),
        "reaches_body_without_arming": False,
        "why": (
            "THE PITFALL-4 SHAPE (T-187-01-05). The author's own gate fails the run "
            "before the body, so no checkpoint is owed. After the hoist, "
            "_failing_on_failure(phase, None) must NOT be allowed to let this author "
            "disposition route the armed checkpoint away — see "
            "pre_pass_fail_run_disposition, which is where that fail-open becomes "
            "observable."
        ),
    },
    {
        "id": "pre_skip_to_phase",
        "author_validators": (_pre_gate("skip_to_phase:done"),),
        "answers": (APPROVE,),
        "reaches_body_without_arming": False,
        "why": (
            "D-187-02: a step an author's gate SKIPS never runs, so approving it would "
            "be approving something that will not happen — and an approval receipt for "
            "a step with no body violates consequence != receipt."
        ),
    },
    {
        "id": "post_only",
        "author_validators": (_post_gate_passing(),),
        "answers": (APPROVE,),
        "reaches_body_without_arming": True,
        "why": (
            "A post gate cannot preempt a pre-body checkpoint — the timing filter skips "
            "it on the pre pass, so the armed gate is the only pre gate."
        ),
    },
    {
        "id": "pre_ask_user_plus_post_citations",
        "author_validators": (_pre_gate("ask_user"), _post_citations_passing()),
        "answers": ("Proceed anyway", APPROVE),
        "reaches_body_without_arming": True,
        "why": (
            "The bypass shape with a post gate also present — proves the bypass is not "
            "an artefact of a single-element author list."
        ),
    },
    {
        "id": "two_pre_ask_user",
        "author_validators": (_pre_gate("ask_user"), _pre_gate("ask_user")),
        "answers": ("Proceed anyway", APPROVE),
        "reaches_body_without_arming": True,
        "why": (
            "Two failing pre ask_user gates: first-failure-wins means only ONE author "
            "prompt fires, and on HEAD its Proceed still reaches the body unarmed."
        ),
    },
    {
        "id": "pre_pass_then_pre_ask_user",
        "author_validators": (_pre_gate("fail_run", passes=True), _pre_gate("ask_user")),
        "answers": ("Proceed anyway", APPROVE),
        "reaches_body_without_arming": True,
        "why": (
            "Permutation coverage: a PASSING pre gate ahead of the failing ask_user one. "
            "The armed spec is at index 2 and is still never reached on HEAD."
        ),
    },
    {
        "id": "pre_pass_fail_run_disposition",
        "author_validators": (_pre_gate("fail_run", passes=True),),
        "answers": (APPROVE,),
        "reaches_body_without_arming": True,
        "why": (
            "THE PITFALL-4 FALSIFICATION (T-187-01-05), added beyond the plan's minimum "
            "space under deviation Rule 2. The author's gate PASSES, so control legitimately "
            "reaches the body and a checkpoint IS owed — but the author declared "
            "on_failure='fail_run'. After the hoist the armed checkpoint has no validator "
            "index, so _failing_on_failure(phase, None) falls back to validators[0] and "
            "would resolve 'fail_run', routing the checkpoint into _route_on_failure with "
            "the person NEVER ASKED. P1 alone cannot see that (the body does not run, so "
            "'body => asked' holds vacuously); P2 can, because this row reaches the body "
            "without arming. The plan's pre_fail_run row cannot serve as this falsification "
            "because its gate FAILS, which legitimately routes away from the body."
        ),
    },
    {
        "id": "armed_refused_typed",
        "author_validators": (),
        # A typed free-text refusal that is NOT the exact approval label AND is not a
        # member of the exact-match deny-list either (the trailing period defeats it) —
        # the T-185-04-01 shape. Only the ALLOW-list can refuse this.
        "answers": ({"kind": "response", "response_text": "Do not run it."},),
        "reaches_body_without_arming": True,
        "why": (
            "P3's row. Phase 185's BLOCKER was a FALSE APPROVAL RECEIPT, not a missing "
            "prompt: the refuser was recorded as the authoriser. The negative assertion "
            "lives here."
        ),
    },
)

CASE_IDS: tuple[str, ...] = tuple(c["id"] for c in CASES)


# ── shared helpers ───────────────────────────────────────────────────────────
def _ctx():
    """The minimal ctx the disposition accepts — ``test_ask_user_disposition.py:66-72``.

    ``supabase=None`` skips the durable-row insert (no DB); ``producer_run_id`` routes the
    ``ask_user_prompt`` emit onto the producer stream, which is the emit this file joins
    to ``subscribe_for_response`` by ``tool_call_id``; ``retry_feedback`` is present
    because ``_clear_retry_feedback`` writes it on a passing gate.
    """
    return SimpleNamespace(
        supabase=None,
        thread_id=None,
        current_user={"id": uuid4()},
        producer_run_id=uuid4(),
        emit=AsyncMock(),
        retry_feedback=None,
    )


def _approve_label() -> str:
    """The engine's ONE approve literal, imported — never re-typed (T-185-04-01)."""
    from app.services.harness_engine import _ACTION_RISK_APPROVE_CHOICE

    return _ACTION_RISK_APPROVE_CHOICE


class _Recorder:
    """One monotonic clock over three observables, so ordering is MEASURED not inferred.

    The three events, each stamped with the same increasing counter:

    * ``prompt``  — an ``ask_user_prompt`` emit: ``(tool_call_id, prompt_text)``
    * ``ask``     — a ``subscribe_for_response`` await: ``(tool_call_id,)``
    * ``body``    — the ``_execute_phase`` spy fired

    ``subscribe_for_response`` is handed only a ``tool_call_id``, never the prompt text,
    so "WHICH prompt was awaited" is resolved by joining the ``ask`` to the ``prompt``
    emitted with the same ``tool_call_id``. That join is what lets the armed prompt be
    identified by ``_approval_sentence``'s output instead of by a hand-written fragment.
    """

    def __init__(self, answers):
        self._n = 0
        self.prompts: dict[str, str] = {}         # tool_call_id -> prompt text
        self.asks: list[tuple[str, int]] = []     # (tool_call_id, order)
        self.body_order: int | None = None
        self.body_invoked = False
        self._answers = list(answers)
        self.answers_consumed = 0
        self.exhausted_asks = 0

    def _tick(self) -> int:
        self._n += 1
        return self._n

    # -- ctx.emit ------------------------------------------------------------
    async def emit(self, redis, stream_id, event, **kw):
        if event == "ask_user_prompt":
            self.prompts[kw.get("tool_call_id")] = kw.get("prompt")
            self._tick()

    # -- app.services.ask_user_service.subscribe_for_response ----------------
    async def subscribe(self, redis, run_id, tool_call_id, timeout):
        self.asks.append((tool_call_id, self._tick()))
        if not self._answers:
            # An unscripted prompt is recorded rather than raising: returning None is the
            # engine's own honest-unanswered path, so the property assertions stay the
            # thing that reports, and an over-asking engine is visible in this counter.
            self.exhausted_asks += 1
            return None
        answer = self._answers.pop(0)
        self.answers_consumed += 1
        if isinstance(answer, dict):
            return answer
        return {"kind": "response", "response_text": answer}

    # -- harness_engine._execute_phase ---------------------------------------
    async def body(self, phase, accumulated, ctx):
        self.body_invoked = True
        self.body_order = self._tick()
        return {"text": "the deliverable"}

    # -- derived -------------------------------------------------------------
    def ask_orders_for(self, prompt_text: str) -> list[int]:
        """The order indexes of the awaits whose prompt was ``prompt_text``."""
        return [
            order
            for tcid, order in self.asks
            if self.prompts.get(tcid) == prompt_text
        ]


def _drive(case: dict):
    """Run ONE case through the REAL ``_run_phase_with_gates`` and return the record.

    Returns ``(outcome, recorder, write_audit, approval_sentence)``.
    """
    from app.models.harness import PhaseSpec, ValidatorSpec
    from app.services import harness_engine
    from app.services.harness.grounding import _approval_sentence, effective_phase

    approve = _approve_label()
    answers = tuple(approve if a == APPROVE else a for a in case["answers"])
    recorder = _Recorder(answers)

    # The RAW author-authored phase: armed, carrying ONLY the author's own set.
    raw = PhaseSpec(
        slug=ARMED_SLUG,
        phase_index=ARMED_PHASE_INDEX,
        name=ARMED_NAME,
        config={"phase_type": "programmatic", "fn": "noop"},
        action_risk_armed=True,
        validators=[ValidatorSpec(**v) for v in case["author_validators"]],
    )
    # THE PHASE THE ENGINE ACTUALLY RUNS (harness_engine.py:1336-1339).
    eff = effective_phase(raw, total_phases=TOTAL_PHASES)
    # THE ARMED PROMPT, from the composer. Never re-typed.
    approval_sentence = _approval_sentence(raw, TOTAL_PHASES)

    ctx = _ctx()
    ctx.emit = AsyncMock(side_effect=recorder.emit)
    write_audit = AsyncMock()

    with patch.object(harness_engine, "_execute_phase", recorder.body), \
         patch.object(harness_engine, "write_audit", write_audit), \
         patch.object(harness_engine, "_emit", AsyncMock()), \
         patch("app.services.ask_user_service.subscribe_for_response",
               AsyncMock(side_effect=recorder.subscribe)):
        outcome = asyncio.run(
            harness_engine._run_phase_with_gates(
                eff, {}, ctx,
                run_id=uuid4(), pool=object(), redis=object(),
                wall_clock=30, _audit_user_id=uuid4(),
            )
        )

    return outcome, recorder, write_audit, approval_sentence


# ── the table itself is part of the contract ─────────────────────────────────
@pytest.mark.parametrize("case", CASES, ids=CASE_IDS)
def test_case_table_is_well_formed(case):
    """Every row declares ``reaches_body_without_arming`` EXPLICITLY and builds.

    No default is permitted on that key: P2 is targeted by it, so a row that forgot to
    state whether control legitimately reaches the body would silently opt itself out of
    the assertion that catches the bypass.
    """
    from app.models.harness import ValidatorSpec

    assert "reaches_body_without_arming" in case, (
        f"{case['id']}: reaches_body_without_arming is not declared — there is no default"
    )
    assert isinstance(case["reaches_body_without_arming"], bool)
    assert case["why"], f"{case['id']}: every row names its mechanism"
    # Every author gate is a REAL registered kind (construction validates the Literal).
    for spec in case["author_validators"]:
        ValidatorSpec(**spec)


def test_the_space_contains_both_known_bypasses():
    """``[pre/ask_user]`` + Proceed AND the Pitfall-4 ``fail_run`` disposition shape."""
    assert "pre_ask_user_proceed" in CASE_IDS
    assert "pre_fail_run" in CASE_IDS
    assert "pre_pass_fail_run_disposition" in CASE_IDS
    assert "armed_refused_typed" in CASE_IDS
    assert len(CASES) >= 9
