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
        else AsyncMock(return_value=_SUPABASE_SENTINEL)
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
