"""Phase 222 / SEED-238 — keep an MCP connection's OAuth token alive.

⚠ THIS FILE EXISTS BECAUSE THE RENEWAL HALF WAS MISSING AND ITS ABSENCE WAS SILENT.
`resolve_connection` obtained its credential from `read_oauth_access_token`, whose entire
projection is `.select("access_token_ciphertext")` — no `expires_at`, no refresh token, no
call into any refresh engine. A consented MCP connection therefore ran on the token minted
at consent until it died. Measured on the live Notion row 2026-09-01: a refresh token WAS
stored and nothing had ever read it.

⚠ AND THE FAILURE IS THE EXPENSIVE KIND. The server answers `401 invalid_token`, which reads
as *"your credential is bad"* — so a person re-authorizes, re-consents or hunts a scope, and
every one of those mints another eight-hour token that fails identically. **An expiry wearing
a rejection's clothes is a loop, not an error.**

── WHY NOT `oauth_refresh_service`, WHICH ALREADY DOES THIS ────────────────────────────────

Because it renews against a HARDCODED three-vendor registry, and its provider ladder used to
end `else "google"` rather than raising. `service_id="notion"` resolved to `google`, so
routing an MCP row through it would have POSTed to `accounts.google.com`, in one request:
Notion's refresh token, the client id Notion issued us under RFC 7591, and our Google client
secret. Not reachable at HEAD — every caller was Google-specific and the Check route refuses
MCP rows before the OAuth arm — which is exactly what made it a landmine rather than an
incident. That default is now `resolve_refresh_provider`, which refuses by name.

⚠ THE TOKEN ENDPOINT IS RE-DISCOVERED, NEVER READ FROM STORAGE, for the reason `/authorize`
re-discovers it: this request ends with our client secret leaving the building, and anything
that can be stored can be poisoned by whoever could write the row.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)

#: Renew this far ahead of the stated expiry. Matches `oauth_refresh_service`'s window, so
#: the two engines do not disagree about when a token counts as spent.
SKEW = timedelta(minutes=5)


async def _load_row(connection_id: str) -> dict[str, Any] | None:
    """The default storage read. Service client, deliberately: both ciphertext columns are
    ungranted to `authenticated` (migration 129 §4), which is the point of them."""
    from app.services.connector_service import _client
    from app.services.oauth_service import decrypt_token_value
    from app.utils.db import aexec

    client = _client(None)
    tok = await aexec(
        client.table("connector_tokens")
        .select("access_token_ciphertext, refresh_token_ciphertext, expires_at")
        .eq("connection_id", str(connection_id))
        .limit(1)
    )
    if not tok.data:
        return None
    t = tok.data[0]

    conn = await aexec(
        client.table("connector_connections")
        .select("id, org_id, mcp_server_url, config, oauth_client_secret_ciphertext")
        .eq("id", str(connection_id))
        .limit(1)
    )
    if not conn.data:
        return None
    c = conn.data[0]

    secret_cipher = c.get("oauth_client_secret_ciphertext")
    return {
        "connection_id": str(connection_id),
        "org_id": c.get("org_id"),
        "mcp_server_url": c.get("mcp_server_url"),
        "config": c.get("config") or {},
        "access_token": (
            decrypt_token_value(t["access_token_ciphertext"])
            if t.get("access_token_ciphertext")
            else None
        ),
        "refresh_token": (
            decrypt_token_value(t["refresh_token_ciphertext"])
            if t.get("refresh_token_ciphertext")
            else None
        ),
        "client_secret": decrypt_token_value(secret_cipher) if secret_cipher else None,
        "expires_at": t.get("expires_at"),
    }


def _expiring(expires_at: str | None) -> bool:
    """⚠ AN UNREADABLE OR ABSENT EXPIRY COUNTS AS EXPIRING, not as healthy. The optimistic
    reading would skip renewal forever on a row whose timestamp we cannot parse, which is
    the same silent-forever failure this module exists to end."""
    if not expires_at:
        return True
    try:
        parsed = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
    except ValueError:
        return True
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed <= datetime.now(timezone.utc) + SKEW


async def ensure_fresh_mcp_token(
    connection_id: str,
    *,
    fetch_row: Callable[[str], Any] | None = None,
    discover: Callable[[str], Awaitable[Any]] | None = None,
    refresh: Callable[..., Awaitable[dict[str, Any]]] | None = None,
    save: Callable[..., Awaitable[None]] | None = None,
) -> str | None:
    """The live access token for an MCP connection, renewed if it is close to expiry.

    Returns plaintext, or `None` when the connection has never consented.

    ⚠ IT NEVER RAISES. A failed renewal degrades to the stored token — a degradation to the
    PREVIOUS behaviour, not a fail-open: nothing is granted that was not granted before, the
    only thing lost is the upgrade, and the transport then produces the real error rather
    than this layer inventing one.

    Every collaborator is injectable for the reason `resolve_connection`'s `fetch_row` is:
    this resolver must stay unit-testable WITHOUT a database or a socket.
    """
    row = fetch_row(connection_id) if fetch_row else await _load_row(connection_id)
    if hasattr(row, "__await__"):  # a caller passed an async seam
        row = await row  # type: ignore[assignment]
    if row is None:
        return None

    stored = row.get("access_token")
    refresh_token = row.get("refresh_token")

    # ⚠ Four separate reasons to stop, kept separate so a quiet run is ATTRIBUTABLE. Folding
    # them into one condition would make "nothing happened" mean four different things.
    if not _expiring(row.get("expires_at")):
        return stored
    if not refresh_token:
        logger.info(
            "mcp_token: connection %s is at or past expiry and has no refresh token; the "
            "stored token is returned and the transport will report the refusal",
            connection_id,
        )
        return stored
    server_url = row.get("mcp_server_url")
    if not server_url:
        return stored
    client_id = (row.get("config") or {}).get("custom_client_id")
    if not client_id:
        logger.warning(
            "mcp_token: connection %s has a refresh token but no registered client id — "
            "renewal is impossible until it is re-authorized",
            connection_id,
        )
        return stored

    try:
        _discover = discover
        if _discover is None:
            from app.services.mcp_auth_discovery import probe_mcp_auth

            _discover = probe_mcp_auth
        probe = await _discover(server_url)
        token_endpoint = getattr(probe, "token_endpoint", None)
        if not token_endpoint:
            return stored

        _refresh = refresh
        if _refresh is None:
            from app.services.mcp_oauth import refresh_access_token

            _refresh = refresh_access_token
        tokens = await _refresh(
            token_endpoint=token_endpoint,
            refresh_token=refresh_token,
            client_id=client_id,
            client_secret=row.get("client_secret"),
        )

        _save = save
        if _save is None:
            from app.services.connector_service import save_oauth_tokens

            _save = save_oauth_tokens
        scope_str = tokens.get("scope", "")
        await _save(
            connection_id=str(connection_id),
            org_id=str(row.get("org_id")),
            access_token=tokens["access_token"],
            # ⚠ A server that returns NO new refresh token keeps the old one usable.
            # Dropping it would turn one silent renewal into a permanent re-consent.
            refresh_token=tokens.get("refresh_token") or refresh_token,
            token_type=tokens.get("token_type", "Bearer"),
            scopes=scope_str.split() if isinstance(scope_str, str) else [],
            expires_in=tokens.get("expires_in", 3600),
            account_email=None,
            account_name=None,
        )
        logger.info("mcp_token: renewed the access token for connection %s", connection_id)
        return tokens["access_token"]
    except Exception:
        logger.warning(
            "mcp_token: could not renew connection %s; resolving on the stored token instead",
            connection_id,
            exc_info=True,
        )
        return stored
