"""Phase 214-13 Task 3 (STEP-06 / D-214-20 / D-214-21) — the describe door's vocabulary,
ENFORCED on the emitted definition rather than merely prompted.

WHY THIS FILE EXISTS, IN THE MODULE'S OWN WORDS. ``workflow_authoring.py`` records, about its
own interactive-step clause, that *"a prompt clause reduces how often the model composes such
a step; it can never guarantee absence, so nothing downstream may be relaxed on the strength
of these words."* **D-214-20 claims STRUCTURAL IMPOSSIBILITY, and a prompt cannot deliver
that.** So the cases below drive a model that emits an out-of-vocabulary step ANYWAY, and
assert the SERVER refuses it — which is the half that makes the claim true.

⚠ THE ABSENT ARM AND THE EMPTY ARM ARE DIFFERENT FACTS, and two cases hold them apart over a
BYTE-IDENTICAL definition: ``None`` is *no preference* and must behave exactly as it did
before this phase; ``[]`` is the author's DECISION that no external step may be emitted at all.

CONVENTION: the ``test_187_authoring_step_names.py`` harness, reused rather than reinvented —
``forced_emit`` patched on the module it is imported FROM, the grounding accessors stubbed, a
provider name that matches no real provider, and NO network of any kind.
"""

from __future__ import annotations

import copy
import re
from types import SimpleNamespace

import pytest

STUB_SETTINGS = SimpleNamespace(harness_authoring_model="claude-opus-4-8")
STUB_PROVIDER = "stub-provider-not-a-real-one"

DESCRIBE = "Write a renewal brief every quarter and tell the team."


def _definition_with_external_action(
    connection_id: str | None = "conn-slack",
    tool_name: str | None = "post_message",
) -> dict:
    """A valid definition whose SECOND phase acts outside the app.

    Built as the thing the model EMITTED, so every case below is about what the server does
    with a composition nobody asked it for.
    """
    config: dict = {"phase_type": "external_action", "capability": "post_message"}
    if connection_id is not None:
        config["connection_id"] = connection_id
    if tool_name is not None:
        config["tool_name"] = tool_name
    return {
        "slug": "renewal-brief",
        "version": 1,
        "name": "Renewal Brief",
        "status": "draft",
        "phases": [
            {
                "slug": "gather",
                "phase_index": 0,
                "name": "Pull the renewal history",
                "config": {"phase_type": "llm_single", "prompt": "Pull the history."},
                "validators": [],
            },
            {
                "slug": "tell-the-team",
                "phase_index": 1,
                "name": "Tell the team",
                "config": config,
                "validators": [],
            },
        ],
    }


def _definition_without_external_action() -> dict:
    return {
        "slug": "renewal-brief",
        "version": 1,
        "name": "Renewal Brief",
        "status": "draft",
        "phases": [
            {
                "slug": "gather",
                "phase_index": 0,
                "name": "Pull the renewal history",
                "config": {"phase_type": "llm_single", "prompt": "Pull the history."},
                "validators": [],
            },
        ],
    }


def _wd(definition_dict: dict):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(copy.deepcopy(definition_dict))


def _patch_grounding(monkeypatch):
    import app.services.workflow_authoring as wa

    async def _fake_assemble(**_kwargs):
        return ("GROUNDED", set(), set())

    monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)

    async def _fake_fidelity(*_args, **_kwargs):
        return None

    monkeypatch.setattr(wa, "_check_grounding_fidelity", _fake_fidelity)


def _patch_vocabulary(monkeypatch, vocabulary: dict):
    """Stub the SERVER-SIDE vocabulary resolve.

    ⚠ Stubbed at the module boundary rather than by faking a Supabase client, for the reason
    ``_patch_grounding`` is: the resolve performs org-scoped reads, and this file's whole
    contract is that it touches no network and no DB. What is under test here is the RULE
    applied to the emitted definition — the resolver itself has its own two cases at the end.
    """
    import app.services.workflow_authoring as wa

    async def _fake_resolve(**_kwargs):
        return vocabulary

    monkeypatch.setattr(wa, "_resolve_allowed_vocabulary", _fake_resolve)


def _patch_provider(monkeypatch):
    import app.config as cfg

    monkeypatch.setattr(
        cfg,
        "get_model_capability",
        lambda model: {"forced_emission": True, "provider": STUB_PROVIDER},
    )


def _patch_user_settings(monkeypatch):
    import app.models.user_settings as us

    monkeypatch.setattr(
        us, "load_user_settings", lambda _uid: SimpleNamespace(active_provider=STUB_PROVIDER)
    )


def _patch_emit(monkeypatch, responses: list[dict]) -> list[dict]:
    import app.services.forced_emit as fe

    calls: list[dict] = []

    async def _fake_forced_emit(**kwargs):
        calls.append(kwargs)
        idx = min(len(calls) - 1, len(responses) - 1)
        return responses[idx]

    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)
    return calls


async def _generate(**overrides):
    import app.services.workflow_authoring as wa

    kwargs = {
        "describe": DESCRIBE,
        "supabase": object(),
        "user_id": "u1",
        "settings": STUB_SETTINGS,
    }
    kwargs.update(overrides)
    return await wa.generate_workflow_definition(**kwargs)


def _arm(monkeypatch, definition: dict, vocabulary: dict | None = None) -> list[dict]:
    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    _patch_vocabulary(monkeypatch, vocabulary or {})
    return _patch_emit(monkeypatch, [{"emitted": _wd(definition)}])


# ── THE ENFORCEMENT — the half that makes D-214-20's claim true ─────────────────────────


@pytest.mark.asyncio
async def test_an_external_action_on_an_unpicked_connection_is_refused(monkeypatch):
    """The model composed a step on a connection the author never ticked."""
    _arm(
        monkeypatch,
        _definition_with_external_action(connection_id="conn-slack"),
        vocabulary={"conn-jira": {"actions": ["create_ticket"]}},
    )
    result = await _generate(allowed_connection_ids=["conn-jira"])

    assert result["ok"] is False
    assert result["error"] == "connection_not_allowed"
    # ⚠ A FAILURE NEVER CARRIES A RUNNABLE OR PARTIAL DRAFT (REQ-2 c, D-214-21). A draft
    # containing a hole is a draft that can be PUBLISHED if the hole is missed.
    assert "definition" not in result
    assert "readiness" not in result
    # The sentence names the step the author will recognise on the canvas.
    assert "tell-the-team" in result["detail"]


@pytest.mark.asyncio
async def test_a_picked_connection_with_an_UNGRANTED_tool_is_refused(monkeypatch):
    """⭐ THE GRANT GRAIN, NOT THE DISCOVERY GRAIN — why STEP-06 depends on Phase 213.

    The connection IS ticked. The tool is not granted on it, so the executor's gate 5.5 would
    refuse the send — which is exactly *"an invented step that validates and fails at 03:00."*
    """
    _arm(
        monkeypatch,
        _definition_with_external_action(connection_id="conn-slack", tool_name="delete_channel"),
        vocabulary={"conn-slack": {"actions": ["post_message"]}},
    )
    result = await _generate(allowed_connection_ids=["conn-slack"])

    assert result["ok"] is False
    assert result["error"] == "connection_not_allowed"
    assert "definition" not in result


@pytest.mark.asyncio
async def test_a_picked_connection_with_a_GRANTED_tool_is_allowed(monkeypatch):
    """POSITIVE CONTROL — without it every refusal above could be an unconditional block."""
    _arm(
        monkeypatch,
        _definition_with_external_action(connection_id="conn-slack", tool_name="post_message"),
        vocabulary={"conn-slack": {"actions": ["post_message", "read_channel"]}},
    )
    result = await _generate(allowed_connection_ids=["conn-slack"])

    assert result["ok"] is True
    assert result["definition"]["phases"][1]["config"]["phase_type"] == "external_action"


# ── ABSENT vs EMPTY — the two arms, held apart over ONE definition ──────────────────────


@pytest.mark.asyncio
async def test_an_empty_allowed_list_refuses_ANY_external_action(monkeypatch):
    """`[]` is a DECISION: the author ticked nothing, so no external step may be emitted."""
    _arm(monkeypatch, _definition_with_external_action(), vocabulary={})
    result = await _generate(allowed_connection_ids=[])

    assert result["ok"] is False
    assert result["error"] == "connection_not_allowed"
    assert "definition" not in result


@pytest.mark.asyncio
async def test_an_empty_allowed_list_still_permits_a_workflow_with_no_external_step(monkeypatch):
    """…and it forbids the STEP, not the workflow. A workflow with no external step is
    perfectly legitimate — sketch 217 §3's own reason for the precedence rule."""
    _arm(monkeypatch, _definition_without_external_action(), vocabulary={})
    result = await _generate(allowed_connection_ids=[])

    assert result["ok"] is True


@pytest.mark.asyncio
async def test_absent_allowed_list_is_TODAYS_behaviour_exactly(monkeypatch):
    """CHARACTERIZATION — `None` is *no preference* and constrains nothing.

    ⚠ THIS IS THE CASE THAT FAILS IF ANYONE WRITES `allowed_connection_ids or []`. The
    definition here is BYTE-IDENTICAL to the one the empty-list case above REFUSES, so the two
    together prove the arms are distinguished rather than merely documented.
    """
    _arm(monkeypatch, _definition_with_external_action(), vocabulary={})
    result = await _generate()  # the parameter is not passed at all

    assert result["ok"] is True
    assert result["definition"]["phases"][1]["config"]["connection_id"] == "conn-slack"


def test_the_two_arms_never_collapse_in_the_source():
    """The mechanical half of the case above, swept over the module's own text.

    ⚠ ANCHORED ON THE COLLAPSING EXPRESSIONS THEMSELVES, and the docblocks in that module
    deliberately do NOT spell either form — the 187-24 trap, which fired on this very field
    earlier in this phase.
    """
    from pathlib import Path

    import app.services.workflow_authoring as wa

    source = Path(wa.__file__).read_text(encoding="utf-8")
    for collapse in ("allowed_connection_ids or None", "allowed_connection_ids or []"):
        assert collapse not in source, collapse
    # POSITIVE CONTROL — the needle shape can match.
    assert "allowed_connection_ids or None" in "x = allowed_connection_ids or None"
    # …and the source really was read.
    assert len(source) > 5000


def test_the_route_forwards_the_field_without_collapsing_it():
    """The same sweep one hop up. A collapse in the ROUTE would be invisible to every case
    above, which only ever calls the service directly."""
    from pathlib import Path

    import app.api.workflows as wf

    source = Path(wf.__file__).read_text(encoding="utf-8")
    assert "allowed_connection_ids=body.allowed_connection_ids," in source
    for collapse in ("body.allowed_connection_ids or None", "body.allowed_connection_ids or []"):
        assert collapse not in source, collapse
    # The request model declares BOTH arms as representable — `list[str] | None`.
    assert "allowed_connection_ids: list[str] | None = None" in source


# ── THE PROMPT HALF — present, measured, and NOT a nudge ────────────────────────────────


def _bullet_lengths() -> list[int]:
    """The seven phase-type bullets, extracted from the literal rather than re-typed."""
    from app.services.workflow_authoring import AUTHORING_SYSTEM_PROMPT

    block = AUTHORING_SYSTEM_PROMPT.split("The 7 phase types you can compose")[1]
    block = block.split("DELIVERABLE RULE")[0]
    return [len(line) for line in block.split("\n") if line.startswith("- ")]


def test_the_seven_phase_type_bullets_are_BYTE_UNCHANGED():
    """The vocabulary block is its OWN paragraph and touches no bullet.

    An over-long bullet is a NUDGE, and a nudge in a generator prompt skews composition toward
    the type it describes — this module records `BUG-260815-01` measuring exactly that, 2 for 2.
    """
    from app.services.workflow_authoring import AUTHORING_SYSTEM_PROMPT

    for bullet in (
        "- programmatic: a deterministic registered function (`fn`); no LLM.\n",
        "- llm_single: one LLM completion with a `prompt` (no tools).\n",
        "- llm_agent: an autonomous agent with a `prompt` and an `available_tools` whitelist.\n",
        "- llm_batch_agents: a fan-out of parallel agents over a `prompt` + `available_tools`.\n",
        "- llm_human_input: PAUSE and ask the human (`prompt`, optional `options`).\n",
        "- llm_emit: a sealed forced emission that produces a typed deliverable (`emitter`).\n",
        "- external_action: acts outside the app (`capability`); always asks approval, "
        "records rather than sends.\n",
    ):
        assert bullet in AUTHORING_SYSTEM_PROMPT, bullet
    # …and there are still exactly SEVEN of them, so an eighth cannot arrive unremarked.
    assert len(_bullet_lengths()) == 7, _bullet_lengths()


def test_the_vocabulary_blocks_length_is_RE_DERIVED_not_trusted():
    """⚠ THE COMMENT IN THAT MODULE ROTS AND THIS DOES NOT.

    The module records the two frames' lengths in a comment. Both are RE-DERIVED here from the
    literals, so a future edit that grows one into a nudge fails loudly rather than leaving a
    comment that quietly reads false — which that module has recorded happening to it once
    already (the WR-06 correction on the anti-echo control).

    ⚠ IT FIRED IN THE COMMIT THAT AUTHORED IT, WHICH IS WHY THE FIGURE BELOW IS TRUSTWORTHY.
    The module's comment was hand-written as **178** for the forbid frame; this case measured
    **237** on its first run and the comment was corrected to match. A hand-counted constant was
    wrong within minutes of being written — recorded here rather than quietly fixed, because it
    is the whole argument for re-deriving instead of asserting.
    """
    from app.services.workflow_authoring import (
        _VOCABULARY_ALLOWED_FRAME,
        _VOCABULARY_FORBIDDEN_FRAME,
    )

    allowed_len = len(_VOCABULARY_ALLOWED_FRAME)
    forbidden_len = len(_VOCABULARY_FORBIDDEN_FRAME)
    assert allowed_len == 236, allowed_len
    assert forbidden_len == 237, forbidden_len

    # PROPORTIONALITY, against the baseline that means something. The comparison is the
    # DELIVERABLE RULE block these sit beside — never the phase-type bullet median, a
    # distinction that module's own D-11 note makes explicitly.
    bullets = _bullet_lengths()
    median = sorted(bullets)[len(bullets) // 2]
    assert allowed_len > median  # they are paragraphs, not bullets
    assert allowed_len < 1202  # …and well under the block they neighbour
    assert forbidden_len < 1202


def test_the_vocabulary_block_renders_the_ticked_services_and_their_GRANTED_actions():
    from app.services.workflow_authoring import _render_vocabulary_block

    rendered = _render_vocabulary_block(
        {"conn-slack": {"name": "Acme Slack", "service_id": "slack", "actions": ["post_message"]}}
    )
    assert "conn-slack" in rendered
    assert "Acme Slack" in rendered
    assert "post_message" in rendered
    # It names the CONSTRAINT, not merely the list — a list with no rule is decoration.
    assert "ONLY" in rendered


def test_an_empty_vocabulary_renders_the_FORBID_frame_not_an_empty_list():
    """⚠ AN EMPTY LIST AND A PROHIBITION ARE DIFFERENT STATEMENTS TO A MODEL. Rendering
    *"connected services:"* followed by nothing invites the model to fill the gap."""
    from app.services.workflow_authoring import _render_vocabulary_block

    rendered = _render_vocabulary_block({})
    assert "Do NOT compose an `external_action` phase" in rendered
    assert "id `" not in rendered


@pytest.mark.asyncio
async def test_the_ABSENT_arm_adds_NOTHING_to_the_prompt(monkeypatch):
    """The unconstrained path's message is byte-identical to the pre-214 one."""
    calls = _arm(monkeypatch, _definition_without_external_action(), vocabulary={})
    await _generate()

    content = calls[0]["messages"][0]["content"]
    assert content == "GROUNDED\n\n## The task to author\n" + DESCRIBE


@pytest.mark.asyncio
async def test_the_CONSTRAINED_arm_carries_the_block_before_the_task(monkeypatch):
    calls = _arm(
        monkeypatch,
        _definition_without_external_action(),
        vocabulary={
            "conn-slack": {
                "name": "Acme Slack",
                "service_id": "slack",
                "actions": ["post_message"],
            }
        },
    )
    await _generate(allowed_connection_ids=["conn-slack"])

    content = calls[0]["messages"][0]["content"]
    assert "CONNECTED SERVICES" in content
    # The block sits BEFORE the task, in its own paragraph, and the task text is untouched.
    assert content.index("CONNECTED SERVICES") < content.index("## The task to author")
    assert re.search(r"\n\n## The task to author\n", content)
    assert content.endswith(DESCRIBE)


@pytest.mark.asyncio
async def test_an_empty_TICK_still_tells_the_model_not_to_compose_one(monkeypatch):
    """`[]` reaches the model as a PROHIBITION, and the enforcement backs it up."""
    calls = _arm(monkeypatch, _definition_without_external_action(), vocabulary={})
    await _generate(allowed_connection_ids=[])

    assert "Do NOT compose an `external_action` phase" in calls[0]["messages"][0]["content"]


@pytest.mark.asyncio
async def test_the_PROVIDER_CALL_BUDGET_is_unchanged_by_the_vocabulary(monkeypatch):
    """REQ-2 a/b — EXACTLY one call on a valid first emit. The vocabulary is a prompt
    paragraph plus a post-emit walk; neither may add a shot."""
    calls = _arm(
        monkeypatch,
        _definition_with_external_action(),
        vocabulary={"conn-slack": {"actions": ["post_message"]}},
    )
    await _generate(allowed_connection_ids=["conn-slack"])
    assert len(calls) == 1

    # …and a REFUSAL does not retry either: the model emitted VALIDLY, so there is nothing to
    # re-ask for. A retry here would spend a second provider call to be refused again.
    calls2 = _arm(monkeypatch, _definition_with_external_action(), vocabulary={})
    result = await _generate(allowed_connection_ids=[])
    assert result["ok"] is False
    assert len(calls2) == 1


# ── FAIL-CLOSED — an unreadable set NARROWS, never widens ───────────────────────────────


@pytest.mark.asyncio
async def test_the_real_resolver_swallows_a_read_failure_and_returns_an_EMPTY_vocabulary(
    monkeypatch,
):
    """An unreadable permission set must never read as *permitted*.

    The resolver logs and returns `{}`; the enforcement then turns that into a refusal, so a
    transient org-read failure costs the author a draft rather than costing them a workflow
    that acts on a service nobody could confirm they had.
    """
    import app.utils.folder_utils as fu
    import app.services.workflow_authoring as wa

    async def _boom(*_args, **_kwargs):
        raise RuntimeError("org read failed")

    monkeypatch.setattr(fu, "_resolve_caller_org_ids", _boom)

    vocabulary = await wa._resolve_allowed_vocabulary(
        supabase=object(), user_id="u1", allowed_connection_ids=["conn-slack"]
    )
    assert vocabulary == {}


@pytest.mark.asyncio
async def test_the_real_resolver_does_NO_read_when_nothing_was_ticked():
    """`[]` and `None` both mean *there is nothing to look up*, so neither costs a round trip.
    `[]`'s refusal is decided by the enforcement, never by an empty read."""
    import app.services.workflow_authoring as wa

    assert (
        await wa._resolve_allowed_vocabulary(
            supabase=object(), user_id="u1", allowed_connection_ids=[]
        )
        == {}
    )
    assert (
        await wa._resolve_allowed_vocabulary(
            supabase=object(), user_id="u1", allowed_connection_ids=None
        )
        == {}
    )


@pytest.mark.asyncio
async def test_the_real_resolver_reads_the_GRANT_predicate_from_its_ONE_home(monkeypatch):
    """⭐ `is_tool_allowed` is the EXECUTOR's own predicate (gate 5.5's), not a copy.

    Two copies of one permission rule is the failure D-214-00 exists to prevent, so this drives
    the resolver against a connection whose three actions have three different postures and
    asserts only the `allow` one survives — the same answer the gate would give.
    """
    import app.services.connector_service as cs
    import app.utils.folder_utils as fu
    import app.services.workflow_authoring as wa

    async def _orgs(*_args, **_kwargs):
        return {"org-1"}

    connection = SimpleNamespace(
        id="conn-slack",
        name="Acme Slack",
        service_id="slack",
        capability=None,
        discovered_tools=[
            {"name": "post_message"},
            {"name": "read_channel"},
            {"name": "delete_channel"},
        ],
        tool_grants={"post_message": "allow", "read_channel": "ask", "delete_channel": "deny"},
        default_approval_posture="ask",
    )

    async def _list(**_kwargs):
        return [connection]

    monkeypatch.setattr(fu, "_resolve_caller_org_ids", _orgs)
    monkeypatch.setattr(cs, "list_connections", _list)

    vocabulary = await wa._resolve_allowed_vocabulary(
        supabase=object(), user_id="u1", allowed_connection_ids=["conn-slack"]
    )
    assert vocabulary["conn-slack"]["actions"] == ["post_message"]
    assert vocabulary["conn-slack"]["service_id"] == "slack"


@pytest.mark.asyncio
async def test_the_real_resolver_drops_a_connection_the_author_did_not_tick(monkeypatch):
    """An id outside the ticked set never enters the vocabulary — and neither does one the
    caller's org does not own, because the read is org-scoped in the first place."""
    import app.services.connector_service as cs
    import app.utils.folder_utils as fu
    import app.services.workflow_authoring as wa

    async def _orgs(*_args, **_kwargs):
        return {"org-1"}

    async def _list(**_kwargs):
        return [
            SimpleNamespace(
                id="conn-jira",
                name="Acme Jira",
                service_id="jira",
                capability="create_ticket",
                discovered_tools=[],
                tool_grants={"create_ticket": "allow"},
                default_approval_posture="ask",
            )
        ]

    monkeypatch.setattr(fu, "_resolve_caller_org_ids", _orgs)
    monkeypatch.setattr(cs, "list_connections", _list)

    vocabulary = await wa._resolve_allowed_vocabulary(
        supabase=object(), user_id="u1", allowed_connection_ids=["conn-slack"]
    )
    assert vocabulary == {}
