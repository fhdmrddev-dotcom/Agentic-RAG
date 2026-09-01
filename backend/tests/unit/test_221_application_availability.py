"""Phase 221 plan 02 (D-221-04) — three states, told apart because their remedies are opposite.

⚠ NOT ONE TEST HERE MAKES A REAL NETWORK CALL. Every arm is driven against a RECORDED Google
error body — the shapes measured live on 2026-08-31 when three of six applications were
switched off in the Cloud project. The live drive is a UAT row, run by hand.

The properties, and why each one's absence would be invisible:

  1. `SERVICE_DISABLED` and `ACCESS_TOKEN_SCOPE_INSUFFICIENT` are BOTH bare `PERMISSION_DENIED`
     at the HTTP layer. Collapsing them produces a refusal that sends the operator to
     re-consent scopes that were already correct — measured, and the reason this file exists.

  2. A 404 means the API ANSWERED. Reading it as a failure would report Sheets and Docs as
     broken on a connection where they work.

  3. An unreachable probe must be `unknown`. Rendering "your API is switched off" because our
     own DNS failed is a refusal naming the wrong cause, one layer further out.

  4. `error.message` echoes the caller's query — for Drive and Gmail, the person's own search
     terms. A test that plants a recognisable string and proves it never reaches the response
     is the only way that stays true after someone "improves" the diagnostics.
"""
from __future__ import annotations

import json

import pytest

from app.models.connector import ApplicationAvailability, ConnectorCheckResponse
from app.services.connectors.service_tools import SERVICE_TOOL_SPECS
from app.services.google import availability as avail
from app.services.google.availability import (
    APPLICATION_PROBES,
    classify_probe_response,
    probe_google_applications,
)

# ── recorded bodies ──────────────────────────────────────────────────────────────────────
#
# ⚠ These are Google's SHAPES, not invented ones. `details[].reason` with a
# `metadata.activationUrl` is what Sheets and Docs answered on 2026-08-31; People answered
# the scope shape on the same token in the same minute. That both arrived as an
# indistinguishable bare `PERMISSION_DENIED` is the whole finding.

#: A string that must never appear in anything this module returns. It stands in for the
#: echoed query — the real bodies carry the person's own search terms here.
SECRET_QUERY_ECHO = "salary-review-confidential-2026"


def _disabled_body(service: str = "sheets.googleapis.com") -> str:
    return json.dumps(
        {
            "error": {
                "code": 403,
                "message": f"Google Sheets API has not been used in project 877112366454 before "
                           f"or it is disabled. Query was: {SECRET_QUERY_ECHO}",
                "status": "PERMISSION_DENIED",
                "details": [
                    {
                        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                        "reason": "SERVICE_DISABLED",
                        "domain": "googleapis.com",
                        "metadata": {
                            "service": service,
                            "activationUrl": (
                                "https://console.developers.google.com/apis/api/"
                                f"{service}/overview?project=877112366454"
                            ),
                        },
                    }
                ],
            }
        }
    )


def _scope_body() -> str:
    return json.dumps(
        {
            "error": {
                "code": 403,
                "message": f"Request had insufficient authentication scopes. Query: {SECRET_QUERY_ECHO}",
                "status": "PERMISSION_DENIED",
                "details": [
                    {
                        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                        "reason": "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
                        "domain": "googleapis.com",
                        "metadata": {"service": "people.googleapis.com"},
                    }
                ],
            }
        }
    )


def _not_found_body() -> str:
    return json.dumps(
        {"error": {"code": 404, "message": "Requested entity was not found.", "status": "NOT_FOUND"}}
    )


# ── 1 · the two opposite remedies ────────────────────────────────────────────────────────


def test_service_disabled_is_api_off_with_a_console_url():
    state, console = classify_probe_response(403, _disabled_body())
    assert state == "api_off"
    assert console.startswith("https://console.developers.google.com/")
    assert "sheets.googleapis.com" in console


def test_scope_insufficient_is_scope_missing_and_carries_no_console_url():
    state, console = classify_probe_response(403, _scope_body())
    assert state == "scope_missing"
    # ⚠ THE ABSENCE IS THE ASSERTION. A console link on this arm sends someone to the one
    # place that cannot fix their problem.
    assert console == ""


def test_the_two_403s_do_not_produce_the_same_answer():
    """⭐ The point of the whole file, as one assertion.

    Both bodies are HTTP 403 with `status: PERMISSION_DENIED`. If a future refactor reads
    only the status — which is exactly what the code did before 2026-08-31 — this is the
    test that fails.
    """
    disabled = classify_probe_response(403, _disabled_body())
    scope = classify_probe_response(403, _scope_body())
    assert disabled != scope
    assert disabled[0] == "api_off" and scope[0] == "scope_missing"
    assert bool(disabled[1]) and not bool(scope[1])


# ── 2 · an answer is an answer ───────────────────────────────────────────────────────────


def test_404_is_ready_because_the_api_answered():
    """The Sheets and Docs probes ask for a document that cannot exist ON PURPOSE."""
    assert classify_probe_response(404, _not_found_body())[0] == "ready"


@pytest.mark.parametrize("code", [200, 201, 204])
def test_any_2xx_is_ready(code):
    assert classify_probe_response(code, b"{}")[0] == "ready"


@pytest.mark.parametrize("code", [400, 404, 409, 429])
def test_any_other_4xx_is_ready(code):
    assert classify_probe_response(code, b"{}")[0] == "ready"


# ── 3 · not knowing is its own answer ────────────────────────────────────────────────────


@pytest.mark.parametrize("code", [500, 502, 503])
def test_a_server_error_is_unknown_not_blocked(code):
    """Google having a bad moment is not a fact about this project's configuration."""
    assert classify_probe_response(code, b"{}")[0] == "unknown"


def test_a_401_is_unknown_not_ready():
    """⚠ A NARROWING OF "any other 4xx is ready", and deliberate.

    A 401 means the token was rejected, so the application was never reached and nothing
    about it was measured. `ready` would assert a fact nobody established.
    """
    assert classify_probe_response(401, b"{}")[0] == "unknown"


async def test_unreachable_is_unknown_not_blocked(monkeypatch):
    """A transport failure must never render as "your API is switched off"."""

    async def _boom(*args, **kwargs):
        raise RuntimeError("dns went away")

    monkeypatch.setattr(avail, "send_pinned_http", _boom)
    monkeypatch.setattr(avail, "get_fresh_access_token", _fake_token)

    verdicts = await probe_google_applications("conn-1", _all_scopes())
    assert {v["state"] for v in verdicts} == {"unknown"}
    assert all(v["console_url"] is None for v in verdicts)


async def test_no_token_is_unknown_for_every_application(monkeypatch):
    """⚠ NOT six `scope_missing` verdicts. The connection is broken as a whole, and the
    check's own credential verdict is the sentence that says so."""

    async def _no_token(*args, **kwargs):
        return None

    monkeypatch.setattr(avail, "get_fresh_access_token", _no_token)
    monkeypatch.setattr(avail, "send_pinned_http", _must_not_be_called)

    verdicts = await probe_google_applications("conn-1", _all_scopes())
    assert {v["state"] for v in verdicts} == {"unknown"}


# ── 4 · the echoed query never travels ───────────────────────────────────────────────────


def test_error_message_never_travels():
    """Planted in `error.message`, asserted absent from everything that leaves."""
    for body in (_disabled_body(), _scope_body()):
        assert SECRET_QUERY_ECHO in body, "the plant must actually be in the body"
        state, console = classify_probe_response(403, body)
        assert SECRET_QUERY_ECHO not in state
        assert SECRET_QUERY_ECHO not in console


async def test_error_message_never_travels_through_the_whole_probe(monkeypatch):
    """The end-to-end half — a helper that filters nothing would still pass the unit above."""

    class _Resp:
        status_code = 403
        headers: dict = {}
        body = _disabled_body().encode()

    async def _resp(*args, **kwargs):
        return _Resp()

    monkeypatch.setattr(avail, "send_pinned_http", _resp)
    monkeypatch.setattr(avail, "get_fresh_access_token", _fake_token)

    verdicts = await probe_google_applications("conn-1", _all_scopes())
    assert SECRET_QUERY_ECHO not in json.dumps(verdicts)
    assert {v["state"] for v in verdicts} == {"api_off"}


async def test_the_response_model_cannot_carry_the_echo():
    """The Pydantic gate: `extra='forbid'` plus a closed state union.

    A body-carrying field cannot be added to the response without this failing.
    """
    with pytest.raises(Exception):
        ApplicationAvailability(app="drive", state="ready", provider_message=SECRET_QUERY_ECHO)


# ── 5 · the scope arm is arithmetic, not a network call ──────────────────────────────────


async def test_missing_scope_needs_no_network(monkeypatch):
    """⚠ Driven with the transport STUBBED TO RAISE. If the scope arm reached for it at all,
    this test fails — which is the only way to prove an absence of I/O."""
    monkeypatch.setattr(avail, "send_pinned_http", _must_not_be_called)
    monkeypatch.setattr(avail, "get_fresh_access_token", _must_not_be_called)

    verdicts = await probe_google_applications("conn-1", [])
    assert {v["state"] for v in verdicts} == {"scope_missing"}
    assert len(verdicts) == len(APPLICATION_PROBES)


async def test_a_granted_application_is_probed_while_an_ungranted_one_is_not(monkeypatch):
    """The mixed case — and the assertion is on WHICH urls were fetched, not on a count."""
    fetched: list[str] = []

    class _Ok:
        status_code = 200
        headers: dict = {}
        body = b"{}"

    async def _record(capability, method, url, **kwargs):
        fetched.append(url)
        return _Ok()

    monkeypatch.setattr(avail, "send_pinned_http", _record)
    monkeypatch.setattr(avail, "get_fresh_access_token", _fake_token)

    only_drive = [APPLICATION_PROBES["drive"].scope]
    verdicts = {v["app"]: v["state"] for v in await probe_google_applications("c", only_drive)}

    assert verdicts["drive"] == "ready"
    assert verdicts["gmail"] == "scope_missing"
    assert len(fetched) == 1
    assert fetched[0] == APPLICATION_PROBES["drive"].url


# ── 6 · the fence: an application cannot exist without a probe ───────────────────────────


def test_every_google_application_has_a_probe():
    """⚠ THIS IS THE INVARIANT THAT REPLACES A SECOND TABLE.

    An earlier shape declared scope+service in `service_tools.py` and kept the URL here, so
    that "an application cannot exist without a probe" was a convention. Two tables that must
    agree is this repository's most-repeated defect. It is a fence instead: add a seventh
    Google application without a probe and this fails by name.
    """
    apps = {spec["app"] for spec in SERVICE_TOOL_SPECS["google"] if spec.get("app")}
    missing = apps - set(APPLICATION_PROBES)
    assert not missing, f"Google applications with no availability probe: {sorted(missing)}"
    extra = set(APPLICATION_PROBES) - apps
    assert not extra, f"probes for applications that do not exist: {sorted(extra)}"


def test_every_probe_uses_its_own_applications_read_key():
    """⚠ A Calendar probe must not be able to reach Gmail.

    Each application has its own egress allow-list key precisely so one surface cannot reach
    another's host. A probe borrowing a sibling's key would undo that quietly.
    """
    for app, probe in APPLICATION_PROBES.items():
        assert probe.capability == f"{app}_read", (
            f"{app} probes under {probe.capability!r}, not its own read key"
        )


def test_no_probe_travels_under_a_write_key():
    """The reads-only guarantee, asserted rather than assumed."""
    for app, probe in APPLICATION_PROBES.items():
        assert not probe.capability.endswith("_write"), f"{app} probes under a WRITE key"
        assert probe.scope.endswith(".readonly") or "readonly" in probe.scope, (
            f"{app}'s probe scope {probe.scope!r} is not a read-only scope"
        )


# ── 7 · the shape the check action returns ───────────────────────────────────────────────


def test_an_empty_availability_list_is_the_default():
    """⚠ EMPTY MEANS "NOTHING WAS MEASURED", never "everything is fine". Every non-Google
    shape returns this, and the frontend must not read it as six greens."""
    resp = ConnectorCheckResponse(ok=True, verdict="ok")
    assert resp.application_availability == []


def test_console_url_is_absent_unless_the_api_is_off():
    assert ApplicationAvailability(app="drive", state="ready").console_url is None
    assert ApplicationAvailability(app="drive", state="scope_missing").console_url is None


def test_the_state_union_is_closed():
    """A fifth state cannot be introduced by a caller passing a string."""
    with pytest.raises(Exception):
        ApplicationAvailability(app="drive", state="probably_fine")


# ── helpers ──────────────────────────────────────────────────────────────────────────────


def _all_scopes() -> list[str]:
    return [p.scope for p in APPLICATION_PROBES.values()]


async def _fake_token(*args, **kwargs) -> str:
    return "ya29.fake-access-token"


async def _must_not_be_called(*args, **kwargs):
    raise AssertionError("this arm must not perform I/O")
