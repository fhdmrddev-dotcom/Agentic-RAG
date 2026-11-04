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
from urllib.parse import parse_qsl, urlencode, urlsplit

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
        await _prune_cimd(pool)   # WR-04: the CIMD rows get the same bound
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


async def _prune_cimd(pool) -> None:
    """WR-04: lazily prune CIMD clients nobody approved whose document is over 24 h old. Never
    blocks a register or a sign-in."""
    try:
        await oauth_db.delete_unused_cimd_clients(pool, older_than_hours=24)
    except Exception:  # noqa: BLE001
        logger.warning("oauth: pruning unused CIMD clients failed", exc_info=True)


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
    await _prune_cimd(pool)   # before the write, so a fresh row is never its own victim
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


# ── /oauth/token (D-14, D-17, D-19, D-46, D-47, D-48) ─────────────────────────────────────────

_TOKEN_FORM_MAX = 16_384
_TOKEN_FORM_FIELDS = 32   # a token or revoke request carries at most ~8 parameters
_FORM_TYPE = "application/x-www-form-urlencoded"
_INVALID_GRANT = {
    "error": "invalid_grant",
    "error_description": "The authorization code or refresh token is invalid, expired or was "
                         "already used.",
}


def _oauth_error(status: int, error: str, description: str) -> JSONResponse:
    return _json(status, {"error": error, "error_description": description})


def _invalid_request() -> JSONResponse:
    return _oauth_error(400, "invalid_request",
                        "Send the token request as a form (application/x-www-form-urlencoded) "
                        "with each parameter once.")


def _invalid_client() -> JSONResponse:
    return _oauth_error(401, "invalid_client", "This client is not registered here.")


def _invalid_target() -> JSONResponse:
    return _oauth_error(400, "invalid_target", "This token is for a different Syrel address.")


async def _form(request: Request) -> dict[str, str] | None:
    """The urlencoded form with each parameter at most once, or ``None`` (``invalid_request``).
    A JSON or multipart body is refused before it is read (Claude sends a form, RFC 6749 §3.2).

    ⛔ CR-01: the body is read through ``_read_capped`` — the same stream ``register`` uses — so the
    16 KB cap holds whether or not a ``Content-Length`` was declared. ``request.form()`` is never
    called: Starlette's urlencoded parser has no size or field limit, so a chunked body would be
    buffered whole. The form is parsed here, strictly, with a field-count ceiling."""
    ctype = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if ctype != _FORM_TYPE:
        return None
    raw = await _read_capped(request, _TOKEN_FORM_MAX)
    if raw is None:
        return None
    try:
        pairs = parse_qsl(
            raw.decode("ascii"), keep_blank_values=True, strict_parsing=False,
            errors="strict", max_num_fields=_TOKEN_FORM_FIELDS,
        )
    except (UnicodeDecodeError, ValueError):
        return None
    out: dict[str, str] = {}
    for key, value in pairs:
        if key in out:   # RFC 6749 §3.1: a parameter sent more than once is invalid
            return None
        out[key] = value
    return out


def _token_response(access: str, refresh: str) -> JSONResponse:
    from mcp.shared.auth import OAuthToken  # noqa: PLC0415 — the SDK model, nothing else (D-44)

    from app.security.oauth_tokens import ACCESS_TTL_SECONDS  # noqa: PLC0415

    body = OAuthToken(
        access_token=access, token_type="Bearer", expires_in=ACCESS_TTL_SECONDS,
        refresh_token=refresh, scope=oauth_metadata.SCOPE,
    ).model_dump(mode="json", exclude_none=True)
    # cache-control: no-store and pragma: no-cache ride on every _json answer (RFC 6749 §5.1).
    return _json(200, body)


def _new_pair() -> tuple[str, str, str, str]:
    from app.security.oauth_tokens import digest_token, mint_token  # noqa: PLC0415

    access, refresh = mint_token("access"), mint_token("refresh")
    return access, refresh, digest_token(access, "access"), digest_token(refresh, "refresh")


async def token(request: Request) -> Response:
    limited = await _limited(request, "oauth_token")
    if limited is not None:
        return limited
    try:
        form = await _form(request)
        if form is None:
            return _invalid_request()
        grant_type = form.get("grant_type")
        if not grant_type:
            return _invalid_request()
        if grant_type == "authorization_code":
            return await _exchange_code(form)
        if grant_type == "refresh_token":
            return await _refresh(form)
        return _oauth_error(400, "unsupported_grant_type",
                            "Only authorization_code and refresh_token are supported.")
    except oauth_store.OAuthStoreUnavailable:
        logger.warning("oauth token: the code store is unavailable")
        return _json(503, _UNAVAILABLE)
    except Exception:  # noqa: BLE001 — never a traceback, never a token in a log line
        logger.exception("oauth token failed (not a refusal)")
        return _json(503, _UNAVAILABLE)


async def _exchange_code(form: dict[str, str]) -> Response:
    """``authorization_code``: the code is taken ONCE (MULTI GET+DEL); every binding — client,
    redirect (byte-equal to the one sent at authorize), PKCE S256, resource — must hold, and every
    mismatch is the same ``invalid_grant`` body (T-307-02, T-307-03, T-307-14)."""
    from uuid import UUID  # noqa: PLC0415

    from app.db import api_keys as api_keys_db  # noqa: PLC0415
    from app.security import api_key_auth  # noqa: PLC0415
    from app.security.oauth_tokens import GRANT_TTL_DAYS, pkce_s256_matches  # noqa: PLC0415

    code, client_id = form.get("code"), form.get("client_id")
    if not code or not client_id:
        return _invalid_request()
    redis = get_redis()
    pool = await get_pg_pool()
    client = await oauth_db.get_client(pool, client_id)
    if client is None:
        return _invalid_client()

    digest = oauth_store.digest_code(code)
    record = await oauth_store.take_code(redis, digest)
    if record is None:
        used_by = await oauth_store.code_was_used(redis, digest)
        if used_by:
            # OAuth 2.1 §4.1.2: a replayed code revokes what it already bought.
            await oauth_db.revoke_grant(pool, UUID(used_by))
            logger.warning("oauth token: a replayed authorization code revoked grant %s", used_by)
        return _json(400, _INVALID_GRANT)

    grant_id = UUID(str(record["grant_id"]))
    resource = canonical_resource(form.get("resource"))
    bound = (
        record.get("client_id") == client_id
        and record.get("client_row_id") == str(client["id"])
        and form.get("redirect_uri") == record.get("redirect_uri")   # byte-equal (D-07 rule 5)
        and pkce_s256_matches(form.get("code_verifier") or "", str(record.get("code_challenge") or ""))
        and resource is not None
        and resource == canonical_resource(record.get("resource"))
    )
    if not bound:
        # The code is spent and can never buy a token now: end the grant it was minted for, so a
        # member is never shown a connected app that cannot connect.
        await oauth_db.revoke_grant(pool, grant_id)
        return _json(400, _INVALID_GRANT)

    grant_row = await api_keys_db.get_key_row(pool, key_id=grant_id, org_id=record.get("org_id"))
    if grant_row is None:
        return _json(400, _INVALID_GRANT)
    # D-48 subset, the ONE liveness call OAuth may make: revoked / expired / not_member / banned
    # refuse; a switched-off org or deployment (mcp_off_org / mcp_off_deployment) does NOT — the
    # /mcp edge answers 403 with its sentence instead.
    if await api_key_auth.grant_still_live_for_refresh(pool, grant_row) is not None:
        return _json(400, _INVALID_GRANT)

    access, refresh, access_hash, refresh_hash = _new_pair()
    expires_at = grant_row.get("expires_at") or (datetime.now(timezone.utc) + timedelta(days=GRANT_TTL_DAYS))
    async with pool.acquire() as conn, conn.transaction():
        await oauth_db.issue_token_pair(
            conn, grant_id=grant_id, access_hash=access_hash, refresh_hash=refresh_hash,
            resource=str(record["resource"]), refresh_expires_at=expires_at,
        )
        await oauth_db.mark_client_granted(conn, client["id"])
    return _token_response(access, refresh)


async def _refresh(form: dict[str, str]) -> Response:
    """``refresh_token``: rotate on every use (D-19) with the bounded grace (D-46); ``resource`` is
    optional, and if present must be the grant's recorded one (D-47). Liveness is the D-48 subset:
    a switched-off org or deployment (mcp_off_*) never blocks a refresh, so switching back on
    restores every connected app. The redirect-host allowlist is never read here (D-51)."""
    from app.security import api_key_auth  # noqa: PLC0415
    from app.security.oauth_tokens import digest_token  # noqa: PLC0415

    presented, client_id = form.get("refresh_token"), form.get("client_id")
    if not presented or not client_id:
        return _invalid_request()
    pool = await get_pg_pool()
    client = await oauth_db.get_client(pool, client_id)
    if client is None:
        return _invalid_client()
    digest = digest_token(presented, "refresh")
    if digest is None:
        return _json(400, _INVALID_GRANT)
    row = await oauth_db.get_token_by_digest(pool, digest)
    if row is None or row.get("token_kind") != "refresh" or row.get("oauth_client_id") != client["id"]:
        return _json(400, _INVALID_GRANT)
    if await api_key_auth.grant_still_live_for_refresh(pool, row) is not None:
        return _json(400, _INVALID_GRANT)

    access, refresh, access_hash, refresh_hash = _new_pair()
    outcome = await oauth_db.rotate_refresh(
        pool, refresh_hash=digest, new_access_hash=access_hash, new_refresh_hash=refresh_hash,
        resource=form.get("resource"),
    )
    if outcome.kind in ("rotated", "grace_rotated"):
        return _token_response(access, refresh)
    if outcome.kind == "wrong_resource":
        return _invalid_target()
    if outcome.kind == "reuse_revoked":
        # The grant is already revoked with its whole family (rotate_refresh, D-19). Audited
        # BEFORE the error answer — never the token, only the reason.
        await api_key_auth.audit_key_call_now(
            row, "api_key.refused", call="token", reason="refresh_reuse",
            detail={"credential": "oauth"},
        )
    return _json(400, _INVALID_GRANT)


# ── /oauth/revoke (RFC 7009; D-20) ────────────────────────────────────────────────────────────


async def revoke(request: Request) -> Response:
    """Always 200 for any token, known or not, ours or another client's (RFC 7009 §2.2). A refresh
    token ends the whole grant (audited once, ``api_key.revoke`` credential oauth); an access token
    ends only itself. 429 / 503 are the only other answers."""
    limited = await _limited(request, "oauth_revoke")
    if limited is not None:
        return limited
    try:
        form = await _form(request)
        if form is not None:
            await _revoke(form)
        return Response(status_code=200, headers=_NO_STORE)
    except Exception:  # noqa: BLE001 — never a traceback; never claim a revoke that did not happen
        logger.exception("oauth revoke failed (not a refusal)")
        return _json(503, _UNAVAILABLE)


async def _revoke(form: dict[str, str]) -> None:
    from app.db import api_keys as api_keys_db  # noqa: PLC0415
    from app.security import api_key_auth  # noqa: PLC0415
    from app.security.oauth_tokens import digest_token  # noqa: PLC0415

    presented, client_id = form.get("token"), form.get("client_id")
    if not presented or not client_id:
        return
    digest = digest_token(presented, "refresh") or digest_token(presented, "access")
    if digest is None:
        return
    pool = await get_pg_pool()
    row = await oauth_db.get_token_by_digest(pool, digest)
    if row is None:
        return
    client = await oauth_db.get_client(pool, client_id)
    if client is None or row.get("oauth_client_id") != client["id"]:
        return  # another client's token: nothing done, nothing said
    if row.get("token_kind") == "refresh":
        if await oauth_db.revoke_grant(pool, row["id"]):
            # WR-03: the host the grant was APPROVED with (its api_key.create row), never the
            # client's first registered redirect — the two audit rows of one grant agree.
            approved = await api_keys_db.grant_approved_hosts(pool, grant_ids=[row["id"]])
            host, _kind = oauth_clients.grant_redirect_facts(
                approved.get(str(row["id"])), client.get("redirect_uris"),
            )
            await api_key_auth.audit_key_call_now(
                row, "api_key.revoke", call="revoke",
                detail={
                    "credential": "oauth",
                    "client_name": client.get("client_name"),
                    "redirect_host": host,
                },
            )
        return
    await oauth_db.revoke_access_token(pool, row["token_id"])
