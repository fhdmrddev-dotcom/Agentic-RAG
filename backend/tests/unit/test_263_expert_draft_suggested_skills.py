"""Phase 263 (PACK-14 / PACK-16, D-263-02) — the drafter must NAME what it cannot find.

WHY THIS FENCE EXISTS. Two separate defects live in ``expert_authoring.py`` and only one of
them is visible from the schema:

  1. The draft had nowhere to put "this Expert needs a skill your library does not have".
     A field with a Pydantic DEFAULT would not fix that — Phase 261 measured exactly what a
     default buys you (``757bb9e25``): a model that returns nothing validates perfectly and
     richness becomes a lottery (``description`` came back 293 chars on one run and 2163 on
     another). So the field is ``Field(..., min_length=0)`` — REQUIRED, and empty-able.
     ``min_length=0`` enforces nothing; it DOCUMENTS that an empty list is a real answer.

  2. The system prompt's item 11 carried an escape hatch — *"or include 3-5 recommended
     domain skill names"* — which put INVENTED names into ``member_skills``, where
     ``expert_service.py`` strips them at run time in silence. That is the defect PACK-16
     names. Leaving the hatch while adding the new field would ship BOTH behaviours and make
     PACK-16 unfalsifiable, so the hatch's ABSENCE is asserted here, not assumed.

⛔ THE TRAP THIS FILE ALSO GUARDS. ``_generate_fallback_draft`` constructs
``ExpertDraftOutput`` with explicit kwargs and no ``**extra``, and it is reached from inside
``except Exception`` when ``forced_emit`` fails. A new REQUIRED field without a matching
constructor edit means the LLM path degrades, the fallback ALSO throws, and ``POST
/experts/draft`` 500s at exactly the moment the fallback exists to prevent that. A unit test
that only exercises the ``forced_emit`` success path is the warning sign this was missed —
so the fallback is called DIRECTLY here.
"""

from __future__ import annotations

import pathlib

import pytest
from pydantic import ValidationError

from app.services.expert_authoring import (
    ExpertDraftOutput,
    SuggestedNewSkill,
    _generate_fallback_draft,
)

_MODULE_SOURCE = pathlib.Path(
    __file__
).resolve().parents[2] / "app" / "services" / "expert_authoring.py"

# The exact hatch clause PACK-16 names as the defect mechanism.
_HATCH = "or include 3-5 recommended domain skill names"


def _valid_draft_kwargs() -> dict:
    """A minimal set of kwargs satisfying every FLOOR on ``ExpertDraftOutput``.

    Deliberately spelled out rather than factory-generated: the floors ARE the contract
    (BUG-260921-01a), so a helper that silently drifts from them would make every case here
    weaker without anything going red.
    """
    long_prompt = (
        "Conduct a comprehensive, structured analysis of the supplied material, identify the "
        "seminal themes and the current state of the art, evaluate the strength of the "
        "underlying evidence, and state plainly where the evidence does not support a "
        "conclusion at all."
    )
    return {
        "name": "Test Domain Specialist",
        "slug": "test-domain-specialist",
        "icon": "book",
        "category": "Research & Academia",
        "when_to_use": "Consult when a structured, evidence-led review of the domain is required.",
        "example_output": (
            "## Review Matrix\n\n| Area | Finding | Confidence |\n|---|---|---|\n"
            "| Core | Evaluated against benchmark criteria with empirical validation | High |"
        ),
        "description": "A" * 420,
        "prompt_suggestions": [
            {"title": "Analyze Topic", "prompt": long_prompt},
            {"title": "Identify Gaps", "prompt": long_prompt},
            {"title": "Synthesize Deliverable", "prompt": long_prompt},
        ],
        "member_skills": [],
        "knowledge_folder_ids": [],
        "required_connections": [],
    }


def test_suggested_new_skills_is_a_required_field():
    """D-263-02 half one: the FIELD METADATA says required.

    Asserted alongside the omission case below because the two are the difference this
    decision turns on — ``Field(default=[])`` would keep the field present and the schema
    valid while quietly making it optional.
    """
    field = ExpertDraftOutput.model_fields["suggested_new_skills"]
    assert field.is_required() is True


def test_omitting_suggested_new_skills_raises_naming_the_field():
    """D-263-02 half two: the BEHAVIOUR matches the metadata."""
    with pytest.raises(ValidationError) as exc:
        ExpertDraftOutput(**_valid_draft_kwargs())
    assert "suggested_new_skills" in str(exc.value)


def test_empty_suggested_new_skills_validates_cleanly():
    """An empty list is a REAL answer — the library genuinely covering the domain is a
    legitimate outcome, and the field must not force the model to invent a gap."""
    draft = ExpertDraftOutput(**_valid_draft_kwargs(), suggested_new_skills=[])
    assert draft.suggested_new_skills == []


def test_suggested_new_skill_floors_are_real():
    """The nested model carries FLOORS, mirroring ``DraftPromptSuggestion``: a floor belongs
    where content is GENERATED, not where it is read."""
    good = SuggestedNewSkill(
        name="contract-risk-register",
        description="Draft a structured risk register from a commercial contract or brief.",
        why_needed="This Expert's blueprint requires a repeatable risk-extraction procedure.",
    )
    assert good.name == "contract-risk-register"

    with pytest.raises(ValidationError):
        SuggestedNewSkill(
            name="ab",  # 2 chars — below the 3-char floor
            description="Draft a structured risk register from a commercial contract or brief.",
            why_needed="This Expert's blueprint requires a repeatable risk-extraction procedure.",
        )

    with pytest.raises(ValidationError):
        SuggestedNewSkill(
            name="contract-risk-register",
            description="too short",  # 9 chars — below the 40-char floor
            why_needed="This Expert's blueprint requires a repeatable risk-extraction procedure.",
        )


def test_fallback_draft_constructs_with_the_new_required_field():
    """⛔ THE 500-AT-THE-WORST-MOMENT GUARD.

    ``_generate_fallback_draft`` is the honest floor under ``forced_emit``'s ladder and is
    reached from inside ``except Exception``. Called directly — NOT through the success path —
    because the success path cannot see this failure at all.
    """
    draft = _generate_fallback_draft(description="an expert for reviewing academic theses")
    assert isinstance(draft, ExpertDraftOutput)
    assert draft.suggested_new_skills == []


def test_the_member_skills_hatch_is_gone_from_the_prompt():
    """PACK-16: the mechanism that let an invented name into ``member_skills`` is deleted,
    not merely discouraged."""
    source = _MODULE_SOURCE.read_text(encoding="utf-8")
    assert _HATCH not in source


def test_the_prompt_routes_proposals_to_the_new_field():
    """The positive arm: deleting the hatch without adding the replacement instruction would
    leave the model with nowhere to put a genuine gap, and this fence would still pass."""
    source = _MODULE_SOURCE.read_text(encoding="utf-8")
    prompt_start = source.index("_EXPERT_DRAFTER_SYSTEM_PROMPT")
    prompt_end = source.index('"""', source.index('"""', prompt_start) + 3)
    prompt_body = source[prompt_start:prompt_end]
    assert "'suggested_new_skills'" in prompt_body
    assert "NEVER put a name from this list into member_skills" in prompt_body
