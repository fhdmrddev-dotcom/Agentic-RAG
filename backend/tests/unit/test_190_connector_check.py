"""Phase 190 (CONN-02 / CONN-03) — THE CREDENTIAL CHECK AND **GATE 2's EXACT REACH**.

Seven cases. Together they pin the two server-side mechanisms UI-SPEC §5 promises, and — the
part that matters most — they pin the promise's **exact** size, in both directions.

  1. a DISABLED connection is treated as UNBOUND at run time -> ``recorded_not_sent``,
     never ``failed``                                    (D-17, zero new statuses)
  2. a connection from ANOTHER org is never resolved by the check; the route asks the
     org-scoped resolver, and a storage layer that disobeys is still refused   (D-14)
  3. ⭐ a FAILED verdict does **NOT** block the write of a ``connection_id`` — asserted as a
     POSITIVE, because door (b) is a decision that must fail loudly if reversed  (U-07a)
  4. a FAILED verdict does **NOT** block a RUN — the executor attempts the send and reports
     the true outcome; a two-day-old verdict never decides a live run
  5. the check SENDS NOTHING, for all three capabilities, with the transport recorded (§5c)
  6. a secret REPLACE resets the verdict to ``not_checked`` in the SAME UPDATE     (OQ#4)
  7. the check route never accepts a secret in its request body — it takes an id and nothing
     else, asserted on the SIGNATURE and over the wire

── ⚠ WHY CASE 3 IS THE ONE TO READ ───────────────────────────────────────────────────────
Every other case here asserts that something is refused. Case 3 asserts that something is
**ACCEPTED**, and it is the only case in this file that a well-meaning future change would
break by making the system *stricter*.

UI-SPEC §5a takes door (b) knowingly: Gate 2 validates a bound connection's **org** and its
**``is_enabled``** flag and reads the stored check verdict NOWHERE. So a ``connection_id``
write naming a connection whose last check failed is accepted by the server, and §5b's
sentence is worded to exactly that reach — *"the picker will not offer it"*, never *"no step
will be allowed to use it"*. Blocking the bind prevents no send, and check is admin-only
while bind is org-wide, so a server bind-gate would dead-end a plain member holding a stale
verdict they cannot clear.

Without case 3, "tightening" Gate 2 is a one-line change that turns §5b's shipped sentence
into an under-claim silently — nothing in the type system objects, and the stricter version
reads *better*. With case 3 it turns this file RED and names the document it contradicts.

── THE REVERSAL CONTRACT (U-07a), RESTATED WHERE IT WILL BE READ ─────────────────────────
Taking door (a) means extending Gate 2 to reject a ``connection_id`` write when the stored
verdict is ``failed``, **and** restoring the absolute verb in UI-SPEC §5b **in the same
commit** — plus either giving members the check, or shipping the "ask an admin" dead end
knowingly. **The two halves may NEVER be separated:** a gate without the copy under-claims,
and the copy without the gate is the §5 defect this plan exists to close.
"""
from __future__ import annotations

import inspect
import re
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# `app.main` FIRST, deliberately: `app.models.connector` cannot be the first app module
# imported in a cold interpreter (a pre-existing latent cycle, measured at plan 190-15 and
# unchanged by it — models.connector -> harness.grounding -> harness/__init__ -> phase_types
# -> connector_service -> models.connector). conftest already imports it; this states why the
# order is not incidental.
from app.main import app as real_app  # noqa: F401  (import-order anchor)

from app import dependencies as deps
from app.api import connectors
from app.models.connector import (
    ConnectorCheckResponse,
    ConnectorConnectionUpdate,
    CreateTicketConfig,
    PostMessageConfig,
    SendEmailConfig,
)
from app.models.harness import ExternalActionPhaseConfig
from app.security.egress import PinnedResponse
from app.services import connector_service
from app.services.connectors import jira_adapter, slack_adapter, smtp_adapter
from app.services.connectors.protocol import AdapterCheckResult
from app.services.harness import phase_types
from app.services.harness.phase_types import _exec_external_action

BACKEND_ROOT = Path(__file__).resolve().parents[2]

# Matches conftest.mock_user_data (the get_current_user override identity).
CALLER_ID = "00000000-0000-0000-0000-000000000001"
ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"
OTHER_ORG = "22222222-2222-2222-2222-222222222222"
CONNECTION_ID = "dddddddd-0000-4000-8000-00000000000d"

# A greppable sentinel wearing the real envelope prefix, so the resolver's eager
# `is_encrypted` gate passes without a real Fernet token. Nothing in this file reads
# `.secret` on a path where the value would be decrypted.
SENTINEL_CIPHERTEXT = "enc:v1:xoxb-SENTINEL-190-15-MUST-NEVER-REACH-A-BROWSER"

STORED_ROW = {
    "id": CONNECTION_ID,
    "org_id": ACTIVE_ORG,
    "created_by": CALLER_ID,
    "capability": "post_message",
    # Phase 211 — `ConnectorConnectionResponse.service_id` is REQUIRED, so a stored row
    # without it is a `ValidationError` at `_to_response` rather than a missing key. Migration
    # 127 guarantees every real row carries one.
    "service_id": "slack",
    "name": "#ops-alerts",
    "config": {"default_channel": "#ops-alerts"},
    "secret_ciphertext": SENTINEL_CIPHERTEXT,
    "is_enabled": True,
    "last_checked_at": None,
    # ⚠ FAILED on purpose, and it is load-bearing in cases 3 and 4: the fixture ships the
    # state a stricter Gate 2 would refuse, so a case that passes here passes over the row
    # the decision is actually about.
    "last_check_verdict": "failed",
    "created_at": "2026-08-08T00:00:00Z",
    "updated_at": "2026-08-08T00:00:00Z",
}


# ── the probe app (the `test_190_connectors_api.py` shape, unchanged) ────────────────────
@pytest.fixture
def router_client():
    """A TestClient over `connectors.router` ALONE, sharing the live override dict."""
    probe = FastAPI()
    probe.include_router(connectors.router)
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)


def _org_headers():
    return {"Authorization": "Bearer test-token", "X-Org-Id": ACTIVE_ORG}


def _install_perms(monkeypatch, perms: dict):
    async def _fake(request, current_user, org_id, permission_key):
        return perms.get(permission_key, False)

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake)


def _install_feature(monkeypatch, audience: str, *, operator: bool = False):
    from unittest.mock import AsyncMock

    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=operator))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: audience)


def _as_org_admin(monkeypatch, mock_asyncpg_pool):
    """A caller who is a member of ACTIVE_ORG and holds `org:manage` (the check's audience)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "org-admin"})
    _install_perms(monkeypatch, {"org:manage": True})


class _Recorder:
    """A stand-in adapter whose `check` records that it ran and answers `ok`."""

    def __init__(self, *, ok: bool = True, identity: str | None = "bot in acme"):
        self.calls: list[dict] = []
        self._ok, self._identity = ok, identity

    async def check(self, *, credential, config):
        self.calls.append({"config": dict(config)})
        return AdapterCheckResult(
            ok=self._ok, identity=self._identity if self._ok else None, provider_message=""
        )

    async def send(self, *, args, credential, config, capability=None):  # pragma: no cover
        raise AssertionError("a CHECK must never reach an adapter's send()")


# ══════════════════════════════════════════════════════════════════════════════════════════
# 1 · a DISABLED connection is treated as UNBOUND -> recorded_not_sent (D-17)
# ══════════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_a_disabled_connection_is_treated_as_unbound_and_records_not_sent(monkeypatch):
    """Gate 2's `is_enabled` half, at RUN time. It records; it does not fail.

    An operator who switched a connection off got what they asked for, so the honest terminal
    is the one migration 115 was already spent on — the SAME terminal, the SAME composer and
    the SAME sentence as the no-connection-bound branch. **Zero new statuses** (D-17), which
    is why this case asserts the record sentinel AND the absence of the failure sentinel: a
    disabled connection that produced `failed` would be indistinguishable from a send that
    was attempted and refused, which is the §14 failure condition this phase must not ship.
    """
    monkeypatch.setattr(phase_types, "feature_audience", lambda _f: "everyone")

    async def _disabled(*_a, **_kw):
        raise connector_service.ConnectorDisabled("connection is switched off")

    monkeypatch.setattr(phase_types, "resolve_connection", _disabled, raising=True)
    monkeypatch.setattr(
        phase_types,
        "get_adapter",
        lambda _c: (_ for _ in ()).throw(
            AssertionError("a DISABLED connection reached the adapter — the send was attempted")
        ),
        raising=True,
    )

    output = await _exec_external_action(_phase(connection_id=CONNECTION_ID), {}, _run_ctx())

    assert phase_types.RECORDED_INTENT_KEY in output, (
        f"D-17: a disabled connection did not reach the RECORD terminal: {sorted(output)!r}"
    )
    assert "failure" not in output, (
        "D-17: a disabled connection produced the FAILURE sentinel, so the engine writes "
        "`failed`. A connection somebody deliberately switched off is not a failed send, and "
        "the two terminals must stay distinguishable (UI-SPEC §8b)."
    )
    first_line = output["text"].splitlines()[0]
    assert first_line == "NOT SENT — recorded only.", (
        f"the record's first line is {first_line!r}. It must open with the negation and it "
        "must be the SHIPPED sentence — one composer owns it (`_external_action_body`)."
    )
    assert "fail" not in output["text"].lower(), (
        f"the record body borrowed the failure vocabulary: {output['text']!r}"
    )


# ══════════════════════════════════════════════════════════════════════════════════════════
# 2 · a cross-org id is never resolved by the check (D-14)
# ══════════════════════════════════════════════════════════════════════════════════════════
def test_a_connection_from_another_org_is_never_resolved_by_the_check(
    monkeypatch, mock_asyncpg_pool, mock_execute_result, router_client
):
    """The check runs the REAL resolver, so it inherits D-14's two gates — both of them.

    ⚠ The storage seam is stubbed, not the resolver: `connector_service._fetch_connection_row`
    is replaced with one that **disobeys** and hands back a row owned by another org. That is
    the whole point. The first gate (the `org_id` predicate in the SQL) is invisible to a test
    that stubs the resolver itself; the SECOND gate — the resolver re-checking the returned
    row's own `org_id` — is what survives a future fetch seam whose SQL drops the predicate,
    and it is the one this case measures.

    Two assertions, and neither is sufficient alone: the route must ASK with the caller's org
    (a resolver called with no org scope would leak one tenant's credential into another
    tenant's check), and the answer must be the generic 404 — never a forbidden status, which
    would confirm the id names a real row somewhere.
    """
    _as_org_admin(monkeypatch, mock_asyncpg_pool)
    _install_feature(monkeypatch, "everyone")

    asked: list[tuple[str, str]] = []

    async def _disobedient_fetch(connection_id: str, org_id: str):
        asked.append((connection_id, org_id))
        return {**STORED_ROW, "org_id": OTHER_ORG}  # a row the caller's org does not own

    monkeypatch.setattr(connector_service, "_fetch_connection_row", _disobedient_fetch)

    res = router_client.post(
        f"/connectors/connections/{CONNECTION_ID}/check", headers=_org_headers()
    )

    assert asked == [(CONNECTION_ID, ACTIVE_ORG)], (
        f"the check asked the resolver for {asked!r}. It must pass the CALLER'S active org — "
        "an id-only lookup passes every ordinary test and hands one tenant another tenant's "
        "decrypted credential (D-14, reproduced at plan 190-06 before it was closed)."
    )
    assert res.status_code == 404, (
        f"a cross-org check answered {res.status_code}: {res.text!r}. The resolver's second "
        "gate must refuse a row the storage layer returned for the wrong org."
    )
    assert res.status_code != 403, "a cross-org miss must NEVER be the forbidden status"
    body = res.text.lower()
    for leak in (OTHER_ORG.lower(), "permission", "forbidden", "owner"):
        assert leak not in body, f"the miss body leaked {leak!r}: {res.text!r}"


def test_the_check_DOES_resolve_a_connection_its_own_org_owns(
    monkeypatch, mock_asyncpg_pool, mock_execute_result, router_client
):
    """The NON-VACUITY control for case 2 — without it, a route that refused EVERYTHING
    would pass forever while the check never worked for anybody."""
    _as_org_admin(monkeypatch, mock_asyncpg_pool)
    _install_feature(monkeypatch, "everyone")

    async def _owned_fetch(connection_id: str, org_id: str):
        return {**STORED_ROW, "org_id": org_id}

    monkeypatch.setattr(connector_service, "_fetch_connection_row", _owned_fetch)
    monkeypatch.setattr(
        "app.services.connectors.registry.get_adapter", lambda _c: _Recorder(ok=True)
    )
    mock_execute_result.data = [{**STORED_ROW, "last_check_verdict": "ok",
                                "last_checked_at": "2026-08-09T00:00:00Z"}]

    res = router_client.post(
        f"/connectors/connections/{CONNECTION_ID}/check", headers=_org_headers()
    )

    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["ok"] is True and payload["verdict"] == "ok", payload
    assert payload["identity"] == "bot in acme", payload
    assert payload["host"] == "slack.com" and payload["port"] == 443, payload
    assert payload["bucket"] is None, "a successful check has no §4d failure bucket"
    # T7, on the CHECK's own response: a verdict, never a credential — in either form.
    rendered = res.text
    for leak in ("secret", "ciphertext", "enc:v1:", "xoxb-", "password", "token"):
        assert leak not in rendered.lower(), (
            f"the check response carried {leak!r}: {rendered!r}. A check returns a VERDICT."
        )


# ══════════════════════════════════════════════════════════════════════════════════════════
# 3 · ⭐ a FAILED verdict does NOT block the WRITE of a connection_id — door (b), POSITIVE
# ══════════════════════════════════════════════════════════════════════════════════════════
def test_a_FAILED_verdict_does_NOT_block_the_write_of_a_connection_id():
    """⭐ **Door (b), asserted as a POSITIVE.** The server ACCEPTS such a write.

    Blocking the bind prevents no send, and check is admin-only while bind is org-wide — so
    a server bind-gate on a failing verdict would dead-end a plain member holding a stale
    verdict they cannot clear. The failing-verdict rule is a QUALITY HINT (migration 116 says
    so in the column's own COMMENT); every ACTUAL boundary on this surface — org scoping,
    `is_enabled`, the egress guard, the armed approval — is server-enforced, and this one is
    deliberately not.

    Two halves, because either alone is satisfiable by an accident:

      * the POSITIVE — the phase config that carries a `connection_id` validates, with no
        field, validator or lookup anywhere in it that could consult a verdict; and
      * the ABSENCE — the column's name appears NOWHERE on any bind or run path in the whole
        `backend/app` tree. Its only readers are the module that WRITES it, the response
        model that reports it, and the router's own prose. A future gate would have to add
        an occurrence to one of the fenced modules, and that turns this case RED.
    """
    bound = ExternalActionPhaseConfig(
        phase_type="external_action",
        capability="post_message",
        available_tools=["post_message"],
        connection_id=CONNECTION_ID,
    )
    assert str(bound.connection_id) == CONNECTION_ID, (
        "the phase config refused a connection_id naming a connection whose last check "
        "failed — door (a) was taken WITHOUT §5b's absolute verb being restored, which is "
        "the half-change U-07a forbids"
    )

    column = "last_check" + "_verdict"  # not spelled, so this file's own walk cannot self-trip
    allowed = {
        "app/services/connector_service.py",  # the one WRITER (and the OQ#4 reset)
        "app/models/connector.py",            # the response field + the check response docs
        "app/api/connectors.py",              # the read's docstring + the check's own prose
    }
    offenders: list[str] = []
    for path in (BACKEND_ROOT / "app").rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        rel = path.relative_to(BACKEND_ROOT).as_posix()
        if rel in allowed:
            continue
        for lineno, line in enumerate(
            path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1
        ):
            if column in line:
                offenders.append(f"{rel}:{lineno}: {line.strip()}")

    assert not offenders, (
        "the stored check verdict is now read outside the three modules allowed to know "
        "about it, which means a bind or a run may be gated on it:\n" + "\n".join(offenders)
        + "\n\nU-07a: reversing to door (a) is a TWO-HALF change — the gate AND UI-SPEC §5b's "
        "absolute verb, in ONE commit — plus either giving members the check or shipping the "
        "'ask an admin' dead end knowingly. The two halves may never be separated."
    )


# ══════════════════════════════════════════════════════════════════════════════════════════
# 4 · a FAILED verdict does NOT block a RUN — the stale-verdict rule
# ══════════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_a_FAILED_verdict_does_NOT_block_a_RUN(monkeypatch):
    """A two-day-old verdict must never decide a live run.

    A credential rotated since the check would be refused while working perfectly — which is
    exactly the settings-sync-staleness class this codebase has already been bitten by. At
    run time the executor ATTEMPTS the send and reports the true outcome (`completed` /
    `failed`, D-17).

    The row this drives carries `last_check_verdict: "failed"` (see STORED_ROW), so a
    executor that consulted it would record instead of sending — and the assertion is that
    the adapter was REACHED, which no amount of recording satisfies.
    """
    monkeypatch.setattr(phase_types, "feature_audience", lambda _f: "everyone")

    resolved = SimpleNamespace(
        connection_id=CONNECTION_ID,
        org_id=ACTIVE_ORG,
        capability="post_message",
        name="#ops-alerts",
        config={"default_channel": "#ops-alerts"},
        # The stale verdict rides along on the resolved object too, so an executor that
        # wanted to consult it would not even need a second read.
        last_check_verdict="failed",
    )

    async def _resolver(*_a, **_kw):
        return resolved

    sent: list[dict] = []

    class _SendRecorder:
        async def send(self, *, args, credential, config, capability=None):
            sent.append({"capability": capability, "args": dict(args)})
            return SimpleNamespace(ok=True, provider_message="", raw_status=200, detail="")

        INPUT_SCHEMA = {"properties": {"text": {"type": "string"}, "channel": {"type": "string"}}}

    monkeypatch.setattr(phase_types, "resolve_connection", _resolver, raising=True)
    monkeypatch.setattr(phase_types, "get_adapter", lambda _c: _SendRecorder(), raising=True)
    monkeypatch.setattr(phase_types, "_write_send_receipt", _noop_receipt, raising=True)

    output = await _exec_external_action(_phase(connection_id=CONNECTION_ID), {}, _run_ctx())

    assert sent, (
        "the run did NOT attempt the send for a connection whose last check failed. A stale "
        "verdict is now gating a live run: a credential rotated since that check is refused "
        "while working perfectly, and the person cannot clear the verdict unless they are an "
        "org admin. UI-SPEC §5a: at run time the executor attempts and reports the truth."
    )
    assert phase_types.RECORDED_INTENT_KEY not in output, (
        f"the run RECORDED rather than sent, despite the connection being bound and enabled: "
        f"{sorted(output)!r}"
    )


# ══════════════════════════════════════════════════════════════════════════════════════════
# 5 · the check SENDS NOTHING, for all three capabilities (§5c)
# ══════════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
@pytest.mark.parametrize("capability", ["post_message", "create_ticket", "send_email"])
async def test_the_check_sends_NOTHING_for_all_three_capabilities(monkeypatch, capability):
    """UI-SPEC §5c's headline is *"Credential works — and nothing was sent"*.

    That second clause is only honest if it is PROVED, so the transport is recorded rather
    than trusted: every HTTP exchange this check makes is captured at `send_pinned_http` (the
    one door to the wire in both HTTP adapters), and the SMTP session is a recorder that
    fails the case if `data` / `sendmail` / `send_message` is ever touched.

    The three delivery surfaces asserted absent are the real ones, by name:
      * Slack  — `chat.postMessage`
      * Jira   — a POST to `/rest/api/3/issue`
      * SMTP   — the `DATA` verb, which is the command that begins a message body
    """
    exchanges: list[tuple[str, str, Any]] = []

    async def _recording_http(_capability, method, url, **kwargs):
        exchanges.append((method, url, kwargs.get("json")))
        if "/myself" in url:
            body = b'{"accountId":"5b1","displayName":"Ops Bot","emailAddress":"a@b.c"}'
        else:
            body = b'{"ok":true,"user":"ops-bot","team":"acme"}'
        return PinnedResponse(status_code=200, headers={}, body=body)

    class _RecordingSmtpSession:
        def __init__(self):
            self.verbs: list[str] = []

        def login(self, username, password):
            self.verbs.append("login")
            return (235, b"2.7.0 Authentication successful")

        def quit(self):
            self.verbs.append("quit")

        def __getattr__(self, name):
            # Any verb this recorder does not implement is a verb the check should not use.
            def _forbidden(*_a, **_kw):
                self.verbs.append(name)
                raise AssertionError(
                    f"UI-SPEC §5c: the credential check reached SMTP {name!r}. A check "
                    "authenticates and disconnects; it submits nothing."
                )

            return _forbidden

    smtp_session = _RecordingSmtpSession()

    async def _recording_open_smtp(*_a, **_kw):
        return smtp_session

    monkeypatch.setattr(slack_adapter, "send_pinned_http", _recording_http)
    monkeypatch.setattr(jira_adapter, "send_pinned_http", _recording_http)
    monkeypatch.setattr(smtp_adapter, "open_pinned_smtp", _recording_open_smtp)

    adapter, config = _adapter_and_config(capability)
    credential = SimpleNamespace(secret="a-real-looking-credential")

    result = await adapter.check(credential=credential, config=config)

    assert result.ok is True, (
        f"the {capability} check did not authenticate against a healthy stub: {result!r} — "
        "the negative assertions below would then be vacuous"
    )
    assert result.identity, (
        "a check that cannot name WHO it authenticated as is not a green check (§5c renders "
        f"'Authenticated as {{identity}}'): {result!r}"
    )

    rendered = repr(exchanges)
    assert "chat.postMessage" not in rendered, (
        f"the check reached Slack's DELIVERY method: {rendered!r}"
    )
    assert not any(
        method.upper() == "POST" and url.endswith(jira_adapter.ISSUE_PATH)
        for method, url, _ in exchanges
    ), f"the check POSTed to Jira's issue-create endpoint: {rendered!r}"
    assert all(payload is None for _m, _u, payload in exchanges), (
        f"the check carried a request BODY; an identity call carries none: {rendered!r}"
    )
    assert "data" not in [v.lower() for v in smtp_session.verbs], (
        f"the check issued the SMTP DATA verb: {smtp_session.verbs!r}"
    )
    if capability == "send_email":
        assert smtp_session.verbs == ["login", "quit"], (
            "the SMTP check must connect, authenticate and disconnect — nothing else: "
            f"{smtp_session.verbs!r}"
        )


def test_the_closing_negation_comes_from_the_CLOSED_table_189_already_ships():
    """§5c's closing line is PICKED from the SHIPPED table, never improvised.

    ⚠ **MEASURED 2026-08-09 (plan 190-15), and it corrected a planning document rather than
    the code.** UI-SPEC §5c, this plan's `<interfaces>` block AND plan 190-18 all quote the
    closed table's `send_email` row as *"No mail was delivered to anyone."* — in the very
    sentence that says the negation is *"picked from the same closed table 189 §9d already
    ships, never improvised."* The table 189 actually ships
    (`phase_types._EXTERNAL_ACTION_NEGATION`, and `189-UI-SPEC.md:761`, and the string read
    straight out of `workflow_phases.output` in `189-UAT.md:104`) says:

        send_email -> "No email was sent."

    So the document had improvised the one thing it forbade improvising, and shipping its
    version would have given a THREE-row closed table a FOURTH sentence. §5c was corrected to
    the shipped literal in this plan's commit; this case is what keeps the two in step.

    ⚠ 190-18 authors §5c's headline and quotes the same wrong string — it must take the value
    from HERE, not from its own plan text.
    """
    table = phase_types._EXTERNAL_ACTION_NEGATION
    from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

    assert set(table) == set(EXTERNAL_ACTION_CAPABILITIES), (
        f"the closed negation table disagrees with the capability set: "
        f"{sorted(set(table) ^ set(EXTERNAL_ACTION_CAPABILITIES))} — a fourth capability MUST "
        "arrive with its own words rather than falling back to a generic sentence"
    )
    assert table["send_email"] == "No email was sent.", (
        f"the shipped `send_email` negation is {table['send_email']!r}. If it was changed to "
        "match a planning document, the change belongs in 189's surface and its UAT evidence "
        "too — not in a 190 plan that claims to be REUSING it."
    )
    assert table["create_ticket"] == "No ticket was created."
    assert table["post_message"] == "No message was posted."


# ══════════════════════════════════════════════════════════════════════════════════════════
# 6 · a secret REPLACE resets the verdict in the SAME UPDATE (research OQ#4)
# ══════════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_a_secret_replace_resets_the_verdict_to_not_checked(monkeypatch):
    """One column, one UPDATE, zero ambiguity — and the panel says so, so the server must.

    A verdict is a statement about the credential that was CHECKED. Carrying an `ok` across a
    credential swap shows a green Credential column for a secret nobody has tried, which is a
    green light a person acts on later. The reset must ride the SAME update as the new
    ciphertext: a second write is a window in which the row is green and wrong, and a window
    that survives a crash.
    """
    from app.security.secret_cipher import get_cipher

    if get_cipher() is None:  # pragma: no cover - the suite env configures a key
        pytest.skip("no cipher configured; the write inversion (D-11) refuses before the reset")

    client = _RecordingSupabase([[dict(STORED_ROW)], [dict(STORED_ROW)]])
    await connector_service.update_connection(
        CONNECTION_ID,
        org_id=ACTIVE_ORG,
        payload=ConnectorConnectionUpdate(secret="a-brand-new-token"),
        supabase=client,
    )

    assert len(client.updates) == 1, (
        f"the replace issued {len(client.updates)} UPDATE(s). The reset must ride the SAME "
        f"update as the new ciphertext: {client.updates!r}"
    )
    changes = client.updates[0]
    assert changes.get("last_check_verdict") == "not_checked", (
        f"a secret REPLACE did not reset the verdict in the same UPDATE: {sorted(changes)!r}"
    )
    assert changes.get("last_checked_at") is None, (
        "the timestamp must be cleared with the verdict — a `not_checked` row still carrying "
        f"'checked 2 minutes ago' is a contradiction on the face of the table: {changes!r}"
    )
    assert "secret_ciphertext" in changes, (
        "the non-vacuity half: this must be the update that REPLACES the secret, not an "
        f"unrelated one that happened to reset a verdict: {sorted(changes)!r}"
    )


@pytest.mark.asyncio
async def test_record_check_verdict_writes_both_columns_and_is_org_scoped():
    """The check's side effect, in one place: two columns, one org-scoped UPDATE.

    It writes NEITHER `is_enabled` nor the secret — a failing check does not disable a
    connection, because disabling is a person's decision with a victim-naming confirm behind
    it (UI-SPEC §2g) and a background verdict must not make it silently.
    """
    client = _RecordingSupabase([[{**STORED_ROW, "last_check_verdict": "ok"}]])
    await connector_service.record_check_verdict(
        CONNECTION_ID, org_id=ACTIVE_ORG, verdict="ok", supabase=client
    )

    assert len(client.updates) == 1, client.updates
    changes = client.updates[0]
    assert set(changes) == {"last_check_verdict", "last_checked_at"}, (
        f"the verdict write touched more than its two columns: {sorted(changes)!r}"
    )
    assert (CONNECTION_ID, ACTIVE_ORG) == (
        dict(client.filters).get("id"),
        dict(client.filters).get("org_id"),
    ), (
        f"the verdict UPDATE was not scoped by BOTH id and org: {client.filters!r}. A verdict "
        "is a row mutation, so an unscoped predicate lets one tenant's check stamp another's."
    )

    with pytest.raises(ValueError):
        await connector_service.record_check_verdict(
            CONNECTION_ID, org_id=ACTIVE_ORG, verdict="not_checked",
            supabase=_RecordingSupabase([[dict(STORED_ROW)]]),
        )


# ══════════════════════════════════════════════════════════════════════════════════════════
# 7 · the check never accepts a secret in its request body
# ══════════════════════════════════════════════════════════════════════════════════════════
def test_the_check_never_accepts_a_secret_in_its_request_body(
    monkeypatch, mock_asyncpg_pool, mock_execute_result, router_client
):
    """The signature IS the security property — enforced, not merely intended.

    §5c: *"the check runs on the STORED connection, not the typed form — so no plaintext
    secret ever crosses the wire for a non-storage purpose."* The route therefore declares an
    id and its three dependencies, and NOTHING else. There is no body parameter through which
    a credential could arrive, which is a stronger statement than "we do not read one".

    Driven three ways, because each catches a different regression: the SIGNATURE (a body
    parameter added), the OpenAPI schema (a request body declared), and the WIRE (a POST
    carrying a `secret` is accepted and ignored — never used, never echoed).
    """
    signature = inspect.signature(connectors.check_connection)
    params = list(signature.parameters)
    assert params == ["connection_id", "current_user", "active_org", "supabase"], (
        f"the check route's parameters are {params!r}. It takes an id and its dependencies; "
        "a body parameter here would put a plaintext credential on the wire for a "
        "non-storage purpose, which is the one thing §5c's design exists to prevent."
    )
    for name, param in signature.parameters.items():
        annotation = str(param.annotation)
        assert not re.search(r"(?i)secret|password|token|credential", name + annotation), (
            f"the check route declares a credential-shaped parameter {name}: {annotation}"
        )

    schema = real_app.openapi()
    operation = schema["paths"]["/connectors/connections/{connection_id}/check"]["post"]
    assert "requestBody" not in operation, (
        f"the check route declares a request body in its OpenAPI schema: {operation!r}"
    )

    # And over the wire: a body carrying a secret changes nothing and is never echoed.
    _as_org_admin(monkeypatch, mock_asyncpg_pool)
    _install_feature(monkeypatch, "everyone")

    async def _owned_fetch(connection_id: str, org_id: str):
        return {**STORED_ROW, "org_id": org_id}

    monkeypatch.setattr(connector_service, "_fetch_connection_row", _owned_fetch)
    monkeypatch.setattr(
        "app.services.connectors.registry.get_adapter", lambda _c: _Recorder(ok=True)
    )
    mock_execute_result.data = [{**STORED_ROW, "last_check_verdict": "ok"}]

    smuggled = "xoxb-SMUGGLED-THROUGH-THE-CHECK-BODY-190-15"
    res = router_client.post(
        f"/connectors/connections/{CONNECTION_ID}/check",
        headers=_org_headers(),
        json={"secret": smuggled, "password": smuggled},
    )

    assert res.status_code == 200, res.text
    assert smuggled not in res.text, (
        f"the check echoed a credential submitted in its body: {res.text!r}"
    )


def test_the_check_response_model_can_not_carry_a_credential():
    """T7, applied to the check's own response. The MODEL is the gate, not the discipline."""
    fields = set(ConnectorCheckResponse.model_fields)
    assert "secret" not in fields and "secret_ciphertext" not in fields, (
        f"ConnectorCheckResponse grew a credential-bearing field: {sorted(fields)!r}"
    )
    with pytest.raises(Exception):
        ConnectorCheckResponse(ok=True, verdict="ok", secret="xoxb-nope")  # type: ignore[call-arg]


def test_every_Unreachable_error_is_in_the_routers_closed_unreachable_bucket():
    """§4d's `unreachable` bucket must not develop a hole when a fourth adapter lands.

    A transport miss that fell through to the `refused` or `rejected` branch would tell an
    admin their password is wrong about a host that simply did not answer — which is one of
    the two swaps §4d names by name: *"a refusal must never render the word 'failed', and an
    unreachable host must never render the word 'refused'."*
    """
    import pkgutil
    import importlib

    import app.services.connectors as package

    missing = []
    for module_info in pkgutil.iter_modules(package.__path__):
        module = importlib.import_module(f"{package.__name__}.{module_info.name}")
        for name, obj in vars(module).items():
            if (
                isinstance(obj, type)
                and issubclass(obj, BaseException)
                and name.endswith("Unreachable")
                and obj not in connectors._UNREACHABLE_ERRORS
            ):
                missing.append(f"{module_info.name}.{name}")

    assert not missing, (
        f"these transport-miss errors are NOT in the check route's closed unreachable "
        f"bucket: {missing!r}. They would land in `refused` or `rejected` instead, which "
        "sends the person to the wrong next step (§4d)."
    )
    assert len(connectors._UNREACHABLE_ERRORS) >= 3, (
        "the unreachable bucket collapsed; the assertion above would then be vacuous"
    )


# ── helpers ──────────────────────────────────────────────────────────────────────────────
def _phase(*, connection_id: str | None, capability: str = "post_message"):
    """A duck-typed `external_action` step — the executor reads config via `getattr`."""
    return SimpleNamespace(
        slug="notify-ops",
        phase_index=0,
        config=SimpleNamespace(
            phase_type="external_action",
            capability=capability,
            available_tools=[capability],
            connection_id=connection_id,
        ),
    )


def _run_ctx():
    """A permissive duck-typed run ctx. `is_golden_run=False` — D-16's suppression is a
    different property with its own fence, and a golden run here would skip the send and make
    every assertion below pass vacuously."""
    return SimpleNamespace(
        inputs={"text": "Renewal follow-up", "channel": "#ops-alerts"},
        user_settings=None,
        retry_feedback=None,
        run_id=None,
        thread_id=None,
        user_id=None,
        org_id=ACTIVE_ORG,
        is_golden_run=False,
    )


async def _noop_receipt(*_a, **_kw):
    return None


def _adapter_and_config(capability: str):
    if capability == "post_message":
        return slack_adapter.Adapter(), PostMessageConfig(
            default_channel="#ops-alerts"
        ).model_dump()
    if capability == "create_ticket":
        return jira_adapter.Adapter(), CreateTicketConfig(
            base_url="https://acme.atlassian.net",
            project_key="OPS",
            account_email="ops@acme.example",
        ).model_dump()
    return smtp_adapter.Adapter(), SendEmailConfig(
        host="smtp.acme.example",
        port=587,
        from_address="ops@acme.example",
        username="ops@acme.example",
        tls="starttls",
    ).model_dump()


class _FakeQueryParams(dict):
    """`httpx.QueryParams`' immutable `.set()` in four lines — the shape `_project` writes."""

    def set(self, key, value):  # noqa: A003 — mirrors httpx.QueryParams.set exactly
        merged = _FakeQueryParams(self)
        merged[key] = value
        return merged


class _RecordingSupabase:
    """A minimal supabase-py stand-in that RECORDS the update payload and the filters.

    Purpose-built rather than reaching into conftest's shared builder mock: this file asserts
    on `update(changes)` and on the `eq()` predicates, and a shared MagicMock's call history
    is contaminated by every other query in the same test.
    """

    def __init__(self, results: list[list[dict]]):
        self._results = list(results)
        self.updates: list[dict] = []
        self.filters: list[tuple[str, Any]] = []
        # CR-01 / migration 118 — the production code pins PostgREST's returning projection
        # with `connector_service._project(builder)`, which writes `builder.request.params`.
        # A double that lacks it would fail with AttributeError rather than measure anything,
        # so the shape is modelled here; `self.request.params["select"]` is then ASSERTABLE.
        self.request = SimpleNamespace(params=_FakeQueryParams())

    def table(self, _name):
        return self

    def select(self, *_a, **_kw):
        return self

    def insert(self, _row):
        return self

    def delete(self):
        return self

    def update(self, changes):
        self.updates.append(dict(changes))
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def order(self, *_a, **_kw):
        return self

    def limit(self, *_a, **_kw):
        return self

    def execute(self):
        data = self._results.pop(0) if self._results else []
        return SimpleNamespace(data=data)


# ══════════════════════════════════════════════════════════════════════════════════════════
# Phase 211 (T-211-13) · the THIRD shape reaches this route, and it must be NAMED
# ══════════════════════════════════════════════════════════════════════════════════════════
def test_check_refuses_a_service_only_connection_by_name_never_by_raising(
    monkeypatch, mock_asyncpg_pool, mock_execute_result, router_client
):
    """A SERVICE-ONLY row (CONN-08) has no adapter, so there is nothing to check.

    ⚠ THIS ROUTE ALREADY HAS THIS EXACT HISTORY, ONE SHAPE OVER, AND THAT IS WHY THE CASE
    EXISTS BEFORE THE 500 RATHER THAN AFTER IT. An MCP row's NULL ``capability`` reached
    ``registry.get_adapter``, which raises a BARE ``KeyError`` for anything outside its closed
    three-member set — a ``KeyError`` absent from this route's ``except`` ladder, so it escaped
    as an unhandled **HTTP 500** on a control the shipped UI offered. Migration 127 introduces
    a THIRD shape that arrives at the same two calls (``_check_destination`` then
    ``get_adapter``) by the same door, with a NULL capability of its own.

    ⚠ THE ADAPTER SEAM IS BOOBY-TRAPPED ON PURPOSE. ``get_adapter`` is patched to something
    that EXPLODES if it is called at all, so this case cannot pass merely because an adapter
    happened to tolerate the shape — it passes only if the refusal happens BEFORE the adapter
    is reached. A 409 obtained after ``get_adapter`` ran would be the same status for a
    different, worse reason.

    ⚠ IT MUST NOT BE A 404. The row IS in the caller's org and IS listed in their table, so
    "not found" would be a sentence that is not true about a row they can see — the identical
    defect measured on the MCP shape in live UAT on 2026-08-25. Naming its STATE discloses
    nothing across the tenant boundary, which is why 409 is the honest status.
    """
    _as_org_admin(monkeypatch, mock_asyncpg_pool)
    _install_feature(monkeypatch, "everyone")

    # No capability, no mcp_server_url, no secret — a row that names a service and nothing
    # else. It is stored EXACTLY like this: migration 127 drops the shape CHECK that used to
    # refuse it and requires only a non-blank `service_id` in its place.
    async def _service_only_fetch(connection_id: str, org_id: str):
        return {
            **STORED_ROW,
            "org_id": org_id,
            "capability": None,
            "service_id": "notion",
            "mcp_server_url": None,
            "secret_ciphertext": None,
            "config": {},
        }

    monkeypatch.setattr(connector_service, "_fetch_connection_row", _service_only_fetch)

    def _must_not_be_reached(_capability):
        raise AssertionError(
            "T-211-13: the check reached registry.get_adapter for a SERVICE-ONLY row. That "
            "call raises a bare KeyError on a NULL capability and this route does not catch "
            "it — the refusal must happen before it, not by surviving it."
        )

    monkeypatch.setattr("app.services.connectors.registry.get_adapter", _must_not_be_reached)

    res = router_client.post(
        f"/connectors/connections/{CONNECTION_ID}/check", headers=_org_headers()
    )

    assert res.status_code == 409, (
        f"a service-only row must be refused by NAME, got {res.status_code}: {res.text}"
    )
    detail = res.json()["detail"]
    assert detail["reason_code"] == "nothing_to_check_yet", detail
    # ⚠ SEPARATELY FALSIFIABLE FROM THE MCP ARM. Two shapes, two reason codes: an arm that
    # absorbed both would make the two refusals indistinguishable to a client that has to word
    # them differently, and would hide a regression in either.
    assert detail["reason_code"] != "check_not_available_for_mcp", detail
    # The row never had a server URL, so naming one would be a lie about its shape.
    assert "mcp_server_url" not in res.text.lower(), res.text
