"""Phase 214 plan 05 (STEP-03 / D-214-09 / D-214-10 / D-214-11 / D-214-12) — PUBLISH REFUSES
A STEP WHOSE REQUIRED ARGUMENT NOTHING CAN SUPPLY, AND NAMES BOTH.

`BUG-260826-02`: the publish gauntlet drove a REAL golden run over a `send_email` step that
could never receive a recipient, and passed it — because D-16 suppresses the SEND during a
golden run, so the one thing that would have noticed never executed. `_KNOWN_RUN_INPUT_KEYS`
(`reachability.py`) is the other half: an adapter's required arguments are not `input_keys`,
so the structural lint had nothing to say about them either.

⭐ THE GATE IS HONEST ONLY BECAUSE IT CALLS THE SAME PREDICATE THE EXECUTOR RESOLVES WITH
(D-214-00). Two copies would publish a workflow that then fails at the send, which is the bug
restated one level up. So this suite's headline case — `test_the_gate_and_the_resolver_agree`
— mocks NEITHER side, and its docstring states the one thing it is structurally incapable of
proving.

CONVENTION (Phase 102 posture, inherited): imports INSIDE the test bodies; plain sync tests
wherever the surface is pure. ⚠ NOTHING HERE TOUCHES POSTGRES — the publish cases drive the
shipped injected seams (`get_definition` / `write_audit` / `_drive_golden_run`), exactly as
`test_publish_service.py` does, because worktrees isolate files and not databases.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

_CONN = "11111111-2222-3333-4444-555555555555"


# ── fixture builders ──────────────────────────────────────────────────────────


def _definition(*phases, inputs=None, name="Arg Gate Workflow") -> dict:
    """A lint-clean definition wrapping the given phase dicts."""
    out = {
        "slug": "arg-gate",
        "version": 1,
        "name": name,
        "status": "draft",
        "phases": list(phases),
        "business_requirement": "Tell the customer their renewal is due.",
    }
    if inputs is not None:
        out["inputs"] = inputs
    return out


def _email_phase(index=0, slug="notify", name="Notify the customer", **config) -> dict:
    cfg = {"phase_type": "external_action", "capability": "send_email"}
    cfg.update(config)
    return {
        "slug": slug,
        "phase_index": index,
        "name": name,
        "config": cfg,
        "validators": [],
    }


def _mcp_phase(index=0, slug="lookup", name="Look it up", tool="read_wiki", **config) -> dict:
    cfg = {
        "phase_type": "external_action",
        "tool_name": tool,
        "connection_id": _CONN,
    }
    cfg.update(config)
    return {
        "slug": slug,
        "phase_index": index,
        "name": name,
        "config": cfg,
        "validators": [],
    }


def _llm_phase(index, slug, name="Draft it") -> dict:
    return {
        "slug": slug,
        "phase_index": index,
        "name": name,
        "config": {"phase_type": "llm_single", "prompt": "draft something"},
        "validators": [],
    }


def _lint(definition_dict, **kwargs):
    from app.models.harness import WorkflowDefinition
    from app.services.harness.reachability import lint_workflow

    return lint_workflow(WorkflowDefinition.model_validate(definition_dict), **kwargs)


def _codes(errors) -> list[str]:
    return [e.code for e in errors]


# ══ 1 · THE FIVE REFUSAL KINDS, ONE CASE EACH ════════════════════════════════


def test_no_source_names_the_step_and_the_argument():
    """`no_source` — the author has bound `send_email` and supplied nothing.

    ⭐ THIS IS `BUG-260826-02`'s OWN SHAPE. `smtp_adapter.INPUT_SCHEMA` requires
    `to` / `subject` / `body`; a step with an empty `tool_args` publishes today and dies at
    the send with `the 'to' recipient must be a string, got NoneType`.
    """
    errors = _lint(_definition(_email_phase()))

    gaps = [e for e in errors if e.code == "no_source"]
    assert {e.argument for e in gaps} == {"to", "subject"}, (
        f"expected a gap for each unsupplied required argument, got {_codes(errors)!r} "
        f"/ {[e.argument for e in errors]!r}"
    )
    for e in gaps:
        assert e.phase_slug == "notify"
        assert e.step_name == "Notify the customer"
        assert e.upstream is None
        # The DIAGNOSTIC names both facts too — it is what an operator reads out of
        # `harness_audit.metadata.named_failures` months later.
        assert "Notify the customer" in e.message
        assert e.argument in e.message


def test_the_body_argument_is_exempt_from_no_source_and_only_from_that():
    """D-214-03 — `body` is auto-filled from the upstream text, so refusing it would refuse a
    step that CAN in fact send: D-214-00's drift pointing the direction that costs an author a
    working workflow.

    The positive control is the case above: `to` and `subject` DO produce gaps on the very
    same phase, so this is an exemption for one named field and not a silent pass for all.
    """
    errors = _lint(_definition(_email_phase()))

    assert "body" not in {e.argument for e in errors}, (
        f"the capability's body argument was reported unsourced: {[e.argument for e in errors]!r}"
    )
    assert {e.argument for e in errors} == {"to", "subject"}


def test_the_body_argument_map_equals_the_executors_map():
    """⭐ THE MECHANICAL AGREEMENT. `reachability` holds a SECOND SPELLING of
    `phase_types._BODY_ARG_FOR_CAPABILITY`, because that map sits beside a module-scope assert
    closing over harness-engine names and this module must stay import-light for `/validate`.

    Two spellings of one closed fact are unavoidable here; an UNCHECKED second spelling is
    not. Same mechanism `models/harness.py` records for `ArgumentSourceKind` and for the
    capability `Literal`.
    """
    from app.services.harness import phase_types, reachability

    assert (
        reachability._BODY_ARGUMENT_FOR_CAPABILITY
        == phase_types._BODY_ARG_FOR_CAPABILITY
    ), (
        "the publish gate's body-argument map has drifted from the executor's. The gate would "
        "then exempt a different field than the executor auto-fills — refusing a step that can "
        "send, or passing one that cannot."
    )


def test_ask_undeclared_when_no_launcher_declares_the_key():
    """⭐ `BUG-260826-01`'s own shape: a declared intention no launcher can honour.

    D-214-09 proves the `ask` arm on ITS OWN terms — the key must be declared in
    `WorkflowDefinition.inputs[]`, so a form can actually render it. A chosen arm is not
    enough, and this gate exists because that exact shape shipped once already.
    """
    phase = _email_phase(
        arg_sources={
            "to": {"source": "ask", "ask_key": "recipient"},
            "subject": {"source": "fixed"},
        },
        tool_args={"subject": "Your renewal is due"},
    )

    # (a) nothing declared -> refused, naming the ARGUMENT (not the ask_key: the author reads
    #     the vendor's argument name on the form).
    errors = _lint(_definition(phase))
    asked = [e for e in errors if e.code == "ask_undeclared"]
    assert len(asked) == 1, f"expected exactly one ask_undeclared, got {_codes(errors)!r}"
    assert asked[0].argument == "to"
    assert asked[0].step_name == "Notify the customer"

    # (b) THE POSITIVE CONTROL — declare it and the same definition lints clean. Without this
    #     half the case above would also pass if the `ask` arm always failed.
    declared = _lint(
        _definition(
            phase,
            inputs=[{"key": "recipient", "label": "Who to email", "type": "text"}],
        )
    )
    assert _codes(declared) == [], f"a declared ask key still refused: {declared!r}"


def test_upstream_unreachable_names_the_step_that_does_not_run_first():
    """D-214-09's `upstream` arm — the named phase must EXIST and be UPSTREAM.

    The predicate is the `produced` accumulator `_check_input_contracts` already computes, so
    "upstream" means one thing in this file and not two.
    """
    email = _email_phase(
        index=0,
        arg_sources={"to": {"source": "upstream", "upstream_slug": "draft"}},
        tool_args={"subject": "Your renewal is due"},
    )
    later = _llm_phase(1, "draft")

    errors = _lint(_definition(email, later))
    unreachable = [e for e in errors if e.code == "upstream_unreachable"]
    assert len(unreachable) == 1, f"got {_codes(errors)!r}"
    assert unreachable[0].argument == "to"
    assert unreachable[0].upstream == "draft", (
        "the refusal must carry the NAMED slug — the client's sentence reads "
        "'takes X from Y, which does not run before it', and it needs Y"
    )

    # THE POSITIVE CONTROL — put the same phase FIRST and the same reference resolves.
    ok = _lint(
        _definition(
            _llm_phase(0, "draft"),
            _email_phase(
                index=1,
                arg_sources={"to": {"source": "upstream", "upstream_slug": "draft"}},
                tool_args={"subject": "Your renewal is due"},
            ),
        )
    )
    assert _codes(ok) == [], f"a genuinely upstream reference was refused: {ok!r}"


def test_an_output_key_is_not_an_upstream_slug():
    """⚠ THE NARROWER SET IS LOAD-BEARING. `_check_input_contracts`' `produced` accumulator
    carries phase slugs AND declared `output_keys`; the argument check is handed SLUGS ONLY.

    `resolve_arguments` reads `accumulated_outputs[slug]`, which the engine keys by phase slug
    and by nothing else — so accepting an `output_key` here would let the gate pass a reference
    the executor then cannot resolve. That is D-214-00's drift in miniature, and it is the one
    place reusing the wider accumulator would have been wrong.

    ⚠ MEASURED WHILE WRITING THIS CASE, AND RECORDED RATHER THAN QUIETLY WORKED AROUND: NO
    PHASE CONFIG IN `models/harness.py` DECLARES AN `output_keys` FIELD AT ALL — every config
    is a `_StrictBase` (`extra='forbid'`), so a definition carrying one is a `ValidationError`
    and the two accumulators are today INDISTINGUISHABLE through the model:

        phases.0.config.llm_single.output_keys
          Extra inputs are not permitted [type=extra_forbidden]

    `_check_input_contracts` reads it with `getattr(..., "output_keys", [])`, i.e. duck-typed,
    which is how the D-10 check has always been written. So the fence is driven at THAT level —
    a phase object that really does carry the attribute — because that is the only shape which
    can currently exercise the difference. If a config ever declares the field, this case keeps
    working unchanged and the definition-level path is covered by the same predicate.
    """
    from types import SimpleNamespace

    from app.models.harness import ExternalActionPhaseConfig
    from app.services.harness.reachability import _check_input_contracts

    producer = SimpleNamespace(
        slug="draft",
        phase_index=0,
        name="Draft it",
        config=SimpleNamespace(phase_type="llm_single", input_keys=[], output_keys=["the_draft"]),
    )
    consumer = SimpleNamespace(
        slug="notify",
        phase_index=1,
        name="Notify the customer",
        config=ExternalActionPhaseConfig.model_validate(
            {
                "phase_type": "external_action",
                "capability": "send_email",
                "tool_args": {"subject": "Your renewal is due"},
                "arg_sources": {"to": {"source": "upstream", "upstream_slug": "the_draft"}},
            }
        ),
    )

    errors = _check_input_contracts([producer, consumer], definition=None, tool_schemas=None)
    assert [e.code for e in errors] == ["upstream_unreachable"], (
        f"an output_key was accepted as an upstream PHASE: {_codes(errors)!r}"
    )
    assert errors[0].upstream == "the_draft"

    # THE POSITIVE CONTROL — the same reference against the producer's real SLUG resolves, so
    # this case is about which NAMES count, not about the upstream arm always failing.
    consumer.config = ExternalActionPhaseConfig.model_validate(
        {
            "phase_type": "external_action",
            "capability": "send_email",
            "tool_args": {"subject": "Your renewal is due"},
            "arg_sources": {"to": {"source": "upstream", "upstream_slug": "draft"}},
        }
    )
    assert _check_input_contracts([producer, consumer], definition=None, tool_schemas=None) == []


def test_unrenderable_names_the_argument_the_form_cannot_fill():
    """D-214-06 — a required argument the flat form structurally cannot draw is NAMED, never
    routed to a raw-JSON escape hatch (which is the surface SC#1 forbids under another name).
    """
    schemas = {
        _CONN: {
            "read_wiki": {
                "type": "object",
                "required": ["labels"],
                "properties": {"labels": {"type": "array", "items": {"type": "string"}}},
            }
        }
    }
    errors = _lint(_definition(_mcp_phase()), tool_schemas=schemas)

    assert [e.code for e in errors] == ["unrenderable"], f"got {_codes(errors)!r}"
    assert errors[0].argument == "labels"
    assert errors[0].step_name == "Look it up"


def test_a_bound_mcp_tool_with_no_entry_in_the_map_is_shape_unknown_not_a_pass():
    """⭐ T-214-05-01 — "UNKNOWN" AND "SATISFIED" MUST NOT LOOK THE SAME (D-214-10).

    The caller LOOKED (it supplied a map) and the bound tool is not in it: the snapshot is
    absent, stale, or the connection is unresolvable. The honest answer is a refusal, and the
    dangerous answer is the empty list — a step whose argument shape nobody can state would
    publish and then send an unreviewed argument object to a vendor.

    ⚠ `argument is None` is sketch 215 invariant #2: there is no argument to name, so the
    refusal must not invent one.
    """
    errors = _lint(_definition(_mcp_phase()), tool_schemas={})

    assert errors != [], (
        "a bound MCP tool with NO discovered schema PASSED the gate — that is the fail-open "
        "direction T-214-05-01 exists to prevent"
    )
    assert [e.code for e in errors] == ["shape_unknown"], f"got {_codes(errors)!r}"
    assert errors[0].argument is None, (
        "shape_unknown named an argument — sketch 215 #2: we do not know what the action "
        "needs, so there is nothing to name"
    )
    assert errors[0].step_name == "Look it up"

    # ... and the SAME answer when the connection is present in the map but the TOOL is not.
    other = _lint(
        _definition(_mcp_phase()), tool_schemas={_CONN: {"a_different_tool": {"type": "object"}}}
    )
    assert [e.code for e in other] == ["shape_unknown"]


def test_a_caller_that_never_looked_is_not_entitled_to_conclude_unknown():
    """`tool_schemas=None` is a DIFFERENT FACT from `tool_schemas={}`, and the distinction is
    the shipped division of labour rather than a loophole.

    `POST /workflows/validate` runs on every canvas keystroke and cannot resolve connections,
    so it passes no map and the MCP arm is skipped for it — it is the live ADVISORY surface.
    PUBLISH is the ENFORCING gate and ALWAYS supplies a map (asserted separately, over the
    publish path's own call). ⚠ The empty-map arm above is the positive control that makes
    this a distinction and not a hole: the identical definition BLOCKS the moment a caller
    claims to have looked.
    """
    assert _codes(_lint(_definition(_mcp_phase()))) == []
    assert _codes(_lint(_definition(_mcp_phase()), tool_schemas={})) == ["shape_unknown"]


# ══ 2 · THE PAYLOAD NAMES THE AUTHOR'S WORDS, AND NO SLUG ════════════════════


def test_the_refusal_carries_the_authored_name_and_not_the_slug():
    """Sketch 215 invariant #1, BOTH halves — the name IS there and the slug is NOT.

    `BUG-260815-06` and `BUG-260809-02` are both refusals that named an internal identifier at
    a person who chose neither and can see neither word anywhere on the canvas.
    """
    phase = _email_phase(slug="notify-the-customer-abc123", name="Email the customer")
    errors = _lint(_definition(phase))

    assert errors
    for e in errors:
        assert e.step_name == "Email the customer"
        assert "notify-the-customer-abc123" not in (e.step_name or ""), (
            "the refusal's step name carries the SLUG — that is the exact defect "
            "BUG-260815-06 records"
        )
        # ⚠ `phase_slug` is a SEPARATE field and keeps carrying the slug on purpose: it is how
        # the canvas highlights the offending node. What must not carry it is the NAME.
        assert e.phase_slug == "notify-the-customer-abc123"


def test_a_phase_with_no_authored_name_degrades_to_its_slug():
    """The ONE case where the name and the slug coincide, stated so a reader does not take it
    for the invariant above being broken.

    `nodeTitle()`'s name -> config-derived -> type-sentence ladder is computed AT RENDER and
    never stored, and a second implementation of a derivation is forbidden by name in this
    repo — so the server degrades to the one true identifier it holds rather than guessing at
    a title the client owns.
    """
    phase = _email_phase(slug="notify", name=None)
    errors = _lint(_definition(phase))

    assert errors
    assert {e.step_name for e in errors} == {"notify"}


def test_no_refusal_leaks_a_wire_id_a_host_or_a_credential():
    """T-214-05-04 — the payload carries the authored step name, the schema property name and
    an upstream slug. Never a connection id, never a URL, never a secret.

    A VALUE fence rather than a key-set fence: a key set can be correct while a MESSAGE
    interpolates the connection id into prose.
    """
    errors = _lint(
        _definition(
            _mcp_phase(
                arg_sources={"to": {"source": "upstream", "upstream_slug": "nowhere"}},
            )
        ),
        tool_schemas={},
    )
    assert errors

    for e in errors:
        blob = " ".join(str(v) for v in e if v is not None)
        assert _CONN not in blob, f"a connection id reached the refusal payload: {e!r}"
        assert "http" not in blob.lower(), f"a URL-shaped string reached the refusal: {e!r}"
        assert "@" not in blob, f"an address-shaped string reached the refusal: {e!r}"


# ══ 3 · THE PREDICATE IS SHARED — THE AGREEMENT CASE ═════════════════════════


def test_the_gate_and_the_resolver_agree_on_the_same_input():
    """⭐ THE CASE CONTEXT FAILURE MODE #3 EXISTS FOR — AND IT MOCKS NEITHER SIDE.

    The gate calls `unsatisfiable_arguments`; the executor calls `resolve_arguments`. Both are
    imported here from `app.services.connectors.args` and both are driven for real. The claim:
    **the gate returns `[]` if and only if the resolver produces a value for every required
    property.**

    ⚠ AND HERE IS ITS LIMIT, STATED RATHER THAN LEFT TO BE DISCOVERED. This case passes ONE
    schema object to BOTH functions, so it proves `f(s) == g(s)` and is STRUCTURALLY INCAPABLE
    of detecting `s_gate != s_executor` — a gate linting against a different schema than the
    executor resolves against would publish a workflow that then sends an EMPTY argument
    object, silently, and this case would stay green throughout.

    The provenance half is carried elsewhere, by construction rather than by assertion:
    `args.schema_for_bound_tool` is the ONE accessor and has three callers (the executor at
    `phase_types` GATE 6/7, this gate's `tool_schemas` builder, and the approval pause), plus
    plan `214-14`'s S-2b across the module boundary. A reader who takes this case as covering
    the whole of failure mode #3 has taken it for more than it is.

    ⚠ AND THE CLAIM IS AN IMPLICATION, NOT A BICONDITIONAL — MEASURED, AND CORRECTED FROM THE
    PLAN'S OWN WORDING. `214-05-PLAN.md` asks for *"gate returns `[]` **iff** the resolver
    produces a value for every required property"*. Driven against the shipped predicates, the
    `<==` direction is FALSE on two rows, and BOTH are deliberate rather than defects — the
    two-row evidence is kept as its own case below (`test_the_converse_does_not_hold_...`).
    The binding property is the one that matters and it is the one asserted here:

        gate clean  ==>  the resolver produces every required property,
                         GIVEN a launch that honours the arms the gate proved.

    That IS failure mode #3 ("a workflow passes the gate and then fails at the send"); the
    other direction is "a workflow is refused that might have worked", which costs an author
    an edit rather than shipping a broken publish.

    ⚠ THE RUN CONTEXT IS DERIVED FROM THE CONFIG, NOT HAND-WRITTEN PER ROW. The gate proves
    *"the ask key is declared"* and *"the upstream phase runs first"*; the resolver needs the
    launcher to have SUPPLIED that key and the phase to have PRODUCED that output. Hand-writing
    the context would let a row quietly withhold something the gate promised and turn a passing
    implication into a failing one for a reason that is about the fixture.
    """
    from app.models.harness import ExternalActionPhaseConfig
    from app.services.connectors.args import resolve_arguments, unsatisfiable_arguments

    schema = {
        "type": "object",
        "required": ["to", "subject"],
        "properties": {"to": {"type": "string"}, "subject": {"type": "string"}},
    }

    def _honoured_context(config, slugs):
        """The launch the gate's proof PROMISES: every declared ask key supplied, every
        upstream phase's output present."""
        run_inputs, upstream_outputs = {}, {}
        for name, spec in (config.arg_sources or {}).items():
            if spec.source == "ask":
                run_inputs[spec.ask_key or name] = f"value-for-{name}"
            elif spec.source == "upstream" and spec.upstream_slug in slugs:
                upstream_outputs[spec.upstream_slug] = f"output-of-{spec.upstream_slug}"
        return run_inputs, upstream_outputs

    # Each row: (config kwargs, declared inputs, upstream slugs)
    rows = [
        # nothing at all
        ({}, set(), []),
        # fixed, supplied
        ({"tool_args": {"to": "a@b.c", "subject": "hi"},
          "arg_sources": {"to": {"source": "fixed"}, "subject": {"source": "fixed"}}},
         set(), []),
        # fixed, one of them EMPTY (whitespace is absent — an author who cleared a field)
        ({"tool_args": {"to": "   ", "subject": "hi"},
          "arg_sources": {"to": {"source": "fixed"}, "subject": {"source": "fixed"}}},
         set(), []),
        # ask, declared
        ({"arg_sources": {"to": {"source": "ask", "ask_key": "who"},
                          "subject": {"source": "fixed"}},
          "tool_args": {"subject": "hi"}},
         {"who"}, []),
        # ask, NOT declared — nothing would ever populate it (BUG-260826-01's shape)
        ({"arg_sources": {"to": {"source": "ask", "ask_key": "who"},
                          "subject": {"source": "fixed"}},
          "tool_args": {"subject": "hi"}},
         set(), []),
        # upstream, reachable
        ({"arg_sources": {"to": {"source": "upstream", "upstream_slug": "draft"},
                          "subject": {"source": "fixed"}},
          "tool_args": {"subject": "hi"}},
         set(), ["draft"]),
        # upstream, named but NOT upstream
        ({"arg_sources": {"to": {"source": "upstream", "upstream_slug": "draft"},
                          "subject": {"source": "fixed"}},
          "tool_args": {"subject": "hi"}},
         set(), []),
        # no entry at all, value sitting in tool_args (the D-214-08 read)
        ({"tool_args": {"to": "a@b.c", "subject": "hi"}}, set(), []),
        # no entry at all, an upstream-shaped arm on ONE property only
        ({"tool_args": {"subject": "hi"},
          "arg_sources": {"to": {"source": "upstream", "upstream_slug": "draft"}}},
         set(), ["draft"]),
    ]

    unsound, verdicts = [], set()
    for kwargs, declared, slugs in rows:
        config = ExternalActionPhaseConfig.model_validate(
            {"phase_type": "external_action", "capability": "send_email", **kwargs}
        )
        gaps = unsatisfiable_arguments(
            config=config, schema=schema, upstream_slugs=slugs,
            declared_input_keys=declared,
        )
        run_inputs, upstream_outputs = _honoured_context(config, slugs)
        resolved = resolve_arguments(
            config=config, schema=schema,
            upstream_outputs=upstream_outputs, run_inputs=run_inputs,
        )
        gate_clean = gaps == []
        verdicts.add(gate_clean)
        if gate_clean and not all(name in resolved for name in schema["required"]):
            unsound.append((kwargs, sorted(resolved)))

    assert unsound == [], (
        "THE GATE PASSED SOMETHING THE RESOLVER CANNOT SUPPLY. That workflow publishes and "
        f"then fails at the send for a missing argument (CONTEXT failure mode #3): {unsound!r}"
    )

    # TEETH — the table must really have exercised BOTH verdicts, or `unsound == []` would be a
    # green light over rows that are all refused (and therefore all vacuous).
    assert verdicts == {True, False}, (
        f"the agreement table never exercised both verdicts: {verdicts!r}"
    )


def test_the_converse_does_not_hold_and_both_exceptions_are_deliberate():
    """⚠ THE TWO ROWS THAT REFUTE THE PLAN'S `iff`, KEPT AS EVIDENCE RATHER THAN DELETED.

    Each is the gate being STRICTER than the resolver — the safe direction — and each has a
    named reason. Recording them is what stops a later reader "fixing" the gate to match the
    resolver and re-opening `BUG-260826-01`.
    """
    from app.models.harness import ExternalActionPhaseConfig
    from app.services.connectors.args import resolve_arguments, unsatisfiable_arguments

    schema = {
        "type": "object",
        "required": ["to", "subject"],
        "properties": {"to": {"type": "string"}, "subject": {"type": "string"}},
    }

    # (1) THE LEGACY RUN-INPUT FALLBACK. `resolve_arguments`' no-entry arm reads `tool_args`
    #     THEN `run_inputs` (D-214-12 — without that second half every pre-214 workflow would
    #     silently stop sending). The gate does NOT credit it: a value that happens to arrive
    #     in the launch bag is not a DECLARED source, and STEP-03's whole point is that the
    #     author says where each argument comes from. Nothing is retroactive — the already
    #     published row keeps running; the NEXT publish must declare.
    legacy = ExternalActionPhaseConfig.model_validate(
        {"phase_type": "external_action", "capability": "send_email"}
    )
    assert [g.kind for g in unsatisfiable_arguments(
        config=legacy, schema=schema, upstream_slugs=[], declared_input_keys=set(),
    )] == ["no_source", "no_source"]
    assert resolve_arguments(
        config=legacy, schema=schema, upstream_outputs={},
        run_inputs={"to": "a@b.c", "subject": "hi"},
    ) == {"to": "a@b.c", "subject": "hi"}, (
        "the legacy run-input fallback stopped working — D-214-12 says every workflow "
        "published before this phase keeps resolving byte-identically"
    )

    # (2) AN `ask` ARM THE LAUNCHER LEAVES BLANK. The gate proves the key is DECLARED, which
    #     is all D-214-09 asks of it — whether a person typed something is a RUN-time fact no
    #     publish-time check can see. That gap is D-214-11's job: the golden run validates the
    #     arguments it actually RESOLVED.
    asked = ExternalActionPhaseConfig.model_validate(
        {
            "phase_type": "external_action",
            "capability": "send_email",
            "tool_args": {"subject": "hi"},
            "arg_sources": {"to": {"source": "ask", "ask_key": "who"},
                            "subject": {"source": "fixed"}},
        }
    )
    assert unsatisfiable_arguments(
        config=asked, schema=schema, upstream_slugs=[], declared_input_keys={"who"},
    ) == []
    assert "to" not in resolve_arguments(
        config=asked, schema=schema, upstream_outputs={}, run_inputs={},
    )


def test_an_adversarial_schema_grants_nothing(caplog):
    """T-214-05-02 — a hostile MCP server's `inputSchema` cannot WEAKEN the gate.

    A schema declaring nothing required produces no gaps, and grants nothing either: the
    executor still PROJECTS onto that same schema, so only declared properties reach the wire
    and `additionalProperties: true` buys the server nothing.
    """
    from app.services.connectors.args import resolve_arguments

    hostile = {
        "type": "object",
        "required": [],
        "additionalProperties": True,
        "properties": {"repo": {"type": "string"}},
    }
    phase = _mcp_phase(tool_args={"repo": "facebook/react", "secret_token": "hunter2"})

    assert _codes(_lint(_definition(phase), tool_schemas={_CONN: {"read_wiki": hostile}})) == []

    from app.models.harness import ExternalActionPhaseConfig

    config = ExternalActionPhaseConfig.model_validate(
        {
            "phase_type": "external_action",
            "tool_name": "read_wiki",
            "connection_id": _CONN,
            "tool_args": {"repo": "facebook/react", "secret_token": "hunter2"},
        }
    )
    sent = resolve_arguments(
        config=config, schema=hostile, upstream_outputs={}, run_inputs={}
    )
    assert sent == {"repo": "facebook/react"}, (
        "an UNDECLARED stored key reached the outbound object — the projection is onto the "
        f"schema's declared properties, never onto tool_args' keys: {sent!r}"
    )


# ══ 4 · THE MODULE STAYS PURE, AND THE ALLOWLIST STAYS NARROW ════════════════


def test_the_allowlist_was_not_widened():
    """CONTEXT failure mode #10 — the gate must not pass by LOOSENING.

    A VALUE fence, deliberately, and not a `git diff | grep` on the identifier: this plan adds
    a comment block naming `_KNOWN_RUN_INPUT_KEYS` at its own definition site, so a text grep
    counts its own prose (the 187-24 trap). The value is the property that matters.
    """
    from app.services.harness.reachability import _KNOWN_RUN_INPUT_KEYS

    assert _KNOWN_RUN_INPUT_KEYS == frozenset({"kickoff_prompt", "topic"}), (
        "the run-input allowlist was widened. An adapter's required arguments are NOT "
        "input_keys — widening this set makes the argument gate pass by loosening, which is "
        "the opposite of STEP-03."
    )


def test_the_lint_module_stays_import_light():
    """`/workflows/validate` imports `lint_workflow` on every canvas edit, so the module may
    not drag the engine in. Measured on a SUBPROCESS with a cold `sys.modules` — importing it
    in-process here would prove nothing, because the `app.services.harness` package `__init__`
    imports `phase_types` for its registration side-effect.
    """
    import subprocess
    import sys

    probe = (
        "import sys, importlib;"
        "importlib.import_module('app.services.connectors.args');"
        "print('harness_engine' if 'app.services.harness_engine' in sys.modules else 'clean');"
        "print('phase_types' if 'app.services.harness.phase_types' in sys.modules else 'clean')"
    )
    out = subprocess.run(
        [sys.executable, "-c", probe], capture_output=True, text=True
    ).stdout.split()

    assert out == ["clean", "clean"], (
        f"the argument leaf the lint imports is no longer import-light: {out!r}"
    )


def test_tool_schemas_is_keyword_only_so_no_positional_caller_can_drift():
    """A positional third argument would eventually be handed something else by a caller that
    counted wrong — and a WRONG schema map is indistinguishable from a right one at the call
    site, because both are dicts.
    """
    import inspect

    from app.services.harness.reachability import lint_workflow

    param = inspect.signature(lint_workflow).parameters["tool_schemas"]
    assert param.kind is inspect.Parameter.KEYWORD_ONLY
    assert param.default is None


def test_a_non_external_action_definition_lints_exactly_as_before():
    """D-214-12's floor — the gate adds NOTHING to a workflow with no external step, so the
    four canonical seed shapes and every shipped definition keep their verdicts.
    """
    clean = _definition(_llm_phase(0, "draft"), _llm_phase(1, "review", name="Review it"))
    assert _lint(clean) == []
    assert _lint(clean, tool_schemas={}) == []
