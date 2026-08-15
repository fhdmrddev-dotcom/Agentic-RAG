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
