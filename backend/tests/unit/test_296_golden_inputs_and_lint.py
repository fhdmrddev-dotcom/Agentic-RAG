"""Phase 296-03 (W3a) — publishing says when the practice run used stand-in answers, and the
pause-step lint states the real ceiling.

* 291-S6-F7 / D-08 (amended) — the golden run fills each declared input with a TYPED stand-in
  (enum: the first option; date: a fixed ISO date; number: ``1``; text: a short realistic
  answer). Address-like keys keep the RFC 2606 ``.invalid`` placeholder. The publish result's
  ``auto_answered`` carries ONE worded note naming the fields that got a stand-in.
* 288-WR-02 — the ceiling sentence reads whole minutes only when the ceiling IS whole minutes;
  otherwise it states seconds. A 90-second ceiling no longer reads "1 minute".

Each RED at base 7f2636c4b. No DB: the 288 publish harness is reused.
"""
from __future__ import annotations

import pytest

from app.models.harness import WorkflowDefinition
from app.services.harness import publish_service


def _definition(inputs: list[dict] | None = None, phases: list[dict] | None = None) -> dict:
    d = {
        "slug": "qual-test",
        "version": 1,
        "name": "Quality Test Workflow",
        "status": "draft",
        "phases": phases
        or [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Answer."},
                "validators": [],
            }
        ],
        "business_requirement": "Deliver a cited answer.",
    }
    if inputs is not None:
        d["inputs"] = inputs
    return d


INPUTS = [
    {"key": "region", "label": "Region", "type": "enum", "enum_options": ["", "EU", "US"]},
    {"key": "due", "label": "Due", "type": "date"},
    {"key": "count", "label": "Count", "type": "number"},
    {"key": "topic", "label": "Topic", "type": "text"},
    {"key": "recipient", "label": "Recipient", "type": "text"},
]


# ── 291-S6-F7: the typed stand-ins ────────────────────────────────────────────


def test_golden_inputs_are_typed_stand_ins_and_addresses_stay_invalid():
    wd = WorkflowDefinition.model_validate(_definition(INPUTS))
    inputs, stood_in = publish_service.golden_run_inputs(wd, "a representative kickoff prompt")
    assert inputs["kickoff_prompt"] == "a representative kickoff prompt"
    assert inputs["region"] == "EU"  # the first NON-BLANK option
    assert inputs["due"] == "2026-01-15"
    assert inputs["count"] == "1"
    assert inputs["topic"] and "placeholder" not in inputs["topic"]
    assert inputs["recipient"] == "golden-run-placeholder-recipient@example.invalid"
    assert stood_in == ["Region", "Due", "Count", "Topic"]


def test_the_stand_in_note_is_worded_for_one_and_for_many():
    assert publish_service.stand_in_note(["Region", "Due", "Count", "Topic"]) == (
        "The practice run had no example for Region, Due, Count and Topic, "
        "so it used a stand-in answer for them."
    )
    assert publish_service.stand_in_note(["Topic"]) == (
        "The practice run had no example for Topic, so it used a stand-in answer for it."
    )
    assert publish_service.stand_in_note([]) is None


def test_the_stale_text_only_comment_is_gone():
    import inspect

    src = inspect.getsource(publish_service)
    assert 'is `"text"` for every field today' not in src


@pytest.mark.asyncio
async def test_a_publish_that_used_stand_ins_says_so_in_auto_answered():
    from tests.unit.test_288_pause_lint import _publish_with_phase_rows

    result = await _publish_with_phase_rows(_definition(INPUTS), [])
    assert result["published"] is True
    assert {
        "phase": None,
        "message": (
            "The practice run had no example for Region, Due, Count and Topic, "
            "so it used a stand-in answer for them."
        ),
    } in result["auto_answered"]


@pytest.mark.asyncio
async def test_a_publish_with_no_declared_inputs_adds_no_note():
    from tests.unit.test_288_pause_lint import _publish_with_phase_rows

    result = await _publish_with_phase_rows(_definition(), [])
    assert result["published"] is True
    assert not result.get("auto_answered")


# ── 288-WR-02: the ceiling sentence ───────────────────────────────────────────


def _pause_message(monkeypatch, ceiling: int) -> str:
    from app.config import settings

    monkeypatch.setattr(settings, "ask_user_max_timeout_seconds", ceiling)
    d = _definition(
        phases=[
            {
                "slug": "approve",
                "phase_index": 0,
                "name": "Approve the draft",
                "config": {"phase_type": "llm_human_input", "prompt": "Approve?", "timeout_seconds": 0},
                "validators": [],
            }
        ]
    )
    findings = publish_service._interactive_phase_failures(WorkflowDefinition.model_validate(d))
    assert len(findings) == 1
    return findings[0]["message"]


def test_a_ceiling_that_is_not_whole_minutes_is_stated_in_seconds(monkeypatch):
    msg = _pause_message(monkeypatch, 90)
    assert "between 1 second and 90 seconds" in msg
    assert "minute" not in msg


def test_a_whole_minute_ceiling_is_stated_in_minutes(monkeypatch):
    assert "between 1 second and 10 minutes" in _pause_message(monkeypatch, 600)
    msg = _pause_message(monkeypatch, 60)
    assert "between 1 second and 1 minute " in msg
