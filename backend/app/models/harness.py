"""Pydantic config models for the workflow harness (Phase 090 / HARNESS-02).

This is the typed layer that parses the ``workflow_definitions.definition`` JSONB
column into strongly-typed phase configs. It is the FIRST strict-parse model in
the codebase: every model subclasses :class:`_StrictBase`, which sets
``ConfigDict(extra="forbid")`` (decision D-07) so a typo'd or injected key in a
phase config raises ``pydantic.ValidationError`` BEFORE the Phase 091 engine
consumes it (threat T-090-01 / V5 input validation).

The 5 phase-type literals and the 4 validator ``kind`` literals are FIRM (they
mirror Phase 091 SC#1/#3 verbatim). The individual per-phase field names
(``prompt``, ``available_tools``, ``max_steps``, ``merge_strategy``, ...) are
PROVISIONAL per RESEARCH A1 — Phase 091 is the consumer and may refine them.
The discriminator mechanism + ``extra='forbid'`` + union structure are LOCKED.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class _StrictBase(BaseModel):
    """Base for all harness config models — rejects unknown keys (D-07)."""

    model_config = ConfigDict(extra="forbid")


# ── 5 phase-type configs (HARNESS-01 / 091 SC#1) ────────────────────────────
class ProgrammaticPhaseConfig(_StrictBase):
    phase_type: Literal["programmatic"]
    fn: str  # PROGRAMMATIC_PHASE_REGISTRY key — input mapping fields coordinate with 091


class LlmSinglePhaseConfig(_StrictBase):
    phase_type: Literal["llm_single"]
    prompt: str  # model/temperature overrides coordinate with 091


class LlmAgentPhaseConfig(_StrictBase):
    phase_type: Literal["llm_agent"]
    prompt: str
    available_tools: list[str]  # the per-phase whitelist (091 Pattern 1)
    max_steps: int = 10


class LlmBatchAgentsPhaseConfig(_StrictBase):
    phase_type: Literal["llm_batch_agents"]
    prompt: str
    available_tools: list[str]
    max_steps: int = 10
    max_parallel_agents: int = 5  # scaling cap (ARCHITECTURE.md)
    merge_strategy: str = "concat"


class LlmHumanInputPhaseConfig(_StrictBase):
    phase_type: Literal["llm_human_input"]
    prompt: str  # the ask_user prompt


PhaseConfig = Annotated[
    Union[
        ProgrammaticPhaseConfig,
        LlmSinglePhaseConfig,
        LlmAgentPhaseConfig,
        LlmBatchAgentsPhaseConfig,
        LlmHumanInputPhaseConfig,
    ],
    Field(discriminator="phase_type"),
]


class ValidatorSpec(_StrictBase):
    """HARNESS-04 gate kinds (091 owns execution; this is the shape)."""

    kind: Literal["json_schema", "regex_match", "workspace_file_exists", "programmatic"]
    config: dict = Field(default_factory=dict)
    on_failure: str = "fail_run"  # fail_run | retry | skip_to_phase:<slug>
    max_retries: int = 2


class PhaseSpec(_StrictBase):
    slug: str
    phase_index: int
    config: PhaseConfig  # parsed via discriminator
    validators: list[ValidatorSpec] = Field(default_factory=list)


class WorkflowDefinition(_StrictBase):
    slug: str
    version: int
    name: str
    status: Literal["draft", "published"] = "draft"
    phases: list[PhaseSpec]  # the JSONB column parsed via model_validate()
