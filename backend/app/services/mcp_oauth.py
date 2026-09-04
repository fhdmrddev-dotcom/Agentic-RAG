"""Phase 222 — the PKCE join: OAuth 2.1 authorization-code flow for a discovered MCP server.

⚠ THIS IS THE HALF THAT HAS NEVER EXISTED. `oauth_service.py` has done S256 PKCE, signed
state and refresh since Phase 215, and `mcp_client.py` has authenticated with a string
somebody pasted from a vendor console. The two were both built and were never introduced.
`mcp_auth_discovery` answered *which door*; this opens it.

── CONVERGED OPAQUE STATE STORAGE VIA `oauth_state.py` (BUS-048 / Phase 225) ───

⚠ **THE SHIPPED STATE PARAMETER CARRIES SECRETS IN THE CLEAR, AND FOR THIS FLOW THAT WOULD
BE FATAL RATHER THAN MERELY WRONG.** `generate_oauth_state` base64-encoded its payload and
HMAC-signed it, leaking client secrets and PKCE verifiers in URLs.

Phase 222 designed the opaque random handle pattern for discovered MCP servers.
Phase 225 converged BOTH flows (Google/BYO OAuth and MCP OAuth) onto a single, unified
implementation in `app.services.oauth_state`. The verifier, client credentials, and
endpoints stay server-side in Redis, keyed by an opaque handle (`oauth:pending:{handle}`).
Nothing sensitive enters a URL bar. Both flows now consume that single state engine.

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
from app.services.oauth_state import (
    PENDING_TTL_SECONDS,
    OAuthStateError,
    PendingOAuthState,
    save_pending_state,
    take_pending_state,
)

logger = logging.getLogger(__name__)

#: `oauth:pending:{handle}`. Unified Redis key prefix across all OAuth flows.
_PENDING_KEY = "oauth:pending:{handle}"


class McpOAuthError(Exception):
    """The authorization could not be completed. Carries a sentence a person can act on."""


#: PendingAuthorization is an alias of the unified PendingOAuthState (Phase 225 convergence)
PendingAuthorization = PendingOAuthState


@dataclass
class RegisteredClient:
    """An OAuth client this server minted for us, RFC 7591."""

    client_id: str
    client_secret: str | None


async def register_client(
    registration_endpoint: str,
    *,
    redirect_uri: str,
    client_name: str,
    transport: httpx.AsyncBaseTransport | None = None,
) -> RegisteredClient:
    """RFC 7591 dynamic client registration — the step that makes a console visit unnecessary.

    ⚠ THIS IS THE WHOLE POINT OF THE PHASE, IN ONE FUNCTION. Without it, connecting a service
    means a person opening a developer console, creating an application, and copying two
    strings — which is the step real users abandon. With it, a compliant server mints the
    application itself and the person only ever sees a consent screen.

    ⚠ MEASURED AGAINST NOTION 2026-09-01: `https://mcp.notion.com/register` is advertised in
    its RFC 8414 metadata, so the service this project could not connect at ALL since Phase
    212 needs *nothing* from its console.

    ⚠ THE ENDPOINT IS A STRANGER'S URL, like every other hop here — it came out of metadata
    served by a host nobody curated — so it goes through the same pinned fetch. It is also
    the one request in this flow that is deliberately UNAUTHENTICATED: RFC 7591 §3.1 open
    registration takes no credential, and we have none to send yet.

    ⚠ NO `client_secret` IS *REQUIRED* BACK. A server may register us as a PUBLIC client,
    which is legitimate and is exactly why PKCE is mandatory rather than optional here — the
    verifier, not a secret, is what proves the exchange came from us.
    """
    payload = {
        "client_name": client_name,
        "redirect_uris": [redirect_uri],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        # `none` says we are a public client: no secret, PKCE carries the proof. A server
        # that would rather issue a secret is free to, and the response is read either way.
        "token_endpoint_auth_method": "none",
    }

    try:
        status_code, _headers, body = await _PinnedFetch.request(
            "POST",
            registration_endpoint,
            json_body=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            transport=transport,
        )
    except httpx.RequestError as exc:
        raise McpOAuthError(f"Could not reach this service to register: {exc}") from exc

    if status_code >= 400:
        # The body is NOT echoed — same rule as the token exchange: registration errors
        # quote the request back, and the request contains our redirect URI and name.
        logger.warning(
            "mcp_oauth: registration refused by %s with HTTP %d",
            httpx.URL(registration_endpoint).host, status_code,
        )
        raise McpOAuthError(
            f"This service refused to register an application (HTTP {status_code})."
        )

    try:
        data = json.loads(body.decode("utf-8", errors="replace"))
    except ValueError as exc:
        raise McpOAuthError("This service's registration reply could not be read.") from exc

    client_id = data.get("client_id") if isinstance(data, dict) else None
    if not isinstance(client_id, str) or not client_id:
        raise McpOAuthError("This service registered an application without giving it an id.")

    secret = data.get("client_secret")
    return RegisteredClient(
        client_id=client_id,
        client_secret=secret if isinstance(secret, str) and secret else None,
    )


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
        flow="mcp",
    )

    handle = await save_pending_state(redis, pending, ttl_seconds=PENDING_TTL_SECONDS)

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
    try:
        return await take_pending_state(redis, handle, expected_flow="mcp")
    except OAuthStateError as exc:
        raise McpOAuthError(str(exc)) from exc


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


async def refresh_access_token(
    *,
    token_endpoint: str,
    refresh_token: str,
    client_id: str,
    client_secret: str | None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, Any]:
    """Renew an access token at a DISCOVERED token endpoint (SEED-238).

    ⚠ THIS HALF DID NOT EXIST, AND ITS ABSENCE WAS SILENT. `resolve_connection` read
    `access_token_ciphertext` and nothing else — no `expires_at`, no refresh — so a
    consented MCP connection ran on the token minted at consent until it expired. The
    failure then surfaces as `401 invalid_token`, which reads as *"your credential is bad"*
    and sends somebody to re-consent, minting another eight-hour token that fails
    identically. An expiry wearing a rejection's clothes is a loop, not an error.

    ⚠ NOT `oauth_refresh_service`, AND THE REASON IS NOT STYLE. That engine renews against a
    hardcoded three-vendor registry and its provider ladder used to end `else "google"`, so
    an MCP row would have had Notion's refresh token, the RFC 7591 client id and our Google
    client secret POSTed to `accounts.google.com`. That default is now a refusal
    (`resolve_refresh_provider`); this function is where a discovered server renews.

    ⚠ THE ENDPOINT IS A STRANGER'S URL, exactly as at exchange time, so it takes the same
    pinned fetch — validated off the loop, connected to the pinned IP with SNI restored,
    redirects refused, body bounded. The caller RE-DISCOVERS it rather than trusting a
    stored copy, for the reason `/authorize` re-discovers: anything that can be stored can
    be poisoned, and this request ends with our client secret leaving the building.
    """
    form = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
    }
    # ⚠ ONLY WHEN THERE IS ONE. A public client registered under RFC 7591 has no secret, and
    # sending an empty one makes some servers answer `invalid_client` — a credential fault
    # reported about a credential that does not exist, which is the worst kind to debug.
    if client_secret:
        form["client_secret"] = client_secret

    try:
        status_code, _headers, body = await _PinnedFetch.request(
            "POST",
            token_endpoint,
            form=form,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            transport=transport,
        )
    except EgressRefused:
        raise
    except httpx.RequestError as exc:
        raise McpOAuthError(f"Could not reach the sign-in service to renew: {exc}") from exc

    if status_code >= 400:
        # ⚠ THE PROVIDER'S BODY IS NOT ECHOED, the same rule `complete_authorization` keeps:
        # a token endpoint routinely quotes the request back, which would put the refresh
        # token — and on some servers the client secret — into our logs and onto a screen.
        logger.warning(
            "mcp_oauth: token refresh refused by %s with HTTP %d",
            httpx.URL(token_endpoint).host,
            status_code,
        )
        raise McpOAuthError(
            f"The sign-in service refused to renew this connection (HTTP {status_code})."
        )

    try:
        tokens = json.loads(body.decode("utf-8", errors="replace"))
    except ValueError as exc:
        raise McpOAuthError("The sign-in service returned a response we could not read.") from exc

    if not isinstance(tokens, dict) or not tokens.get("access_token"):
        raise McpOAuthError("The sign-in service did not return an access token.")

    return tokens
