"""Phase 189 (CONN-01) — SC#4's only mechanical proof: NOTHING IS SENT.

Covers validation rows **V10** and **V11**, and stands **D-22** up as a permanent guard.

**Zero MCP code exists in backend/app and this file is what keeps it that way.**
**Authored in Wave 0 and OBSERVED RED before any 189 source existed.**

SC#4 says *"no live outbound egress ships in this phase"*. That is a claim about absence,
and absence is exactly what a reviewer cannot see. So it is expressed here as three
mechanically checkable properties instead:

  * **Case A (V11) — the source fence.** Walk every ``*.py`` under ``backend/app`` and
    assert the case-insensitive word-boundary token ``mcp`` appears ZERO times. Measured at
    plan time: ``grep -rniE "\\bmcp\\b" backend/app --include=*.py | wc -l`` → ``0``.
    "MCP-backed" is a RECORDED VERDICT (D-11), not existing infrastructure.
    ⚠ **A fence with no positive control is a fence that can pass vacuously.** Two
    independent vacuity guards ride with it: the matcher is driven against an in-test
    haystack that DOES contain the token (a typo in the regex would otherwise turn the gate
    green forever — the failure class ``PhaseNodeCard.test.tsx`` guards against with its own
    haystack checks), and the walk asserts it actually visited a plausible number of files.

  * **Case B (V10) — the patched-transport falsification.** Patch every HTTP transport this
    backend can reach so any call RAISES, then invoke the ``external_action`` executor and
    assert it returns normally. Its own inertness control patches the same transports and
    then DOES make a request, asserting the sentinel fires — without that, a patch that
    silently failed to bind would make Case B prove nothing.
    ⚠ ``aiohttp`` is deliberately NOT patched: it is not a declared dependency
    (``requirements.txt`` names ``httpx>=0.28.0`` and nothing else for HTTP), and naming an
    absent library in a fence is how a fence starts lying.

  * **Case C (D-22 / SC#4) — no tool schema, no registry entry.** The capability is a STEP
    THE EXECUTOR PERFORMS, not a tool the LLM may call. The shipped precedent is
    ``render_template``: registered in ``_TOOL_REGISTRY`` and honoured by the whitelist, but
    never advertised in ``get_tools()``. 189 is ``render_template`` MINUS that registration —
    a ``get_tools()`` schema would ship most of the plumbing for live egress and, worse,
    would let an author whitelist ``send_email`` on an ordinary UNARMED ``llm_agent`` step,
    which is the exact wire-around D-04 and SC#2 forbid.
    Case C PASSES TODAY and must keep passing: it is a regression fence, not a Wave-0 RED.
"""

from __future__ import annotations

import re
from pathlib import Path
from types import SimpleNamespace

import pytest

# D-15's closed set. Kept as a module constant so Cases B and C name the same three
# strings the model's Literal does (asserted equal to the schema in
# tests/unit/test_189_external_action_model.py — this file does not re-derive it).
CAPABILITIES = ("send_email", "create_ticket", "post_message")

# backend/tests/unit/<this file>  ->  parents[2] == backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_APP_ROOT = _BACKEND_ROOT / "app"

# The fenced token.
#
# ⚠ THE PLAN SPECIFIED ``re.compile(r"\bmcp\b", re.IGNORECASE)`` AND ITS OWN POSITIVE
# CONTROL FALSIFIED IT. `\bmcp\b` does NOT match `MCPClient` — after `MCP` comes `C`, a
# word character, so there is no word boundary — which means the single most likely way
# an MCP client would ever appear in this tree (a PascalCase class name) would have sailed
# straight through the gate while it reported green. That is precisely the vacuous-fence
# failure the control exists to catch, so the matcher is strengthened rather than the
# control weakened.
#
# The rule: `mcp` fires when it STARTS a word (`mcp_client`, `MCP_URL`, `.Mcp`) or starts a
# camel/Pascal SEGMENT (`httpMCPClient`, `httpMcpClient`), and never when a lowercase
# letter or digit continues it (`mcpherson`, `dmcpx`). Deliberately NOT `re.IGNORECASE`:
# the flag would make the `[a-z0-9]` guards match uppercase too and collapse the rule.
# Both halves — what it must catch and what it must not — are driven below.
_MCP_TOKEN = re.compile(r"(?:(?<![A-Za-z0-9])[Mm]|(?<=[a-z0-9])M)[Cc][Pp](?![a-z0-9])")


class _EgressAttempted(RuntimeError):
    """Sentinel raised by every patched HTTP transport. If this escapes, something sent."""


def _app_python_files() -> list[Path]:
    return [p for p in _APP_ROOT.rglob("*.py") if "__pycache__" not in p.parts]


def _block_all_http(monkeypatch) -> None:
    """Patch every HTTP transport this backend can reach so any call RAISES.

    ``httpx`` is the ONLY declared HTTP client dependency (requirements.txt). Both the sync
    and async client bottleneck on ``send``, so patching those two methods covers
    ``get``/``post``/``request``/``stream`` and anything built on them.
    """
    import httpx

    def _sync_send(self, *args, **kwargs):
        raise _EgressAttempted("httpx.Client.send was called - outbound egress attempted")

    async def _async_send(self, *args, **kwargs):
        raise _EgressAttempted("httpx.AsyncClient.send was called - outbound egress attempted")

    monkeypatch.setattr(httpx.Client, "send", _sync_send, raising=True)
    monkeypatch.setattr(httpx.AsyncClient, "send", _async_send, raising=True)


def _external_action_executor():
    """The 7th executor — RED until plan 189-09 lands it.

    An ``assert`` rather than a bare module-level import on purpose: an ImportError at
    module scope would make this file a COLLECTION ERROR, and a collection error proves the
    file cannot run, not that the behaviour is absent.
    """
    from app.services.harness import phase_types

    fn = getattr(phase_types, "_exec_external_action", None)
    assert fn is not None, (
        "app.services.harness.phase_types._exec_external_action does not exist: the 7th "
        "executor has not landed yet (plan 189-09). This is the expected Wave-0 RED."
    )
    return fn


def _external_action_phase(capability: str = "send_email"):
    """A real, model-validated PhaseSpec for the executor to consume.

    Built through ``WorkflowDefinition.model_validate`` rather than hand-rolled so this
    case exercises the same object the engine passes, not a look-alike.
    """
    from app.models.harness import WorkflowDefinition

    wf = WorkflowDefinition.model_validate({
        "slug": "phase-189-egress-probe",
        "version": 1,
        "name": "Phase 189 egress probe",
        "status": "draft",
        "phases": [{
            "slug": "notify",
            "phase_index": 0,
            "config": {
                "phase_type": "external_action",
                "capability": capability,
                "available_tools": [capability],
            },
        }],
    })
    return wf.phases[0]


def _run_ctx():
    """A permissive duck-typed run ctx. Every executor reads ctx via ``getattr``."""
    return SimpleNamespace(
        inputs={},
        user_settings=None,
        retry_feedback=None,
        run_id=None,
        thread_id=None,
        user_id=None,
        is_golden_run=False,
    )


# ── Case A — the source fence (V11) ───────────────────────────────────────────


def test_the_mcp_matcher_actually_matches():
    """V11 positive control — the fence's matcher fires on a haystack that HAS the token.

    Without this, a typo in the regex (or an accidental over-escape) would make
    ``test_no_mcp_identifiers_in_backend_app`` green forever while checking nothing at all.
    """
    fires_on = [
        "client = MCPClient(server_url)",          # PascalCase - `\\bmcp\\b` MISSES this
        "self._httpMCPClient = build()",           # camelCase segment - also missed by `\\b`
        "self._httpMcpClient = build()",
        "# talk to the mcp server",
        "from app.services.Mcp import thing",
        "MCP_SERVER_URL = os.environ[...]",
        "await mcp_client.call_tool(name)",
        "mcp",
    ]
    for haystack in fires_on:
        assert _MCP_TOKEN.search(haystack), (
            f"the mcp fence matcher failed to fire on {haystack!r} - the fence would pass "
            "vacuously over the whole tree"
        )

    # The boundary half, so the fence is not a bare substring search that would flag
    # innocent identifiers, produce noise, and eventually get loosened away.
    for haystack in ["mcpherson", "compute", "dmcpx", "camp", "McPherson"]:
        assert not _MCP_TOKEN.search(haystack), (
            f"the mcp fence matcher fired on {haystack!r} - a substring match would produce "
            "false positives and the fence would eventually be loosened away"
        )


def test_no_mcp_identifiers_in_backend_app():
    """V11 / SC#4 — ZERO `mcp` identifiers exist anywhere under `backend/app`.

    D-11 records an MCP-first VERDICT; CONTEXT's landmine list states the corollary:
    *there is ZERO MCP code in backend/app*. This is that landmine expressed as a gate, so
    189 cannot quietly grow a client while claiming to be the no-egress phase.
    """
    files = _app_python_files()
    assert len(files) > 100, (
        f"the fence walked only {len(files)} python files under {_APP_ROOT} - the walk is "
        "broken and the fence proves nothing (measured at plan time: 160)"
    )

    offenders: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if _MCP_TOKEN.search(line):
                offenders.append(f"{path.relative_to(_BACKEND_ROOT).as_posix()}:{lineno}: {line.strip()}")

    assert offenders == [], (
        "SC#4: backend/app must contain ZERO `mcp` identifiers in Phase 189 - live "
        "connectors are Phase 190. Found:\n" + "\n".join(offenders)
    )


# ── Case B — the patched-transport falsification (V10) ────────────────────────


def test_the_transport_patch_is_not_inert(monkeypatch):
    """V10 inertness control — the patch really does intercept.

    If `_block_all_http` bound nothing (a renamed httpx internal, a client that bypasses
    `send`), the falsification below would pass while measuring nothing. This is the
    control that makes it mean something.
    """
    import httpx

    _block_all_http(monkeypatch)

    with pytest.raises(_EgressAttempted):
        httpx.Client(timeout=0.01).get("http://127.0.0.1:9/phase-189-should-never-reach-this")


async def test_the_transport_patch_is_not_inert_async(monkeypatch):
    """V10 inertness control, async half — `httpx.AsyncClient.send` is intercepted too."""
    import httpx

    _block_all_http(monkeypatch)

    with pytest.raises(_EgressAttempted):
        async with httpx.AsyncClient(timeout=0.01) as client:
            await client.get("http://127.0.0.1:9/phase-189-should-never-reach-this")


@pytest.mark.parametrize("capability", CAPABILITIES)
async def test_the_external_action_executor_performs_no_network_io(monkeypatch, capability):
    """V10 / SC#4 / D-05 — the executor RECORDS the intended action and sends NOTHING.

    Every HTTP transport is armed to raise before the executor runs, so any outbound call
    is a hard failure rather than a slow test. The executor must return normally, and its
    output must be a plain dict (`text` by convention, which `_latest_phase_text` scans for).

    Run for all three D-15 capabilities: SC#4 is a property of the phase, not of one name.
    """
    execute = _external_action_executor()
    phase = _external_action_phase(capability)
    ctx = _run_ctx()

    _block_all_http(monkeypatch)

    output = await execute(phase, {}, ctx)

    assert isinstance(output, dict), (
        f"the external_action executor returned {type(output).__name__}; every phase "
        "executor returns a plain dict"
    )
    assert isinstance(output.get("text"), str), (
        "the external_action executor must carry `text` - _latest_phase_text scans for it"
    )


# ── Case D (189-09) — D-02: a name outside the closed set RAISES ──────────────


async def test_a_capability_outside_the_closed_set_raises_in_the_executor():
    """D-02 — the executor's own closed-set resolution, the SECOND line of defence.

    ``ExternalActionPhaseConfig.capability`` is a ``Literal`` of exactly three, so a bad
    name is already a ``ValidationError`` at parse time — which is precisely why this case
    has to reach the engine ANOTHER WAY to mean anything. It builds a VALID phase, then
    rewrites the stored value the way a hand-edited JSONB row would (Pydantic v2 does not
    re-validate on assignment without ``validate_assignment``), and asserts the executor
    refuses it rather than resolving it dynamically or falling back to a default.

    ANTI-VACUITY: the clean capability is driven FIRST. Without that, a broken executor
    that raised on everything would pass this test for entirely the wrong reason.
    """
    execute = _external_action_executor()
    phase = _external_action_phase("send_email")
    ctx = _run_ctx()

    # 1. the clean name resolves - so the raise below is attributable to the NAME.
    clean = await execute(phase, {}, ctx)
    assert isinstance(clean.get("text"), str)

    # 2. the hand-edited row.
    phase.config.capability = "wire_transfer"

    with pytest.raises(KeyError) as excinfo:
        await execute(phase, {}, ctx)

    message = str(excinfo.value)
    assert "notify" in message, (
        f"D-02: the closed-set raise must name the PHASE SLUG so an operator can find the "
        f"offending row; got {message!r}"
    )
    assert "wire_transfer" in message, (
        f"D-02: the closed-set raise must name the OFFENDING VALUE; got {message!r}"
    )
    assert "EXTERNAL_ACTION_CAPABILITIES" in message, (
        f"D-02: the raise must name the CLOSED COLLECTION the name is missing from, the "
        f"way _exec_programmatic names PROGRAMMATIC_PHASE_REGISTRY; got {message!r}"
    )


# ── Case E (189-09) — T-189-26: the record may NEVER read as a receipt ────────
#
# The Control Room's `consequence is not receipt` rule, applied to the one output body in
# this codebase that describes something that did NOT happen. The three rules come from
# `189-UI-SPEC.md` section 9d and they are BINDING, not stylistic.

_CLOSING_NEGATIONS = {
    "send_email": "No email was sent.",
    "create_ticket": "No ticket was created.",
    "post_message": "No message was posted.",
}

# Past-tense success verbs and success glyphs. ⚠ `sent` alone is NOT forbidden: the body
# OPENS with "NOT SENT" and CLOSES with "No email was sent." - both negations. What is
# forbidden is a claim that the action reached a destination.
_RECEIPT_TOKENS = ("done", "delivered", "sent to", "posted to", "successfully", "complete")
_SUCCESS_GLYPHS = ("✓", "✔", "✅", "☑")  # ✓ ✔ ✅ ☑

# The ONE sanctioned occurrence of a forbidden token: the subjunctive block header. It is
# UI-SPEC section 9d's own wording and it claims nothing - "would have done" is the
# opposite of "done". Excised before the scan rather than special-cased inside it, so the
# exemption is one visible string and not a widening rule.
_SUBJUNCTIVE_HEADER = "What this step would have done"


def _assert_reads_as_not_sent(text: str, capability: str) -> None:
    """The three binding rules, as one reusable fence.

    Driven RED by ``test_the_receipt_fence_actually_fires`` below against four
    receipt-shaped plants - one per rule - so a green here is a measurement.
    """
    assert text.lstrip().upper().startswith("NOT SENT"), (
        "T-189-26 rule 1: the body must OPEN with the negation, never with the action. "
        f"Got: {text[:80]!r}"
    )

    negation = _CLOSING_NEGATIONS[capability]
    assert negation in text, (
        f"T-189-26 rule 3: the closing negation for {capability!r} must be the CLOSED "
        f"table's {negation!r}, never improvised. Body:\n{text}"
    )
    for other_cap, other_negation in _CLOSING_NEGATIONS.items():
        if other_cap != capability:
            assert other_negation not in text, (
                f"the body for {capability!r} carries {other_cap!r}'s negation "
                f"{other_negation!r} - the closing sentence is not keyed off the capability"
            )

    assert "not a receipt" in text.lower(), (
        "T-189-26 rule 3: the LAST sentence must name what the record is NOT. "
        f"Body:\n{text}"
    )

    haystack = text.replace(_SUBJUNCTIVE_HEADER, "").lower()
    for token in _RECEIPT_TOKENS:
        assert token not in haystack, (
            f"T-189-26 rule 2: the body uses the receipt word {token!r}. A recorded intent "
            f"that reads like a receipt is the failure mode this whole phase exists to "
            f"avoid. Body:\n{text}"
        )
    for glyph in _SUCCESS_GLYPHS:
        assert glyph not in text, (
            f"T-189-26 rule 2: the body carries the success glyph {glyph!r}. 189 spends no "
            f"checkmark on a step that sent nothing. Body:\n{text}"
        )


def test_the_receipt_fence_actually_fires():
    """T-189-26 positive control - the fence catches each receipt shape it claims to.

    ⚠ Without this, `_assert_reads_as_not_sent` could be green forever while asserting
    nothing (the same vacuity class the mcp matcher control above guards). Each plant
    below violates exactly ONE rule, so the control proves all three halves rather than
    one loud one.
    """
    plants = [
        # rule 1 - opens with the action rather than the negation
        ("send_email",
         "Sends an email to sarah@acme.example.\n\nNo email was sent. "
         "This is a record of an intention, not a receipt."),
        # rule 3 - the closing negation is improvised, not the closed table's
        ("send_email",
         "NOT SENT - recorded only.\n\nNothing went out. "
         "This is a record of an intention, not a receipt."),
        # rule 3 - the "what this is NOT" sentence is missing
        ("send_email", "NOT SENT - recorded only.\n\nNo email was sent."),
        # rule 2 - a past-tense success verb about the action
        ("send_email",
         "NOT SENT - recorded only.\n\nEmail delivered.\n\nNo email was sent. "
         "This is a record of an intention, not a receipt."),
        # rule 2 - a checkmark
        ("send_email",
         "NOT SENT - recorded only.\n\n✓ Recorded.\n\nNo email was sent. "
         "This is a record of an intention, not a receipt."),
        # rule 3 - another capability's negation
        ("create_ticket",
         "NOT SENT - recorded only.\n\nNo email was sent. No ticket was created. "
         "This is a record of an intention, not a receipt."),
    ]
    for capability, plant in plants:
        with pytest.raises(AssertionError):
            _assert_reads_as_not_sent(plant, capability)

    # ... and the subjunctive header is NOT a violation, or the real body could never pass.
    _assert_reads_as_not_sent(
        "NOT SENT - recorded only.\n\nWhat this step would have done\n  Action: Sends an "
        "email\n\nNo email was sent. This is a record of an intention, not a receipt.",
        "send_email",
    )


@pytest.mark.parametrize("capability", CAPABILITIES)
async def test_the_recorded_output_body_cannot_read_as_a_receipt(capability):
    """T-189-26 / D-05 - the REAL executor's body, driven, against the fence above.

    Not a reading of the source: the body is composed by the shipped code path with real
    resolved inputs, and the assertion runs on what a user would actually see.
    """
    execute = _external_action_executor()
    phase = _external_action_phase(capability)
    ctx = _run_ctx()
    ctx.inputs = {"recipient": "sarah@acme.example", "subject": "Renewal summary"}

    output = await execute(
        phase,
        {"draft": {"text": "The Acme renewal is up on 12 September."}},
        ctx,
    )

    _assert_reads_as_not_sent(output["text"], capability)


@pytest.mark.parametrize("capability", CAPABILITIES)
async def test_the_output_carries_the_recorded_intent_sentinel(capability):
    """D-05 - the structured record: the capability, the resolved inputs, nothing else.

    The sentinel-on-an-ordinary-output-dict shape is 101.1's own (``output["failure"]`` ->
    ``fail_phase`` at the engine seam). The ENGINE branch that reads this key and writes
    ``recorded_not_sent`` is plan 189-11's; this asserts the PRODUCER half only.
    """
    execute = _external_action_executor()
    phase = _external_action_phase(capability)
    ctx = _run_ctx()
    ctx.inputs = {"recipient": "sarah@acme.example"}

    output = await execute(phase, {"draft": {"text": "the draft body"}}, ctx)

    record = output.get("recorded_intent")
    assert isinstance(record, dict), (
        "D-05: the executor must carry a `recorded_intent` sentinel holding the structured "
        f"record of what it WOULD have done; got {record!r}"
    )
    assert record["capability"] == capability
    assert set(record) == {"capability", "inputs"}, (
        f"D-05: the record holds the capability and the resolved inputs and NOTHING else; "
        f"got keys {sorted(record)}"
    )
    # The resolved inputs are the run inputs plus the upstream text - the two sources the
    # neighbouring executors already read (ctx.inputs / _latest_phase_text).
    assert record["inputs"]["recipient"] == "sarah@acme.example"
    assert record["inputs"]["content"] == "the draft body"
    # ⚠ The RECORD keeps values whole; only the rendered text clips them. This is the thing
    # Phase 190 will one day actually send.
    assert "…" not in record["inputs"]["content"]


@pytest.mark.parametrize("capability", CAPABILITIES)
async def test_the_kickoff_prompt_is_not_recorded_as_an_action_input(capability):
    """REVIEW WR-02 — the user's CHAT QUESTION is not a parameter of the send.

    ``ctx.inputs`` is the run's LAUNCH bag, and on EVERY live run it carries
    ``kickoff_prompt`` (SEED-047 — the question the user typed). The executor swept the bag
    in whole, so the rendered body printed

        What this step would have done
          Action        : Sends an email
          kickoff_prompt: send Sarah the renewal summary

    under a heading that asserts these ARE the action's inputs, and persisted it into
    ``recorded_intent["inputs"]`` → ``workflow_phases.output``. Over-claiming, on the one
    surface in this phase whose whole discipline is not over-claiming.

    WHY NO EXISTING CASE CAUGHT IT: ``_run_ctx()`` starts from ``inputs={}`` and every case
    above then assigns only hand-picked keys, so the production bag was never driven. This
    case drives it — the bag as `threads.py` / the resume builders really hand it over.

    BOTH SURFACES, because they fail separately: the RECORD is what Phase 190 would send,
    the BODY is what a human reads. And two positive controls, so a green here can never be
    an executor that dropped its inputs altogether.
    """
    execute = _external_action_executor()
    phase = _external_action_phase(capability)
    ctx = _run_ctx()
    # The production shape: scaffolding the RUN put there, beside a real action input.
    ctx.inputs = {
        "kickoff_prompt": "send Sarah the renewal summary",
        "recipient": "sarah@acme.example",
    }

    output = await execute(phase, {"draft": {"text": "the draft body"}}, ctx)
    record = output["recorded_intent"]

    # ── positive controls FIRST: the real inputs still resolve ───────────────────
    assert record["inputs"]["recipient"] == "sarah@acme.example", (
        f"the executor dropped a REAL action input — every absence below would be "
        f"vacuous. Got {record['inputs']!r}"
    )
    assert record["inputs"]["content"] == "the draft body"

    # ── the finding: the chat question is neither recorded nor rendered ──────────
    assert "kickoff_prompt" not in record["inputs"], (
        f"WR-02: the user's original chat question is recorded as an input to "
        f"{capability!r} and persisted onto workflow_phases.output. It is run "
        f"scaffolding, not a parameter of the action. Got {record['inputs']!r}"
    )
    assert "kickoff_prompt" not in output["text"], (
        f"WR-02: the NOT-SENT body prints `kickoff_prompt` under 'What this step would "
        f"have done', asserting the user's chat question is an input to the send:\n"
        f"{output['text']}"
    )
    assert "send Sarah the renewal summary" not in output["text"], (
        f"WR-02: the kickoff VALUE reached the body even though its key did not:\n"
        f"{output['text']}"
    )


# ── Case C — D-22: a step the executor performs, not a tool the LLM may call ──


def test_no_capability_is_a_dispatchable_tool_or_an_advertised_schema():
    """D-22 / SC#4 — none of the three capabilities is registered or advertised.

    Two independent surfaces, because they fail differently:
      * `_TOOL_REGISTRY` (`tool_dispatcher`) is the DISPATCH backstop - an entry there
        would make the capability callable by any agent that hallucinated the name.
      * `get_tools()` (`openai_service`) is the SCHEMA list the model actually SEES - an
        entry there would let an author whitelist `send_email` on an ordinary, UNARMED
        `llm_agent` step straight off the author-facing rail, which is the wire-around
        D-04 and SC#2 forbid (and the D-20 leak shape).

    PASSES TODAY. It is a standing regression fence, not a Wave-0 RED.
    """
    from app.services.openai_service import get_tools
    from app.services.tool_dispatcher import _TOOL_REGISTRY

    registered = set(_TOOL_REGISTRY.keys())
    advertised = {t["function"]["name"] for t in get_tools(None)}

    assert advertised, "get_tools(None) advertised no schemas at all - the fence is vacuous"

    for capability in CAPABILITIES:
        assert capability not in registered, (
            f"D-22: {capability!r} must NOT be in _TOOL_REGISTRY - the capability is a step "
            "the executor performs, never a tool the LLM may call. Live egress is Phase 190."
        )
        assert capability not in advertised, (
            f"D-22 / D-20: {capability!r} must NOT appear in get_tools() - advertising the "
            "schema would let an author whitelist it on an unarmed llm_agent step, wiring "
            "around the D-04 checkpoint entirely."
        )
