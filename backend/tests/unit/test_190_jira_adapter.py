"""Phase 190 · the ``create_ticket`` adapter — Jira Cloud REST v3, driven.

Two traps, both ANSWERED by Atlassian's own documentation (RESEARCH §R12, sourced from
developer.atlassian.com — *Jira Cloud platform REST API v3 — Issues*, *Basic auth for REST
APIs*, *REST API v3 intro*), and a third that is this repository's own:

  1. **v3 requires the Atlassian Document Format for ``description``.** The field takes an
     OBJECT, not a string — *"Version 3 of the API provides support for the Atlassian
     Document Format (ADF), including in issue resources."* The document is therefore built
     PROGRAMMATICALLY from the composed plain text, and an author-supplied document is
     REFUSED: accepting one is a rich-content injection into a third-party renderer AND the
     per-field templating affordance D-09 rules out in as many words.
  2. **Auth is basic with an API token, and passwords are deprecated.** The username is the
     Atlassian account EMAIL; the password is an API token. Atlassian states plainly:
     *"Authentication using passwords has been deprecated."* The transport library builds
     the credential header from the ``auth=(email, token)`` pair — a hand-rolled encoded
     string is one interpolation away from a log line, so the adapter is fenced against
     constructing one at all.
  3. **``ok=True`` MUST mean the ticket exists.** Jira signals errors with real HTTP status
     codes, so a ``raise_for_status()``-shaped check is CORRECT here — and it is WRONG for
     Slack, which answers ``200`` with ``{"ok": false}``. A shared "check the response"
     helper across the two adapters IS the T13 defect (RESEARCH § Anti-Patterns, UI-SPEC
     §8c): the observable is a phase reading *"Complete"* for a send that did not leave the
     app (D-31). The last case in this file fences that, and two cases here drive the
     stronger half — a STRUCTURALLY successful response that did not create a ticket.

⚠ **THE D-09 FENCE HAS TO BE REACHED TO BE MEASURED.** Plan 190-08 recorded the shape of
this mistake: its plant left the target cases GREEN because composition refused before the
transport was ever reached, so the plant measured the source fence rather than the security
property. Here the consequence is concrete — ``send`` must hand the RAW ``description``
value to the document builder, so that the builder's own refusal is what fires. If ``send``
validated the description as a string FIRST, a plant that makes the builder accept a
dictionary would leave every case green and the fence would be decoration.

⚠ **THE §4d VOCABULARY IS LOAD-BEARING** (UI-SPEC §4d): *refused* is our own guard declining
to open a connection, *unreachable* is an allowed address that nothing answered on, and
*rejected* is a host we reached that said no. A refusal must never render "failed" and an
unreachable host must never render "refused" — those two swaps make a security decision read
as a bug and a bug read as a policy, which is why the buckets are asserted rather than
described.
"""

from __future__ import annotations

import hashlib
import inspect
import json as jsonlib
import pathlib

import pytest

from app.security.egress import EgressRefused, PinnedResponse

# ── the fixtures ──────────────────────────────────────────────────────────────
JIRA_CONFIG = {
    "base_url": "https://acme.atlassian.net",
    "project_key": "OPS",
    "account_email": "workflows@acme.example",
}

#: A value that must never appear in a refusal, a result, or anything rendered to a person.
JIRA_TOKEN_SENTINEL = "jira-API-TOKEN-SENTINEL-MUST-NEVER-BE-LOGGED-190"

GOOD_SUMMARY = "Renewal paperwork is overdue"
GOOD_DESCRIPTION = "The renewal window closed on Tuesday.\nNobody has signed the addendum."

#: The shape §R12 records from Atlassian's own docs. ⚠ Assumption A1: NOT driven against a
#: live Jira account (D-30's blocking dependency), so the first live UAT row verifies it.
JIRA_ERROR_ENVELOPE = {
    "errorMessages": [
        "Field 'priority' cannot be set. It is not on the appropriate screen, or unknown."
    ],
    "errors": {
        "project": "project is required",
        "summary": "You must specify a summary of the issue.",
    },
}

JIRA_401_ENVELOPE = {
    "errorMessages": ["Client must be authenticated to access this resource."],
    "errors": {},
}

CREATED_ISSUE = {"id": "10042", "key": "OPS-17", "self": "https://acme.atlassian.net/rest/api/3/issue/10042"}


class _Credential:
    """The one thing an adapter reads from a resolved connection (``protocol.CredentialLike``).

    A stand-in rather than a real ``ResolvedConnection`` so these cases need no database and
    no encryption key — the adapter's contract is structural on purpose.
    """

    @property
    def secret(self) -> str:
        return JIRA_TOKEN_SENTINEL


def _json_response(status: int, payload: object) -> PinnedResponse:
    """A ``PinnedResponse`` as ``egress.send_pinned_http`` returns it — UNINTERPRETED.

    Note what this NamedTuple deliberately does not carry: a success flag. Slack's
    ``200 {"ok": false}`` and Jira's status codes disagree, and flattening that difference
    inside the binder would have been the T13 defect one layer lower down.
    """
    return PinnedResponse(
        status_code=status,
        headers={"content-type": "application/json"},
        body=jsonlib.dumps(payload).encode("utf-8"),
    )


class _Recorder:
    """Records every outgoing call and replays queued responses. No socket is involved.

    A LIST of responses rather than one, because the at-most-once case (D-18) has to be able
    to tell "the adapter tried again and got a different answer" from "the adapter tried
    once": a recorder that returns the same thing forever cannot distinguish them.
    """

    def __init__(self, *outcomes) -> None:
        self.calls: list[dict] = []
        self._outcomes = list(outcomes)

    async def __call__(self, capability, method, url, **kwargs):
        self.calls.append({"capability": capability, "method": method, "url": url, **kwargs})
        outcome = self._outcomes.pop(0) if self._outcomes else _json_response(201, CREATED_ISSUE)
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
    def payload(self) -> dict:
        return self.only_call["json"]


def _adapter():
    """Resolve the module under test, failing with a NAMED message rather than a collection
    error.

    Plans 190-01, 190-02, 190-07 and 190-08 each recorded the same lesson: a module-scope
    import of a not-yet-written module produces ONE collection error and ZERO named
    failures, which measures the import system rather than the property. Every case below
    therefore fails on its own, naming what is missing and who owns it — and the
    ``ModuleNotFoundError`` text still travels verbatim, so the RED is unambiguous.
    """
    try:
        import app.services.connectors.jira_adapter as module
    except ModuleNotFoundError as exc:  # pragma: no cover - the RED path
        pytest.fail(
            f"{exc} - plan 190-10 owns app/services/connectors/jira_adapter.py. "
            "D-02/R12: create_ticket POSTs to Jira Cloud REST v3 /rest/api/3/issue through "
            "egress.send_pinned_http and nothing else, with a programmatically-built ADF "
            "description, basic auth from (account_email, api_token), and Jira's own status "
            "codes deciding the verdict."
        )
    return module


def _install_transport(monkeypatch, recorder: _Recorder):
    """Replace the adapter's binder with the recorder, IN THE ADAPTER'S OWN NAMESPACE.

    Patching the name here rather than in ``egress`` is deliberate: it also proves the
    adapter imported the binder rather than building a client of its own, which is D-05
    asserted by construction as well as by the source fence at the end of this file.
    """
    module = _adapter()
    monkeypatch.setattr(module, "send_pinned_http", recorder)
    return module


async def _create(monkeypatch, *, summary=GOOD_SUMMARY, description=GOOD_DESCRIPTION,
                  recorder=None, config=None):
    recorder = recorder if recorder is not None else _Recorder()
    module = _install_transport(monkeypatch, recorder)
    result = await module.Adapter().send(
        args={"summary": summary, "description": description},
        credential=_Credential(),
        config=dict(config or JIRA_CONFIG),
    )
    return result, recorder


# ── 1 · the payload is EXACTLY the four required fields ───────────────────────
async def test_the_create_payload_has_exactly_the_four_required_fields(monkeypatch):
    """``{"fields": {project, issuetype, summary, description}}`` — and nothing else.

    §R12's minimal create payload, asserted as an EQUALITY on the key set rather than as a
    containment. An extra field is a surface nobody threat-modelled: ``labels`` reaches a
    shared taxonomy, ``assignee`` names a person, a custom field reaches a screen whose
    configuration we cannot see. D-32 fences the phase to the thin three, and a payload
    assertion is where that fence is actually enforceable.
    """
    _, recorder = await _create(monkeypatch)
    payload = recorder.payload

    assert set(payload) == {"fields"}, f"the request body carries more than 'fields': {payload!r}"
    fields = payload["fields"]
    assert set(fields) == {"project", "issuetype", "summary", "description"}, (
        f"the create payload is not the four required fields: {sorted(fields)!r}"
    )
    assert fields["project"] == {"key": "OPS"}, (
        "project must be the non-secret project_key from the CONNECTION ROW's config"
    )
    assert fields["issuetype"] == {"name": "Task"}
    assert fields["summary"] == GOOD_SUMMARY

    call = recorder.only_call
    assert call["method"] == "POST"
    assert call["url"] == "https://acme.atlassian.net/rest/api/3/issue", (
        f"the org-configured base_url must be joined to /rest/api/3/issue: {call['url']!r}"
    )
    assert call["capability"] == "create_ticket"
    # Every pinned call is bounded in BOTH directions (D-07 step 6).
    assert isinstance(call["timeout"], (int, float)) and call["timeout"] > 0
    assert isinstance(call["max_bytes"], int) and call["max_bytes"] > 0


# ── 2 · the ADF document is BUILT, not passed through ─────────────────────────
async def test_the_description_is_a_programmatically_built_ADF_document(monkeypatch):
    """``{"type": "doc", "version": 1, "content": [paragraph, paragraph]}``.

    §R12: v3's ``description`` takes an ADF OBJECT. A plain string is rejected by Jira, and
    the v2 wiki-markup string this codebase might otherwise have reached for is the exact
    stale convention the research names. Two lines in, two ``paragraph`` nodes out, with the
    text preserved CHARACTER-FOR-CHARACTER — a builder that trims, escapes or collapses is a
    builder that quietly rewrites what a person wrote.
    """
    _, recorder = await _create(monkeypatch)
    document = recorder.payload["fields"]["description"]

    assert document["type"] == "doc"
    assert document["version"] == 1
    assert len(document["content"]) == 2, (
        f"a two-line description must become two paragraph nodes: {document['content']!r}"
    )
    first, second = document["content"]
    assert first["type"] == "paragraph" and second["type"] == "paragraph"
    assert first["content"] == [
        {"type": "text", "text": "The renewal window closed on Tuesday."}
    ]
    assert second["content"] == [
        {"type": "text", "text": "Nobody has signed the addendum."}
    ]

    # The builder is a PURE function and is exercised directly too, so the property survives
    # a future refactor of `send` that stops reaching it.
    module = _adapter()
    built = module._plain_text_to_adf("one\ntwo")
    assert (built["type"], built["version"], len(built["content"])) == ("doc", 1, 2)


# ── 3 · D-09's fence — an author-supplied ADF object is REFUSED ───────────────
async def test_an_author_supplied_ADF_object_is_REFUSED(monkeypatch):
    """Hand ``description`` a document where composed TEXT belongs. It must be refused.

    **This is D-09's fence and it has two independent justifications**, either of which is
    sufficient on its own: (a) ADF is rich content rendered by a third party, so accepting an
    author-supplied document is an injection surface into somebody else's renderer; (b) an
    ADF-authoring affordance IS the per-field templating surface D-09 rules out for 190.

    ⚠ Asserted through ``send`` — the real path — and not only on the builder, because the
    plant that falsifies this (a dictionary passthrough inside the builder) only reaches the
    property if ``send`` hands it the RAW value. That is 190-08's recorded lesson applied
    forward rather than re-learned.
    """
    module = _adapter()
    recorder = _Recorder()

    author_supplied = {
        "type": "doc",
        "version": 1,
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "hi"}]}],
    }

    with pytest.raises(module.JiraDocumentRefused) as excinfo:
        await _create(monkeypatch, description=author_supplied, recorder=recorder)

    assert recorder.calls == [], (
        "a refused document must not reach the transport at all — a refusal that still files "
        "the ticket has handled nothing"
    )
    message = str(excinfo.value)
    assert "description" in message
    # D-08: a refusal names the FIELD and the category of problem, never the value.
    assert "hi" not in message

    # The builder refuses on its own too, for every non-string shape.
    for hostile in (author_supplied, ["paragraph"], 7, None):
        with pytest.raises(module.JiraDocumentRefused):
            module._plain_text_to_adf(hostile)


# ── 4 · the credential pair is handed to the library, never encoded by hand ───
async def test_the_basic_auth_is_built_by_httpx_not_by_hand(monkeypatch):
    """``auth=(account_email, api_token)`` reaches the binder as a TUPLE.

    §R12 / D-03: the username is the Atlassian account email and the password is an API
    token — *"Authentication using passwords has been deprecated"*, so no password path
    exists here to be reached. The transport library encodes the pair; this file asserts the
    adapter constructs no encoded string of its own, because a hand-built one is one
    interpolation away from appearing in a log line (T-190-10-AUTH).
    """
    _, recorder = await _create(monkeypatch)
    call = recorder.only_call

    assert call["auth"] == (JIRA_CONFIG["account_email"], JIRA_TOKEN_SENTINEL), (
        f"the credential pair did not reach the binder as a tuple: {call['auth']!r}"
    )

    # A header the adapter built itself would defeat the point of passing the pair.
    outgoing = call.get("headers") or {}
    assert not any(key.lower() == "authorization" for key in outgoing), (
        f"the adapter hand-built a credential header: {sorted(outgoing)!r}"
    )

    # ── the source half, with its matcher proved non-inert first ──
    path = pathlib.Path(inspect.getfile(_adapter()))
    source = path.read_text(encoding="utf-8")
    banned = ("b64encode", "base64", "Authorization", "b64decode")
    planted = (
        "import base64\n"
        'h = {"Authorization": "Basic " + base64.b64encode(pair).decode()}\n'
        "raw = base64.b64decode(h)\n"
    )
    for token in banned:
        assert token in planted, f"the matcher missed {token!r} on the plant"
    # Case-INSENSITIVE, deliberately: a lowercase `authorization` header key is the same
    # hand-built credential header wearing a different capitalisation, and a case-sensitive
    # fence would pass over it.
    lowered = source.lower()
    hits = [token for token in banned if token.lower() in lowered]
    assert hits == [], (
        f"{path.name} encodes the credential by hand: {hits!r}. The transport library builds "
        "the header from the pair; a hand-built string is one interpolation from a log line."
    )


# ── 5 · a 400 surfaces the vendor's own words, VERBATIM ───────────────────────
async def test_a_400_surfaces_errorMessages_and_errors_VERBATIM(monkeypatch):
    """Jira's ``{"errorMessages": [...], "errors": {...}}``, untruncated and unparaphrased.

    The 071-A verbatim-provider-error rule UI-SPEC §5b binds: the host's own words, never a
    message we invented on its behalf. Both halves of the envelope carry information the
    other does not — ``errorMessages`` is the request-level complaint, ``errors`` is
    per-field — so surfacing one and dropping the other is a truncation with a nicer name.
    """
    module = _adapter()
    recorder = _Recorder(_json_response(400, JIRA_ERROR_ENVELOPE))

    with pytest.raises(module.JiraCreateFailed) as excinfo:
        await _create(monkeypatch, recorder=recorder)

    failure = excinfo.value
    assert failure.result.ok is False, "a refused create must never carry ok=True"
    assert failure.result.raw_status == 400

    words = failure.result.provider_message
    for sentence in JIRA_ERROR_ENVELOPE["errorMessages"]:
        assert sentence in words, f"errorMessages was not surfaced verbatim: {words!r}"
    for field, sentence in JIRA_ERROR_ENVELOPE["errors"].items():
        assert sentence in words, f"errors[{field!r}] was not surfaced verbatim: {words!r}"
    assert "..." not in words and "…" not in words, "the vendor's words were truncated"


# ── 6 · 401 is a REJECTED credential, never a REFUSED address ─────────────────
async def test_a_401_is_a_REJECTED_credential_not_a_REFUSED_address(monkeypatch):
    """UI-SPEC §4d's three states are not interchangeable, and this is the pair that gets
    swapped.

    *Refused* means WE declined to open the connection for a security property — a private
    address, a plaintext scheme, a host outside the allow-list. *Rejected* means we reached
    the host and IT said no. Rendering a rejected credential as "refused" tells a person
    their address is dangerous when their token is stale; rendering a refusal as "failed"
    hides a security decision behind a bug report.
    """
    module = _adapter()
    recorder = _Recorder(_json_response(401, JIRA_401_ENVELOPE))

    with pytest.raises(module.JiraCreateFailed) as excinfo:
        await _create(monkeypatch, recorder=recorder)

    failure = excinfo.value
    assert failure.bucket == "rejected", (
        f"a 401 landed in the {failure.bucket!r} bucket; §4d's 'rejected' is the host saying "
        "no to a credential we successfully delivered"
    )
    assert failure.bucket != "refused"
    assert failure.result.raw_status == 401
    assert JIRA_401_ENVELOPE["errorMessages"][0] in failure.result.provider_message
    # A 403 is the same state: the host answered, and it said no.
    assert module._failure_bucket(403) == "rejected"
    assert module._failure_bucket(404) == "rejected"


# ── 7 · at MOST once (D-18) ───────────────────────────────────────────────────
async def test_the_adapter_never_retries(monkeypatch):
    """Exactly ONE call reaches the binder on a failure. No second attempt, ever.

    D-18: a repeated create with no idempotency key files the ticket twice, and a duplicate
    is worse than a missing one on the surface whose whole discipline is not over-claiming.
    The recorder's second queued response is a SUCCESS on purpose — an adapter that tried
    again would swallow the failure and report a created ticket, which is the worst version
    of this defect rather than a noisy one.
    """
    module = _adapter()
    recorder = _Recorder(
        _json_response(500, {"errorMessages": ["Internal server error"], "errors": {}}),
        _json_response(201, CREATED_ISSUE),
    )

    with pytest.raises(module.JiraCreateFailed):
        await _create(monkeypatch, recorder=recorder)

    assert len(recorder.calls) == 1, (
        f"D-18 is at-MOST-once; the adapter reached the binder {len(recorder.calls)} times"
    )


# ── 8 · check authenticates and creates NOTHING ───────────────────────────────
async def test_check_authenticates_and_creates_NOTHING(monkeypatch):
    """UI-SPEC §5c's headline is *"Credential works — and nothing was sent"*, and the second
    clause is asserted at the level it is claimed at.

    The check reaches the IDENTITY endpoint with a GET; it never reaches the issue endpoint
    and it never carries a create payload. Asserting only "no exception was raised" would
    pass over a check that quietly filed a ticket, which is precisely the surface §5c's
    closing negation — *"No ticket was created."* — promises against.
    """
    module = _adapter()
    identity = {
        "accountId": "5b10a2844c20165700ede21g",
        "displayName": "Workflow Bot",
        "emailAddress": "workflows@acme.example",
    }
    recorder = _Recorder(_json_response(200, identity))
    _install_transport(monkeypatch, recorder)

    outcome = await module.Adapter().check(
        credential=_Credential(), config=dict(JIRA_CONFIG)
    )

    call = recorder.only_call
    assert call["method"] == "GET", f"the check issued a {call['method']}"
    assert call["url"].endswith("/rest/api/3/myself"), call["url"]
    assert "/issue" not in call["url"], "the check reached the issue endpoint"
    assert call.get("json") is None, (
        f"the check carried a request body: {call.get('json')!r} — nothing may be created"
    )
    assert outcome.ok is True
    assert outcome.identity, "a green check must name WHO it authenticated as (§5c)"
    assert JIRA_TOKEN_SENTINEL not in repr(outcome)

    # A rejected credential is a RESULT, not an exception: the surface exists to show the
    # host's own verdict, and a raise would turn "the host said no" into an internal error.
    recorder_401 = _Recorder(_json_response(401, JIRA_401_ENVELOPE))
    _install_transport(monkeypatch, recorder_401)
    refused = await module.Adapter().check(
        credential=_Credential(), config=dict(JIRA_CONFIG)
    )
    assert refused.ok is False
    assert refused.identity is None
    assert JIRA_401_ENVELOPE["errorMessages"][0] in refused.provider_message


# ── 9 · Jira and Slack do NOT share a response checker (T13 / UI-SPEC §8c) ────
def test_jira_and_slack_do_not_share_a_response_checker():
    """The adapters genuinely differ, and flattening them is the T13 defect.

    Jira signals errors with real HTTP status codes, so a ``raise_for_status()``-shaped check
    is CORRECT here. Slack answers ``200`` with ``{"ok": false, "error": ...}``, so the same
    check is WRONG there and would report a message that was never posted as delivered. A
    shared helper cannot be right for both; RESEARCH § Anti-Patterns names it first on the
    list, and the observable failure is a phase reading *"Complete"* for a send that did not
    leave the app (D-31).
    """
    path = pathlib.Path(inspect.getfile(_adapter()))
    source = path.read_text(encoding="utf-8")

    borrowed = ("_check_response", "check_response", "response_check", "shared_response")
    sibling_modules = ("smtp_adapter", "slack_adapter")

    planted = (
        "from app.services.connectors.slack_adapter import _check_response\n"
        "from app.services.connectors.smtp_adapter import check_response\n"
        "ok = response_check(r) and shared_response(r)\n"
    )
    for token in borrowed + sibling_modules:
        assert token in planted, f"the matcher missed {token!r} on the plant"

    hits = [token for token in borrowed + sibling_modules if token in source]
    assert hits == [], (
        f"T13: {path.name} shares response interpretation with a sibling adapter ({hits!r}). "
        "Jira's status codes and Slack's ok:false disagree; one helper for both flattens a "
        "genuine difference into 'Complete for a send that did not leave the app'."
    )

    # The helper must not exist to be imported, either — the seam declares none by decision.
    from app.services.connectors import protocol

    shared = [
        name for name in dir(protocol)
        if any(token in name.lower() for token in ("check_response", "response_check"))
    ]
    assert shared == [], f"the shared seam grew a response checker: {shared!r}"

    # And this file DOES own its own status handling, so the absence above is a decision
    # rather than an omission.
    assert "status_code" in source, "the adapter interprets no status of its own"


# ── 10 · a structurally-200 response that created nothing is NOT a success ────
async def test_a_200_carrying_an_error_envelope_is_NOT_a_success(monkeypatch):
    """A 200 whose body carries ``errorMessages`` did not create a ticket. ``ok`` must be
    ``False``.

    This is the Jira-shaped sibling of the Slack ``ok:false`` trap 190-11 owns, and it is
    here because *"the status line said 200"* is not evidence that a ticket exists. A vendor
    behind a gateway, a proxy that rewrites a status, or a future API change is enough to
    produce this shape — and every one of them ends with a phase reading *"Complete"* for a
    ticket nobody can find.
    """
    module = _adapter()
    recorder = _Recorder(_json_response(200, JIRA_ERROR_ENVELOPE))

    with pytest.raises(module.JiraCreateFailed) as excinfo:
        await _create(monkeypatch, recorder=recorder)

    assert excinfo.value.result.ok is False
    assert JIRA_ERROR_ENVELOPE["errorMessages"][0] in excinfo.value.result.provider_message


async def test_a_2xx_with_no_issue_key_is_NOT_a_success(monkeypatch):
    """``ok=True`` means THE TICKET EXISTS, and the issue key is the only evidence of that.

    A 201 with an empty body, an HTML body, or a JSON object with no ``key`` is a response we
    cannot read as a created issue. Reporting it as a success would mean the phase's
    "Complete" rests on the status line alone — which is the T13 shape with a different
    vendor's clothes on.
    """
    module = _adapter()

    for body in ({}, {"id": "10042"}, {"key": ""}, "<html>ok</html>", None):
        recorder = _Recorder(_json_response(201, body))
        with pytest.raises(module.JiraCreateFailed) as excinfo:
            await _create(monkeypatch, recorder=recorder)
        assert excinfo.value.result.ok is False, body


async def test_a_created_issue_returns_ok_True_with_its_key(monkeypatch):
    """The positive half. Without it the two cases above are green over an adapter that
    refuses everything, which would measure nothing at all."""
    result, recorder = await _create(monkeypatch)

    assert result.ok is True
    assert result.raw_status == 201
    assert CREATED_ISSUE["key"] in result.detail, (
        f"a created ticket must carry its issue key: {result.detail!r}"
    )
    assert JIRA_TOKEN_SENTINEL not in repr(result)


# ── 11 · the three §4d buckets, each from its own cause ───────────────────────
async def test_an_egress_refusal_propagates_unchanged_as_a_refusal(monkeypatch):
    """``EgressRefused`` reaches the caller AS ITSELF, carrying its own reason code.

    The guard already authored one sentence per reason code (UI-SPEC §4c, a closed table of
    six). Catching the refusal here and re-raising it as an adapter failure would replace an
    authored sentence with an improvised one and lose the code the renderer keys off.
    """
    module = _adapter()
    refusal = EgressRefused(
        reason_code="address_not_public", host="acme.atlassian.net",
        capability="create_ticket", ip="169.254.169.254",
    )
    recorder = _Recorder(refusal)

    with pytest.raises(EgressRefused) as excinfo:
        await _create(monkeypatch, recorder=recorder)
    assert excinfo.value.reason_code == "address_not_public"
    assert len(recorder.calls) == 1


async def test_a_transport_failure_that_reached_nothing_is_UNREACHABLE(monkeypatch):
    """Nothing answered ⇒ §4d's *unreachable*, and NEVER *refused*.

    "The address is allowed — nothing answered on it" is a different next step from "we
    declined to open the connection". A person shown the wrong one of these two either fixes
    a host that was never wrong, or goes looking for a network fault that does not exist.
    """
    module = _adapter()
    recorder = _Recorder(OSError("connection reset by peer"))

    with pytest.raises(module.JiraCreateFailed) as excinfo:
        await _create(monkeypatch, recorder=recorder)

    failure = excinfo.value
    assert failure.bucket == "unreachable", failure.bucket
    assert failure.result.ok is False
    assert failure.result.raw_status is None, (
        "nothing answered, so there is no status to report — inventing one is a wire fact "
        "we made up"
    )


# ── 12 · the declared contract, and the leak fence ────────────────────────────
async def test_the_input_schema_is_summary_and_description_only(monkeypatch):
    """``summary`` and ``description``. No labels, no assignee, no priority, no custom field.

    Each omitted property is a new outbound surface with no prior review cycle inside a phase
    gated on ``threats_open: 0`` (D-32) — and ``assignee`` in particular would let a workflow
    name a person in someone else's directory.
    """
    module = _adapter()
    adapter = module.Adapter()

    assert adapter.CAPABILITY == "create_ticket"
    assert sorted(adapter.INPUT_SCHEMA["properties"]) == ["description", "summary"], (
        f"the input schema is not the thin two: {sorted(adapter.INPUT_SCHEMA['properties'])!r}"
    )

    from app.services.connectors.registry import get_adapter

    assert get_adapter("create_ticket").CAPABILITY == "create_ticket", (
        "the adapter does not resolve through the registry under its own capability"
    )

    # An undeclared argument fails CLOSED: silently dropping it is how a `labels` argument
    # comes to look supported.
    recorder = _Recorder()
    _install_transport(monkeypatch, recorder)
    with pytest.raises(module.JiraArgumentsInvalid):
        await adapter.send(
            args={"summary": GOOD_SUMMARY, "description": GOOD_DESCRIPTION, "labels": ["x"]},
            credential=_Credential(),
            config=dict(JIRA_CONFIG),
        )
    assert recorder.calls == []


async def test_the_api_token_never_appears_in_a_refusal(monkeypatch):
    """D-08: no refusal, no result and no exception message carries the credential.

    Driven across every failure shape this adapter can produce, because a leak needs only one
    of them.
    """
    module = _adapter()
    outcomes = [
        _json_response(400, JIRA_ERROR_ENVELOPE),
        _json_response(401, JIRA_401_ENVELOPE),
        _json_response(200, JIRA_ERROR_ENVELOPE),
        OSError("connection reset by peer"),
    ]
    for outcome in outcomes:
        recorder = _Recorder(outcome)
        with pytest.raises(module.JiraCreateFailed) as excinfo:
            await _create(monkeypatch, recorder=recorder)
        rendered = f"{excinfo.value!s} {excinfo.value!r} {excinfo.value.result!r}"
        assert JIRA_TOKEN_SENTINEL not in rendered, f"the API token leaked into {rendered!r}"


# ── 13 · D-05 · the file names no transport, and no retry machinery ───────────
def test_the_adapter_file_names_no_transport_and_no_retry():
    """The D-05 banned-token walk over this one file, ahead of plan 190-14's standing fence.

    Its matchers are proved non-inert on a planted haystack first, for the same reason every
    sibling fence does it: a fence whose matcher never fires is a fence that passes over
    anything.
    """
    path = pathlib.Path(inspect.getfile(_adapter()))
    source = path.read_text(encoding="utf-8")
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

    # The link the plan's key_links declares, asserted rather than assumed.
    assert "send_pinned_http" in source, (
        "the adapter does not go through the egress binder at all"
    )

    # D-18 - no retry machinery. Prose citing the decision is allowed and is the ONLY thing
    # allowed, so the check is per-line rather than per-file.
    offending = [
        line.strip()
        for line in source.splitlines()
        if any(token in line.lower() for token in ("retry", "backoff", "sleep"))
        and "D-18" not in line
    ]
    assert offending == [], (
        f"D-18 forbids retry/backoff on the send path; found: {offending!r}"
    )

    # Recorded so the plant round can prove its restore was byte-exact (190-07's lesson:
    # hold the bytes, do not rely on a git checkout, which re-applies CRLF on this platform).
    print("jira_adapter.py LF-normalised md5:",
          hashlib.md5(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest())
