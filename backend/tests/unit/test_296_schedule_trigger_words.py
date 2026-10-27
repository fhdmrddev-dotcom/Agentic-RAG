"""Phase 296-02 Task 3 — 295-IN-05: schedule "Run now" answers in words, with an outcome.

Before: ``detail=f"Failed to launch schedule: {exc}"`` for EVERY failure, so a worded
``ScheduledLaunchRefused`` (a template refusal, already a sentence for the author) read as a
launch failure, and an unexpected exception's raw text reached the wire. Now each arm carries
``outcome`` (launched / refused / not_loaded / error) and the UI-SPEC C sentence; the raw
exception is logged only. The backoff half of 295-IN-05 is a seed (296-05), not built here.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

NOT_LOADED = (
    "It didn't start: the workflow could not be loaded (it was deleted, or is no longer yours)."
)
ERROR = "It didn't start because of a problem on our side. Nothing ran — try again in a moment."


def _trigger(launch):
    from app.api import schedules

    async def _pool():
        return MagicMock()

    with patch.object(schedules, "get_pg_pool", _pool), \
         patch.object(schedules, "get_schedule", AsyncMock(return_value={"id": "s"})), \
         patch.object(schedules, "get_schedule_for_launch", AsyncMock(return_value={"id": "s"})), \
         patch.object(schedules, "get_redis", MagicMock()), \
         patch("app.services.scheduler_service.launch_scheduled_run", launch):
        out = asyncio.run(schedules.trigger_schedule(uuid4(), current_user={"id": str(uuid4())}))
    return out.model_dump(mode="json")


def test_a_worded_refusal_reaches_the_wire_verbatim():
    from app.services.scheduler_service import ScheduledLaunchRefused

    sentence = "This workflow has a template step with no template bound, so it can't run."
    out = _trigger(AsyncMock(side_effect=ScheduledLaunchRefused(sentence)))
    assert (out["launched"], out["outcome"], out["detail"]) == (False, "refused", sentence)


def test_an_unloadable_workflow_reads_the_not_loaded_sentence():
    out = _trigger(AsyncMock(return_value=None))
    assert (out["launched"], out["outcome"], out["detail"]) == (False, "not_loaded", NOT_LOADED)


def test_an_unexpected_error_never_puts_its_text_on_the_wire(caplog):
    out = _trigger(AsyncMock(side_effect=RuntimeError("boom secret")))
    assert (out["launched"], out["outcome"], out["detail"]) == (False, "error", ERROR)
    assert "boom secret" not in str(out)
    assert any("boom secret" in r.getMessage() for r in caplog.records), "logged only"


def test_a_launch_reads_launched():
    run_id = uuid4()
    out = _trigger(AsyncMock(return_value=run_id))
    assert (out["launched"], out["outcome"], out["workflow_run_id"]) == (
        True, "launched", str(run_id))


@pytest.mark.parametrize("outcome", ["launched", "refused", "not_loaded", "error"])
def test_the_outcome_vocabulary_is_closed(outcome):
    from app.models.schedule import ScheduleTriggerResult

    ScheduleTriggerResult(launched=outcome == "launched", outcome=outcome)
    with pytest.raises(Exception):
        ScheduleTriggerResult(launched=False, outcome="exploded")
