"""Phase 103 (REQ-1 / WFAUTH-01) — lint-block confirmation (the EXISTING publish path).

Wave 0 (Plan 01 Task 1) authors the stub; **Plan 01 Task 3** un-xfails it. REQ-1 does
NOT add a new lint path — it CONFIRMS the existing ``publish_service.publish`` gate:
a draft whose ``lint_workflow()`` returns >=1 LintError publishes with
``published=false``, ``blocked_stage='lint'``, and the ``named_failures`` carry the
LOWERCASE ``LintError.code`` literals.

The 5 canonical codes (``reachability.py``): ``bad_index``, ``unsatisfiable_skip``,
``orphan_phase``, ``no_terminal``, ``input_unsatisfied``.

Mocks the golden-run + judge boundaries (the Phase-102 ``test_publish_service``
posture); lint short-circuits BEFORE the golden run so a lint-failing draft never
drives one. CONVENTION: imports INSIDE the test body.
"""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest

_LOWERCASE_LINT_CODES = {
    "bad_index",
    "unsatisfiable_skip",
    "orphan_phase",
    "no_terminal",
    "input_unsatisfied",
}


def _lint_failing_row() -> dict:
    """A get_definition row whose single phase has a non-contiguous index (index 5
    with one phase -> BAD_INDEX) so the publish pipeline blocks at the lint stage."""
    user_id = str(uuid4())
    definition = {
        "slug": "lint-block-test",
        "version": 1,
        "name": "Lint Block Test",
        "status": "draft",
        "phases": [
            {
                "slug": "answer",
                "phase_index": 5,  # non-contiguous with one phase -> bad_index
                "config": {"phase_type": "llm_single", "prompt": "Answer."},
                "validators": [],
            }
        ],
        "business_requirement": "Deliver a cited answer.",
    }
    return {
        "id": uuid4(),
        "slug": "lint-block-test",
        "version": 1,
        "name": "Lint Block Test",
        "status": "draft",
        "definition": definition,
        "created_by": UUID(user_id),
    }, user_id


@pytest.mark.asyncio
async def test_lint_failing_draft_blocks_at_lint_with_lowercase_codes():
    """A lint-failing draft publishes with published=false, blocked_stage='lint',
    and lowercase lint codes in named_failures — driving the EXISTING publish path
    (no new lint route). The golden run is NEVER driven (lint short-circuits)."""
    from unittest.mock import AsyncMock, patch

    from app.services.harness import publish_service

    row, user_id = _lint_failing_row()
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_drive_golden_run", AsyncMock()) as drive,
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
    ):
        result = await publish_service.publish(
            definition_id=row["id"],
            golden_input="a representative kickoff prompt",
            user={"id": user_id},
            pool=AsyncMock(),
            redis=AsyncMock(),
        )

    assert result["published"] is False
    assert result["blocked_stage"] == "lint"
    assert result["named_failures"]
    drive.assert_not_called()  # lint short-circuits BEFORE the golden run
    flip.assert_not_called()

    # Every rendered lint code is one of the 5 LOWERCASE literals (key-detection lens):
    rendered_codes = {
        f["code"] for f in result["named_failures"] if isinstance(f, dict) and "code" in f
    }
    assert rendered_codes  # at least one code-bearing failure
    assert rendered_codes <= _LOWERCASE_LINT_CODES
