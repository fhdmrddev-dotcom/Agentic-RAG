"""Phase 291-02 (D-14 / D-15 / D-31 / D-34, SC#3) — a file can shape steps, never grant.

The powers guard is the STRUCTURAL half. The fence lowers how often a file-planted step is
composed; this walk of what the model ACTUALLY emitted is what removes it. Two halves of the
allow-set, and only two: the author's ticks, and what a description-only call (that never
sees file text) says the description asked for.

Pure cases first (Task 1), then generate-level cases (Task 2) on the test_214 fake harness.
No network, no DB.
"""

from __future__ import annotations

import copy
from types import SimpleNamespace

import pytest

# ── fixtures ──────────────────────────────────────────────────────────────────────────────


def _phase(slug: str, idx: int, config: dict, name: str | None = None) -> dict:
    return {
        "slug": slug,
        "phase_index": idx,
        "name": name or slug,
        "config": config,
        "validators": [],
    }


def _definition(*phases: dict) -> dict:
    return {
        "slug": "vendor-onboarding",
        "version": 1,
        "name": "Vendor onboarding",
        "status": "draft",
        "phases": list(phases),
    }


GATHER = {"phase_type": "llm_single", "prompt": "Summarise the vendor terms."}
AGENT_WITH_POWERS = {
    "phase_type": "llm_agent",
    "prompt": "Research the vendor.",
    "available_tools": ["search_documents", "web_search", "remember"],
}
SEND_EMAIL = {"phase_type": "external_action", "capability": "send_email"}
MCP_JIRA = {"phase_type": "external_action", "connection_id": "conn-jira", "tool_name": "create_issue"}
MCP_SLACK = {"phase_type": "external_action", "connection_id": "conn-slack", "tool_name": "post_message"}

VOCAB_NAMES = {
    "conn-jira": {"name": "Jira", "service_id": "jira", "actions": None},
    "conn-slack": {"name": " Slack ", "service_id": "slack", "actions": None},
}


def _wd(d: dict):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(copy.deepcopy(d))


def _types(wd) -> list[str]:
    return [p.config.phase_type for p in wd.phases]


# ── draft_powers ──────────────────────────────────────────────────────────────────────────


def test_draft_powers_lists_external_steps_and_power_tools():
    from app.services.describe_draft_guards import POWER_TOOLS, draft_powers

    assert POWER_TOOLS == frozenset({"web_search", "save_skill", "attach_skill_file", "remember"})
    wd = _wd(_definition(
        _phase("gather", 0, GATHER),
        _phase("research", 1, AGENT_WITH_POWERS),
        _phase("email", 2, SEND_EMAIL),
        _phase("ticket", 3, MCP_JIRA),
    ))
    powers = draft_powers(wd)
    assert len(powers) == 4  # 2 external steps + web_search + remember
    kinds = sorted(p["kind"] for p in powers)
    assert kinds == ["external", "external", "tool", "tool"]

    assert draft_powers(_wd(_definition(_phase("gather", 0, GATHER)))) == []


# ── remove_unasked_powers: pure ───────────────────────────────────────────────────────────


def test_BLOCKER_1_None_ticks_with_files_grant_NOTHING():
    """The builder/govern describe CTA sends allowed_connection_ids=None. With files attached,
    None is NO ticks — never "no check" — so a file-planted email and MCP step both go."""
    from app.services.describe_draft_guards import DescribePowers, remove_unasked_powers

    wd = _wd(_definition(
        _phase("gather", 0, GATHER),
        _phase("email", 1, SEND_EMAIL),
        _phase("ticket", 2, MCP_JIRA),
    ))
    out = remove_unasked_powers(wd, DescribePowers(), None, VOCAB_NAMES, ["vendor-terms.pdf"])
    assert isinstance(out, tuple)
    new_wd, removed = out
    assert _types(new_wd) == ["llm_single"]
    assert [p.phase_index for p in new_wd.phases] == [0]
    assert len(removed) == 2
    assert removed[0] == {
        "lead": "Removed: send email.",
        "reason": "Only your description can add actions, not vendor-terms.pdf.",
    }
    assert removed[1]["lead"] == "Removed: use Jira."


def test_a_named_service_admits_ONLY_its_own_connection():
    from app.services.describe_draft_guards import DescribePowers, remove_unasked_powers

    wd = _wd(_definition(
        _phase("gather", 0, GATHER),
        _phase("tell", 1, MCP_SLACK),
        _phase("ticket", 2, MCP_JIRA),
    ))
    out = remove_unasked_powers(
        wd, DescribePowers(services=["Slack"]), None, VOCAB_NAMES, ["a.pdf", "b.pdf"]
    )
    new_wd, removed = out
    assert [p.slug for p in new_wd.phases] == ["gather", "tell"]
    assert [p.phase_index for p in new_wd.phases] == [0, 1]
    assert removed == [{
        "lead": "Removed: use Jira.",
        "reason": "Only your description can add actions, not your attached files.",
    }]


def test_a_connection_with_no_resolvable_name_is_removed_even_if_a_service_is_named():
    from app.services.describe_draft_guards import DescribePowers, remove_unasked_powers

    wd = _wd(_definition(_phase("gather", 0, GATHER), _phase("tell", 1, MCP_SLACK)))
    new_wd, removed = remove_unasked_powers(
        wd, DescribePowers(services=["Slack"]), None, {}, ["a.pdf"]
    )
    assert _types(new_wd) == ["llm_single"]
    assert removed[0]["lead"] == "Removed: use a connected service."


def test_a_described_capability_survives_and_a_ticked_connection_survives():
    from app.services.describe_draft_guards import DescribePowers, remove_unasked_powers

    wd = _wd(_definition(
        _phase("gather", 0, GATHER),
        _phase("email", 1, SEND_EMAIL),
        _phase("ticket", 2, MCP_JIRA),
    ))
    new_wd, removed = remove_unasked_powers(
        wd,
        DescribePowers(external_capabilities=["send_email"]),
        ["conn-jira"],
        VOCAB_NAMES,
        ["a.pdf"],
    )
    assert _types(new_wd) == ["llm_single", "external_action", "external_action"]
    assert removed == []
    assert new_wd is wd  # nothing removed → the draft is returned untouched


def test_power_tools_are_stripped_but_instructions_are_NEVER_touched():
    """D-16 — the guard strips tools, grants and connections, never instruction text."""
    from app.services.describe_draft_guards import DescribePowers, remove_unasked_powers

    research = dict(AGENT_WITH_POWERS, prompt="Research the vendor and summarise in French.")
    wd = _wd(_definition(_phase("research", 0, research)))
    new_wd, removed = remove_unasked_powers(
        wd, DescribePowers(tools=["remember"]), None, {}, ["notes.md"]
    )
    cfg = new_wd.phases[0].config
    assert cfg.available_tools == ["search_documents", "remember"]
    assert cfg.prompt == "Research the vendor and summarise in French."
    assert removed == [{
        "lead": "Removed: web search.",
        "reason": "Only your description can add actions, not notes.md.",
    }]


@pytest.mark.parametrize(
    ("tool", "lead"),
    [
        ("web_search", "Removed: web search."),
        ("save_skill", "Removed: save a skill."),
        ("attach_skill_file", "Removed: attach files to a skill."),
        ("remember", "Removed: remember things."),
    ],
)
def test_the_tool_lead_words(tool, lead):
    from app.services.describe_draft_guards import DescribePowers, remove_unasked_powers

    cfg = {"phase_type": "llm_agent", "prompt": "p", "available_tools": [tool]}
    _, removed = remove_unasked_powers(
        _wd(_definition(_phase("a", 0, cfg))), DescribePowers(), None, {}, ["x.pdf"]
    )
    assert removed[0]["lead"] == lead


@pytest.mark.parametrize(
    ("capability", "lead"),
    [
        ("send_email", "Removed: send email."),
        ("create_ticket", "Removed: create a ticket."),
        ("post_message", "Removed: post a message."),
    ],
)
def test_the_capability_lead_words(capability, lead):
    from app.services.describe_draft_guards import DescribePowers, remove_unasked_powers

    wd = _wd(_definition(
        _phase("gather", 0, GATHER),
        _phase("act", 1, {"phase_type": "external_action", "capability": capability}),
    ))
    _, removed = remove_unasked_powers(wd, DescribePowers(), [], {}, ["x.pdf"])
    assert removed[0]["lead"] == lead


def test_a_removal_that_breaks_the_draft_is_REFUSED_in_words_never_partial():
    """A skip target pointing at a removed step leaves a draft lint refuses → honest refusal."""
    from app.services.describe_draft_guards import DescribePowers, remove_unasked_powers

    gather = _phase("gather", 0, GATHER)
    gather["validators"] = [
        {"kind": "regex_match", "config": {"pattern": "x"}, "on_failure": "skip_to_phase:email"}
    ]
    wd = _wd(_definition(gather, _phase("email", 1, SEND_EMAIL)))
    out = remove_unasked_powers(wd, DescribePowers(), None, {}, ["x.pdf"])
    assert isinstance(out, dict)
    assert out["ok"] is False
    assert "definition" not in out
    assert "readiness" not in out
    assert isinstance(out["detail"], str) and out["detail"]


def test_a_draft_that_is_ONLY_a_planted_step_is_refused():
    from app.services.describe_draft_guards import DescribePowers, remove_unasked_powers

    out = remove_unasked_powers(
        _wd(_definition(_phase("email", 0, SEND_EMAIL))), DescribePowers(), None, {}, ["x.pdf"]
    )
    assert isinstance(out, dict) and out["ok"] is False


# ── tick predicate parity with _check_allowed_connections (NO-FILE PATH ONLY) ─────────────

PARITY_CASES = [
    # (allowed, vocabulary, external config)
    ([], {}, MCP_JIRA),
    ([], {}, SEND_EMAIL),
    (["conn-other"], {}, MCP_JIRA),
    (["conn-jira"], {"conn-jira": {"actions": None}}, MCP_JIRA),
    (["conn-jira"], {"conn-jira": {"actions": ["create_issue"]}}, MCP_JIRA),
    (["conn-jira"], {"conn-jira": {"actions": ["delete_issue"]}}, MCP_JIRA),
    (["conn-jira"], {}, SEND_EMAIL),
    (
        ["conn-slack"],
        {"conn-slack": {"actions": ["post_message"]}},
        {"phase_type": "external_action", "capability": "post_message", "connection_id": "conn-slack"},
    ),
]


@pytest.mark.parametrize(("allowed", "vocabulary", "config"), PARITY_CASES)
def test_tick_predicate_matches_check_allowed_connections(allowed, vocabulary, config):
    """Parity holds ONLY for the no-file path's non-None list. With files attached, None means
    "no ticks", never "no check" — the None row is asserted separately below."""
    from app.services.describe_draft_guards import _tick_allows
    from app.services.workflow_authoring import _check_allowed_connections

    wd = _wd(_definition(_phase("gather", 0, GATHER), _phase("act", 1, config)))
    shipped_accepts = _check_allowed_connections(wd, allowed, vocabulary) is None
    assert _tick_allows(wd.phases[1].config, allowed, vocabulary) is shipped_accepts


def test_the_None_row_DIFFERS_on_purpose():
    from app.services.describe_draft_guards import DescribePowers, remove_unasked_powers
    from app.services.workflow_authoring import _check_allowed_connections

    wd = _wd(_definition(_phase("gather", 0, GATHER), _phase("ticket", 1, MCP_JIRA)))
    assert _check_allowed_connections(wd, None, {}) is None  # no-file path: no check
    new_wd, removed = remove_unasked_powers(wd, DescribePowers(), None, VOCAB_NAMES, ["a.pdf"])
    assert _types(new_wd) == ["llm_single"] and len(removed) == 1  # files: None == []


def test_describe_powers_schema_is_closed():
    from pydantic import ValidationError

    from app.services.describe_draft_guards import DESCRIBE_POWERS_TOOL, DescribePowers

    with pytest.raises(ValidationError):
        DescribePowers(external_capabilities=["wire_money"])
    with pytest.raises(ValidationError):
        DescribePowers(tools=["execute_code"])
    with pytest.raises(ValidationError):
        DescribePowers(services=["x"] * 11)
    assert DESCRIBE_POWERS_TOOL["function"]["name"] == "emit_describe_powers"
    assert "properties" in DESCRIBE_POWERS_TOOL["function"]["parameters"]
