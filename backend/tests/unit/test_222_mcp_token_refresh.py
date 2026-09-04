"""Phase 222 / SEED-238 — MCP OAuth tokens must RENEW, and not at Google.

⚠ TWO DEFECTS, AND THE SECOND IS WHY THE FIRST COULD NOT BE FIXED THE OBVIOUS WAY.

 1. `resolve_connection` obtained its credential from `read_oauth_access_token`, whose whole
    projection is `.select("access_token_ciphertext")` — no `expires_at`, no refresh token,
    no call into any refresh engine. So a consented MCP connection ran on the token minted at
    consent until it died. Measured on the live Notion row: a refresh token WAS stored and
    nothing had ever read it. The failure surfaces as `401 invalid_token`, which reads as
    *"your credential is bad"* and sends a person to re-consent — minting another token that
    works for eight hours and fails identically. **An expiry wearing a rejection's clothes is
    a loop, not an error.**

 2. ⚠ ROUTING IT THROUGH THE SHIPPED ENGINE WOULD HAVE SENT NOTION'S REFRESH TOKEN TO GOOGLE.
    `oauth_refresh_service.py`'s provider ladder ends `else "google"` rather than raising, so
    `service_id="notion"` resolved to provider `google`, and the refresh would have POSTed —
    to `accounts.google.com` — Notion's refresh token, the client id Notion issued us under
    RFC 7591, and our Google client secret. Not reachable at HEAD (every caller was
    Google-specific and the Check route refuses MCP rows first), which is exactly why it was
    a landmine rather than an incident: invisible until somebody wired the missing half.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest


# ── 1 · the provider ladder must REFUSE an unknown service, never default to Google ──────


@pytest.mark.asyncio
async def test_the_provider_ladder_raises_for_an_unknown_service_instead_of_saying_google():
    """⭐ THE ONE-LINE HARDENING THAT IS WORTH MAKING WHETHER OR NOT MCP REFRESH EXISTS.

    A silent `else "google"` turns *"this service is unknown to the refresh engine"* into
    *"send its secrets to Google"*. The refusal is what makes a future miswiring loud.
    """
    from app.services.oauth_refresh_service import resolve_refresh_provider

    assert resolve_refresh_provider("google") == "google"
    assert resolve_refresh_provider("gmail") == "google"
    assert resolve_refresh_provider("microsoft") == "microsoft"
    assert resolve_refresh_provider("onedrive") == "microsoft"

    with pytest.raises(ValueError) as exc:
        resolve_refresh_provider("notion")
    # ⚠ The message must NAME the service. A bare "unsupported provider" sends the reader to
    # the registry rather than to the row that is actually unroutable.
    assert "notion" in str(exc.value)


# ── 2 · the refresh itself, against a DISCOVERED endpoint, over the pinned fetch ─────────


@pytest.mark.asyncio
async def test_refresh_posts_grant_type_refresh_token_to_the_discovered_endpoint(monkeypatch):
    """The request shape, pinned field by field.

    ⚠ `client_secret` is sent ONLY when there is one. A public client registered under RFC
    7591 has none, and sending an empty one makes some servers answer `invalid_client` —
    which reads as a credential fault about a credential that does not exist.
    """
    from app.services import mcp_oauth

    seen: dict = {}

    async def fake_request(method, url, *, form=None, headers=None, transport=None):
        seen["method"], seen["url"], seen["form"] = method, url, form
        return 200, {}, json.dumps(
            {"access_token": "new-access", "refresh_token": "new-refresh", "expires_in": 3600}
        ).encode()

    # ⚠ `monkeypatch`, NEVER A BARE ASSIGNMENT. `_PinnedFetch` is the SAME class object
    # `mcp_auth_discovery` exports, so assigning to it directly replaces the pinned fetch
    # for the REST OF THE SESSION. Measured: it took 8 tests in `test_222_probe_auth_seam`
    # with it, and every one of them passed when that file was run alone — the signature
    # of pollution rather than of a defect.
    monkeypatch.setattr(mcp_oauth._PinnedFetch, "request", staticmethod(fake_request))

    tokens = await mcp_oauth.refresh_access_token(
        token_endpoint="https://api.notion.com/v1/oauth/token",
        refresh_token="old-refresh",
        client_id="bD78Ksp3xBJew1kL",
        client_secret=None,
    )

    assert seen["method"] == "POST"
    assert seen["url"] == "https://api.notion.com/v1/oauth/token"
    assert seen["form"]["grant_type"] == "refresh_token"
    assert seen["form"]["refresh_token"] == "old-refresh"
    assert seen["form"]["client_id"] == "bD78Ksp3xBJew1kL"
    assert "client_secret" not in seen["form"], "a public client has no secret to send"
    assert tokens["access_token"] == "new-access"


@pytest.mark.asyncio
async def test_a_refused_refresh_does_not_echo_the_providers_body(monkeypatch):
    """⚠ THE ERROR BODY IS NOT ECHOED, for the reason `complete_authorization` records: a
    token endpoint routinely quotes the request back, which would put the refresh token —
    and on some servers the client secret — into our logs and into a person's screen."""
    from app.services import mcp_oauth

    async def fake_request(method, url, *, form=None, headers=None, transport=None):
        return 400, {}, b'{"error":"invalid_grant","refresh_token":"old-refresh-LEAKED"}'

    # ⚠ `monkeypatch`, NEVER A BARE ASSIGNMENT. `_PinnedFetch` is the SAME class object
    # `mcp_auth_discovery` exports, so assigning to it directly replaces the pinned fetch
    # for the REST OF THE SESSION. Measured: it took 8 tests in `test_222_probe_auth_seam`
    # with it, and every one of them passed when that file was run alone — the signature
    # of pollution rather than of a defect.
    monkeypatch.setattr(mcp_oauth._PinnedFetch, "request", staticmethod(fake_request))

    with pytest.raises(mcp_oauth.McpOAuthError) as exc:
        await mcp_oauth.refresh_access_token(
            token_endpoint="https://api.notion.com/v1/oauth/token",
            refresh_token="old-refresh-LEAKED",
            client_id="cid",
            client_secret=None,
        )
    assert "old-refresh-LEAKED" not in str(exc.value)
    assert "400" in str(exc.value)


# ── 3 · the wiring: an expiring token RENEWS, a healthy one is not touched ───────────────


def _row(*, expires_in_seconds: int, refresh: str | None = "stored-refresh"):
    return {
        "connection_id": "conn-1",
        "org_id": "org-1",
        "mcp_server_url": "https://mcp.notion.com/mcp",
        "config": {"custom_client_id": "bD78Ksp3xBJew1kL"},
        "access_token": "stored-access",
        "refresh_token": refresh,
        "expires_at": (
            datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)
        ).isoformat(),
    }


@pytest.mark.asyncio
async def test_a_healthy_token_is_returned_without_touching_the_network():
    """⚠ THE HOT PATH IS EVERY TOOL CALL. A renewal check that re-discovered metadata on each
    one would put two network round trips in front of every action a workflow takes."""
    from app.services import mcp_token

    async def discover(_url):  # pragma: no cover — must not run
        raise AssertionError("a healthy token must not trigger discovery")

    got = await mcp_token.ensure_fresh_mcp_token(
        "conn-1", fetch_row=lambda _cid: _row(expires_in_seconds=3600), discover=discover
    )
    assert got == "stored-access"


@pytest.mark.asyncio
async def test_a_token_inside_the_skew_window_is_renewed_and_persisted():
    from app.services import mcp_token

    saved: dict = {}

    async def discover(_url):
        return type("P", (), {"token_endpoint": "https://api.notion.com/v1/oauth/token"})()

    async def refresh(**kw):
        assert kw["refresh_token"] == "stored-refresh"
        assert kw["client_id"] == "bD78Ksp3xBJew1kL"
        return {"access_token": "renewed", "refresh_token": "next-refresh", "expires_in": 3600}

    async def save(**kw):
        saved.update(kw)

    got = await mcp_token.ensure_fresh_mcp_token(
        "conn-1",
        fetch_row=lambda _cid: _row(expires_in_seconds=60),
        discover=discover,
        refresh=refresh,
        save=save,
    )
    assert got == "renewed"
    assert saved["access_token"] == "renewed"
    # ⚠ A server that returns NO new refresh token keeps the old one usable; dropping it
    # would turn one silent renewal into a permanent re-consent.
    assert saved["refresh_token"] == "next-refresh"


@pytest.mark.asyncio
async def test_a_failed_renewal_degrades_to_the_stored_token_and_never_raises():
    """⚠ A DEGRADATION TO THE PREVIOUS BEHAVIOUR, NOT A FAIL-OPEN — the same disposition
    `resolve_connection`'s token read already takes (`7b009d685`). Nothing is granted that
    was not granted before; the only thing lost is the upgrade, and the transport then
    produces the real error instead of this layer inventing one."""
    from app.services import mcp_token

    async def discover(_url):
        raise RuntimeError("metadata host down")

    got = await mcp_token.ensure_fresh_mcp_token(
        "conn-1", fetch_row=lambda _cid: _row(expires_in_seconds=60), discover=discover
    )
    assert got == "stored-access"


@pytest.mark.asyncio
async def test_no_refresh_token_means_no_attempt():
    from app.services import mcp_token

    async def discover(_url):  # pragma: no cover
        raise AssertionError("nothing to refresh WITH — do not go to the network")

    got = await mcp_token.ensure_fresh_mcp_token(
        "conn-1",
        fetch_row=lambda _cid: _row(expires_in_seconds=60, refresh=None),
        discover=discover,
    )
    assert got == "stored-access"
