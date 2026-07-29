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
def test_arming_adds_no_phase_and_moves_no_phase_index():
    """Criterion 18 / D-185-12. Applied across a 5-phase definition — every phase armed
    — the result is still 5 phases with every ``phase_index`` unchanged, and the source
    definition still has 5. The armed checkpoint is a VALIDATOR, not a step, so nothing
    downstream that reasons about position (the spine, the timeline, skip_to_phase)
    can be shifted by arming."""
    from app.services.harness.grounding import effective_phase

    phases = [
        _agent_phase(slug=f"p{i}", phase_index=i, armed=True, name=f"Step {i}")
        for i in range(5)
    ]
    effective = [effective_phase(p, total_phases=len(phases)) for p in phases]

    assert len(effective) == 5
    assert len(phases) == 5
    assert [p.phase_index for p in effective] == [0, 1, 2, 3, 4]
    assert [p.slug for p in effective] == [f"p{i}" for i in range(5)]

    # Each armed phase gained a timing="pre" approval gate whose disposition is the
    # shipped ask_user pause (D-185-12/13), carrying the engine-generated sentence.
    pre = effective[1].validators[0]
    assert pre.kind == "action_risk_approval"
    assert pre.timing == "pre"
    assert pre.on_failure == "ask_user"
    assert pre.max_retries == 0
    assert pre.config["prompt"].startswith('Step 2 of 5, "Step 1", is about to run.')
    # D-185-14 honesty (SPEC Req 9): position, identity, consequence — never a verdict.
    prompt = pre.config["prompt"]
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
