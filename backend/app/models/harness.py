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
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _StrictBase(BaseModel):
    """Base for all harness config models — rejects unknown keys (D-07)."""

    model_config = ConfigDict(extra="forbid")


class SkillSnapshot(_StrictBase):
    """099 WFSKILL-01 — the materialized, immutable copy of a referenced skill.

    Lives inside the locked WorkflowDefinition JSONB so a later live-skill edit/delete
    cannot change a published run (D-01). Materialized at first kickoff (D-03a) by the
    Plan 03 ``skill_snapshot.py`` service. Inner fields may be required: this object only
    exists when a skill is present. Defined ABOVE the phase configs so the
    ``skill_snapshot: SkillSnapshot | None`` annotations resolve at class build.
    """

    skill_id: UUID                       # the source skill id (provenance/routing; D-09)
    name: str                            # display + read_skill_file routing-by-name within the phase
    description: str | None = None       # display metadata
    instructions: str                    # the copied skill instructions (D-01 content copy)
    files: list[str] = Field(default_factory=list)   # filenames (the D-06 manifest — names, NOT contents)
    storage_prefix: str                  # the snapshot Storage prefix the copies live under (D-02)


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
    # D-02 named llm_agent/llm_single; RESEARCH A2 added llm_batch_agents (the OTHER
    # retrieval phase). Load-bearing on llm_agent + llm_batch_agents; inert on
    # llm_single (no tools). Carried here for shape symmetry across the family.
    folder_scope: list[UUID] | None = None  # 098 PROJ-02 (D-02 + RESEARCH A2): resolved id list, NOT a prompt hint
    # 099 WFSKILL-01 (D-07/D-08): carried for shape symmetry. llm_single composes the
    # skill instructions only — the file manifest is inert here (no read_skill_file tool).
    skill_ref: UUID | None = None             # 099 WFSKILL-01 (D-09): resolved skill id, NOT a name
    skill_snapshot: SkillSnapshot | None = None  # materialized at first kickoff (D-01/D-02/D-03a); None on drafts


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
    folder_scope: list[UUID] | None = None  # 098 PROJ-02 (D-02 + RESEARCH A2): resolved id list, NOT a prompt hint
    skill_ref: UUID | None = None             # 099 WFSKILL-01 (D-09): resolved skill id, NOT a name
    skill_snapshot: SkillSnapshot | None = None  # materialized at first kickoff (D-01/D-02/D-03a); None on drafts


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
    folder_scope: list[UUID] | None = None  # 098 PROJ-02 (D-02 + RESEARCH A2): resolved id list, NOT a prompt hint
    skill_ref: UUID | None = None             # 099 WFSKILL-01 (D-09): resolved skill id, NOT a name
    skill_snapshot: SkillSnapshot | None = None  # materialized at first kickoff (D-01/D-02/D-03a); None on drafts


class LlmHumanInputPhaseConfig(_StrictBase):
    phase_type: Literal["llm_human_input"]
    prompt: str  # the ask_user prompt
    # The ask_user choice menu; empty = free-text input.
    options: list[str] = Field(default_factory=list)
    # Per-call default; the 1800s hard cap lives in
    # Settings.ask_user_max_timeout_seconds (enforced in Plan 03).
    timeout_seconds: int = 300


class LlmEmitPhaseConfig(_StrictBase):
    """Phase 101.1 (D-04) — the 6th phase type: a SEALED FORCED EMIT.

    The ONLY path that produces a typed deliverable. The model is FORCED (never an
    open auto-tool-choice loop — D-01, the GAP-A root cause) to emit cited DATA against
    the ``emitter``'s strict schema; a PINNED deterministic driver renders it (D-02 — no
    model-written code touches the deliverable). Adding a future deliverable = register
    ONE entry in ``EMITTER_REGISTRY`` (schema + driver), never new engine code.

    Additive-optional / ZERO-migration: appended to the ``PhaseConfig`` union as the
    6th discriminated member (the standard extension — the 5 existing members were added
    this way). ``_StrictBase`` rejects unknown keys (T-101.1-01-01); old JSONB phase rows
    without ``llm_emit`` still ``model_validate()``. The optional shape-symmetry fields
    mirror the other LLM members so the family stays uniform.
    """

    phase_type: Literal["llm_emit"]
    prompt: str
    emitter: str = "render_template"  # the EMITTER_REGISTRY key (closed-dict resolved)
    model: str | None = None  # None = inherit thread settings
    # Shape-symmetry optionals (mirror the other LLM members; load-bearing in the
    # executor plan — bound-scope retrieval + skill composition feeding the emit).
    folder_scope: list[UUID] | None = None  # 098 PROJ-02: resolved id list, NOT a prompt hint
    skill_ref: UUID | None = None             # 099 WFSKILL-01 (D-09): resolved skill id, NOT a name
    skill_snapshot: SkillSnapshot | None = None  # materialized at first kickoff; None on drafts
    # Phase 102 (D-01 / SEED-082) — policy enums consumed AFTER the verdict (verdict
    # computation UNCHANGED; strict is the default + byte-identical). The judge gate
    # and the citation gate share this vocabulary. flag = deliver WITH visible marks +
    # coverage summary; partial = blank uncited values + gap list; draft = no citation
    # enforcement, doc labeled DRAFT. Every non-strict mode marks or blanks, never silent.
    citation_policy: Literal["strict", "flag", "partial", "draft"] = "strict"
    integrity_policy: Literal["strict", "documented_limit"] = "strict"  # F3 sibling (pptx/xlsx)


PhaseConfig = Annotated[
    Union[
        ProgrammaticPhaseConfig,
        LlmSinglePhaseConfig,
        LlmAgentPhaseConfig,
        LlmBatchAgentsPhaseConfig,
        LlmHumanInputPhaseConfig,
        LlmEmitPhaseConfig,
    ],
    Field(discriminator="phase_type"),
]


class ValidatorSpec(_StrictBase):
    """HARNESS-04 gate kinds (091 owns execution; this is the shape).

    Phase 102 (GATE-01): + 5 library kinds (D-12) + timing (D-10) + ask_user
    on_failure value (D-11, on_failure stays a str — skip_to_phase:<slug> already
    parses, so ask_user is just one more recognized value, not a new type).
    """

    kind: Literal[
        "json_schema", "regex_match", "workspace_file_exists", "programmatic",
        "citations_required", "freshness", "structure_check",
        "output_file_valid", "llm_judge_rubric",
    ]
    config: dict = Field(default_factory=dict)
    on_failure: str = "fail_run"  # fail_run | retry | skip_to_phase:<slug> | ask_user (D-11)
    max_retries: int = 2
    timing: Literal["pre", "post"] = "post"  # D-10 — default post = every existing gate byte-unchanged


class PhaseSpec(_StrictBase):
    slug: str
    phase_index: int
    config: PhaseConfig  # parsed via discriminator
    validators: list[ValidatorSpec] = Field(default_factory=list)


# ── 098 co-lock input/asset shapes (CONCLUSION.md §3 verbatim; JSONB makes the ──
# co-lock free, so Phases 100/103 don't re-touch this model). Behavior deferred:
# `inputs` (launch form) lands in Phase 103;
# `assets` (template/reference refs) — IMPLEMENTED in Phase 101 (the trusted-library
#   fill path; byte resolution in template_asset_service.resolve_template_source);
# Provenance lives in run OUTPUT only (open-Q ii / D-11) — NO `Cited`
# field on InputFieldSpec.
class InputFieldSpec(_StrictBase):
    key: str
    label: str
    type: Literal["text", "number", "date", "enum", "file", "kb_auto"]
    required: bool = True
    source: Literal["user", "kb_auto", "template_derived"] = "user"  # open-Q (i) settled
    enum_options: list[str] = []
    folder_scope: list[UUID] | None = None  # if kb_auto: RESOLVED ids, not a path (open-Q iii)


class AssetRef(_StrictBase):
    asset_id: str
    filename: str
    kind: Literal["template", "reference"]
    mime: str


class WorkflowDefinition(_StrictBase):
    slug: str
    version: int
    name: str
    status: Literal["draft", "published"] = "draft"
    phases: list[PhaseSpec]  # the JSONB column parsed via model_validate()

    # ── 098 additive-optional schema lock (zero-migration; old JSONB rows model_validate() to defaults) ──
    project_folder_id: UUID | None = None                                                    # D-01 / PROJ-01
    output_target_folder: UUID | None = None                                                 # D-08 (shape only)
    reingest_output: bool = False                                                            # D-08 (shape only)
    version_policy: Literal["supersede-by-filename", "keep-all"] = "supersede-by-filename"   # D-08 (shape only)
    provenance: Literal["source", "derived"] = "source"                                      # D-08 (net-new flag)
    inputs: list[InputFieldSpec] | None = None                                               # co-lock (Phase 103 behavior)
    assets: list[AssetRef] | None = None                                                     # co-lock — implemented in Phase 101 (template_asset_service)

    # ── 102 (D-13) — the ONE business requirement the QUAL-01 judge anchors to.
    # Additive-optional (old rows model_validate() to None). OPTIONAL on a draft;
    # the publish ENDPOINT (Plan 05), NOT this schema, enforces "required at publish".
    business_requirement: str | None = None

    @model_validator(mode="after")
    def _folder_scope_requires_project(self) -> "WorkflowDefinition":
        # D-07 STRUCTURAL half only: a per-phase folder_scope needs a project_folder_id
        # to be a subset of. The DB-aware ⊆ check (against the real folder subtree)
        # lives in Plan 03's scope.py — do NOT add DB logic here.
        for phase in self.phases:
            scope = getattr(phase.config, "folder_scope", None)
            if scope and self.project_folder_id is None:
                raise ValueError(
                    f"phase '{phase.slug}' declares folder_scope but the workflow has no "
                    f"project_folder_id for it to be a subset of"
                )
        return self

    @model_validator(mode="after")
    def _skill_snapshot_requires_ref(self) -> "WorkflowDefinition":
        # 099 WFSKILL-01 (T-099-06) STRUCTURAL half only: a materialized skill_snapshot
        # cannot exist without the skill_ref it was materialized from — a snapshot
        # without a ref is a half-formed locked definition. Pure shape: the DB-aware
        # publish gate (skill existence / visibility / is_enabled) lives in Plan 03's
        # skill_snapshot.py, which needs supabase + user_id — do NOT add DB logic here.
        for phase in self.phases:
            snapshot = getattr(phase.config, "skill_snapshot", None)
            ref = getattr(phase.config, "skill_ref", None)
            if snapshot is not None and ref is None:
                raise ValueError(
                    f"phase '{phase.slug}' carries a skill_snapshot but no skill_ref"
                )
        return self
