"""A first-party service advertises MANY actions — and each one is real, granted and honest.

⚠ **THE DEFECT THESE PIN WAS FOUND BY THE OPERATOR, NOT BY A TEST.** Driving chat after Phase
216 they asked for a Jira ticket and were told *"there is no JIRA integration"* on an install
whose Jira connection was enabled, credentialled and working. Measured on the real rows that
day: GitHub 44 tools, DeepWiki 3, and Slack / Jira / Email one each.

The two halves this file fences are the two that were wrong:

  1. **ADVERTISEMENT** — a service's descriptor list is its whole action set, not its one verb.
  2. **HONESTY** — a failed call reads as a failure. The shipped dispatcher answered
     ``f"Executed {tool} on {name} with result/note: {exc}"`` for every exception, so an
     expired token and a 404 both reached the model as completed actions.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.connectors.descriptors import static_descriptors_for_capability
from app.services.connectors.service_tools import (
    SERVICE_TOOL_SPECS,
    ServiceToolError,
    execute_service_tool,
    extra_descriptors_for_service,
    spec_for,
)


# ── 1 · THE ADVERTISEMENT ─────────────────────────────────────────────────────


def test_a_service_advertises_more_than_its_capability_verb():
    """The whole point. Before this, every one of these lists had length 1."""
    assert len(static_descriptors_for_capability("post_message", "slack")) > 1
    assert len(static_descriptors_for_capability("create_ticket", "jira")) > 1


def test_the_capability_descriptor_is_always_first_and_always_present():
    """It is the row's IDENTITY — the grant key every bound workflow step already carries and
    the one action with a first-party adapter behind it. A service list that displaced it
    would break every published step that names it."""
    assert static_descriptors_for_capability("post_message", "slack")[0]["name"] == "post_message"
    assert static_descriptors_for_capability("create_ticket", "jira")[0]["name"] == "create_ticket"
    assert static_descriptors_for_capability("send_email", "smtp")[0]["name"] == "send_email"


def test_the_no_service_arm_is_byte_identical_to_what_it_returned_before():
    """⚠ ADDING AN ARGUMENT MUST NOT CHANGE THE ANSWER TO THE QUESTION ALREADY BEING ASKED.

    Callers that genuinely hold only a capability still exist, and they must get exactly the
    one-element list they got before — not a shorter version of the new one, and not an
    empty list because a lookup missed.
    """
    for capability in ("post_message", "create_ticket", "send_email"):
        assert static_descriptors_for_capability(capability) == [
            static_descriptors_for_capability(capability)[0]
        ]
        assert len(static_descriptors_for_capability(capability)) == 1


def test_smtp_advertises_exactly_one_action_and_that_is_an_answer():
    """⚠ NOT AN OVERSIGHT — SMTP is a one-way submission protocol. It can send a message and
    it can do nothing else, so a second tool here would be a row on a grant list that no code
    can perform. Reading a mailbox is IMAP or a vendor API against a different host: a new
    egress key and a different connection, not a tool on this one."""
    assert SERVICE_TOOL_SPECS["smtp"] == []
    assert len(static_descriptors_for_capability("send_email", "smtp")) == 1


def test_a_descriptor_carries_the_four_sanitized_keys_and_no_plumbing():
    """``discovered_tools`` is read by pickers, grant lists and the chat tool builder. None of
    them has any business seeing a URL path, and a leaked ``api_method`` would eventually be
    rendered to a person as if it were part of the tool's contract."""
    for service in ("slack", "jira"):
        for descriptor in extra_descriptors_for_service(service):
            assert set(descriptor) == {
                "name", "title", "description", "inputSchema", "annotations",
            }
            assert descriptor["title"] and descriptor["description"]
            assert descriptor["inputSchema"]["type"] == "object"
            assert isinstance(descriptor["annotations"]["readOnlyHint"], bool)


def test_a_read_is_marked_as_a_read_and_a_write_is_not():
    """The grant list renders "ONLY READS" from `readOnlyHint === true` and
    "does not say whether this action only reads" from its ABSENCE. Before this the
    first-party rows all showed the second sentence, which was true of a remote server
    and never true of an action authored in this tree.

    ⚠ It widens nothing: no gate reads the hint, and every action still arrives ungranted.
    """
    by_name = {d["name"]: d for d in extra_descriptors_for_service("slack")}
    assert by_name["list_channels"]["annotations"]["readOnlyHint"] is True
    assert by_name["read_channel"]["annotations"]["readOnlyHint"] is True
    assert by_name["post_message_to_channel"]["annotations"]["readOnlyHint"] is False

    jira = {d["name"]: d for d in extra_descriptors_for_service("jira")}
    assert jira["search_issues"]["annotations"]["readOnlyHint"] is True
    assert jira["add_comment"]["annotations"]["readOnlyHint"] is False

    # And the capability verbs, so the list is not honest in only half its rows. Every
    # capability in the closed set SENDS something, so none of them only reads.
    for capability in ("post_message", "create_ticket", "send_email"):
        annotations = static_descriptors_for_capability(capability)[0]["annotations"]
        assert annotations["readOnlyHint"] is False


def test_every_spec_hangs_off_an_existing_capability_and_adds_no_verb():
    """⚠ THE ROADMAP'S STANDING INSTRUCTION IS *"do not add a fifth verb"*. The capability set
    is CLOSED and spelled in four places held in agreement by two module-scope asserts; a spec
    naming a capability outside it would also name an egress allow-list key that does not
    exist, and the binder would refuse at the socket rather than here."""
    from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

    for service, specs in SERVICE_TOOL_SPECS.items():
        for spec in specs:
            assert spec["capability"] in EXTERNAL_ACTION_CAPABILITIES, (service, spec["name"])


def test_no_spec_reaches_a_host_outside_the_existing_allow_list():
    """The egress surface is UNCHANGED by this feature, and that is the security claim.

    ``ALLOWED_HOST_SUFFIXES`` is keyed by capability, so a tool that inherits its capability
    inherits its allow-list entry. This asserts the inheritance rather than the hosts, because
    the hosts are the allow-list's fact to state and duplicating them here would create a
    second spelling nothing holds in agreement.
    """
    from app.security.egress import ALLOWED_HOST_SUFFIXES

    for specs in SERVICE_TOOL_SPECS.values():
        for spec in specs:
            assert spec["capability"] in ALLOWED_HOST_SUFFIXES, spec["name"]


def test_names_are_unique_within_a_service():
    """A duplicate name is a grant key that means two things, and the second one silently
    wins whichever way the list is iterated."""
    for service, specs in SERVICE_TOOL_SPECS.items():
        names = [spec["name"] for spec in specs]
        assert len(names) == len(set(names)), service


def test_a_service_spec_can_never_shadow_the_capability_descriptor():
    """The capability descriptor's ``inputSchema`` is DERIVED from the adapter that will
    actually run it. A same-named spec could therefore only ever disagree with the code, so
    the collision is resolved in the adapter's favour rather than left to list order."""
    slack = static_descriptors_for_capability("post_message", "slack")
    assert [d["name"] for d in slack].count("post_message") == 1


# ── 2 · ARGUMENTS ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_missing_required_argument_is_refused_before_any_socket_opens():
    with pytest.raises(ServiceToolError) as exc:
        await execute_service_tool("slack", "read_channel", {}, secret="x", config={})
    assert "channel" in str(exc.value)


@pytest.mark.asyncio
async def test_an_undeclared_argument_is_refused_rather_than_dropped():
    """Silently dropping an undeclared key is how an argument comes to LOOK supported — the
    Slack adapter states this at length about its own schema, and every tool inherits it."""
    with pytest.raises(ServiceToolError) as exc:
        await execute_service_tool(
            "slack", "list_channels", {"blocks": "[]"}, secret="x", config={}
        )
    assert "blocks" in str(exc.value)


@pytest.mark.asyncio
async def test_an_unknown_tool_names_itself_rather_than_failing_vaguely():
    with pytest.raises(ServiceToolError) as exc:
        await execute_service_tool("slack", "delete_workspace", {}, secret="x", config={})
    assert "delete_workspace" in str(exc.value)


@pytest.mark.asyncio
async def test_a_jira_issue_key_is_validated_by_shape_not_escaped():
    """⚠ REFUSAL, NOT ESCAPING, AND DELIBERATELY SO. No module under ``services/connectors/``
    may import ``urllib`` — the source fence bans every transport import at line start — so
    percent-encoding is unavailable and hand-rolling it would be worse than either. A value
    that MUST match ``ABC-123`` cannot carry a slash, a dot-segment, a query or a scheme, so
    there is nothing left to escape."""
    for hostile in ("../../admin", "KAN-1/comment?x=1", "KAN 1", "https://evil.test"):
        with pytest.raises(ServiceToolError) as exc:
            await execute_service_tool(
                "jira",
                "get_issue",
                {"issue_key": hostile},
                secret="x",
                config={"base_url": "https://acme.atlassian.net", "account_email": "a@b.c"},
            )
        assert "issue key" in str(exc.value).lower(), hostile


@pytest.mark.asyncio
async def test_a_jira_connection_with_no_base_url_says_so_rather_than_sending_nowhere():
    with pytest.raises(ServiceToolError) as exc:
        await execute_service_tool(
            "jira", "list_projects", {}, secret="x", config={"account_email": "a@b.c"}
        )
    assert "base_url" in str(exc.value)


# ── 3 · THE VENDOR'S OWN VERDICT ──────────────────────────────────────────────


def _slack_reply(status: int, body: str):
    return SimpleNamespace(status_code=status, body=body)


@pytest.mark.asyncio
async def test_slack_ok_false_is_a_refusal_even_on_http_200(monkeypatch):
    """⭐ Slack answers HTTP 200 with ``{"ok": false}`` for a call it did not perform. Reading
    the status code alone is exactly how a tool comes to report success for nothing."""
    monkeypatch.setattr(
        "app.services.connectors.slack_adapter.call_web_api",
        AsyncMock(return_value=_slack_reply(200, '{"ok": false, "error": "invalid_auth"}')),
    )
    with pytest.raises(ServiceToolError) as exc:
        await execute_service_tool("slack", "list_channels", {}, secret="x", config={})
    assert "invalid_auth" in str(exc.value)


@pytest.mark.asyncio
async def test_the_string_false_does_not_read_as_true(monkeypatch):
    """``{"ok": "false"}`` is a NON-EMPTY STRING and every truthiness test in Python says yes
    to it. The gate is ``is True`` for exactly this case."""
    monkeypatch.setattr(
        "app.services.connectors.slack_adapter.call_web_api",
        AsyncMock(return_value=_slack_reply(200, '{"ok": "false"}')),
    )
    with pytest.raises(ServiceToolError):
        await execute_service_tool("slack", "list_channels", {}, secret="x", config={})


@pytest.mark.asyncio
async def test_a_slack_read_returns_the_few_fields_and_not_the_whole_envelope(monkeypatch):
    """⚠ NOT COSMETIC. This result goes into a MODEL'S CONTEXT, and ``users.list`` carries a
    full profile per person including image URLs in a dozen sizes — tens of thousands of
    tokens of noise, paid for again on every subsequent turn."""
    monkeypatch.setattr(
        "app.services.connectors.slack_adapter.call_web_api",
        AsyncMock(return_value=_slack_reply(
            200,
            '{"ok": true, "members": [{"id": "U1", "name": "ana", "profile": '
            '{"email": "ana@acme.test", "image_512": "https://cdn.test/a.png", '
            '"real_name": "Ana"}, "is_bot": false}]}',
        )),
    )
    result = await execute_service_tool("slack", "list_users", {}, secret="x", config={})
    assert result["users"][0]["email"] == "ana@acme.test"
    assert result["users"][0]["real_name"] == "Ana"
    assert "image_512" not in str(result)


@pytest.mark.asyncio
async def test_a_model_supplied_limit_is_clamped_rather_than_refused(monkeypatch):
    """A MODEL supplies these, and a model will supply 100000. A limit is a preference, not a
    fact, so failing a whole read over one is the less useful answer."""
    seen: dict = {}

    async def _capture(api_method, *, http_method, token, params, json):
        seen.update(params or {})
        return _slack_reply(200, '{"ok": true, "channels": []}')

    monkeypatch.setattr(
        "app.services.connectors.slack_adapter.call_web_api", _capture
    )
    await execute_service_tool(
        "slack", "list_channels", {"limit": 100000}, secret="x", config={}
    )
    assert seen["limit"] == "200"
    # And the default is named rather than left to the vendor, so the answer is the same
    # whether or not the model supplied one.
    assert seen["types"] == "public_channel"


@pytest.mark.asyncio
async def test_a_jira_description_is_flattened_to_the_sentence_somebody_wrote(monkeypatch):
    """Jira v3 returns descriptions as a nested document, so the obvious ``str(description)``
    puts a wall of JSON in the model's context instead of the prose."""
    monkeypatch.setattr(
        "app.security.egress.send_pinned_http",
        AsyncMock(return_value=SimpleNamespace(
            status_code=200,
            body=(
                '{"key": "KAN-12", "fields": {"summary": "Broken", "description": '
                '{"type": "doc", "version": 1, "content": [{"type": "paragraph", '
                '"content": [{"type": "text", "text": "the login page 500s"}]}]}}}'
            ),
        )),
    )
    result = await execute_service_tool(
        "jira",
        "get_issue",
        {"issue_key": "KAN-12"},
        secret="x",
        config={"base_url": "https://acme.atlassian.net", "account_email": "a@b.c"},
    )
    assert result["description"] == "the login page 500s"
    assert result["key"] == "KAN-12"


@pytest.mark.asyncio
async def test_a_jira_comment_is_sent_as_a_document_not_a_bare_string(monkeypatch):
    """⚠ Jira v3 takes Atlassian Document Format. A plain ``{"body": "text"}`` is a 400 the
    caller would read as *"the comment failed"* without ever learning it was the SHAPE."""
    seen: dict = {}

    async def _capture(capability, method, url, **kwargs):
        seen["body"] = kwargs.get("json")
        return SimpleNamespace(status_code=201, body='{"id": "10001"}')

    monkeypatch.setattr("app.security.egress.send_pinned_http", _capture)
    result = await execute_service_tool(
        "jira",
        "add_comment",
        {"issue_key": "KAN-12", "body": "looking at it"},
        secret="x",
        config={"base_url": "https://acme.atlassian.net", "account_email": "a@b.c"},
    )
    assert result["commented"] is True
    assert seen["body"]["body"]["type"] == "doc"
    assert seen["body"]["body"]["content"][0]["content"][0]["text"] == "looking at it"


@pytest.mark.asyncio
async def test_a_jira_error_carries_the_vendors_own_words(monkeypatch):
    monkeypatch.setattr(
        "app.security.egress.send_pinned_http",
        AsyncMock(return_value=SimpleNamespace(
            status_code=404,
            body='{"errorMessages": ["Issue does not exist or you do not have permission"]}',
        )),
    )
    with pytest.raises(ServiceToolError) as exc:
        await execute_service_tool(
            "jira",
            "get_issue",
            {"issue_key": "KAN-99"},
            secret="x",
            config={"base_url": "https://acme.atlassian.net", "account_email": "a@b.c"},
        )
    assert "do not have permission" in str(exc.value)


def test_spec_for_answers_none_rather_than_raising_on_a_miss():
    """The caller is a dispatcher deciding WHICH implementation a tool name belongs to, and
    *"not one of mine"* is an ordinary answer there — the capability verb takes the other
    branch."""
    assert spec_for("slack", "post_message") is None  # the CAPABILITY, not a service tool
    assert spec_for("nosuchservice", "list_channels") is None
    assert spec_for("slack", "list_channels") is not None
