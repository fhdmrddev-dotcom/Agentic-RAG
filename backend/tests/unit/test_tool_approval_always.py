"""2026-08-31 — "Always allow" is TWO acts, and the response tells the truth about both.

⚠ WHAT WAS MISSING. `grantsVocabulary.ts` has carried `ASK_ALWAYS` since Phase 213 and the
settings panel has offered all three postures for just as long, but the chat approval card
shipped with Allow and Reject. So the only way to stop being asked the same question was
to leave the conversation, find the connection in Settings, and change it there — for a
decision the person was already being asked to make, with the arguments in front of them.

⚠ THE TWO ACTS CAN COME APART, AND THAT IS THE WHOLE DESIGN. Releasing a paused call needs
only that the thread is yours. Changing what a connection may do needs `org:manage`. A
member who clicks Always is entitled to the first and not the second — so the call goes
through either way and the response reports the halves SEPARATELY. Answering `ok` for a
setting that did not change is the same class of lie as the dispatcher's old
`Executed {tool} …` string, which reported every failed send as a success.

⚠ AND THE GRANT WRITE IS A READ-MERGE-WRITE, NOT A REPLACE. `update_connection_grants` is
a whole-column replace — correct for the settings form, which owns the entire map. Used
for "always allow this one action" it would wipe every other grant, so `grant_one_tool`
exists and these cases pin it.
"""
from __future__ import annotations

import pytest

from app.models.thread import ToolApprovalDecisionRequest


# ══════════════════════════════════════════════════════════════════════════════════════
# The wire contract
# ══════════════════════════════════════════════════════════════════════════════════════
def test_always_is_a_third_decision_not_a_flag_on_allow():
    req = ToolApprovalDecisionRequest(
        call_id="c1", decision="always",
        connection_id="11111111-1111-1111-1111-111111111111", tool_name="post_message",
    )
    assert req.decision == "always"
    assert str(req.connection_id) == "11111111-1111-1111-1111-111111111111"


def test_allow_and_reject_still_need_neither_connection_nor_tool():
    """The ordinary path must not gain a required field — a run paused before this change
    carries neither, and its Allow button has to keep working."""
    for decision in ("allow", "reject"):
        req = ToolApprovalDecisionRequest(call_id="c1", decision=decision)
        assert req.connection_id is None and req.tool_name is None


def test_an_unknown_decision_is_refused_by_the_model():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        ToolApprovalDecisionRequest(call_id="c1", decision="maybe")


# ══════════════════════════════════════════════════════════════════════════════════════
# grant_one_tool — merges, never replaces
# ══════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_grant_one_tool_MERGES_and_never_wipes_the_other_grants(monkeypatch):
    """⚠ THE FAILURE THIS PREVENTS IS SILENT AND PERMISSION-SHAPED. A caller that sent only
    the one key to `update_connection_grants` — a whole-column REPLACE — would drop every
    other grant on the connection, quietly turning explicit denies back into the default."""
    from app.services import connector_service

    existing = {"post_message": "ask", "read_channel": "deny", "list_users": "allow"}
    captured: dict = {}

    async def _fetch(connection_id, org_id):
        assert org_id == "org-1"
        return {"id": connection_id, "org_id": org_id, "tool_grants": dict(existing)}

    async def _update(connection_id, *, org_id, tool_grants, supabase=None):
        captured["grants"] = tool_grants
        return object()

    monkeypatch.setattr(connector_service, "_fetch_connection_row", _fetch)
    monkeypatch.setattr(connector_service, "update_connection_grants", _update)

    await connector_service.grant_one_tool("conn-9", "org-1", "post_message", "allow")

    assert captured["grants"] == {
        "post_message": "allow",   # the one that changed
        "read_channel": "deny",    # ⭐ an explicit DENY survives
        "list_users": "allow",
    }


@pytest.mark.asyncio
async def test_grant_one_tool_refuses_a_connection_that_is_not_this_org_s(monkeypatch):
    """Org-scoped at the READ, so a connection id from another org is a refusal and never
    a write — the client supplies that id, so it can never be trusted on its own."""
    from app.services import connector_service

    async def _fetch(connection_id, org_id):
        return None

    async def _must_not_update(*_a, **_k):
        raise AssertionError("no write may follow a failed ownership read")

    monkeypatch.setattr(connector_service, "_fetch_connection_row", _fetch)
    monkeypatch.setattr(connector_service, "update_connection_grants", _must_not_update)

    with pytest.raises(connector_service.ConnectorNotFound):
        await connector_service.grant_one_tool("someone-elses", "org-1", "t", "allow")


@pytest.mark.asyncio
async def test_a_connection_with_no_grants_yet_gains_exactly_one(monkeypatch):
    from app.services import connector_service

    captured: dict = {}

    async def _fetch(connection_id, org_id):
        return {"id": connection_id, "org_id": org_id, "tool_grants": None}

    async def _update(connection_id, *, org_id, tool_grants, supabase=None):
        captured["grants"] = tool_grants
        return object()

    monkeypatch.setattr(connector_service, "_fetch_connection_row", _fetch)
    monkeypatch.setattr(connector_service, "update_connection_grants", _update)
    await connector_service.grant_one_tool("c", "o", "search_files", "allow")
    assert captured["grants"] == {"search_files": "allow"}


# ══════════════════════════════════════════════════════════════════════════════════════
# The emit carries the connection — without it the button cannot exist
# ══════════════════════════════════════════════════════════════════════════════════════
def test_the_approval_event_names_the_CONNECTION_not_only_the_service():
    """⚠ TWO ROWS CAN SHARE A `service_id` — this install has two `slack` connections in
    different orgs. A card that resolved "which connection is this" from the service would
    sometimes write a grant onto the wrong one, which is worse than not offering it."""
    from pathlib import Path

    src = (
        Path(__file__).resolve().parents[2] / "app" / "services" / "tool_dispatcher.py"
    ).read_text(encoding="utf-8")
    emit = src[src.index('"tool_approval_required"'):]
    emit = emit[: emit.index(")")]
    assert "connection_id=" in emit, (
        "the tool_approval_required event must carry connection_id — it is the only way "
        "the chat card can name the row 'Always allow' would change"
    )


def test_the_endpoint_writes_the_grant_BEFORE_releasing_the_run():
    """⚠ ORDER IS LOAD-BEARING. Released first, the loop can reach its NEXT `ask` on the
    same tool while the write is still in flight and pause again on a setting the person
    has already changed — which reads exactly like the button not working."""
    from pathlib import Path

    src = (
        Path(__file__).resolve().parents[2] / "app" / "api" / "threads.py"
    ).read_text(encoding="utf-8")
    body = src[src.index("async def handle_tool_approval"):]
    body = body[: body.index("\n@router.") if "\n@router." in body else len(body)]
    grant_at = body.index("grant_one_tool")
    publish_at = body.index("await redis.publish")
    assert grant_at < publish_at, (
        "the always-allow grant write must precede the pubsub release"
    )


def test_the_endpoint_releases_the_run_even_when_the_grant_fails():
    """A member is entitled to approve a call they are not entitled to re-configure.
    Refusing the whole thing would strand a run over a permission it never needed."""
    from pathlib import Path

    src = (
        Path(__file__).resolve().parents[2] / "app" / "api" / "threads.py"
    ).read_text(encoding="utf-8")
    body = src[src.index("async def handle_tool_approval"):]
    body = body[: body.index("\n@router.") if "\n@router." in body else len(body)]
    # The grant failure sets a problem string; it must not raise, and it must not skip
    # the publish.
    assert "grant_problem =" in body
    assert "raise" not in body.split("if payload.decision == \"always\":")[1].split("approval_channel")[0], (
        "a failed grant write must not abort the approval"
    )
    assert '"grant_persisted": grant_persisted' in body
    assert '"grant_problem": grant_problem' in body


def test_always_is_translated_to_allow_on_the_pubsub_contract():
    """The waiting run has exactly two outcomes. Teaching every waiter a third word that
    means the same thing to them would widen a contract for no reason."""
    from pathlib import Path

    src = (
        Path(__file__).resolve().parents[2] / "app" / "api" / "threads.py"
    ).read_text(encoding="utf-8")
    assert '"allow" if payload.decision == "always" else payload.decision' in src
