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
  (d) test_each_phase_config_validates — each of the 5 minimal phase-config dicts
      validates via PhaseSpec.model_validate() and selects the expected class

This file does NOT import the Supabase client or any conftest fixture — these are
pure-Python Pydantic validations.
"""

from __future__ import annotations

import copy

import pytest
from pydantic import ValidationError

from app.models.harness import (
    LlmAgentPhaseConfig,
    LlmBatchAgentsPhaseConfig,
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
