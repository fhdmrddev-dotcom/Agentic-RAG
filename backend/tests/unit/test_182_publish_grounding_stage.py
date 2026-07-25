"""Phase 182 gap closure (VALID-01, plan 182-06) — publish ENFORCES grounding fidelity.

THE GAP THIS CLOSES (`182-VERIFICATION.md`, Truth 5 / WR-01). The seam header comment in
`api/workflows.py` claims "Every rule it previews is the SAME copy the publish gauntlet
enforces". That was TRUE for structural lint, `business_requirement` and `interactive_phase`
and FALSE for grounding fidelity: `publish_workflow` never called `grounding_verdicts`, so a
definition naming a hallucinated tool or an inaccessible `skill_ref` painted RED in
`POST /workflows/validate` and published GREEN. Exploitable TODAY through the existing
non-canvas authoring API, independent of any future canvas.

The fix is stage 2.6 in `publish_workflow`, delegating to the SAME shared collector
`/validate` calls — so there is still exactly ONE copy of every grounding rule
(D-182-02 reuse-verbatim / D-182-06 red line).

WHAT IS AND IS NOT MOCKED HERE. `grounding.assemble_grounding_bundle` (the registry READ)
is faked so the whole matrix runs offline, and `_resolve_publish_supabase` is patched so no
real service-role client is ever constructed. `grounding_verdicts` — the RULE — is NEVER
patched: the real collector executes in every blocking test, or the test would only prove a
mock fired.

CONVENTION (Phase 102 posture): imports INSIDE the test bodies / helpers. The publish
orchestration is driven through the real `publish_service.publish` entry point, mirroring
`test_publish_service.py`'s patch-stack style.
"""

from __future__ import annotations

from contextlib import ExitStack, contextmanager
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest

_USER = {"id": str(uuid4())}
_DEF_ID = uuid4()

# A stand-in for the org-scoped service-role client — never a real client, never a network.
_SUPABASE_SENTINEL = object()
# The definition's own org. `_resolve_publish_supabase` returns `(client, org_id)` since
# plan 182-12 (WR-05): the org it reads to scope the BYPASSRLS client ALSO scopes the
# grounding gate, so the two can never disagree about which tenant a publish acts for. The
# cross-org proof that this second half is load-bearing lives in `test_182_publish_org_scope.py`.
_DEF_ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

_REGISTERED_TOOL = "search_documents"
_OWNED_SKILL = "33333333-3333-3333-3333-333333333333"
_FOREIGN_SKILL = "44444444-4444-4444-4444-444444444444"
_BR = "Deliver a cited answer to the requester."


# ── definition builders (lint-clean, business_requirement present, NON-interactive) ──
#
# The new stage must be the ONLY thing that can block these definitions — otherwise a
# green assertion would prove nothing about stage 2.6.


def _definition(phases: list[dict], **extra) -> dict:
    base = {
        "slug": "grounding-gate",
        "version": 1,
        "name": "Grounding Gate Workflow",
        "status": "draft",
        "business_requirement": _BR,
        "phases": phases,
    }
    base.update(extra)
    return base


def _row(definition: dict) -> dict:
    """A `get_definition` row whose `definition` JSONB model_validates (mirrors
    `test_publish_service.py::_definition_row`)."""
    return {
        "id": _DEF_ID,
        "slug": definition["slug"],
        "version": definition["version"],
        "name": definition["name"],
        "status": definition["status"],
        "definition": definition,
        "created_by": UUID(_USER["id"]),
    }


def _agent_phase(*, slug: str = "research", index: int = 0, tools: list[str]) -> dict:
    return {
        "slug": slug,
        "phase_index": index,
        "config": {
            "phase_type": "llm_agent",
            "prompt": "Research the topic.",
            "available_tools": tools,
        },
        "validators": [],
    }


def _single_phase(*, slug: str = "answer", index: int = 0, **config_extra) -> dict:
    cfg = {"phase_type": "llm_single", "prompt": "Answer the question."}
    cfg.update(config_extra)
    return {"slug": slug, "phase_index": index, "config": cfg, "validators": []}


def _bundle(*, tool_names=(), skill_ids=()):
    """The fake registry palette the REAL rules are tested against."""
    from app.services.harness.grounding import GroundingBundle

    return GroundingBundle(
        tools=sorted(tool_names),
        tool_names=set(tool_names),
        folders=[],
        skills=[],
        skill_ids=set(skill_ids),
        placeholders=[],
    )


@contextmanager
def _publish_env(row, *, tool_names=(), skill_ids=(), resolve_raises=None):
    """The patch stack: every DB + boundary seam, plus the two grounding seams.

    Patched: `get_definition` / `write_audit` / `publish_definition`,
    `publish_service._drive_golden_run` / `_judge_golden_output`,
    `publish_service._resolve_publish_supabase` (so no real service-role client is built —
    `pool` is an AsyncMock, so `await pool.fetchval(...)` would otherwise hand a truthy mock
    to `get_service_role_supabase`), and `grounding.assemble_grounding_bundle` (the registry
    READ). `grounding_verdicts` — the RULE — is deliberately NOT patched.

    The resolver fake returns the `(client, org_id)` TUPLE that helper has returned since plan
    182-12 (WR-05). Patching it here means this file exercises the grounding RULES against a
    fixed org, never the org SCOPE — which is exactly why it could not have caught WR-05, and
    why `test_182_publish_org_scope.py` deliberately leaves this seam unpatched.
    """
    from unittest.mock import AsyncMock, patch

    from app.services.harness import grounding as g
    from app.services.harness import publish_service

    golden_run_id = uuid4()
    drive = AsyncMock(
        return_value=(golden_run_id, {"text": "a grounded answer [doc1]"}, "completed")
    )
    judge = AsyncMock(
        return_value={
            "overall_passed": True,
            "overall_score": 95,
            "summary": "good",
            "criteria": [],
        }
    )
    flip = AsyncMock(return_value=2)
    resolve = (
        AsyncMock(side_effect=resolve_raises)
        if resolve_raises is not None
        else AsyncMock(return_value=(_SUPABASE_SENTINEL, _DEF_ORG_ID))
    )
    assemble = AsyncMock(return_value=_bundle(tool_names=tool_names, skill_ids=skill_ids))

    with ExitStack() as stack:
        stack.enter_context(
            patch("app.db.workflows.get_definition", AsyncMock(return_value=row))
        )
        stack.enter_context(patch("app.db.workflows.write_audit", AsyncMock()))
        stack.enter_context(patch("app.db.workflows.publish_definition", flip))
        stack.enter_context(patch.object(publish_service, "_drive_golden_run", drive))
        stack.enter_context(patch.object(publish_service, "_judge_golden_output", judge))
        stack.enter_context(patch.object(publish_service, "_resolve_publish_supabase", resolve))
        stack.enter_context(patch.object(g, "assemble_grounding_bundle", assemble))
        yield SimpleNamespace(
            drive=drive,
            judge=judge,
            flip=flip,
            resolve=resolve,
            assemble=assemble,
            golden_run_id=golden_run_id,
        )


async def _publish():
    """Invoke the real publish orchestration (pool/redis are AsyncMocks — see the env)."""
    from unittest.mock import AsyncMock

    from app.services.harness import publish_service

    return await publish_service.publish(
        definition_id=_DEF_ID,
        golden_input="a representative kickoff prompt",
        user=_USER,
        pool=AsyncMock(),
        redis=AsyncMock(),
    )


def _by_code(named_failures: list, code: str) -> dict:
    matches = [f for f in named_failures if isinstance(f, dict) and f.get("code") == code]
    assert matches, f"expected a {code!r} named failure, got {named_failures!r}"
    return matches[0]


# The three codes `grounding.grounding_verdicts` can emit — the anti-drift comparison set.
_GROUNDING_CODES = frozenset({"folder_scope", "unregistered_tool", "unregistered_skill"})


def _grounding_pairs(findings) -> set:
    """The `(code, phase)` pairs of the grounding-fidelity findings in a verdict list.

    Accepts BOTH shapes deliberately: the `/validate` route's `Verdict` objects and the
    publish stage's `named_failures` dicts. The comparison is on the structural fields the
    canvas keys on — never on prose.
    """
    out = set()
    for f in findings:
        code = f["code"] if isinstance(f, dict) else f.code
        phase = (f.get("phase") if isinstance(f, dict) else f.phase)
        if code in _GROUNDING_CODES:
            out.add((code, phase))
    return out


# ── (a) a hallucinated tool can no longer publish ─────────────────────────────


@pytest.mark.asyncio
async def test_hallucinated_tool_blocks_publish_at_grounding_fidelity():
    """A phase declaring `available_tools: ["not_a_real_tool"]` is BLOCKED at
    `grounding_fidelity` — the golden run is never driven, nothing is flipped.

    This is the exact definition that published GREEN before this plan while
    `POST /workflows/validate` painted it RED (182-VERIFICATION Truth 5)."""
    definition = _definition([_agent_phase(slug="research", tools=["not_a_real_tool"])])

    with _publish_env(_row(definition), tool_names={_REGISTERED_TOOL}) as env:
        result = await _publish()

    assert result["published"] is False
    assert result["blocked_stage"] == "grounding_fidelity"
    assert result["golden_run_id"] is None
    failure = _by_code(result["named_failures"], "unregistered_tool")
    # Per-node keyed like every other grounding verdict (SC#4):
    assert failure["phase"] == "research"
    assert "not_a_real_tool" in failure["message"]
    # The D-08 shape the lint stage already renders — no new response vocabulary (D-182-03):
    assert set(failure) == {"code", "phase", "message"}
    env.drive.assert_not_called()  # a hallucinated tool never burns a real provider run
    env.flip.assert_not_called()


# ── (b) an inaccessible skill_ref can no longer publish ───────────────────────


@pytest.mark.asyncio
async def test_inaccessible_skill_ref_blocks_publish_at_grounding_fidelity():
    """A phase whose `skill_ref` is outside the caller's enabled/visible skill set is
    BLOCKED the same way, with `code == "unregistered_skill"`."""
    definition = _definition([_single_phase(slug="answer", skill_ref=_FOREIGN_SKILL)])

    with _publish_env(
        _row(definition), tool_names={_REGISTERED_TOOL}, skill_ids={_OWNED_SKILL}
    ) as env:
        result = await _publish()

    assert result["published"] is False
    assert result["blocked_stage"] == "grounding_fidelity"
    failure = _by_code(result["named_failures"], "unregistered_skill")
    assert failure["phase"] == "answer"
    assert _FOREIGN_SKILL in failure["message"]
    env.drive.assert_not_called()
    env.flip.assert_not_called()


# ── (c) the stage is a targeted gate, NOT a blanket block ─────────────────────


@pytest.mark.asyncio
async def test_grounded_clean_definition_proceeds_to_the_golden_run():
    """A grounded-clean definition PASSES stage 2.6 and reaches the golden run exactly as
    before this plan — the new stage is a targeted gate, not a wall (the control for (a)/(b);
    without it, a green (a)/(b) could just mean "the stage blocks everything")."""
    definition = _definition(
        [
            _agent_phase(slug="research", tools=[_REGISTERED_TOOL]),
            _single_phase(slug="answer", index=1, skill_ref=_OWNED_SKILL),
        ]
    )

    with _publish_env(
        _row(definition), tool_names={_REGISTERED_TOOL}, skill_ids={_OWNED_SKILL}
    ) as env:
        result = await _publish()

    assert result["published"] is True
    assert result.get("blocked_stage") is None
    env.drive.assert_awaited_once()  # the golden run WAS driven — stage 2.6 let it through
    env.flip.assert_called_once()


# ── (d) fail CLOSED — an unverifiable grounding registry blocks, never 500s ───


@pytest.mark.asyncio
async def test_registry_resolution_failure_blocks_fail_closed():
    """If the grounding registry cannot be RESOLVED (org lookup or client construction
    raising), publish BLOCKS with a `grounding_unavailable` named failure and never raises.

    A publish that cannot verify grounding must not mint a version — returning `[]` here
    would silently publish an unverified definition, which is the exact defect stage 2.6
    exists to close; raising would break `publish_workflow`'s sealed-orchestration
    contract (it never raises into the route)."""
    definition = _definition([_agent_phase(slug="research", tools=[_REGISTERED_TOOL])])

    with _publish_env(
        _row(definition),
        tool_names={_REGISTERED_TOOL},
        resolve_raises=ValueError("get_service_role_supabase requires an explicit org_id"),
    ) as env:
        result = await _publish()  # must NOT raise

    assert result["published"] is False
    assert result["blocked_stage"] == "grounding_fidelity"
    failure = _by_code(result["named_failures"], "grounding_unavailable")
    assert failure["phase"] is None  # a resolution failure is not attributable to a node
    env.drive.assert_not_called()  # no run on a definition we could not verify
    env.flip.assert_not_called()  # and certainly no version minted


# ── (e) nothing was reordered — the pre-existing gates still block first ──────


@pytest.mark.asyncio
async def test_lint_still_blocks_first_when_a_definition_fails_both():
    """A definition failing BOTH the structural lint AND grounding fidelity still blocks at
    `lint` — proving stage 2.6 was APPENDED after the existing gates and did not change
    which stage any currently-blocking definition blocks at."""
    definition = _definition(
        [_agent_phase(slug="research", index=5, tools=["not_a_real_tool"])]
    )  # index 5 with one phase -> non-contiguous -> bad_index

    with _publish_env(_row(definition), tool_names={_REGISTERED_TOOL}) as env:
        result = await _publish()

    assert result["published"] is False
    assert result["blocked_stage"] == "lint"  # NOT "grounding_fidelity"
    env.drive.assert_not_called()


# ── (f) THE ANTI-DRIFT AGREEMENT — /validate and publish report the SAME findings ──


@pytest.mark.asyncio
async def test_validate_and_publish_report_the_same_grounding_findings():
    """THE PHASE-GOAL PROPERTY, asserted directly rather than inferred.

    ONE definition, ONE fake registry: the grounding-fidelity findings
    `POST /workflows/validate` PREVIEWS are the SAME set `publish_workflow` ENFORCES.
    Both sides are produced independently — the route handler is invoked for real, and the
    publish orchestration is invoked for real — and compared on the structural
    `(code, phase)` pairs the canvas keys on.

    Two distinct violations on two distinct phases, so the comparison is discriminating
    (a single-finding definition would agree even if one side lost its per-node keying)."""
    from app.api import workflows as wf
    from app.models.harness import WorkflowDefinition

    definition = _definition(
        [
            _agent_phase(slug="research", tools=["not_a_real_tool", _REGISTERED_TOOL]),
            _single_phase(slug="answer", index=1, skill_ref=_FOREIGN_SKILL),
        ]
    )

    with _publish_env(
        _row(definition), tool_names={_REGISTERED_TOOL}, skill_ids={_OWNED_SKILL}
    ):
        # (i) the PREVIEW — the real /validate handler over the same fake registry.
        validate_response = await wf.validate_workflow(
            body=WorkflowDefinition.model_validate(definition),
            current_user=dict(_USER),
            supabase=object(),
        )
        # (ii) the ENFORCEMENT — the real publish orchestration.
        publish_result = await _publish()

    previewed = _grounding_pairs(validate_response.verdicts)
    enforced = _grounding_pairs(publish_result["named_failures"])

    assert previewed, "the /validate preview produced no grounding findings to compare"
    assert publish_result["blocked_stage"] == "grounding_fidelity"
    assert previewed == enforced, (
        "PHASE-GOAL CLAUSE VIOLATED — 'the canvas can never drift from the publish gauntlet "
        "it must ultimately pass'. POST /workflows/validate previewed "
        f"{sorted(previewed)} while publish enforced {sorted(enforced)}. A divergence means a "
        "SECOND copy of a grounding rule has appeared: both sides must call the one shared "
        "grounding.grounding_verdicts collector (D-182-02 / D-182-06)."
    )
    # The specific expectation, so a mutual-degradation-to-empty cannot pass the test above:
    assert previewed == {("unregistered_tool", "research"), ("unregistered_skill", "answer")}


# ── (g) one source — publish CALLS the shared rule, never re-implements it ────


def test_publish_service_calls_the_shared_collector_and_implements_no_rule():
    """Structural one-source guard (the 182-01 / 182-04 discipline).

    `publish_service.py` must CALL `grounding_verdicts` and must contain no grounding rule
    of its own. The two tokens below are the vocabulary a re-implementation would have to
    reach for — a phase's `available_tools` list or its skill reference field — so their
    absence is a cheap, load-bearing proof that the rule lives in exactly one module."""
    from pathlib import Path

    import app.services.harness.publish_service as ps

    source = Path(ps.__file__).read_text(encoding="utf-8")

    assert "grounding_verdicts" in source, "publish must call the SHARED collector"
    assert 'stage="grounding_fidelity"' in source
    assert "available_tools" not in source, (
        "publish_service.py names available_tools — a grounding rule may have been "
        "re-implemented here instead of delegating to harness/grounding.py (D-182-06)"
    )
    assert "skill_ref" not in source, (
        "publish_service.py names skill_ref — a grounding rule may have been "
        "re-implemented here instead of delegating to harness/grounding.py (D-182-06)"
    )
