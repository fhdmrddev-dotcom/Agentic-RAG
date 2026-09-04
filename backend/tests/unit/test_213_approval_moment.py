"""Phase 213 gap-closure round 1 (plan 213-06) — THE APPROVAL MOMENT.

⚠ WHY THIS FILE EXISTS. Waves 1-5 shipped the grant half and not the approval half:
`grep '"ask"' phase_types.py` returned NOTHING, every `ASK_*`/`REFUSED_*` string in
`grantsVocabulary.ts` had zero consumers, and every `ask` assertion in
`test_213_gate55_execution.py` checked only that the resolver RETURNS THE STRING `"ask"`.
**A green resolver test is not evidence about a gate**, and that gap is the whole reason
this file's assertions are about the EXECUTOR and the COMPOSER rather than about
`resolve_effective_posture`.

── THE DECISION THESE TESTS ENCODE, because it reads like a contradiction ─────────────
`D-213-09` chose **two triggers, ONE pause**, and rejected *"posture SUPERSEDES the armed
checkpoint"*. So on a workflow `external_action` step — where `action_risk_armed` is
coerced True and undisarmable (`models/harness.py:517`) — `allow` and `ask` produce the
SAME observable behaviour: both proceed *after* the armed checkpoint asked a person.

That is NOT the posture being inert. It is the author's arming being unconditional.
The two postures differ exactly where the armed checkpoint is ABSENT — the Phase 216 chat
path — and there `ask` must mean **"a human must have been asked"**. If nothing asked,
the answer is REFUSE. That is what makes SC#3's *"nothing leaves until they answer"* true
rather than aspirational, and it is what `test_ask_on_an_UNARMED_phase_refuses` pins.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

import pytest

from app.services.connector_service import ResolvedConnection
from app.services.harness.phase_types import _exec_external_action


def _conn(**over) -> ResolvedConnection:
    base = dict(
        connection_id="conn-1",
        org_id="org-1",
        capability=None,
        name="Atlassian MCP",
        config={},
        secret_ciphertext="enc",
        mcp_server_url="https://mcp.atlassian.com/v1",
        default_approval_posture="ask",
        tool_grants={},
        # ⚠ ADDED at Phase 214 (D-214-00). The MCP arm now projects its argument object onto
        # the bound tool's DECLARED schema, obtained through the ONE accessor the publish gate
        # also uses, so a connection carrying NO snapshot has an unknowable argument shape and
        # RECORDS rather than sending. Every case in this file is about the GRANT gate, which
        # sits one gate earlier — leaving the snapshot empty would make the `armed=True`
        # proceed-arm measure a schema refusal instead of an approval, i.e. green for the
        # wrong reason. A real MCP connection always carries the snapshot `discover_tools`
        # wrote; the no-snapshot refusal has its own case in `test_214_args_leaf.py`.
        discovered_tools=[{
            "name": "jira_create_issue",
            "inputSchema": {"type": "object", "required": ["summary"],
                            "properties": {"summary": {"type": "string"}}},
        }],
    )
    base.update(over)
    return ResolvedConnection(**base)


def _phase(*, armed: bool, tool="jira_create_issue", args=None):
    """⚠ `action_risk_armed` is set EXPLICITLY on both arms rather than left to default.

    The shipped Wave-2 tests omit the attribute entirely, so it reads False by `getattr`
    fallback — which is fine for them and would silently make an `armed=True` case here
    measure nothing. Setting both arms explicitly is what makes the pair a real contrast.
    """
    return SimpleNamespace(
        slug="phase_external",
        name="Send the renewal notice",
        phase_index=1,
        action_risk_armed=armed,
        config=SimpleNamespace(
            phase_type="external_action",
            capability=None,
            connection_id="conn-1",
            tool_name=tool,
            tool_args=args if args is not None else {"summary": "New Issue"},
        ),
    )


def _ctx():
    return SimpleNamespace(
        org_id="org-1",
        run_id="run-1",
        current_user={"id": "user-1"},
        pool=MagicMock(),
        inputs={},
    )


async def _drive(conn, phase, *, tool_result=None):
    """Run the REAL executor. `_exec_external_action` is never monkeypatched."""
    audit = AsyncMock()
    with patch("app.services.harness.phase_types.resolve_connection", new_callable=AsyncMock) as res, \
         patch("app.services.mcp_client.call_tool", new_callable=AsyncMock) as call, \
         patch("app.services.harness.phase_types.write_audit", audit), \
         patch("app.services.harness.phase_types.feature_audience", return_value="everyone"), \
         patch.object(ResolvedConnection, "secret", new_callable=PropertyMock, return_value="tok"):
        res.return_value = conn
        call.return_value = tool_result or {"text": "Issue created", "isError": False}
        out = await _exec_external_action(phase, {}, _ctx())
    return out, audit, call


def _refusal_reasons(audit) -> list[str]:
    return [
        c.kwargs["metadata"].get("reason")
        for c in audit.call_args_list
        if c.kwargs.get("event_type") == "tool_refused"
    ]


# ══════════════════════════════════════════════════════════════════════════════════
# Task 1 — `ask` must never mean "send"
# ══════════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_ask_on_an_UNARMED_phase_refuses_and_nothing_is_dispatched():
    """⛔ THE HEADLINE. Posture `ask` with nothing to do the asking must FAIL CLOSED.

    This is the Phase-216 shape: a caller with no armed checkpoint. Before this plan the
    executor fell through to dispatch, so a brand-new connection — `default_approval_posture`
    is `'ask'` by migration 128 §1, with no grant configured at all — SENT.
    """
    out, audit, call = await _drive(_conn(), _phase(armed=False))

    assert "failure" in out, f"posture 'ask' dispatched with nobody asked: {out!r}"
    call.assert_not_awaited()
    assert "approval_required" in _refusal_reasons(audit), _refusal_reasons(audit)


@pytest.mark.asyncio
async def test_ask_on_an_ARMED_phase_proceeds_because_the_checkpoint_already_asked():
    """The other half of D-213-09, and the reason this is not a second pause.

    The body runs ONLY when the armed checkpoint's `_resolve_failure_with_ask_user`
    returned None (`harness_engine.py:930`) — i.e. a person already approved. Refusing
    here too would ask twice, which D-213-09 rejected by name.
    """
    out, audit, call = await _drive(_conn(), _phase(armed=True))

    assert "failure" not in out, out
    call.assert_awaited_once()
    assert _refusal_reasons(audit) == []


@pytest.mark.asyncio
async def test_a_brand_new_connection_with_no_grants_does_not_send():
    """The regression POSTFLIGHT §1b measured, pinned end to end.

    Pre-213 the MCP path read `grants.get(tool) is True` — a MISSING KEY DENIED. Wave 2
    removed that check, leaving fail-closed resting on a column default that is `'ask'`
    for every new row. This asserts the GATE is fail-closed again, not the default.
    """
    out, _audit, call = await _drive(
        _conn(default_approval_posture="ask", tool_grants={}), _phase(armed=False)
    )
    assert "failure" in out
    call.assert_not_awaited()


# ══════════════════════════════════════════════════════════════════════════════════
# Task 3 + 4 — the refusal names the grant, and the three reasons differ
# ══════════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_an_explicit_deny_names_the_grant_and_the_next_step():
    """GRANT-04: *the refusal names which grant would allow it*.

    The shipped sentence was `"Tool execution refused: Tool 'X' is not granted permission
    on connection 'Y'."` — the mechanism-naming voice (`posture`, `permission`) the sketch
    deliberately replaced, naming no grant and offering no next step.
    """
    out, audit, _call = await _drive(
        _conn(tool_grants={"jira_create_issue": "deny"}), _phase(armed=True)
    )
    text = out["text"]

    assert "jira_create_issue" in text
    assert "Deny" in text, f"the refusal does not name the grant that stopped it: {text!r}"
    assert "Allow" in text and "Ask first" in text, (
        f"the refusal offers no way forward — REFUSED_NEXT is not reaching the run: {text!r}"
    )
    assert "posture_denied" in _refusal_reasons(audit)


@pytest.mark.asyncio
async def test_a_never_granted_tool_is_distinguishable_from_a_denied_one():
    """D-213-16 — one `tool_refused` KIND, three reasons.

    Without this the ledger cannot answer *"did a person deny this, or did a setting?"*,
    which is the operator-facing question the decision was written for.
    """
    out, audit, _call = await _drive(
        _conn(default_approval_posture="deny", tool_grants={}), _phase(armed=True)
    )
    assert "failure" in out
    assert "not_granted" in _refusal_reasons(audit), _refusal_reasons(audit)
    assert "posture_denied" not in _refusal_reasons(audit)


# ══════════════════════════════════════════════════════════════════════════════════
# Task 2 — the prompt names the service, the tool and the arguments (SC#3)
# ══════════════════════════════════════════════════════════════════════════════════

def test_the_approval_prompt_names_the_tool_and_the_arguments():
    """SC#3: *shows a person the service, the tool and the exact arguments*.

    ⚠ Composed from `phase.config` ALONE so the composer stays PURE — no new I/O, and the
    engine is not made to resolve a connection it does not already hold.
    """
    from app.services.harness.grounding import _approval_sentence

    phase = _phase(armed=True, tool="send_email", args={"to": "ops@example.com", "subject": "Renewal"})
    phase.config.capability = "send_email"
    sentence = _approval_sentence(phase, 4)

    assert "send_email" in sentence
    assert "ops@example.com" in sentence, f"the arguments are not shown: {sentence!r}"
    assert "Renewal" in sentence


def test_the_approval_prompt_names_no_service_it_cannot_know():
    """An MCP row has `capability = None`. Name the tool, never invent a service label.

    *Never draw a name the system cannot know* — the same rule that keeps SMTP on the
    neutral mark rather than borrowing Gmail's.
    """
    from app.services.harness.grounding import _approval_sentence

    sentence = _approval_sentence(_phase(armed=True), 4)
    assert "jira_create_issue" in sentence
    assert "None" not in sentence, f"a null service leaked into the prompt: {sentence!r}"


def test_the_clause_is_APPENDED_so_the_shipped_startswith_assertions_hold():
    """The shipped 185 assertions use `.startswith(...)` (`test_185_engine_attachment.py:249`,
    `:525`). Prepending would break them — this pins the ordering rather than trusting it.
    """
    from app.services.harness.grounding import _approval_sentence

    assert _approval_sentence(_phase(armed=True), 4).startswith(
        'Step 2 of 4, "Send the renewal notice", is about to run.'
    )


def test_a_NON_external_phase_sentence_is_unchanged():
    """NEGATIVE CONTROL. Without it, a clause appended unconditionally would pass every
    assertion above while rewriting the prompt for all five LLM phase types."""
    from app.services.harness.grounding import _approval_sentence

    plain = SimpleNamespace(
        slug="draft", name="Draft the notice", phase_index=1,
        action_risk_armed=True,
        config=SimpleNamespace(phase_type="llm_single"),
    )
    sentence = _approval_sentence(plain, 4)
    assert sentence.endswith("will not continue until you answer."), sentence
