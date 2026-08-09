"""Phase 187 (VOCAB-01 / VOCAB-02, SPEC Req 2 + Req 3) — the per-step `name` the NL
generator authors, and the server-side provenance stamp that records it wrote them.

WHY THIS FILE EXISTS. Measured at plan time: **0 of 57** phases across the 27
well-formed `workflow_definitions` rows carry a non-empty `name`, so `nodeTitle()`
falls through its first tier 100% of the time and every node face on every workflow
is one of exactly six type sentences. `PhaseSpec.name` already lives inside the
`extra="forbid"` union, so closing that gap is one sentence in a prompt string plus
one additive boolean — no schema surface, no migration.

Behaviours proven (forced_emit + the grounding accessors mocked at their boundaries —
**NO live provider, NO network, NO agent loop**; plan 187-07 owns the live 8-row
roster):

  - test_every_generated_phase_carries_a_name — Req 2: every phase of a generated
    definition has a non-empty `name`.
  - test_authoring_prompt_instructs_a_per_phase_name — the prompt CONSTANT asks for a
    phase-scoped `name`, asserted as a source-level property of the constant rather
    than as a hand-typed copy of the sentence (the prose is Claude's discretion; the
    contract is not).
  - test_named_phases_are_stamped_as_ai_seeded — Req 3 / T-187-02-02: the marker is
    stamped SERVER-SIDE after validation. A named phase reads True; a phase whose
    emitted `name` is blank or absent reads False.
  - test_budget_is_one_call_on_a_valid_first_emit /
    test_budget_is_exactly_two_calls_on_a_first_pass_failure — T-187-02-03: the
    provider-call budget is 1 / 2 and NEVER 3. A prompt-text change cannot alter
    control flow, but this pins it so a future edit that adds a shot fails loudly.
  - test_stamped_definition_still_validates_and_passes_fidelity — the stamp is a
    `model_copy`, so the returned payload is still a clean `WorkflowDefinition` and
    `_check_grounding_fidelity` still ran on it.

CONVENTION (Phase 102/103 posture): imports INSIDE the test bodies; `forced_emit` is
patched on the module it is imported FROM (`app.services.forced_emit`) because
`generate_workflow_definition` imports it function-locally. `settings` is passed as a
PARAMETER (`workflow_authoring.py:222`) — no global is monkeypatched for it.
"""

from __future__ import annotations

import copy
from types import SimpleNamespace

import pytest

# A stub Settings. `generate_workflow_definition` takes `settings` as a parameter, so
# a roster row (or a test) supplies its own — zero global mutation, zero contamination.
STUB_SETTINGS = SimpleNamespace(harness_authoring_model="claude-opus-4-8")


def _named_definition_dict() -> dict:
    """A valid WorkflowDefinition whose every phase carries a short, specific,
    plain-language `name` — i.e. what Req 2's prompt instruction asks the model for.

    No tools / skills / folder_scope, so grounding fidelity is trivially clean.
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
            {
                "slug": "write",
                "phase_index": 1,
                "name": "Draft the renewal summary",
                "config": {"phase_type": "llm_single", "prompt": "Draft the summary."},
                "validators": [],
            },
        ],
    }


def _partially_named_definition_dict() -> dict:
    """The honest mixed case: one named phase, one BLANK name, one ABSENT name.

    A model that ignores the instruction (or emits whitespace) must NOT be recorded as
    having seeded a name — the marker is provenance, and claiming provenance for a
    name that does not exist would make the demote-on-config-edit rule (D-187-07) read
    a lie.
    """
    d = _named_definition_dict()
    d["phases"].append(
        {
            "slug": "blank",
            "phase_index": 2,
            "name": "   ",  # whitespace only — trims empty
            "config": {"phase_type": "llm_single", "prompt": "Blank-named step."},
            "validators": [],
        }
    )
    d["phases"].append(
        {
            "slug": "absent",
            "phase_index": 3,
            # no `name` key at all
            "config": {"phase_type": "llm_single", "prompt": "Unnamed step."},
            "validators": [],
        }
    )
    return d


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


# ── the stubs. NOTE the provider name: `STUB_PROVIDER` is deliberately a string that
# matches NO real provider in the gateway. `forced_emit` is patched out entirely, so
# the value is never routed on — and naming a fake one makes "this file cannot reach a
# network" self-evident rather than a claim in a docstring.
STUB_PROVIDER = "stub-provider-not-a-real-one"


def _patch_provider(monkeypatch):
    """Make get_model_capability(authoring_model) resolve a (fake) provider."""
    import app.config as cfg

    monkeypatch.setattr(
        cfg,
        "get_model_capability",
        lambda model: {"forced_emission": True, "provider": STUB_PROVIDER},
    )


def _patch_user_settings(monkeypatch):
    """The gateway resolves its key from a per-USER settings object; the real loader
    reads Supabase. Stub it so nothing touches the DB."""
    import app.models.user_settings as us

    monkeypatch.setattr(
        us, "load_user_settings", lambda _uid: SimpleNamespace(active_provider=STUB_PROVIDER)
    )


def _patch_emit(monkeypatch, responses: list[dict]) -> list[dict]:
    """Patch `forced_emit` on the module it is imported FROM and return the recorded
    call list, so the provider-call BUDGET is directly observable."""
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


# ── Req 2: the generator authors a per-step name ────────────────────────────────


@pytest.mark.asyncio
async def test_every_generated_phase_carries_a_name(monkeypatch):
    """Req 2 acceptance: every phase of a generated definition has a non-empty `name`.

    Asserted over the RE-VALIDATED returned payload (the service returns
    `model_dump(mode="json")`), so this measures what a caller actually receives.
    """
    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    _patch_emit(monkeypatch, [{"emitted": _wd(_named_definition_dict()), "failure": None}])

    result = await _generate()

    assert result["ok"] is True
    wd = _wd(result["definition"])
    assert wd.phases, "a generated definition with no phases proves nothing"
    assert all(p.name and p.name.strip() for p in wd.phases)


def test_authoring_prompt_instructs_a_per_phase_name():
    """The prompt CONSTANT asks for a phase-scoped `name`.

    Asserted as a source-level PROPERTY of the constant, never as a hand-typed copy of
    the sentence: the file header licenses the prose as Claude's discretion ("the
    contracts are locked, not the prose"), so a wording edit must not turn this red.

    The two properties that ARE the contract:
      1. `name` is requested more than once — the definition-level one the prompt has
         always asked for, PLUS at least one more.
      2. At least one sentence requesting a `name` is scoped to a PHASE, so the two
         requests are distinguishable to the model.
    """
    from app.services.workflow_authoring import AUTHORING_SYSTEM_PROMPT

    assert AUTHORING_SYSTEM_PROMPT.count("`name`") >= 2

    sentences = [
        s for s in AUTHORING_SYSTEM_PROMPT.replace("\n", " ").split(".") if "`name`" in s
    ]
    assert any("phase" in s.lower() for s in sentences), (
        "no sentence requesting a `name` is scoped to a phase — the model cannot tell "
        "the per-phase name from the definition-level one"
    )


# ── Req 3 / T-187-02-02: the server-side provenance stamp ───────────────────────


@pytest.mark.asyncio
async def test_named_phases_are_stamped_as_ai_seeded(monkeypatch):
    """Every phase whose emitted `name` trims non-empty reads `name_seeded_by_ai is
    True`; a blank or absent name reads False.

    T-187-02-02: the marker is stamped SERVER-SIDE after validation and is NEVER read
    off the model payload, so an emission cannot claim a name was hand-typed.
    """
    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    _patch_emit(
        monkeypatch, [{"emitted": _wd(_partially_named_definition_dict()), "failure": None}]
    )

    result = await _generate()

    assert result["ok"] is True
    wd = _wd(result["definition"])
    by_slug = {p.slug: p for p in wd.phases}

    assert by_slug["gather"].name_seeded_by_ai is True
    assert by_slug["write"].name_seeded_by_ai is True
    # Blank / absent → the generator did NOT seed a name, and we do not claim it did.
    assert by_slug["blank"].name_seeded_by_ai is False
    assert by_slug["absent"].name_seeded_by_ai is False

    # The rule stated once more as the property it is, over the whole definition.
    assert all(
        p.name_seeded_by_ai is bool(p.name and p.name.strip()) for p in wd.phases
    )


@pytest.mark.asyncio
async def test_the_stamp_ignores_a_provenance_claim_in_the_emitted_payload(monkeypatch):
    """T-187-02-02, the adversarial half: a model that emits
    `name_seeded_by_ai: false` alongside a real name does NOT get to launder its name
    into looking hand-typed. The server stamps after validation, unconditionally.
    """
    d = _named_definition_dict()
    for phase in d["phases"]:
        phase["name_seeded_by_ai"] = False  # the model's (ignored) claim

    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    _patch_emit(monkeypatch, [{"emitted": _wd(d), "failure": None}])

    result = await _generate()

    wd = _wd(result["definition"])
    assert all(p.name_seeded_by_ai is True for p in wd.phases)


# ── T-187-02-03: the provider-call budget is 1 / 2 and NEVER 3 ──────────────────


@pytest.mark.asyncio
async def test_budget_is_one_call_on_a_valid_first_emit(monkeypatch):
    """EXACTLY one provider call when the first emit validates — and never a second."""
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


@pytest.mark.asyncio
async def test_budget_is_exactly_two_calls_on_a_first_pass_failure(monkeypatch):
    """EXACTLY two provider calls when the first emit fails validation — never a 3rd.

    This is the regression that matters for Req 2: adding a name instruction is a
    prompt-TEXT change and must not buy an extra shot. If a future edit adds one, this
    goes red rather than silently doubling every generation's cost.
    """
    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    calls = _patch_emit(
        monkeypatch,
        [
            {"emitted": None, "failure": "1 validation error for WorkflowDefinition"},
            {"emitted": _wd(_named_definition_dict()), "failure": None},
        ],
    )

    result = await _generate()

    assert result["ok"] is True
    assert len(calls) == 2
    assert len(calls) != 3
    # The retry still carries the failure back to the model (the shipped REQ-2 b shape).
    assert "validation" in str(calls[1]["messages"]).lower()


@pytest.mark.asyncio
async def test_budget_never_reaches_three_calls_when_both_emits_fail(monkeypatch):
    """Two failures → an honest structured failure, NEVER a third call and NEVER a
    partial draft (REQ-2 c, unchanged by this phase)."""
    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    calls = _patch_emit(monkeypatch, [{"emitted": None, "failure": "nope"}])

    result = await _generate()

    assert result["ok"] is False
    assert result["error"] == "could_not_generate"
    assert "definition" not in result
    assert len(calls) == 2
    assert len(calls) != 3


# ── the stamp is additive: validation + fidelity are unchanged ──────────────────


@pytest.mark.asyncio
async def test_stamped_definition_still_validates_and_passes_fidelity(monkeypatch):
    """The stamp is a `model_copy`, not a mutation and not a new model — the returned
    payload still `model_validate()`s and `_check_grounding_fidelity` still ran on it.
    """
    import app.services.workflow_authoring as wa
    from app.models.harness import WorkflowDefinition

    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)

    async def _fake_assemble(**_kwargs):
        return ("GROUNDED", set(), set())

    monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)

    fidelity_saw: list[object] = []

    async def _spy_fidelity(wd_arg, **_kwargs):
        fidelity_saw.append(wd_arg)
        return None

    monkeypatch.setattr(wa, "_check_grounding_fidelity", _spy_fidelity)
    _patch_emit(monkeypatch, [{"emitted": _wd(_named_definition_dict()), "failure": None}])

    result = await _generate()

    assert result["ok"] is True
    # Fidelity ran, and it ran on a real WorkflowDefinition.
    assert len(fidelity_saw) == 1
    assert isinstance(fidelity_saw[0], WorkflowDefinition)
    # The returned payload is still strict-parse clean (extra="forbid" intact).
    revalidated = WorkflowDefinition.model_validate(result["definition"])
    assert revalidated.slug.startswith("renewal-brief-")  # the UAT-103 unique suffix survives
    assert len(revalidated.phases) == 2
