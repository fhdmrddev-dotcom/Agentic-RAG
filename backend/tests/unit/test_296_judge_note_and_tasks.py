"""Phase 296-02 Task 3 — 295-IN-08 (D-07) and 293-IN-04.

* 295-IN-08: the judge's "not sending is the correct, designed behaviour" note applies ONLY when
  recording was the designed path — the two gates that record by design in the external-action
  executor: a publish golden run (D-16) and the operator's ``live_connectors`` switch not fully
  on (D-26). A live run that recorded because its send grant was missing (no connection bound,
  disabled, wrong capability, ...) gets NO such note, so the judge reads a missing grant.
* 293-IN-04: the unattended run's background task is held in a module set until it is done.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

OUTPUT = {
    "text": "NOT SENT — recorded only.",
    "recorded_intent": {"capability": "send_email", "inputs": {"recipient": "a@b.example"}},
}
NOTE_WORDS = "Not sending is the correct, designed behaviour here."


def _prompt(**kw):
    from app.services.harness.validator_kinds import judge_system_prompt

    return judge_system_prompt(OUTPUT, business_requirement="Tell the client.",
                               author_criteria="(none)", **kw)


def test_the_note_is_kept_when_recording_was_by_design():
    assert NOTE_WORDS in _prompt()
    assert NOTE_WORDS in _prompt(by_design=True)


def test_a_missing_grant_gets_no_design_note():
    from app.services.harness.validator_kinds import JUDGE_RUBRIC_CORE

    prompt = _prompt(by_design=False)
    assert NOTE_WORDS not in prompt
    assert prompt == JUDGE_RUBRIC_CORE.format(business_requirement="Tell the client.",
                                              author_criteria="(none)")


def test_by_design_follows_the_executors_own_recording_gates():
    from app.services.harness.validator_kinds import recording_by_design

    live = SimpleNamespace(is_golden_run=False)
    with patch("app.models.user_settings.feature_audience", return_value="everyone"):
        assert recording_by_design(SimpleNamespace(is_golden_run=True)) is True
        assert recording_by_design(live) is False, "live + switch on: recorded = grant missing"
    with patch("app.models.user_settings.feature_audience", return_value="off"):
        assert recording_by_design(live) is True, "switch off: recording is the operator's design"


def test_the_in_run_judge_passes_the_runs_design_reading():
    import inspect

    from app.services.harness import validator_kinds

    src = inspect.getsource(validator_kinds)
    assert "by_design=recording_by_design(ctx)" in src


# ── 293-IN-04 ──────────────────────────────────────────────────────────────────────────────
def test_the_unattended_drive_task_is_held_until_done():
    from app.services import unattended_launch

    gate = asyncio.Event()

    async def _drive(**_kw):
        await gate.wait()

    supabase = MagicMock()
    supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": str(uuid4())}
    ]

    async def _go():
        with patch("app.dependencies.get_service_role_supabase", return_value=supabase), \
             patch("app.db.workflows.create_workflow_run", AsyncMock(return_value=uuid4())), \
             patch("app.db.workflows.arm_run_budget", AsyncMock()), \
             patch.object(unattended_launch, "_drive_run", _drive):
            await unattended_launch.launch_unattended_run(
                owner_id=uuid4(), org_id=uuid4(), workflow_id=uuid4(), definition=MagicMock(),
                inputs={}, title="t", max_tokens=1000, max_duration=60,
                pool=MagicMock(), redis=MagicMock(),
            )
            held = set(unattended_launch._BACKGROUND_TASKS)
            assert len(held) == 1, "the drive task must be held by a strong reference"
            gate.set()
            await asyncio.gather(*held)
            await asyncio.sleep(0)
            assert not unattended_launch._BACKGROUND_TASKS, "a done task leaves the set"

    asyncio.run(_go())
