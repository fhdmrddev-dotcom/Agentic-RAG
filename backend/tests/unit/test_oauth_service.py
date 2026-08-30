"""Phase 215 (OAUTH-01, OAUTH-02) — Unit tests for OAuth authorization code grant service."""
import base64
import hashlib
import json
import pytest
from unittest.mock import AsyncMock, patch

from app.services.connectors.oauth import (
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


def test_build_authorization_url_google():
    """Constructs valid Google OAuth authorization URL with PKCE."""
    url, state = build_authorization_url(
        provider="google",
        connection_id="conn-g-1",
        user_id="user-1",
        redirect_uri="http://localhost:5173/api/connectors/oauth/callback",
        custom_client_id="google-client-id.apps.googleusercontent.com",
        custom_client_secret="google-client-secret",
    )
    assert "https://accounts.google.com/o/oauth2/v2/auth" in url
    assert "client_id=google-client-id.apps.googleusercontent.com" in url
    assert "code_challenge=" in url
    assert "code_challenge_method=S256" in url
    assert "response_type=code" in url


def test_build_authorization_url_microsoft():
    """Constructs valid Microsoft OAuth authorization URL with PKCE."""
    url, state = build_authorization_url(
        provider="microsoft",
        connection_id="conn-ms-1",
        user_id="user-1",
        redirect_uri="http://localhost:5173/api/connectors/oauth/callback",
        custom_client_id="ms-app-guid-123",
        custom_client_secret="ms-secret",
    )
    assert "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" in url
    assert "client_id=ms-app-guid-123" in url
    assert "code_challenge=" in url


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
