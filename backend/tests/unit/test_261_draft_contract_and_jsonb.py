"""Phase 261 — BUG-260921-01 (a) and (b).

Two fences, each driven RED against a planted regression before being trusted:

  (a) THE SCHEMA IS THE CONTRACT. Every substantive field on ``ExpertDraftOutput`` used to
      carry a Pydantic default, so a model returning one thin sentence validated perfectly
      and draft richness was a lottery — measured 293 vs 2163 chars of ``description`` on
      one identical prompt. These tests pin the floors, and pin that the FALLBACK (the last
      rung under ``forced_emit``'s ladder) still clears them, because a ValidationError
      there 500s the draft endpoint for the request that has nothing else left.

  (b) THE WRITE PATH MUST EMIT A JSON ARRAY. ``json.dumps`` on a value that is already a
      string yields a JSON *string scalar*, which Postgres stores and which reads back as
      ``jsonb_typeof = 'string'``. Measured live: ``phd-lr`` was a string, and
      ``financial-analyzer`` an array, in the same column.
"""

from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from app.db.experts import _parse_prompt_suggestions, _suggestions_to_jsonb
from app.services.expert_authoring import (
    DraftPromptSuggestion,
    ExpertDraftOutput,
    _generate_fallback_draft,
)

# --- (a) the draft contract ------------------------------------------------------------

#: Fields that MUST be supplied by the emitting model — no default may reappear on them.
REQUIRED_DRAFT_FIELDS = {
    "name",
    "slug",
    "icon",
    "category",
    "when_to_use",
    "example_output",
    "description",
    "prompt_suggestions",
    "member_skills",
    "knowledge_folder_ids",
    "required_connections",
}


def test_every_substantive_draft_field_is_required():
    """A default on any of these is how a one-sentence draft used to validate."""
    optional = {n for n, f in ExpertDraftOutput.model_fields.items() if not f.is_required()}
    leaked = REQUIRED_DRAFT_FIELDS & optional
    assert not leaked, (
        "BUG-260921-01a regression: these draft fields carry a default again, so a model "
        f"that omits them still validates: {sorted(leaked)}"
    )
    # scope_mode / tool_floor_enabled are DELIBERATELY defaulted — D-v4.3-01 / D-v4.3-02
    # make 'biased' and 'true' the platform defaults, so the model omitting them is correct.
    assert optional == {"scope_mode", "tool_floor_enabled"}, (
        f"Unexpected optional set on ExpertDraftOutput: {sorted(optional)}"
    )


@pytest.mark.parametrize(
    "field,value",
    [
        ("description", "Too thin."),
        ("when_to_use", "short"),
        ("example_output", "tiny"),
    ],
)
def test_thin_field_is_refused(field, value):
    """The floors reject the thin answers the old schema accepted silently."""
    good = _valid_payload()
    good[field] = value
    with pytest.raises(ValidationError):
        ExpertDraftOutput(**good)


def test_when_to_use_has_an_enforced_ceiling():
    """The system prompt asked for <140 chars and the model returned 600+.

    The prompt and the schema now agree on 240 — the field renders as a one-liner on the
    Expert card, so an unbounded 'one-liner' is a layout defect, not a richer answer.
    """
    payload = _valid_payload()
    payload["when_to_use"] = "x" * 241
    with pytest.raises(ValidationError):
        ExpertDraftOutput(**payload)


def test_exactly_three_action_tiles_with_substantial_prompts():
    payload = _valid_payload()
    payload["prompt_suggestions"] = payload["prompt_suggestions"][:2]
    with pytest.raises(ValidationError):
        ExpertDraftOutput(**payload)

    payload = _valid_payload()
    payload["prompt_suggestions"][0]["prompt"] = "Do the thing."
    with pytest.raises(ValidationError):
        ExpertDraftOutput(**payload)


@pytest.mark.parametrize(
    "description",
    ["", "   ", "x", "a b", "?!@#", "I want a PhD literature review expert",
     "legal contract compliance reviewer for MSAs and NDAs"],
)
def test_fallback_is_total_and_clears_its_own_floors(description):
    """The fallback is the LAST rung — it must never raise, for any input.

    Driven against a one-character prompt, which produced a 1-char slug and raised
    ValidationError before the floor was added.
    """
    out = _generate_fallback_draft(description)
    assert isinstance(out, ExpertDraftOutput)
    assert len(out.description) >= 400
    assert 40 <= len(out.when_to_use) <= 240
    assert len(out.example_output) >= 120
    assert len(out.prompt_suggestions) == 3
    assert all(len(t.prompt) >= 150 for t in out.prompt_suggestions)


def test_draft_tile_model_is_not_the_persisted_one():
    """The floor belongs where content is GENERATED, not where it is read.

    ``models.expert.PromptSuggestion`` is also the read shape for every persisted bundle;
    tightening it would make an older thin row unreadable.
    """
    from app.models.expert import PromptSuggestion

    assert DraftPromptSuggestion is not PromptSuggestion
    PromptSuggestion(title="t", prompt="short")  # must still accept a thin legacy row
    with pytest.raises(ValidationError):
        DraftPromptSuggestion(title="t", prompt="short")


# --- (b) the jsonb write path ----------------------------------------------------------

def test_a_list_serialises_to_a_json_array():
    tiles = [{"title": "A", "prompt": "p"}, {"title": "B", "prompt": "q"}]
    out = _suggestions_to_jsonb(tiles)
    assert isinstance(json.loads(out), list)
    assert json.loads(out) == tiles


def test_an_already_encoded_string_does_not_become_a_string_scalar():
    """THE ACTUAL DEFECT. json.dumps on a str yields a JSON string scalar."""
    tiles = [{"title": "A", "prompt": "p"}]
    encoded = json.dumps(tiles)

    naive = json.dumps(encoded)              # what the old write path did
    assert isinstance(json.loads(naive), str), "precondition: the naive form IS a scalar"

    fixed = _suggestions_to_jsonb(encoded)
    assert isinstance(json.loads(fixed), list), (
        "BUG-260921-01b regression: an already-encoded string is being re-dumped into a "
        "jsonb string scalar instead of being parsed into an array"
    )
    assert json.loads(fixed) == tiles


@pytest.mark.parametrize("val", [None, "", "not json", "{}", '"a string"', 42, object()])
def test_never_returns_a_non_array(val):
    """Whatever arrives, the bind value parses to a list — the reader defends nothing."""
    assert isinstance(json.loads(_suggestions_to_jsonb(val)), list)


def test_pydantic_tiles_are_serialised_by_value():
    tiles = [DraftPromptSuggestion(title="Audit the methodology", prompt="x" * 160)]
    parsed = json.loads(_suggestions_to_jsonb(tiles))
    assert isinstance(parsed, list) and parsed[0]["title"] == "Audit the methodology"


def test_read_side_still_tolerates_the_legacy_string_scalar():
    """The fix stops NEW scalars; rows already written must still read.

    ``phd-lr`` exists in the live database as a string scalar.
    """
    legacy = json.dumps([{"title": "A", "prompt": "p"}])
    assert _parse_prompt_suggestions(legacy) == [{"title": "A", "prompt": "p"}]
    assert _parse_prompt_suggestions('"just a string"') == []
    assert _parse_prompt_suggestions(None) == []


# --- helpers ---------------------------------------------------------------------------

def _valid_payload() -> dict:
    return {
        "name": "PhD Literature Review Expert",
        "slug": "phd-literature-review",
        "icon": "book",
        "category": "Research & Academia",
        "when_to_use": (
            "Consult when designing a search strategy, running PRISMA screening, appraising "
            "methodology, or drafting the review chapter."
        ),
        "example_output": (
            "## Literature Matrix\n\n| Study | Design | Quality | Contribution |\n|---|---|---|---|\n"
            "| Smith 2021 | RCT | High | Establishes the baseline effect |\n"
        ),
        "description": "D" * 450,
        "prompt_suggestions": [
            {"title": f"Tile {i}", "prompt": f"{i} " + "p" * 200} for i in range(3)
        ],
        "member_skills": ["docx"],
        "knowledge_folder_ids": [],
        "required_connections": [],
    }
