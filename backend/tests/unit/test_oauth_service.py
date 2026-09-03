"""Phase 215 (OAUTH-01, OAUTH-02) — Unit tests for OAuth authorization code grant service."""
import base64
import hashlib
import json
import pytest
from unittest.mock import AsyncMock, patch

from app.services.oauth_service import (
    build_authorization_url,
    decrypt_token_value,
    encrypt_token_value,
    exchange_code_for_tokens,
    fetch_account_profile,
    generate_oauth_state,
    generate_pkce_pair,
    verify_oauth_state,
)


def test_pkce_generation_and_challenge_s256():
    """PKCE verifier and challenge adhere to RFC 7636 S256 specification."""
    verifier, challenge = generate_pkce_pair()
    assert len(verifier) >= 43
    assert len(challenge) > 0

    # Re-derive challenge from verifier
    expected_digest = hashlib.sha256(verifier.encode("ascii")).digest()
    expected_challenge = base64.urlsafe_b64encode(expected_digest).decode("ascii").rstrip("=")
    assert challenge == expected_challenge


def test_oauth_state_signing_and_verification():
    """HMAC-signed state is tamper-proof and recovers original payload."""
    state = generate_oauth_state(
        connection_id="conn-test-1",
        user_id="user-456",
        provider="google",
        code_verifier="my-pkce-verifier-123456",
        ttl_seconds=300,
    )
    assert "." in state

    payload = verify_oauth_state(state)
    assert payload["cid"] == "conn-test-1"
    assert payload["uid"] == "user-456"
    assert payload["prv"] == "google"
    assert payload["cv"] == "my-pkce-verifier-123456"


def test_oauth_state_tampering_rejected():
    """Any modification to state signature or payload raises ValueError."""
    state = generate_oauth_state(
        connection_id="conn-test-1",
        user_id="user-456",
        provider="google",
        code_verifier="verifier",
        ttl_seconds=300,
    )
    payload_b64, sig = state.split(".", 1)

    # Tampered signature
    with pytest.raises(ValueError, match="tampered|signature"):
        verify_oauth_state(f"{payload_b64}.tampered_sig_12345")


@pytest.mark.asyncio
async def test_build_authorization_url_google(fake_redis):
    """Constructs valid Google OAuth authorization URL with PKCE and opaque state handle (SC#1)."""
    url, state = await build_authorization_url(
        provider="google",
        connection_id="conn-g-1",
        user_id="user-1",
        org_id="org-1",
        redirect_uri="http://localhost:5173/api/connectors/oauth/callback",
        redis=fake_redis,
        custom_client_id="google-client-id.apps.googleusercontent.com",
        custom_client_secret="google-client-secret",
    )
    assert "https://accounts.google.com/o/oauth2/v2/auth" in url
    assert "client_id=google-client-id.apps.googleusercontent.com" in url
    assert "code_challenge=" in url
    assert "code_challenge_method=S256" in url
    assert "response_type=code" in url
    assert len(state) == 43
    assert "." not in state
    assert f"state={state}" in url
    assert f"oauth:pending:{state}" in fake_redis.store


@pytest.mark.asyncio
async def test_build_authorization_url_microsoft(fake_redis):
    """Constructs valid Microsoft OAuth authorization URL with PKCE and opaque state handle (SC#1)."""
    url, state = await build_authorization_url(
        provider="microsoft",
        connection_id="conn-ms-1",
        user_id="user-1",
        org_id="org-1",
        redirect_uri="http://localhost:5173/api/connectors/oauth/callback",
        redis=fake_redis,
        custom_client_id="ms-app-guid-123",
        custom_client_secret="ms-secret",
    )
    assert "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" in url
    assert "client_id=ms-app-guid-123" in url
    assert "code_challenge=" in url
    assert len(state) == 43
    assert "." not in state
    assert f"state={state}" in url
    assert f"oauth:pending:{state}" in fake_redis.store



@pytest.mark.asyncio
async def test_exchange_code_for_tokens_mocked():
    """Simulates token exchange response from OAuth provider."""
    import httpx

    mock_token_resp = {
        "access_token": "ya29.mock_access_token",
        "refresh_token": "1//mock_refresh_token",
        "expires_in": 3600,
        "token_type": "Bearer",
        "scope": "https://www.googleapis.com/auth/drive.readonly",
    }

    mock_resp = httpx.Response(200, json=mock_token_resp, request=httpx.Request("POST", "https://oauth2.googleapis.com/token"))
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        data = await exchange_code_for_tokens(
            provider="google",
            code="auth_code_123",
            code_verifier="pkce_verifier_456",
            redirect_uri="http://localhost/callback",
            client_id="cid",
            client_secret="secret",
        )
        assert data["access_token"] == "ya29.mock_access_token"
        assert data["refresh_token"] == "1//mock_refresh_token"


@pytest.mark.asyncio
async def test_fetch_account_profile_google():
    """Simulates profile fetch from Google userinfo."""
    import httpx

    mock_resp = httpx.Response(
        200,
        json={"email": "user@example.com", "name": "Jane Doe"},
        request=httpx.Request("GET", "https://www.googleapis.com/oauth2/v2/userinfo"),
    )
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        profile = await fetch_account_profile("google", "mock_access_token")
        assert profile["email"] == "user@example.com"
        assert profile["name"] == "Jane Doe"


def test_token_encryption_roundtrip():
    """Token encryption / decryption roundtrip works cleanly."""
    token = "secret-oauth-bearer-token-12345"
    enc = encrypt_token_value(token)
    dec = decrypt_token_value(enc)
    assert dec == token


def test_the_install_wide_application_is_a_declared_setting():
    """⚠ THESE SIX FIELDS DID NOT EXIST WHILE `resolve_client_credentials` READ THEM.

    It reads through `getattr(settings, "google_oauth_client_id", "")`, and a `getattr` with a
    default cannot tell *"configured as empty"* from *"there is no such setting"* — so the
    branch always fell through to its raise, and that raise names the exact environment
    variables nothing was reading:

        "Please set GOOGLE_OAUTH_CLIENT_ID & GOOGLE_OAUTH_CLIENT_SECRET"

    pydantic-settings maps env vars onto DECLARED fields only, so an operator who followed
    that instruction to the letter changed nothing, and the per-connection *Advanced* form was
    the only path that ever worked. Found by the operator asking why they had to fill it in
    for an application they had already registered.

    Asserted on the SETTINGS OBJECT rather than on behaviour, because the defect was the
    field's absence and `getattr`'s default is what hid it.
    """
    from app.config import settings

    for provider in ("google", "microsoft", "github"):
        for half in ("client_id", "client_secret"):
            name = f"{provider}_oauth_{half}"
            assert hasattr(settings, name), (
                f"{name} is not a declared setting, so the environment variable that names it "
                "is silently ignored and resolve_client_credentials can never see it"
            )


def test_a_per_connection_application_still_overrides_the_install_wide_one(monkeypatch):
    """Declaring the fields must not change the PRECEDENCE. A tenant bringing their own
    application keeps overriding the install's, and that is the whole point of BYO OAuth."""
    from app.config import settings
    from app.services.oauth_service import resolve_client_credentials

    monkeypatch.setattr(settings, "google_oauth_client_id", "install-wide-id", raising=False)
    monkeypatch.setattr(settings, "google_oauth_client_secret", "install-wide-secret", raising=False)

    assert resolve_client_credentials("google") == ("install-wide-id", "install-wide-secret")
    assert resolve_client_credentials("google", "tenant-id", "tenant-secret") == (
        "tenant-id",
        "tenant-secret",
    )
    # ⚠ HALF a pair is not a pair: a client id with no secret must fall back rather than be
    # sent to the provider on its own, which fails with a message about the wrong thing.
    assert resolve_client_credentials("google", "tenant-id", None) == (
        "install-wide-id",
        "install-wide-secret",
    )
