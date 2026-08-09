"""Phase 185 (GOVERN-01 / GOVERN-03) — the parse-time attachment seam.

SPEC acceptance criteria 9, 10 and 18, plus D-185-05 and the D-14 identity property.

WHAT IS DRIVEN, AND WHY IT IS NOT THE RUN LOOP. These tests drive
``harness.grounding.effective_phase`` DIRECTLY and then run the SHIPPED
``harness.validators.run_gates`` over what it returned. That pairing is the whole
claim: ``run_workflow``'s ``spec_by_slug`` seam is a one-line comprehension over
``effective_phase``, so proving the function's output and proving ``run_gates``'
behaviour over that output proves the enforcement end-to-end without mocking a run
loop whose 400 lines of durable-row / redis / audit plumbing are irrelevant to the
claim (and whose mocks would be the thing under test).

MOCKS: none are needed. ``effective_phase`` is pure (no I/O, no pool, no clock) and
both validator kinds exercised here are total functions of ``(output, config)`` — the
``ctx`` argument is passed as ``None`` throughout and is never read. There is
therefore no network dependency to mock (cf. ``feedback_mock_completeness``: the rule
is *mock every network dep*, and the honest count here is zero). ``asyncio.run`` at
the call, imports inside the test bodies — the ``test_ask_user_disposition.py``
posture.
"""

from __future__ import annotations


# ── fixtures: the two shapes the whole file reasons about ─────────────────────
def _agent_phase(
    *,
    slug: str = "research",
    phase_index: int = 0,
    tools: list[str] | None = None,
    validators: list[dict] | None = None,
    name: str | None = None,
    armed: bool = False,
):
    """An ``llm_agent`` PhaseSpec — the only family detection ever fires on."""
    from app.models.harness import PhaseSpec

    return PhaseSpec(
        slug=slug,
        phase_index=phase_index,
        name=name,
        config={
            "phase_type": "llm_agent",
            "prompt": "Find what changed and say where you read it.",
            "available_tools": ["search_documents"] if tools is None else tools,
        },
        validators=validators or [],
        action_risk_armed=armed,
    )


def _agent_output(text: str, citations: list | None) -> dict:
    """The shape ``_exec_llm_agent`` returns. Note the absence of ``field_map``."""
    return {
        "text": text,
        "sub_run_id": "sub-1",
        "source_refs": [{"doc": "d"}],
        "citations": citations if citations is not None else [],
        "similarity_scores": [0.7],
    }


# ── criterion 9 — a KB tool and NO declared validator still gates ─────────────
def test_detected_step_with_no_declared_validator_gains_the_engine_gate():
    """Criterion 9. A phase carrying ``search_documents`` and ``validators: []`` comes
    back with EXACTLY ONE synthesized ``citations_required`` spec, configured per
    D-185-01 (the new mode) and D-185-04 (retry-with-feedback then fail_run)."""
    from app.services.harness.grounding import effective_phase

    eff = effective_phase(_agent_phase(validators=[]), total_phases=3)

    assert len(eff.validators) == 1
    spec = eff.validators[0]
    assert spec.kind == "citations_required"
    assert spec.config == {"mode": "retrieved_and_cited"}
    assert spec.on_failure == "fail_run"   # D-185-04 — NOT ask_user; 185 ships no run surface
    assert spec.max_retries == 2           # D-185-04 — retry with feedback, twice, then fail
    assert spec.timing == "post"           # the output is what it judges


def test_detected_step_fails_the_gate_on_uncited_output():
    """Criterion 9, second half — the gate that was attached actually BITES. An
    agent-shaped output that retrieved nothing fails, with the retrieval reason."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401 — registration side-effect
    from app.services.harness.grounding import effective_phase
    from app.services.harness.validators import run_gates

    eff = effective_phase(_agent_phase(validators=[]), total_phases=3)
    result = asyncio.run(
        run_gates(eff, _agent_output("Revenue grew.", []), None)
    )

    assert result.passed is False
    assert "nothing was retrieved" in result.error_message
    assert result.validator_index == 0

    # And the same step PASSES once it has really read something and said so — the
    # gate is a bar, not a wall (the positive control for the assertion above).
    ok = asyncio.run(
        run_gates(eff, _agent_output("Revenue grew 4% [1].", [{"chunk_id": "c1"}]), None)
    )
    assert ok.passed is True


# ── criterion 10 — deleting the declared validator removes nothing ────────────
def test_deleting_the_declared_validator_does_not_remove_enforcement():
    """Criterion 10. The SAME fixture with the validator declared in the JSONB and then
    with it deleted produces an IDENTICAL effective validator list. This is the
    already-published-definition case: enforcement is a property of the RUN, not of the
    stored row, so hand-editing the row cannot switch it off."""
    from app.services.harness.grounding import effective_phase

    declared = _agent_phase(
        validators=[{"kind": "citations_required", "config": {"mode": "retrieved_and_cited"},
                     "on_failure": "fail_run", "max_retries": 2, "timing": "post"}]
    )
    deleted = _agent_phase(validators=[])  # the author removed it from the JSONB

    eff_declared = effective_phase(declared, total_phases=3)
    eff_deleted = effective_phase(deleted, total_phases=3)

    # The declared row carries its own spec PLUS the engine's (D-185-05 — never
    # substituted), so compare the ENGINE-supplied tail, which is what enforcement is.
    assert eff_deleted.validators[-1].model_dump() == eff_declared.validators[-1].model_dump()
    assert eff_deleted.validators[-1].kind == "citations_required"
    assert eff_deleted.validators[-1].config == {"mode": "retrieved_and_cited"}

    # The deleted-from-JSONB phase is gated identically to the declared one.
    assert len(eff_deleted.validators) == 1


# ── D-185-05 — both specs run, the author's cannot displace the engine's ──────
def test_a_deliberately_weak_author_spec_cannot_loosen_the_gate():
    """D-185-05 + T-185-03-01. An author who declares the weakest possible
    ``citations_required`` (``presence`` with ``min_markers: 0``, which passes
    anything) gets TWO specs: theirs at index 0, the engine's at index 1. This is
    ALSO the APPEND proof, and therefore the WR-03 retry-seed proof — the engine seeds
    ``phase_max_retries`` from ``validators[0].max_retries``, so a prepend would
    silently rebind the author's bound."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.grounding import effective_phase
    from app.services.harness.validators import run_gates

    weak = {"kind": "citations_required", "config": {"mode": "presence", "min_markers": 0},
            "on_failure": "skip_to_phase:done", "max_retries": 7}
    eff = effective_phase(_agent_phase(validators=[weak]), total_phases=3)

    assert len(eff.validators) == 2
    # THE AUTHOR'S SPEC IS AT INDEX 0 — appended, never prepended.
    assert eff.validators[0].config == {"mode": "presence", "min_markers": 0}
    assert eff.validators[0].max_retries == 7          # the WR-03 seed is untouched
    assert eff.validators[0].on_failure == "skip_to_phase:done"  # their routing survives
    assert eff.validators[1].kind == "citations_required"
    assert eff.validators[1].config == {"mode": "retrieved_and_cited"}

    # The weak spec PASSES (min_markers 0 passes anything) and the run continues to
    # the engine's, which fails — first-failure-wins lands on index 1, not 0.
    result = asyncio.run(run_gates(eff, _agent_output("no markers, no sources", []), None))
    assert result.passed is False
    assert result.validator_index == 1
    assert "nothing was retrieved" in result.error_message


# ── criterion 18 — arming adds no phase ───────────────────────────────────────
#
# RE-SHAPED IN PLAN 187-11, VISIBLY AND WITH THE REASONING RECORDED (D-187-01).
#
# WHAT THIS TEST ASSERTED BEFORE. Criterion 18's substance — arming adds no phase and
# shifts no ``phase_index`` — plus a MECHANISM assertion: that ``effective_phase``
# returned a copy whose ``validators[0]`` was a synthesized ``action_risk_approval``
# spec (``timing="pre"``, ``on_failure="ask_user"``, ``max_retries=0``) carrying the
# approval sentence in its ``config["prompt"]``, and that the sentence obeyed the
# D-185-14 honesty rules.
#
# WHY THE MECHANISM CHANGED. D-187-01: the guarantee is a PROPERTY OF THE PHASE, not a
# position in a list. ``run_gates`` is first-failure-wins and ``effective_phase``
# APPENDS, so the armed spec sat LAST and any author-declared failing pre gate returned
# ahead of it — an ``ask_user`` Proceed then ran the body with nobody asked (SEED-137).
# No ordering rule fixes that, so the approval gate was hoisted out of ``phase.validators``
# entirely into an explicit pre-body checkpoint in ``_run_phase_with_gates``.
# ``effective_phase`` now synthesizes exactly ONE spec — the ``citations_required`` gate a
# DETECTED step earns — and nothing else.
#
# THE SUBSTANCE IS UNCHANGED, AND IS STILL ASSERTED BELOW: five phases in, five phases
# out, every ``phase_index`` and every ``slug`` identical, and the source definition
# untouched. What moved is only HOW arming is represented. The sentence assertions moved
# onto ``grounding._approval_sentence`` DIRECTLY — that is where the honesty rules live,
# and it is how ``test_armed_prompt_is_the_generated_sentence_character_identically``
# already reads them.
#
# WHY THIS IS A RE-SHAPE AND NOT A DELETION. The ROADMAP threat-model item permits a
# visible re-shape with reasoning recorded; it does not permit a silent removal. The
# phase-level armed reading this test used to observe still has TWO independent
# observers in this file — the run-time checkpoint (driven by
# ``test_an_armed_pre_gate_records_a_pause_not_a_failure``) and the boot-time resume
# predicate ``_is_armed_action_risk`` (pinned by
# ``test_the_two_resume_predicates_are_independent`` at the bottom of this file). That
# pair is exactly why D-187-03's "exactly ONE reading of armed survives" was recorded as
# RECONCILED rather than delivered: two survive, deliberately, and they are independent.
def test_arming_adds_no_phase_and_moves_no_phase_index():
    """Criterion 18 / D-185-12. Applied across a 5-phase definition — every phase armed
    — the result is still 5 phases with every ``phase_index`` unchanged, and the source
    definition still has 5. Arming is a PROPERTY of the phase, not a step, so nothing
    downstream that reasons about position (the spine, the timeline, skip_to_phase) can
    be shifted by it."""
    from app.services.harness.grounding import _approval_sentence, effective_phase

    phases = [
        _agent_phase(slug=f"p{i}", phase_index=i, armed=True, name=f"Step {i}")
        for i in range(5)
    ]
    definition = _definition_with(*phases)
    assert len(definition.phases) == 5
    before = [(p.slug, p.phase_index) for p in definition.phases]

    effective = [effective_phase(p, total_phases=len(phases)) for p in phases]

    # ── THE SUBSTANCE: no phase added, no phase_index moved, source untouched ──
    assert len(effective) == 5
    assert len(phases) == 5
    assert len(definition.phases) == 5
    assert [(p.slug, p.phase_index) for p in definition.phases] == before
    assert [p.phase_index for p in effective] == [0, 1, 2, 3, 4]
    assert [p.slug for p in effective] == [f"p{i}" for i in range(5)]

    # ── THE MECHANISM, AS IT IS AFTER THE HOIST ──
    # These phases carry ``search_documents`` (``_agent_phase``'s default), so each one is
    # DETECTED and owes exactly the citations gate — and NOTHING else. Arming contributes
    # no spec at all.
    for eff in effective:
        assert [v.kind for v in eff.validators] == ["citations_required"], (
            f"{eff.slug} came back with {[v.kind for v in eff.validators]} — after "
            f"D-187-01 the only spec effective_phase synthesizes is the citations gate"
        )

    # An armed phase that owes NO citations gate is returned BY REFERENCE — arming alone
    # is now literally nothing to synthesize. (``execute_code`` is not a KB tool.)
    bare_armed = _agent_phase(slug="bare", phase_index=0, armed=True, tools=["execute_code"])
    assert effective_phase(bare_armed, total_phases=5) is bare_armed

    # ── THE SENTENCE, READ FROM ITS ONE AUTHOR ──
    # D-185-14 honesty (SPEC Req 9): position, identity, consequence — never a verdict.
    prompt = _approval_sentence(phases[1], 5)
    assert prompt.startswith('Step 2 of 5, "Step 1", is about to run.')
    assert "waiting" in prompt
    for forbidden in ("approved", "safe", "proven"):
        assert forbidden not in prompt.lower()


# ── the identity return — 'byte-identical when unset', structurally ───────────
def test_an_ungoverned_phase_is_returned_by_reference():
    """D-14. A phase with neither governance field set is handed back AS THE SAME
    OBJECT — ``is``, not ``==``. Reference identity is a strictly stronger proof than
    any deep compare: it makes "the engine changed something for an ungoverned step"
    unrepresentable rather than merely unobserved."""
    from app.models.harness import PhaseSpec
    from app.services.harness.grounding import effective_phase

    # No KB tool, not escalated, not armed -> nothing to synthesize.
    p = _agent_phase(tools=["execute_code"], validators=[])
    assert effective_phase(p, total_phases=1) is p

    # A non-LLM phase type, which carries no available_tools at all.
    prog = PhaseSpec(slug="run", phase_index=0, config={"phase_type": "programmatic", "fn": "noop"})
    assert effective_phase(prog, total_phases=1) is prog

    # A phase with AUTHORED validators and no governance is also untouched — the
    # identity return is about governance, not about being validator-free.
    authored = _agent_phase(
        tools=["execute_code"],
        validators=[{"kind": "regex_match", "config": {"pattern": "x"}}],
    )
    assert effective_phase(authored, total_phases=2) is authored


def test_synthesis_never_mutates_the_parsed_phase():
    """The ``graft_skill_snapshots`` anti-pattern fence. A synthesized spec must never
    be observable to another reader holding the same parsed object, because that object
    is what the save path would serialize. ``model_copy``, never in-place."""
    from app.services.harness.grounding import effective_phase

    p = _agent_phase(validators=[])
    eff = effective_phase(p, total_phases=1)

    assert eff is not p
    assert len(p.validators) == 0          # the ORIGINAL is untouched
    assert len(eff.validators) == 1
    assert "citations_required" not in str(p.model_dump())


# ── the L-2 fence: the synthesis is never a Pydantic model_validator ──────────
def test_grounding_declares_no_model_validator_in_CODE():
    """RESEARCH L-2, asserted against code rather than prose. ``db/workflows.py``
    persists ``model_dump(mode="json")``, so a ``@model_validator(mode="after")`` doing
    this synthesis would bake the gate permanently into the stored JSONB — after which
    removing the KB tool would NOT remove the gate, inverting SPEC Req 3 and
    contradicting D-185-07.

    Comments and string literals are neutralised via ``tokenize`` so the guard reads
    CODE: this module's docstrings DELIBERATELY name ``model_validator`` in the warning
    that explains this very trap, and a naive grep would be satisfied by deleting that
    warning (the D-ITEM-183-02 prose trap). The needle is assembled from parts so it
    never appears literally in this file either.
    """
    import tokenize
    from pathlib import Path

    import app.services.harness.grounding as grounding

    needle = "model" + "_validator"
    path = Path(grounding.__file__)

    with path.open(encoding="utf-8") as fh:
        toks = list(tokenize.generate_tokens(fh.readline))
    code = " ".join(
        '""' if t.type == tokenize.STRING else t.string
        for t in toks
        if t.type != tokenize.COMMENT
    )

    # POSITIVE CONTROL: the extractor is real — it keeps code and drops prose.
    assert "effective_phase" in code, "the code extractor dropped a real symbol"
    assert needle in path.read_text(encoding="utf-8"), (
        "the raw source no longer warns about the trap — the guard would pass vacuously"
    )

    assert needle not in code, (
        f"grounding.py declares a Pydantic {needle} — the synthesis must stay at the "
        f"run seam or it will be persisted into the definition JSONB (L-2 / D-185-07)"
    )


# ═════ plan 185-04 — the ARMED disposition: no timeout, verbatim prompt, ═══════
# ═════ shutdown survives. SPEC Req 9 / criteria 19 and 20.               ═══════
#
# These DO drive ``_resolve_failure_with_ask_user`` (unlike the attachment tests
# above, which are pure), because the claim IS the disposition's behaviour. The
# mock posture is ``test_ask_user_disposition.py``'s: ``subscribe_for_response``
# (the 085 block primitive), ``write_audit`` (the receipt) and — where the durable
# row matters — ``app.utils.db.aexec``. Every network dependency is mocked
# (``feedback_mock_completeness``); ``redis``/``pool`` are opaque objects the helper
# only forwards.


def _armed_effective_phase(*, total_phases: int = 4, index: int = 1, label: str = "Send the renewal notice"):
    """The phase as the ENGINE sees it: run the real synthesis so the phase under test is
    the real effective one, never a hand-built twin that could drift.

    ``execute_code`` (not a KB tool) keeps the citation gate off. Before D-187-01 that
    made ``validators[0]`` unambiguously the armed pre-gate; after the hoist there is no
    armed spec at all, so ``effective_phase`` returns this phase BY REFERENCE with an
    empty validator list — and the armed prompt is composed by ``_armed_finding`` below
    rather than read out of a spec's ``config``."""
    from app.services.harness.grounding import effective_phase

    authored = _agent_phase(
        slug="send-notice", phase_index=index, name=label,
        tools=["execute_code"], validators=[], armed=True,
    )
    return authored, effective_phase(authored, total_phases=total_phases)


def _armed_finding(phase, total_phases: int = 4) -> str:
    """The finding string the HOISTED checkpoint sends into
    ``_resolve_failure_with_ask_user`` — the engine's own wire format (D-187-01).

    This replaces the pre-187 idiom ``"action_risk:approval|" +
    eff.validators[0].config["prompt"]``, which read the sentence out of a synthesized
    spec that no longer exists. Both halves are taken from the engine so neither can
    drift: the prefix from ``_ACTION_RISK_FINDING_PREFIX`` (retained as a WIRE FORMAT —
    the helper's DELTA 1 still splits the person's prompt back out of it on ``"|"``), and
    the sentence from ``grounding._approval_sentence``, its one author.

    The checkpoint's own call site (``harness_engine.py``, the block keyed on
    ``phase.action_risk_armed``) composes exactly this.
    """
    from app.services.harness.grounding import _approval_sentence
    from app.services.harness_engine import _ACTION_RISK_FINDING_PREFIX

    return _ACTION_RISK_FINDING_PREFIX + _approval_sentence(phase, total_phases)


def _armed_ctx(*, supabase=None, thread_id=None):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from uuid import uuid4

    return SimpleNamespace(
        supabase=supabase, thread_id=thread_id, current_user={"id": uuid4()},
        producer_run_id=uuid4(), emit=AsyncMock(),
    )


def test_armed_gate_subscribes_with_no_timeout_at_all():
    """SPEC Req 9, the indefinite-wait proof. ``subscribe_for_response`` is awaited with
    ``None`` as its fourth argument for an armed checkpoint — not a big float, not 0 —
    which is what makes "no answer" mean "the run never proceeds" rather than "the run
    advances in N seconds". The freshness gate in the same file still gets a ``float``,
    which is what proves the change did not widen past armed checkpoints."""
    import asyncio
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    from app.services import harness_engine

    authored, eff = _armed_effective_phase()
    # D-187-01: the armed treatment is REQUESTED by the caller (is_action_risk=True),
    # never sniffed out of the finding, and the checkpoint has no validator index.
    finding = _armed_finding(authored)
    subscribe = AsyncMock(return_value={"kind": "response", "response_text": "Approve this step"})

    with patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                eff, finding, 0, None,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_armed_ctx(),
                _audit_user_id=uuid4(), is_pre=True, is_action_risk=True,
            )
        )

    args, _kwargs = subscribe.await_args
    assert args[3] is None, f"armed gate subscribed with {args[3]!r}, not an indefinite wait"

    # ── the NON-ARMED control, same file, same mock: still a float ──
    from app.models.harness import PhaseSpec, ValidatorSpec

    fresh = PhaseSpec(
        slug="p", phase_index=0,
        config={"phase_type": "programmatic", "fn": "noop"},
        validators=[ValidatorSpec(kind="freshness", timing="pre", on_failure="ask_user")],
    )
    subscribe2 = AsyncMock(return_value={"kind": "response", "response_text": "Proceed anyway"})
    with patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe2):
        asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                fresh, "freshness:staleness|400d old", 0, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_armed_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )
    args2, _ = subscribe2.await_args
    assert isinstance(args2[3], float), "the freshness gate's clamped timeout changed"


def test_criterion_19_unanswered_armed_gate_does_not_advance_the_run():
    """CRITERION 19. With the checkpoint SET and ``subscribe_for_response`` returning
    ``None``, the helper returns a ``fail_run`` outcome — crucially NOT ``None``, which
    on a pre-gate is the signal "run the body". The body never runs, so the run does not
    advance to the next phase; in the canonical example the email is not sent."""
    import asyncio
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    from app.services import harness_engine

    authored, eff = _armed_effective_phase()
    finding = _armed_finding(authored)
    write_audit = AsyncMock()

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch("app.services.ask_user_service.subscribe_for_response",
               AsyncMock(return_value=None)):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                eff, finding, 0, None,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_armed_ctx(),
                _audit_user_id=uuid4(), is_pre=True, is_action_risk=True,
            )
        )

    assert outcome is not None, "the pre-gate caller would have RUN THE BODY"
    assert outcome.kind == "fail_run"
    assert write_audit.await_count == 0  # nothing was approved


def test_armed_prompt_is_the_generated_sentence_character_identically():
    """D-185-14. The prompt handed to the person is the sentence
    ``grounding._approval_sentence`` composed — VERBATIM. Not wrapped in "A validation
    check on phase 'X' flagged: …", not prefixed, not truncated. The expected string is
    built by CALLING the composer, so this assertion cannot drift from the composer and
    plan 185-05 can assert against the same value."""
    import asyncio
    from unittest.mock import AsyncMock, MagicMock, patch
    from uuid import uuid4

    from app.services import harness_engine
    from app.services.harness.grounding import _approval_sentence

    authored, eff = _armed_effective_phase(total_phases=4, index=1)
    expected = _approval_sentence(authored, 4)
    finding = _armed_finding(authored)

    supabase = MagicMock()
    ctx = _armed_ctx(supabase=supabase, thread_id=uuid4())

    with patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch("app.utils.db.aexec", AsyncMock()), \
         patch("app.services.ask_user_service.subscribe_for_response",
               AsyncMock(return_value={"kind": "response", "response_text": "Do not run it"})):
        asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                eff, finding, 0, None,
                run_id=uuid4(), pool=object(), redis=object(), ctx=ctx,
                _audit_user_id=uuid4(), is_pre=True, is_action_risk=True,
            )
        )

    # The SSE the frontend renders.
    emitted = ctx.emit.await_args.kwargs
    assert emitted["prompt"] == expected
    # And the durable row /pending replays.
    row = supabase.table.return_value.insert.call_args[0][0]
    assert row["content"] == expected
    assert row["tool_calls"][0]["prompt"] == expected

    # Sanity: the generic validation-flagged wrapper is nowhere near it.
    assert "A validation check on phase" not in expected
    assert expected.startswith('Step 2 of 4, "Send the renewal notice", is about to run.')


def test_armed_prompt_and_row_carry_a_null_deadline_never_zero():
    """L-15. Both the ``ask_user_prompt`` emit and the durable prompt row carry
    ``timeout_seconds = None``. ``0`` would be catastrophic rather than merely wrong:
    ``PendingAskCard`` counts a null/zero deadline down to EXPIRED and renders "No
    response within 0:00 — agent stopped", so every armed prompt would appear dead the
    instant it appeared — G-4 scenario 3's named failure, shipped by the fix meant to
    prevent it. Plan 185-05 teaches the card to read ``None`` as "no deadline"; sending
    ``None`` is this plan's half."""
    import asyncio
    from unittest.mock import AsyncMock, MagicMock, patch
    from uuid import uuid4

    from app.services import harness_engine

    authored, eff = _armed_effective_phase()
    finding = _armed_finding(authored)
    supabase = MagicMock()
    ctx = _armed_ctx(supabase=supabase, thread_id=uuid4())

    with patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch("app.utils.db.aexec", AsyncMock()), \
         patch("app.services.ask_user_service.subscribe_for_response",
               AsyncMock(return_value={"kind": "response", "response_text": "Do not run it"})):
        asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                eff, finding, 0, None,
                run_id=uuid4(), pool=object(), redis=object(), ctx=ctx,
                _audit_user_id=uuid4(), is_pre=True, is_action_risk=True,
            )
        )

    emitted = ctx.emit.await_args.kwargs
    assert emitted["timeout_seconds"] is None
    assert emitted["timeout_seconds"] != 0  # explicit: the value that renders EXPIRED

    tool_call = supabase.table.return_value.insert.call_args[0][0]["tool_calls"][0]
    assert tool_call["timeout_seconds"] is None
    assert tool_call["options"] == ["Approve this step", "Do not run it"]


def test_shutdown_mid_wait_leaves_an_armed_run_resumable():
    """L-6 / G-4 scenario 3. A ``{"kind": "shutdown"}`` payload is NOT a decision. It
    arrives only from ``main.py``'s graceful-drain broadcast, and today it computes
    ``choice = ""`` → ``_is_abort_choice("")`` → the run is FAILED by a routine deploy.
    The armed gate now escapes via ``asyncio.CancelledError`` (the shipped 096-09
    precedent), which leaves the phase ``active`` and the durable prompt row alive for
    the boot-time resume sweep — a deploy no longer destroys a run parked on a person."""
    import asyncio
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    import pytest

    from app.services import harness_engine

    authored, eff = _armed_effective_phase()
    finding = _armed_finding(authored)

    with patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch("app.services.ask_user_service.subscribe_for_response",
               AsyncMock(return_value={"kind": "shutdown"})):
        with pytest.raises(asyncio.CancelledError):
            asyncio.run(
                harness_engine._resolve_failure_with_ask_user(
                    eff, finding, 0, None,
                    run_id=uuid4(), pool=object(), redis=object(), ctx=_armed_ctx(),
                    _audit_user_id=uuid4(), is_pre=True, is_action_risk=True,
                )
            )


def test_shutdown_on_a_NON_armed_gate_still_fails_the_run():
    """THE UNCHANGED-PATH CONTROL, and the whole point of guarding delta 3 with the
    predicate. The freshness gate has the identical destructive-on-deploy behaviour, but
    SPEC Req 9 and §Out-of-scope both scope the fail-closed change to armed checkpoints
    ONLY, and no D-185-NN decision authorises widening it. So a shutdown on a freshness
    gate must STILL return ``fail_run`` — byte-for-byte today's path. If this test ever
    goes green-by-raising, the fix has silently widened past its authorisation.
    (The freshness twin is a recorded deferred item with a re-open trigger.)"""
    import asyncio
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    from app.models.harness import PhaseSpec, ValidatorSpec
    from app.services import harness_engine

    fresh = PhaseSpec(
        slug="p", phase_index=0,
        config={"phase_type": "programmatic", "fn": "noop"},
        validators=[ValidatorSpec(kind="freshness", timing="pre", on_failure="ask_user")],
    )

    with patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch("app.services.ask_user_service.subscribe_for_response",
               AsyncMock(return_value={"kind": "shutdown"})):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                fresh, "freshness:staleness|400d old", 0, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_armed_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )

    assert outcome is not None
    assert outcome.kind == "fail_run"
    assert "aborted" in (outcome.reason or "").lower()


def test_criterion_20_exec_llm_human_input_is_untouched():
    """CRITERION 20 / D-14. ``_exec_llm_human_input`` keeps its CLAMPED timeout and its
    NORMAL return — the unarmed human-input step behaves exactly as it did yesterday.

    Asserted against the function's own source rather than against ``git diff``, so the
    fence survives the commit that introduces it: the shipped clamp and the shipped
    ``float()`` cast must still be there, and no Phase-185 armed vocabulary may have
    leaked in. SPEC Req 9's third bullet also lives here — the unarmed copy must never
    claim the run waits; that wording belongs to the armed checkpoint alone."""
    import inspect

    from app.services.harness.phase_types import _exec_llm_human_input

    src = inspect.getsource(_exec_llm_human_input)

    # The shipped disposition, intact.
    assert "settings.ask_user_max_timeout_seconds" in src
    assert "float(timeout_seconds)" in src
    assert 'answer = ""' in src

    # No armed-checkpoint machinery leaked into the unarmed path.
    for leaked in ("action_risk", "is_action_risk", "timeout_seconds = None"):
        assert leaked not in src, f"{leaked!r} leaked into _exec_llm_human_input"

    # Req 9 third bullet: the unarmed surface never claims the run waits.
    assert "waiting here and will not continue" not in src


# ═════ plan 185-05 Task 1 — WAITING IS NOT FAILING (RESEARCH L-5) ═════════════
#
# The pre-gate pass in ``_run_phase_with_gates`` announced ``gate_failed`` (audit
# row + SSE) BEFORE handing control to the disposition that pauses. For an armed
# checkpoint that is a lie the ledger tells about itself: nothing failed, the
# author simply said a person decides first. These tests drive the REAL
# ``_run_phase_with_gates`` pre-gate block with ``run_gates`` faked to fail, and
# assert over the audit + emit mocks. ``_resolve_failure_with_ask_user`` is
# stubbed to a terminal outcome so the function returns immediately after the
# block under test (the disposition itself is covered by the 185-04 tests above).


def _drive_failing_pre_gate(finding: str):
    """Run the pre-gate block with ``run_gates`` failing on ``finding``.

    Returns ``(write_audit_mock, emit_mock)``. Every network dependency is mocked:
    ``write_audit`` (Postgres), ``_emit`` (Redis XADD), ``run_gates`` (the gate
    fan-in) and the disposition helper. ``pool``/``redis`` are opaque objects the
    block only forwards.
    """
    import asyncio
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    from app.services import harness_engine
    from app.services.harness.validators import GateResult

    _authored, eff = _armed_effective_phase()
    write_audit = AsyncMock()
    emit = AsyncMock()

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch.object(harness_engine, "_emit", emit), \
         patch("app.services.harness.validators.run_gates",
               AsyncMock(return_value=GateResult(False, finding, 0))), \
         patch.object(
             harness_engine, "_resolve_failure_with_ask_user",
             AsyncMock(return_value=harness_engine.PhaseOutcome(
                 "fail_run", None, None, "stub — the disposition is tested above")),
         ):
        asyncio.run(
            harness_engine._run_phase_with_gates(
                eff, {}, _armed_ctx(),
                run_id=uuid4(), pool=object(), redis=object(),
                wall_clock=60, _audit_user_id=uuid4(),
            )
        )
    return write_audit, emit


def _drive_armed_checkpoint(*, total_phases: int = 4):
    """Phase 187 (D-187-01) — run the HOISTED armed checkpoint and return
    ``(write_audit_mock, emit_mock)``.

    THE ENTRY POINT MOVED, WHICH IS WHY THIS EXISTS. Before the hoist an armed step
    reached the pause through a FAILING pre gate — the armed spec was a member of
    ``phase.validators``, ``run_gates`` returned its ``action_risk:approval|`` finding, and
    the sibling ``_drive_failing_pre_gate`` below reproduced that by patching ``run_gates``
    to fail. After D-187-01 no member of ``phase.validators`` is ever the armed one, so
    that drive can no longer reach the checkpoint at all. An armed phase now reaches the
    pause through ``_run_phase_with_gates``'s EXPLICIT pre-body checkpoint, which fires
    on ``phase.action_risk_armed`` AFTER the pre-gate pass has passed.

    So this driver does the opposite of its sibling: it lets the pre-gate pass PASS (the
    effective armed phase carries no validators at all, so the real ``run_gates`` returns
    a passing result with no patch — the ``timing`` filter and the empty-list path run for
    real) and the checkpoint is what fires. ``_resolve_failure_with_ask_user`` is stubbed
    to a terminal outcome so the function returns immediately after the block under test;
    the disposition itself is covered by the 185-04 tests above, and the stub also keeps
    the executor body from ever running.

    ``_drive_failing_pre_gate`` below is left EXACTLY as it shipped — it is still the
    correct drive for an AUTHOR's failing pre gate, which is what
    ``test_a_freshness_pre_gate_still_fails_exactly_as_it_shipped`` measures.
    """
    import asyncio
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    from app.services import harness_engine

    _authored, eff = _armed_effective_phase(total_phases=total_phases)
    assert list(eff.validators) == [], (
        "the armed effective phase carries a validator — after D-187-01 arming "
        "synthesizes no spec, and this drive's passing pre-gate assumption is broken"
    )
    write_audit = AsyncMock()
    emit = AsyncMock()

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch.object(harness_engine, "_emit", emit), \
         patch.object(
             harness_engine, "_resolve_failure_with_ask_user",
             AsyncMock(return_value=harness_engine.PhaseOutcome(
                 "fail_run", None, None, "stub — the disposition is tested above")),
         ):
        asyncio.run(
            harness_engine._run_phase_with_gates(
                eff, {}, _armed_ctx(),
                run_id=uuid4(), pool=object(), redis=object(),
                wall_clock=60, _audit_user_id=uuid4(), total_phases=total_phases,
            )
        )
    return write_audit, emit


def _audit_event_types(write_audit) -> list[str]:
    return [c.kwargs.get("event_type") for c in write_audit.await_args_list]


def _emitted_event_names(emit) -> list[str]:
    # ``_emit(redis, run_id, type, **fields)`` — the event name is positional #3.
    return [c.args[2] for c in emit.await_args_list if len(c.args) >= 3]


def test_an_armed_pre_gate_records_a_pause_not_a_failure():
    """L-5, the ledger half. An armed checkpoint about to wait writes EXACTLY ONE
    audit row, under ``action_risk_pending`` — and ZERO ``gate_failed`` rows. The
    metadata carries the phase and the timing, never the raw finding: the finding IS
    the person's prompt sentence, and the ledger's job here is the consequence (the
    run paused), not the message (T-185-05-04).

    D-187-01 moved the ENTRY POINT, not the claim: the pause is now announced by the
    explicit pre-body checkpoint rather than by a failing armed pre-gate, so this drives
    ``_drive_armed_checkpoint``. Every assertion below is the one that shipped."""
    write_audit, _emit = _drive_armed_checkpoint()

    types = _audit_event_types(write_audit)
    assert types == ["action_risk_pending"], f"the armed pause wrote {types}"
    assert "gate_failed" not in types

    meta = write_audit.await_args_list[0].kwargs["metadata"]
    assert meta == {"phase": "send-notice", "timing": "pre"}
    assert "action_risk:approval|" not in str(meta)


def test_an_armed_pre_gate_never_announces_gate_failed_to_the_frontend():
    """L-5, the SSE half. The producer stream sees ``action_risk_pending`` and NEVER
    ``gate_failed`` — the frontend's shipped ``gate_failed`` handler renders a problem,
    and a step that is merely waiting is not one. The payload carries ``phase`` only;
    the sentence the person reads rides the ``ask_user_prompt`` emit (D-185-13).

    D-187-01 moved the ENTRY POINT, not the claim — see the sibling above."""
    _write_audit, emit = _drive_armed_checkpoint()

    names = _emitted_event_names(emit)
    assert names == ["action_risk_pending"], f"the armed pause emitted {names}"
    assert "gate_failed" not in names

    fields = emit.await_args_list[0].kwargs
    assert fields == {"phase": "send-notice"}


def test_a_freshness_pre_gate_still_fails_exactly_as_it_shipped():
    """THE BYTE-IDENTITY CONTROL, and the reason the branch is guarded by the finding
    predicate rather than applied to the whole block. A non-armed pre-gate failure
    still writes ``gate_failed`` with its attempt/error/timing metadata and still emits
    ``gate_failed`` with attempt + error. If this ever goes green-by-renaming, the L-5
    fix has silently moved another gate's vocabulary."""
    write_audit, emit = _drive_failing_pre_gate("freshness:staleness|400d old")

    assert _audit_event_types(write_audit) == ["gate_failed"]
    assert write_audit.await_args_list[0].kwargs["metadata"] == {
        "phase": "send-notice", "attempt": 0,
        "error": "freshness:staleness|400d old", "timing": "pre",
    }

    assert _emitted_event_names(emit) == ["gate_failed"]
    assert emit.await_args_list[0].kwargs == {
        "phase": "send-notice", "attempt": 0,
        "error": "freshness:staleness|400d old",
    }
    assert "action_risk_pending" not in _emitted_event_names(emit)


# ═════ plan 185-05 Task 2 — the resume sweep re-subscribes the SAME prompt ════
#
# RESEARCH L-7. ``resume_stranded_workflows`` gates its re-subscribe branch on
# ``_is_llm_human_input(active)``, which is False for an armed ``llm_agent``: its
# stored config type is ``llm_agent`` and its output was never persisted. The run
# was still re-driven and re-asked (fail-closed) — but with a NEW ``tool_call_id``,
# while the OLD durable row is never expired on the graceful-shutdown path. The
# card the person is looking at then belongs to nobody. Fix (a): re-subscribe the
# SAME id, indefinitely.


def _armed_active_row(slug: str = "send-notice") -> dict:
    """The ``workflow_phases`` row an armed step parked on its pre-gate leaves behind.

    THE EXACT SHAPE ``_is_llm_human_input`` RETURNS FALSE FOR: ``phase_type`` is
    ``llm_agent`` (arming is a validator, never a step) and there is no stored
    ``output``, because the phase never completed.
    """
    return {
        "id": "wp-1", "slug": slug, "phase_index": 1, "status": "active",
        "output": None, "config": {"phase_type": "llm_agent"},
    }


def _definition_with(*phases):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition(
        slug="renewals", name="Renewals", version=1, phases=list(phases),
    )


def test_the_two_resume_predicates_are_independent():
    """The armed row is invisible to ``_is_llm_human_input`` and visible to
    ``_is_armed_action_risk`` — which is the whole reason the second predicate exists
    rather than the first being widened. ``_is_llm_human_input`` is a correct predicate
    about a DIFFERENT thing and stays untouched."""
    from app.services import harness_engine

    active = _armed_active_row()
    armed_spec = _agent_phase(slug="send-notice", phase_index=1, tools=["execute_code"], armed=True)
    definition = _definition_with(armed_spec)

    assert harness_engine._is_llm_human_input(active) is False
    assert harness_engine._is_armed_action_risk(active, definition) is True

    # And an UNARMED agent step with the same row shape is False for both.
    unarmed = _definition_with(
        _agent_phase(slug="send-notice", phase_index=1, tools=["execute_code"], armed=False)
    )
    assert harness_engine._is_armed_action_risk(active, unarmed) is False
    # A definition that no longer carries the slug, and a missing definition.
    assert harness_engine._is_armed_action_risk(active, _definition_with(
        _agent_phase(slug="other", phase_index=0))) is False
    assert harness_engine._is_armed_action_risk(active, None) is False


def _drive_resume_sweep(active_row: dict, definition, pending: dict | None):
    """Run ``resume_stranded_workflows`` over ONE stranded run with everything mocked.

    Explicit mocks for every network dependency: the four ``db.workflows`` reads, the
    ``ask_user_service`` re-subscribe, the resume ctx build, the re-drive and the
    prompt-expiry finalizer. Returns the ``resume_pending_prompt`` mock.
    """
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    from app.services import harness_engine

    run_id = uuid4()
    resume_prompt = AsyncMock(return_value={"kind": "response", "response_text": "x"})

    with patch.object(harness_engine, "find_resumable_runs",
                      AsyncMock(return_value=[{"run_id": run_id, "thread_id": uuid4()}])), \
         patch.object(harness_engine, "claim_run", AsyncMock(return_value=True)), \
         patch.object(harness_engine, "get_active_phase", AsyncMock(return_value=active_row)), \
         patch.object(harness_engine, "_load_run_definition", AsyncMock(return_value=definition)), \
         patch.object(harness_engine, "get_pending_ask_user", AsyncMock(return_value=pending)), \
         patch.object(harness_engine, "ask_user_response_exists", AsyncMock(return_value=False)), \
         patch.object(harness_engine, "resume_pending_prompt", resume_prompt), \
         patch.object(harness_engine, "_build_resume_context",
                      AsyncMock(return_value=SimpleNamespace(producer_run_id=None, org_id=None))), \
         patch.object(harness_engine, "_resume_run", AsyncMock()), \
         patch.object(harness_engine, "_expire_pending_ask_user", AsyncMock()):
        asyncio.run(harness_engine.resume_stranded_workflows(pool=object(), redis=object()))

    return resume_prompt


def test_a_restart_re_subscribes_the_armed_prompt_with_no_deadline():
    """L-7 / G-4 scenario 3, both halves. The sweep re-subscribes the SAME
    ``tool_call_id`` the durable row carries — so the card the person is looking at is
    still the one the run is listening to — and it does so with ``timeout_seconds=None``,
    so the restart does not quietly re-introduce a deadline the arming removed."""
    armed = _agent_phase(slug="send-notice", phase_index=1, tools=["execute_code"], armed=True)
    pending = {
        "tool_call_id": "tc-armed-1",
        "prompt": 'Step 2 of 4, "Send the renewal notice", is about to run.',
        "options": ["Approve this step", "Do not run it"],
        "timeout_seconds": None,
    }

    resume_prompt = _drive_resume_sweep(_armed_active_row(), _definition_with(armed), pending)

    assert resume_prompt.await_count == 1
    args, _kwargs = resume_prompt.await_args
    assert args[2] == "tc-armed-1", "the resumed prompt is a DIFFERENT one — orphaned card"
    assert args[5] is None, f"the restart re-introduced a {args[5]!r}s deadline"
    assert args[4] == ["Approve this step", "Do not run it"]


def test_an_armed_phase_with_no_durable_prompt_row_falls_through_unchanged():
    """The crash-before-the-insert edge. Nothing to re-subscribe → no call, and the
    ordinary re-drive runs: the pre-gate re-attaches and re-asks. Fail-closed either
    way — the run never advances without an answer."""
    armed = _agent_phase(slug="send-notice", phase_index=1, tools=["execute_code"], armed=True)

    resume_prompt = _drive_resume_sweep(_armed_active_row(), _definition_with(armed), None)

    assert resume_prompt.await_count == 0


def test_an_llm_human_input_resume_still_uses_its_original_timeout():
    """THE BYTE-IDENTITY CONTROL. A plain ``llm_human_input`` step takes the ORIGINAL
    step-2 branch with the durable row's own ``timeout_seconds`` — the armed branch must
    not capture it (it is guarded by ``not _is_llm_human_input(active)``), and its
    disposition is explicitly out of scope (SPEC Req 9)."""
    human_row = {
        "id": "wp-2", "slug": "ask-them", "phase_index": 1, "status": "active",
        "output": {"tool_call_id": "tc-human-1"},
        "config": {"phase_type": "llm_human_input"},
    }
    pending = {
        "tool_call_id": "tc-human-1", "prompt": "Which dataset?",
        "options": ["a", "b"], "timeout_seconds": 300,
    }
    # An ARMED definition for the same slug, to prove the guard order: even here the
    # llm_human_input branch wins and the armed branch never fires.
    armed = _agent_phase(slug="ask-them", phase_index=1, tools=["execute_code"], armed=True)

    resume_prompt = _drive_resume_sweep(human_row, _definition_with(armed), pending)

    assert resume_prompt.await_count == 1, "the armed branch stole an llm_human_input resume"
    args, _kwargs = resume_prompt.await_args
    assert args[2] == "tc-human-1"
    assert args[5] == 300, f"the shipped resume timeout became {args[5]!r}"
