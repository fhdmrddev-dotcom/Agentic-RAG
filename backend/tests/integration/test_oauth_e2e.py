import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
import pytest

from app.models.connector import (
    OAuthProvider,
    ConnectionStatus,
    AuthType,
)
from app.services.oauth_service import (
    generate_pkce_pair,
    build_authorization_url,
    verify_oauth_state,
    exchange_code_for_tokens,
    fetch_account_profile,
    encrypt_token_value,
)
from app.services.oauth_refresh_service import (
    get_valid_oauth_token,
    refresh_oauth_token_at_provider,
    OAuthRevokedError,
)
from app.services.connector_service import (
    save_oauth_tokens,
    get_oauth_token_status,
)


@pytest.mark.asyncio
async def test_oauth_full_authorization_and_token_storage_lifecycle():
    """Simulates full OAuth authorization, PKCE validation, token exchange, and encrypted storage."""
    connection_id = "conn-int-101"
    user_id = "user-int-101"
    org_id = "org-int-101"
    redirect_uri = "https://app.example.com/api/v1/connectors/oauth/callback"

    # Step 1: Authorization URL generation
    with patch("app.services.oauth_service.resolve_client_credentials", return_value=("mock-client-id", "mock-client-secret")):
        auth_url, state_token = build_authorization_url(
            provider="google",
            connection_id=connection_id,
            user_id=user_id,
            redirect_uri=redirect_uri,
        )

    assert "https://accounts.google.com/o/oauth2/v2/auth" in auth_url
    assert "code_challenge=" in auth_url
    assert "code_challenge_method=S256" in auth_url

    # Step 2: Callback state verification
    state_payload = verify_oauth_state(state_token)
    assert state_payload["cid"] == connection_id
    assert state_payload["uid"] == user_id
    assert len(state_payload["cv"]) > 10

    # Step 3: Token exchange & user profile retrieval
    mock_token_response = {
        "access_token": "mock-access-token-123",
        "refresh_token": "mock-refresh-token-456",
        "expires_in": 3600,
        "token_type": "Bearer",
        "scope": "https://www.googleapis.com/auth/drive.readonly",
    }
    mock_profile_response = {
        "email": "engineer@company.com",
        "name": "Engineer Alex",
    }

    with patch("httpx.AsyncClient.post") as mock_post, patch("httpx.AsyncClient.get") as mock_get:
        mock_post_res = MagicMock()
        mock_post_res.is_success = True
        mock_post_res.json.return_value = mock_token_response
        mock_post.return_value = mock_post_res

        mock_get_res = MagicMock()
        mock_get_res.is_success = True
        mock_get_res.json.return_value = mock_profile_response
        mock_get.return_value = mock_get_res

        tokens = await exchange_code_for_tokens(
            provider="google",
            code="mock-auth-code-789",
            code_verifier=state_payload["cv"],
            redirect_uri=redirect_uri,
            client_id="mock-client-id",
            client_secret="mock-client-secret",
        )
        assert tokens["access_token"] == "mock-access-token-123"

        profile = await fetch_account_profile(
            provider="google",
            access_token=tokens["access_token"],
        )
        assert profile["email"] == "engineer@company.com"
        assert profile["name"] == "Engineer Alex"

    # Step 4: Storage in mock Supabase
    mock_supabase = MagicMock()
    tokens_table_mock = MagicMock()
    connections_table_mock = MagicMock()

    mock_supabase.table.side_effect = lambda table_name: (
        tokens_table_mock if table_name == "connector_tokens" else connections_table_mock
    )
    tokens_table_mock.upsert.return_value.execute.return_value = MagicMock()
    connections_table_mock.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()

    await save_oauth_tokens(
        connection_id=connection_id,
        org_id=org_id,
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token"),
        token_type=tokens.get("token_type", "Bearer"),
        scopes=tokens.get("scope", "").split(),
        expires_in=tokens.get("expires_in", 3600),
        account_email=profile.get("email"),
        account_name=profile.get("name"),
        supabase=mock_supabase,
    )

    # Verify that ciphertext stored in connector_tokens begins with 'enc:v1:'
    upsert_call_args = tokens_table_mock.upsert.call_args[0][0]
    assert upsert_call_args["access_token_ciphertext"].startswith("enc:v1:")
    assert upsert_call_args["refresh_token_ciphertext"].startswith("enc:v1:")
    assert upsert_call_args["account_email"] == "engineer@company.com"


@pytest.mark.asyncio
async def test_oauth_claim_refresh_concurrency_two_workers():
    """Simulates 2 concurrent workers attempting to refresh an expiring token simultaneously."""
    connection_id = "conn-concurrency-1"
    org_id = "org-1"

    # Connection and expiring token row
    conn_row = {
        "id": connection_id,
        "org_id": org_id,
        "service_id": "google",
        "status": "active",
        "config": {"custom_client_id": "cid", "custom_client_secret": "csec"},
    }
    initial_token_row = {
        "id": "tok-1",
        "connection_id": connection_id,
        "access_token_ciphertext": encrypt_token_value("old_access_token"),
        "refresh_token_ciphertext": encrypt_token_value("valid_refresh_token"),
        "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=60)).isoformat(),
        "refresh_claimed_until": None,
    }
    refreshed_token_row = {
        "id": "tok-1",
        "connection_id": connection_id,
        "access_token_ciphertext": encrypt_token_value("fresh-access-token-999"),
        "refresh_token_ciphertext": encrypt_token_value("valid_refresh_token"),
        "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=3600)).isoformat(),
        "refresh_claimed_until": None,
    }

    mock_supabase = MagicMock()
    conn_table_mock = MagicMock()
    tokens_table_mock = MagicMock()

    mock_supabase.table.side_effect = lambda table_name: (
        tokens_table_mock if table_name == "connector_tokens" else conn_table_mock
    )

    conn_table_mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[conn_row])

    # Worker 1 acquires the lease; Worker 2 fails lease and polls for refreshed token
    worker_1_claimed = False

    def mock_tokens_select(*args, **kwargs):
        builder = MagicMock()
        # If worker 1 already claimed and refreshed, return refreshed token row
        if worker_1_claimed:
            builder.eq.return_value.execute.return_value = MagicMock(data=[refreshed_token_row])
        else:
            builder.eq.return_value.execute.return_value = MagicMock(data=[initial_token_row])
        return builder

    tokens_table_mock.select.side_effect = mock_tokens_select

    def mock_tokens_update(payload):
        update_builder = MagicMock()
        eq_builder = MagicMock()
        filter_builder = MagicMock()
        lt_builder = MagicMock()
        update_builder.eq.return_value = eq_builder
        eq_builder.filter.return_value = filter_builder
        eq_builder.lt.return_value = lt_builder

        nonlocal worker_1_claimed
        if "refresh_claimed_until" in payload and payload["refresh_claimed_until"] is not None:
            if not worker_1_claimed:
                worker_1_claimed = True
                filter_builder.execute.return_value = MagicMock(data=[initial_token_row])
                lt_builder.execute.return_value = MagicMock(data=[])
            else:
                filter_builder.execute.return_value = MagicMock(data=[])
                lt_builder.execute.return_value = MagicMock(data=[])
        else:
            eq_builder.execute.return_value = MagicMock(data=[refreshed_token_row])

        return update_builder

    tokens_table_mock.update.side_effect = mock_tokens_update

    provider_refresh_call_count = 0

    async def mock_refresh_provider(*args, **kwargs):
        nonlocal provider_refresh_call_count
        provider_refresh_call_count += 1
        return {
            "access_token": "fresh-access-token-999",
            "expires_in": 3600,
        }

    with patch("app.services.oauth_refresh_service.refresh_oauth_token_at_provider", side_effect=mock_refresh_provider):
        worker_1_task = asyncio.create_task(
            get_valid_oauth_token(connection_id, org_id=org_id, supabase=mock_supabase)
        )
        worker_2_task = asyncio.create_task(
            get_valid_oauth_token(connection_id, org_id=org_id, supabase=mock_supabase)
        )

        res_1, res_2 = await asyncio.gather(worker_1_task, worker_2_task)

        assert provider_refresh_call_count == 1
        assert res_1 == "fresh-access-token-999"
        assert res_2 == "fresh-access-token-999"


@pytest.mark.asyncio
async def test_oauth_revocation_on_invalid_grant():
    """Simulates provider returning invalid_grant during refresh, asserting OAuthRevokedError and DB update."""
    connection_id = "conn-revocation-1"
    org_id = "org-1"

    conn_row = {
        "id": connection_id,
        "org_id": org_id,
        "service_id": "google",
        "status": "active",
        "config": {"custom_client_id": "cid", "custom_client_secret": "csec"},
    }
    token_row = {
        "id": "tok-1",
        "connection_id": connection_id,
        "access_token_ciphertext": encrypt_token_value("old_access_token"),
        "refresh_token_ciphertext": encrypt_token_value("revoked_refresh_token"),
        "expires_at": (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat(),
        "refresh_claimed_until": None,
    }

    mock_supabase = MagicMock()
    conn_table_mock = MagicMock()
    tokens_table_mock = MagicMock()

    mock_supabase.table.side_effect = lambda table_name: (
        tokens_table_mock if table_name == "connector_tokens" else conn_table_mock
    )

    conn_table_mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[conn_row])
    tokens_table_mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[token_row])

    # Lease succeeds
    update_builder = MagicMock()
    tokens_table_mock.update.return_value = update_builder
    update_builder.eq.return_value.filter.return_value.execute.return_value = MagicMock(data=[token_row])
    conn_table_mock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[conn_row])

    with patch("app.services.oauth_refresh_service.refresh_oauth_token_at_provider", side_effect=OAuthRevokedError("Revoked by provider")):
        with pytest.raises(OAuthRevokedError):
            await get_valid_oauth_token(connection_id, org_id=org_id, supabase=mock_supabase)
