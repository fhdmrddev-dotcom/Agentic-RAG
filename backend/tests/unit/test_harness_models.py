"""Strict-parse contract tests for the harness config models (SC#5 / D-07).

These prove the ONLY phase-090 success criterion verifiable in mocked pytest —
the typed-config layer parses a valid seed workflow and rejects malformed config
with a structured ``ValidationError`` (no live Postgres; conftest mocks Supabase,
so RLS / immutability / DELETE-RESTRICT SCs live in ``supabase/verify_090.sql``).

  (a) test_valid_seed_parses        — a hand-authored seed (one PhaseSpec per
      phase_type, 5 entries) parses; each .config is the right concrete subclass
  (b) test_extra_key_rejected       — an unknown key in a phase config raises
      ValidationError (D-07 extra='forbid', threat T-090-01)
  (c) test_wrong_phase_type_rejected — phase_type:"not_a_phase" raises
      ValidationError (no discriminator match, threat T-090-02)
  (d) test_each_phase_config_validates — each minimal phase-config dict validates
      via PhaseSpec.model_validate() and selects the expected class. ⚠ The count in
      this bullet used to read "the 5" and the list itself held 5 of the 6 shipped
      members (`llm_emit` was never added at 101.1). Phase 189 adds BOTH the missing
      6th and its own 7th, and states the rule instead of a number: this list holds
      one entry per member of the ``PhaseConfig`` union, and (e) pins that.
  (e) test_the_phase_config_union_is_exactly_the_declared_members — 189 (D-01): the
      union's members, in order, with ``external_action`` LAST. Additive growth is
      safe; reordering or renaming a member orphans every stored row that uses it.

This file does NOT import the Supabase client or any conftest fixture — these are
pure-Python Pydantic validations.
"""

from __future__ import annotations

import copy

import pytest
from pydantic import ValidationError

from app.models.harness import (
    ExternalActionPhaseConfig,
    LlmAgentPhaseConfig,
    LlmBatchAgentsPhaseConfig,
    LlmEmitPhaseConfig,
    LlmHumanInputPhaseConfig,
    LlmSinglePhaseConfig,
    PhaseSpec,
    ProgrammaticPhaseConfig,
    WorkflowDefinition,
)

# A valid seed workflow with one PhaseSpec per phase_type (5 phases).
VALID_SEED = {
    "slug": "seed-workflow",
    "version": 1,
    "name": "Seed Workflow",
    "status": "published",
    "phases": [
        {
            "slug": "fetch",
            "phase_index": 0,
            "config": {"phase_type": "programmatic", "fn": "do_fetch"},
            "validators": [
                {"kind": "workspace_file_exists", "config": {"path": "out.txt"}}
            ],
        },
        {
            "slug": "summarize",
            "phase_index": 1,
            "config": {"phase_type": "llm_single", "prompt": "Summarize the input."},
        },
        {
            "slug": "research",
            "phase_index": 2,
            "config": {
                "phase_type": "llm_agent",
                "prompt": "Research the topic.",
                "available_tools": ["search_documents", "execute_code"],
                "max_steps": 12,
            },
        },
        {
            "slug": "fan-out",
            "phase_index": 3,
            "config": {
                "phase_type": "llm_batch_agents",
                "prompt": "Process each item.",
                "available_tools": ["execute_code"],
                "max_parallel_agents": 3,
                "merge_strategy": "concat",
            },
        },
        {
            "slug": "ask",
            "phase_index": 4,
            "config": {"phase_type": "llm_human_input", "prompt": "Approve?"},
        },
    ],
}

# (phase_index, expected concrete config class)
_EXPECTED_CONFIG_TYPES = [
    (0, ProgrammaticPhaseConfig),
    (1, LlmSinglePhaseConfig),
    (2, LlmAgentPhaseConfig),
    (3, LlmBatchAgentsPhaseConfig),
    (4, LlmHumanInputPhaseConfig),
]

# Minimal valid phase-config dict per phase_type → expected concrete class.
_MINIMAL_CONFIGS = [
    ({"phase_type": "programmatic", "fn": "f"}, ProgrammaticPhaseConfig),
    ({"phase_type": "llm_single", "prompt": "p"}, LlmSinglePhaseConfig),
    (
        {"phase_type": "llm_agent", "prompt": "p", "available_tools": ["t"]},
        LlmAgentPhaseConfig,
    ),
    (
        {"phase_type": "llm_batch_agents", "prompt": "p", "available_tools": ["t"]},
        LlmBatchAgentsPhaseConfig,
    ),
    ({"phase_type": "llm_human_input", "prompt": "p"}, LlmHumanInputPhaseConfig),
    # ── Phase 101.1 (D-04) — the 6th member. Measured 2026-08-07 while adding the 7th:
    # `llm_emit` was NEVER added to this list, so the shipped contract suite has been
    # proving 5 of 6 members since 101.1. Added here rather than left, because a list
    # that silently omits a member is how the next one gets omitted too.
    ({"phase_type": "llm_emit", "prompt": "p"}, LlmEmitPhaseConfig),
    # ── Phase 189 (CONN-01 / D-01) — the 7th member, appended.
    (
        {"phase_type": "external_action", "capability": "send_email"},
        ExternalActionPhaseConfig,
    ),
]


def test_valid_seed_parses():
    """A valid seed parses and each phase .config is the right concrete subclass."""
    wf = WorkflowDefinition.model_validate(VALID_SEED)
    assert isinstance(wf, WorkflowDefinition)
    assert len(wf.phases) == 5
    for idx, expected_cls in _EXPECTED_CONFIG_TYPES:
        assert type(wf.phases[idx].config) is expected_cls, (
            f"phase {idx} config resolved to {type(wf.phases[idx].config).__name__}, "
            f"expected {expected_cls.__name__}"
        )


def test_extra_key_rejected():
    """An unknown key inside a phase config raises ValidationError (D-07)."""
    bad = copy.deepcopy(VALID_SEED)
    bad["phases"][1]["config"]["bogus_field"] = 1
    with pytest.raises(ValidationError):
        WorkflowDefinition.model_validate(bad)


def test_wrong_phase_type_rejected():
    """An unknown discriminator value raises ValidationError (T-090-02)."""
    bad = copy.deepcopy(VALID_SEED)
    bad["phases"][1]["config"]["phase_type"] = "not_a_phase"
    with pytest.raises(ValidationError):
        WorkflowDefinition.model_validate(bad)


@pytest.mark.parametrize(
    "config_dict,expected_cls",
    _MINIMAL_CONFIGS,
    ids=[c[0]["phase_type"] for c in _MINIMAL_CONFIGS],
)
def test_each_phase_config_validates(config_dict, expected_cls):
    """Each minimal phase-config dict validates and selects the expected class."""
    spec = PhaseSpec.model_validate(
        {"slug": "s", "phase_index": 0, "config": config_dict}
    )
    assert type(spec.config) is expected_cls


def test_the_phase_config_union_is_exactly_the_declared_members():
    """189 (D-01) — the union GREW ADDITIVELY: 7 members, `external_action` LAST.

    Read off the annotation itself rather than eyeballed in a diff. Two properties, and
    the ORDER one is the load-bearing half: the module docblock's growth contract says
    what must not change is an existing member's SPELLING — renaming one orphans every
    stored row that uses it — so pinning the sequence catches a rename or a reorder that
    a membership-only assertion would sail past.
    """
    import typing

    from app.models.harness import PhaseConfig

    # PhaseConfig is Annotated[Union[...], Field(discriminator=...)]; the Union is arg 0.
    members = typing.get_args(typing.get_args(PhaseConfig)[0])
    assert [m.__name__ for m in members] == [
        "ProgrammaticPhaseConfig",
        "LlmSinglePhaseConfig",
        "LlmAgentPhaseConfig",
        "LlmBatchAgentsPhaseConfig",
        "LlmHumanInputPhaseConfig",
        "LlmEmitPhaseConfig",
        "ExternalActionPhaseConfig",
    ]
    # Every member is covered by the minimal-config parametrize above, so a member added
    # without a row there fails HERE rather than going silently untested.
    assert {c[1].__name__ for c in _MINIMAL_CONFIGS} == {m.__name__ for m in members}


def test_the_discriminated_union_mechanism_is_untouched_by_the_seventh_member():
    """189 (D-01) — `extra='forbid'` and the discriminator are LOCKED mechanism.

    The 7th member is additive INSIDE that mechanism, never a change to it. Asserted on
    the 7th member itself and on a shipped one, so "still forbids" cannot be true of only
    the old members.
    """
    for cls in (ExternalActionPhaseConfig, LlmSinglePhaseConfig):
        assert cls.model_config.get("extra") == "forbid", (
            f"{cls.__name__} does not reject unknown keys — D-07 / T-090-01"
        )

    bad = copy.deepcopy(VALID_SEED)
    bad["phases"].append(
        {
            "slug": "notify",
            "phase_index": 5,
            "config": {
                "phase_type": "external_action",
                "capability": "send_email",
                "bogus_field": 1,
            },
        }
    )
    with pytest.raises(ValidationError):
        WorkflowDefinition.model_validate(bad)


# ── Phase 185 (GOVERN-01 / GOVERN-03, D-185-06/07/08) — the two governance intents ──


def test_pre_185_phase_row_parses_without_the_governance_keys():
    """SPEC acceptance criterion 1: a PhaseSpec dict carrying NEITHER governance key
    still `model_validate()`s, and both attributes read False.

    This is the whole zero-migration claim. `PhaseSpec` is a `_StrictBase`
    (`extra="forbid"`), so the ONLY way a stored pre-185 `workflow_definitions` JSONB
    row keeps parsing is if both new fields are additive-optional — the same property
    `name` has carried since Phase 103. Every row in the table today is a pre-185 row.
    """
    spec = PhaseSpec.model_validate(
        {
            "slug": "research",
            "phase_index": 0,
            "config": {
                "phase_type": "llm_agent",
                "prompt": "Research the topic.",
                "available_tools": ["search_documents"],
            },
        }
    )

    assert spec.grounding_escalated is False
    assert spec.action_risk_armed is False
    # `False` is the ONLY absent-value (D-185-08): there is no `None` third state to
    # disambiguate, so "unset" and "explicitly off" are the same value on purpose.
    assert spec.model_dump(mode="json")["grounding_escalated"] is False
    assert spec.model_dump(mode="json")["action_risk_armed"] is False


def test_governance_intents_round_trip_through_model_dump():
    """Both intents survive a JSON round trip when explicitly authored.

    SIDE EFFECT WORTH RECORDING: `model_dump(mode="json")` now writes
    `"grounding_escalated": false, "action_risk_armed": false` into EVERY saved draft
    JSONB — including drafts that never touched governance. That is additive and
    harmless (it is identical to what `name: null` has done since Phase 103), but it
    does mean the first save of any pre-185 definition after this phase is NOT a
    zero-diff save. Nothing reads the keys yet; only the author's INTENT is stored
    (D-185-07) — `detected` and `already-set` are derived at read time and never
    persisted, so the dump below can never claim a cause.
    """
    spec = PhaseSpec.model_validate(
        {
            "slug": "send",
            "phase_index": 1,
            "config": {"phase_type": "llm_single", "prompt": "Draft the note."},
            "grounding_escalated": True,
            "action_risk_armed": True,
        }
    )

    dumped = spec.model_dump(mode="json")
    assert dumped["grounding_escalated"] is True
    assert dumped["action_risk_armed"] is True
    # No derived cause is ever stored — the JSONB carries intent and nothing else.
    assert "grounding_mode" not in dumped
    assert "grounding_cause" not in dumped

    assert PhaseSpec.model_validate(dumped).grounding_escalated is True
    assert PhaseSpec.model_validate(dumped).action_risk_armed is True


def test_action_risk_approval_is_a_registered_validator_kind():
    """The 10th `ValidatorSpec.kind` member parses (GOVERN-03 / D-185-12).

    `ValidatorSpec` is a `_StrictBase`, so an unlisted kind cannot even be
    CONSTRUCTED — the synthesized armed pre-gate plan 185-04 attaches would raise at
    build time without this Literal member. The pre-185 kinds all still validate.
    """
    from app.models.harness import ValidatorSpec

    spec = ValidatorSpec.model_validate(
        {"kind": "action_risk_approval", "timing": "pre", "on_failure": "ask_user"}
    )
    assert spec.kind == "action_risk_approval"
    assert spec.timing == "pre"

    # Control: growth is ADDITIVE — the shipped kinds are untouched.
    assert ValidatorSpec.model_validate({"kind": "citations_required"}).timing == "post"
    with pytest.raises(ValidationError):
        ValidatorSpec.model_validate({"kind": "not_a_registered_kind"})


# ── Phase 187 (VOCAB-01 / REQ-3, D-187-03) — the name provenance marker ──────────
#
# `name_seeded_by_ai` records WHO wrote the stored `name`: the NL generator, or a
# human. It rides the exact `grounding_escalated` shape — additive-optional,
# `bool = False`, zero migration — so every stored pre-187 row keeps parsing.


# A genuine STORED-ROW shape: a literal dict as it sits in the
# `workflow_definitions.definition` JSONB today, carrying neither `name` nor the
# 187 marker. Built as a literal rather than by constructing a PhaseSpec and
# deleting a field, so it measures what Postgres actually hands back.
PRE_187_PHASE_ROW = {
    "slug": "gather",
    "phase_index": 0,
    "config": {
        "phase_type": "llm_agent",
        "prompt": "Gather the renewal facts.",
        "available_tools": ["search_documents"],
    },
    "validators": [],
}


def test_pre_187_phase_row_parses_without_the_provenance_marker():
    """REQ-3 acceptance 1: a stored row carrying NEITHER `name` NOR the marker still
    `model_validate()`s, and the marker reads False.

    This is the whole zero-migration claim, restated for Phase 187. Measured live at
    plan time: 0 of 57 phases across the 27 well-formed `workflow_definitions` rows
    carry a non-empty `name`, so EVERY stored row today is this shape.
    """
    spec = PhaseSpec.model_validate(copy.deepcopy(PRE_187_PHASE_ROW))

    assert spec.name is None
    assert spec.name_seeded_by_ai is False
    # `False` is the ONLY absent-value (D-185-08's rule, inherited): there is no
    # `None` third state, so "unset" and "explicitly human-typed" are one value.
    assert spec.model_dump(mode="json")["name_seeded_by_ai"] is False


def test_name_provenance_marker_round_trips_through_model_dump():
    """REQ-3 acceptance 2: a marked phase survives a JSON round trip.

    The draft save path persists `model_dump(mode="json")`, so the marker only
    survives a save→load cycle if it dumps and re-parses as a plain boolean. Nothing
    DERIVED is stored alongside it — the node face is computed at render in
    `phaseVocabulary.ts` and never persisted.
    """
    row = copy.deepcopy(PRE_187_PHASE_ROW)
    row["name"] = "Gather the renewal facts"
    row["name_seeded_by_ai"] = True

    spec = PhaseSpec.model_validate(row)
    dumped = spec.model_dump(mode="json")

    assert dumped["name"] == "Gather the renewal facts"
    assert dumped["name_seeded_by_ai"] is True
    assert PhaseSpec.model_validate(dumped).name_seeded_by_ai is True


def test_misspelt_provenance_marker_is_still_rejected():
    """T-187-02-01: the `extra="forbid"` union is INTACT after the addition.

    A near-miss key is the tampering shape that matters — a stored row (or a model
    emission) claiming `name_seeded_by_AI` must 422 rather than silently landing in a
    field nobody reads.
    """
    row = copy.deepcopy(PRE_187_PHASE_ROW)
    row["name_seeded_by_AI"] = True  # wrong case — one character from the real key

    with pytest.raises(ValidationError):
        PhaseSpec.model_validate(row)


def test_full_pre_187_definition_validates_with_the_marker_absent_everywhere():
    """REQ-3 acceptance 3: a WHOLE stored definition parses, and every phase reads False.

    `VALID_SEED` is the 5-phase-type literal this module has carried since Phase 090 —
    a real pre-187 definition shape. Zero migration means zero rows need touching.
    """
    wd = WorkflowDefinition.model_validate(copy.deepcopy(VALID_SEED))

    assert len(wd.phases) == 5
    assert all(p.name_seeded_by_ai is False for p in wd.phases)
    assert all(p.name is None for p in wd.phases)
