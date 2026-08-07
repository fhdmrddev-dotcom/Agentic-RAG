"""Pydantic config models for the workflow harness (Phase 090 / HARNESS-02).

This is the typed layer that parses the ``workflow_definitions.definition`` JSONB
column into strongly-typed phase configs. It is the FIRST strict-parse model in
the codebase: every model subclasses :class:`_StrictBase`, which sets
``ConfigDict(extra="forbid")`` (decision D-07) so a typo'd or injected key in a
phase config raises ``pydantic.ValidationError`` BEFORE the Phase 091 engine
consumes it (threat T-090-01 / V5 input validation).

The two Literal sets GROW ADDITIVELY, and always have. ``phase_type`` went 5 -> 6
at Phase 101.1 (the ``llm_emit`` member) and 6 -> 7 at Phase 189 (CONN-01 / D-01 —
the ``external_action`` member); the validator ``kind`` set went 4 -> 9 at
Phase 102 (GATE-01 / D-12) and 9 -> 10 at Phase 185 (GOVERN-03 —
``action_risk_approval``) and is UNCHANGED by 189, which REUSES
``action_risk_approval`` rather than growing a second kind. Growth is SAFE
because every value a stored JSONB row
can already carry still validates: an old row never names the new member, and an
unrecognized kind fails CLOSED downstream in ``run_gates``. What must NOT change is
an EXISTING member's spelling — renaming one orphans every stored row that uses it
— nor the mechanism around them: the discriminator, ``extra='forbid'`` and the
union structure remain LOCKED. The individual per-phase field names
(``input_keys``, ``model``/``temperature`` overrides, ``wall_clock_seconds``,
ask_user ``options``/``timeout_seconds``, ...) are FINALIZED in Phase 091 — the
engine is the consumer and these are the fields it reads.
"""

from __future__ import annotations

import logging
from typing import Annotated, Literal, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

logger = logging.getLogger(__name__)


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


# ── the phase-type configs (HARNESS-01 / 091 SC#1) ──────────────────────────
# This header read "5 phase-type configs" until Phase 189. It was already false at
# 101.1 (the 6th member landed below it) and 189 makes it a 7. A count in a header
# is a claim that rots on every additive growth, so it is stated as a rule instead:
# the members below ARE the ``PhaseConfig`` union, in the union's own order.
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


class ExternalActionPhaseConfig(_StrictBase):
    """Phase 189 (CONN-01 / D-01) — the 7th phase type: a GOVERNED EXTERNAL ACTION.

    The step that reaches OUTSIDE this app — and, in 189, sends NOTHING. The author picks
    one named ``capability`` from a CLOSED SET of three (D-15, ratified 2026-08-07); the
    executor RECORDS the action it would have taken and the phase lands
    ``recorded_not_sent`` (D-05). Phase 190 swaps the no-op for a real call behind an
    unchanged seam. Nothing here opens a socket, and nothing here is meant to.

    Additive-optional / ZERO-MIGRATION: appended to the ``PhaseConfig`` union as the 7th
    discriminated member — the standard extension, which is the phrase
    ``LlmEmitPhaseConfig`` above uses for the 6th and which this module's docblock records
    as the way all of them arrived. ``_StrictBase`` rejects unknown keys (D-07); old JSONB
    phase rows without ``external_action`` still ``model_validate()``, because an old row
    never names the new member. The discriminator, ``extra='forbid'`` and the union
    structure are UNTOUCHED — the module docblock calls that mechanism LOCKED, and a 7th
    member is additive INSIDE it, never a change to it.

    ── D-22 · THE CAPABILITY IS A STEP THE EXECUTOR PERFORMS, NOT A TOOL THE LLM CALLS ──
    The shipped precedent is ``render_template``: a name honoured by the per-phase
    whitelist while being INVISIBLE to the model — registered for dispatch, never
    advertised in ``openai_service.get_tools()``, and executed by the phase itself
    (``phase_types.py``'s 101-06 WR-01 correction states the two layers). The name that
    ``available_tools`` carries below is therefore a GOVERNANCE DECLARATION, not a
    dispatchable schema. Phase 189 adds NO ``_TOOL_REGISTRY`` entry and NO ``get_tools()``
    schema for these three names; both belong to Phase 190. The tool reading would require
    an agent loop, i.e. an LLM deciding WHETHER and HOW to send — which contradicts D-05
    outright and would ship most of the plumbing for live egress that SC#4 forbids.

    ── D-03 · ``available_tools`` IS DERIVED FROM ``capability``, NEVER AUTHORED ──
    The capability IS an entry in ``available_tools``, so it flows through the SAME
    per-phase whitelist every other tool does — ``phase_types._build_phase_tool_context``
    builds ``ToolContext.phase_whitelist`` from this list and ``tool_dispatcher.dispatch_tool``
    is where it is ENFORCED (``api/runs.py:resolve_phase_available_tools`` is the *Continue*
    re-read of the same list, not the main run's builder). SC#1's claim that this rides the
    guard that already exists is then literally true rather than aspirational.

    The validator below DERIVES the list rather than trusting it, and the derivation is
    total replacement — after validation ``available_tools == [capability]``, whatever was
    submitted. One fact, one derivation, no drift. Two consequences, both deliberate:
      * an author-supplied list is DISCARDED rather than merged. Merging would let an
        author park ``search_documents`` on this step, and grounding detection is
        ``available_tools ∩ KB_TOOLS`` — the step would silently arm the *must prove it*
        dial while reading no knowledge base. Replacement makes that unrepresentable
        rather than documented, and it is fail-CLOSED in the only direction that matters:
        the whitelist can only ever get NARROWER than what was asked for.
      * the derived value IS persisted (the draft path saves ``model_dump(mode="json")``).
        That is the requirement here, not a hazard: D-03 needs the name in the STORED row
        so the run-time re-read finds it. Contrast ``PhaseSpec``'s grounding block below,
        where baking a derived value is forbidden precisely because that one must be able
        to change when the row changes. This one cannot: it is a function of ``capability``
        alone, and ``capability`` cannot change without rewriting this config.

    ── D-03 · DISJOINT FROM ``KB_TOOLS`` BY CONSTRUCTION ──
    None of the three names is a KB tool (``grounding.KB_TOOLS``), so ``grounding_cause``
    returns ``None`` for this step and it is *free to think* — it carries NO ⛨ governance
    seal. That is CORRECT, not a missing feature: an external-action step reads no
    knowledge base. The membership is fenced two ways: a module-level assertion beside
    ``EXTERNAL_ACTION_CAPABILITIES`` in ``grounding.py``, and
    ``tests/unit/test_189_external_action_model.py``, which asserts the SET of this
    ``Literal``'s own members equals that frozenset and is disjoint from ``KB_TOOLS``.
    Two spellings of one closed set are unavoidable (Pydantic needs a literal; the
    frozenset is the runtime home and this module must not import a service), so the
    agreement is MECHANICAL rather than remembered.

    ⚠ THE ARMING IS NOT HERE. ``action_risk_armed`` lives on ``PhaseSpec``, shared by all
    seven types, and D-04's pin is the ``model_validator`` on THAT class. Do not add a
    second home for it here — see that validator's docblock for why.
    """

    phase_type: Literal["external_action"]
    # D-15 / D-02 — the CLOSED vocabulary, ratified by the operator on 2026-08-07 over
    # email-only (too thin a canvas vocabulary) and over a fourth name (Phase 190 has no
    # plan to make a fourth real, so it would ship a node that can never be connected).
    # A fourth name is a ``ValidationError`` at parse time, never a dynamic lookup and
    # never an ``eval`` — the same closed-registry rule ``_TOOL_REGISTRY``,
    # ``PROGRAMMATIC_PHASE_REGISTRY`` and ``EMITTER_REGISTRY`` all share. The executor
    # (189-09) re-resolves the name against ``EXTERNAL_ACTION_CAPABILITIES`` and raises;
    # that is the second line of defence for a row that reached the engine another way.
    capability: Literal["send_email", "create_ticket", "post_message"]
    # DERIVED, never authored — see the D-03 block above. Defaulted rather than required
    # so a client that does not send it cannot 422 a whole definition; the validator
    # supplies the only admissible value either way.
    available_tools: list[str] = Field(default_factory=list)

    # NO SHAPE-SYMMETRY OPTIONALS, and the omission is the decision. The five LLM members
    # share ``model`` / ``folder_scope`` / ``skill_ref`` / ``skill_snapshot`` because each
    # of them drives a model; this one drives none (D-22), so all four would be inert —
    # and two would be actively wrong. A ``folder_scope`` would claim a retrieval path
    # this step does not have, and a ``citation_policy="strict"`` would make
    # ``grounding_cause`` report ``already-set`` for a step that reads nothing. Nothing
    # speculative is carried; a later phase that needs one adds it additively, as this
    # member itself was added.

    @model_validator(mode="after")
    def _available_tools_is_the_capability(self) -> "ExternalActionPhaseConfig":
        # D-03 — ONE fact, ONE derivation. The capability is the whitelist, so the two can
        # never disagree: there is no representable ``external_action`` config whose
        # ``available_tools`` omits its own capability, which is what SC#2's "cannot be
        # wired around a gate" means at the model layer. COERCES rather than raises, for
        # the same fail-closed reason the D-04 pin does (see ``PhaseSpec`` below): a stale
        # client that sends an empty list must not brick the definition it is saving.
        derived = [self.capability]
        if self.available_tools != derived:
            if self.available_tools:
                logger.info(
                    "189 D-03: external_action available_tools %r replaced by the "
                    "capability-derived %r (the whitelist is derived from `capability`, "
                    "never authored)",
                    self.available_tools,
                    derived,
                )
            self.available_tools = derived
        return self


PhaseConfig = Annotated[
    Union[
        ProgrammaticPhaseConfig,
        LlmSinglePhaseConfig,
        LlmAgentPhaseConfig,
        LlmBatchAgentsPhaseConfig,
        LlmHumanInputPhaseConfig,
        LlmEmitPhaseConfig,
        ExternalActionPhaseConfig,  # 189 CONN-01 (D-01) — the 7th, appended
    ],
    Field(discriminator="phase_type"),
]


class ValidatorSpec(_StrictBase):
    """HARNESS-04 gate kinds (091 owns execution; this is the shape).

    Phase 102 (GATE-01): + 5 library kinds (D-12) + timing (D-10) + ask_user
    on_failure value (D-11, on_failure stays a str — skip_to_phase:<slug> already
    parses, so ask_user is just one more recognized value, not a new type).

    Phase 185 (GOVERN-03 / D-185-12): + ``action_risk_approval``, the armed
    action-risk checkpoint's ``timing="pre"`` kind. Additive in the same sense as
    102's five: no stored row names it, so every pre-185 row still validates. It is
    registered here because ``ValidatorSpec`` is a ``_StrictBase`` and construction
    validates — a synthesized spec of an unlisted kind could not be built at all.
    """

    kind: Literal[
        "json_schema", "regex_match", "workspace_file_exists", "programmatic",
        "citations_required", "freshness", "structure_check",
        "output_file_valid", "llm_judge_rubric",
        "action_risk_approval",  # 185 GOVERN-03 (D-185-12) — the armed pre-gate
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
    name: str | None = None  # REQ-3 — additive; serializes into the definition JSONB; pre-103 rows validate with it absent

    # ── Phase 185 (GOVERN-01 / GOVERN-03; D-185-06/07/08) — the two governance
    # intents, at PhaseSpec level as siblings of `validators` and `name`.
    #
    # (a) ADDITIVE / ZERO-MIGRATION, exactly like `name` above: a pre-185
    #     `workflow_definitions` JSONB row carrying NEITHER key still
    #     `model_validate()`s, and both read False. `bool = False` rather than
    #     `bool | None = None` is the one deliberate deviation from `name`'s
    #     spelling — D-185-08 requires absence to be unambiguous, so there is
    #     exactly one way to say "not set".
    #
    # (b) INTENT ONLY (D-185-07). Of the three grounding causes only `escalated`
    #     is ever AUTHORED. `detected` is a pure function of
    #     `config.available_tools ∩ KB_TOOLS`; `already-set` is a pure function of
    #     `config.citation_policy == "strict"`. Both are DERIVED at read time from
    #     data already in the row and are NEVER stored — which is what makes SPEC
    #     Req 3 true BY CONSTRUCTION rather than by a code audit: "a detected step
    #     set back to free-to-think" is not a representable value, so a stale or
    #     hand-edited JSONB row cannot lie about it. NO GROUNDING CAUSE IS EVER
    #     DERIVED HERE — the draft save path persists `model_dump(mode="json")`,
    #     so a derivation living in this model would be BAKED into the JSONB and
    #     would contradict (b) permanently.
    #
    #     ⚠ CORRECTED at Phase 189 (D-04), in the commit that falsified it. This
    #     sentence used to read "Nothing here is a `model_validator` on purpose".
    #     `PhaseSpec` now carries exactly one — the D-04 arming pin at the bottom
    #     of this class — and the distinction the old wording collapsed is the
    #     load-bearing one: what (b) forbids is baking a value that must be free
    #     to CHANGE when the row changes. The arming pin bakes a value that must
    #     never change at all, for one phase type, and baking it is the point
    #     (the canvas reads the STORED boolean). The 185 fence in
    #     `tests/unit/test_185_detection.py` was narrowed to that actual claim in
    #     the same commit rather than deleted.
    #
    # (c) THE ONE HOME of that derivation is
    #     `app.services.harness.grounding` (`KB_TOOLS` / `grounding_cause`) — the
    #     D-182-06 red line: exactly one copy of every grounding rule, server-side.
    #     Read that module's docblock before adding a grounding rule anywhere else.
    grounding_escalated: bool = False   # GOVERN-01 / D-185-08 — the author hand-locked this step
    action_risk_armed: bool = False     # GOVERN-03 / D-185-08 — stop and ask a human before this step runs

    # ── Phase 187 (VOCAB-01 / REQ-3; D-187-03) — WHO wrote `name` above.
    #
    # (a) ADDITIVE / ZERO-MIGRATION, the `grounding_escalated` shape verbatim: a
    #     pre-187 `workflow_definitions` JSONB row carrying NEITHER this key nor
    #     `name` still `model_validate()`s and reads False. Measured at plan time:
    #     0 of 57 phases across the 27 well-formed rows carry a non-empty `name`,
    #     so EVERY stored row today is exactly that shape. `bool = False`, never
    #     `bool | None = None` — D-185-08's rule: absence has ONE spelling.
    #
    # (b) PROVENANCE, NOT A DERIVATION. This records only that the NL authoring
    #     generator wrote the stored `name` rather than a human typing it, which is
    #     what the demote-on-config-edit rule (D-187-07) reads: a config edit clears
    #     a GENERATOR-seeded name, and never clears a HAND-TYPED one. It is stamped
    #     SERVER-SIDE after `model_validate()` in
    #     `app.services.workflow_authoring.generate_workflow_definition` — never
    #     taken from the model payload, so an emission cannot claim a name was
    #     hand-typed (T-187-02-02).
    #
    # (c) The node FACE is not here and never will be. The layered ladder
    #     (author name → config-derived → type sentence) is computed AT RENDER in
    #     `frontend/src/components/workflows/phaseVocabulary.ts` and is NEVER
    #     stored — same reason as (b) in the block above: the save path persists
    #     `model_dump(mode="json")`, so a derivation living in this model would be
    #     BAKED into the JSONB and a stale row could then lie about its own face.
    #     NO FACE IS DERIVED BY A VALIDATOR HERE — see the (b) block above, which
    #     names the decorator and explains the trap. (⚠ CORRECTED at Phase 189 /
    #     D-04, in the commit that falsified it: this used to say "Nothing here is
    #     a model-level validator hook, on purpose". One now exists; it derives no
    #     face and no grounding cause. The rule the sentence defends is unchanged.)
    name_seeded_by_ai: bool = False     # VOCAB-01 / D-187-03 — the NL generator wrote `name`, not a human

    # ── Phase 189 (CONN-01 / D-04) — the arming pin ──────────────────────────
    @model_validator(mode="after")
    def _external_action_is_always_armed(self) -> "PhaseSpec":
        """D-04 — `action_risk_armed` is STRUCTURALLY TRUE on `external_action`.

        Not a default the author can clear. SC#2 says the node cannot be wired around a
        gate, and 185's hard-won rule is that a gate which can be loosened away is not a
        gate. This makes the property true BY CONSTRUCTION in the same sense `PhaseSpec`'s
        grounding block above uses: an unarmed external-action step is not a representable
        stored value, so a stale client or a hand-edited JSONB row cannot lie about it.

        ⚠ IT COERCES, IT DOES NOT RAISE — and that is a deliberate DEPARTURE from both
        shipped validators on `WorkflowDefinition` below, which raise. Copying a shape
        while inverting its disposition is exactly the silent divergence a reviewer cannot
        see, so it is stated here. An OLD row is safe either way (it never names the new
        member), but a NEW row written with `armed: false` by a client that shipped before
        its own pin would 422 the entire definition and BRICK the workflow. Coercion is
        fail-CLOSED — it ARMS — and never destroys a row. Do not "tighten" this into a
        raise later; the loosening it looks like is the opposite of what it does.

        WHY HERE, and the three alternatives it was chosen over:

          1. A `Literal[True]` FIELD cannot work. `action_risk_armed` lives on `PhaseSpec`,
             shared by all seven phase types, so pinning it at the field would arm every
             one of them. Moving the field onto `ExternalActionPhaseConfig` instead would
             create a SECOND home for one fact — the exact drift D-03 rejects one line at
             a time in that class's own validator.
          2. Enforcement at RESOLVE time (in `harness_engine`) protects the RUN but not the
             STORED ROW. The row would then read `armed: false` while the engine armed
             anyway, and the canvas — which reads the stored boolean via
             `phaseVocabulary.actionRiskArmed` — would paint an unarmed edge on an armed
             step. A lie on screen is worse than the gap it papers over.
          3. A validator on `WorkflowDefinition` (beside the two below) would have left
             this class's shipped no-validator fence untouched, but it only fires when a
             WHOLE definition is parsed. A `PhaseSpec` parsed on its own — which the
             engine, the tests and any future partial-update path all do — would read
             unarmed. `PhaseSpec` is the narrowest scope that no write path can bypass.

        A `PhaseSpec` validator catches ALL SIX write paths at once (the field default, a
        draft save, a canvas/panel edit, a direct JSONB hand-edit, the publish gauntlet and
        the NL generator) because every one of them parses through this class.

        The membership test is `isinstance`, not a `phase_type` string compare, so the
        spelling of the discriminator value is not re-typed here — one home, one fact.
        """
        if isinstance(self.config, ExternalActionPhaseConfig) and not self.action_risk_armed:
            # Observable, never silent: a coercion nobody can see is indistinguishable
            # from a value that was already correct.
            logger.info(
                "189 D-04: phase %r is external_action(%s) and was stored unarmed; "
                "coercing action_risk_armed to True (structurally armed, not disarmable)",
                self.slug,
                self.config.capability,
            )
            self.action_risk_armed = True
        return self


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

    # ── 143 WF-01 — Starters-shelf curation marker (D-143-2). Additive-optional,
    # zero-migration: old JSONB rows model_validate() to None (mirrors the 098 lock
    # above). Load-bearing (Shared Pattern 1): a seeded starter carries
    # category='starter' INSIDE this definition JSONB, and the fresh-copy fork
    # round-trips it through create_draft (POST /workflows parses the body as this
    # model) — so without this field extra='forbid' would 422 on the key. The
    # Starters shelf query reads definition->>'category'='starter'. This does NOT
    # relax extra='forbid': every OTHER unknown key still raises ValidationError.
    category: str | None = None

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
