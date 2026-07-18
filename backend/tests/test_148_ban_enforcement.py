"""Phase 148 Wave 0 (ADMIN-03 / T-148-02) — RED scaffold: app-layer ban enforcement.

SUBSTRATE-level (owner: 148-02, wave 2). The JWT-window closer (Pitfall 1): a stateless access
token stays valid until its ~1h exp even after GoTrue sets ``banned_until``, so ``get_current_user``
MUST perform an app-layer ``auth.users.banned_until`` check AFTER the token validates and refuse a
disabled user with 403 "This account is disabled — contact your administrator." on ANY authed route.

Calls the REAL ``get_current_user`` directly (the conftest override is bypassed) with a mocked
supabase (valid token) and the ``banned_user`` fixture wiring a future banned_until into the pool.

RED-by-design: today ``get_current_user`` has no ban check and returns the identity without raising,
so ``pytest.raises`` fails. Turns GREEN in wave 2. Owner: 148-02.
"""
import pytest


async def test_banned_user_403_on_valid_token(banned_user):
    """A disabled user riding a still-valid JWT is refused 403 by the app-layer check."""
    from unittest.mock import MagicMock
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials
    from app.dependencies import get_current_user  # exists; ban check inside — RED until 148-02

    # A VALID token: supabase.auth.get_user resolves the (banned) user.
    sb = MagicMock()
    sb.auth.get_user.return_value = MagicMock(
        user=MagicMock(id=banned_user["id"], email="banned@x.co")
    )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="still-valid-token")

    with pytest.raises(HTTPException) as ei:
        await get_current_user(credentials=creds, supabase=sb)
    assert ei.value.status_code == 403, "a banned user with a live token must be refused 403"
    assert "disabled" in ei.value.detail.lower(), "the refusal names the account as disabled"
