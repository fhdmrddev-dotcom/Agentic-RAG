"""Phase 190 · T13 — Slack answers **HTTP 200** for a message it never posted.

⭐ **THIS FILE EXISTS FOR ONE SENTENCE, AND THE VENDOR WROTE IT** (RESEARCH §R11, sourced
from docs.slack.dev — *chat.postMessage*):

> Errors return **HTTP 200** with a JSON body ``{"ok": false, "error": "<code>"}``.

A status-line check therefore reads ``channel_not_found``, ``not_authed``, ``invalid_auth``,
``missing_scope`` and ``rate_limited`` as **SUCCESS**. On the one surface in this app whose
entire discipline is not over-claiming, that is D-31's *"a phase reads Complete for a send
that did not leave the app"* verbatim, and UI-SPEC §8c calls it **the likeliest lie this
phase ships**.

**The contract these cases enforce:** a Slack send is successful **iff
``status_code == 200`` AND ``json()["ok"] is True``** — an IDENTITY check against ``True``,
because ``{"ok": "false"}`` is a non-empty string and every truthiness test in Python says
yes to it. Anything else lands ``failed`` (D-17) and never the complete reading.

⚠ **THE SIBLING ADAPTER'S CONTRACT IS THE OPPOSITE OF THIS ONE.** Jira signals failure with
real HTTP status codes, so a status-line check is CORRECT there. One helper cannot be right
about both vendors, so there is none: ``test_jira_and_slack_do_not_share_a_response_checker``
in ``test_190_jira_adapter.py`` fences the sibling, and
``test_slack_borrows_no_response_interpretation_from_a_sibling`` below fences this side. The
seam in ``protocol.py`` declares no shared checker either, and says in its own docstring that
the omission is a decision.

⚠ **THE PLANT MUST REACH THE PROPERTY, NOT THE FENCE** — plans 190-08 and 190-10 both
recorded this the hard way (190-08's plant left its three target cases GREEN because
composition refused one frame earlier, so it measured a token fence rather than the security
property). The T13 plant this file is written for removes the ``ok`` gate and leaves the
status gate standing, so the adapter reaches its own success log line with a reply that says
``ok: false`` — and the CAPTURED LOG, not the assertion, is what proves the threat happened.

⚠ **T14 — the host is matched from the PARSED url and never the raw string.**
``https://slack.com@evil.com/`` contains the literal ``slack.com`` and resolves to
``evil.com``; ``https://xn--slck-hoa.com/`` is a homograph that httpx IDNA-DECODES into a
non-ASCII host. Both are driven below against the REAL guard, with the raw-string trap shown
passing as an inline positive control so the case cannot quietly become vacuous.
"""

from __future__ import annotations

import hashlib
import inspect
import json as jsonlib
import pathlib

import pytest

from app.security.egress import (
    SLACK_API_BASE,
    EgressRefused,
    PinnedResponse,
    validate_destination,
)

# ── the fixtures ──────────────────────────────────────────────────────────────
#: Slack's NON-secret config is a channel and NOTHING else (D-02 / ``PostMessageConfig``).
#: There is no ``base_url``, no ``host`` and no ``webhook_url`` field to put a URL in.
SLACK_CONFIG = {"default_channel": "C0123ABCDEF"}

#: A value that must never appear in a refusal, a result, a log line or a request BODY.
SLACK_TOKEN_SENTINEL = "xoxb-SLACK-BOT-TOKEN-SENTINEL-MUST-NEVER-BE-LOGGED-190"

GOOD_TEXT = "The renewal window closed on Tuesday. Nobody has signed the addendum."

#: §R11's eight documented codes, verbatim from Slack's own reference. Every one is a
#: FAILURE and every one is surfaced unparaphrased (the 071-A verbatim-provider-error rule).
SLACK_ERROR_CODES = (
    "channel_not_found",
    "not_authed",
    "invalid_auth",
    "missing_scope",
    "rate_limited",
    "no_text",
    "invalid_blocks",
    "too_many_attachments",
)

#: What a real success looks like: ``ok`` true plus the message timestamp.
SLACK_OK = {
    "ok": True,
    "channel": "C0123ABCDEF",
    "ts": "1735689600.001900",
    "message": {"text": GOOD_TEXT, "type": "message"},
}

#: What ``auth.test`` answers for a working bot token.
SLACK_AUTH_OK = {
    "ok": True,
    "url": "https://acme.slack.example/",
    "team": "Acme",
    "user": "workflows-bot",
    "team_id": "T0001",
    "user_id": "U0001",
    "bot_id": "B0001",
}


def _error(code: str, **extra) -> dict:
    """Slack's failure envelope — **at HTTP 200**, which is the whole point of this file."""
    return {"ok": False, "error": code, **extra}


class _Credential:
    """The one thing an adapter reads from a resolved connection (``protocol.CredentialLike``).

    Structural rather than a real ``ResolvedConnection`` so every case here runs with no
    database and no encryption key.
    """

    @property
    def secret(self) -> str:
        return SLACK_TOKEN_SENTINEL


def _json_response(status: int, payload: object) -> PinnedResponse:
    """A ``PinnedResponse`` exactly as ``egress.send_pinned_http`` returns it — UNINTERPRETED.

    ⚠ Note what the NamedTuple deliberately does not carry: a ``success`` flag. Its own
    docstring says why — Slack's ``200 {"ok": false}`` and Jira's status codes disagree, so a
    shared notion of success inside the binder would have been the T13 defect one layer lower.
    """
    return PinnedResponse(
        status_code=status,
        headers={"content-type": "application/json"},
        body=jsonlib.dumps(payload).encode("utf-8"),
    )


def _raw_response(status: int, body: bytes, content_type: str = "text/html") -> PinnedResponse:
    return PinnedResponse(status_code=status, headers={"content-type": content_type}, body=body)


class _Recorder:
    """Records every outgoing call and replays queued responses. No socket is involved.

    A LIST of outcomes rather than one, because D-18's at-most-once case has to be able to
    tell *"the adapter tried again"* from *"the adapter tried once"* — and the second queued
    outcome is deliberately a SUCCESS, so an adapter that retried would report a posted
    message rather than failing noisily.
    """

    def __init__(self, *outcomes) -> None:
        self.calls: list[dict] = []
        self._outcomes = list(outcomes)

    async def __call__(self, capability, method, url, **kwargs):
        self.calls.append({"capability": capability, "method": method, "url": url, **kwargs})
        outcome = self._outcomes.pop(0) if self._outcomes else _json_response(200, SLACK_OK)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome

    @property
    def only_call(self) -> dict:
        assert len(self.calls) == 1, (
            f"expected exactly ONE call to the egress binder, recorded {len(self.calls)}"
        )
        return self.calls[0]

    @property
    def body(self) -> dict:
        return self.only_call["json"]

    @property
    def headers(self) -> dict:
        return self.only_call["headers"] or {}


def _adapter():
    """Resolve the module under test, failing with a NAMED message rather than a collection
    error.

    Plans 190-01, 190-02, 190-07, 190-08 and 190-10 each recorded the same lesson: a
    module-scope import of a not-yet-written module produces ONE collection error and ZERO
    named failures, which measures the import system rather than the property. Every case
    below therefore fails on its own, and the ``ModuleNotFoundError`` text still travels
    verbatim inside the message so the RED is unambiguous.
    """
    try:
        import app.services.connectors.slack_adapter as module
    except ModuleNotFoundError as exc:  # pragma: no cover - the RED path
        pytest.fail(
            f"{exc} - plan 190-11 owns app/services/connectors/slack_adapter.py. "
            "T13/R11: post_message POSTs chat.postMessage to the CODE-CONSTANT Slack API "
            "base through egress.send_pinned_http and nothing else, with the bot token in "
            "the Authorization header and never in the body, and a send is successful IFF "
            "status_code == 200 AND the reply's ok is True."
        )
    return module


def _install_transport(monkeypatch, recorder: _Recorder):
    """Replace the adapter's binder with the recorder, IN THE ADAPTER'S OWN NAMESPACE.

    Patching the name here rather than in ``egress`` also proves the adapter IMPORTED the
    binder rather than building a client of its own — D-05 asserted by construction as well
    as by the source fence at the end of this file.
    """
    module = _adapter()
    monkeypatch.setattr(module, "send_pinned_http", recorder)
    return module


async def _post(monkeypatch, *, text=GOOD_TEXT, recorder=None, config=None):
    recorder = recorder if recorder is not None else _Recorder()
    module = _install_transport(monkeypatch, recorder)
    result = await module.Adapter().send(
        args={"text": text},
        credential=_Credential(),
        config=dict(config or SLACK_CONFIG),
    )
    return result, recorder


def _rendered(exc) -> str:
    """Everything a person or a log could see of a failure, in one string."""
    return f"{exc!s} {exc!r} {getattr(exc, 'result', None)!r} {getattr(exc, 'bucket', None)!r}"


# ── 1 · ⭐ THE TRAP · a 200 carrying ok:false is FAILED and never the complete reading ──
async def test_a_200_with_ok_false_lands_FAILED_and_never_COMPLETED(monkeypatch):
    """The single case this whole plan exists for.

    Slack answered ``200``. The message does not exist. The adapter must say so — and it must
    not say the other thing: **D-31's failure condition is asserted DIRECTLY here**, by
    requiring that the word a completed phase renders appears nowhere in anything this failure
    produces. An adapter that merely returned a falsy flag while carrying agreeable prose would
    still hand a renderer the material for the lie.
    """
    module = _adapter()
    recorder = _Recorder(_json_response(200, _error("channel_not_found")))

    with pytest.raises(module.SlackPostFailed) as excinfo:
        await _post(monkeypatch, recorder=recorder)

    failure = excinfo.value
    assert failure.result.ok is False, "a reply saying ok:false produced an ok=True verdict"
    assert failure.result.raw_status == 200, (
        "the status line is RECORDED for the audit receipt even though it decided nothing"
    )
    assert "channel_not_found" in _rendered(failure), (
        "the failure does not carry Slack's own error code"
    )

    # D-31, asserted rather than described. `completed` is the shipped status word and
    # `complete` is the reading on the card; neither may appear anywhere in a failed send.
    rendered = _rendered(failure).lower()
    assert "complete" not in rendered, (
        f"a FAILED Slack send rendered the completion vocabulary: {rendered!r}"
    )

    # §4d: the host answered and said no, so this is `rejected` — not `refused` (which is OUR
    # guard declining) and not `unreachable` (which is nothing answering).
    assert failure.bucket == "rejected"


# ── 2 · all eight documented codes ────────────────────────────────────────────
@pytest.mark.parametrize("code", SLACK_ERROR_CODES)
async def test_each_of_the_eight_documented_error_codes_lands_failed(monkeypatch, code):
    """§R11's eight codes, each driven, each a failure, each surfaced verbatim.

    Parametrised rather than looped so a single code that regresses names itself in the
    failure output instead of hiding behind the first one.
    """
    module = _adapter()
    recorder = _Recorder(_json_response(200, _error(code)))

    with pytest.raises(module.SlackPostFailed) as excinfo:
        await _post(monkeypatch, recorder=recorder)

    assert excinfo.value.result.ok is False
    assert excinfo.value.result.provider_message == code, (
        f"{code!r} was not surfaced verbatim (got "
        f"{excinfo.value.result.provider_message!r})"
    )
    assert "complete" not in _rendered(excinfo.value).lower()


# ── 3 · the NON-VACUITY control ───────────────────────────────────────────────
async def test_a_200_with_ok_true_is_the_ONLY_success(monkeypatch):
    """Without this case, an adapter that fails EVERYTHING passes cases 1 and 2 forever.

    It is the same role 190-08's positive control played: a fence that can only ever say no
    has not been shown to say yes about the right thing.
    """
    result, recorder = await _post(monkeypatch, recorder=_Recorder(_json_response(200, SLACK_OK)))

    assert result.ok is True
    assert result.raw_status == 200
    assert result.provider_message == "", (
        "Slack said nothing on success, so nothing may be quoted on its behalf"
    )
    assert recorder.only_call["method"] == "POST"


async def test_ok_as_the_STRING_false_is_not_a_success(monkeypatch):
    """``{"ok": "false"}`` — a non-empty STRING, and therefore TRUTHY.

    This is why the gate is an IDENTITY check against ``True`` rather than a truthiness test.
    A malformed or proxied reply that stringifies the flag must not be read as a posted
    message, and ``if payload.get("ok"):`` would read it as one. Driven alongside the other
    shapes a JSON ``ok`` field can arrive in.
    """
    module = _adapter()
    for value in ("false", "true", 1, 0, [], {}, None, "yes"):
        recorder = _Recorder(_json_response(200, {"ok": value, "error": "not_authed"}))
        with pytest.raises(module.SlackPostFailed):
            await _post(monkeypatch, recorder=recorder)


# ── 4 · the other half of the AND ─────────────────────────────────────────────
async def test_a_non_200_is_also_a_failure(monkeypatch):
    """``status == 200`` is necessary as well as insufficient.

    Slack does answer with real status codes for some conditions (a 429 with a
    ``Retry-After``, a 5xx from the edge), and an adapter that only read ``ok`` would treat a
    gateway's HTML error page — which carries no ``ok`` field at all — as ambiguous rather
    than as the failure it is.
    """
    module = _adapter()
    for response in (
        _json_response(429, _error("rate_limited")),
        _json_response(500, {"ok": False}),
        _raw_response(502, b"<html><body>Bad Gateway</body></html>"),
        _raw_response(200, b"<html>we are down</html>"),  # a 200 that is not even JSON
    ):
        recorder = _Recorder(response)
        with pytest.raises(module.SlackPostFailed) as excinfo:
            await _post(monkeypatch, recorder=recorder)
        assert excinfo.value.result.ok is False
        assert "complete" not in _rendered(excinfo.value).lower()


# ── 5 · verbatim, not translated ──────────────────────────────────────────────
async def test_the_error_code_is_rendered_verbatim_not_translated(monkeypatch):
    """071-A: the vendor's words survive unparaphrased, untranslated and UNTRUNCATED.

    A paraphrase is a second truth-teller — the person then has to decide which of the two
    strings is the real one, and the only string Slack will recognise in its own
    documentation is the one it sent.
    """
    module = _adapter()
    recorder = _Recorder(
        _json_response(200, _error("missing_scope", needed="chat:write", provided="im:read"))
    )
    with pytest.raises(module.SlackPostFailed) as excinfo:
        await _post(monkeypatch, recorder=recorder)

    words = excinfo.value.result.provider_message
    assert words == "missing_scope", (
        f"the code was rewritten on the way out: {words!r}. It is rendered, never translated."
    )
    # Not a prefix, not a suffix, not a sentence built around it — the exact vendor string.
    assert not words.startswith("Slack") and words.strip() == words


# ── 6 · the token travels in the HEADER, never in the body ────────────────────
async def test_the_token_is_sent_in_the_HEADER_not_in_the_body(monkeypatch):
    """D-08 / §R11. Slack accepts a POST ``token`` parameter; we deliberately do not use it.

    **A token in a body is a token in a log**: request bodies are the thing an integration
    logs first, and the composed message text is already there. The header keeps the
    credential in the one place nothing in this app writes out.
    """
    _, recorder = await _post(monkeypatch)

    headers = recorder.headers
    authorization = next(
        (v for k, v in headers.items() if k.lower() == "authorization"), None
    )
    assert authorization is not None, "no Authorization header reached the binder"
    assert authorization == f"Bearer {SLACK_TOKEN_SENTINEL}"

    body = recorder.body
    assert isinstance(body, dict)
    assert "token" not in body, "the bot token was placed in the request BODY"
    assert SLACK_TOKEN_SENTINEL not in jsonlib.dumps(body), (
        "the credential reached the request body under some other key"
    )
    # And the body is the thin two Slack requires, with nothing else along for the ride.
    assert set(body) == {"channel", "text"}
    assert body["channel"] == SLACK_CONFIG["default_channel"]
    assert body["text"] == GOOD_TEXT


async def test_the_bot_token_never_appears_in_a_failure(monkeypatch):
    """D-08, driven across EVERY failure shape this adapter can produce.

    A leak needs only one of them, so asserting the clean path is worthless here. 190-10
    recorded the corollary: removing a failure path removes its leak coverage too.
    """
    module = _adapter()
    outcomes = [
        _json_response(200, _error("invalid_auth")),
        _json_response(401, {"ok": False, "error": "not_authed"}),
        _raw_response(500, b"<html>boom</html>"),
        OSError("connection reset by peer"),
    ]
    for outcome in outcomes:
        recorder = _Recorder(outcome)
        with pytest.raises(module.SlackAdapterError) as excinfo:
            await _post(monkeypatch, recorder=recorder)
        assert SLACK_TOKEN_SENTINEL not in _rendered(excinfo.value), (
            f"the bot token leaked into {_rendered(excinfo.value)!r}"
        )


# ── 7 · D-02 · the host is a code constant and NOTHING can move it ────────────
async def test_the_host_is_a_code_constant_and_no_config_url_can_move_it(monkeypatch):
    """D-02's *unforgeable by construction* claim, asserted four independent ways.

    This is the destination the guard suite uses as its negative control, so "there is no
    user-supplied URL" has to be a measurement rather than a description.
    """
    module = _adapter()

    # (a) the shipped config model has exactly one field, and it is not a URL.
    from app.models.connector import PostMessageConfig

    assert set(PostMessageConfig.model_fields) == {"default_channel"}

    # (b) a stored config carrying a base_url is REFUSED outright, and nothing reaches the
    #     wire. Stronger than "ignored": an ignored key still describes an intent the system
    #     silently discards, and `extra='forbid'` makes the key unconstructable instead.
    recorder = _Recorder()
    _install_transport(monkeypatch, recorder)
    with pytest.raises(module.SlackConfigInvalid):
        await module.Adapter().send(
            args={"text": GOOD_TEXT},
            credential=_Credential(),
            config={"default_channel": "C1", "base_url": "https://evil.com/"},
        )
    assert recorder.calls == [], "a config carrying a hostile base_url still reached the wire"

    # (c) the URL builder cannot SEE stored data — it takes the API method and nothing else.
    #     A destination that cannot depend on config is a destination config cannot move.
    parameters = list(inspect.signature(module._endpoint).parameters)
    assert parameters == ["method"], (
        f"_endpoint takes {parameters!r}; anything beyond the API method is a door for a "
        "stored value to reach the destination"
    )

    # (d) a normal send lands on the module constant, exactly.
    _, recorder = await _post(monkeypatch)
    assert recorder.only_call["url"] == SLACK_API_BASE + "chat.postMessage"
    assert recorder.only_call["url"].startswith(SLACK_API_BASE)
    assert recorder.only_call["capability"] == "post_message"


# ── 8 · D-18 · at MOST once ───────────────────────────────────────────────────
async def test_the_adapter_never_retries_on_rate_limited(monkeypatch):
    """``rate_limited`` is the code an author of a retry loop reaches for. There is none.

    ⚠ The recorder's SECOND queued outcome is a SUCCESS on purpose: an adapter that tried
    again would have reported a posted message rather than failing noisily, so this case
    fails loudly in exactly the way a silent second attempt would otherwise pass.
    """
    module = _adapter()
    recorder = _Recorder(
        _json_response(200, _error("rate_limited")),
        _json_response(200, SLACK_OK),
    )
    with pytest.raises(module.SlackPostFailed):
        await _post(monkeypatch, recorder=recorder)

    assert len(recorder.calls) == 1, (
        f"D-18 is at-MOST-once; the adapter reached the binder {len(recorder.calls)} times. "
        "Slack's endpoint takes no idempotency key at this scope, so a second attempt posts "
        "a second message."
    )


# ── 9 · check() authenticates and posts NOTHING ───────────────────────────────
async def test_check_calls_auth_test_and_posts_NOTHING(monkeypatch):
    """UI-SPEC §5c: *"Credential works — and nothing was sent"* — proved, not claimed.

    Both halves are asserted. The identity endpoint must be REACHED (a check that reaches
    nothing has established nothing), and the delivery endpoint must never be.
    """
    module = _adapter()
    recorder = _Recorder(_json_response(200, SLACK_AUTH_OK))
    _install_transport(monkeypatch, recorder)

    verdict = await module.Adapter().check(credential=_Credential(), config=dict(SLACK_CONFIG))

    assert verdict.ok is True
    assert recorder.only_call["url"] == SLACK_API_BASE + "auth.test"
    assert all("chat.postMessage" not in call["url"] for call in recorder.calls), (
        "the credential check reached the DELIVERY endpoint"
    )
    assert recorder.only_call.get("json") is None, "the check carried a message body"

    # §5c renders WHO we authenticated as; the vendor's own two words are what it renders.
    assert "workflows-bot" in (verdict.identity or "")
    assert "Acme" in (verdict.identity or "")


async def test_check_reports_a_200_ok_false_as_a_REJECTED_credential(monkeypatch):
    """The same trap on the check path — and its own §4d word.

    ``auth.test`` answers ``200 {"ok": false, "error": "invalid_auth"}`` for a revoked token.
    A check that read the status line would paint a dead credential green, which is worse
    than a failed send: it is a green light the person acts on later.
    """
    module = _adapter()
    recorder = _Recorder(_json_response(200, _error("invalid_auth")))
    _install_transport(monkeypatch, recorder)

    verdict = await module.Adapter().check(credential=_Credential(), config=dict(SLACK_CONFIG))

    assert verdict.ok is False
    assert verdict.identity is None
    assert verdict.provider_message == "invalid_auth"


# ── 10 · §4d · three states, three ROUTES ─────────────────────────────────────
async def test_an_egress_refusal_propagates_unchanged_as_a_refusal(monkeypatch):
    """UI-SPEC §4d's *refused* is OUR decision and keeps its authored reason code.

    Catching it here and re-raising it as an adapter failure would replace an authored
    sentence with an improvised one and lose the code the renderer keys off — the exact swap
    §4d names as the likeliest copy defect on this surface.
    """
    module = _adapter()
    refusal = EgressRefused(
        reason_code="address_not_public", host="slack.com", capability="post_message",
        ip="169.254.169.254",
    )
    recorder = _Recorder(refusal)
    with pytest.raises(EgressRefused) as excinfo:
        await _post(monkeypatch, recorder=recorder)
    assert excinfo.value.reason_code == "address_not_public"
    assert not isinstance(excinfo.value, module.SlackAdapterError)


async def test_a_transport_failure_that_reached_nothing_is_UNREACHABLE(monkeypatch):
    """Nothing answered → §4d's *unreachable*, with **no invented status**.

    ``raw_status`` stays ``None`` because there was no reply to read one from; putting a
    number there would be a wire fact we made up.
    """
    module = _adapter()
    recorder = _Recorder(OSError("connection reset by peer"))
    with pytest.raises(module.SlackPostFailed) as excinfo:
        await _post(monkeypatch, recorder=recorder)

    assert excinfo.value.bucket == "unreachable"
    assert excinfo.value.result.raw_status is None
    assert excinfo.value.result.provider_message == ""


# ── 11 · T14 · the host is matched from the PARSED url, never the raw string ──
def test_a_userinfo_or_homograph_host_cannot_reach_slack():
    """T14, driven against the REAL guard for THIS capability.

    ⚠ The inline positive control is the load-bearing half: every hostile URL below contains
    the literal ``slack.com`` (or looks like it does), so a guard that matched the raw string
    would have let them all through. The control asserts that, so the case cannot become
    vacuous if the corpus is ever trimmed.
    """
    public = lambda host, port: ["93.184.216.34"]  # noqa: E731 - a one-line test seam

    hostile = {
        # userinfo: everything before the '@' is a username, and the HOST is evil.com
        "https://slack.com@evil.com/api/chat.postMessage": "host_not_allowed",
        # a subdomain of the attacker's domain, not of Slack's
        "https://slack.com.evil.com/api/chat.postMessage": "host_not_allowed",
        # the missing-leading-dot CVE: `endswith("slack.com")` says yes to this
        "https://notslack.com/api/chat.postMessage": "host_not_allowed",
        # a homograph; httpx IDNA-DECODES it, so it arrives here as a non-ASCII host
        "https://xn--slck-hoa.com/api/chat.postMessage": "host_not_ascii",
        # TLS is STATED, never assumed
        "http://slack.com/api/chat.postMessage": "scheme_not_tls",
    }

    for url, expected in hostile.items():
        with pytest.raises(EgressRefused) as excinfo:
            validate_destination("post_message", url, resolver=public)
        assert excinfo.value.reason_code == expected, (
            f"{url!r} was refused as {excinfo.value.reason_code!r}, expected {expected!r}"
        )

    # THE POSITIVE CONTROL — a raw-string match would have passed three of the five.
    raw_string_would_pass = [u for u in hostile if "slack.com" in u]
    assert len(raw_string_would_pass) >= 3, (
        "the hostile corpus no longer exercises the raw-string trap it exists for"
    )

    # And the guard still says YES to the one destination this capability actually has.
    pinned = validate_destination(
        "post_message", SLACK_API_BASE + "chat.postMessage", resolver=public
    )
    assert pinned.hostname == "slack.com" and pinned.scheme == "https"


# ── 12 · the input schema is the thin one ─────────────────────────────────────
async def test_the_input_schema_is_text_only_and_undeclared_arguments_fail_closed(monkeypatch):
    """``text``, and nothing else (D-32).

    ``blocks``, ``attachments``, ``username`` and ``icon_emoji`` each need a scope 190
    deliberately does not request (``chat:write.customize``) or open a rich-content surface
    with no prior review cycle. An undeclared argument fails CLOSED rather than being dropped,
    because silently dropping one is how a ``blocks`` argument comes to look supported.
    """
    module = _adapter()
    adapter = module.Adapter()

    assert adapter.CAPABILITY == "post_message"
    assert sorted(adapter.INPUT_SCHEMA["properties"]) == ["text"]
    assert adapter.INPUT_SCHEMA["required"] == ["text"]
    assert adapter.INPUT_SCHEMA["additionalProperties"] is False

    recorder = _Recorder()
    _install_transport(monkeypatch, recorder)
    with pytest.raises(module.SlackArgumentsInvalid):
        await adapter.send(
            args={"text": GOOD_TEXT, "blocks": [{"type": "section"}]},
            credential=_Credential(),
            config=dict(SLACK_CONFIG),
        )
    assert recorder.calls == []

    # An empty text never reaches the wire either — Slack would answer `no_text`, and a round
    # trip to be told what we already knew is a send we should not have attempted.
    with pytest.raises(module.SlackArgumentsInvalid):
        await adapter.send(
            args={"text": "   "}, credential=_Credential(), config=dict(SLACK_CONFIG)
        )
    assert recorder.calls == []


# ── 13 · T13 · no response interpretation is borrowed from a sibling ──────────
def test_slack_borrows_no_response_interpretation_from_a_sibling():
    """The mirror of ``test_jira_and_slack_do_not_share_a_response_checker``.

    That case fences the Jira file; this one fences ours, so the prohibition holds from both
    directions rather than from whichever adapter shipped second. The vendors genuinely
    disagree about what success looks like, and one helper for both flattens the difference
    into *"Complete for a send that did not leave the app"* (D-31).
    """
    path = pathlib.Path(inspect.getfile(_adapter()))
    source = path.read_text(encoding="utf-8")

    borrowed = ("_check_response", "check_response", "response_check", "shared_response")
    sibling_modules = ("jira_adapter", "smtp_adapter")

    planted = (
        "from app.services.connectors.jira_adapter import _check_response\n"
        "from app.services.connectors.smtp_adapter import check_response\n"
        "ok = response_check(r) and shared_response(r)\n"
    )
    for token in borrowed + sibling_modules:
        assert token in planted, f"the matcher missed {token!r} on the plant"

    hits = [token for token in borrowed + sibling_modules if token in source]
    assert hits == [], (
        f"T13: {path.name} shares response interpretation with a sibling adapter ({hits!r}). "
        "Jira's status codes and Slack's ok:false disagree; one helper for both reports a "
        "message that was never posted as delivered."
    )

    # The seam must not have grown one either, so the absence above is a decision.
    from app.services.connectors import protocol

    shared = [
        name for name in dir(protocol)
        if any(token in name.lower() for token in ("check_response", "response_check"))
    ]
    assert shared == [], f"the shared seam grew a response checker: {shared!r}"

    # And this file DOES own its own verdict, so the absence is not an omission.
    assert '"ok"' in source and "is True" in source, (
        "the adapter interprets no ok flag of its own"
    )
    assert "raise_for_status" not in source, (
        "a status-line-only check is the T13 defect on this vendor"
    )


# ── 14 · D-05 / D-17 / D-18 · the source fences ───────────────────────────────
def test_the_adapter_file_names_no_transport_no_retry_and_no_new_status_word():
    """Three fences over one file, each with its matcher proved non-inert first.

    A fence whose matcher never fires is a fence that passes over anything — the rule every
    sibling plan in this phase has applied, restated here rather than inherited.
    """
    path = pathlib.Path(inspect.getfile(_adapter()))
    source = path.read_text(encoding="utf-8")

    # D-05 — every connector socket comes from app.security.egress and nowhere else.
    banned = ("httpx.", "requests.", "smtplib.", "urllib.request", "socket.", ".sendmail(")
    planted = (
        "import httpx\nc = httpx.AsyncClient()\ns = smtplib.SMTP_SSL(h)\n"
        "socket.create_connection((h, p))\nurllib.request.urlopen(u)\nc.sendmail(f, t, raw)\n"
        "import requests\nrequests.post(u)\n"
    )
    for token in banned:
        assert token in planted, f"the banned-token matcher missed {token!r} on the plant"
    hits = [token for token in banned if token in source]
    assert hits == [], (
        f"D-05: {path.name} names a transport directly: {hits!r}. Every connector connection "
        "comes from app.security.egress and nowhere else."
    )
    assert "send_pinned_http" in source, "the adapter does not go through the egress binder"

    # D-02 — ONE spelling of the destination, and it lives in egress.py.
    assert "SLACK_API_BASE" in source
    assert "https://slack" not in source, (
        "the Slack API base is spelled a second time here; one spelling, in egress.py"
    )

    # D-17 — ZERO new run-status words, and no migration on the phases table. The adapter
    # returns a verdict; the vocabulary that renders it belongs to the executor and to 189's
    # shipped statuses.
    status_words = ("recorded_not_sent", "completed", "workflow_phases")
    status_plant = (
        'status = "recorded_not_sent" if not bound else "completed"\n'
        "UPDATE workflow_phases SET status = ...\n"
    )
    for token in status_words:
        assert token in status_plant, f"the status-word matcher missed {token!r}"
    status_hits = [token for token in status_words if token in source]
    assert status_hits == [], (
        f"D-17: {path.name} names run-status vocabulary {status_hits!r}. The adapter reports "
        "a verdict; a failed send and the unbound-step terminal are different states told by "
        "different code, and they must stay distinguishable (UI-SPEC §8b)."
    )

    # D-18 — no retry machinery. Prose citing the decision is the ONLY thing allowed, so the
    # check reads per line rather than per file.
    offending = [
        line.strip()
        for line in source.splitlines()
        if any(token in line.lower() for token in ("retry", "backoff", "sleep"))
        and "D-18" not in line
    ]
    assert offending == [], f"D-18 forbids retry/backoff on the send path; found: {offending!r}"

    # Recorded so the plant round can prove its restore was byte-exact (190-07's lesson: hold
    # the bytes; a git checkout re-applies CRLF on this platform and the raw md5 would differ).
    print("slack_adapter.py LF-normalised md5:",
          hashlib.md5(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest())
