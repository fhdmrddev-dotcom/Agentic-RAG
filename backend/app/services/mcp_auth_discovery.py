"""Phase 222 — RFC 9728 / RFC 8414 authorization discovery for MCP servers.

⚠ WHAT THIS IS FOR. Today an MCP server is connected by pasting a token somebody minted by
hand in a vendor console. The MCP specification instead requires OAuth 2.1 + PKCE with
**RFC 9728 Protected Resource Metadata** discovery, so a compliant client implements the
handshake ONCE and every compliant server becomes a click. This module is the discovery
half: given a URL, it answers *which door to show* — before anything is saved, and before
any credential exists.

⚠ THE ONE THING `mcp_client` STRUCTURALLY CANNOT DO, WHICH IS WHY THIS IS A SEPARATE MODULE.
`McpClient._post` raises `McpClientError` on **any** status >= 400 (`mcp_client.py:169-176`),
so a 401 and its `WWW-Authenticate` header are converted into an exception and discarded.
That header is the ENTIRE entry point of RFC 9728 — the discovery cannot begin without it.
Reusing `_send_jsonrpc` here would have meant reading the one response it is built to throw
away, so this module owns its own fetch and `mcp_client.py` is left byte-unchanged.

── THE SECURITY POSTURE, STATED RATHER THAN ASSUMED ─────────────────────────────────────

⚠ `egress.send_pinned_http` IS NOT USABLE HERE, AND THE REASON IS NOT AN OVERSIGHT. That
binder is keyed on `ALLOWED_HOST_SUFFIXES` — a curated allow-list per capability. An MCP
server is an operator-pasted URL for a service nobody here has heard of, so there is no
list it could appear on. That is precisely why `validate_mcp_destination` exists as a
SEPARATE validator (`egress.py:492`) with no allow-list: for this door the guarantee is
*HTTPS + publicly-routable + pinned + no redirects + bounded*, not *on a list*.

⚠ AND THE HARD PART, WHICH RFC 9728 CREATES AND DOES NOT SOLVE FOR US: **the authorization
server is named BY the resource server.** A malicious MCP server can point us at any AS it
likes. An allow-list built from what the server told us would be circular — it would be the
attacker approving themselves. So every discovered URL is treated as hostile input and gets
the SAME validation as the original paste: re-validated, re-pinned, refused if it resolves
anywhere private. What this module does NOT do is decide that a discovered AS is
*trustworthy*; it only guarantees the socket cannot be turned inward. Binding an AS to a
resource is an authorization decision and it belongs where the token is minted, not here.

⚠ NOTHING HERE SENDS A CREDENTIAL. Discovery is deliberately unauthenticated: the 401 we
are reading is the expected, correct response, and a probe that carried a token would be
sending it to a host we have not yet decided to trust. If a future caller needs an
authenticated probe it gets its own function and its own review.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Literal

import httpx
from starlette.concurrency import run_in_threadpool

from app.security.egress import (
    EgressRefused,
    EgressResponseTooLarge,
    PinnedDestination,
    validate_mcp_destination,
)

logger = logging.getLogger(__name__)

#: Discovery is a page-load-shaped operation, not a long poll. Kept well under the MCP
#: client's own 30s so a dead host cannot hold a request open behind a person clicking.
DISCOVERY_TIMEOUT = 10.0

#: Metadata documents are small by specification. 256 KB is ~50x the largest real one and
#: still refuses a server trying to feed us a body instead of a document.
MAX_METADATA_BYTES = 256 * 1024

#: RFC 8414 §3 — the well-known path is inserted between host and path, not appended.
_OAUTH_AS_WELL_KNOWN = "/.well-known/oauth-authorization-server"
_OIDC_WELL_KNOWN = "/.well-known/openid-configuration"

#: RFC 9728 §5.1 — `WWW-Authenticate: Bearer resource_metadata="https://..."`.
#: Quoted form only: an unquoted URL cannot be told from the next auth-param without a full
#: RFC 9110 parser, and every server that implements this quotes it.
_RESOURCE_METADATA_RE = re.compile(
    r'resource_metadata\s*=\s*"([^"]+)"', re.IGNORECASE
)

#: The capability name these refusals are reported under. NOT a key in
#: `ALLOWED_HOST_SUFFIXES` — there is no allow-list for an uncurated host — it exists so a
#: refusal names which door it came from when it reaches a person.
_DISCOVERY_CAPABILITY = "mcp_discovery"

AuthKind = Literal["open", "oauth", "token", "unreachable"]


@dataclass
class McpAuthProbe:
    """What kind of door this server needs — the wire contract the connect surface reads.

    ⚠ `kind` IS THE ONLY FIELD A CALLER SHOULD BRANCH ON. The rest is evidence for the
    sentence shown to a person, and every one of them is optional precisely so a partially
    compliant server degrades to a WORSE door rather than to a crash.
    """

    #: `open`        — the server answered without a credential; nothing to collect.
    #: `oauth`       — it refused AND advertised an authorization server we could reach.
    #: `token`       — it refused and advertised nothing usable; the paste-a-token door.
    #: `unreachable` — we never got an answer. NOT a door: a failure, with `detail` set.
    kind: AuthKind

    #: The host a person will be sent to sign in at (`accounts.notion.com`), for the
    #: sentence the door shows BEFORE they commit to anything. Never a full URL — the
    #: door's job is to name where they are going, not to link there.
    authorization_host: str | None = None

    #: RFC 8414 endpoints, present only when `kind == "oauth"`.
    authorization_endpoint: str | None = None
    token_endpoint: str | None = None

    #: RFC 7591 dynamic client registration. When present, the operator supplies NOTHING;
    #: when absent, the door must collect a client id/secret through the shipped Phase 215
    #: BYO form rather than inventing a second one.
    registration_endpoint: str | None = None

    #: ⚠ PKCE SUPPORT IS READ, NOT ASSUMED. OAuth 2.1 requires S256, but this reports what
    #: the server actually advertised so a non-compliant AS is a visible fact rather than a
    #: failure at the callback. An EMPTY list means the AS did not say — which RFC 8414 §2
    #: permits and which is NOT the same as "does not support it".
    code_challenge_methods: list[str] = field(default_factory=list)

    #: Why a `token` or `unreachable` verdict came out that way. Shown to a person, so it
    #: names a cause rather than restating the status code.
    detail: str | None = None

    #: The status the resource itself returned, for the record. `None` when unreachable.
    resource_status: int | None = None


class _PinnedFetch:
    """One validated, pinned, redirect-refusing GET/POST that does NOT interpret status.

    ⚠ RETURNING THE RESPONSE UNINTERPRETED IS THE POINT — a 401 is the SUCCESS case of the
    first request here, so a helper that raised on it (as `McpClient._post` does) would
    make the discovery impossible to write. This mirrors `PinnedResponse`'s own docstring
    rule: transport guarantees the wire, the caller decides what an answer means.
    """

    @staticmethod
    async def request(
        method: str,
        url: str,
        *,
        json_body: dict[str, Any] | None = None,
        #: ⚠ ADDED FOR THE TOKEN EXCHANGE, and it is not interchangeable with `json_body`.
        #: RFC 6749 §4.1.3 requires the token request to be
        #: `application/x-www-form-urlencoded`; a JSON body is refused by most authorization
        #: servers and — worse — accepted-and-ignored by a few, which yields a 400 whose
        #: message blames the grant rather than the encoding.
        #:
        #: ⚠ MUTUALLY EXCLUSIVE WITH `json_body`, refused rather than silently resolved:
        #: httpx would let one quietly win, and a caller that passed both has a bug that
        #: deserves to be told at the seam. `egress.send_pinned_http` takes the same
        #: position on its own `json`/`content` pair, for the same reason.
        form: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
        #: ⚠ A TEST SEAM WITH A PRODUCTION DEFAULT OF `None`, copied deliberately from
        #: `egress.send_pinned_http`, whose docstring gives the reason: *"a binder
        #: exercisable only against the live internet is a binder that is untested in CI."*
        #: Without it the only way to test this module would be to monkeypatch out the
        #: function under test — which is exactly the Phase 212 D-1 defect, where a pin
        #: patched `_post` away and then asserted only that an argument had been HANDED to
        #: it. With this, a test drives the real validation, the real pinning, the real SNI
        #: restoration and the real cap, and fakes only the socket.
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> tuple[int, httpx.Headers, bytes]:
        if json_body is not None and form is not None:
            raise ValueError(
                "_PinnedFetch.request takes json_body OR form, never both — httpx would let "
                "one silently win and the caller would not learn which"
            )

        # ── 1 · validate FIRST, off the event loop ────────────────────────────────────
        # D-v2.5-01: `validate_mcp_destination` reaches `socket.getaddrinfo`, a BLOCKING
        # libc call that `timeout=` does not bound. `mcp_client.py:225` threadpools the
        # same call for the same reason; this is not a new rule, it is that rule applied
        # to the requests that discovery adds.
        pinned: PinnedDestination = await run_in_threadpool(validate_mcp_destination, url)

        # ── 2 · TOCTOU: connect to the pinned IP, verify the certificate by NAME ──────
        parsed = httpx.URL(url)
        target = str(parsed.copy_with(host=pinned.ip)) if pinned.ip else url
        server_hostname = pinned.hostname or parsed.host

        send_headers = dict(headers or {})
        send_headers["Host"] = server_hostname

        async with httpx.AsyncClient(
            timeout=DISCOVERY_TIMEOUT,
            # Redirects are refused FLATLY, not followed-and-revalidated. A redirect is the
            # cheapest way to turn a validated destination into an unvalidated one, and the
            # sibling path (`egress.py:647`) takes the same position.
            follow_redirects=False,
            verify=True,
            # A SECURITY setting, not tidiness: a proxy from the environment would bypass
            # the pin entirely by resolving the name again itself.
            trust_env=False,
            transport=transport,
        ) as client:
            response = await client.request(
                method,
                target,
                json=json_body,
                data=form,
                headers=send_headers,
                # SNI is TLS-layer; the `Host:` header is sent AFTER the handshake and
                # cannot stand in for it. Without this, pinning to an IP fails certificate
                # verification against every real server — measured at `mcp_client.py:140`.
                extensions={"sni_hostname": server_hostname},
            )

        # ⚠ A REDIRECT IS REFUSED HERE, NOT REPORTED AS AN ANSWER — and the first cut of
        # this module got it wrong in a way worth recording. `follow_redirects=False` stops
        # the hop, but a 3xx then fell through the `status < 400` branch below and came back
        # as `kind="open"`: *"this server needs no credential, connect straight through"*,
        # about a server that had answered nothing at all. The test caught it.
        #
        # `redirected` is one of the six closed `REFUSAL_REASONS` and `egress.py:83-85`
        # records that it is DECLARED there to be RAISED by the transport binders. This is
        # a transport binder, so it raises it rather than inventing a seventh sentence.
        if 300 <= response.status_code < 400:
            raise EgressRefused(
                reason_code="redirected",
                host=server_hostname,
                capability=_DISCOVERY_CAPABILITY,
            )

        body = response.content[: MAX_METADATA_BYTES + 1]
        if len(body) > MAX_METADATA_BYTES:
            # ⚠ A NAMED TYPE, NOT `EgressRefused`. `egress.py:556` states the rule: a caller
            # must be able to tell *"the remote sent too much"* from *"the network failed"*,
            # and `EgressRefused`'s signature is keyword-only over a CLOSED reason set
            # precisely so a free-text message cannot be smuggled through it.
            raise EgressResponseTooLarge(
                f"metadata document from {server_hostname} exceeded {MAX_METADATA_BYTES} bytes"
            )
        return response.status_code, response.headers, body


def _parse_metadata(body: bytes) -> dict[str, Any]:
    """A metadata document, or `{}`. A malformed document is NOT an exception here.

    ⚠ It degrades to the `token` door rather than raising, because a server that serves
    broken JSON at a well-known path is a server we cannot do OAuth with — which is a
    DOOR verdict, not a crash. The distinction matters: raising would have made a
    half-compliant server look like an outage.
    """
    try:
        parsed = json.loads(body.decode("utf-8", errors="replace"))
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _resource_metadata_url(www_authenticate: str | None) -> str | None:
    """RFC 9728 §5.1 — pull `resource_metadata="..."` out of a `WWW-Authenticate` header."""
    if not www_authenticate:
        return None
    match = _RESOURCE_METADATA_RE.search(www_authenticate)
    return match.group(1) if match else None


def _as_metadata_urls(issuer: str) -> list[str]:
    """RFC 8414 §3 — the well-known segment is INSERTED after the host, not appended.

    ⚠ THIS IS THE STEP MOST OFTEN GOT WRONG, and getting it wrong 404s against every
    correctly-configured server. For an issuer `https://h/tenant1`, the metadata lives at
    `https://h/.well-known/oauth-authorization-server/tenant1` — NOT at
    `https://h/tenant1/.well-known/...`. The OIDC form is tried second because many real
    authorization servers publish only that one.
    """
    parsed = httpx.URL(issuer)
    path = parsed.path.rstrip("/")
    base = parsed.copy_with(path="", query=None, fragment=None)
    return [
        str(base.copy_with(path=f"{_OAUTH_AS_WELL_KNOWN}{path}")),
        str(base.copy_with(path=f"{_OIDC_WELL_KNOWN}{path}")),
        # The append form is tried LAST rather than not at all: it is wrong per RFC 8414,
        # and servers in the wild nonetheless serve it. Trying it after the correct forms
        # costs one request against a server that would otherwise be unusable.
        str(parsed.copy_with(path=f"{path}{_OAUTH_AS_WELL_KNOWN}")),
    ]


async def probe_mcp_auth(
    server_url: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> McpAuthProbe:
    """Discover which door an MCP server needs. Sends NO credential.

    Never raises for a server's behaviour — every outcome is a verdict, because the caller
    is a person pasting a URL and every branch has to render as a sentence. It DOES let
    `EgressRefused` propagate: a destination that fails validation is a refusal to act,
    not a description of the server, and flattening it into a verdict would hide the one
    error the operator most needs to see.
    """
    # ── 1 · ask the resource itself, unauthenticated. A 401 here is SUCCESS ───────────
    try:
        status, headers, _body = await _PinnedFetch.request(
            "POST",
            server_url,
            json_body={
                "jsonrpc": "2.0",
                "id": 0,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "agentic-rag", "version": "222"},
                },
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
            transport=transport,
        )
    except EgressRefused:
        raise
    except httpx.RequestError as exc:
        logger.info("mcp_auth_discovery: %r unreachable: %s", server_url, exc)
        return McpAuthProbe(
            kind="unreachable",
            detail=f"Could not reach this address: {exc}",
        )

    if status < 400:
        # It answered without a credential. Anything we collected would be unused.
        return McpAuthProbe(kind="open", resource_status=status)

    if status not in (401, 403):
        return McpAuthProbe(
            kind="unreachable",
            resource_status=status,
            detail=f"The server answered HTTP {status} rather than asking for a credential.",
        )

    # ── 2 · RFC 9728: the refusal should name where its metadata lives ────────────────
    prm_url = _resource_metadata_url(headers.get("www-authenticate"))
    if not prm_url:
        return McpAuthProbe(
            kind="token",
            resource_status=status,
            detail=(
                "This server asks for a credential but does not advertise how to obtain "
                "one, so it needs a token you create yourself."
            ),
        )

    # ⚠ `prm_url` IS ATTACKER-CONTROLLED — it came out of a header on a host we have not
    # decided to trust. `_PinnedFetch.request` re-validates it from scratch, exactly as if
    # a person had pasted it, which is why this is not a special case.
    try:
        prm_status, _h, prm_body = await _PinnedFetch.request(
            "GET", prm_url, transport=transport
        )
    except (httpx.RequestError, EgressRefused) as exc:
        logger.info("mcp_auth_discovery: resource metadata %r unusable: %s", prm_url, exc)
        return McpAuthProbe(
            kind="token",
            resource_status=status,
            detail="This server's sign-in details could not be read, so it needs a token you create yourself.",
        )

    issuers = _parse_metadata(prm_body).get("authorization_servers") if prm_status < 400 else None
    issuer = issuers[0] if isinstance(issuers, list) and issuers else None
    if not isinstance(issuer, str) or not issuer:
        return McpAuthProbe(
            kind="token",
            resource_status=status,
            detail="This server does not name a sign-in service, so it needs a token you create yourself.",
        )

    # ── 3 · RFC 8414: the authorization server's own endpoints ────────────────────────
    for candidate in _as_metadata_urls(issuer):
        try:
            as_status, _h2, as_body = await _PinnedFetch.request(
                "GET", candidate, transport=transport
            )
        except (httpx.RequestError, EgressRefused):
            continue
        if as_status >= 400:
            continue

        meta = _parse_metadata(as_body)
        authorize = meta.get("authorization_endpoint")
        token = meta.get("token_endpoint")
        if not isinstance(authorize, str) or not isinstance(token, str):
            continue

        methods = meta.get("code_challenge_methods_supported")
        registration = meta.get("registration_endpoint")
        return McpAuthProbe(
            kind="oauth",
            resource_status=status,
            authorization_host=httpx.URL(authorize).host,
            authorization_endpoint=authorize,
            token_endpoint=token,
            registration_endpoint=registration if isinstance(registration, str) else None,
            code_challenge_methods=[m for m in (methods or []) if isinstance(m, str)],
        )

    return McpAuthProbe(
        kind="token",
        resource_status=status,
        detail="This server names a sign-in service that could not be read, so it needs a token you create yourself.",
    )
