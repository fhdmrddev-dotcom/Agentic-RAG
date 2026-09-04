"""Phase 193.2 (AUTH-03 / `SEED-163` + `BUG-260815-01`) — the deterministic properties of
`AUTHORING_SYSTEM_PROMPT` and the emit schema it advertises.

Two of this phase's three findings are one Python string literal:

  - `SEED-163` — the emit tool ALREADY advertises `business_requirement`
    (`WF_SCHEMA` is `WorkflowDefinition.model_json_schema()` and the field is on the
    model, `app/models/harness.py:538`), yet `grep -c business_requirement
    backend/app/services/workflow_authoring.py` returned **0** at HEAD. Nothing told the
    model what the field is for, so the author was asked to restate by hand what they had
    already typed into the describe box.
  - `BUG-260815-01` — 193.1's D-26 fix told the model it MUST fill exactly N named
    template fields; when the grounding could not supply them all, the reasonable
    composition was *"add a step that asks the human"* — an `llm_human_input` phase the
    synchronous publish gate categorically refuses. Measured 2 for 2 with a template.

⚠ **D-08 — WHAT THIS FILE DELIBERATELY DOES NOT CONTAIN, AND WHY.**

This file asserts ONLY DETERMINISTIC properties: properties of a string constant, of the
JSON schema, and of the service's control flow. **No case in this file may assert that
`business_requirement` is always populated, or that `llm_human_input` never appears in a
generated definition.** Those are FREQUENCY claims about a language model's output. They
are measured as k/N by `backend/tests/integration/test_193_2_authoring_frequency.py`
(plan 193.2-08) against real provider calls, and the phase's claim is **a reduction, never
an absence** — the publish gate STAYS precisely because a prompt cannot guarantee absence.

A test in this file asserting either of those two things would be asserting something the
fix does not deliver, and would be red or green for reasons no one could act on.

⚠ **THE ASSERTION PHILOSOPHY, COPIED VERBATIM FROM THE ANALOG**
(`test_187_authoring_step_names.py:212-235`). `workflow_authoring.py:56` licenses the
prompt copy as *"Claude's discretion (the contracts are locked, not the prose)"*, so every
case here asserts a source-level **PROPERTY** of the constant and never a hand-typed copy
of a sentence. A reword must not turn this file red; a lost CONTRACT must.

Where a property needs a vocabulary (case 4's durability signal), the vocabulary is a
FAMILY of tokens stated in the case's own docstring, and **adding a synonym to that family
is the correct maintenance action** when the prose is reworded — never deleting the case.

⚠ **F-8 HAS NO ANALOG IN THIS REPOSITORY AND IS WRITTEN FROM SCRATCH.** Nothing here
mechanically guards a prompt-literal length; the rule has lived only as prose at
`workflow_authoring.py:70-79` since Phase 189. Its numbers are RE-DERIVED from the literal
at runtime rather than hand-counted, because a hand-counted fence rots exactly the way
`GSD_VITEST_MAX_WORKERS=4` did — the right number is a function of the thing measured, not
a constant someone once wrote down.

⚠ **F-6 AND THE PROVENANCE STAMP ARE NOT HERE.** They arrive in plan 193.2-07, which
extends this same file. Nothing is stubbed for them.

CONVENTION (Phase 102/103 posture, inherited from the analog): imports INSIDE the test
bodies; `forced_emit` is patched on the module it is imported FROM
(`app.services.forced_emit`) because `generate_workflow_definition` imports it
function-locally. `settings` is passed as a PARAMETER — no global is monkeypatched.
**NO live provider, NO network, NO agent loop** — see `STUB_PROVIDER` below.
"""

from __future__ import annotations

import copy
import json
import re
from types import SimpleNamespace

import pytest

# ── The two numbers this file is allowed to carry as literals, and where they come from ──
#
# Both are DERIVED figures recorded so a later reader can see the direction of travel; the
# fence itself re-derives every bullet length from the literal at runtime.
#
#   * 104 — the CEILING. It is the `external_action` bullet's own measured length, which
#     `workflow_authoring.py:70-79` records as the module's deliberate upper precedent
#     ("inside the +25% bound the plan sets"). It is not a round number someone chose.
#   * 121 — the HISTORICAL length of the `llm_human_input` bullet before Phase 193.2. It
#     was the longest of the seven and 45% above the six-bullet median of exactly 83.5.
#     Its tail was an active invitation to use the ONE phase type the publish gate
#     refuses, which is why length is a COMPOSITION NUDGE here and not a style note.
MAX_BULLET_CHARS = 104
LLM_HUMAN_INPUT_CHARS_BEFORE_193_2 = 121

# A bullet that is unambiguously over the ceiling, used as the permanent INLINE PLANT.
# Exactly 200 characters — see `test_the_length_predicate_sees_an_over_long_bullet`.
PLANTED_OVER_LONG_BULLET = "- planted_type: " + ("x" * 183) + "."

# A stub Settings. `generate_workflow_definition` takes `settings` as a parameter, so a
# test supplies its own — zero global mutation, zero contamination.
STUB_SETTINGS = SimpleNamespace(harness_authoring_model="claude-opus-4-8")

# ── the stubs. NOTE the provider name: `STUB_PROVIDER` is deliberately a string that
# matches NO real provider in the gateway. `forced_emit` is patched out entirely, so the
# value is never routed on — and naming a fake one makes "this file cannot reach a
# network" self-evident rather than a claim in a docstring.
STUB_PROVIDER = "stub-provider-not-a-real-one"


# ══ the prompt accessors — every fence derives its corpus, none hand-types one ═══════════


def _prompt() -> str:
    from app.services.workflow_authoring import AUTHORING_SYSTEM_PROMPT

    return AUTHORING_SYSTEM_PROMPT


def _phase_type_bullets() -> list[str]:
    """The phase-type bullet block, DERIVED from the literal — the FIRST maximal run of
    consecutive lines beginning ``"- "``.

    Located by SHAPE rather than by the header sentence above it, so rewording that
    sentence cannot silently empty the corpus. The block's identity is then PROVED
    (`test_the_bullet_block_is_the_phase_type_block`) by checking that every phase type
    the SCHEMA advertises has a bullet in it — so a locator that grabbed the wrong run of
    bullets fails loudly instead of passing over the wrong text.
    """
    runs: list[list[str]] = []
    current: list[str] = []
    for line in _prompt().split("\n"):
        if line.startswith("- "):
            current.append(line)
        elif current:
            runs.append(current)
            current = []
    if current:
        runs.append(current)
    return runs[0] if runs else []


def _schema_phase_types() -> set[str]:
    """The phase-type names the emit schema advertises, read out of `WF_SCHEMA` itself.

    Derived, never re-typed: the `oneOf` config variants each carry a
    ``phase_type: {"const": ...}`` (the discriminator keys are stripped, the consts are
    not — `_strip_discriminator`'s docblock). A hand-typed list here would be a second
    copy of the model's `Literal`, free to drift from it.
    """
    from app.services.workflow_authoring import WF_SCHEMA

    found: set[str] = set()

    def _walk(node) -> None:
        if isinstance(node, dict):
            pt = node.get("phase_type")
            if isinstance(pt, dict) and pt.get("const"):
                found.add(pt["const"])
            for value in node.values():
                _walk(value)
        elif isinstance(node, list):
            for value in node:
                _walk(value)

    _walk(WF_SCHEMA)
    return found


def _deliverable_rule_block() -> list[str]:
    """The DELIVERABLE RULE block, located by its ``CRITICAL`` label and running to the
    next blank line. The label is the block's own contract — `workflow_authoring.py:82`
    labels it *"CRITICAL — a wrong choice makes the workflow unpublishable"* — so it is
    the one part of this block that is not free prose.
    """
    lines = _prompt().split("\n")
    starts = [i for i, line in enumerate(lines) if "CRITICAL" in line]
    if not starts:
        return []
    block: list[str] = []
    for line in lines[starts[0] :]:
        if not line.strip():
            break
        block.append(line)
    return block


def _sentences_naming(token: str) -> list[str]:
    """Sentences of the prompt that name `token`.

    The analog's shape (`test_187_authoring_step_names.py:229-231`) — newlines flattened,
    split on ``.``, filtered. Crude by design: it is a property extractor, not a parser.
    """
    return [s for s in _prompt().replace("\n", " ").split(".") if token in s]


# ══ F-8 — the bullet-length fence (NO ANALOG; written from scratch) ══════════════════════


def test_the_length_predicate_sees_an_over_long_bullet():
    """THE INLINE PLANT, kept permanently in the file rather than performed once.

    The plant is asserted to VIOLATE the very predicate the fence below applies, so the
    predicate is shown to see the shape it exists to catch. Without this, an absence
    assertion is only evidence that nothing matched — never that anything COULD.

    (A real 200-character bullet was additionally planted into `AUTHORING_SYSTEM_PROMPT`
    and the fence observed RED before this file was committed; the inline assertion proves
    the PREDICATE sees the shape, and only a real plant proves the FENCE is pointed at the
    right constant. Both were done — see the plan's summary for the RED output.)
    """
    assert len(PLANTED_OVER_LONG_BULLET) == 200
    assert len(PLANTED_OVER_LONG_BULLET) > MAX_BULLET_CHARS
    assert PLANTED_OVER_LONG_BULLET.startswith("- ")


def test_the_bullet_block_is_the_phase_type_block():
    """NON-VACUITY for the locator: the derived run of bullets really is the phase-type
    list, proved against the SCHEMA rather than against a hand-typed list of names.

    Every `phase_type` the emit schema advertises has exactly one bullet naming it. If a
    reword moved the block, or the locator grabbed the HARD-constraints bullets instead,
    this fails here rather than letting the length fence below pass over the wrong text.
    """
    bullets = _phase_type_bullets()
    types = _schema_phase_types()

    assert len(types) >= 7, "the schema should advertise at least the 7 shipped phase types"
    assert len(bullets) >= 7, "the phase-type bullet corpus is empty or truncated"

    for phase_type in types:
        naming = [b for b in bullets if b.startswith(f"- {phase_type}:")]
        assert len(naming) == 1, (
            f"phase type {phase_type!r} should have exactly one bullet in the located "
            f"block; found {len(naming)}"
        )


def test_every_phase_type_bullet_is_within_the_modules_own_length_precedent():
    """F-8 — the prompt-bullet length discipline becomes MECHANICAL.

    Documented in prose since Phase 189 (`workflow_authoring.py:70-79`) and guarded by
    nothing until now: *"LENGTH IS A CONSTRAINT, not a style note … an over-long bullet is
    a nudge, and a nudge in a generator prompt skews composition toward the type it
    describes."* `BUG-260815-01` is that sentence coming true — the `llm_human_input`
    bullet was the longest of the seven AND ended with an active invitation, and the model
    composed the one phase type the publish gate categorically refuses, 2 times out of 2.

    EVERY length here is RE-DERIVED from the literal at runtime. No per-bullet number is
    pinned: a hand-counted fence rots the way `GSD_VITEST_MAX_WORKERS=4` did.
    """
    bullets = _phase_type_bullets()

    # non-vacuity — an absence assertion over an empty corpus is the commonest way a
    # fence stops seeing anything at all.
    assert len(bullets) >= 7, "no phase-type bullets collected — the fence would be vacuous"

    over = [(len(b), b) for b in bullets if len(b) > MAX_BULLET_CHARS]
    assert not over, (
        f"phase-type bullet(s) exceed the module's own {MAX_BULLET_CHARS}-char precedent "
        f"(the `external_action` bullet): {[(n, b[:60]) for n, b in over]}"
    )


def test_the_interactive_bullet_no_longer_leads_the_pack():
    """The `llm_human_input` bullet is strictly shorter than it was at HEAD.

    It measured **121** characters before Phase 193.2 — the longest of the seven, 45%
    above the six-bullet median of exactly 83.5 — and it ENDED with an active invitation
    ("use for any 'confirm before finalizing' step"). Length here is a COMPOSITION NUDGE,
    not a style note: the type it was recommending is the one the synchronous publish gate
    refuses outright (`publish_service._interactive_phase_failures`).

    ⚠ This asserts a LENGTH, which is a property, and asserts nothing whatsoever about how
    often a model emits such a phase — that is a frequency claim and it is measured k/N
    elsewhere (D-08, see this module's header).
    """
    bullets = [b for b in _phase_type_bullets() if b.startswith("- llm_human_input:")]
    assert len(bullets) == 1, "expected exactly one llm_human_input bullet"

    length = len(bullets[0])
    assert length < LLM_HUMAN_INPUT_CHARS_BEFORE_193_2
    assert length <= MAX_BULLET_CHARS

    # It must still say truthfully what the type IS — the two facts an author needs.
    # Asserted as tokens of the CONTRACT (the config field names), never as prose.
    assert "`prompt`" in bullets[0]
    assert "`options`" in bullets[0]


# ══ D-14 — the prompt promises nothing that is not on the roadmap ════════════════════════

# `SEED-164` exists BECAUSE a docblock calling something "the DEFERRED Phase-103 rework"
# made unscheduled work read like a plan for a year — and Phase 103 shipped long ago.
# Repeating that inside a shipped prompt would be the same error with a wider audience.
FORBIDDEN_PROMISE_TOKENS = ("planned", "coming soon", "deferred", "future release")
FORBIDDEN_PROMISE_RE = re.compile("|".join(FORBIDDEN_PROMISE_TOKENS), re.IGNORECASE)


def test_positive_control_the_promise_regex_matches_a_planted_promise():
    """POSITIVE CONTROL for the case directly below.

    The absence assertion cannot pass for the wrong reason: the same regex is shown here
    to MATCH a planted string carrying each forbidden token, one at a time.
    """
    for token in FORBIDDEN_PROMISE_TOKENS:
        planted = f"A human-pause workflow is {token} for a later milestone."
        assert FORBIDDEN_PROMISE_RE.search(planted), (
            f"the promise regex failed to see {token!r} — it cannot defend anything"
        )


def test_the_prompt_promises_no_unscheduled_capability():
    """D-14 — no shipped prompt text may promise an unscheduled capability.

    The suppression clause tells the model NOT to compose a step that pauses for a human.
    It may not soften that by implying the capability is on its way: a deliberate
    human-pause workflow that can still be published is a real need the operator has
    named (`SEED-164`) and it is **not scheduled**. State what is true now.
    """
    prompt = _prompt()
    assert prompt, "the prompt constant is empty — this fence would be vacuous"

    hit = FORBIDDEN_PROMISE_RE.search(prompt)
    context = "" if hit is None else prompt[max(0, hit.start() - 60) : hit.end() + 60]
    assert hit is None, (
        f"the authoring prompt promises an unscheduled capability near: {context!r}"
    )


# ══ D-11 — the DELIVERABLE RULE carries the interactive case, asserted as a property ═════


def test_the_deliverable_rule_block_is_locatable_and_non_empty():
    """NON-VACUITY for the block locator used by the case below.

    The block is found by its `CRITICAL` label — the one part of it that is contract
    rather than free prose (`workflow_authoring.py:82`) — and it must carry more than the
    label line, or the property assertion below would be reading an empty corpus.
    """
    block = _deliverable_rule_block()

    assert block, "the DELIVERABLE RULE block could not be located by its CRITICAL label"
    assert "CRITICAL" in block[0]
    bullets = [line for line in block if line.startswith("- ")]
    assert len(bullets) >= 2, (
        "the DELIVERABLE RULE should carry at least the template clause and the "
        "interactive clause; found "
        f"{len(bullets)}"
    )


def test_the_deliverable_rule_addresses_the_interactive_case():
    """D-11 — the interactive case joins the DELIVERABLE RULE in the rule's OWN voice.

    WHICH PROPERTY IS ASSERTED, AND WHY IT IS THIS ONE: the two **identifiers** the
    shipped publish gate keys on — `llm_human_input` (a `phase_type`) and `ask_user` (a
    validator `on_failure` disposition) — appear inside the block. Identifiers, not prose:
    they are schema-level tokens the model must recognise to obey the clause, so they are
    contract, while every sentence around them is Claude's discretion and free to be
    reworded without turning this red.

    The block is ALREADY labelled *"CRITICAL — a wrong choice makes the workflow
    unpublishable"*, which is exactly the consequence of composing an interactive step, so
    this is one clause added to an existing rule rather than a new rule.

    ⚠ This says the prompt ASKS. It says nothing about what any model DOES — that is a
    frequency claim, measured k/N elsewhere (D-08). The publish gate stays.
    """
    block_text = "\n".join(_deliverable_rule_block())

    assert "llm_human_input" in block_text, (
        "the DELIVERABLE RULE does not name the interactive phase type — the model has "
        "no way to know which composition makes the workflow unpublishable"
    )
    assert "ask_user" in block_text, (
        "the DELIVERABLE RULE does not name the interactive validator disposition — the "
        "second shape the publish gate refuses would be unaddressed"
    )


def test_the_interactive_clause_offers_an_alternative_and_forbids_inventing_data():
    """The clause states what to do INSTEAD, and does not license fabrication.

    An unexplained prohibition in a generator prompt is a rule the model can trade away
    against a competing instruction — `BUG-260815-01` IS that trade (told to fill N named
    template fields the grounding could not supply, "ask the human" was the reasonable
    composition). So the clause must offer a route.

    PROPERTY ASSERTED, not prose: the clause carries at least one token from an
    ALTERNATIVE family and at least one from a DO-NOT-FABRICATE family. Rewording is
    expected; **adding a synonym to a family is the correct maintenance action**, deleting
    the case is not. `SEED-159` is why the second family exists — a blank that lies is not
    an improvement on a missing answer.
    """
    interactive = [
        line
        for line in _deliverable_rule_block()
        if line.startswith("- ") and "llm_human_input" in line
    ]
    assert len(interactive) == 1, "expected exactly one interactive clause in the block"
    clause = interactive[0].lower()

    alternative_family = ("gather", "tools", "write", "instead")
    fabrication_family = ("never invent", "do not invent", "not invent", "never fabricate")

    assert any(t in clause for t in alternative_family), (
        f"the interactive clause offers no alternative; expected one of "
        f"{alternative_family}"
    )
    assert any(t in clause for t in fabrication_family), (
        f"the interactive clause does not forbid fabricating the missing fact; expected "
        f"one of {fabrication_family}"
    )


# ══ D-07 — the requirement instruction is DEFINITION-scoped and DURABLE ══════════════════


def test_the_prompt_asks_for_the_business_requirement_at_all():
    """`SEED-163` — the whole defect in one assertion.

    Measured at HEAD before this phase: `grep -c business_requirement
    backend/app/services/workflow_authoring.py` → **0**, while `WF_SCHEMA` (=
    `WorkflowDefinition.model_json_schema()`) already advertised the field. The schema was
    never the gap; the prompt was.

    ⚠ This asserts the prompt ASKS for the field. It does NOT assert any model fills it —
    see this module's D-08 header.
    """
    assert "business_requirement" in _prompt()


def test_the_requirement_is_asked_for_at_the_definition_level(monkeypatch):
    """D-07 (first half) — the request is scoped to the DEFINITION, not to a phase.

    Copied from the analog's shape (`test_187_authoring_step_names.py:212-235`): split the
    prompt into sentences, keep those naming the field, assert at least one also names the
    definition-level setting context. A model that cannot tell a definition-level field
    from a per-phase `prompt` would put the requirement in the wrong place.

    The WORDING is Claude's discretion; the SCOPE is the contract.
    """
    sentences = _sentences_naming("business_requirement")

    assert sentences, "no sentence of the prompt names `business_requirement`"
    assert any("definition" in s.lower() for s in sentences), (
        "no sentence requesting `business_requirement` names the definition-level "
        "setting context — the model cannot tell it from a per-phase field"
    )


def test_the_requirement_is_asked_for_as_a_DURABLE_statement():
    """D-07 (second half) — the requirement asked for is what the workflow must deliver
    for ANY run, never a restatement of the describe text.

    `SEED-163` is explicit and this is not re-litigable: `describe` is ONE RUN's task
    instruction (*"produce a QBR for Northwind covering Q3"*); the requirement is durable
    (*"produce a client-ready QBR for a named account from our own records"*). A verbatim
    copy bakes one run's parameters into the workflow's definition of done — and the
    publish gauntlet's later stages read this field, including the judge's
    `answers_business_requirement` criterion. **D-07 is part of the mitigation for
    T-193.2-03, not decoration: a durable requirement is a HARDER bar to satisfy than a
    one-run instruction.**

    PROPERTY ASSERTED, not prose: at least one sentence naming the field also carries a
    DURABILITY signal from the family below. Rewording is expected; **adding a synonym to
    the family is the correct maintenance action**, deleting the case is not.
    """
    durability_family = (
        "any run",
        "every run",
        "each run",
        "stays true",
        "durable",
        "not a restatement",
        "recurring",
    )

    sentences = [s.lower() for s in _sentences_naming("business_requirement")]
    assert sentences, "no sentence of the prompt names `business_requirement`"

    assert any(any(t in s for t in durability_family) for s in sentences), (
        f"no sentence requesting `business_requirement` signals DURABILITY; expected one "
        f"of {durability_family}. A requirement phrased for one run bakes that run's "
        f"parameters into the workflow's definition of done (D-07 / SEED-163)"
    )


# ══ D-09 — the emit schema is UNCHANGED ══════════════════════════════════════════════════


def test_the_emit_schema_still_advertises_the_field_and_still_does_not_require_it():
    """D-09 — no schema change was needed, and none was made.

    This case is the fence against a later "obvious improvement". Making
    `business_requirement` hard-required would:
      * fail an otherwise-valid emit that simply omitted it (the fallback D-08 relies on
        is *today's exact behaviour* — a blank field the author fills, not a failure), and
      * ripple to EVERY other path that validates a `WorkflowDefinition`, including every
        already-persisted draft, because `WF_SCHEMA` is the model's own JSON schema.

    The `required` list is pinned exactly, not merely checked for the absence of one key:
    an addition to it is as much a behaviour change as a removal.
    """
    from app.services.workflow_authoring import EMIT_TOOL, WF_SCHEMA

    assert "business_requirement" in WF_SCHEMA["properties"]
    assert WF_SCHEMA["required"] == ["slug", "version", "name", "phases"]
    assert "business_requirement" not in WF_SCHEMA["required"]

    # The emit tool advertises that exact schema object — the prompt is the only gap.
    assert EMIT_TOOL["function"]["parameters"] is WF_SCHEMA
    assert EMIT_TOOL["function"]["name"] == "emit_workflow_definition"


# ══ the provider-call budget is unchanged ════════════════════════════════════════════════
#
# The mock helpers below are copied wholesale from
# `backend/tests/unit/test_187_authoring_step_names.py:116-186` — they are the reason this
# file cannot reach a network, and re-deriving them would be a second copy free to drift.


def _named_definition_dict() -> dict:
    """A minimal valid WorkflowDefinition. No tools / skills / folder_scope, so grounding
    fidelity is trivially clean.

    ⚠ It deliberately carries NO `business_requirement`. That is the D-08 fallback shape —
    a model that says nothing about the field is the ordinary case, and the service must
    behave exactly as it does today when that happens.
    """
    return {
        "slug": "renewal-brief",
        "version": 1,
        "name": "Renewal Brief",
        "status": "draft",
        "phases": [
            {
                "slug": "gather",
                "phase_index": 0,
                "name": "Pull the renewal history",
                "config": {"phase_type": "llm_single", "prompt": "Pull the history."},
                "validators": [],
            },
        ],
    }


def _wd(definition_dict: dict):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(copy.deepcopy(definition_dict))


def _patch_grounding(monkeypatch):
    """Patch the grounding accessors inside workflow_authoring so no live folder/tool/
    skill/DB read happens (the `test_103_nl_generate._patch_grounding` shape)."""
    import app.services.workflow_authoring as wa

    async def _fake_assemble(**_kwargs):
        return ("GROUNDED", set(), set())

    monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)

    async def _fake_fidelity(*_args, **_kwargs):
        return None  # clean — no grounding violation

    monkeypatch.setattr(wa, "_check_grounding_fidelity", _fake_fidelity)


def _patch_provider(monkeypatch):
    """Make get_model_capability(authoring_model) resolve a (fake) provider."""
    import app.config as cfg

    monkeypatch.setattr(
        cfg,
        "get_model_capability",
        lambda model: {"forced_emission": True, "provider": STUB_PROVIDER},
    )


def _patch_user_settings(monkeypatch):
    """The gateway resolves its key from a per-USER settings object; the real loader reads
    Supabase. Stub it so nothing touches the DB."""
    import app.models.user_settings as us

    monkeypatch.setattr(
        us, "load_user_settings", lambda _uid: SimpleNamespace(active_provider=STUB_PROVIDER)
    )


def _patch_emit(monkeypatch, responses: list[dict]) -> list[dict]:
    """Patch `forced_emit` on the module it is imported FROM and return the recorded call
    list, so the provider-call BUDGET is directly observable."""
    import app.services.forced_emit as fe

    calls: list[dict] = []

    async def _fake_forced_emit(**kwargs):
        calls.append(kwargs)
        idx = min(len(calls) - 1, len(responses) - 1)
        return responses[idx]

    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)
    return calls


async def _generate(**overrides):
    import app.services.workflow_authoring as wa

    kwargs = {
        "describe": "Write a renewal brief every quarter.",
        "supabase": object(),
        "user_id": "u1",
        "settings": STUB_SETTINGS,
    }
    kwargs.update(overrides)
    return await wa.generate_workflow_definition(**kwargs)


@pytest.mark.asyncio
async def test_the_prompt_change_buys_no_extra_provider_shot(monkeypatch):
    """T-187-02-03's guard, re-pinned for this phase: EXACTLY one provider call when the
    first emit validates.

    Phase 193.2 adds THREE edits to a string literal and nothing else. A prompt-text
    change cannot alter control flow — but that is an argument, and this is the
    measurement. If a future edit here buys a second shot (a "derive the requirement"
    call, say — explicitly REJECTED by D-08 as a new provider call and a new failure
    surface on every miss), this goes red rather than silently doubling the cost of every
    generation.

    It also asserts the prompt the service actually SENT is the constant under test, so
    every fence above is measuring the string that ships.
    """
    from app.services.workflow_authoring import AUTHORING_SYSTEM_PROMPT

    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    calls = _patch_emit(
        monkeypatch, [{"emitted": _wd(_named_definition_dict()), "failure": None}]
    )

    result = await _generate()

    assert result["ok"] is True
    assert len(calls) == 1
    assert len(calls) != 3
    assert calls[0]["system_prompt"] is AUTHORING_SYSTEM_PROMPT


@pytest.mark.asyncio
async def test_an_emit_that_omits_the_field_still_succeeds_unchanged(monkeypatch):
    """D-08 — THE FALLBACK. When the model says nothing about `business_requirement`, the
    service behaves EXACTLY as it does today: a clean success whose definition simply
    carries `None` there, for the author to fill.

    ⚠ READ THIS BEFORE ADDING A SIBLING CASE. This asserts the FALLBACK is intact. It is
    NOT the inverse of a "the field is always populated" claim, and no such claim may be
    added to this file — the prompt is a nudge, its effect is a FREQUENCY, and frequency
    is measured k/N by `test_193_2_authoring_frequency.py` (plan 193.2-08). The publish
    gate stays precisely because a prompt cannot guarantee anything about model output.
    """
    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    _patch_emit(monkeypatch, [{"emitted": _wd(_named_definition_dict()), "failure": None}])

    result = await _generate()

    assert result["ok"] is True
    assert result["definition"]["business_requirement"] is None
    # No new failure mode, no new key, no lie — the payload is the shipped shape.
    assert "error" not in result


# ══ F-6 — the server-side PROVENANCE STAMP (plan 193.2-07) ═══════════════════════════════
#
# The stamp's rules are the shipped `name_seeded_by_ai` rules (`workflow_authoring.py`,
# the sibling block directly above the new one), plus ONE widening that is D-07 made
# mechanical. Every case below is modelled line for line on the shipped analog pair,
# `test_187_authoring_step_names.py:241-292`.
#
# ⚠ NOTHING HERE IS A FREQUENCY CLAIM. Each case STUBS what the model emitted and asserts
# what the SERVER does with it. Whether a real model fills the field at all is measured
# k/N by plan 193.2-08 — see this module's D-08 header, which binds this section too.

# The describe text every `_generate()` below sends unless a case overrides it. Named once
# so the D-07 copy cases can be written against the SAME string the service receives — a
# hand-retyped copy in each case would be free to drift from the one actually passed.
DESCRIBE_TEXT = "Write a renewal brief every quarter."

# The shipped CLIENT placeholder (`frontend/src/pages/WorkflowBuilderPage.tsx:383`). It is
# named here ONLY so the D-08 case can assert the server never writes it into a definition.
# It is a placeholder attribute on an input, not a value — see that case's docstring.
REQUIREMENT_INVITATION = "What must this workflow deliver? · required to publish"


# The "the model emitted no such key at all" sentinel. A genuinely different input from
# `None` and from `""`, and the analog draws the same three-way distinction
# (`_partially_named_definition_dict`: named / blank / absent).
_ABSENT = object()


def _definition_dict_with_requirement(requirement) -> dict:
    """`_named_definition_dict()` plus a `business_requirement`.

    Passing the sentinel `_ABSENT` leaves the key OFF entirely, which is a genuinely
    different input from `None` and from `""`: it is what a model that ignored the
    instruction emits, and the analog's `_partially_named_definition_dict` makes the same
    three-way distinction (named / blank / absent) for the same reason.
    """
    d = _named_definition_dict()
    if requirement is not _ABSENT:
        d["business_requirement"] = requirement
    return d


def _expected_stamp(requirement, describe: str) -> bool:
    """THE RULE, restated as a property, computed from the inputs.

    This is the closing-assertion device the analog uses
    (`test_187_authoring_step_names.py:269-271`): after the enumerated cases assert
    specific values, the rule is restated over the whole definition so a branch the
    enumeration missed still fails. Kept deliberately independent of the service's own
    expression — it is written from the RULE ("non-empty, and not a normalised copy of
    the describe text"), so a service-side rewrite that changes behaviour cannot be
    mirrored into this helper by accident.
    """
    if requirement is _ABSENT or not requirement or not requirement.strip():
        return False

    def norm(s: str) -> str:
        return " ".join(s.split()).casefold()

    return norm(requirement) != norm(describe)


async def _generate_emitting(monkeypatch, definition_dict: dict, **overrides):
    """Drive ONE generation whose single emit is `definition_dict`, and return the result."""
    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    _patch_emit(monkeypatch, [{"emitted": _wd(definition_dict), "failure": None}])
    kwargs = {"describe": DESCRIBE_TEXT}
    kwargs.update(overrides)
    return await _generate(**kwargs)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("requirement", "expected"),
    [
        pytest.param(
            "Produce a client-ready renewal brief for a named account from our own records.",
            True,
            id="a-real-durable-requirement-is-stamped",
        ),
        pytest.param("", False, id="empty-string-is-never-stamped"),
        pytest.param("   ", False, id="whitespace-only-is-never-stamped"),
        pytest.param("\n\t  \n", False, id="whitespace-of-other-kinds-is-never-stamped"),
        pytest.param(_ABSENT, False, id="an-absent-key-is-never-stamped"),
    ],
)
async def test_the_requirement_stamp_is_never_true_for_an_empty_value(
    monkeypatch, requirement, expected
):
    """**F-6** — the stamp records provenance for a value that EXISTS, and never otherwise.

    The rule is inherited verbatim from the shipped `name_seeded_by_ai` stamp and its
    reason is quoted in the service beside it: *provenance for a value that does not exist
    would make the demote-on-edit rule read a lie.* A model that ignores the instruction,
    or emits whitespace, has not seeded anything, and the server must not claim it did.

    ⚠ This asserts what the SERVER does with a given emission. It says nothing about how
    often any model emits one — D-08, see this module's header.
    """
    result = await _generate_emitting(
        monkeypatch, _definition_dict_with_requirement(requirement)
    )

    assert result["ok"] is True
    wd = _wd(result["definition"])
    assert wd.business_requirement_seeded_by_ai is expected

    # The rule restated as the property it is, computed from the input rather than
    # enumerated — the analog's closing device.
    assert wd.business_requirement_seeded_by_ai is _expected_stamp(
        requirement, DESCRIBE_TEXT
    )


@pytest.mark.asyncio
async def test_the_stamp_is_the_rule_as_a_property_across_every_shape_at_once(monkeypatch):
    """The property restatement, swept over EVERY input shape in one case.

    The parametrized case above proves each shape individually; this one asserts the
    single rule holds across all of them together, so a stamp that happened to be right
    for five inputs by five different accidents still fails here. It is the shape of
    `test_187_authoring_step_names.py:269-271`, adapted from a per-phase list to a
    definition-level field by sweeping generations instead of phases.
    """
    shapes = [
        "Produce a client-ready renewal brief for a named account from our own records.",
        "",
        "   ",
        _ABSENT,
        DESCRIBE_TEXT,  # the D-07 copy — refused for a DIFFERENT reason, same rule
        f"  {DESCRIBE_TEXT.upper()}  ",  # the normalised copy
    ]

    observed: list[bool] = []
    for shape in shapes:
        result = await _generate_emitting(
            monkeypatch, _definition_dict_with_requirement(shape)
        )
        observed.append(_wd(result["definition"]).business_requirement_seeded_by_ai)

    assert observed == [_expected_stamp(s, DESCRIBE_TEXT) for s in shapes]
    # Non-vacuity: the sweep must contain BOTH verdicts, or it would pass over a stamp
    # that is unconditionally one value.
    assert True in observed and False in observed


@pytest.mark.asyncio
async def test_the_stamp_ignores_a_provenance_claim_of_FALSE_in_the_emitted_payload(
    monkeypatch,
):
    """T-193.2-03b, the adversarial half — direction one.

    `WF_SCHEMA` is `WorkflowDefinition.model_json_schema()`, so adding the field to the
    model means the emit tool now ADVERTISES this flag to the model. A model that emits
    `business_requirement_seeded_by_ai: false` alongside text it just wrote does NOT get
    to launder that text into looking hand-typed. The server stamps after validation,
    unconditionally, from the VALUE — never from the claim.

    This is the exact shape of `test_187_authoring_step_names.py:275-292`.
    """
    d = _definition_dict_with_requirement(
        "Produce a client-ready renewal brief for a named account from our own records."
    )
    d["business_requirement_seeded_by_ai"] = False  # the model's (ignored) claim

    result = await _generate_emitting(monkeypatch, d)

    assert _wd(result["definition"]).business_requirement_seeded_by_ai is True


@pytest.mark.asyncio
async def test_the_stamp_ignores_a_provenance_claim_of_TRUE_on_an_empty_value(monkeypatch):
    """T-193.2-03b, the adversarial half — direction two, and the analog does NOT have it.

    The mirror matters as much as the first direction: a model claiming `true` beside an
    EMPTY requirement would manufacture a mark for a value that does not exist, which is
    precisely the lie F-6 exists to prevent — arriving by a different door. A stamp that
    merely *overrode* a `false` claim would pass the case above and fail here.
    """
    d = _definition_dict_with_requirement("   ")
    d["business_requirement_seeded_by_ai"] = True  # the model's (ignored) claim

    result = await _generate_emitting(monkeypatch, d)

    assert _wd(result["definition"]).business_requirement_seeded_by_ai is False


# ── D-07 made mechanical: an echo of the describe text earns no mark ─────────────────────


@pytest.mark.asyncio
async def test_a_byte_identical_copy_of_the_describe_text_is_refused_the_mark(monkeypatch):
    """**D-07** — a requirement that is the describe text back again is not a durable
    requirement, and is refused provenance.

    `SEED-163` is explicit: `describe` is ONE RUN's task instruction; the requirement is
    what the workflow must deliver on ANY run. This is also the mechanical part of
    **T-193.2-03**'s mitigation — after this phase a model authors the criterion a model
    later grades against (`JUDGE_RUBRIC_CORE` → `answers_business_requirement`), and
    echoing the instruction back is the cheapest way to produce a criterion the judge
    cannot fail.

    ⚠ The refusal is of the MARK, not of the value. The text is still emitted, still
    editable, and still passes publish stage 1 — D-09 does not change the gate.
    """
    result = await _generate_emitting(
        monkeypatch, _definition_dict_with_requirement(DESCRIBE_TEXT)
    )

    wd = _wd(result["definition"])
    assert wd.business_requirement_seeded_by_ai is False
    # The VALUE survives untouched — nothing is deleted, blanked or rewritten.
    assert wd.business_requirement == DESCRIBE_TEXT


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "variant",
    [
        pytest.param(f"   {DESCRIBE_TEXT}   ", id="leading-and-trailing-whitespace"),
        pytest.param(DESCRIBE_TEXT.upper(), id="upper-cased"),
        pytest.param(DESCRIBE_TEXT.lower(), id="lower-cased"),
        pytest.param(
            DESCRIBE_TEXT.replace(" ", "   "), id="internal-whitespace-runs-widened"
        ),
        pytest.param(
            f"\n  {DESCRIBE_TEXT.swapcase()}\t", id="mixed-whitespace-and-case"
        ),
    ],
)
async def test_a_copy_differing_only_by_whitespace_or_case_is_still_refused(
    monkeypatch, variant
):
    """D-07 — the refusal survives the cheapest evasions.

    A comparison on the raw strings would be defeated by a trailing newline. The service
    normalises both sides (strip + whitespace collapse + casefold) before comparing.

    ⚠ Normalisation is where a control like this rots into a similarity metric. It must
    not: the next case proves a genuinely different requirement built on the SAME describe
    text still earns the mark, so the refusal cannot pass for the wrong reason.
    """
    result = await _generate_emitting(
        monkeypatch, _definition_dict_with_requirement(variant)
    )

    assert _wd(result["definition"]).business_requirement_seeded_by_ai is False


@pytest.mark.asyncio
async def test_a_genuinely_durable_requirement_on_the_same_describe_still_earns_the_mark(
    monkeypatch,
):
    """THE CONTROL for the two cases above — without it, they could both pass because the
    stamp is simply never true.

    Same `describe`, a requirement that is a real durable statement rather than an echo.
    It shares vocabulary with the describe text on purpose ("renewal brief"), because that
    is the ORDINARY case and a refusal that fired on shared vocabulary would deny the mark
    to almost every honest requirement — the failure mode the service's own comment warns
    the normalisation must never grow into.
    """
    durable = (
        "Produce a client-ready renewal brief for a named account, sourced only from our "
        "own records."
    )
    assert durable != DESCRIBE_TEXT
    assert "renewal brief" in durable and "renewal brief" in DESCRIBE_TEXT

    result = await _generate_emitting(
        monkeypatch, _definition_dict_with_requirement(durable)
    )

    assert _wd(result["definition"]).business_requirement_seeded_by_ai is True


# ── D-08, restated where it binds: the fallback writes NOTHING server-side ───────────────


@pytest.mark.asyncio
async def test_the_fallback_writes_no_substitute_string_server_side(monkeypatch):
    """**D-08** — when the emit carries no requirement, the field stays absent and the
    flag is False. The server writes NO substitute text.

    The shipped `REQUIREMENT_INVITATION` is a CLIENT `placeholder` attribute on an input
    (`frontend/src/pages/WorkflowBuilderPage.tsx:383`) — a prompt the author sees in an
    empty box, never a value. A second copy of it written into the definition here would
    be a stored string that reads as an answer, and every downstream reader (publish stage
    1's non-emptiness predicate; the judge's rubric) would treat it as one. That is the
    `SEED-159` failure — a blank that lies is not an improvement on a missing answer.

    ⚠ READ THIS BEFORE ADDING A SIBLING CASE. This asserts the FALLBACK is intact. It is
    NOT the inverse of an "always populated" claim, and no such claim may be added to this
    file — see the module header. The frequency is 193.2-08's k/N measurement.
    """
    result = await _generate_emitting(
        monkeypatch, _definition_dict_with_requirement(_ABSENT)
    )

    assert result["ok"] is True
    definition = result["definition"]
    assert definition["business_requirement"] is None
    assert definition["business_requirement_seeded_by_ai"] is False
    # No new failure mode, and no substitute string ANYWHERE in the emitted definition.
    assert "error" not in result
    assert REQUIREMENT_INVITATION not in json.dumps(definition)


@pytest.mark.asyncio
async def test_the_stamp_lands_before_the_slug_mint_and_survives_the_json_dump(monkeypatch):
    """The stamp is on the SINGLE success path and reaches the returned payload.

    Two properties in one case, because they are the same claim from either end:

      * the slug was minted (the returned slug carries the uniquifying suffix), which is
        the step the stamp must land BEFORE — so a stamp accidentally placed after the
        `return` or on a discarded copy fails here;
      * `model_dump(mode="json")` carries the flag, so what the Builder receives (and
        PATCHes back) is the marked definition rather than a server-only fact.

    ⚠ It also pins the ZERO-MIGRATION property from the other side: the flag travels in
    the JSONB payload, which is why no file under `supabase/migrations/` was added.
    """
    d = _definition_dict_with_requirement(
        "Produce a client-ready renewal brief for a named account from our own records."
    )
    result = await _generate_emitting(monkeypatch, d)

    definition = result["definition"]
    assert definition["business_requirement_seeded_by_ai"] is True
    assert definition["slug"] != d["slug"]
    assert definition["slug"].startswith(f"{d['slug']}-")


@pytest.mark.asyncio
async def test_a_retry_emit_is_stamped_identically_to_a_first_emit(monkeypatch):
    """The stamp sits on the SINGLE success path, so attempt 2 is stamped like attempt 1.

    The shipped `name_seeded_by_ai` stamp states this rule in its own comment and the new
    stamp inherits it. It is asserted rather than trusted because the retry path is a
    separate `_shot()` call whose result flows into the SAME `wd`, and a stamp written
    inside the first branch would be invisible to a reader and silently absent here.
    """
    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)

    d = _definition_dict_with_requirement(
        "Produce a client-ready renewal brief for a named account from our own records."
    )
    calls = _patch_emit(
        monkeypatch,
        [
            {"emitted": None, "failure": "validation_failed"},  # attempt 1 fails
            {"emitted": _wd(d), "failure": None},  # attempt 2 validates
        ],
    )

    result = await _generate(describe=DESCRIBE_TEXT)

    assert len(calls) == 2  # the shipped budget: 1 then 2, never 3
    assert result["ok"] is True
    assert _wd(result["definition"]).business_requirement_seeded_by_ai is True


# ══ Phase 197 (AUTH-02 / D-13) — the SERVER'S OWN READINESS VERDICT ══════════════════════
#
# The arrival card RENDERS a verdict; it never DECIDES one (187-24). These cases pin the
# three properties that make that posture checkable:
#
#   1. the success payload carries the verdict, derived from the ONE shipped predicate;
#   2. the `missing` arm's sentence IS the shipped constant — asserted by identity against
#      the imported name, never against a string re-typed here (which would be the second
#      copy the whole D-12 arrangement exists to prevent);
#   3. the four honest-failure arms carry NOTHING (T-197-07).
#
# ⚠ NOTHING HERE IS A FREQUENCY CLAIM (D-08, this module's header binds this section too).
# Each case STUBS what the model emitted and asserts what the SERVER derives from it.

# The two-token status vocabulary, closed on purpose: a third token would be a state the
# publish gauntlet cannot produce.
READINESS_STATUSES = frozenset({"present", "missing"})


def _readiness_message_constant() -> str:
    """The shipped sentence, fetched from its ONE home at call time.

    Imported rather than re-typed for the reason the constant's own docblock gives: it
    reaches the author VERBATIM (`blockedReason` relays it and D-182-06 forbids a
    client-side message map), so a copy spelled in this file would be a second source free
    to drift from the gate's actual words while every assertion stayed green.
    """
    from app.services.harness.grounding import BUSINESS_REQUIREMENT_MISSING_MESSAGE

    return BUSINESS_REQUIREMENT_MISSING_MESSAGE


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("requirement", "expected_status"),
    [
        pytest.param(
            "Produce a client-ready renewal brief for a named account from our own records.",
            "present",
            id="a-stated-requirement-reads-present",
        ),
        pytest.param(_ABSENT, "missing", id="an-absent-key-reads-missing"),
        pytest.param("", "missing", id="an-empty-string-reads-missing"),
        pytest.param("   \n\t ", "missing", id="whitespace-only-reads-missing"),
    ],
)
async def test_the_success_payload_carries_the_servers_own_readiness_verdict(
    monkeypatch, requirement, expected_status
):
    """**D-13** — a freshly generated draft arrives carrying the server's verdict on
    whether it can be published, in the server's own words.

    The verdict is not a new rule. It is the ONE shipped publish predicate
    (`grounding.business_requirement_missing`, publish stage 1's own) read a second time
    at authoring time, so the client can render a truth the server already owns instead of
    re-deriving one of its own in TypeScript.

    ⚠ Both verdicts are exercised, so the case cannot pass over a derivation that is
    unconditionally one value.
    """
    result = await _generate_emitting(
        monkeypatch, _definition_dict_with_requirement(requirement)
    )

    assert result["ok"] is True
    verdict = result["readiness"]["business_requirement"]
    assert verdict["status"] in READINESS_STATUSES
    assert verdict["status"] == expected_status


@pytest.mark.asyncio
async def test_the_missing_arm_relays_the_gates_own_sentence_and_the_present_arm_is_silent(
    monkeypatch,
):
    """D-12 — the author sees the GATE'S words, and only when there is something to say.

    Two halves of one contract:

      * on `missing`, the message is the shipped constant **by identity** — the same
        object publish stage 1 would show. Compared against the imported name, never
        against a sentence spelled in this file.
      * on `present`, the key is **ABSENT**, not `None`. A nullable field is a two-arm
        read waiting to happen and the client's union depends on absence meaning absence.
    """
    constant = _readiness_message_constant()

    missing = await _generate_emitting(
        monkeypatch, _definition_dict_with_requirement(_ABSENT)
    )
    missing_verdict = missing["readiness"]["business_requirement"]
    assert missing_verdict["message"] == constant
    assert missing_verdict["message"] is constant  # the object, not a lookalike

    present = await _generate_emitting(
        monkeypatch,
        _definition_dict_with_requirement(
            "Produce a client-ready renewal brief for a named account from our own records."
        ),
    )
    present_verdict = present["readiness"]["business_requirement"]
    assert "message" not in present_verdict
    assert set(present_verdict) == {"status"}


@pytest.mark.asyncio
async def test_the_readiness_payload_carries_exactly_one_entry_and_no_row_data(monkeypatch):
    """**D-20 / T-197-04** — ONE verdict, and nothing else rides along.

    D-20 is a MEASUREMENT, not an omission: every gauntlet stage was enumerated from
    source and exactly one is a definition-level predicate. A payload carrying extra
    greens for things nothing refuses a publish for would be claims the server cannot
    make — strictly worse than no field at all.

    The information-disclosure half is the same assertion read the other way: a verdict
    that is exactly one status token plus one fixed server constant cannot carry a folder
    name, a folder id, a user id or any other row's data. The sweep drives BOTH arms so a
    payload that widened on only one of them still fails.
    """
    for requirement in (
        _ABSENT,
        "Produce a client-ready renewal brief for a named account from our own records.",
    ):
        result = await _generate_emitting(
            monkeypatch, _definition_dict_with_requirement(requirement)
        )
        readiness = result["readiness"]
        assert set(readiness) == {"business_requirement"}

        verdict = readiness["business_requirement"]
        assert set(verdict) <= {"status", "message"}
        # Every leaf is a token or the shipped constant — nothing derived from a row.
        for value in verdict.values():
            assert isinstance(value, str)
        # The stub user id the driver passes must not appear anywhere in the payload.
        assert "u1" not in json.dumps(readiness)


@pytest.mark.asyncio
async def test_a_could_not_generate_failure_carries_no_readiness_verdict(monkeypatch):
    """**T-197-07** — a failed generation makes NO claim about publishability.

    The honest-failure arms return `{ok: False, error, detail}` and gain nothing here. A
    verdict on a draft that does not exist would be the `SEED-159` shape — a value that
    reads as an answer where there is none — and the arrival card's union would have to
    defend against a state that means nothing.

    This drives the retry-exhausted arm: two failed emits, the shipped 1-then-2 budget.
    """
    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    calls = _patch_emit(monkeypatch, [{"emitted": None, "failure": "validation_failed"}])

    result = await _generate()

    assert len(calls) == 2  # non-vacuity: the failure arm was really reached
    assert result["ok"] is False
    assert result["error"] == "could_not_generate"
    assert "readiness" not in result
    assert "definition" not in result  # the shipped rule: a failure carries no draft


@pytest.mark.asyncio
async def test_a_grounding_failure_carries_no_readiness_verdict(monkeypatch):
    """T-197-07, a SECOND arm — because "no verdict on failure" is a property of the
    control flow, not of one branch.

    Grounding fidelity returns its own `ok: False` dict and returns it DIRECTLY, from a
    point earlier than the success path's derivation. A verdict attached by a future edit
    at the top of the function rather than at the bottom would pass the case above (whose
    return is later still) and fail here.
    """
    import app.services.workflow_authoring as wa

    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    _patch_emit(monkeypatch, [{"emitted": _wd(_named_definition_dict()), "failure": None}])

    async def _fake_fidelity(*_args, **_kwargs):
        return {"ok": False, "error": "grounding_failed", "detail": "planted violation"}

    monkeypatch.setattr(wa, "_check_grounding_fidelity", _fake_fidelity)

    result = await _generate()

    assert result["ok"] is False
    assert result["error"] == "grounding_failed"  # non-vacuity: the arm was reached
    assert "readiness" not in result


def test_the_generate_path_declares_no_predicate_and_no_message_of_its_own():
    """**T-197-03 / 187-24** — the authoring path is a CONSUMER, never a second home.

    `grounding.py`'s own section header states the rule: *the shared publish invariant —
    one source, even trivial*. This case makes the posture mechanical rather than a claim
    in a comment: the service module must contain NO assignment of the message constant
    and NO definition of the predicate, and must import both from the one home.

    Read off the SOURCE rather than off the module object, because a re-implementation
    that happened to produce equal values would be invisible to a behavioural assertion —
    and that silent second copy is exactly what this fences.
    """
    import inspect

    import app.services.workflow_authoring as wa

    source = inspect.getsource(wa)

    assert not re.search(r"BUSINESS_REQUIREMENT_MISSING_MESSAGE\s*[:=]", source), (
        "the authoring path declares its own copy of the gate's sentence"
    )
    assert "def business_requirement_missing" not in source, (
        "the authoring path re-implements the shipped publish predicate"
    )
    assert "from app.services.harness.grounding import" in source, (
        "the authoring path must consume the ONE home by import"
    )


# ══ Phase 197 (AUTH-02 / D-14) — HALF A: THE EMIT CONTRACT FENCE ═════════════════════════
#
# THE SHAPE THIS CATCHES, stated as a pattern rather than as one field: an authoring
# contract that ADVERTISES something the authoring path never asks for. That is the shape
# behind `SEED-157`, `SEED-163` and the AI-chosen name — three independently-recorded
# instances of one structural defect — so the fence is over the PATTERN, not over any
# particular field.
#
# ⚠ A NAIVE FENCE IS WRONG HERE, and that is the whole reason this file gets an allowlist
# rather than a one-line assertion. Measured: the emit tool advertises 15 top-level
# properties and the prompt names 7. Eight are advertised-and-not-asked TODAY and most of
# them are CORRECTLY so. A fence reading "every advertised field must be asked for" would
# be red on arrival and would be deleted within a week.
#
# ⚠ THIS IS TWO-DIRECTIONAL. A field ADDED to the model and not consciously routed reds on
# the commit that adds it; an entry REMOVED from the allowlist without the field being
# asked for also reds. The allowlist therefore cannot be grown to silence the test without
# a reason being written down — which is the only property that makes an allowlist worth
# anything.

#: Advertised by the emit tool, deliberately NOT asked for in the prompt — one entry per
#: field, each carrying its reason IN THE LITERAL (the shipped `ADMISSION_CASES` idiom:
#: a reason in a comment is not readable by the person who later wants to delete the row).
ADVERTISED_BUT_NOT_ASKED: dict[str, str] = {
    "output_target_folder": (
        "098 additive-optional SHAPE ONLY (D-08, `models/harness.py:528`) — the column "
        "exists so old JSONB rows validate; no shipped path reads it, so asking a model "
        "to fill it would manufacture a value nothing consumes"
    ),
    "reingest_output": (
        "098 additive-optional SHAPE ONLY (D-08, `models/harness.py:529`) — same reason "
        "as the field above; a defaulted bool nothing acts on"
    ),
    "version_policy": (
        "098 additive-optional SHAPE ONLY (D-08, `models/harness.py:530`) — a Literal "
        "with a shipped default; a model choosing between two tokens nothing reads is "
        "noise in the emit"
    ),
    "provenance": (
        "098 net-new FLAG with a shipped default (D-08, `models/harness.py:531`) — a "
        "provenance claim is a thing the SERVER decides, never a thing the model asserts "
        "about itself; cf. the stamp this file already fences in both directions"
    ),
    # ⚠ `inputs` WAS AN ENTRY HERE AND WAS REMOVED BY PHASE 214.1-02, WHICH IS THIS
    # ALLOWLIST'S TWO-DIRECTIONAL CONTRACT WORKING RATHER THAN BEING SILENCED. The row is
    # recorded here rather than deleted without trace, because its REASON was refuted by
    # measurement and that is the finding:
    #
    #   "the launch-form spec, authored on the visual canvas rather than at birth
    #    (`models/harness.py:532`) — a generated draft that invented launch inputs would
    #    hand the author a form nobody asked for"
    #
    # ⇒ REFUTED ON BOTH HALVES. (a) `BUG-260828-02` measured that a draft which declares
    # NOTHING is refused at publish with `ask_undeclared` and could not be repaired,
    # because no authoring surface could declare an input at all — so "authored on the
    # visual canvas" was not true of any canvas that existed. (b) SC#4 requires an
    # AI-drafted workflow to be publishable WITHOUT HAND-REPAIR, and the prompt clause plus
    # `_declare_asked_arguments` deliver that together. ⛔ Nothing is INVENTED: the
    # derivation writes only keys the model's own `arg_sources` already said would be asked
    # for at launch, so the form is exactly the one the draft asked for.
    "assets": (
        "template/reference refs, PRODUCED by the author-time binding door and consumed "
        "by `template_asset_service.resolve_template_source` (`models/harness.py:533`) — "
        "an asset ref names a real Storage path, so a model inventing one names a file "
        "that does not exist"
    ),
    "business_requirement_seeded_by_ai": (
        "the PROVENANCE stamp for the field above it — deliberately ignored from the "
        "model in BOTH directions and written server-side after validation "
        "(`workflow_authoring.py`, the 193.2 stamp block). Asking for it would invite "
        "exactly the laundering T-193.2-03b exists to refuse"
    ),
    "category": (
        "the Starters-shelf curation marker (`models/harness.py:575-581`) — it is in the "
        "schema so the fresh-copy STARTER FORK can round-trip it through create_draft "
        "without `extra='forbid'` raising; it is a curation fact, not an authoring choice"
    ),
    "is_stateful": (
        "205 (STATE-01) living-register mode. ⚠ UNLIKE EVERY ENTRY ABOVE, THIS FIELD IS "
        "REALLY READ — `harness_engine.run_workflow` gates the prior-run resolution on it "
        "— so 'shape only' is NOT the reason and must not be claimed. The reason is that "
        "the flag is HALF of a pair: it does nothing unless the phase prompts also "
        "reference `{{prior_run.output}}`. A model that flipped it true without writing "
        "those prompts would produce a workflow that resolves last week's deliverable and "
        "then ignores it — worse than stateless, because the author would believe it "
        "remembered. The toggle and the prompt must move together, and the canvas is the "
        "one place an author does both (the toggle in the builder header, the insert chips "
        "in the phase form). ⚠ THIS ROW USED TO SAY 'same shape as `inputs` above', AND "
        "214.1-02 MADE THAT COMPARISON FALSE — `inputs` LEFT this allowlist because its "
        "value is DERIVABLE from the emitted definition alone (the model's own `arg_sources` "
        "name the keys), whereas `is_stateful` is not: nothing in an emitted definition "
        "tells the server whether the phase prompts were written to consume last week's "
        "output. So the two rows part company here, and this one stays for a reason that "
        "is now its OWN rather than borrowed. ⚠ RE-OPEN TRIGGER: if the authoring prompt is ever taught "
        "to WRITE `{{prior_run.output}}` into the phase prompts it generates, then asking "
        "for this flag becomes coherent and it should move out of this allowlist in the "
        "same commit."
    ),
}


def _fields_named_in_prompt(properties) -> set[str]:
    """The ASKED set: advertised property names that occur in the authoring prompt.

    Deliberately crude — a membership test, not a parser — for the same reason
    `_sentences_naming` above is crude: it is a PROPERTY EXTRACTOR. A field the prompt
    mentions anywhere has been consciously routed; a field it never mentions has not.
    """
    prompt = _prompt()
    return {name for name in properties if name in prompt}


def _advertised_but_not_asked(schema: dict) -> set[str]:
    """THE CHECKER, taking its schema as an argument so the positive control can hand it a
    modified copy. A checker that could only ever read the real schema could never be
    shown to fire.
    """
    properties = schema["properties"]
    return set(properties) - _fields_named_in_prompt(properties)


def test_every_advertised_but_not_asked_entry_carries_a_reason():
    """The allowlist's ONLY defence is that a row costs an explanation to add.

    An entry with an empty reason is a silenced test wearing the costume of a documented
    decision, so emptiness is refused mechanically rather than by review.
    """
    assert ADVERTISED_BUT_NOT_ASKED, "an empty allowlist would make the fence below vacuous"
    assert all(isinstance(v, str) and v.strip() for v in ADVERTISED_BUT_NOT_ASKED.values())


def test_the_advertised_but_not_asked_set_is_exactly_the_reasoned_allowlist():
    """**D-14 half A** — the emit contract advertises nothing unrouted.

    SET EQUALITY, in both directions and on purpose:

      * a property ADDED to `WorkflowDefinition` (and therefore to `WF_SCHEMA`, which is
        the model's own `model_json_schema()`) that the prompt never mentions turns this
        red **on the commit that adds it** — the D-22 shape, caught at authoring time
        rather than discovered as a live gap months later;
      * an entry REMOVED from the allowlist while the field is still unasked ALSO reds, so
        the allowlist cannot be quietly emptied.

    ⚠ It asserts nothing about which side any field SHOULD be on. That is a judgement, and
    the allowlist is where the judgement is written down.
    """
    from app.services.workflow_authoring import WF_SCHEMA

    properties = WF_SCHEMA["properties"]
    asked = _fields_named_in_prompt(properties)

    # non-vacuity, both ways — a corpus that collapsed to empty, or a prompt that
    # mentioned nothing, would make the equality trivially satisfiable.
    assert len(properties) >= 15, "the advertised contract looks truncated"
    assert asked, "no advertised property is named in the prompt — the checker is blind"

    assert _advertised_but_not_asked(WF_SCHEMA) == set(ADVERTISED_BUT_NOT_ASKED)


def test_positive_control_the_checker_reports_a_synthetic_advertised_field():
    """THE SYNTHETIC PLANT — proof the checker KEEPS firing once every real instance is
    allowlisted.

    Without it, the case above could pass forever because the checker had gone blind, and
    an absence assertion over a blind checker is indistinguishable from a clean tree. This
    is the standing rule from 192.1 and SC#3 in 196: every fence carries a control.

    ⚠ The fabricated name is ASSEMBLED AT RUNTIME from fragments and appears nowhere in
    this file as a contiguous literal. These fences read raw sources by membership, so a
    needle spelled out in prose becomes a needle the fence then finds — the trap that hit
    four times in `196-08`, once inside the comment written to explain the first three.
    """
    from app.services.workflow_authoring import WF_SCHEMA

    planted = "_".join(("plant", "ed", "unrouted", "prop"))
    assert planted not in _prompt(), "the plant must be genuinely unasked-for"
    assert planted not in ADVERTISED_BUT_NOT_ASKED, "the plant must be genuinely unrouted"

    modified = copy.deepcopy(WF_SCHEMA)
    modified["properties"][planted] = {"type": "string"}

    reported = _advertised_but_not_asked(modified)

    assert planted in reported, "the checker cannot see a newly advertised, unasked field"
    assert reported != set(ADVERTISED_BUT_NOT_ASKED), (
        "the fence above would not have gone red on this plant"
    )
    # The real schema object is untouched — the control must not contaminate the fence.
    assert planted not in WF_SCHEMA["properties"]


# ══ Phase 197 (AUTH-02 / D-14) — HALF B: THE REQUEST CONTRACT FENCE ══════════════════════
#
# The same pattern from the other side of the wire. Half A asks *"does the authoring path
# ASK for everything its contract advertises?"*; half B asks *"does the client SEND
# everything the server ACCEPTS?"* Both failures look identical from a user's seat — a
# capability that exists in a type and nowhere in the product.
#
# ⚠ THIS FENCE'S POSITIVE CONTROL IS REAL, NOT PLANTED. It was landed with an EMPTY
# allowlist and observed RED against a live, independently-recorded, currently-unclosed
# instance in the tree — so it has been exercised against the wild rather than against
# something its author invented. The RED output is quoted in this plan's SUMMARY. The
# synthetic control in half A covers the complementary property (that it keeps firing once
# every real instance is allowlisted).
#
# ⚠ THE NEEDLE TRAP, stated by ROLE because stating it by name would spring it: this fence
# reads a FRONTEND SOURCE FILE and decides "sent" by membership. A comment added to that
# file naming one of the request fields would therefore be read as evidence that the field
# is sent, and the fence would go quietly green on an unwired channel. Comments are
# stripped before the membership test for exactly this reason, and no plan may rely on
# that stripping as a licence to name a field in prose over there.

#: The ONE production call site of the generation route, as repo-relative path SEGMENTS —
#: joined against a root derived from `__file__`, never an absolute path (a hard-coded one
#: is wrong in every worktree, and this suite runs in worktrees routinely).
_GENERATE_CALL_SITE = (
    "frontend",
    "src",
    "components",
    "workflows",
    "useTemplateFirstDraft.ts",
)

#: Accepted by the request model, never sent by the call site above — with the measured
#: reason, in the literal.
#:
#: ⚠ THE ONE ENTRY HERE IS A CONFESSION OF A LIVE DEFECT, NOT A DISMISSAL OF ONE. The fence
#: was landed with this mapping EMPTY and observed RED against it (the output is quoted in
#: `197-02-SUMMARY.md`), which is why this file's half-B control is real rather than
#: planted. It is allowlisted rather than fixed because wiring the channel means either
#: widening the server's type or changing what the upload door mints — a change to the
#: template-binding contract, which is `AUTH-03`'s surface and not `AUTH-02`'s.
#:
#: RE-OPEN TRIGGER: the next phase that takes up template binding. Deleting this entry
#: without wiring the field reds the fence, which is the point.
ACCEPTED_BUT_NEVER_SENT: dict[str, str] = {
    "template_asset_id": (
        "`SEED-157` instance 1, half-closed: 193.1-07 wired the placeholders arm and left "
        "this one. MEASURED — the field is typed `UUID | None` while the Phase-193 upload "
        "door mints a STORAGE PATH, so passing a real asset id is a 422 before the handler "
        "runs (the identical defect found the same day on the grounding-bundle route, "
        "`260814-q5r-SUMMARY.md`). The channel is UNWIRABLE AS TYPED, so the client cannot "
        "send it and no amount of frontend work would change that. Wiring it is a "
        "template-binding contract change — AUTH-03's surface, not AUTH-02's. RE-OPEN: the "
        "next phase that takes up template binding"
    ),
}


def _repo_root():
    from pathlib import Path

    # <root>/backend/tests/unit/<this file>
    return Path(__file__).resolve().parents[3]


def _generate_call_site_source() -> str:
    """The call site's source with comments stripped — see the needle-trap note above."""
    raw = _repo_root().joinpath(*_GENERATE_CALL_SITE).read_text(encoding="utf-8")
    without_blocks = re.sub(r"/\*.*?\*/", " ", raw, flags=re.DOTALL)
    return re.sub(r"//[^\n]*", " ", without_blocks)


def _request_fields() -> set[str]:
    from app.api.workflows import GenerateRequest

    return set(GenerateRequest.model_fields)


def _accepted_but_never_sent() -> set[str]:
    source = _generate_call_site_source()
    return {name for name in _request_fields() if name not in source}


def test_the_generation_call_site_is_readable_and_really_is_the_call_site():
    """NON-VACUITY for the fence below, and it needs three separate proofs.

    A fence that reads a file by path can fail silently in three ways — the path stops
    resolving, the file stops being the call site, or the comment stripping eats the code.
    Each is checked rather than assumed:

      * the file resolves and is non-empty;
      * it really is a caller of the generation route (it names the client function);
      * stripping removed something and left the CODE — a stripper that ate the file would
        report every field as never-sent, and a stripper that did nothing would report
        every field as sent.

    ⚠ THE SURVIVAL CHECK IS OVER TOKENS, NEVER OVER A CHARACTER RATIO, and that is a
    measurement rather than a preference. This call site is **32,762 raw characters and
    8,048 stripped — 75% comment by character**, because the module documents every wire
    decision it makes at length. A plausible-looking `len(stripped) > len(raw) // 2` guard
    is therefore FALSE on the very file it is guarding, and would have to be re-tuned every
    time someone documents something. A token that must survive cannot rot that way.
    """
    raw = _repo_root().joinpath(*_GENERATE_CALL_SITE).read_text(encoding="utf-8")
    stripped = _generate_call_site_source()

    assert raw.strip(), "the call site is empty or unreadable"
    assert "generateWorkflow" in stripped, "this file is not the generation call site"
    assert len(stripped) < len(raw), "comment stripping removed nothing"
    for token in ("import", "export", "await", "function"):
        assert token in stripped, f"comment stripping ate the code — {token!r} is gone"

    fields = _request_fields()
    assert len(fields) >= 4, "the request contract looks truncated"
    # The checker must see BOTH verdicts on the real tree, or it proves nothing.
    assert _accepted_but_never_sent() != fields, "no field reads as sent — the fence is blind"


def test_every_accepted_request_field_is_either_sent_or_allowlisted_with_a_reason():
    """**D-14 half B** — the request contract promises nothing the product never uses.

    SET EQUALITY, for the same two-directional reason half A is: a field ADDED to the
    request model and never wired reds on the commit that adds it, and an entry REMOVED
    from the allowlist without the field being wired also reds.

    ⚠ An entry here is a CONFESSION, not a fix. It records that the server accepts
    something no user action can produce, with the measurement that explains why, and it
    is the correct state only while wiring the channel would be a different phase's
    contract change.
    """
    assert all(
        isinstance(v, str) and v.strip() for v in ACCEPTED_BUT_NEVER_SENT.values()
    ), "an allowlist entry without a reason is a silenced test in costume"

    assert _accepted_but_never_sent() == set(ACCEPTED_BUT_NEVER_SENT)
