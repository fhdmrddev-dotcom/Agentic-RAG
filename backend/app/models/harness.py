"""Pydantic config models for the workflow harness (Phase 090 / HARNESS-02).

This is the typed layer that parses the ``workflow_definitions.definition`` JSONB
column into strongly-typed phase configs. It is the FIRST strict-parse model in
the codebase: every model subclasses :class:`_StrictBase`, which sets
``ConfigDict(extra="forbid")`` (decision D-07) so a typo'd or injected key in a
phase config raises ``pydantic.ValidationError`` BEFORE the Phase 091 engine
consumes it (threat T-090-01 / V5 input validation).

The 5 phase-type literals and the 4 validator ``kind`` literals are FIRM (they
mirror Phase 091 SC#1/#3 verbatim). The individual per-phase field names
(``input_keys``, ``model``/``temperature`` overrides, ``wall_clock_seconds``,
ask_user ``options``/``timeout_seconds``, ...) are FINALIZED in Phase 091 — the
engine is the consumer and these are the fields it reads. The discriminator
mechanism + ``extra='forbid'`` + union structure + the two Literal sets remain
LOCKED (do NOT change them).
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
    fn: str  # PROGRAMMATIC_PHASE_REGISTRY key
    # Keys this fn reads from the accumulated phase-output context (e.g. the
    # Literature-review `split_topic` fn reads the run's `topic`). Default [] =
    # reads nothing from prior phases.
    input_keys: list[str] = Field(default_factory=list)


class LlmSinglePhaseConfig(_StrictBase):
    phase_type: Literal["llm_single"]
    prompt: str
    # Per-phase overrides; None = inherit the thread's effective settings.
    model: str | None = None
    temperature: float | None = None


class LlmAgentPhaseConfig(_StrictBase):
    phase_type: Literal["llm_agent"]
    prompt: str
    available_tools: list[str]  # the per-phase whitelist (091 Pattern 1)
    # Phase 093 (D-19, 093-09): 10 → 12, IN LOCKSTEP with
    # phase_types._MODEL_DEFAULT_MAX_STEPS and Settings.harness_phase_max_steps, so
    # the sentinel-substitution keeps firing and the effective per-phase cap is
    # genuinely 12 (the headroom for thorough sub-agents; see phase_types.py:64-83).
    max_steps: int = 12
    # None → engine default (sized in Plan 05 from existing cap knobs).
    wall_clock_seconds: int | None = None
    model: str | None = None  # None = inherit thread settings


class LlmBatchAgentsPhaseConfig(_StrictBase):
    phase_type: Literal["llm_batch_agents"]
    prompt: str
    available_tools: list[str]
    # Phase 093 (D-19, 093-09): 10 → 12, IN LOCKSTEP — same invariant as
    # LlmAgentPhaseConfig above (the literature_review review phase is an
    # llm_batch_agents fan-out — this is the exact phase that hit the cap in UAT).
    max_steps: int = 12
    max_parallel_agents: int = 5  # scaling cap (ARCHITECTURE.md)
    # Only the strategies Plan 03 implements parse (extra='forbid' blocks typos;
    # the Literal blocks invalid strategy values). T-091-01/02 mitigation.
    merge_strategy: Literal["concat", "concat_numbered"] = "concat"
    wall_clock_seconds: int | None = None  # None → engine default (Plan 05)
    model: str | None = None  # None = inherit thread settings


class LlmHumanInputPhaseConfig(_StrictBase):
    phase_type: Literal["llm_human_input"]
    prompt: str  # the ask_user prompt
    # The ask_user choice menu; empty = free-text input.
    options: list[str] = Field(default_factory=list)
    # Per-call default; the 1800s hard cap lives in
    # Settings.ask_user_max_timeout_seconds (enforced in Plan 03).
    timeout_seconds: int = 300


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
