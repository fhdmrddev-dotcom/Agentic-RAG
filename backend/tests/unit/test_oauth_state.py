"""Unit tests for app.services.oauth_state (Phase 225, SC#1, SC#2, SC#4, B-3, A-5)."""

import json
import pytest

from app.services.oauth_state import (
    PENDING_TTL_SECONDS,
    OAuthStateError,
    PendingOAuthState,
    save_pending_state,
    take_pending_state,
)
from tests.conftest import FakeRedis


@pytest.mark.asyncio
async def test_save_and_take_pending_state(fake_oauth_redis: FakeRedis):
    """Save pending state parks record with 600s TTL; take retrieves and deletes it."""
    state = PendingOAuthState(
        code_verifier="test-verifier-abcdef1234567890",
        client_id="client-id-123",
        client_secret="client-secret-xyz",
        redirect_uri="https://app.example.com/app?connections=1",
        connection_id="conn-101",
        user_id="user-202",
        org_id="org-303",
        flow="provider",
        provider="google",
        token_endpoint="https://oauth2.googleapis.com/token",
    )

    handle = await save_pending_state(fake_oauth_redis, state)
    assert len(handle) == 43
    assert "." not in handle

    # A-5: Pin 600s TTL via ONE setex
    assert len(fake_oauth_redis.setex_calls) == 1
    key, ttl = fake_oauth_redis.setex_calls[0]
    assert key == f"oauth:pending:{handle}"
    assert ttl == 600
    assert ttl == PENDING_TTL_SECONDS

    # Take the state
    retrieved = await take_pending_state(fake_oauth_redis, handle, expected_flow="provider")
    assert retrieved.code_verifier == state.code_verifier
    assert retrieved.client_id == state.client_id
    assert retrieved.client_secret == state.client_secret
    assert retrieved.redirect_uri == state.redirect_uri
    assert retrieved.connection_id == state.connection_id
    assert retrieved.user_id == state.user_id
    assert retrieved.org_id == state.org_id
    assert retrieved.flow == "provider"
    assert retrieved.provider == "google"
    assert retrieved.token_endpoint == state.token_endpoint

    # Verify single-use delete
    assert key in fake_oauth_redis.deleted
    assert key not in fake_oauth_redis.store


@pytest.mark.asyncio
async def test_single_use_replay_fails(fake_oauth_redis: FakeRedis):
    """Second take of the same handle fails closed (SC#4 replay defense)."""
    state = PendingOAuthState(
        code_verifier="test-verifier",
        client_id="client-id",
        client_secret=None,
        redirect_uri="https://app.example.com/app?connections=1",
        connection_id="conn-1",
        user_id="user-1",
        org_id="org-1",
        flow="provider",
    )

    handle = await save_pending_state(fake_oauth_redis, state)

    # First take succeeds
    first = await take_pending_state(fake_oauth_redis, handle)
    assert first.client_id == "client-id"

    # Second take raises OAuthStateError
    with pytest.raises(OAuthStateError, match="already been used or has expired"):
        await take_pending_state(fake_oauth_redis, handle)


@pytest.mark.asyncio
async def test_expired_or_missing_handle_fails(fake_oauth_redis: FakeRedis):
    """Unknown or expired handle raises OAuthStateError."""
    with pytest.raises(OAuthStateError, match="already been used or has expired"):
        await take_pending_state(fake_oauth_redis, "non-existent-handle")


@pytest.mark.asyncio
async def test_opaque_handle_entropy_contains_no_secrets(fake_oauth_redis: FakeRedis):
    """SC#1: Handle is raw random entropy and contains zero secret material."""
    secret = "SUPER_SECRET_CLIENT_SECRET_VAL_9999"
    verifier = "VERIFIER_SECRET_RANDOM_123456789"
    state = PendingOAuthState(
        code_verifier=verifier,
        client_id="my-client-id",
        client_secret=secret,
        redirect_uri="https://app.example.com/app?connections=1",
        connection_id="conn-1",
        user_id="user-1",
        org_id="org-1",
        flow="provider",
    )

    handle = await save_pending_state(fake_oauth_redis, state)
    assert secret not in handle
    assert verifier not in handle
    assert "." not in handle
    assert "=" not in handle
    assert "{" not in handle
    assert "}" not in handle


@pytest.mark.asyncio
async def test_legacy_mcp_key_fallback(fake_oauth_redis: FakeRedis):
    """Transition fallback: in-flight MCP consents stored under mcp_oauth:pending: are found and deleted."""
    handle = "legacy-in-flight-mcp-handle-12345"
    legacy_key = f"mcp_oauth:pending:{handle}"
    legacy_payload = {
        "code_verifier": "legacy-verifier",
        "client_id": "legacy-client",
        "client_secret": "legacy-secret",
        "redirect_uri": "http://localhost:5173/app?connections=1",
        "connection_id": "conn-mcp-1",
        "user_id": "user-1",
        "org_id": "org-1",
        "server_url": "https://mcp.example.com",
        "token_endpoint": "https://mcp.example.com/token",
    }
    fake_oauth_redis.store[legacy_key] = json.dumps(legacy_payload)

    # Calling take_pending_state resolves the fallback key
    retrieved = await take_pending_state(fake_oauth_redis, handle, expected_flow="mcp")
    assert retrieved.flow == "mcp"
    assert retrieved.code_verifier == "legacy-verifier"
    assert retrieved.server_url == "https://mcp.example.com"
    assert legacy_key in fake_oauth_redis.deleted
    assert legacy_key not in fake_oauth_redis.store


@pytest.mark.asyncio
async def test_b3_flow_mismatch_provider_handle_at_mcp_taker_rejected_and_burned(fake_oauth_redis: FakeRedis):
    """B-3: A handle minted for provider flow cannot be redeemed at the MCP callback."""
    state = PendingOAuthState(
        code_verifier="v",
        client_id="cid",
        client_secret="sec",
        redirect_uri="https://app.example.com/app?connections=1",
        connection_id="conn-1",
        user_id="u1",
        org_id="o1",
        flow="provider",
        provider="google",
    )
    handle = await save_pending_state(fake_oauth_redis, state)
    key = f"oauth:pending:{handle}"

    with pytest.raises(OAuthStateError, match="OAuth state flow mismatch: expected mcp, got provider"):
        await take_pending_state(fake_oauth_redis, handle, expected_flow="mcp")

    # The handle is burned on retrieval
    assert key in fake_oauth_redis.deleted
    assert key not in fake_oauth_redis.store

    # Subsequent read confirms handle is gone
    with pytest.raises(OAuthStateError, match="already been used or has expired"):
        await take_pending_state(fake_oauth_redis, handle)


@pytest.mark.asyncio
async def test_b3_flow_mismatch_mcp_handle_at_provider_taker_rejected_and_burned(fake_oauth_redis: FakeRedis):
    """B-3: A handle minted for MCP flow cannot be redeemed at the provider callback."""
    state = PendingOAuthState(
        code_verifier="v",
        client_id="cid",
        client_secret=None,
        redirect_uri="https://app.example.com/app?connections=1",
        connection_id="conn-1",
        user_id="u1",
        org_id="o1",
        flow="mcp",
        server_url="https://mcp.example.com",
    )
    handle = await save_pending_state(fake_oauth_redis, state)
    key = f"oauth:pending:{handle}"

    with pytest.raises(OAuthStateError, match="OAuth state flow mismatch: expected provider, got mcp"):
        await take_pending_state(fake_oauth_redis, handle, expected_flow="provider")

    # The handle is burned
    assert key in fake_oauth_redis.deleted
    assert key not in fake_oauth_redis.store
