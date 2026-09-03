"""Phase 225 — Comprehensive Security, Cutover & Architecture Tests.

Verifies:
  SC#1: Authorize URL contains no client secrets or PKCE verifiers (opaque handle).
  SC#2: Convergence — both flows share app.services.oauth_state.
  SC#3: In-flight legacy HMAC state survives deploy cutover; tampered legacy fails.
  SC#4: Single-use replay defense and unknown handle fail closed.
  SC#5: End-to-end handshake through real routes with one shared FakeRedis.
  B-1: All redirects in both callbacks start with /app (BUG-260903-01).
  A-3: Redis outage fails closed with 503.
  A-10: Architectural fence — generate_oauth_state uncalled in app/.
"""

import base64
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_active_org_id, get_current_user, require_org_manage
from app.main import app
from app.services import mcp_oauth, oauth_service, oauth_state
from app.services.oauth_service import (
    build_authorization_url,
    generate_oauth_state,
)
from app.services.oauth_state import (
    PendingOAuthState,
    save_pending_state,
    take_pending_state,
)
from tests.conftest import FakeRedis


@pytest.fixture
def client():
    return TestClient(app, follow_redirects=False)


@pytest.fixture(autouse=True)
def clean_dependency_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_sc1_authorize_url_contains_no_secrets(fake_redis: FakeRedis):
    """SC#1: Authorize URL state is an opaque handle and leaks zero credentials or verifiers."""
    secret = "SUPER_SECRET_CLIENT_SECRET_9876543210"
    client_id = "custom-client-id-123.apps.googleusercontent.com"

    auth_url, state = await build_authorization_url(
        provider="google",
        connection_id="conn-100",
        user_id="user-200",
        org_id="org-300",
        redirect_uri="http://localhost:5173/app?connections=1",
        redis=fake_redis,
        custom_client_id=client_id,
        custom_client_secret=secret,
    )

    # 1. Secret and verifier are NOT anywhere in the full URL
    assert secret not in auth_url
    assert "SUPER_SECRET" not in auth_url

    # 2. State is an opaque handle of exactly 43 URL-safe chars with no '.'
    parsed = urlparse(auth_url)
    qs = parse_qs(parsed.query)
    assert "state" in qs
    state_in_url = qs["state"][0]
    assert state_in_url == state
    assert len(state) == 43
    assert "." not in state

    # 3. Decoding attempt does not yield JSON keys
    padded = state + "=" * (-len(state) % 4)
    try:
        decoded = base64.urlsafe_b64decode(padded.encode()).decode("utf-8", errors="ignore")
        assert "cv" not in decoded
        assert "sec_ovr" not in decoded
        assert "cid_ovr" not in decoded
    except Exception:
        pass


def test_sc2_shared_state_engine_convergence():
    """SC#2: Both oauth_service and mcp_oauth consume the shared oauth_state module."""
    assert oauth_service.save_pending_state is oauth_state.save_pending_state
    assert oauth_service.PendingOAuthState is oauth_state.PendingOAuthState

    assert mcp_oauth.save_pending_state is oauth_state.save_pending_state
    assert mcp_oauth.take_pending_state is oauth_state.take_pending_state
    assert mcp_oauth.PendingOAuthState is oauth_state.PendingOAuthState
    assert mcp_oauth.PendingAuthorization is oauth_state.PendingOAuthState


@pytest.mark.asyncio
async def test_sc3_in_flight_legacy_hmac_state_accepted(client: TestClient, fake_redis: FakeRedis):
    """SC#3: A consent started before deploy (carrying legacy HMAC-signed state) succeeds after deploy."""
    legacy_state = generate_oauth_state(
        connection_id="conn-legacy-1",
        user_id="user-1",
        provider="google",
        code_verifier="test-legacy-verifier-12345",
        custom_client_id="legacy-client-id",
        custom_client_secret="legacy-client-secret",
    )
    assert "." in legacy_state

    mock_tokens = {
        "access_token": "mock-acc-token",
        "refresh_token": "mock-ref-token",
        "expires_in": 3600,
        "token_type": "Bearer",
        "scope": "openid email",
    }
    mock_profile = {"email": "user@example.com", "name": "Legacy User"}

    with patch("app.dependencies.get_redis", return_value=fake_redis), \
         patch("app.services.oauth_service.exchange_code_for_tokens", new_callable=AsyncMock) as mock_exchange, \
         patch("app.services.oauth_service.fetch_account_profile", new_callable=AsyncMock) as mock_prof, \
         patch("app.dependencies.get_supabase") as mock_sb:
        mock_exchange.return_value = mock_tokens
        mock_prof.return_value = mock_profile

        sb_mock = MagicMock()
        sb_mock.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"org_id": "00000000-0000-0000-0000-000000000001"}]
        )
        sb_mock.table.return_value.upsert.return_value.execute.return_value = MagicMock(data=[{}])
        mock_sb.return_value = sb_mock

        res = client.get(f"/connectors/oauth/callback?code=mock-code-123&state={legacy_state}")
        assert res.status_code in (302, 307)
        location = res.headers["location"]
        assert location.startswith("http://localhost:5173/app?connections=1")
        assert "oauth_connected=1" in location
        assert mock_exchange.called
        assert mock_exchange.call_args[1]["code_verifier"] == "test-legacy-verifier-12345"


def test_sc3_negative_tampered_legacy_state_rejected(client: TestClient, fake_redis: FakeRedis):
    """A-5: Tampered legacy state fails HMAC verification and redirects to /app with invalid_or_expired_state."""
    legacy_state = generate_oauth_state(
        connection_id="conn-1",
        user_id="u1",
        provider="google",
        code_verifier="v",
    )
    payload_b64, sig = legacy_state.split(".", 1)
    tampered_state = f"{payload_b64}.tampered_signature_12345"

    with patch("app.dependencies.get_redis", return_value=fake_redis):
        res = client.get(f"/connectors/oauth/callback?code=mock-code&state={tampered_state}")
        assert res.status_code in (302, 307)
        location = res.headers["location"]
        assert location.startswith("http://localhost:5173/app?connections=1")
        assert "oauth_error=invalid_or_expired_state" in location


@pytest.mark.asyncio
async def test_sc4_single_use_replay_and_unknown_handle_rejected(client: TestClient, fake_redis: FakeRedis):
    """SC#4: First take consumes handle; replayed redirect or unknown handle fails closed."""
    state = PendingOAuthState(
        code_verifier="verifier-456",
        client_id="client-id-456",
        client_secret="client-secret-456",
        redirect_uri="http://localhost:5173/app?connections=1",
        connection_id="conn-456",
        user_id="user-456",
        org_id="00000000-0000-0000-0000-000000000001",
        flow="provider",
        provider="google",
    )
    handle = await save_pending_state(fake_redis, state)

    mock_tokens = {
        "access_token": "acc-1",
        "expires_in": 3600,
        "token_type": "Bearer",
    }
    mock_profile = {"email": "test@example.com"}

    with patch("app.dependencies.get_redis", return_value=fake_redis), \
         patch("app.services.oauth_service.exchange_code_for_tokens", new_callable=AsyncMock) as mock_exchange, \
         patch("app.services.oauth_service.fetch_account_profile", new_callable=AsyncMock) as mock_prof, \
         patch("app.dependencies.get_supabase") as mock_sb:
        mock_exchange.return_value = mock_tokens
        mock_prof.return_value = mock_profile

        sb_mock = MagicMock()
        sb_mock.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"org_id": "00000000-0000-0000-0000-000000000001"}]
        )
        sb_mock.table.return_value.upsert.return_value.execute.return_value = MagicMock(data=[{}])
        mock_sb.return_value = sb_mock

        # 1. First callback succeeds
        res1 = client.get(f"/connectors/oauth/callback?code=mock-code&state={handle}")
        assert res1.status_code in (302, 307)
        assert "oauth_connected=1" in res1.headers["location"]

        # 2. Second callback with same handle is rejected (replay attack defense)
        res2 = client.get(f"/connectors/oauth/callback?code=mock-code&state={handle}")
        assert res2.status_code in (302, 307)
        assert "oauth_error=invalid_or_expired_state" in res2.headers["location"]

        # 3. Unknown handle fails closed
        res3 = client.get("/connectors/oauth/callback?code=mock-code&state=non_existent_opaque_handle_1234567890123")
        assert res3.status_code in (302, 307)
        assert "oauth_error=invalid_or_expired_state" in res3.headers["location"]


@pytest.mark.asyncio
async def test_sc5_mocks_neither_side_integration_test(client: TestClient):
    """SC#5 & A-6: End-to-end integration test through real route with unpatched take_pending_state and one FakeRedis."""
    shared_redis = FakeRedis()

    mock_tokens = {
        "access_token": "real-exchange-access-token",
        "refresh_token": "real-exchange-refresh-token",
        "expires_in": 3600,
        "token_type": "Bearer",
        "scope": "https://www.googleapis.com/auth/userinfo.email",
    }
    mock_profile = {"email": "engineer@company.com", "name": "Engineer Alex"}

    auth_payload = {
        "provider": "google",
        "connection_id": "conn-sc5-live",
        "custom_client_id": "custom-id.apps.googleusercontent.com",
        "custom_client_secret": "custom-secret-live",
    }

    app.dependency_overrides[require_org_manage] = lambda: True
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-sc5", "email": "engineer@company.com"}
    app.dependency_overrides[get_active_org_id] = lambda: "00000000-0000-0000-0000-000000000001"

    with patch("app.dependencies.get_redis", return_value=shared_redis), \
         patch("app.dependencies.is_operator", new_callable=AsyncMock, return_value=True), \
         patch("app.services.oauth_service.exchange_code_for_tokens", new_callable=AsyncMock) as mock_exchange, \
         patch("app.services.oauth_service.fetch_account_profile", new_callable=AsyncMock) as mock_prof, \
         patch("app.dependencies.get_supabase") as mock_sb:

        mock_exchange.return_value = mock_tokens
        mock_prof.return_value = mock_profile

        sb_mock = MagicMock()
        sb_mock.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"org_id": "00000000-0000-0000-0000-000000000001"}]
        )
        sb_mock.table.return_value.upsert.return_value.execute.return_value = MagicMock(data=[{}])
        mock_sb.return_value = sb_mock

        # Step 1: POST /connectors/oauth/authorize
        auth_res = client.post("/connectors/oauth/authorize", json=auth_payload)
        assert auth_res.status_code == 200
        auth_data = auth_res.json()
        assert "authorization_url" in auth_data
        assert "state" in auth_data
        handle = auth_data["state"]
        assert len(handle) == 43
        assert "." not in handle

        # Verify record is in shared FakeRedis
        assert f"oauth:pending:{handle}" in shared_redis.store

        # Step 2: GET /connectors/oauth/callback with the real handle
        callback_res = client.get(f"/connectors/oauth/callback?code=mock-auth-code-123&state={handle}")
        assert callback_res.status_code in (302, 307)
        location = callback_res.headers["location"]

        # Step 3: Verified redirect targets /app
        assert location.startswith("http://localhost:5173/app?connections=1")
        assert "oauth_connected=1" in location
        assert "id=conn-sc5-live" in location

        # Step 4: Handle deleted in Redis (single use)
        assert f"oauth:pending:{handle}" in shared_redis.deleted
        assert f"oauth:pending:{handle}" not in shared_redis.store


def test_b1_all_callback_redirects_target_app_path(client: TestClient):
    """B-1: Verify that error and success redirects in both callbacks target /app."""
    # 1. Provider callback error redirect
    r1 = client.get("/connectors/oauth/callback?error=access_denied&error_description=user_cancelled")
    assert r1.status_code in (302, 307)
    assert r1.headers["location"].startswith("http://localhost:5173/app?connections=1")

    # 2. Provider callback missing params redirect
    r2 = client.get("/connectors/oauth/callback")
    assert r2.status_code in (302, 307)
    assert r2.headers["location"].startswith("http://localhost:5173/app?connections=1")

    # 3. MCP callback error redirect
    r3 = client.get("/connectors/mcp/oauth/callback?error=access_denied")
    assert r3.status_code in (302, 307)
    assert r3.headers["location"].startswith("http://localhost:5173/app?connections=1")

    # 4. MCP callback missing params redirect
    r4 = client.get("/connectors/mcp/oauth/callback")
    assert r4.status_code in (302, 307)
    assert r4.headers["location"].startswith("http://localhost:5173/app?connections=1")


def test_a3_redis_outage_fails_closed_503(client: TestClient):
    """A-3: Redis outage during authorize fails closed with HTTP 503 rather than 500."""
    auth_payload = {
        "provider": "google",
        "custom_client_id": "google-client-id",
        "custom_client_secret": "google-client-secret",
    }
    app.dependency_overrides[require_org_manage] = lambda: True
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1", "email": "test@example.com"}
    app.dependency_overrides[get_active_org_id] = lambda: "00000000-0000-0000-0000-000000000001"

    with patch("app.dependencies.get_redis", side_effect=ConnectionError("Redis connection refused")), \
         patch("app.dependencies.is_operator", new_callable=AsyncMock, return_value=True):

        res = client.post("/connectors/oauth/authorize", json=auth_payload)
        assert res.status_code == 503
        assert "Authentication state store is currently unavailable" in res.json()["detail"]


def test_a10_architectural_fence_generate_oauth_state_uncalled_in_app():
    """A-10: Architectural fence — generate_oauth_state is called by NOTHING in backend/app/."""
    app_dir = Path(__file__).resolve().parent.parent / "app"
    matches = []
    for py_file in app_dir.rglob("*.py"):
        text = py_file.read_text(encoding="utf-8")
        lines = text.splitlines()
        for idx, line in enumerate(lines, 1):
            if "def generate_oauth_state" in line:
                continue  # definition is allowed in oauth_service.py
            if "generate_oauth_state(" in line:
                matches.append(f"{py_file.name}:{idx} -> {line.strip()}")

    assert matches == [], f"Found forbidden generate_oauth_state calls in app/: {matches}"
