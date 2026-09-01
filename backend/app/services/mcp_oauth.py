"""Phase 222 — the PKCE join: OAuth 2.1 authorization-code flow for a discovered MCP server.

⚠ THIS IS THE HALF THAT HAS NEVER EXISTED. `oauth_service.py` has done S256 PKCE, signed
state and refresh since Phase 215, and `mcp_client.py` has authenticated with a string
somebody pasted from a vendor console. The two were both built and were never introduced.
`mcp_auth_discovery` answered *which door*; this opens it.

── WHY THIS DOES NOT REUSE `oauth_service.generate_oauth_state` (BUS-048) ───────────────

⚠ **THE SHIPPED STATE PARAMETER CARRIES SECRETS IN THE CLEAR, AND FOR THIS FLOW THAT WOULD
BE FATAL RATHER THAN MERELY WRONG.** `generate_oauth_state` base64-encodes its payload and
HMAC-**signs** it. Signing proves the blob was not TAMPERED WITH; it does nothing to HIDE
it, and base64 is an encoding, not a cipher. Driven 2026-09-01 against the real function:
the decoded payload contains `cid_ovr` (the OAuth client id), `sec_ovr` (**the client
secret, verbatim**) and `cv` (**the PKCE code_verifier**). That blob is then placed in the
authorize URL as `?state=…`.

Two consequences, and the second is the one that decides this module's design:

  1. **It defeats the purpose of PKCE.** PKCE exists so an intercepted authorization `code`
     cannot be redeemed without the verifier. If the verifier rides in the SAME URL as the
     code, whoever sees one sees both.
  2. **Here the authorization server is a URL A STRANGER PASTED.** On the Phase 215 path the
     AS is Google and the secret is the customer's own — bad, but not a leak to an outsider.
     In this flow, reusing that design would hand a hostile MCP server our client secret and
     the verifier by construction, on the first request, with no attack required.

**So the state here is an OPAQUE RANDOM HANDLE and nothing else.** The verifier, the client
credentials and the discovered endpoints stay server-side in Redis, keyed by that handle.
Nothing sensitive enters a URL. That is the correct shape whoever the AS is; it is
mandatory when the AS is untrusted.

⚠ Phase 215's flow is NOT patched from here. It is live and works; changing its state
encoding mid-flight would break consent already in progress. `BUS-048` proposes converging
the two afterwards, because **two state implementations is how the safe path and the unsafe
path drift apart.**

── THE OTHER PROPERTY, AND IT IS EASY TO MISS ───────────────────────────────────────────

⚠ **THE TOKEN ENDPOINT IS ALSO A STRANGER'S URL.** It came out of metadata served by a host
nobody curated, so the token exchange is an SSRF surface exactly like discovery was — and
`oauth_service.exchange_code_for_tokens` uses a RAW `httpx.AsyncClient` (`:300`) with no
scheme check, no DNS pin, no redirect refusal and no size cap. That is defensible there,
where `token_url` is a constant from a hardcoded registry; it is not defensible here. The
exchange below goes through the same pinned fetch discovery uses.
"""

from __future__ import annotations

import json
import logging
import secrets
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx

from app.security.egress import EgressRefused
from app.services.mcp_auth_discovery import _PinnedFetch
from app.services.oauth_service import generate_pkce_pair

logger = logging.getLogger(__name__)

#: ⚠ SHORT ON PURPOSE. This window is how long a stolen handle is worth anything, and a
#: person who has been sent to a sign-in page either comes back within minutes or has
#: abandoned it. 10 minutes matches `generate_oauth_state`'s own default TTL, so the two
#: flows expire alike even though they store different things.
PENDING_TTL_SECONDS = 600

#: `mcp_oauth:pending:{handle}`. No user id and no connection id in the key — the handle is
#: the only thing that resolves it, so an attacker who can enumerate keys learns nothing
#: about who is connecting to what.
_PENDING_KEY = "mcp_oauth:pending:{handle}"


class McpOAuthError(Exception):
    """The authorization could not be completed. Carries a sentence a person can act on."""


@dataclass
class PendingAuthorization:
    """What the callback needs, held server-side for the length of one consent."""

    code_verifier: str
    client_id: str
    client_secret: str | None
    token_endpoint: str
    redirect_uri: str
    connection_id: str | None
    user_id: str
    org_id: str
    server_url: str


async def begin_authorization(
    redis: Any,
    *,
    authorization_endpoint: str,
    token_endpoint: str,
    client_id: str,
    client_secret: str | None,
    redirect_uri: str,
    scopes: list[str] | None,
    server_url: str,
    connection_id: str | None,
    user_id: str,
    org_id: str,
) -> tuple[str, str]:
    """Mint a PKCE pair, park everything secret server-side, return `(authorize_url, handle)`.

    ⚠ The ONLY thing that reaches the browser is `authorize_url`, whose `state` is the
    handle — 32 bytes of `secrets.token_urlsafe`, carrying no information at all.
    """
    verifier, challenge = generate_pkce_pair()
    handle = secrets.token_urlsafe(32)

    pending = PendingAuthorization(
        code_verifier=verifier,
        client_id=client_id,
        client_secret=client_secret,
        token_endpoint=token_endpoint,
        redirect_uri=redirect_uri,
        connection_id=connection_id,
        user_id=user_id,
        org_id=org_id,
        server_url=server_url,
    )

    # ⚠ `setex`, NOT `set` + `expire`. Two commands leave a window in which a crash between
    # them parks a credential-bearing record in Redis with NO expiry, forever. One command
    # cannot half-succeed.
    await redis.setex(
        _PENDING_KEY.format(handle=handle),
        PENDING_TTL_SECONDS,
        json.dumps(pending.__dict__),
    )

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "state": handle,
        # OAuth 2.1 REQUIRES S256 and forbids `plain`. It is hardcoded rather than read from
        # the discovered `code_challenge_methods_supported`, deliberately: letting a server
        # NEGOTIATE US DOWN to a weaker method is precisely the downgrade PKCE exists to
        # prevent. A server that cannot do S256 fails here rather than succeeding weakly.
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    if scopes:
        params["scope"] = " ".join(scopes)

    separator = "&" if "?" in authorization_endpoint else "?"
    return f"{authorization_endpoint}{separator}{urlencode(params)}", handle


async def _take_pending(redis: Any, handle: str) -> PendingAuthorization:
    """Read the pending record and DELETE it in the same breath — single use.

    ⚠ THE DELETE IS THE REPLAY DEFENCE AND IT MUST NOT BECOME A LATER CLEANUP STEP. An
    authorization code is redeemable once; a handle that survives its own callback lets a
    replayed redirect re-run the exchange. Deleting BEFORE the exchange means a failed
    exchange also burns the handle, which is the safe direction: the person retries the
    whole consent rather than the attacker retrying the redemption.
    """
    key = _PENDING_KEY.format(handle=handle)
    raw = await redis.get(key)
    await redis.delete(key)

    if not raw:
        raise McpOAuthError(
            "This sign-in link has already been used or has expired. Start the connection again."
        )

    payload = json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
    return PendingAuthorization(**payload)


async def complete_authorization(
    redis: Any,
    *,
    handle: str,
    code: str,
    transport: httpx.AsyncBaseTransport | None = None,
) -> tuple[dict[str, Any], PendingAuthorization]:
    """Redeem the code at the DISCOVERED token endpoint and return `(tokens, pending)`.

    ⚠ THE EXCHANGE IS PINNED. `token_endpoint` came from metadata served by a host nobody
    curated, so it gets the same treatment the discovery fetches got — validated off the
    event loop, connected to the pinned IP with SNI restored by name, redirects refused,
    body bounded. `oauth_service.exchange_code_for_tokens` does none of that; it is correct
    for a constant from a hardcoded registry and wrong for this.
    """
    pending = await _take_pending(redis, handle)

    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": pending.redirect_uri,
        "client_id": pending.client_id,
        # ⚠ The verifier travels HERE — in a POST body, to the token endpoint, over TLS —
        # and never in a URL. That is the whole difference this module exists to make.
        "code_verifier": pending.code_verifier,
    }
    if pending.client_secret:
        form["client_secret"] = pending.client_secret

    try:
        status_code, _headers, body = await _PinnedFetch.request(
            "POST",
            pending.token_endpoint,
            form=form,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            transport=transport,
        )
    except EgressRefused:
        # Propagated, never flattened: a refused destination is a refusal to act, and the
        # operator needs to see WHICH address we would not contact.
        raise
    except httpx.RequestError as exc:
        raise McpOAuthError(f"Could not reach the sign-in service to finish: {exc}") from exc

    if status_code >= 400:
        # ⚠ The provider's error body is NOT echoed. It routinely quotes the request back,
        # which would put the code — and on some servers the client_secret — into our logs
        # and into a message a person sees. The status is enough to act on.
        logger.warning(
            "mcp_oauth: token exchange refused by %s with HTTP %d",
            httpx.URL(pending.token_endpoint).host,
            status_code,
        )
        raise McpOAuthError(
            f"The sign-in service refused to complete the connection (HTTP {status_code})."
        )

    try:
        tokens = json.loads(body.decode("utf-8", errors="replace"))
    except ValueError as exc:
        raise McpOAuthError("The sign-in service returned a response we could not read.") from exc

    if not isinstance(tokens, dict) or not tokens.get("access_token"):
        raise McpOAuthError("The sign-in service did not return an access token.")

    return tokens, pending
