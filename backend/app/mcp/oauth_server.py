"""Phase 307 (OAUTH-04, OAUTH-05, OAUTH-06; D-02..D-10, D-14, D-17, D-19, D-20, D-31, D-34, D-44..D-49)
— the authorization server: thin Starlette routes, registered by ``register_mcp`` only.

Hand-rolled on purpose (D-44): the SDK's own auth server cannot express this deployment's rules
(loopback any-port redirects, a Syrel page for a bad client, ``resource`` required, S256 required,
public-client metadata with CIMD, atomic codes, visible refresh reuse). Only the SDK's Pydantic
models are used (``mcp.shared.auth``).

Routes (all ``include_in_schema=False``, all absent when ``mcp_public_base()`` refuses — D-02):

* ``GET`` the protected-resource and authorization-server documents (``oauth_metadata``).
* ``POST /oauth/register`` — RFC 7591, public clients only, never a secret (D-09).
* ``GET /oauth/authorize`` — every request, valid or refused, goes to Syrel's consent route
  ``<primary_frontend_origin()>/app/connect/<uuid>``. An unknown client or an unproven redirect is
  stored as a REFUSED request: the browser NEVER goes to an address this server has not proven
  (T-307-01). Only after the redirect is proven do the other errors go back to it with ``error``,
  ``state`` and ``iss`` (D-10, D-49).
* ``POST /oauth/token`` and ``POST /oauth/revoke`` — Task 3 of 307-02.

⚠ Every absolute URL comes from ``oauth_metadata`` / ``primary_frontend_origin()`` — never from the
request's own address or proxy headers. ⚠ Nothing here logs a code, a token, a verifier, a state
or a client-supplied string; a failure logs its kind, and the response never carries a traceback.
⚠ Each door counts on its own limiter bucket FIRST, and fails closed (D-34).
"""
from __future__ import annotations

import json
import logging
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode, urlsplit

from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse, Response

from app.db import oauth as oauth_db
from app.dependencies import get_pg_pool, get_redis
from app.mcp import oauth_clients, oauth_metadata, oauth_store
from app.security.oauth_tokens import canonical_resource
from app.services import rate_limit

logger = logging.getLogger("app.mcp.oauth")

_NO_STORE = {"cache-control": "no-store", "pragma": "no-cache"}
_DISCOVERY_CACHE = {"cache-control": "public, max-age=300"}
_CODE_CHALLENGE = re.compile(r"[A-Za-z0-9_-]{43}")
_MAX_HOST = 253

_UNAVAILABLE = {
    "error": "temporarily_unavailable",
    "error_description": "Syrel can't take this request right now. Try again in a minute.",
}
_TOO_MANY = "Too many requests to this sign-in door. Try again in {retry} seconds."
# The browser-facing 503 / 429 pages: fixed words, no client input echoed, no redirect.
_PAGE_UNAVAILABLE = (
    "Syrel can't continue this sign-in right now. Try again in a minute, then start connecting "
    "again from your AI tool."
)


# ── small response helpers ────────────────────────────────────────────────────────────────────


def _json(status: int, payload: dict, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(payload, status_code=status, headers={**_NO_STORE, **(headers or {})})


def _page(status: int, text: str, headers: dict | None = None) -> PlainTextResponse:
    return PlainTextResponse(text, status_code=status, headers={**_NO_STORE, **(headers or {})})


def _redirect(location: str) -> Response:
    return Response(
        status_code=302,
        headers={"location": location, **_NO_STORE, "referrer-policy": "no-referrer"},
    )


def _client_addr(request: Request) -> str:
    client = request.client
    return (client.host if client is not None else None) or "unknown"


async def _limited(request: Request, kind: str, *, page: bool = False) -> Response | None:
    """The door's own bucket, BEFORE anything else (D-34). Fails closed."""
    try:
        retry = await rate_limit.check_oauth_limit(get_redis(), client=_client_addr(request), kind=kind)
    except rate_limit.LimiterUnavailable:
        return _page(503, _PAGE_UNAVAILABLE) if page else _json(503, _UNAVAILABLE)
    if retry is None:
        return None
    headers = {"retry-after": str(retry)}
    if page:
        return _page(429, _TOO_MANY.format(retry=retry), headers)
    return _json(429, {"error": "temporarily_unavailable",
                       "error_description": _TOO_MANY.format(retry=retry)}, headers)


def _single(request: Request, name: str) -> tuple[str | None, bool]:
    """``(value, duplicated)`` — RFC 6749 §3.1: a parameter sent more than once is invalid."""
    values = request.query_params.getlist(name)
    if len(values) > 1:
        return None, True
    return (values[0] if values else None), False


def _host_of(uri: Any) -> str | None:
    """The PARSED host of a redirect URI (never the raw string), capped; ``None`` if unparseable."""
    kind = oauth_clients.redirect_host_kind(uri) if isinstance(uri, str) else None
    return kind[1][:_MAX_HOST] if kind else None


def _url_host(url: Any) -> str | None:
    try:
        host = urlsplit(url).hostname if isinstance(url, str) else None
    except ValueError:
        return None
    return host[:_MAX_HOST].lower() if host else None


# ── discovery (D-04) ──────────────────────────────────────────────────────────────────────────


async def well_known_prm(request: Request) -> Response:
    try:
        return JSONResponse(oauth_metadata.protected_resource_metadata(), headers=_DISCOVERY_CACHE)
    except Exception:  # noqa: BLE001 — never a traceback
        logger.exception("oauth protected-resource document failed")
        return _json(503, _UNAVAILABLE)


async def well_known_as(request: Request) -> Response:
    try:
        return JSONResponse(oauth_metadata.authorization_server_metadata(), headers=_DISCOVERY_CACHE)
    except Exception:  # noqa: BLE001 — never a traceback
        logger.exception("oauth authorization-server document failed")
        return _json(503, _UNAVAILABLE)


# ── /oauth/register (D-09) ────────────────────────────────────────────────────────────────────


async def _read_capped(request: Request, cap: int) -> bytes | None:
    """The body, or ``None`` when it is (or declares itself) larger than ``cap``."""
    declared = request.headers.get("content-length")
    if declared is not None:
        try:
            if int(declared) > cap:
                return None
        except ValueError:
            return None
    body = bytearray()
    async for chunk in request.stream():
        body += chunk
        if len(body) > cap:
            return None
    return bytes(body)


async def register(request: Request) -> Response:
    limited = await _limited(request, "oauth_register")
    if limited is not None:
        return limited
    try:
        raw = await _read_capped(request, oauth_clients.DCR_MAX_BODY)
        if raw is None:
            return _json(413, {"error": "invalid_client_metadata",
                               "error_description": "The registration body is larger than 16 KB."})
        try:
            body = json.loads(raw)
        except ValueError:
            body = None
        pool = await get_pg_pool()
        allowlist = await oauth_db.get_redirect_hosts(pool)  # LIVE, every call (D-08)
        result = oauth_clients.validate_dcr_body(body, allowlist)
        if isinstance(result, oauth_clients.OAuthError):
            return _json(400, {"error": result.error, "error_description": result.description})
        try:  # lazy prune of DCR clients nobody approved in 24 h (D-09) — never blocks a register
            await oauth_db.delete_unused_dcr_clients(pool, older_than_hours=24)
        except Exception:  # noqa: BLE001
            logger.warning("oauth: pruning unused DCR clients failed", exc_info=True)
        row = await oauth_db.insert_dcr_client(
            pool,
            client_id=secrets.token_urlsafe(24),  # opaque, random, unguessable
            client_name=result.client_name,
            client_uri=result.client_uri,
            redirect_uris=result.redirect_uris,
        )
        created = row.get("created_at")
        issued_at = int(created.timestamp()) if isinstance(created, datetime) else int(time.time())
        payload: dict[str, Any] = {
            "client_id": row["client_id"],
            "client_id_issued_at": issued_at,
            "redirect_uris": result.redirect_uris,
            "grant_types": result.grant_types,
            "response_types": result.response_types,
            "token_endpoint_auth_method": "none",
        }
        if result.client_name is not None:
            payload["client_name"] = result.client_name
        if result.client_uri is not None:
            payload["client_uri"] = result.client_uri
        return _json(201, payload)
    except Exception:  # noqa: BLE001 — never a traceback
        logger.exception("oauth register failed (not a refusal)")
        return _json(503, _UNAVAILABLE)


# ── /oauth/authorize (D-07, D-08, D-10, D-45, D-49) ───────────────────────────────────────────


def _to_consent(rid: str) -> Response:
    from app.config import primary_frontend_origin  # noqa: PLC0415 — FRONTEND_URL is a LIST

    return _redirect(f"{primary_frontend_origin()}/app/connect/{rid}")


def _error_back(redirect_uri: str, error: str, state: str | None) -> Response:
    """Back to a PROVEN redirect with ``error``, ``state`` and ``iss`` (D-49), preserving any
    query the client registered."""
    params: dict[str, str] = {"error": error}
    if state:
        params["state"] = state
    params["iss"] = oauth_metadata.issuer() or ""
    separator = "&" if "?" in redirect_uri else "?"
    return _redirect(f"{redirect_uri}{separator}{urlencode(params)}")


async def _refuse(redis, reason: str, host: str | None) -> Response:
    rid = await oauth_store.save_refused_request(redis, reason=reason, host=host)
    return _to_consent(rid)


async def _cimd_client(redis, pool, client_id: str) -> dict | str:
    """The CIMD client row (cached, or freshly fetched through egress), or a refusal reason."""
    row = await oauth_db.get_client(pool, client_id)
    now = datetime.now(timezone.utc)
    if row is not None and row.get("kind") != "cimd":
        return "unknown_client"
    if row is not None and row.get("metadata_expires_at") is not None and row["metadata_expires_at"] > now:
        return row
    if await oauth_store.cimd_failed(redis, client_id):
        return oauth_clients.METADATA_UNREADABLE
    fetched = await oauth_clients.fetch_cimd_document(client_id)
    parsed = (
        oauth_clients.validate_cimd_document(client_id, fetched[0])
        if isinstance(fetched, tuple) else fetched
    )
    if not isinstance(parsed, oauth_clients.CimdClient):
        await oauth_store.mark_cimd_failed(redis, client_id)
        return oauth_clients.METADATA_UNREADABLE
    try:
        return await oauth_db.upsert_cimd_client(
            pool,
            client_id=client_id,
            client_name=parsed.client_name,
            client_uri=parsed.client_uri,
            redirect_uris=parsed.redirect_uris,
            fetched_at=now,
            expires_at=now + timedelta(seconds=int(fetched[1])),
        )
    except ValueError:  # a DCR row already holds this id: never overwritten
        return "unknown_client"


async def authorize(request: Request) -> Response:
    limited = await _limited(request, "oauth_authorize", page=True)
    if limited is not None:
        return limited
    try:
        return await _authorize(request)
    except oauth_store.OAuthStoreUnavailable:
        logger.warning("oauth authorize: the request store is unavailable")
        return _page(503, _PAGE_UNAVAILABLE)
    except Exception:  # noqa: BLE001 — never a traceback, never a client address
        logger.exception("oauth authorize failed (not a refusal)")
        return _page(503, _PAGE_UNAVAILABLE)


async def _authorize(request: Request) -> Response:
    from app.services.mcp_tool_catalogue import mcp_url  # noqa: PLC0415

    redis = get_redis()
    pool = await get_pg_pool()
    client_id, client_dup = _single(request, "client_id")
    redirect_uri, redirect_dup = _single(request, "redirect_uri")
    redirect_host = _host_of(redirect_uri)

    # ── 1 · the client (before the redirect is proven, every refusal goes to Syrel's page) ──
    if not client_id or client_dup:
        return await _refuse(redis, "unknown_client", redirect_host)
    if client_id.startswith("https://"):
        if not oauth_clients.cimd_url_ok(client_id):
            return await _refuse(redis, oauth_clients.METADATA_UNREADABLE, _url_host(client_id))
        client = await _cimd_client(redis, pool, client_id)
        if isinstance(client, str):
            host = _url_host(client_id) if client == oauth_clients.METADATA_UNREADABLE else redirect_host
            return await _refuse(redis, client, host)
    else:
        client = await oauth_db.get_client(pool, client_id)
        if client is None or client.get("kind") != "dcr":
            return await _refuse(redis, "unknown_client", redirect_host)

    # ── 2 · the redirect: registered (D-07) and on the LIVE allowlist (D-08) ──
    if redirect_dup or not redirect_uri or not oauth_clients.redirect_matches(
        redirect_uri, client.get("redirect_uris") or []
    ):
        return await _refuse(redis, "not_registered", redirect_host)
    kind = oauth_clients.redirect_host_kind(redirect_uri)
    if kind is None:
        return await _refuse(redis, "not_registered", redirect_host)
    allowlist = await oauth_db.get_redirect_hosts(pool)
    if not oauth_clients.host_allowed(kind[1], allowlist):
        return await _refuse(redis, "host_not_allowed", redirect_host)

    # ── 3 · the redirect is PROVEN: every other error goes back to it with state + iss ──
    state, state_dup = _single(request, "state")
    response_type, rt_dup = _single(request, "response_type")
    method, method_dup = _single(request, "code_challenge_method")
    challenge, challenge_dup = _single(request, "code_challenge")
    resource, resource_dup = _single(request, "resource")
    if response_type != "code" or rt_dup:
        return _error_back(redirect_uri, "unsupported_response_type", state)
    if method != "S256" or method_dup:  # missing or "plain" is refused, never defaulted (T-307-03)
        return _error_back(redirect_uri, "invalid_request", state)
    if not challenge or challenge_dup or not _CODE_CHALLENGE.fullmatch(challenge):
        return _error_back(redirect_uri, "invalid_request", state)
    if not state or state_dup:
        return _error_back(redirect_uri, "invalid_request", state)
    ours = canonical_resource(mcp_url())
    if resource_dup or ours is None or canonical_resource(resource) != ours:
        return _error_back(redirect_uri, "invalid_target", state)
    # ``scope`` is read by nobody: never refused, always answered "mcp" (D-50).

    # ── 4 · store the request for the consent page ──
    deployment_on = await oauth_db.deployment_mcp_on(pool)
    record = {
        "status": "ready" if deployment_on else "deployment_off",
        "client_row_id": str(client["id"]),
        "client_id": client_id,
        "client_kind": client["kind"],
        "client_name": client.get("client_name"),
        "client_uri": client.get("client_uri"),
        "name_source": client["kind"],
        "published_host": _url_host(client_id) if client["kind"] == "cimd" else None,
        "redirect_uri": redirect_uri,  # exactly as SENT (port included) — /token compares bytes
        "redirect_host": kind[1],
        "redirect_kind": kind[0],
        "state": state,
        "code_challenge": challenge,
        "resource": ours,
        "created_at": int(time.time()),
    }
    rid = await oauth_store.save_request(redis, record)
    return _to_consent(rid)
