"""BUG-260921-02 — the drafter must not emit a value its own consumers refuse.

⛔ THE DEFECT THIS FENCE EXISTS FOR, measured live on 2026-09-21 against `795884b68`:
``ExpertDraftOutput.description`` carried ``min_length=400`` and **no maximum**. The drafter
wrote a 4,833-character blueprint. Both consumers of that value cap it at 1,000:

    POST /experts             -> ExpertBundleBase.description            max_length=1000  -> 422
    POST /experts/draft-skill-body -> SkillBodyDraftRequest.expert_description max_length=1000 -> 422

So the app's own AI produced an Expert the app then refused to save, and whose proposed skills
could not be drafted. It was the FIRST fresh Expert authored — the default path, not an edge case.

⭐ WHY NO EXISTING TEST COULD SEE IT. Backend suites build the consumer models from short fixture
strings; frontend suites mock ``@/lib/api/experts`` so no payload ever meets a Pydantic model.
Producer and consumer each validated perfectly IN ISOLATION. Nothing compared their CONSTRAINTS.
That is a cross-plan SEAM: 263-02 owns the producer, 263-03 owns the consumer, both correct alone.

⚠ The codebase already held the evidence and never connected it. ``expert_authoring.py``'s own
docstring records *"``description`` came back 293 chars on one run and 2163 on another"*.

⛔ THIS FENCE ASSERTS A RELATIONSHIP, NEVER A CONSTANT. It does not care what the caps ARE; it
cares that every producer field is BOUNDED and that its consumer's bound is not smaller. Raising a
cap keeps it green; re-introducing an unbounded producer, or narrowing a consumer below its
producer, turns it red. A test pinning ``== 8000`` would have to be edited on every legitimate
widening and would teach nobody why the number matters.
"""

from __future__ import annotations

import pytest
from annotated_types import MaxLen
from pydantic import BaseModel

from app.models.expert import ExpertBundleBase, SkillBodyDraftRequest
from app.services.expert_authoring import ExpertDraftOutput, SuggestedNewSkill


def _max_length(model: type[BaseModel], field: str) -> int | None:
    """The declared ``max_length`` of a field, or ``None`` when it is unbounded."""
    info = model.model_fields[field]
    for meta in info.metadata:
        if isinstance(meta, MaxLen):
            return meta.max_length
    return None


# (producer model, producer field, consumer model, consumer field)
#
# Every row is a value the drafter GENERATES that is later POSTed into the consumer verbatim —
# there is no truncation anywhere on the client (ExpertAuthoringStudio.tsx sends `description`
# straight through at both its call sites).
PRODUCER_CONSUMER_PAIRS = [
    (ExpertDraftOutput, "name", ExpertBundleBase, "name"),
    (ExpertDraftOutput, "slug", ExpertBundleBase, "slug"),
    (ExpertDraftOutput, "category", ExpertBundleBase, "category"),
    (ExpertDraftOutput, "when_to_use", ExpertBundleBase, "when_to_use"),
    (ExpertDraftOutput, "example_output", ExpertBundleBase, "example_output"),
    (ExpertDraftOutput, "description", ExpertBundleBase, "description"),
    # The skill-body route re-sends the SAME blueprint under a different field name (PACK-15).
    (ExpertDraftOutput, "description", SkillBodyDraftRequest, "expert_description"),
    (ExpertDraftOutput, "name", SkillBodyDraftRequest, "expert_name"),
    (SuggestedNewSkill, "name", SkillBodyDraftRequest, "skill_name"),
    (SuggestedNewSkill, "description", SkillBodyDraftRequest, "skill_description"),
    (SuggestedNewSkill, "why_needed", SkillBodyDraftRequest, "why_needed"),
]

_IDS = [f"{p.__name__}.{pf}->{c.__name__}.{cf}" for p, pf, c, cf in PRODUCER_CONSUMER_PAIRS]


@pytest.mark.parametrize(("producer", "p_field", "consumer", "c_field"), PRODUCER_CONSUMER_PAIRS, ids=_IDS)
def test_producer_field_is_bounded(producer, p_field, consumer, c_field):
    """An UNBOUNDED producer feeding a BOUNDED consumer is the defect shape itself.

    A floor (``min_length``) without a ceiling says "be rich" and never says "how rich is too
    rich". The consumer then answers that question with a 422 the author never asked for.
    """
    p_max = _max_length(producer, p_field)
    c_max = _max_length(consumer, c_field)
    assert p_max is not None, (
        f"{producer.__name__}.{p_field} declares NO max_length while its consumer "
        f"{consumer.__name__}.{c_field} caps at {c_max}. The drafter can emit a value the app "
        f"then refuses (BUG-260921-02, measured at 4833 chars against a cap of 1000)."
    )


@pytest.mark.parametrize(("producer", "p_field", "consumer", "c_field"), PRODUCER_CONSUMER_PAIRS, ids=_IDS)
def test_consumer_accepts_everything_its_producer_can_emit(producer, p_field, consumer, c_field):
    """The consumer's ceiling must not sit below the producer's."""
    p_max = _max_length(producer, p_field)
    c_max = _max_length(consumer, c_field)
    if p_max is None:
        pytest.skip("unboundedness is reported by test_producer_field_is_bounded")
    assert c_max is None or c_max >= p_max, (
        f"{consumer.__name__}.{c_field} caps at {c_max} but {producer.__name__}.{p_field} may "
        f"emit up to {p_max}. A draft the app generates would be refused by the app."
    )


def test_producer_floor_never_exceeds_consumer_ceiling():
    """The unmissable arm: a MINIMUM above a consumer's MAXIMUM makes EVERY valid draft unsavable.

    ``description`` sat exactly here — ``min_length=400`` producing up to 4833, into a 1000 cap.
    """
    offenders = []
    for producer, p_field, consumer, c_field in PRODUCER_CONSUMER_PAIRS:
        p_min = next(
            (m.min_length for m in producer.model_fields[p_field].metadata if hasattr(m, "min_length")),
            None,
        )
        c_max = _max_length(consumer, c_field)
        if p_min is not None and c_max is not None and p_min > c_max:
            offenders.append(f"{producer.__name__}.{p_field} min={p_min} > {consumer.__name__}.{c_field} max={c_max}")
    assert not offenders, "producer floor above consumer ceiling: " + "; ".join(offenders)
