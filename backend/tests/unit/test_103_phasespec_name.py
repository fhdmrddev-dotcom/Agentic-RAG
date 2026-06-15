"""Phase 103 (REQ-3 / WFAUTH-01) — additive-optional ``PhaseSpec.name``.

Wave 0 (Plan 01 Task 1) — GREEN NOW (NOT xfail). Verifies the additive field
landed in ``backend/app/models/harness.py``:

  - a pre-103 definition whose phases have NO ``name`` still ``model_validate()``s
    (the zero-migration additive-optional contract — old JSONB rows validate with
    the field absent);
  - a definition WITH ``phase.name`` round-trips through
    ``model_dump(mode="json") -> model_validate`` preserving ``name``.

T-103-01-04 (Tampering): ``PhaseSpec``/``WorkflowDefinition`` are ``_StrictBase``
(``extra="forbid"``) — a hallucinated key is a ``ValidationError``, not silently
stored. Asserted here so the strict floor that REQ-2 depends on stays honest.

CONVENTION (the Phase 102 posture): imports INSIDE the test bodies.
"""

from __future__ import annotations

import pytest


def _pre_103_definition() -> dict:
    """A definition exactly as a pre-103 row would serialize: NO ``phase.name``."""
    return {
        "slug": "pre-103-wf",
        "version": 1,
        "name": "Pre-103 Workflow",
        "status": "draft",
        "phases": [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Answer the question."},
                "validators": [],
            }
        ],
    }


def test_pre_103_definition_validates_without_phase_name():
    """A definition whose phases lack ``name`` still validates (additive-optional —
    zero migration; the field defaults to None when absent)."""
    from app.models.harness import WorkflowDefinition

    wf = WorkflowDefinition.model_validate(_pre_103_definition())

    assert len(wf.phases) == 1
    # The additive field defaults to None when the pre-103 JSONB omits it:
    assert wf.phases[0].name is None


def test_phase_name_round_trips_through_jsonb():
    """A definition WITH ``phase.name`` round-trips: model_dump(mode='json') ->
    model_validate preserves ``name`` (it serializes into the existing JSONB)."""
    from app.models.harness import WorkflowDefinition

    src = _pre_103_definition()
    src["phases"][0]["name"] = "Answer the question"

    wf = WorkflowDefinition.model_validate(src)
    assert wf.phases[0].name == "Answer the question"

    # The JSONB round-trip (the exact create/update_workflow_definition serialization):
    dumped = wf.model_dump(mode="json")
    assert dumped["phases"][0]["name"] == "Answer the question"
    reloaded = WorkflowDefinition.model_validate(dumped)
    assert reloaded.phases[0].name == "Answer the question"


def test_phasespec_is_strict_extra_forbid():
    """T-103-01-04: ``PhaseSpec`` rejects an unknown key (``_StrictBase`` extra='forbid')
    — a hallucinated key is a ValidationError, never silently stored (the floor REQ-2
    relies on for the forced-emit validate loop)."""
    from pydantic import ValidationError

    from app.models.harness import WorkflowDefinition

    bad = _pre_103_definition()
    bad["phases"][0]["hallucinated_key"] = "should be rejected"

    with pytest.raises(ValidationError):
        WorkflowDefinition.model_validate(bad)
