"""Phase 103 (REQ-2 / WFAUTH-02 / D-103-C) — the NL one-shot authoring service.

The describe-first BIRTH path: a domain expert's plain-language description becomes a
single ``model_validate()``-clean, GROUNDED ``WorkflowDefinition`` draft — or an honest
structured failure. It is a thin orchestration over the SHIPPED forced-emit substrate:

  - ``resolve_authoring_model`` mirrors ``resolve_judge_model`` (D-103-2 — the
    independent, confirmed-forceable authoring model; NOT the composer's model).
  - the emit tool is the ``WorkflowDefinition`` JSON schema with OpenAPI ``discriminator``
    keys stripped (Pitfall 7 — Pydantic re-applies the discriminator at
    ``model_validate``, the real strict gate).
  - ``generate_workflow_definition`` assembles server-side grounding (folder tree +
    tool/skill registry + optional template placeholders), forces ONE emit via
    ``forced_emit(schema_model=WorkflowDefinition, strict=False)`` (Pitfall 1 — strict
    OFF so the optional-heavy schema does NOT 400 on OpenAI/DeepSeek), validates,
    retries EXACTLY once on a first-pass failure, then honest-fails (NEVER a partial
    draft), and runs grounding FIDELITY (⊆ subtree + registry membership) after a
    successful validate.

RED LINE (D-01 / G-5): this REUSES ``forced_emit`` → the Phase 092.5 provider gateway.
It NEVER opens the agent loop, NEVER imports a new SDK path, NEVER touches the gateway.
The spike (``scripts/spike-097/authoring_feel.py``) is THROWAWAY — its grounding-assembly
logic was REPRODUCED (never imported) and, as of Phase 182, lives in ONE shared home.

PHASE 182 (VALID-01 / D-182-02 / D-182-06): the grounding compute, the NL grounding
render and the three grounding-FIDELITY rules MOVED to
``app.services.harness.grounding`` — the ONE shared source that the visual canvas's
``POST /workflows/validate`` + ``GET /workflows/grounding-bundle`` seam also calls.
``_assemble_grounding`` and ``_check_grounding_fidelity`` below are now THIN DELEGATES
whose output is byte-identical to the pre-182 bodies; NL generation is unchanged. Do NOT
re-add a second copy of any grounding rule here (or anywhere, least of all client-side).

Observability (RESEARCH A2): each provider call emits one ``nl_generation_attempt
{attempt: int}`` structured log event (NOT a ``harness_audit`` row — that CHECK is a
closed constraint that would need a migration). The integer attempt index is the ONLY
payload (no prompt / no secret — T-103-02-06).
"""

from __future__ import annotations

import copy
import logging
from typing import Any
from uuid import UUID

# NOTE (Phase 182): ``run_in_threadpool`` is no longer imported here — the blocking
# skill-registry read it wrapped moved with the grounding compute into
# ``app.services.harness.grounding`` (which keeps the D-v2.5-01 wrap verbatim).
from app.models.harness import WorkflowDefinition

logger = logging.getLogger(__name__)


# The authoring system prompt — instructs the model to compose typed phases into ONE
# valid WorkflowDefinition using ONLY the grounded folder ids / tool names / skill ids /
# placeholders. Copy is Claude's discretion (the contracts are locked, not the prose).
AUTHORING_SYSTEM_PROMPT = (
    "You are a workflow authoring assistant for a knowledge-base agent platform. A "
    "non-coder domain expert describes a recurring knowledge task in plain English; your "
    "job is to translate it into ONE valid WorkflowDefinition by composing typed phases, "
    "then emit it via the `emit_workflow_definition` tool.\n\n"
    "The 7 phase types you can compose (set `phase_type` per phase's `config`):\n"
    "- programmatic: a deterministic registered function (`fn`); no LLM.\n"
    "- llm_single: one LLM completion with a `prompt` (no tools).\n"
    "- llm_agent: an autonomous agent with a `prompt` and an `available_tools` whitelist.\n"
    "- llm_batch_agents: a fan-out of parallel agents over a `prompt` + `available_tools`.\n"
    # 193.2 (D-11) — SHORTENED, and length is the whole point. MEASURED from this literal
    # at runtime, not hand-counted: this bullet was **121** characters, the LONGEST of the
    # seven and 45% above the six-bullet median of exactly **83.5**; it is now **74**.
    # The rule being obeyed is the one the `external_action` block below already records
    # about itself — an over-long bullet is a NUDGE, and a nudge in a generator prompt
    # skews composition toward the type it describes. What made this one a nudge was not
    # only its length but its tail: it ENDED with an active invitation ("use for any
    # 'confirm before finalizing' step"), recommending the ONE phase type the synchronous
    # publish gate categorically refuses (`publish_service._interactive_phase_failures`).
    # `BUG-260815-01` measured that composition 2 for 2 with a bound template. What the
    # type IS stays truthful and complete — it pauses and asks the human, it takes a
    # `prompt` and optional `options`; only the invitation is gone. The upper precedent
    # for this band is the `external_action` bullet at 104 characters (F-8 enforces it).
    "- llm_human_input: PAUSE and ask the human (`prompt`, optional `options`).\n"
    "- llm_emit: a sealed forced emission that produces a typed deliverable (`emitter`).\n"
    # 189 CONN-01 (D-01) — the 7th type. Without this bullet the AI-seed path (Phase 187)
    # can never emit an external_action node and the type is reachable only by hand.
    # ⚠ LENGTH IS A CONSTRAINT, not a style note: the six shipped bullets have a median of
    # 83.5 characters and this one is 104, inside the +25% bound the plan sets. An
    # over-long bullet is a nudge, and a nudge in a generator prompt skews composition
    # toward the type it describes. The two facts an author needs are both here — it
    # always stops for approval before it acts outside, and in this milestone it RECORDS
    # what it would do rather than sending. The three `capability` values are NOT listed:
    # the emit tool advertises the WorkflowDefinition schema, whose Literal already
    # enumerates them, and a second copy here is one more place for them to drift.
    "- external_action: acts outside the app (`capability`); always asks approval, "
    "records rather than sends.\n\n"
    "DELIVERABLE RULE (CRITICAL — a wrong choice makes the workflow unpublishable):\n"
    "- Use `llm_emit` with `emitter: 'render_template'` ONLY when the grounding explicitly "
    "lists template placeholders (i.e. the user provided a .docx/.pptx/.xlsx template to "
    "fill). When NO template is listed in the grounding, the final deliverable MUST be "
    "PLAIN TEXT / markdown: end the workflow with an `llm_single` step (or `llm_agent` if "
    "it needs tools to gather first) whose `prompt` instructs it to WRITE the answer "
    "directly. NEVER create a `render_template` emit phase without a provided template — "
    "at run time it fails with `no_template_bound` and the workflow can NEVER publish. "
    "Default to a simple, publishable text deliverable; reach for a template only when one "
    "is actually provided.\n"
    # 193.2 (D-11) — the interactive case joins the DELIVERABLE RULE in the rule's OWN
    # voice, because it has the same consequence the rule is already labelled for: a
    # wrong choice makes the workflow unpublishable. One home per concern — the rule
    # states the POLICY, the grounding states the FACTS the policy reads
    # (`harness/grounding.py:605-607`); the D-26 arms there are deliberately untouched.
    #
    # PROPORTIONALITY, and WHICH BASELINE IT WAS MEASURED AGAINST (D-11). The 83.5-char
    # median belongs to the phase-type bullet list above, NOT here: this block measured
    # **769** characters before this clause — already ~9x that median — and RE-MEASURED
    # from the literal after the edit it is **1202**, so the clause is **433**, roughly
    # half the single template clause it sits beside. It is proportionate to THIS block,
    # which is the only comparison that means anything. (Both figures are re-derivable:
    # split the literal on newlines, take the lines from `DELIVERABLE RULE` to the next
    # blank one, and join them — the same derivation F-8 uses for the bullets.)
    #
    # It states the CONSEQUENCE rather than an unexplained prohibition, deliberately: an
    # unexplained prohibition in a generator prompt is a rule the model can trade away
    # against a competing instruction, and `BUG-260815-01` is exactly that trade — told
    # it MUST fill N named template fields the grounding could not supply, the reasonable
    # composition was "add a step that asks the human".
    #
    # It tells the model what to do INSTEAD, in the same register as the template clause
    # above, and it explicitly does NOT license inventing data — an unfound fact is
    # reported as unfound (`SEED-159`: a blank that lies is not an improvement).
    #
    # D-14 — it promises NOTHING. A workflow that deliberately pauses for a person and
    # can still be published is a real capability the operator has named, and it is NOT
    # scheduled (`SEED-164` exists precisely because a docblock calling something "the
    # DEFERRED Phase-103 rework" made unscheduled work read like a plan for a year).
    # This clause states what is true NOW and names nothing that is not on the roadmap.
    # D-25 — this SUPPRESSES an unwanted step; it does not deliver that capability.
    #
    # ⚠ THE PUBLISH GATE STAYS (D-11). A prompt clause reduces how often the model
    # composes such a step; it can never guarantee absence, so nothing downstream may be
    # relaxed on the strength of these words. Frequency is measured as k/N by
    # `backend/tests/integration/test_193_2_authoring_frequency.py` — the phase's claim
    # is a REDUCTION, never an absence (D-08).
    "- Do NOT add a step that pauses to ask the human (`llm_human_input`, or a validator "
    "whose `on_failure` is `ask_user`): publishing VALIDATES a workflow by running it, "
    "and a run waiting on a person cannot finish — so a workflow containing one cannot "
    "be published at all. When a fact might be missing, have the step gather it with the "
    "tools it is given, and have the deliverable say plainly that it could not be found. "
    "Never invent it.\n\n"
    "Rules — these are HARD constraints enforced after you emit:\n"
    "- `available_tools` may ONLY contain tool names from the provided tool registry.\n"
    "- `skill_ref`, if set, MUST be a skill id from the provided skill registry.\n"
    "- A per-phase `folder_scope` MUST contain only folder ids from the provided folder "
    "tree, and only ids inside the bound project subtree; set the definition's "
    "`project_folder_id` when any phase declares a `folder_scope`.\n"
    "- Emit ONLY the schema's fields; do NOT invent keys (extra keys are rejected).\n"
    "- Give each phase a short `slug`, a sequential `phase_index` starting at 0, and a "
    "short, specific, plain-language `name` saying what THAT step does rather than what "
    "its type does — write \"Pull the renewal history\", not \"LLM step\". This per-phase "
    "`name` is what a non-coder reads on the canvas, and it is SEPARATE from the "
    "definition-level `name` below. "
    # 193.2 (D-07 / SEED-163) — `business_requirement` joins the SAME sentence that
    # already names the definition-level fields to set. Measured at HEAD:
    # `grep -c business_requirement backend/app/services/workflow_authoring.py` → **0**,
    # while `WF_SCHEMA` (= `WorkflowDefinition.model_json_schema()`) ALREADY advertises
    # the field (`app/models/harness.py:538`). The schema was never the gap; the prompt
    # was — so this is one field on one existing sentence, and D-09 holds: no schema
    # change, `business_requirement` stays OUT of the schema's `required` list.
    #
    # The DURABILITY clause is not decoration (D-07, carried verbatim from `SEED-163`'s
    # "What NOT to do"). `describe` is ONE RUN's task instruction ("produce a QBR for
    # Northwind covering Q3"); the requirement is what the workflow must deliver for ANY
    # run ("produce a client-ready QBR for a named account from our own records"). A
    # verbatim copy of the describe text bakes one run's parameters into the workflow's
    # definition of done — and the publish gauntlet's later stages read this field,
    # including the judge's `answers_business_requirement` criterion.
    #
    # ⚠ NON-DETERMINISTIC BY DESIGN (D-08). When the model emits nothing here the
    # behaviour is byte-identical to today's: the field stays None and the author fills
    # it, exactly as before. Nothing in this module asserts it is always populated.
    # 214.1-02 (STEP-02 / SC#4) — `inputs` joins the SAME sentence, on the identical
    # `business_requirement` precedent directly above. Measured at HEAD before the edit:
    # `grep -c inputs backend/app/services/workflow_authoring.py` → **0**, while
    # `WF_SCHEMA` (= `WorkflowDefinition.model_json_schema()`) ALREADY advertises the
    # field and its `InputFieldSpec` `$defs` entry (asserted, not assumed). The schema was
    # never the gap; the prompt was — so this is ONE field on ONE existing sentence, and
    # no schema changes.
    #
    # ⚠ THIS CLAUSE GUARANTEES NOTHING, and SC#4 asks for a guarantee. The rule this
    # module already records twice binds verbatim: *"a prompt clause reduces how often the
    # model composes such a step; it can never guarantee absence."* SC#4 says an
    # AI-drafted workflow is publishable WITHOUT HAND-REPAIR — so the words below are the
    # cheap half and `_declare_asked_arguments` is the half that carries the claim.
    # Nothing downstream may be relaxed on the strength of these words.
    "Set the definition `slug`, `version` (1), `name`, `status` ('draft'), "
    "`business_requirement` — ONE line saying what this workflow must deliver on ANY "
    "run, phrased so it stays true for the next run and the one after, NOT a restatement "
    "of the particular request described below — and `inputs`: whenever a step's "
    "argument is asked for at launch, declare a matching entry under the SAME key."
)


def resolve_authoring_model(settings) -> str | None:
    """Resolve the NL-authoring model (D-103-2) the same way the judge resolves its model
    (``resolve_judge_model`` — WR-05 discipline). NOT the composer's selected model — a
    fixed, confirmed-forceable strong default so draft quality is consistent and the
    ``emit_workflow_definition`` shot is guaranteed forceable.

    Resolution order:
      1. ``settings.harness_authoring_model`` if set.
      2. else the first registry default in ``("claude-opus-4-8", "gpt-5.5")`` whose
         ``get_model_capability(candidate).get("forced_emission")`` is truthy.
      3. else ``None`` (the caller emits an honest "no authoring model resolved" failure).
    """
    model = getattr(settings, "harness_authoring_model", None)
    if model:
        return model

    from app.config import get_model_capability  # function-local (Pitfall 4 discipline)

    for candidate in ("claude-opus-4-8", "gpt-5.5"):
        cap = get_model_capability(candidate) or {}
        if cap.get("forced_emission"):
            return candidate
    return None


def _strip_discriminator(node):
    """Remove OpenAPI-style ``discriminator`` keys before the schema reaches the emit tool
    (Pitfall 7 — some providers' ``input_schema`` validation rejects them). The ``oneOf``
    variants keep their ``const phase_type`` so the model still picks the right config;
    Pydantic re-applies the discriminator at ``model_validate``, the real strict gate.
    REPRODUCED from the throwaway spike (``authoring_feel.py:241``) — not imported.
    """
    if isinstance(node, dict):
        node.pop("discriminator", None)
        for v in node.values():
            _strip_discriminator(v)
    elif isinstance(node, list):
        for v in node:
            _strip_discriminator(v)
    return node


# Built once at import — the discriminator-stripped WorkflowDefinition schema the emit
# tool advertises. A deepcopy so the model's cached json schema is never mutated.
WF_SCHEMA = _strip_discriminator(copy.deepcopy(WorkflowDefinition.model_json_schema()))

# The emit tool the forced shot names (the FORCE-tier path sets force_tool_name to this).
EMIT_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "emit_workflow_definition",
        "description": "Emit a single valid WorkflowDefinition for this task.",
        "parameters": WF_SCHEMA,
    },
}


async def _assemble_grounding(
    *,
    supabase,
    pool,
    user_id: str,
    project_folder_id: str | None,
    template_asset_id: str | None = None,
    template_placeholders: list[str] | None = None,
) -> tuple[str, set[str], set[str]]:
    """Assemble the server-side grounding bundle and return ``(grounded_prompt,
    tool_names, skill_ids)``. All accessors are OWNER-scoped reads; the valid folder /
    tool / skill SETS are computed server-side so KB content can never whitelist itself
    (T-103-02-03; the 101.1-06 precedent).

    Phase 182 (VALID-01 / D-182-02): a THIN DELEGATE to
    ``app.services.harness.grounding`` — the ONE shared grounding source the visual
    canvas's ``/validate`` seam and ``/grounding-bundle`` palette also call. The compute
    and the NL render moved there VERBATIM; this wrapper keeps NL generation's historical
    ``(str, set, set)`` tuple contract byte-identical (and keeps ``wa._assemble_grounding``
    a module attribute, so the Phase-103 monkeypatch test seam is untouched).
    """
    from app.services.harness.grounding import (  # function-local (Pitfall 4 discipline)
        assemble_grounding_bundle,
        render_grounding_prompt,
    )

    bundle = await assemble_grounding_bundle(
        supabase=supabase,
        pool=pool,
        user_id=user_id,
        project_folder_id=project_folder_id,
        template_asset_id=template_asset_id,
        template_placeholders=template_placeholders,
    )
    grounded = render_grounding_prompt(bundle, project_folder_id)
    return grounded, bundle.tool_names, bundle.skill_ids


async def _check_grounding_fidelity(
    wd: WorkflowDefinition,
    *,
    supabase,
    user_id: str,
    tool_names: set[str],
    skill_ids: set[str],
) -> dict | None:
    """Grounding FIDELITY (REQ-2 d) — returns a grounding_failed dict on any violation,
    or ``None`` when clean. Three server-side checks the model cannot widen:
      1. every per-phase folder_scope UUID ⊆ the bound project subtree
         (``assert_folder_scopes_subset`` — owner-scoped, raises ValueError on non-⊆);
      2. every ``available_tools`` entry ∈ the real tool registry;
      3. every ``skill_ref`` ∈ the owner/global enabled skill set.

    Phase 182 (D-182-02 / D-182-06): a THIN DELEGATE to the ONE shared copy of these
    rules in ``app.services.harness.grounding``. That module's short-circuit presentation
    is byte-identical to the pre-182 body that lived here; its sibling
    ``grounding_verdicts`` gives the ``/validate`` seam the per-node list over the SAME
    rules. There is no second implementation.
    """
    from app.services.harness.grounding import (  # function-local (Pitfall 4 discipline)
        _check_grounding_fidelity as _shared_check_grounding_fidelity,
    )

    return await _shared_check_grounding_fidelity(
        wd, supabase=supabase, user_id=user_id, tool_names=tool_names, skill_ids=skill_ids
    )


# ── Phase 214 (STEP-06 / D-214-20) — THE AUTHOR'S TICKED SERVICES AS A VOCABULARY ─────────
#
# ⚠ THIS BLOCK IS THE PROMPT HALF, AND THE PROMPT HALF ALONE GUARANTEES NOTHING. The rule
# stated further up this module about the interactive-step clause applies verbatim here: *"a
# prompt clause reduces how often the model composes such a step; it can never guarantee
# absence."* D-214-20's claim is STRUCTURAL IMPOSSIBILITY, and a prompt cannot deliver that —
# `_check_allowed_connections` below is the half that does, and nothing downstream may be
# relaxed on the strength of these words.
#
# ⚠ LENGTH IS MEASURED FROM THE LITERAL AT RUNTIME, NEVER HAND-COUNTED — the discipline this
# file already records for the `external_action` bullet and the DELIVERABLE RULE's interactive
# clause, both of which say an over-long block is a NUDGE. **Measured 2026-08-28: the two
# frames below are 236 and 237 characters**, against a DELIVERABLE-RULE block of 1202 and a
# phase-type-bullet median of 83.5. They are proportionate to the RULES block they sit beside
# (the only comparison that means anything) and are not a second nudge toward `external_action`
# — the *forbid* frame in particular can only ever narrow composition.
# ⚠ THE COMMENT ABOVE ROTS AND THE TEST DOES NOT: `test_214_describe_vocabulary.py`
# RE-DERIVES both figures from these literals and asserts the bound, exactly as F-8 does for
# the bullets. This file's own history is the reason — it records a comment that credited a
# control with a mitigation it did not deliver.
# ⚠ AND THAT TEST FIRED ON THIS VERY COMMENT, IN THE COMMIT THAT WROTE IT. The forbid frame
# was hand-counted here as **178**; the re-derivation measured **237** on its first run and this
# line was corrected to match. A hand-counted constant in this file was wrong within minutes of
# being written — which is the argument for the test, made by the test.
_VOCABULARY_ALLOWED_FRAME = (
    "CONNECTED SERVICES — the ONLY connections an `external_action` phase may name:\n"
    "{lines}\n"
    "Set `connection_id` to one of the ids above and `tool_name` to one of that "
    "connection's listed actions. Any other value is rejected after you emit.\n\n"
)

_VOCABULARY_FORBIDDEN_FRAME = (
    "CONNECTED SERVICES: none. Do NOT compose an `external_action` phase at all — there is "
    "nothing for one to act through, and a workflow containing one is rejected after you "
    "emit. Write the deliverable with the tools you are given instead.\n\n"
)


def _render_vocabulary_block(vocabulary: dict[str, dict]) -> str:
    """Render the ticked connections as a prompt paragraph, or the forbid frame when empty.

    ``vocabulary`` maps connection id -> ``{"name": str, "service_id": str,
    "actions": list[str]}``. Only ids the author ticked appear, and only GRANTED actions —
    the grant grain IS the vocabulary grain (STEP-06 depends on Phase 213).
    """
    if not vocabulary:
        return _VOCABULARY_FORBIDDEN_FRAME
    lines = "\n".join(
        f"- id `{cid}` — {meta.get('name') or meta.get('service_id') or cid} "
        f"({meta.get('service_id') or 'service'}); actions: "
        f"{', '.join(meta.get('actions') or []) or 'none'}"
        for cid, meta in vocabulary.items()
    )
    return _VOCABULARY_ALLOWED_FRAME.format(lines=lines)


def _check_allowed_connections(
    wd: WorkflowDefinition,
    allowed: list[str] | None,
    vocabulary: dict[str, dict] | None = None,
) -> dict | None:
    """⭐ THE ENFORCEMENT HALF — walk the EMITTED definition and refuse an out-of-vocabulary step.

    Returns an honest structured error dict, or ``None`` when clean. **This is what makes
    D-214-20's "structurally impossible" true**: the prompt block above reduces how often the
    model composes such a step, and this refuses the ones it composes anyway.

    ⚠ ``allowed is None`` AND ``allowed == []`` ARE DIFFERENT, AND THE FIRST LINE IS WHERE THAT
    LIVES. ``None`` means the author expressed no preference, so today's behaviour is returned
    unchanged — no check, no refusal, byte-identical to the pre-214 path. ``[]`` means they
    ticked nothing, which is a DECISION that no ``external_action`` may be emitted at all. An
    ``if not allowed:`` here would collapse the two and silently forbid every external step for
    every caller that never sent the field.

    ⚠ A FAILURE NEVER CARRIES A RUNNABLE OR PARTIAL DRAFT (REQ-2 c, and D-214-21's own words:
    *"a draft containing a hole is a draft that can be published if the hole is missed"*). The
    returned dict has no ``definition`` key and no ``readiness`` key.
    """
    if allowed is None:
        return None

    allowed_set = {str(cid) for cid in allowed}
    vocab = vocabulary or {}
    for phase in wd.phases:
        config = getattr(phase, "config", None)
        if getattr(config, "phase_type", None) != "external_action":
            continue
        connection_id = getattr(config, "connection_id", None)
        # An `external_action` with NO connection bound is 189's `recorded_not_sent` shape and
        # names no service, so there is nothing here to hold against the vocabulary — EXCEPT
        # when the author ticked nothing at all, which is a decision that no such phase may
        # exist. Both arms are stated rather than folded together.
        if not allowed_set:
            return {
                "ok": False,
                "error": "connection_not_allowed",
                "detail": (
                    f"phase '{phase.slug}' acts outside the app, but no connected service was "
                    "chosen for this workflow."
                ),
            }
        if connection_id is None or str(connection_id) not in allowed_set:
            return {
                "ok": False,
                "error": "connection_not_allowed",
                "detail": (
                    f"phase '{phase.slug}' names a service that was not chosen for this "
                    "workflow."
                ),
            }
        # ⭐ THE GRANT GRAIN, NOT THE DISCOVERY GRAIN. A ticked connection is not a licence for
        # every tool on it: the executor's gate 5.5 resolves each tool's own posture, so a step
        # naming an ungranted tool would validate here and refuse at run time — which is
        # precisely *"an invented step that validates and fails at 03:00"*.
        actions = (vocab.get(str(connection_id)) or {}).get("actions")
        if actions is None:
            # No action list was supplied for this connection, so there is nothing to check
            # against. Recorded as a distinct arm rather than passing silently: it is the
            # caller's omission, not a grant.
            continue
        tool_name = getattr(config, "tool_name", None) or getattr(config, "capability", None)
        if tool_name is None or str(tool_name) not in set(actions):
            return {
                "ok": False,
                "error": "connection_not_allowed",
                "detail": (
                    f"phase '{phase.slug}' uses an action that is not allowed on the chosen "
                    "service."
                ),
            }
    return None


def _declare_asked_arguments(wd: WorkflowDefinition) -> WorkflowDefinition:
    """⭐ Phase 214.1-02 (STEP-02 / SC#4 / D-214.1-05) — THE HALF THAT GUARANTEES IT.

    Declare, under ``definition.inputs``, every launch key the emitted definition's own
    steps say they will ASK for. Returns ``wd`` unchanged when there is nothing to add.

    ── WHY A DERIVATION AND NOT JUST THE PROMPT ────────────────────────────────────────
    The clause added to ``AUTHORING_SYSTEM_PROMPT`` above is the cheap half, and this
    module records twice why it cannot be the whole one: *"a prompt clause reduces how
    often the model composes such a step; it can never guarantee absence."* SC#4 says an
    AI-drafted workflow is publishable **without hand-repair** — a guarantee — and
    ``BUG-260828-02`` is exactly what its absence looks like: the publish gate refuses
    ``ask_undeclared`` on a draft nobody could repair, because no authoring surface could
    declare an input at all. This function is the sibling of ``_check_allowed_connections``
    directly above: the prompt reduces, the server-side walk of what was ACTUALLY emitted
    makes the claim true.

    ── WHAT THIS IS ────────────────────────────────────────────────────────────────────
    A COMPLETION OF THE AUTHOR'S OWN EXPRESSED INTENT. The model already said *this
    argument is asked for at launch*; the declaration is the mechanical consequence of
    that sentence and of nothing else. It is derived from the emitted definition alone.

    ── WHAT THIS IS NOT (D-214.1-05's scope limit) ─────────────────────────────────────
    It is **not** a censor over generated text: it removes nothing, rewrites nothing, and
    never touches a field the model set. It **invents no value** — ``label`` is the key
    itself, ``required`` is the schema default, and ``type`` is ``"text"``, the only type
    this phase has. ⛔ A friendly ``label`` is NOT fabricated here: a made-up human name is
    precisely the invention the launch renderer's two-arm rule refuses, and plan 214.1-01
    Task 3 makes ``label == key`` read as an ABSENCE downstream, so the launcher prints
    the key in the mono face rather than pretending a person wrote prose.

    ── THE KEY RULE IS THE GATE'S OWN RULE ─────────────────────────────────────────────
    ``key = spec.ask_key or <property name>`` — the SAME resolution
    ``connectors/args.py`` performs (``resolve_arguments``) and refuses with
    (``unsatisfiable_arguments`` → ``ask_undeclared``). A second answer here would draft a
    workflow the publish gate then refuses, which is D-214-00's drift pointing at the
    author.

    ⚠ A RESERVED KEY IS NEVER DECLARED (T-214.1-02-01). ``RESERVED_RUN_INPUT_KEYS`` values
    are STRIPPED server-side at both run-input merge sites, so a declared ``folder_id`` or
    ``kickoff_prompt`` would mint a launch field whose value silently vanishes — the trap
    214-09 measured and D-214.1-03 refuses at the authoring door. The set is IMPORTED, not
    re-typed, so a third reserved key inherits this skip with no edit here.

    ⚠ ``model_copy``, NEVER AN IN-PLACE MUTATION AND NEVER A MODEL-LEVEL VALIDATOR HOOK —
    the same rule the two provenance stamps state at the call site. The save path persists
    ``model_dump(mode="json")``, so a derivation living in the model would be BAKED into
    the JSONB and could never change when the row changes.

    ⚠ ``None`` AND ``[]`` ARE DIFFERENT FACTS and are not collapsed. When there is nothing
    to add, ``wd`` is returned untouched — a definition that declared nothing keeps its
    ``None``, and one whose list is empty keeps its ``[]``.
    """
    from app.models.harness import InputFieldSpec  # function-local (Pitfall 4 discipline)
    from app.models.message import RESERVED_RUN_INPUT_KEYS

    existing = list(wd.inputs or [])
    already: set[str] = {str(getattr(f, "key", "") or "") for f in existing}
    additions: list[InputFieldSpec] = []

    for phase in wd.phases:
        config = getattr(phase, "config", None)
        if getattr(config, "phase_type", None) != "external_action":
            continue
        for prop, spec in (getattr(config, "arg_sources", None) or {}).items():
            if getattr(spec, "source", None) != "ask":
                continue
            key = str(getattr(spec, "ask_key", None) or prop)
            if key in RESERVED_RUN_INPUT_KEYS or key in already:
                continue
            already.add(key)  # ⇒ two steps asking under one key produce ONE entry
            additions.append(
                InputFieldSpec(key=key, label=key, type="text", required=True)
            )

    if not additions:
        return wd
    return wd.model_copy(update={"inputs": [*existing, *additions]})


async def _resolve_allowed_vocabulary(
    *, supabase, user_id: str, allowed_connection_ids: list[str] | None
) -> dict[str, dict]:
    """Resolve the ticked connections into ``{id: {name, service_id, actions}}``, SERVER-SIDE.

    ⚠ THE SETS ARE COMPUTED HERE AND NEVER TAKEN FROM THE CLIENT (T-103-02-03, the same rule
    the folder / tool / skill grounding sets obey). The request carries only the author's
    TICKED IDS; which ACTIONS those connections may perform is a fact about org-scoped rows and
    their grants, so a client that claimed a longer action list would be claiming a permission.

    ⭐ THE GRANT GRAIN, THROUGH THE ONE HOME. ``is_tool_allowed`` is the executor's own
    predicate (`app.services.connectors.grants`, gate 5.5's), imported rather than reproduced —
    a second copy here would drift from the gate that actually stops the send, which is exactly
    the two-copies-of-one-predicate failure D-214-00 exists to prevent.

    FAIL-CLOSED. An unreadable membership or connection list yields an EMPTY vocabulary, which
    NARROWS composition; it never widens it. An id the caller's org does not own simply does
    not appear, so a cross-org id constrains rather than granting anything.
    """
    if not allowed_connection_ids:
        return {}

    from app.services.connector_service import list_connections  # function-local (Pitfall 4)
    from app.services.connectors.grants import is_tool_allowed  # function-local
    from app.services.connectors.service_tools import tool_facet as _facet
    from app.utils.folder_utils import _resolve_caller_org_ids  # function-local

    wanted = {str(cid) for cid in allowed_connection_ids}
    vocabulary: dict[str, dict] = {}
    try:
        org_ids = await _resolve_caller_org_ids(supabase, user_id)
        for org_id in sorted(org_ids):
            for conn in await list_connections(org_id=org_id, supabase=supabase):
                cid = str(getattr(conn, "id", "") or "")
                if cid not in wanted or cid in vocabulary:
                    continue
                candidates: list[str] = []
                for tool in getattr(conn, "discovered_tools", None) or []:
                    name = tool.get("name") if isinstance(tool, dict) else None
                    if isinstance(name, str) and name.strip() and name not in candidates:
                        candidates.append(name)
                capability = getattr(conn, "capability", None)
                if isinstance(capability, str) and capability and capability not in candidates:
                    candidates.append(capability)
                for key in (getattr(conn, "tool_grants", None) or {}):
                    if isinstance(key, str) and key and key not in candidates:
                        candidates.append(key)
                vocabulary[cid] = {
                    "name": getattr(conn, "name", None),
                    "service_id": getattr(conn, "service_id", None),
                    # Phase 221 — the application rung here too, so the authoring picker
                    # offers exactly what the executor will permit. A tool listed here and
                    # refused at run time is the worst of both.
                    "actions": [
                        a
                        for a in candidates
                        if is_tool_allowed(
                            conn,
                            a,
                            application=_facet(getattr(conn, "service_id", None), a)[0],
                            is_write=_facet(getattr(conn, "service_id", None), a)[1],
                        )
                    ],
                }
    except Exception:  # noqa: BLE001 — an unreadable set NARROWS the vocabulary, never widens it
        logger.warning(
            "214 STEP-06: could not resolve the author's connection vocabulary; "
            "generation will refuse every external_action step",
            exc_info=True,
        )
        return {}
    return vocabulary


def _normalised_for_copy_check(text: str) -> str:
    """Normalise a string for the D-07 describe-copy comparison: strip, collapse every
    internal whitespace run to a single space, casefold.

    Deliberately CRUDE, and that is the right shape. It is not a similarity metric and
    must never become one — it answers exactly one question ("is this the same text with
    different spacing or casing?"), which is the only question the stamp asks. A fuzzy
    threshold here would refuse provenance for requirements that are genuinely durable
    but happen to share vocabulary with the describe box, which is the ordinary case.
    """
    return " ".join(text.split()).casefold()


async def generate_workflow_definition(
    *,
    describe: str,
    supabase,
    user_id: str,
    settings,
    pool: Any = None,
    project_folder_id: "UUID | str | None" = None,
    template_asset_id: "UUID | str | None" = None,
    template_placeholders: list[str] | None = None,
    # ── Phase 214 (STEP-06 / D-214-20) — THE AUTHOR'S TICKED SERVICES ────────────────────
    #
    # Keyword-only, on the ``template_placeholders`` precedent directly above: an optional
    # pre-draft choice the describe door makes and only this call can spend.
    #
    # ⚠ THE TWO ARMS DIFFER AND MUST NEVER COLLAPSE — this is stated HERE, at the declaration,
    # because that is where a future caller reads it:
    #   · ``None``  → today's behaviour EXACTLY. No vocabulary block in the prompt, no
    #                 post-emit check, byte-identical to the pre-214 path.
    #   · ``[]``    → the author ticked NOTHING, which is a DECISION rather than a missing
    #                 value: no ``external_action`` phase may be emitted at all.
    # An ``or None`` / ``or []`` anywhere on this path turns one into the other — the same
    # ``0``-vs-``null`` family this project documents on ``WorkflowRunPhase.step_count``.
    allowed_connection_ids: list[str] | None = None,
) -> dict:
    """Generate ONE grounded ``WorkflowDefinition`` draft from an NL description.

    Returns on success ``{"ok": True, "definition": <model_dump json>, "readiness": …}``
    (NOT persisted — persistence is REQ-1's explicit ``POST /workflows`` create). The
    ``readiness`` key is Phase 197 / D-13: the server's own verdict on whether the draft
    can be published, in the gate's own words, sourced by IMPORT from
    ``app.services.harness.grounding``. It is present ONLY here, on the success path — see
    the block that builds it. On failure returns an
    honest structured error: ``{"ok": False, "error": <code>, "detail": ...}`` where code
    is one of ``no_authoring_model`` / ``could_not_generate`` / ``grounding_failed`` /
    ``connection_not_allowed`` (Phase 214 STEP-06). A failure NEVER carries a runnable/partial
    draft (REQ-2 c).

    ⚠ ``connection_not_allowed`` NEEDS NO CLIENT CHANGE, AND THAT IS A MEASUREMENT RATHER THAN
    AN ASSUMPTION. The refusal's render path is agnostic about the code string:
    ``useTemplateFirstDraft.ts:580`` calls ``store.getState().setErrorState(result.error,
    result.detail)`` on any ``result.ok === false``; ``builderStore.ts:433-439`` sets
    ``builderPhase: "error"`` with the message and detail; ``WorkflowBuilderPage.tsx:2151``
    renders it. Plan ``214-14``'s seam **S-7** drives that path end to end — this docstring
    names it so a *"covered by the audit"* claim can be checked rather than believed.

    Provider-call budget (REQ-2 a/b): EXACTLY one call on a valid first emit; EXACTLY two
    (attempt 1 then 2, no third) on a first-pass ValidationError; each call emits one
    ``nl_generation_attempt`` structured-log event.
    """
    from app.config import get_model_capability  # function-local
    from app.services.forced_emit import forced_emit  # function-local

    authoring_model = resolve_authoring_model(settings)
    if authoring_model is None:
        return {
            "ok": False,
            "error": "no_authoring_model",
            "detail": "no authoring model resolved (Settings.harness_authoring_model unset)",
        }
    provider = (get_model_capability(authoring_model) or {}).get("provider")
    if provider is None:
        return {
            "ok": False,
            "error": "no_authoring_model",
            "detail": f"no provider for authoring model {authoring_model!r}",
        }

    # The gateway resolves the provider key + active provider from a per-USER settings
    # object (``UserEffectiveSettings.active_provider``) — NOT the app-level ``Settings``.
    # The judge (publish_service) loads owner settings the same way. Passing the app
    # ``Settings`` straight through made the forced shot raise
    # ``AttributeError('active_provider')`` inside the gateway → the backstop reported a
    # generic ``provider_error`` and NL authoring silently failed (UAT-103 live fix).
    from app.models.user_settings import load_user_settings  # function-local (Pitfall 4)

    try:
        owner_settings = load_user_settings(user_id)
    except Exception:  # noqa: BLE001 — no resolvable user settings → honest fail, never a crash
        return {
            "ok": False,
            "error": "could_not_generate",
            "detail": "no user settings resolved for the authoring call",
        }

    project_id_str = str(project_folder_id) if project_folder_id is not None else None
    grounded_prompt, tool_names, skill_ids = await _assemble_grounding(
        supabase=supabase,
        pool=pool,
        user_id=user_id,
        project_folder_id=project_id_str,
        template_asset_id=str(template_asset_id) if template_asset_id is not None else None,
        template_placeholders=template_placeholders,
    )

    # ── Phase 214 (STEP-06) — THE VOCABULARY, RESOLVED SERVER-SIDE, THEN SPENT TWICE ──────
    #
    # Once as PROMPT (it reduces how often the model composes an out-of-vocabulary step) and
    # once as ENFORCEMENT after the emit (it is what makes D-214-20's claim true). The single
    # resolve feeds both, so the words the model was given and the rule it is judged against
    # cannot disagree — two resolves would be two sources for one fact.
    #
    # ⚠ THE ``is not None`` TEST IS THE WHOLE ABSENT-VS-EMPTY DISTINCTION. With ``None`` the
    # prompt gains nothing at all, which is what makes the unconstrained arm byte-identical to
    # the pre-214 path.
    allowed_vocabulary = await _resolve_allowed_vocabulary(
        supabase=supabase, user_id=user_id, allowed_connection_ids=allowed_connection_ids
    )
    vocabulary_block = (
        _render_vocabulary_block(allowed_vocabulary) if allowed_connection_ids is not None else ""
    )

    base_messages = [
        {
            "role": "user",
            "content": grounded_prompt
            + "\n\n"
            + vocabulary_block
            + "## The task to author\n"
            + describe,
        }
    ]

    async def _shot(messages: list[dict], attempt: int) -> dict:
        # RESEARCH A2: a structured log event (NOT a harness_audit row — closed CHECK).
        # The integer attempt index is the ONLY payload (T-103-02-06 — no prompt/secret).
        logger.info("nl_generation_attempt", extra={"attempt": attempt})
        return await forced_emit(
            messages=messages,
            model=authoring_model,
            provider=provider,
            emitter="emit_workflow_definition",
            tools=[EMIT_TOOL],
            user_settings=owner_settings,
            system_prompt=AUTHORING_SYSTEM_PROMPT,
            schema_model=WorkflowDefinition,
            strict=False,  # Pitfall 1: force-without-strict for the optional-heavy schema
        )

    res1 = await _shot(base_messages, 1)
    wd = res1.get("emitted")

    if wd is None:
        # EXACTLY one retry with the failure fed back (REQ-2 b — no third call).
        err = res1.get("failure") or "validation_failed"
        retry_messages = base_messages + [
            {"role": "assistant", "content": "(the previous emission failed validation)"},
            {
                "role": "user",
                "content": (
                    f"Your emission failed strict validation:\n{err}\n"
                    "Re-emit a COMPLETE valid WorkflowDefinition using ONLY schema fields."
                ),
            },
        ]
        res2 = await _shot(retry_messages, 2)
        wd = res2.get("emitted")
        if wd is None:
            return {
                "ok": False,
                "error": "could_not_generate",
                "detail": res2.get("failure") or "model_failed_to_emit",
            }

    # Grounding fidelity (only on a non-None wd) — distinct from model_validate.
    fidelity = await _check_grounding_fidelity(
        wd, supabase=supabase, user_id=user_id, tool_names=tool_names, skill_ids=skill_ids
    )
    if fidelity is not None:
        return fidelity

    # ── ⭐ Phase 214 (STEP-06 / D-214-20) — THE VOCABULARY CONSTRAINT, ENFORCED ────────────
    #
    # BESIDE the grounding-fidelity check and for the identical reason: both are server-side
    # rules the model cannot widen, applied to what it ACTUALLY emitted rather than to what it
    # was asked for. The prompt block above is a reduction; this is the absence.
    #
    # ⚠ IT RETURNS BEFORE THE PROVENANCE STAMPS AND THE SLUG MINT, so a refused generation
    # carries NO definition, no readiness and no minted slug (REQ-2 c — a failure never carries
    # a runnable or partial draft). ``allowed_connection_ids is None`` short-circuits inside
    # ``_check_allowed_connections``, so the unconstrained path reaches this line and leaves it
    # having done nothing.
    vocabulary_refusal = _check_allowed_connections(wd, allowed_connection_ids, allowed_vocabulary)
    if vocabulary_refusal is not None:
        return vocabulary_refusal

    # ── Phase 214.1-02 (STEP-02 / SC#4) — DECLARE what the emitted steps ASK FOR.
    #
    # Placed here for the reason the two stamps below are: on the SINGLE success path,
    # AFTER the vocabulary refusal, so a first-emit result and a retry-emit result are
    # treated identically and a REFUSED generation gains nothing. The four
    # `{"ok": False, …}` returns above are untouched — a failed generation carries no
    # definition and makes no claim about publishability (REQ-2 c / T-214.1-02-03).
    #
    # ⚠ It runs BEFORE the slug mint and the readiness verdict deliberately: the verdict
    # must describe the definition actually returned, and the definition actually returned
    # is the one whose asked arguments are declared.
    wd = _declare_asked_arguments(wd)

    # ── Phase 187 (VOCAB-01 / REQ-3, D-187-03) — stamp the name PROVENANCE.
    #
    # SERVER-SIDE, AFTER validation, UNCONDITIONALLY (T-187-02-02). The marker is
    # never read off the emitted payload, so a model cannot claim that a name it just
    # wrote was hand-typed by a person — which matters because the demote-on-config-
    # edit rule (D-187-07) clears a GENERATOR-seeded name and never a hand-typed one.
    #
    # A name that trims empty was not seeded, and we do not claim it was: provenance
    # for a name that does not exist would make that rule read a lie.
    #
    # `model_copy` on each PhaseSpec, rebuilding the list — never a mutation in place,
    # and never a model-level validator hook (the save path persists
    # `model_dump(mode="json")`, so a derivation living in the model would be baked
    # into the JSONB; see the PhaseSpec docblock in `app/models/harness.py`).
    #
    # This sits on the SINGLE success path, so a first-emit result and a retry-emit
    # result are stamped identically.
    wd = wd.model_copy(
        update={
            "phases": [
                p.model_copy(
                    update={"name_seeded_by_ai": bool(p.name and p.name.strip())}
                )
                for p in wd.phases
            ]
        }
    )

    # ── Phase 193.2 (AUTH-03 / D-06, `SEED-163`) — stamp the REQUIREMENT provenance.
    #
    # The sibling of the stamp directly above, and it inherits five of that stamp's six
    # rules unchanged. It is stated here rather than cross-referenced, because a reader
    # who lands on this stamp must find its rules without first finding the other one.
    #
    # SERVER-SIDE, AFTER validation, on the SINGLE success path — so a first-emit result
    # and a retry-emit result are stamped identically, and it lands BEFORE the slug mint
    # below for the same reason the name stamp does.
    #
    # NEVER READ OFF THE EMITTED PAYLOAD. `WF_SCHEMA` is `WorkflowDefinition`'s own JSON
    # schema, so the emit tool now ADVERTISES this flag to the model — and the model does
    # not get to set it. A model that emits `business_requirement_seeded_by_ai: false`
    # alongside text it just wrote cannot launder that text into looking hand-typed, and
    # one emitting `true` with an empty requirement cannot manufacture a mark for nothing.
    # Both directions are asserted (the T-187-02-02 shape, T-193.2-03b here).
    #
    # AN EMPTY VALUE IS NEVER STAMPED, and the shipped reason applies verbatim: provenance
    # for a value that does not exist would make the demote-on-edit rule read a lie.
    #
    # `model_copy`, never a mutation in place, and NEVER a model-level validator hook —
    # the save path persists `model_dump(mode="json")`, so a derivation living in the
    # model would be baked into the JSONB (see the `WorkflowDefinition` docblock in
    # `app/models/harness.py`, which points back at this stamp).
    #
    # ⚠ THE SIXTH RULE IS NEW — the D-07 WIDENING, and it is a CONTROL, not tidiness.
    # After this phase a model authors the criterion a model later grades the output
    # against: `business_requirement` is woven into `JUDGE_RUBRIC_CORE`
    # (`publish_service.py:1077-1082`) and read by the `answers_business_requirement`
    # criterion (`validator_kinds.py:142-149`). **Format-string injection is NOT possible**
    # — the value is substituted *into* `.format()` as data, never itself formatted, so
    # braces in it are inert. The residual is a WEAKENED GATE: a trivially-satisfiable
    # AI-authored criterion makes the judge stage easier to pass. **T-193.2-03 — D-09
    # ACCEPTS that residual**, because the author still presses Publish and D-06's visible
    # mark lets them see and overrule the proposal. The mechanical part of the mitigation
    # is right here: a value that is a normalised byte-identical copy of the `describe`
    # text is REFUSED the mark, because a durable requirement is a HARDER bar than one
    # run's task instruction, and echoing the instruction back is the cheapest way to
    # produce a criterion the judge cannot fail.
    #
    # ⚠ MEASURED AFTER THE PARAGRAPH ABOVE WAS WRITTEN, AND CORRECTED HERE BESIDE IT
    # RATHER THAN OVER IT (code-review WR-06, 2026-08-15). THE LAST SENTENCE ABOVE
    # CREDITS THIS CONTROL WITH A MITIGATION IT DOES NOT DELIVER, and the number is in
    # `.planning/phases/193.2-from-authored-to-runnable/193.2-FREQUENCY.md` §(c) — 20 real
    # generations — so the next reader can check it instead of trusting this prose. On the
    # `kit10` arm **openai named a one-run parameter in 5 of 5 requirements** —
    # representative: *"Produce a quarterly business review for customer Northwind
    # Logistics covering Q3 2026 …"* — and **all 5 were stamped `seeded_by_ai: True`. The
    # copy check fired on 0 of those 5.** (anthropic was 0 of 5 on the same arm: it wrote
    # durable requirements, so there was nothing there for a control to catch.) A reader
    # who trusted the paragraph above would conclude the weakened-judge residual is
    # mechanically mitigated and would not build the real mitigation.
    #
    # ⚠ THE CHECK IS NOT BROKEN AND MUST NOT BE "FIXED" HERE. Its question is *"is this
    # value a normalised copy of the `describe` text?"* and it answers that correctly —
    # all 20 stamps in that run were correct, including those five, because a requirement
    # naming one run's parameters IS still genuinely a model's proposal. A fuzzy
    # similarity threshold was considered and DELIBERATELY REJECTED; the reason is in
    # `_normalised_for_copy_check`'s own docstring (it would refuse provenance to
    # requirements that are durable but merely share vocabulary with the describe box,
    # which is the ordinary case). What was wrong was the CLAIM, not the predicate.
    #
    # ⇒ WHAT THIS CONTROL ACTUALLY DOES: it is an ANTI-ECHO guard. It refuses the mark to
    # the cheapest possible non-requirement — the describe text handed straight back — and
    # to nothing weaker. **It is not a durability control.** The phrase this phase settled
    # on, and the one that should be read off the mark anywhere it appears: **the
    # AI-proposal mark means "a model wrote this", NEVER "this is durable."** The
    # durability instruction lives in the prompt (D-07, `AUTHORING_SYSTEM_PROMPT`), it is
    # obeyed only in part, and the real backstop is D-06's visible mark under the author's
    # eye before they press Publish — which is exactly why D-09's acceptance rests on that
    # mark rather than on this predicate.
    #
    # The predicate is ONE expression: the shipped `bool(x and x.strip())` rule, WIDENED.
    # It is a widening of "empty was not seeded", not a second concern.
    #
    # ⚠ D-08 — WHEN THE MODEL EMITS NOTHING, NOTHING HAPPENS HERE. The field stays blank
    # and the shipped `REQUIREMENT_INVITATION` placeholder shows, which is TODAY'S EXACT
    # BEHAVIOUR. No second derive call, no schema-required field, no new string, no
    # server-side substitute text. D-09 — the publish gate is NOT touched: stage 1's
    # `business_requirement_missing` only checks non-emptiness and an AI-seeded value
    # passes it untouched, on purpose.
    _emitted_requirement = wd.business_requirement
    wd = wd.model_copy(
        update={
            "business_requirement_seeded_by_ai": bool(
                _emitted_requirement
                and _emitted_requirement.strip()
                and _normalised_for_copy_check(_emitted_requirement)
                != _normalised_for_copy_check(describe)
            )
        }
    )

    # Mint a UNIQUE slug for this net-new draft so two same-named generations never
    # collide on UNIQUE(slug, version) at create time (mirrors the existing fixture
    # convention of a short hash suffix). The Tweak fork keeps the published slug (a
    # different code path), so this is scoped to NL-generated births only (UAT-103).
    import uuid  # function-local (Pitfall 4 discipline)

    wd = wd.model_copy(update={"slug": f"{wd.slug}-{uuid.uuid4().hex[:8]}"})

    # ── Phase 197 (AUTH-02 / D-13) — the SERVER'S OWN READINESS VERDICT ──────────────
    #
    # The arrival card must RENDER a verdict, never DECIDE one (187-24). So the generate
    # path becomes a SECOND CONSUMER of the one home that already owns this rule —
    # exactly as `publish_service` stage 1 is — and declares neither the predicate nor
    # the sentence of its own. A local copy of either is the drift D-klo-DEF-01 predicted
    # and `grounding.py`'s own section header names ("one source, even trivial").
    #
    # ⚠ THE MESSAGE TRAVELS RATHER THAN BEING RE-TYPED IN TYPESCRIPT. D-182-06 forbids a
    # client-side message map, so the author sees the gate's words VERBATIM — this IS the
    # UI copy, and it is the same object the publish gauntlet would show.
    #
    # ⚠ D-20 — THE PAYLOAD CARRIES EXACTLY ONE ENTRY, AND THAT IS A MEASUREMENT, NOT AN
    # OMISSION. Every gauntlet stage was enumerated from source: stage 1's
    # `business_requirement_missing` is the ONLY definition-level predicate. Nothing
    # anywhere refuses a publish for a missing KB binding, a missing template, a missing
    # name or a missing deliverable — so a `readiness` that carried four extra greens
    # would be four claims the server cannot make, which is strictly worse than no field
    # at all. Adding a key here is a behaviour change to justify against the gauntlet.
    #
    # ⚠ THE `message` KEY EXISTS ONLY ON THE `missing` ARM. `"message": None` on the
    # present arm would be a nullable field and therefore a two-arm read waiting to
    # happen; the client's union depends on ABSENCE MEANING ABSENCE.
    #
    # ⚠ T-197-04 — it is a function of the definition just generated and carries no folder
    # name, no folder id, no user id and no other row's data: one status token, plus one
    # fixed server constant on one arm.
    #
    # ⚠ IT SITS ON THE SINGLE SUCCESS PATH, AFTER the provenance stamp and AFTER the slug
    # mint, so the verdict describes the definition actually returned. The four
    # `{"ok": False, …}` returns above gain NOTHING (T-197-07): a failed generation makes
    # no claim about publishability.
    from app.services.harness.grounding import (  # function-local (Pitfall 4 discipline)
        BUSINESS_REQUIREMENT_MISSING_MESSAGE,
        business_requirement_missing,
    )

    readiness: dict = {
        "business_requirement": (
            {"status": "missing", "message": BUSINESS_REQUIREMENT_MISSING_MESSAGE}
            if business_requirement_missing(wd)
            else {"status": "present"}
        )
    }

    return {
        "ok": True,
        "definition": wd.model_dump(mode="json"),
        "readiness": readiness,
    }
