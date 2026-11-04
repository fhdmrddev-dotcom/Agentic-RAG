"""Phase 305 (MCP-01; D-07..D-11 / D-46 / D-50 / D-54; T-305-01/-02/-03/-07/-13/-15/-17) — the key edge.

A PURE-ASGI endpoint in front of the SDK's ``StreamableHTTPASGIApp`` — never Starlette's base HTTP
middleware class (it buffers streaming bodies) and never the SDK's token-verifier hook (it cannot
carry a refusal reason, so the two switched-off sentences would be lost; R-01). In order:

1. **Not POST -> 405 + ``Allow: POST``**, before any key lookup. In stateless mode a GET would open
   an SSE stream that never ends (T-305-17).
2. **Per-address limit** — its own Redis bucket kind ``mcp_ip`` (cannot starve ``/inbound``'s ``ip``
   bucket), BEFORE the key is read. Over the limit: 429 + ``Retry-After``. Redis down: 503 — fail
   closed (T-305-13). Written with raw ``send``: no FastAPI exception handler runs inside a raw
   Route endpoint.
3. **Bearer from the ``Authorization`` header only** — never the query string (D-11). Then the ONE
   resolver: ``mcp_principal.resolve_mcp_principal`` -> ``authenticate_presented_key(expected_kind=
   "mcp")`` (D-07). No module here digests or looks up a key. An app session JWT fails the
   ``srl_mcp_`` prefix inside the core before any read and gets the same answer as everything else
   (D-09 / T-305-01): this module never checks a Supabase JWT.
4. **One 401** for no header, a non-Bearer header, an empty token and every ``KeyRefused`` without a
   sentence — status, body bytes and headers built ONCE at import (``WWW-Authenticate: Bearer``),
   so no refusal kind can be told from another (D-08 / D-50 / T-305-03). Only ``mcp_off_org`` /
   ``mcp_off_deployment`` carry a sentence, as a 403. The edge never writes a credential-refusal
   audit row: the core already audits the attributable ones, throttled (CR-02).
5. **The principal** goes into ``scope["state"]["mcp_principal"]`` and a ContextVar (reset in
   ``finally``). The acting org is ONLY ``McpPrincipal.org_id`` — no header, query or argument can
   reach it (D-10 / T-305-02). A refused request returns before any handler runs, so it opens no
   acting-member connection and runs no member-scoped SQL (T-305-15).

``SetupMiddleware`` still gates an un-set-up deployment in front of this; ``MaintenanceMiddleware``
allowlists ``MCP_PATH`` (D-25) and the dispatch guard refuses start-type tools inside.
"""
from __future__ import annotations

import contextvars
import json
import logging
from typing import Any

from starlette.types import Receive, Scope, Send

from app.dependencies import get_pg_pool, get_redis
from app.security import mcp_principal
from app.security.api_key_auth import KeyRefused
from app.services import rate_limit

logger = logging.getLogger("app.mcp")


def _json_bytes(payload: dict) -> bytes:
    return json.dumps(payload, separators=(",", ":")).encode()


# ── the one 401, fixed at import (D-08 / D-50) ──────────────────────────────────────────────────
_INVALID_BODY = _json_bytes({
    "error": "invalid_token",
    "error_description": "This MCP key is not valid. It may have been revoked or have expired.",
})
_INVALID_HEADERS = [
    (b"content-type", b"application/json"),
    (b"www-authenticate", b"Bearer"),
    (b"content-length", str(len(_INVALID_BODY)).encode()),
]


def configure_challenge(prm: str) -> None:
    """Phase 307 (D-22 / D-23 / D-53; T-307-16) — point the one 401 at the OAuth discovery chain.

    ``register_mcp`` calls this ONCE per base with ``oauth_metadata.prm_url()``; it rebuilds
    ``_INVALID_HEADERS`` so the challenge reads ``Bearer resource_metadata="<PRM URL>"`` (RFC 9728).
    The body constant is untouched and every key AND token failure still sends these same bytes,
    so no refusal kind can be told from another. A key-holding client never sees a difference
    (Claude Code with a configured header does not fall back to OAuth). No ``scope`` (D-50).
    """
    global _INVALID_HEADERS
    challenge = f'Bearer resource_metadata="{prm}"'.encode("latin-1")
    _INVALID_HEADERS = [
        (b"content-type", b"application/json"),
        (b"www-authenticate", challenge),
        (b"content-length", str(len(_INVALID_BODY)).encode()),
    ]

_RESOLVER_UNAVAILABLE = "Syrel can't check this key right now. Try again in a minute."
_STARTING = "The MCP server is starting. Try again in a moment."

_principal_var: contextvars.ContextVar[Any] = contextvars.ContextVar("mcp_principal", default=None)

# The SDK ASGI app of the session manager that is running RIGHT NOW (set by ``mcp_lifespan``).
_live_app: Any = None


def current_principal():
    """The principal of the request being handled, or ``None`` (the server's fallback reader)."""
    return _principal_var.get()


def set_live_app(asgi_app: Any) -> Any:
    """Swap in the running session manager's ASGI app; return the previous one (for restore)."""
    global _live_app
    previous, _live_app = _live_app, asgi_app
    return previous


async def _send(send: Send, status: int, body: bytes, headers: list[tuple[bytes, bytes]]) -> None:
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


async def _send_json(send: Send, status: int, payload: dict, extra: list | None = None) -> None:
    body = _json_bytes(payload)
    headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
    await _send(send, status, body, headers + (extra or []))


def _bearer(scope: Scope) -> str | None:
    """The token of the first ``Authorization: Bearer <token>`` header, else ``None``."""
    for name, value in scope.get("headers") or ():
        if name.lower() != b"authorization":
            continue
        try:
            text = value.decode("latin-1").strip()
        except Exception:  # noqa: BLE001
            return None
        scheme, _, token = text.partition(" ")
        if scheme.lower() != "bearer":
            return None
        token = token.strip()
        return token or None
    return None


class McpEdge:
    """The pure-ASGI endpoint registered on ``/mcp`` and ``/mcp/``."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            return
        if str(scope.get("method", "")).upper() != "POST":
            await _send_json(send, 405, {"error": "method_not_allowed",
                                         "error_description": "This endpoint accepts POST only."},
                             [(b"allow", b"POST")])
            return

        client = (scope.get("client") or ("unknown",))[0] or "unknown"
        try:
            retry = await rate_limit.check_ip_limit(get_redis(), client=str(client))
        except rate_limit.LimiterUnavailable:
            await _send_json(send, 503, {"error": "unavailable",
                                         "error_description": rate_limit.UNAVAILABLE_DETAIL})
            return
        if retry is not None:
            limit = int(rate_limit.IP_CALLS_PER_MINUTE)
            await _send_json(
                send, 429,
                {"error": "rate_limited",
                 "error_description": rate_limit.IP_LIMIT_DETAIL.format(limit=limit, retry=retry)},
                [(b"retry-after", str(retry).encode())],
            )
            return

        token = _bearer(scope)
        if token is None:
            await _send(send, 401, _INVALID_BODY, _INVALID_HEADERS)
            return
        try:
            principal = await mcp_principal.resolve_mcp_principal(
                token, pool=await get_pg_pool(), redis=get_redis()
            )
        except KeyRefused as refusal:
            if refusal.sentence:
                await _send_json(send, 403, {"error": "mcp_off", "error_description": refusal.sentence})
            else:
                await _send(send, 401, _INVALID_BODY, _INVALID_HEADERS)
            return
        except Exception:  # noqa: BLE001 — the key could not be checked; never a traceback
            logger.exception("mcp key check failed (not a refusal)")
            await _send_json(send, 503, {"error": "unavailable",
                                         "error_description": _RESOLVER_UNAVAILABLE})
            return

        inner = _live_app
        if inner is None:
            await _send_json(send, 503, {"error": "unavailable", "error_description": _STARTING})
            return

        scope.setdefault("state", {})["mcp_principal"] = principal
        token_ctx = _principal_var.set(principal)
        try:
            await inner(scope, receive, send)
        finally:
            _principal_var.reset(token_ctx)
