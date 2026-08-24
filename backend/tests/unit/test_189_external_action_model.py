"""Phase 189 (CONN-01) — the falsification suite for the 7th phase type's model contract.

Covers validation rows **V01 (precursor) · V05 (the SET half) · V06 · V09**, plus the
closed-set discipline of **D-02** and the exact capability membership of **D-15**.

**Authored in Wave 0 and OBSERVED RED before any 189 source existed.**

What each group falsifies:

  * **D-01** — ``external_action`` is a 7th member of the ``PhaseConfig`` discriminated
    union; ``_StrictBase`` / ``extra="forbid"`` is untouched; a pre-189 JSONB row that
    names only the six shipped ``phase_type`` values still ``model_validate()``s (the
    additive-growth contract stated in ``app/models/harness.py``'s module docblock).
  * **D-04 / V06** — ``action_risk_armed`` **cannot be stored false** on this type. The
    round trip goes through ``WorkflowDefinition.model_validate`` on purpose: the point of
    D-04 is that a hand-edited JSONB row cannot lie about its own arming, so the STORED
    value must be coerced by the model, never resolved at engine time. The ``llm_single``
    negative control is load-bearing — without it the coercion test would also pass if the
    implementation simply armed everything.
  * **D-03 / V09** — the node cannot be wired around a gate: an ``external_action`` phase
    whose ``available_tools`` is emptied (or omitted) does not silently validate into a
    step with no whitelist entry for its own capability.
  * **D-15 / D-02** — the admissible capability set is EXACTLY
    ``{send_email, create_ticket, post_message}``, asserted as a SET (a per-name assertion
    would still pass if a fourth capability were added), and asserted DISJOINT from
    ``KB_TOOLS`` — a collision there would silently arm the grounding dial, because
    detection is ``available_tools ∩ KB_TOOLS``. A capability name outside the closed set
    RAISES; it is never resolved dynamically and never ``eval``'d.

**Anti-vacuity discipline.** Every ``external_action`` case calls
``_external_action_config_cls()`` FIRST. Without that guard the "unknown key raises" and
"unknown capability raises" cases would pass TODAY for entirely the wrong reason — at HEAD
*every* ``external_action`` payload raises ``ValidationError`` because the discriminator has
no such member — and would then be green forever without ever proving anything. The guard
turns those into honest REDs and keeps them honest after 189-07 lands the member.

No Supabase client, no conftest fixture: these are pure-Python Pydantic validations.
"""

from __future__ import annotations

import copy
import typing

import pytest
from pydantic import ValidationError

from app.models.harness import WorkflowDefinition
from app.services.harness.grounding import KB_TOOLS

# D-15 — the closed capability set, EXACTLY three. Ratified by the operator on
# 2026-08-07 over email-only (too thin a canvas vocabulary) and over a fourth name
# (Phase 190 has no plan to make a fourth real). Asserted as a SET below.
EXPECTED_CAPABILITIES: frozenset[str] = frozenset(
    {"send_email", "create_ticket", "post_message"}
)

EXTERNAL_ACTION_PHASE_TYPE = "external_action"

# The six shipped phase_type values (harness.py's PhaseConfig union at HEAD). A row using
# only these must keep validating forever — that is the additive-growth guarantee.
SHIPPED_PHASE_TYPES = (
    "programmatic",
    "llm_single",
    "llm_agent",
    "llm_batch_agents",
    "llm_human_input",
    "llm_emit",
)


def _external_action_config_cls():
    """The 7th union member's config class — RED until plan 189-07 lands it.

    Deliberately an ``assert`` rather than a bare import: an ImportError at module scope
    would make this whole file a COLLECTION ERROR, and a collection error is not a usable
    RED (it proves the file cannot run, not that the behaviour is absent).
    """
    from app.models import harness as harness_models

    cls = getattr(harness_models, "ExternalActionPhaseConfig", None)
    assert cls is not None, (
        "app.models.harness.ExternalActionPhaseConfig does not exist: D-01's 7th "
        "PhaseConfig union member (external_action) has not landed yet (plan 189-07). "
        "This is the expected Wave-0 RED."
    )
    return cls


def _definition(*phases: dict) -> dict:
    """A minimal, valid WorkflowDefinition dict wrapping the given phase specs."""
    return {
        "slug": "phase-189-probe",
        "version": 1,
        "name": "Phase 189 probe",
        "status": "draft",
        "phases": list(phases),
    }


def _external_action_phase(
    *,
    capability: str = "send_email",
    slug: str = "notify",
    phase_index: int = 0,
    available_tools: list[str] | None = None,
    omit_available_tools: bool = False,
    **spec_overrides,
) -> dict:
    """One ``external_action`` PhaseSpec dict, D-03 shaped (the capability rides
    ``available_tools`` so it flows through the SAME server-side whitelist guard every
    other tool does)."""
    config: dict = {
        "phase_type": EXTERNAL_ACTION_PHASE_TYPE,
        "capability": capability,
    }
    if not omit_available_tools:
        config["available_tools"] = (
            [capability] if available_tools is None else available_tools
        )
    phase: dict = {"slug": slug, "phase_index": phase_index, "config": config}
    phase.update(spec_overrides)
    return phase


def _llm_single_phase(*, slug: str = "write", phase_index: int = 0, **spec_overrides) -> dict:
    phase: dict = {
        "slug": slug,
        "phase_index": phase_index,
        "config": {"phase_type": "llm_single", "prompt": "Write it up."},
    }
    phase.update(spec_overrides)
    return phase


# ── D-01 — the 7th union member ───────────────────────────────────────────────



def _capability_literal_members(cls) -> set[str]:
    """The `capability` Literal's members, read THROUGH the optional wrapper Phase 206 added.

    Both D-15 fences below used to call ``typing.get_args(field.annotation)`` directly, which
    was exactly right while the annotation WAS a bare ``Literal``. Phase 206 made an MCP step
    legitimate — such a step names a ``tool_name`` and has no capability at all — so the
    annotation is now ``Literal[...] | None`` and ``get_args`` returns
    ``(Literal[...], NoneType)``: two class objects, which is why both fences died with
    ``TypeError: '<' not supported between instances of 'type' and '_LiteralGenericAlias'``.

    WARNING - THIS HELPER IS DELIBERATELY STRICTER THAN A `get_args` CALL, BECAUSE THE
    REGRESSION IT IS UNWRAPPING WAS SHIPPED BESIDE A WORSE ONE. The same commit wrote
    ``Literal[...] | str | None``, and that ``| str`` made the Literal INERT - every string
    admitted, the closed set reduced to a comment. So this refuses any union arm that is
    neither the Literal nor ``None``: a future ``| str`` fails HERE, by name, instead of
    quietly widening the set the two fences below then agree about.
    """
    annotation = cls.model_fields["capability"].annotation
    args = typing.get_args(annotation)

    if typing.get_origin(annotation) is typing.Literal:
        return set(args)

    literal_arms = [a for a in args if typing.get_origin(a) is typing.Literal]
    other_arms = [a for a in args if typing.get_origin(a) is not typing.Literal]

    assert len(literal_arms) == 1, (
        f"`capability` must carry EXACTLY ONE Literal arm, got {literal_arms!r} from "
        f"{annotation!r} — D-15's closed set cannot be spread across two spellings"
    )
    assert all(a is type(None) for a in other_arms), (
        f"`capability` may be optional but must stay CLOSED: the non-Literal union arms are "
        f"{other_arms!r}. A `| str` arm admits every capability name and reduces D-15 to a "
        "comment (it shipped that way once — see the model's own header block)."
    )
    return set(typing.get_args(literal_arms[0]))


def test_external_action_is_a_seventh_union_member():
    """V01 precursor / D-01 — the 7th discriminated member parses and exposes `capability`.

    The additive extension `LlmEmitPhaseConfig`'s own docblock calls "the standard
    extension (the 5 existing members were added this way)".
    """
    cls = _external_action_config_cls()

    wf = WorkflowDefinition.model_validate(
        _definition(_external_action_phase(capability="send_email"))
    )

    parsed = wf.phases[0].config
    assert type(parsed) is cls, (
        f"the external_action phase resolved to {type(parsed).__name__}, expected "
        f"{cls.__name__} — the discriminator must select the 7th member"
    )
    assert parsed.phase_type == EXTERNAL_ACTION_PHASE_TYPE
    assert getattr(parsed, "capability", None) == "send_email"


def test_an_unknown_key_on_the_external_action_config_still_422s():
    """D-01 / D-07 — `_StrictBase` (`extra="forbid"`) is untouched by the 7th member.

    Non-vacuous by construction: the CLEAN payload must parse first. At HEAD every
    external_action payload raises, so asserting only the rejection would be green for
    the wrong reason forever.
    """
    _external_action_config_cls()

    clean = _definition(_external_action_phase())
    WorkflowDefinition.model_validate(clean)  # must parse — the anti-vacuity half

    bogus = copy.deepcopy(clean)
    bogus["phases"][0]["config"]["bogus_field"] = 1
    with pytest.raises(ValidationError):
        WorkflowDefinition.model_validate(bogus)


def test_a_pre_189_row_still_validates():
    """D-01 — the additive-growth guarantee: a definition naming only the six shipped
    phase_type values parses unchanged after the 7th member lands.

    This case PASSES TODAY. It is the proof that this suite is not simply red for every
    input, and it is the regression fence the union's own docblock demands ("every value a
    stored JSONB row can already carry still validates").
    """
    phases = [
        {"slug": "fetch", "phase_index": 0, "config": {"phase_type": "programmatic", "fn": "do_fetch"}},
        {"slug": "write", "phase_index": 1, "config": {"phase_type": "llm_single", "prompt": "p"}},
        {
            "slug": "research",
            "phase_index": 2,
            "config": {"phase_type": "llm_agent", "prompt": "p", "available_tools": ["search_documents"]},
        },
        {
            "slug": "fan-out",
            "phase_index": 3,
            "config": {"phase_type": "llm_batch_agents", "prompt": "p", "available_tools": ["execute_code"]},
        },
        {"slug": "ask", "phase_index": 4, "config": {"phase_type": "llm_human_input", "prompt": "Approve?"}},
        {"slug": "emit", "phase_index": 5, "config": {"phase_type": "llm_emit", "prompt": "p"}},
    ]
    wf = WorkflowDefinition.model_validate(_definition(*phases))

    assert [p.config.phase_type for p in wf.phases] == list(SHIPPED_PHASE_TYPES), (
        "a pre-189 definition using only the six shipped phase types must still parse "
        "into those six types — renaming or reordering a member orphans stored rows"
    )


# ── D-04 / V06 — the arming cannot be stored false ────────────────────────────


def test_action_risk_armed_cannot_be_stored_false_on_this_type():
    """V06 / D-04 — `action_risk_armed` is STRUCTURALLY TRUE on `external_action`.

    Both halves go through `WorkflowDefinition.model_validate`, which is the whole point:
    a gate that can be loosened away is not a gate (185's hard-won rule), and a hand-edited
    JSONB row carrying `action_risk_armed: false` must not be able to lie about it. An
    engine-time resolution would leave the stored row saying something false.

    Half 1 — the key is present and FALSE (the disarm attempt).
    Half 2 — the key is ABSENT (the pre-189-shaped row; PhaseSpec defaults it to False).
    """
    _external_action_config_cls()

    stored_false = WorkflowDefinition.model_validate(
        _definition(_external_action_phase(action_risk_armed=False))
    )
    assert stored_false.phases[0].action_risk_armed is True, (
        "D-04: an external_action phase stored with action_risk_armed=false must read "
        "True after model_validate — the arming is not a default the author can clear"
    )

    key_absent = WorkflowDefinition.model_validate(
        _definition(_external_action_phase())
    )
    assert key_absent.phases[0].action_risk_armed is True, (
        "D-04: an external_action phase with no action_risk_armed key at all must still "
        "read True — absence must not be a disarm path"
    )


def test_a_shipped_type_may_still_be_unarmed():
    """D-04 negative control — the coercion is SCOPED to `external_action`.

    This case PASSES TODAY and must keep passing. Without it, the V06 case above would be
    satisfied by an implementation that armed every phase type, which would change the
    governance posture of six shipped types.
    """
    wf = WorkflowDefinition.model_validate(
        _definition(_llm_single_phase(action_risk_armed=False))
    )
    assert wf.phases[0].action_risk_armed is False, (
        "an llm_single phase stored with action_risk_armed=false must still read False — "
        "the D-04 pin is scoped to external_action and nothing else"
    )


# ── D-03 / V09 — it cannot be wired around the whitelist ──────────────────────


@pytest.mark.parametrize(
    "phase_kwargs,label",
    [
        ({"available_tools": []}, "available_tools emptied to []"),
        ({"omit_available_tools": True}, "available_tools omitted entirely"),
        ({"available_tools": ["search_documents"]}, "available_tools omits its own capability"),
    ],
)
def test_emptied_available_tools_is_a_validation_error(phase_kwargs, label):
    """V09 / SC#2 / D-03 — an external_action step cannot be wired around its own gate.

    The property SC#2 actually needs is: **after validation, the phase's
    `available_tools` contains its capability** — otherwise the capability never reaches
    `resolve_phase_available_tools` / the `phase_whitelist` dispatch backstop and the
    "rides the existing per-phase tool-whitelist guard" claim is false.

    Asserted so it holds under EITHER plan-07 disposition: a `ValidationError` (refuse) is
    an acceptable outcome, and so is coercion — what is NOT acceptable is validating
    silently into a phase whose whitelist lacks the capability.
    """
    _external_action_config_cls()

    payload = _definition(_external_action_phase(capability="send_email", **phase_kwargs))
    try:
        wf = WorkflowDefinition.model_validate(payload)
    except ValidationError:
        return  # refusing is a legitimate disposition

    tools = getattr(wf.phases[0].config, "available_tools", None) or []
    assert "send_email" in tools, (
        f"V09: with {label}, the phase validated silently and its available_tools is "
        f"{tools!r} — the capability must be present (coerced) or the definition must be "
        "refused; it may never validate into an ungoverned step"
    )


# ── D-15 / D-02 — the closed set ──────────────────────────────────────────────


def test_the_capability_set_is_exactly_three_and_disjoint_from_kb_tools():
    """D-15 · D-03 — the admissible capabilities are EXACTLY three, and none is a KB tool.

    Read from the model's own `Literal` via `typing.get_args`, so the assertion tracks the
    schema rather than a copy of it. Asserted as a SET, never per-name: a per-name
    assertion would still pass if a fourth capability were added, which is exactly what
    D-15 forbids (Phase 190 has no plan to make a fourth real).

    The disjointness half is not decoration — grounding DETECTION is
    `available_tools ∩ KB_TOOLS` (`grounding.py`), so a capability colliding with a KB tool
    would silently arm the grounding dial on every external-action step.
    """
    cls = _external_action_config_cls()

    field = cls.model_fields.get("capability")
    assert field is not None, (
        "ExternalActionPhaseConfig has no `capability` field — D-02 requires the author to "
        "pick a NAMED capability from a closed set"
    )
    capabilities = _capability_literal_members(cls)
    assert capabilities, (
        "`capability` is not a Literal — D-02's closed set must be expressed in the "
        f"schema, got annotation {field.annotation!r}"
    )

    assert capabilities == set(EXPECTED_CAPABILITIES), (
        f"D-15: the capability set must be exactly {sorted(EXPECTED_CAPABILITIES)}, got "
        f"{sorted(capabilities)}"
    )
    assert capabilities & KB_TOOLS == set(), (
        f"D-03: capability names must be DISJOINT from KB_TOOLS; overlap "
        f"{sorted(capabilities & KB_TOOLS)} would make every external_action step read as "
        "grounding-`detected`"
    )


def test_the_literal_and_the_runtime_frozenset_are_the_same_closed_set():
    """T-189-11 / plan 189-07 — THE CROSS-MODULE AGREEMENT FENCE.

    The closed set has TWO spellings and that is unavoidable: Pydantic needs a `Literal`
    in `app.models.harness`, while `EXTERNAL_ACTION_CAPABILITIES` is the runtime home in
    `app.services.harness.grounding` (a model module must not import a service, and the
    frozenset is what the publish fidelity gate and the executor read). Two spellings of
    ONE set is the drift shape this project keeps getting bitten by, so the agreement is
    MECHANICAL rather than remembered.

    A capability admitted by one reader and unknown to the other is either an
    unpublishable node (in the Literal, absent from the gate's membership set) or an
    unenforced one (in the frozenset, refused at parse) — the constant's own header block
    in `grounding.py` states exactly that. Neither state is detectable by any other test:
    `test_the_capability_set_is_exactly_three_and_disjoint_from_kb_tools` above reads only
    the Literal, and `test_103_grounding_fidelity.py` reads only the frozenset.

    OBSERVED RED before it was trusted: a fourth name (`wire_transfer`) planted in the
    Literal alone drove this assertion, and only this assertion, to failure.
    """
    from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

    cls = _external_action_config_cls()
    literal_members = _capability_literal_members(cls)

    assert literal_members == set(EXTERNAL_ACTION_CAPABILITIES), (
        "the `capability` Literal and grounding.EXTERNAL_ACTION_CAPABILITIES have "
        f"DRIFTED: only in the Literal {sorted(literal_members - set(EXTERNAL_ACTION_CAPABILITIES))!r}, "
        f"only in the frozenset {sorted(set(EXTERNAL_ACTION_CAPABILITIES) - literal_members)!r}. "
        "One closed set, two spellings — they must agree exactly (D-15 / D-20)."
    )
    # Anti-vacuity: two empty sets are also equal. The set under test is the D-15 three.
    assert literal_members == set(EXPECTED_CAPABILITIES)
    assert isinstance(EXTERNAL_ACTION_CAPABILITIES, frozenset), (
        "the runtime membership set must not be mutable"
    )


def test_a_capability_outside_the_closed_set_is_refused():
    """D-02 — closed-registry discipline: *a name not present RAISES.*

    Never resolved dynamically, never `eval`'d — the same rule `_TOOL_REGISTRY`,
    `PROGRAMMATIC_PHASE_REGISTRY` and `EMITTER_REGISTRY` all share.

    Non-vacuous by construction: an admissible capability must parse FIRST. At HEAD every
    external_action payload raises, so the rejection half alone would be green for the
    wrong reason.
    """
    _external_action_config_cls()

    for capability in sorted(EXPECTED_CAPABILITIES):
        WorkflowDefinition.model_validate(
            _definition(_external_action_phase(capability=capability))
        )  # the anti-vacuity half — every admitted name must actually be admitted

    with pytest.raises(ValidationError):
        WorkflowDefinition.model_validate(
            _definition(_external_action_phase(capability="wire_transfer"))
        )
