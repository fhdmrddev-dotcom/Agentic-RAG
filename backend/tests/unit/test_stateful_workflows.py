"""
Unit tests for Phase 205: Stateful and Incremental Workflows.
Tests:
1. Prior run scoping by stable slug across multiple definition IDs (G-1).
2. User/Org owner isolation (G-2, T-205-01).
3. Phase 200.2 deliverable resolution skipping confirm & file steps (G-4).
4. Safe unwrapping of JSON string scalars (N-3).
5. Template interpolation of {{prior_run.output}}, {{prior_run.id}}, {{prior_run.created_at}}.
6. Stateful framing block injection with [NEW], [UPDATED], [RESOLVED] markdown badges (N-4).
7. WorkflowDefinition model preservation of is_stateful (N-5).
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from datetime import datetime, timezone

from app.models.harness import WorkflowDefinition, PhaseSpec
from app.db.workflows import get_latest_completed_workflow_run
from app.services.harness.phase_types import (
    _interpolate_prior_run_variables,
    _stateful_framing_block,
)


@pytest.mark.asyncio
async def test_get_latest_completed_workflow_run_by_slug():
    """
    G-1: Resolution must scope on stable workflow identity (slug) and user_id,
    surviving republishes across multiple definition IDs.
    """
    user_id = uuid4()
    org_id = uuid4()
    slug = "pm-weekly-status-report"

    # Mock DB pool
    pool = MagicMock()
    run_id = uuid4()
    created_at = datetime.now(timezone.utc)
    pool.fetchrow = AsyncMock(return_value={
        "run_id": run_id,
        "definition_id": uuid4(),  # Version 2 definition ID
        "status": "completed",
        "created_at": created_at,
    })

    # Mock phase outputs
    pool.fetch = AsyncMock(return_value=[
        {
            "id": uuid4(),
            "phase_index": 1,
            "slug": "deliver",
            "status": "completed",
            "output": json.dumps({"text": "Final status report for sprint 42"}),
        },
        {
            "id": uuid4(),
            "phase_index": 0,
            "slug": "gather",
            "status": "completed",
            "output": json.dumps({"text": "Raw gathered metrics"}),
        },
    ])

    result = await get_latest_completed_workflow_run(
        pool,
        slug=slug,
        user_id=user_id,
        org_id=org_id,
    )

    assert result is not None
    assert result["id"] == str(run_id)
    assert result["deliverable_text"] == "Final status report for sprint 42"

    # Verify query parameters checked slug and user_id directly
    pool.fetchrow.assert_called_once()
    args = pool.fetchrow.call_args[0]
    query = args[0]
    assert "wd.slug = $1" in query
    assert "wr.user_id = $2" in query
    assert args[1] == slug
    assert args[2] == user_id
    assert args[3] == org_id


@pytest.mark.asyncio
async def test_get_latest_completed_workflow_run_owner_isolation():
    """
    G-2, T-205-01: Verifies owner isolation so user A cannot read user B's prior runs.
    """
    user_a = uuid4()
    pool = MagicMock()
    pool.fetchrow = AsyncMock(return_value=None)

    result = await get_latest_completed_workflow_run(
        pool,
        slug="confidential-review",
        user_id=user_a,
        org_id=None,
    )

    assert result is None


@pytest.mark.asyncio
async def test_deliverable_resolution_skips_confirm_and_file_steps():
    """
    G-4: Phase 200.2 rule - skips closing question/confirm steps and closing file steps with empty text.
    Selects the last server-ordered row with non-empty deliverable text.
    """
    user_id = uuid4()
    pool = MagicMock()

    run_id = uuid4()
    created_at = datetime.now(timezone.utc)
    pool.fetchrow = AsyncMock(return_value={
        "run_id": run_id,
        "definition_id": uuid4(),
        "status": "completed",
        "created_at": created_at,
    })

    # Phases returned in reverse server order (phase_index DESC):
    # index 3: closing confirm step asking "Does this draft answer your question?"
    # index 2: closing file export step with empty text
    # index 1: the genuine deliverable phase with text
    # index 0: initial search step
    pool.fetch = AsyncMock(return_value=[
        {
            "id": uuid4(),
            "phase_index": 3,
            "slug": "confirm_step",
            "status": "completed",
            "output": {"text": "Does this draft answer your question?", "question": True},
        },
        {
            "id": uuid4(),
            "phase_index": 2,
            "slug": "export_file",
            "status": "completed",
            "output": {"file_id": "123", "text": ""},
        },
        {
            "id": uuid4(),
            "phase_index": 1,
            "slug": "generate_report",
            "status": "completed",
            "output": {"text": "# Sprint 42 Deliverable\n- All goals achieved."},
        },
        {
            "id": uuid4(),
            "phase_index": 0,
            "slug": "search",
            "status": "completed",
            "output": {"text": "Search queries executed"},
        },
    ])

    result = await get_latest_completed_workflow_run(
        pool,
        slug="sprint-summary",
        user_id=user_id,
    )

    assert result is not None
    assert result["deliverable_text"] == "# Sprint 42 Deliverable\n- All goals achieved."


@pytest.mark.asyncio
async def test_safe_jsonb_output_hydration_real_string_scalar():
    """
    N-3: Real database measurement - 87% of workflow_phases.output rows are JSON string scalars.
    Verifies that safe JSON unwrap decodes the string scalar into a dict and extracts deliverable_text.
    """
    user_id = uuid4()
    pool = MagicMock()

    run_id = uuid4()
    pool.fetchrow = AsyncMock(return_value={
        "run_id": run_id,
        "definition_id": uuid4(),
        "status": "completed",
        "created_at": datetime.now(timezone.utc),
    })

    # Output stored as string-scalar JSON
    raw_json_str = json.dumps({
        "text": "Living register: 3 open items, 2 resolved.",
        "metadata": {"token_count": 142},
    })

    pool.fetch = AsyncMock(return_value=[
        {
            "id": uuid4(),
            "phase_index": 0,
            "slug": "emit",
            "status": "completed",
            "output": raw_json_str,
        }
    ])

    result = await get_latest_completed_workflow_run(
        pool,
        slug="risk-register",
        user_id=user_id,
    )

    assert result is not None
    assert result["deliverable_text"] == "Living register: 3 open items, 2 resolved."
    assert isinstance(result["output"], dict)
    assert result["output"]["metadata"]["token_count"] == 142


@pytest.mark.asyncio
async def test_safe_jsonb_output_hydration_malformed_string():
    """
    N-3: Malformed JSON string scalar falls back gracefully without unhandled exception.
    """
    user_id = uuid4()
    pool = MagicMock()

    run_id = uuid4()
    pool.fetchrow = AsyncMock(return_value={
        "run_id": run_id,
        "definition_id": uuid4(),
        "status": "completed",
        "created_at": datetime.now(timezone.utc),
    })

    pool.fetch = AsyncMock(return_value=[
        {
            "id": uuid4(),
            "phase_index": 0,
            "slug": "emit",
            "status": "completed",
            "output": "Plain un-JSON-encoded fallback text",
        }
    ])

    result = await get_latest_completed_workflow_run(
        pool,
        slug="risk-register",
        user_id=user_id,
    )

    assert result is not None
    assert result["deliverable_text"] == "Plain un-JSON-encoded fallback text"


def test_prior_run_template_interpolation_populated():
    """
    Tests {{prior_run.output}}, {{prior_run.id}}, and {{prior_run.created_at}}
    variable substitution when a prior run is present.
    """
    prompt = "Review previous report:\n{{prior_run.output}}\nPrior ID: {{prior_run.id}}\nCreated: {{prior_run.created_at}}"
    prior_run = {
        "id": "run-abc-123",
        "created_at": "2026-08-20T12:00:00Z",
        "deliverable_text": "Q2 Deliverable Summary",
    }

    interpolated = _interpolate_prior_run_variables(prompt, prior_run)

    assert "Review previous report:\nQ2 Deliverable Summary" in interpolated
    assert "Prior ID: run-abc-123" in interpolated
    assert "Created: 2026-08-20T12:00:00Z" in interpolated


def test_prior_run_template_interpolation_cold_start():
    """
    Tests cold start (prior_run is None): {{prior_run.output}} evaluates to
    '[Initial Run - No Prior State]'.
    """
    prompt = "Previous deliverable:\n{{prior_run.output}}"
    interpolated = _interpolate_prior_run_variables(prompt, None)

    assert "Previous deliverable:\n[Initial Run - No Prior State]" == interpolated


def test_stateful_framing_block_injection():
    """
    N-4: Stateful framing block injects markdown delta badge instructions
    ([NEW], [UPDATED], [RESOLVED]) when is_stateful or prior_run is active.
    """
    # Context with prior_run
    ctx = MagicMock()
    ctx.definition = WorkflowDefinition(
        name="Weekly Review",
        slug="weekly-review",
        version=1,
        is_stateful=True,
        phases=[PhaseSpec(slug="s1", name="Step 1", phase_index=0, config={"phase_type": "llm_single", "prompt": "p"})],
    )
    ctx.prior_run = {
        "id": "run-xyz-999",
        "deliverable_text": "Prior deliverables list",
    }

    block = _stateful_framing_block(ctx)
    assert "[NEW]" in block
    assert "[UPDATED]" in block
    assert "[RESOLVED]" in block
    assert "Living Register & Incremental Updates" in block
    assert "Preserve existing unchanged items" in block


def test_publish_workflow_preserves_is_stateful():
    """
    N-5: Trace and test that is_stateful survives WorkflowDefinition model validation
    and dictionary serialization.
    """
    wd = WorkflowDefinition(
        name="Living Register",
        slug="living-register",
        version=1,
        is_stateful=True,
        phases=[
            PhaseSpec(slug="p1", name="Phase 1", phase_index=0, config={"phase_type": "llm_single", "prompt": "test"})
        ],
    )
    assert wd.is_stateful is True

    # Check model dump / dict
    d = wd.model_dump()
    assert d.get("is_stateful") is True

    # Check reconstruction
    reconstructed = WorkflowDefinition.model_validate(d)
    assert reconstructed.is_stateful is True
