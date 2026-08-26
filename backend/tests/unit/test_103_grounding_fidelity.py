"""Phase 103 (REQ-2 / WFAUTH-02) — grounding fidelity (folder ⊆ subtree + registry).

Wave 0 (Plan 01 Task 1) authored the stubs; **Plan 02** fills them. The
``workflow_authoring`` grounding-fidelity check now exists, so these are GREEN.

Grounding fidelity is DISTINCT from ``model_validate()`` (shape-only). After a
shape-valid emit, three server-side checks run and a violation is an HONEST failure
(``ok=False / grounding_failed``), NEVER a draft (T-103-02-04, G-6):
  - every per-phase ``folder_scope`` UUID ⊆ the bound project subtree
    (``assert_folder_scopes_subset``);
  - every ``available_tools`` entry ∈ the real tool registry;
  - every ``skill_ref`` ∈ the owner/global enabled skill set.

CONVENTION (Phase 102 posture): imports INSIDE the test bodies; forced_emit + the
grounding accessors mocked at their boundaries.
"""

from __future__ import annotations

import pytest


def _definition_with_tool(tool_name: str) -> dict:
    """A shape-valid definition whose single llm_agent phase whitelists ``tool_name``."""
    return {
        "slug": "research-wf",
        "version": 1,
        "name": "Research Workflow",
        "status": "draft",
        "phases": [
            {
                "slug": "research",
                "phase_index": 0,
                "config": {
                    "phase_type": "llm_agent",
                    "prompt": "Research the topic.",
                    "available_tools": [tool_name],
                },
                "validators": [],
            }
        ],
    }


def _wd(d: dict):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(d)


def _patch_for_emit(monkeypatch, *, emitted_dict, tool_names, skill_ids):
    """Patch grounding assembly (to return the given registries), resolve_authoring_model,
    get_model_capability, and forced_emit (to return ``emitted_dict``)."""
    import app.config as cfg
    import app.services.forced_emit as fe
    import app.services.workflow_authoring as wa

    async def _fake_assemble(**_kwargs):
        return ("GROUNDED", set(tool_names), set(skill_ids))

    monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)
    monkeypatch.setattr(wa, "resolve_authoring_model", lambda settings: "claude-opus-4-8")
    monkeypatch.setattr(
        cfg, "get_model_capability", lambda model: {"forced_emission": True, "provider": "anthropic"}
    )

    async def _fake_forced_emit(**_kwargs):
        return {"emitted": _wd(emitted_dict), "failure": None}

    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)


@pytest.mark.asyncio
async def test_folder_scopes_subset_of_bound_subtree(monkeypatch):
    """A generated phase ``folder_scope`` UUID OUTSIDE the bound subtree -> grounding_failed
    (not a draft). ``assert_folder_scopes_subset`` is the server-side ⊆ check; we mock it
    to raise (the out-of-subtree case it raises ValueError on)."""
    import app.services.harness.scope as scope_mod
    import app.services.workflow_authoring as wa

    # A definition with a project binding + a phase folder_scope (shape-valid).
    bad = {
        "slug": "scoped-wf",
        "version": 1,
        "name": "Scoped Workflow",
        "status": "draft",
        "project_folder_id": "11111111-1111-1111-1111-111111111111",
        "phases": [
            {
                "slug": "research",
                "phase_index": 0,
                "config": {
                    "phase_type": "llm_agent",
                    "prompt": "Research.",
                    "available_tools": [],
                    "folder_scope": ["22222222-2222-2222-2222-222222222222"],
                },
                "validators": [],
            }
        ],
    }
    _patch_for_emit(monkeypatch, emitted_dict=bad, tool_names=set(), skill_ids=set())

    async def _raise_subset(definition, *, supabase, user_id):
        raise ValueError("phase 'research' folder_scope is not a subset of the project subtree")

    monkeypatch.setattr(scope_mod, "assert_folder_scopes_subset", _raise_subset)

    result = await wa.generate_workflow_definition(
        describe="scoped research",
        supabase=object(),
        user_id="u1",
        settings=object(),
        project_folder_id="11111111-1111-1111-1111-111111111111",
    )
    assert result["ok"] is False
    assert result["error"] == "grounding_failed"
    assert "definition" not in result  # the ungrounded draft is NEVER returned


@pytest.mark.asyncio
async def test_tools_and_skills_in_registry(monkeypatch):
    """A hallucinated ``available_tools`` entry -> grounding_failed; a clean definition
    (tool ∈ registry) -> ok=True. (folder_scope is empty so the ⊆ check is a no-op.)"""
    import app.services.workflow_authoring as wa

    # Case A: hallucinated tool (not in the registry set) -> grounding_failed.
    _patch_for_emit(
        monkeypatch,
        emitted_dict=_definition_with_tool("not_a_real_tool"),
        tool_names={"search_documents", "execute_code"},
        skill_ids=set(),
    )
    bad = await wa.generate_workflow_definition(
        describe="research", supabase=object(), user_id="u1", settings=object()
    )
    assert bad["ok"] is False
    assert bad["error"] == "grounding_failed"
    assert "definition" not in bad

    # Case B: a registered tool -> clean (ok=True).
    _patch_for_emit(
        monkeypatch,
        emitted_dict=_definition_with_tool("search_documents"),
        tool_names={"search_documents", "execute_code"},
        skill_ids=set(),
    )
    good = await wa.generate_workflow_definition(
        describe="research", supabase=object(), user_id="u1", settings=object()
    )
    assert good["ok"] is True
    assert good["definition"]["phases"][0]["config"]["available_tools"] == ["search_documents"]


# ══════════════════════════════════════════════════════════════════════════════════════
# PHASE 189 — CONFLICT 2 (D-20 / V21): A CAPABILITY IN available_tools BLOCKS STAGE 2.6
# ══════════════════════════════════════════════════════════════════════════════════════
#
# ``189-RESEARCH.md`` § "⚠ CONFLICTS WITH A LOCKED DECISION" measured that **D-06 ("a
# workflow containing the external-action node PUBLISHES and RUNS") is FALSE at HEAD a
# SECOND time**, independently of CONFLICT 1:
#
#   * D-03 says the chosen capability IS an entry in the phase's ``available_tools``, so
#     it rides the shipped per-phase tool whitelist rather than a parallel guard.
#   * Stage 2.6 rule 2 (``grounding._unregistered_tools``) requires every
#     ``available_tools`` entry to be a member of ``tool_names``, else it emits a
#     ``{"code": "unregistered_tool"}`` finding that BLOCKS the publish.
#   * ``tool_names`` is built inside ``assemble_grounding_bundle`` from
#     ``get_tools(None)`` — the **LLM-FACING SCHEMA LIST**, not ``_TOOL_REGISTRY``. The
#     asymmetry is recorded in ``openai_service.get_tools``' own comment: ``render_template``
#     is "registered in _TOOL_REGISTRY but NOT advertised here — harness-only".
#   * D-22 puts the three capabilities on exactly that harness-only side: a capability is a
#     STEP THE EXECUTOR PERFORMS, never a tool the LLM may call. So they have no
#     ``get_tools`` schema, and rule 2 refuses them.
#
# ⇒ ``send_email`` / ``create_ticket`` / ``post_message`` in ``available_tools`` block the
#   publish at stage 2.6 today.
#
# **THE SHAPE THE FIX MUST TAKE (D-20), stated here because the wrong fix is a security
# hole rather than a style choice.** A new closed ``EXTERNAL_ACTION_CAPABILITIES:
# frozenset[str]`` in ``grounding.py``, beside ``KB_TOOLS`` and in the same shape, unioned
# into ``tool_names`` **FOR THE FIDELITY CHECK ONLY** and deliberately kept OUT of
# ``GroundingBundle.tools``. Two shapes are FORBIDDEN:
#
#   * adding the names to ``get_tools()`` — ``GroundingBundle.tools`` is served on
#     ``GET /workflows/grounding-bundle`` and bound straight into ``PhaseFormPanel``'s
#     author-facing whitelist rail, so an author could then whitelist ``send_email`` on an
#     ordinary, UNARMED ``llm_agent`` step, bypassing the ``external_action`` type's
#     structural arming entirely (the wire-around D-04 and SC#2 forbid). The standing fence
#     for that leak is V22 in ``tests/test_182_grounding_bundle.py``.
#   * a rule-2 exemption keyed on ``phase_type`` — a type special-case inside a SHARED
#     governance rule, which is how a rule stops meaning one thing.
#
# ⚠ A SHIPPED TYPE IS USED ON PURPOSE. ``available_tools`` already exists on
# ``llm_agent``, so this falsification runs TODAY and does not wait for the 7th
# ``phase_type`` (plan 189-07).

# THE CLOSED SET, ONE COLLECTION — never three scattered string literals. D-15 fixed the
# membership at exactly three; ``test_the_capability_set_agrees_with_the_wave_0_suite``
# below fences it against its sibling Wave-0 file so the two cannot drift.
EXTERNAL_ACTION_CAPABILITIES: frozenset[str] = frozenset(
    {"send_email", "create_ticket", "post_message"}
)

# A well-formed caller id. ``grounding._skill_registry`` coerces ``user_id`` through
# ``coerce_uid`` (a real ``UUID()`` parse), so the file's older ``"u1"`` placeholder would
# send the skills read down its fail-closed path and fill the log with a traceback. Only
# ``tool_names`` is read from the bundle either way — this simply keeps the drive on the
# production shape and the output honest about what did and did not fail.
_UID = "00000000-0000-0000-0000-0000000000a1"


def _definition_with_tools(tools: list[str]) -> dict:
    """``_definition_with_tool``'s shape, taking the whole whitelist at once.

    The phase is an **``llm_agent``** — see ``_definition_with_external_actions`` for the
    ``external_action`` shape and CR-01 for why the difference is now load-bearing.
    """
    d = _definition_with_tool("__placeholder__")
    d["phases"][0]["config"]["available_tools"] = list(tools)
    return d


def _definition_with_external_actions(capabilities: list[str], *, extra_phases=()) -> dict:
    """One ``external_action`` phase PER capability, plus any extra phase dicts.

    ONE PHASE PER NAME IS FORCED BY THE MODEL, not a stylistic choice.
    ``ExternalActionPhaseConfig``'s D-03 validator totally replaces ``available_tools``
    with ``[capability]``, and ``capability`` is a single-valued ``Literal`` — so there is
    no representable ``external_action`` phase carrying two capabilities. Fanning the
    closed set across N phases keeps the assertion below on the **SET** (a per-name test
    would still pass if only ``send_email`` were admitted) while driving the shape that
    actually ships.
    """
    phases = [
        {
            "slug": f"act-{i}",
            "phase_index": i,
            "config": {
                "phase_type": "external_action",
                "capability": name,
                "available_tools": [name],
            },
            "validators": [],
        }
        for i, name in enumerate(capabilities)
    ]
    phases.extend(extra_phases)
    for i, p in enumerate(phases):
        p["phase_index"] = i
    return {
        "slug": "external-action-wf",
        "version": 1,
        "name": "External Action Workflow",
        "status": "draft",
        "phases": phases,
    }


def _definition_with_mcp_external_action(
    tool_name: str, *, available_tools: list[str] | None = None
) -> dict:
    """ONE ``external_action`` phase in the **MCP SHAPE** — ``tool_name``, no ``capability``.

    Phase 206 added ``tool_name`` / ``tool_args`` to ``ExternalActionPhaseConfig`` and made
    ``tool_name`` OUTRANK ``capability`` inside the very same D-03 validator
    ``_definition_with_external_actions`` above documents: an MCP step derives
    ``available_tools = [tool_name]``. **So the omission of ``available_tools`` here is the
    SHIPPED shape, not an oversight** — the model fills it in, and a client that sent
    anything else would have it totally replaced.

    ``available_tools`` is accepted only so a caller can ASK for the disagreeing shape on
    purpose; the model will still overwrite it, which is precisely why control B drives
    ``_unregistered_tools`` directly rather than through a real config (see its docstring).
    """
    config: dict = {
        "phase_type": "external_action",
        "tool_name": tool_name,
        "tool_args": {"repoName": "facebook/react"},
    }
    if available_tools is not None:
        config["available_tools"] = list(available_tools)
    return {
        "slug": "mcp-wf",
        "version": 1,
        "name": "MCP Workflow",
        "status": "draft",
        "phases": [
            {
                "slug": "act-mcp",
                "phase_index": 0,
                "config": config,
                "validators": [],
            }
        ],
    }



async def _production_tool_names() -> set[str]:
    """The ACTUAL ``tool_names`` set stage 2.6 tests membership against.

    Read off the production ``assemble_grounding_bundle`` rather than recomputed from
    ``get_tools(None)`` here. That is load-bearing in BOTH directions:

      * it is what stage 2.6 really uses (``publish_service._grounding_fidelity_failures``
        passes ``bundle.tool_names`` into ``grounding_verdicts``), so the RED below is the
        publish gate's own answer and not a re-derivation of it; and
      * D-20's fix widens ``tool_names`` INSIDE that assembler — so a test that re-typed
        ``{t["function"]["name"] for t in get_tools(None)}`` would stay RED after 189-04
        lands and would have to be edited to go green, which is the definition of a test
        that measures the patch instead of the property.

    The folder/skill reads resolve against a ``MagicMock`` (the offline posture
    ``tests/test_182_grounding_bundle.py`` already uses); only ``tool_names`` is read here,
    and it is computed outside both guarded reads.
    """
    from unittest.mock import MagicMock

    from app.services.harness.grounding import assemble_grounding_bundle

    bundle = await assemble_grounding_bundle(supabase=MagicMock(), user_id=_UID)
    assert bundle.tool_names, (
        "anti-vacuity: the production tool_names set is EMPTY, so every membership test "
        "below would report a violation for the wrong reason"
    )
    return bundle.tool_names


async def _unregistered_tool_findings(tools: list[str]) -> list[dict]:
    """Run the stage-2.6 rules over a phase whitelisting ``tools``; return rule-2 findings.

    ``grounding_verdicts`` is the ONE collector both ``POST /workflows/validate`` and
    publish stage 2.6 call. The definition is UNBOUND (no ``project_folder_id``), so rule
    1's ⊆ walk short-circuits to ``[]`` without any DB read, and ``skill_ids`` is
    irrelevant because no phase carries a ``skill_ref``.
    """
    return await _unregistered_tool_findings_for(_definition_with_tools(tools))


async def _unregistered_tool_findings_for(definition: dict) -> list[dict]:
    """``_unregistered_tool_findings`` over an ARBITRARY definition dict.

    Extracted at CR-01 so the same drive — same collector, same production
    ``tool_names``, same ``skill_ids`` — can be pointed at an ``external_action``
    definition as well as the ``llm_agent`` fixture. The two callers differing ONLY in
    ``phase_type`` is what makes the pair below a measurement of the type boundary rather
    than of two unrelated code paths.
    """
    from app.services.harness.grounding import grounding_verdicts

    verdicts = await grounding_verdicts(
        _wd(definition),
        supabase=object(),
        user_id=_UID,
        tool_names=await _production_tool_names(),
        skill_ids=set(),
    )
    return [v for v in verdicts if v.get("code") == "unregistered_tool"]


def test_the_capability_set_agrees_with_the_wave_0_suite():
    """D-15 / D-20 — the three names have ONE meaning across the phase's Wave-0 files.

    ``tests/unit/test_189_external_action_model.py`` already pins the closed set as
    ``EXPECTED_CAPABILITIES``. Asserting agreement here (rather than trusting two hand-typed
    tuples) means a fourth name, a rename or a typo fails LOUDLY in whichever file is edited
    second — the anti-drift argument ``KB_TOOLS``' own header block makes for the registry
    it defines ("a second copy is a safety hole, not a duplication smell").
    """
    from tests.unit.test_189_external_action_model import EXPECTED_CAPABILITIES

    assert EXTERNAL_ACTION_CAPABILITIES == frozenset(EXPECTED_CAPABILITIES), (
        f"the D-15 capability set drifted between Wave-0 files: this file has "
        f"{sorted(EXTERNAL_ACTION_CAPABILITIES)}, test_189_external_action_model.py has "
        f"{sorted(EXPECTED_CAPABILITIES)}"
    )
    assert len(EXTERNAL_ACTION_CAPABILITIES) == 3  # D-15: exactly three, never a fourth


@pytest.mark.asyncio
async def test_an_external_capability_in_available_tools_produces_no_unregistered_tool_finding():
    """V21 / D-20 / D-06 — **THE CONFLICT-2 FALSIFICATION. RED AT HEAD.**

    A phase whose ``available_tools`` names an external-action capability must NOT earn a
    stage-2.6 ``unregistered_tool`` finding. While it does, a workflow built on D-03 cannot
    publish, and D-06 is false.

    ASSERTED ON THE **SET**, not one name at a time. A per-name test would still pass if
    only ``send_email`` were registered and the other two were not, which is exactly the
    partial-fix shape ``EXTERNAL_ACTION_CAPABILITIES`` being a closed frozenset exists to
    prevent. All three are whitelisted on ONE phase, and the offending set is compared to
    the empty set.

    Fix owner: plan **189-04**, by unioning ``EXTERNAL_ACTION_CAPABILITIES`` into
    ``tool_names`` inside ``assemble_grounding_bundle`` — see this section's header for the
    two shapes that are forbidden, and
    ``test_a_genuinely_unknown_tool_still_produces_the_finding`` for the fence around the
    cheapest wrong one.

    ⚠ **RE-POINTED AT REVIEW FINDING CR-01.** This case used to drive
    ``_definition_with_tools`` — an **``llm_agent``** phase — and assert zero findings, and
    that green was the review's PROOF of the wire-around: the design's own test certified
    that an ordinary, unarmed agent step could whitelist ``send_email`` and publish. What
    D-06 actually needs is that an ``external_action`` WORKFLOW publishes, so the drive now
    uses the type that owns the capability, one phase per name. The assertion is UNCHANGED
    and still on the SET; only the shape under test was corrected to the one that ships.
    Its new partner is ``test_a_capability_on_an_llm_agent_step_still_blocks_publish``,
    which pins what the old drive was accidentally certifying as safe.
    """
    findings = await _unregistered_tool_findings_for(
        _definition_with_external_actions(sorted(EXTERNAL_ACTION_CAPABILITIES))
    )
    offenders = {
        t for t in EXTERNAL_ACTION_CAPABILITIES
        if any(repr(t) in f.get("message", "") for f in findings)
    }

    assert offenders == set(), (
        f"D-20 / CONFLICT 2: stage 2.6 rule 2 refuses {sorted(offenders)} — the "
        f"external-action capabilities D-03 puts in available_tools, on the "
        f"external_action phases that DERIVE them. Findings emitted: {findings!r}. "
        f"tool_names is built from get_tools(None) (the LLM-facing SCHEMA list) and D-22 "
        f"keeps these three OFF it, so a workflow containing the node BLOCKS at stage 2.6 "
        f"and D-06 is FALSE. Fix: admit EXTERNAL_ACTION_CAPABILITIES for the fidelity "
        f"check ONLY, and only on the type that derives them — never into "
        f"GroundingBundle.tools (the D-20 leak, fenced by V22)."
    )


@pytest.mark.asyncio
async def test_a_capability_on_an_llm_agent_step_still_blocks_publish():
    """CR-01 / SC#2 — **the capability is admissible on ``external_action`` and NOWHERE else.**

    THE MISSING NEGATIVE CONTROL. Its sibling above proves the capability PASSES on the
    type that derives it; nothing proved it still BLOCKS anywhere else, and until this
    case existed it did not: the D-20 widening was unconditional, so a definition reaching
    ``POST /workflows`` / the draft PATCH / the NL generator as

        {"phase_type": "llm_agent", "prompt": "…", "available_tools": ["send_email"]}

    parsed, passed stage 2.6 and published — on a step with ``action_risk_armed: false``
    and no D-04 checkpoint. The author-facing rail (V22 in
    ``tests/test_182_grounding_bundle.py``) fences what the CLIENT is OFFERED; it fences
    nothing about what the SERVER ACCEPTS, and none of those three write paths is the rail.

    Driven on the SET, and per-name in the message assertion, so a partial fix that scoped
    only ``send_email`` cannot pass. Same collector and same ``tool_names`` source as its
    sibling — the ONLY difference between the two drives is ``phase_type``, which is what
    makes the pair a measurement of the boundary itself.
    """
    capabilities = sorted(EXTERNAL_ACTION_CAPABILITIES)
    findings = await _unregistered_tool_findings(capabilities)

    blocked = {
        t for t in capabilities
        if any(repr(t) in f.get("message", "") for f in findings)
    }
    assert blocked == set(capabilities), (
        f"CR-01 / SC#2: an ORDINARY, UNARMED llm_agent step may whitelist "
        f"{sorted(set(capabilities) - blocked)} and publish clean. That is the wire-around "
        f"SC#2 forbids — it makes action_risk_armed decorative and skips the D-04 "
        f"checkpoint entirely. Latent only while D-22 keeps the names out of "
        f"_TOOL_REGISTRY; live egress on an unarmed step the day Phase 190 registers a "
        f"handler. Findings emitted: {findings!r}"
    )
    assert all(f["code"] == "unregistered_tool" for f in findings), findings
    assert all(f["phase"] == "research" for f in findings), findings


@pytest.mark.asyncio
async def test_a_genuinely_unknown_tool_still_produces_the_finding():
    """V21's NEGATIVE CONTROL — **passes today and must STILL pass after 189-04.**

    Rule 2 is a shipped governance rule: a hallucinated tool name must keep blocking the
    publish. Without this fence, 189-04 could turn its sibling green by disabling rule 2
    altogether — retiring a working guard instead of widening it by three reviewed names.

    Also proves the sibling's ``offenders == set()`` is a MEASUREMENT rather than an
    artefact of a collector that emits nothing: this drive shares the same helper, the same
    ``tool_names`` source and the same definition shape, and it must produce exactly one
    finding.
    """
    findings = await _unregistered_tool_findings(["definitely_not_a_tool"])

    assert len(findings) == 1, (
        f"control: rule 2 stopped flagging a hallucinated tool ({findings!r}). A fix that "
        f"widens tool_names is correct; a fix that disables rule 2 is not."
    )
    assert findings[0]["code"] == "unregistered_tool"
    assert findings[0]["phase"] == "research"          # per-node keyed on the slug
    assert "definitely_not_a_tool" in findings[0]["message"]


@pytest.mark.asyncio
async def test_a_shipped_tool_is_still_accepted_alongside_a_capability():
    """V21's SECOND CONTROL — the widening must not turn rule 2 into a pass-through.

    A phase whitelisting a REAL registered tool has always been clean, and must stay clean.
    Driven in the same call as the three capabilities so the mixed definition — the shape a
    real ``external_action`` workflow beside an ``llm_agent`` step produces — is the thing
    measured, rather than two separately-clean halves.

    ⚠ **CORRECTED AT CR-01, because the sentence above used to be false.** The drive was a
    single ``llm_agent`` phase whitelisting ``search_documents`` AND all three
    capabilities, which is not "an external_action workflow beside an llm_agent step" —
    it is the wire-around itself, described as the legitimate shape. The definition now
    genuinely is one ``llm_agent`` carrying the registered tool plus one
    ``external_action`` per capability, and the whole thing must come back CLEAN.
    """
    definition = _definition_with_external_actions(
        sorted(EXTERNAL_ACTION_CAPABILITIES),
        extra_phases=[
            {
                "slug": "research",
                "phase_index": 99,
                "config": {
                    "phase_type": "llm_agent",
                    "prompt": "Research the topic.",
                    "available_tools": ["search_documents"],
                },
                "validators": [],
            }
        ],
    )
    findings = await _unregistered_tool_findings_for(definition)

    assert not any("search_documents" in f.get("message", "") for f in findings), (
        f"a REGISTERED tool was reported unregistered: {findings!r}"
    )
    # The legitimate mixed workflow is clean END TO END — the capabilities on their own
    # type and the shipped tool on the agent step. Anything else here would mean the CR-01
    # narrowing leaked into a shape D-06 has to publish.
    assert findings == [], (
        f"the legitimate mixed workflow (llm_agent + one external_action per capability) "
        f"no longer publishes clean: {findings!r}"
    )


@pytest.mark.asyncio
async def test_the_fidelity_membership_set_contains_the_capabilities():
    """D-20 — the union is PROVED APPLIED, not inferred from the absence of a finding.

    Plan 189-04 added this. The three tests above establish that rule 2 no longer reports
    the capabilities; NONE of them establishes WHY. An absence of findings is also what a
    quietly-broken collector, a short-circuited rule or a helper that stopped reaching the
    gate would produce, and each of those would be "green" while D-20's boundary was never
    built. So the membership half is asserted DIRECTLY, on the same production set stage
    2.6 consumes.

    This is the positive half of a matched pair, and its partner is V22 in
    ``tests/test_182_grounding_bundle.py``: the three names are IN ``bundle.tool_names``
    (here) and OUT of ``bundle.tools`` (there). Together they pin the boundary from both
    sides — either assertion alone is satisfiable by a fix that is wrong in the other
    direction. Asserted on the SET so a partial union cannot pass.
    """
    tool_names = await _production_tool_names()

    missing = EXTERNAL_ACTION_CAPABILITIES - tool_names
    assert missing == frozenset(), (
        f"D-20: {sorted(missing)} is absent from the production fidelity membership set, so "
        f"stage 2.6 rule 2 is passing for some OTHER reason than the union — "
        f"EXTERNAL_ACTION_CAPABILITIES must be unioned into tool_names inside "
        f"assemble_grounding_bundle"
    )
    # And the set is still the SUPERSET it is supposed to be, not a replacement: a widening
    # that dropped the real registry would satisfy the assertion above while breaking every
    # shipped whitelist.
    assert "search_documents" in tool_names, (
        f"the widened set no longer contains a known shipped tool — tool_names was "
        f"REPLACED rather than widened. Got {sorted(tool_names)!r}"
    )


# ══════════════════════════════════════════════════════════════════════════════════════
# ⚠ ADDED, NEVER RE-BASELINED — every case above this banner is untouched by 206.2
# ══════════════════════════════════════════════════════════════════════════════════════
#
# PHASE 206.2 · D-206.2-19 — THE MCP SHAPE CANNOT PUBLISH, AND THIS IS THE BOUNDARY
#
# Phase 206 shipped the MCP engine and, in the SAME commit, made ``tool_name`` outrank
# ``capability`` inside ``ExternalActionPhaseConfig._available_tools_is_the_capability``.
# That is correct — ``tool_name`` IS an MCP step's one whitelist. What it also did, and what
# nothing caught, is falsify the paragraph in ``_unregistered_tools``' own docstring saying
# the CR-01 narrowing "COSTS ``external_action`` NOTHING" and that D-06 ("a workflow
# containing the external-action node PUBLISHES") "stays true by construction".
#
# Measured at this plan's base, against the REAL functions:
#
#     RULE 2 offenders (MCP step):    ['ask_question']
#     RULE 2 offenders (native step): []
#
# ``unregistered_tool`` is in neither of ``api/workflows.py``'s soft severity buckets
# (``_ERROR_CODES = _KNOWN_CODES - _INCOMPLETE_CODES - _DUAL_SOURCE_CODES``), so it resolves
# to **``error``**, and ``publish_service.py`` stage 2.6 ``grounding_fidelity`` blocks BEFORE
# the golden run. Nothing in production could reach the shape, so the whole gate was green
# while the feature was unpublishable.
#
# ⚠ THE FIX IS A WIDENING BY EXACTLY ONE NAME, AND THESE CASES ARE WHAT PROVE IT IS NOT A
# LOOSENING. The admissible set for an ``external_action`` phase gains THAT PHASE'S OWN
# ``tool_name`` — the same value ``available_tools`` is already DERIVED from — so the two are
# equal by construction and nothing new becomes representable. Three cases hold the boundary:
#
#   * the POSITIVE: an MCP-shaped step earns zero rule-2 findings;
#   * CONTROL A-prime: an ``llm_agent`` step naming the SAME MCP tool is STILL flagged (the
#     widening is scoped by the ``phase_type`` test, never by the name) — the MCP mirror of
#     the shipped ``test_a_capability_on_an_llm_agent_step_still_blocks_publish``, which is
#     CONTROL A and passes here UNEDITED;
#   * CONTROL B: an ``external_action`` phase whose ``available_tools`` DISAGREES with its
#     own ``tool_name`` is STILL flagged (the widening admits the SOURCE, not the DERIVED
#     list, so the check cannot become tautological).
#
# ⚠ PUBLISHING GRANTS NOTHING. An MCP tool is closed at run time by the PER-TOOL GRANT —
# ``phase_types.py`` GATE 6, ``grants.get(tool_name) is True``, where a MISSING KEY DENIES and
# a refusal writes a ``tool_refused`` audit row. Admitting a name to a fidelity check is not
# an authorization decision (D-206.2-05).


@pytest.mark.asyncio
async def test_an_mcp_shaped_external_action_step_publishes_clean():
    """D-206.2-19 — **the MCP publish blocker. RED at this plan's base.**

    A single ``external_action`` phase in the MCP shape — ``tool_name`` set, ``capability``
    genuinely absent — must earn **zero** ``unregistered_tool`` findings. While it earns one,
    publish stage 2.6 (``publish_service._grounding_fidelity_failures`` →
    ``_block(stage="grounding_fidelity")``) refuses the workflow BEFORE the golden run, and
    the MCP authoring door Phase 206.2 builds leads somewhere a publish cannot follow.

    Driven through ``_unregistered_tool_findings_for`` — the SAME collector
    (``grounding_verdicts``) and the SAME production ``tool_names`` set the publish gate uses,
    for the reason ``_production_tool_names``' docstring gives: a re-derived set would measure
    the patch instead of the property.

    ⚠ **The fix this case owns is a WIDENING BY ONE NAME, never a disabling of rule 2.**
    ``test_a_genuinely_unknown_tool_still_produces_the_finding`` above is the fence around the
    cheapest wrong fix, and controls A / A-prime / B are the fences around the next two.
    """
    findings = await _unregistered_tool_findings_for(
        _definition_with_mcp_external_action("ask_question")
    )

    assert findings == [], (
        f"D-206.2-19: stage 2.6 rule 2 refuses an MCP-shaped external_action step. "
        f"Findings emitted: {findings!r}. `available_tools` is DERIVED as [tool_name] by "
        f"ExternalActionPhaseConfig._available_tools_is_the_capability, and "
        f"_unregistered_tools admits only EXTERNAL_ACTION_CAPABILITIES on this type — so "
        f"the tool name is a rule-2 offender, api/workflows.py resolves it to severity "
        f"'error' (it is in neither soft bucket), and publish_service.py blocks at stage "
        f"2.6 grounding_fidelity before the golden run. FIX: inside the existing "
        f"`phase_type == 'external_action'` arm, admit the phase's OWN tool_name — one "
        f"name, the same one available_tools is derived from. NEVER disable rule 2, and "
        f"NEVER widen assemble_grounding_bundle's fidelity_tool_names (that would re-create "
        f"CR-01's wire-around one level up, for every phase type)."
    )


@pytest.mark.asyncio
async def test_an_mcp_tool_name_on_an_llm_agent_step_still_blocks_publish():
    """**CONTROL A-prime** — the MCP mirror of CR-01. The widening is scoped by TYPE, not NAME.

    Its partner is the SHIPPED ``test_a_capability_on_an_llm_agent_step_still_blocks_publish``
    (control A), which this plan may not edit and which proves the *capability* half of the
    same boundary. This case proves the *MCP tool* half, and it is the one that would go red
    if the widening were written as "admit ``tool_name`` wherever a phase happens to carry
    one" rather than inside the existing ``phase_type == "external_action"`` arm.

    Why it matters, in CR-01's own terms: an ``llm_agent`` step has ``action_risk_armed:
    false`` and no D-04 checkpoint. A definition reaching the server through ``POST
    /workflows`` / the draft ``PATCH`` / the NL generator — none of which is the
    author-facing rail — carrying ``{"phase_type": "llm_agent", "available_tools":
    ["ask_question"]}`` must NOT publish clean. The author-facing rail fences what the CLIENT
    is OFFERED; it fences nothing about what the SERVER ACCEPTS.

    Same collector, same ``tool_names`` source and same fixture family as the positive above
    — the ONLY difference is ``phase_type``, which is what makes the pair a measurement of
    the boundary itself rather than of two unrelated code paths.
    """
    findings = await _unregistered_tool_findings(["ask_question"])

    assert len(findings) == 1, (
        f"CONTROL A-prime / SC#2: an ORDINARY, UNARMED llm_agent step may whitelist the MCP "
        f"tool 'ask_question' and publish clean. That is CR-01's wire-around in the MCP "
        f"shape — it makes action_risk_armed decorative and skips the D-04 checkpoint "
        f"entirely. The 206.2 widening must live INSIDE the existing phase_type == "
        f"'external_action' arm. Findings emitted: {findings!r}"
    )
    assert findings[0]["code"] == "unregistered_tool", findings
    assert findings[0]["phase"] == "research", findings          # per-node, keyed on the slug
    assert repr("ask_question") in findings[0]["message"], findings


@pytest.mark.asyncio
async def test_an_external_action_whose_available_tools_disagrees_with_its_tool_name_is_flagged():
    """**CONTROL B** — the widening admits the SOURCE (``tool_name``), never the DERIVED list.

    ⚠ **THIS CASE DRIVES ``_unregistered_tools`` DIRECTLY, WITH A ``SimpleNamespace`` STUB,
    AND THAT IS DELIBERATE ENGINEERING RATHER THAN A SHORTCUT.** The disagreeing state is NOT
    REPRESENTABLE through ``ExternalActionPhaseConfig``: its ``@model_validator(mode="after")``
    TOTALLY REPLACES ``available_tools`` with ``[tool_name]``, so a definition built through
    the model can never carry the shape this case must measure. ``_unregistered_tools`` reads
    ``phase.config`` exclusively through ``getattr`` and is contractually duck-typed — both
    presentations share it — so a stub is a legitimate caller. **This is the only test that
    would still catch a publish-bypass if the model validator's invariant were ever
    weakened**, which is exactly why it is worth having despite not going through the model.

    Both halves live in ONE case on purpose, so the pair measures the boundary rather than
    being two unrelated drives: the DISAGREEING list is still flagged (and the flagged name
    is the disagreeing one, never the ``tool_name``), while the AGREEING list is clean. A
    widening written as ``allowed |= set(available_tools)`` would make the check tautological
    and would turn the first half green for the wrong reason.
    """
    # Imports inside the body — this file's stated Phase-102 posture.
    from types import SimpleNamespace

    from app.services.harness.grounding import _unregistered_tools

    tool_names = await _production_tool_names()

    disagreeing = SimpleNamespace(
        config=SimpleNamespace(
            phase_type="external_action",
            tool_name="ask_question",
            available_tools=["read_wiki_contents"],
        )
    )
    assert _unregistered_tools(disagreeing, tool_names) == ["read_wiki_contents"], (
        "CONTROL B: an external_action phase whose available_tools DISAGREES with its own "
        "tool_name is no longer flagged. The 206.2 widening must add the phase's own "
        "tool_name to `allowed` — the SOURCE the model derives from — and must NOT add "
        "`available_tools` itself, which would make rule 2 tautological on this type. Got "
        f"{_unregistered_tools(disagreeing, tool_names)!r}"
    )

    agreeing = SimpleNamespace(
        config=SimpleNamespace(
            phase_type="external_action",
            tool_name="ask_question",
            available_tools=["ask_question"],
        )
    )
    assert _unregistered_tools(agreeing, tool_names) == [], (
        "D-206.2-19: the AGREEING shape — the only one ExternalActionPhaseConfig can "
        "actually produce for an MCP step — is still flagged, so publish stage 2.6 still "
        f"blocks. Got {_unregistered_tools(agreeing, tool_names)!r}"
    )
