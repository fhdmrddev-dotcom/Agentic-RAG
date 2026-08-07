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
    """``_definition_with_tool``'s shape, taking the whole whitelist at once."""
    d = _definition_with_tool("__placeholder__")
    d["phases"][0]["config"]["available_tools"] = list(tools)
    return d


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
    from app.services.harness.grounding import grounding_verdicts

    verdicts = await grounding_verdicts(
        _wd(_definition_with_tools(tools)),
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
    """
    findings = await _unregistered_tool_findings(sorted(EXTERNAL_ACTION_CAPABILITIES))
    offenders = {
        t for t in EXTERNAL_ACTION_CAPABILITIES
        if any(repr(t) in f.get("message", "") for f in findings)
    }

    assert offenders == set(), (
        f"D-20 / CONFLICT 2: stage 2.6 rule 2 refuses {sorted(offenders)} — the "
        f"external-action capabilities D-03 puts in available_tools. Findings emitted: "
        f"{findings!r}. tool_names is built from get_tools(None) (the LLM-facing SCHEMA "
        f"list) and D-22 keeps these three OFF it, so a workflow containing the node "
        f"BLOCKS at stage 2.6 and D-06 is FALSE. Fix: union EXTERNAL_ACTION_CAPABILITIES "
        f"into tool_names for the fidelity check ONLY — never into GroundingBundle.tools "
        f"(the D-20 leak, fenced by V22), never as a phase_type exemption inside rule 2."
    )


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
    Driven in the same call as the three capabilities so the mixed list — the shape a real
    ``external_action`` workflow beside an ``llm_agent`` step produces — is the thing
    measured, rather than two separately-clean halves.
    """
    findings = await _unregistered_tool_findings(
        ["search_documents", *sorted(EXTERNAL_ACTION_CAPABILITIES)]
    )
    assert not any("search_documents" in f.get("message", "") for f in findings), (
        f"a REGISTERED tool was reported unregistered: {findings!r}"
    )
