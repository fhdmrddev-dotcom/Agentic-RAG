"""Phase 215 (OAUTH-03) — Unit tests for claim-based OAuth token refresh lifecycle."""
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.oauth_service import encrypt_token_value
from app.services.oauth_refresh_service import (
    OAuthError,
    OAuthRevokedError,
    OAuthTokenUnavailable,
    get_valid_oauth_token,
    refresh_oauth_token_at_provider,
)


def _make_mock_client(conn_data=None, token_data=None):
    """Helper to construct a mock Supabase client with chainable query returns."""
    mock_client = MagicMock()

    conn_exec = MagicMock(data=conn_data if conn_data is not None else [])
    token_exec = MagicMock(data=token_data if token_data is not None else [])

    def table_router(table_name):
        tbl = MagicMock()
        if table_name == "connector_connections":
            tbl.select.return_value.eq.return_value.execute.return_value = conn_exec
            tbl.select.return_value.eq.return_value.eq.return_value.execute.return_value = conn_exec
            tbl.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])
        elif table_name == "connector_tokens":
            tbl.select.return_value.eq.return_value.execute.return_value = token_exec
            tbl.update.return_value.eq.return_value.filter.return_value.execute.return_value = MagicMock(data=[{"id": "tok-1"}])
            tbl.update.return_value.eq.return_value.lt.return_value.execute.return_value = MagicMock(data=[{"id": "tok-1"}])
            tbl.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])
        return tbl

    mock_client.table.side_effect = table_router
    return mock_client


@pytest.mark.asyncio
async def test_get_valid_oauth_token_not_expired():
    """Returns existing decrypted access token if valid for > 5 minutes."""
    future_exp = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    enc_access = encrypt_token_value("valid-access-token-123")

    mock_db = _make_mock_client(
        conn_data=[{"id": "conn-1", "org_id": "org-1", "service_id": "google-drive", "status": "active"}],
        token_data=[{
            "id": "tok-1",
            "access_token_ciphertext": enc_access,
            "refresh_token_ciphertext": "enc:v1:refresh",
            "expires_at": future_exp,
            "refresh_claimed_until": None,
        }],
    )

    token = await get_valid_oauth_token("conn-1", "org-1", supabase=mock_db)
    assert token == "valid-access-token-123"


@pytest.mark.asyncio
async def test_get_valid_oauth_token_expired_triggers_refresh():
    """Expired token claims lease, refreshes at provider, and updates database."""
    past_exp = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    enc_access = encrypt_token_value("old-expired-token")
    enc_refresh = encrypt_token_value("valid-refresh-token")

    mock_db = _make_mock_client(
        conn_data=[{
            "id": "conn-1",
            "org_id": "org-1",
            "service_id": "google-drive",
            "status": "active",
            # THE SECRET MOVED OUT OF `config` AND INTO ITS OWN ENCRYPTED COLUMN
            # (migration 150). `config` is SELECT-granted to `authenticated` while
            # `oauth_client_secret_ciphertext` is not, so the old shape returned a
            # customer application secret to every member of the org.
            #
            # This fixture asserted the exposed shape and passed, which is why nothing
            # caught it. The plaintext here is what `decrypt_token_value` returns for a
            # value that carries no `enc:v1:` envelope, so no cipher key is needed.
            "config": {"custom_client_id": "cid"},
            "oauth_client_secret_ciphertext": "sec",
        }],
        token_data=[{
            "id": "tok-1",
            "access_token_ciphertext": enc_access,
            "refresh_token_ciphertext": enc_refresh,
            "expires_at": past_exp,
            "refresh_claimed_until": None,
        }],
    )

    mock_refresh_resp = {
        "access_token": "new-fresh-access-token-456",
        "expires_in": 3600,
        "token_type": "Bearer",
    }

    with patch("app.services.oauth_refresh_service.refresh_oauth_token_at_provider", new_callable=AsyncMock) as mock_refresh:
        mock_refresh.return_value = mock_refresh_resp

        token = await get_valid_oauth_token("conn-1", "org-1", supabase=mock_db)
        assert token == "new-fresh-access-token-456"
        mock_refresh.assert_called_once()


@pytest.mark.asyncio
async def test_refresh_oauth_token_provider_invalid_grant_revokes():
    """Provider returning 400 invalid_grant raises OAuthRevokedError."""
    mock_resp = httpx.Response(
        400,
        json={"error": "invalid_grant", "error_description": "Token has been expired or revoked."},
        request=httpx.Request("POST", "https://oauth2.googleapis.com/token"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        with pytest.raises(OAuthRevokedError, match="revoked|expired"):
            await refresh_oauth_token_at_provider(
                provider="google",
                refresh_token="revoked-refresh-token",
                client_id="cid",
                client_secret="sec",
            )


@pytest.mark.asyncio
async def test_get_valid_oauth_token_revoked_status_refuses():
    """A connection with status='revoked' immediately raises OAuthRevokedError without network call."""
    mock_db = _make_mock_client(
        conn_data=[{"id": "conn-1", "org_id": "org-1", "service_id": "google-drive", "status": "revoked"}],
        token_data=[],
    )

    with pytest.raises(OAuthRevokedError, match="revoked"):
        await get_valid_oauth_token("conn-1", "org-1", supabase=mock_db)
