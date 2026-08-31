"""Phase 215 (OAUTH-03) — Claim-Based Atomic Token Refresh Lifecycle Engine.

Provides multi-worker safe (WORKER_COUNT=2) token refresh using atomic database leases
on connector_tokens.refresh_claimed_until, plus honest failure handling for revoked tokens.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from supabase import Client

from app.dependencies import get_supabase
from app.models.connector import OAuthProvider
from app.security.secret_cipher import decrypt_secret, encrypt_secret, get_cipher, is_encrypted
from app.services.oauth_service import (
    OAUTH_PROVIDERS,
    decrypt_token_value,
    encrypt_token_value,
    resolve_client_credentials,
)
from app.utils.db import aexec

logger = logging.getLogger(__name__)


class OAuthError(Exception):
    """Base error for OAuth operations."""
    pass


class OAuthRevokedError(OAuthError):
    """Raised when provider returns invalid_grant indicating user revoked access."""
    pass


class OAuthTokenUnavailable(OAuthError):
    """Raised when no valid OAuth token exists for a connection."""
    pass


async def refresh_oauth_token_at_provider(
    provider: OAuthProvider,
    refresh_token: str,
    client_id: str,
    client_secret: str,
) -> dict[str, Any]:
    """Execute refresh HTTP POST against provider token endpoint.

    Raises:
        OAuthRevokedError on 400/401 invalid_grant.
        OAuthError on network or other provider failures.
    """
    prov_meta = OAUTH_PROVIDERS.get(provider)
    if not prov_meta:
        raise OAuthError(f"Unsupported OAuth provider: {provider}")

    token_url = prov_meta["token_url"]
    data: dict[str, str] = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    headers = {"Accept": "application/json"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(token_url, data=data, headers=headers)
        if res.status_code in (400, 401):
            try:
                err_json = res.json()
                err_code = err_json.get("error", "")
                if "invalid_grant" in err_code or "unauthorized_client" in err_code:
                    logger.warning("Provider %s returned invalid_grant on refresh: %s", provider, err_json)
                    raise OAuthRevokedError("OAuth authorization was revoked or expired at provider")
            except OAuthRevokedError:
                raise
            except Exception:
                pass

        if not res.is_success:
            err_msg = f"Token refresh failed at {provider}: {res.status_code} {res.text}"
            logger.error(err_msg)
            raise OAuthError(err_msg)

        return res.json()


async def get_valid_oauth_token(
    connection_id: str,
    org_id: str | None = None,
    supabase: Client | None = None,
) -> str:
    """Get a valid decrypted OAuth access token, refreshing atomically if near expiry.

    Concurrency Safe (D-215-04):
        Uses an atomic lease on connector_tokens.refresh_claimed_until (30s). If multiple
        workers (WORKER_COUNT=2) attempt to refresh simultaneously, only one worker
        executes the refresh call while the other worker awaits the updated row.

    Returns:
        Decrypted plaintext access token.
    """
    client = supabase or get_supabase()

    # 1. Fetch connection details and token row
    conn_query = client.table("connector_connections").select(
        # `oauth_client_secret_ciphertext` is ungranted to `authenticated` (migration
        # 150); this query runs on the SERVICE-ROLE client, which is the only role
        # that may name it — the same arrangement `secret_ciphertext` has always had.
        "id, org_id, service_id, status, config, oauth_client_secret_ciphertext"
    ).eq("id", str(connection_id))
    if org_id:
        conn_query = conn_query.eq("org_id", str(org_id))
    conn_res = await aexec(conn_query)

    if not conn_res.data:
        raise OAuthTokenUnavailable(f"Connection {connection_id} not found")

    conn = conn_res.data[0]
    if conn.get("status") == "revoked":
        raise OAuthRevokedError("Connection is marked as revoked; operator re-authentication required")

    token_res = await aexec(
        client.table("connector_tokens")
        .select("id, access_token_ciphertext, refresh_token_ciphertext, expires_at, refresh_claimed_until")
        .eq("connection_id", str(connection_id))
    )

    if not token_res.data:
        raise OAuthTokenUnavailable(f"No OAuth tokens found for connection {connection_id}")

    token_row = token_res.data[0]
    expires_at_str = token_row.get("expires_at")
    now_utc = datetime.now(timezone.utc)

    try:
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
    except Exception:
        expires_at = now_utc

    # 2. If token is valid for > 5 minutes, return decrypted access token immediately
    if expires_at > now_utc + timedelta(minutes=5):
        raw_cipher = token_row["access_token_ciphertext"]
        return decrypt_token_value(raw_cipher)

    # 3. Token is expired or expiring within 5 minutes — attempt claim-based refresh
    refresh_token_cipher = token_row.get("refresh_token_ciphertext")
    if not refresh_token_cipher:
        logger.warning("Connection %s access token expired and has no refresh token", connection_id)
        # Return whatever access token we have as last resort if not expired
        return decrypt_token_value(token_row["access_token_ciphertext"])

    # Resolve provider and credentials
    service_id = conn.get("service_id", "")
    provider: OAuthProvider = "google" if "google" in service_id or "gmail" in service_id else ("microsoft" if "microsoft" in service_id or "onedrive" in service_id else "google")
    config = conn.get("config") or {}
    custom_cid = config.get("custom_client_id")
    # ⚠ THE SECRET IS NO LONGER IN `config`, AND IT WAS NEVER ACTUALLY THERE. Phase 215
    # declared `custom_client_secret` on the OAuth config model but nothing ever wrote it,
    # so this read returned None on every row and silent refresh (OAUTH-02) raised
    # "OAuth credentials missing" for any connection using a customer-registered app.
    # It now lives encrypted in `oauth_client_secret_ciphertext` (migration 150), out of a
    # column every org member can SELECT.
    custom_sec = conn.get("oauth_client_secret_ciphertext")
    if custom_sec:
        custom_sec = decrypt_token_value(custom_sec)
    else:
        custom_sec = None

    try:
        client_id, client_secret = resolve_client_credentials(provider, custom_cid, custom_sec)
    except Exception as exc:
        logger.error("Could not resolve OAuth credentials for connection %s: %s", connection_id, exc)
        raise OAuthError(f"OAuth credentials missing for {provider}") from exc

    # Attempt atomic lease claim in DB
    lease_until = (now_utc + timedelta(seconds=30)).isoformat()
    claim_res = await aexec(
        client.table("connector_tokens")
        .update({"refresh_claimed_until": lease_until})
        .eq("connection_id", str(connection_id))
        .filter("refresh_claimed_until", "is", "null")
    )

    lease_acquired = bool(claim_res.data)
    if not lease_acquired:
        # Check if previous lease expired
        claim_expired_res = await aexec(
            client.table("connector_tokens")
            .update({"refresh_claimed_until": lease_until})
            .eq("connection_id", str(connection_id))
            .lt("refresh_claimed_until", now_utc.isoformat())
        )
        lease_acquired = bool(claim_expired_res.data)

    if lease_acquired:
        try:
            decrypted_refresh = decrypt_token_value(refresh_token_cipher)
            refresh_data = await refresh_oauth_token_at_provider(
                provider=provider,
                refresh_token=decrypted_refresh,
                client_id=client_id,
                client_secret=client_secret,
            )

            new_access_token = refresh_data["access_token"]
            new_refresh_token = refresh_data.get("refresh_token") or decrypted_refresh
            expires_in = refresh_data.get("expires_in", 3600)
            new_expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

            enc_new_access = encrypt_token_value(new_access_token)
            enc_new_refresh = encrypt_token_value(new_refresh_token)

            # Update tokens and clear lease
            await aexec(
                client.table("connector_tokens")
                .update({
                    "access_token_ciphertext": enc_new_access,
                    "refresh_token_ciphertext": enc_new_refresh,
                    "expires_at": new_expires_at,
                    "refresh_claimed_until": None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("connection_id", str(connection_id))
            )
            logger.info("Successfully refreshed OAuth token for connection %s (%s)", connection_id, provider)
            return new_access_token

        except OAuthRevokedError as exc:
            # Mark connection as revoked in connector_connections
            await aexec(
                client.table("connector_connections")
                .update({
                    "status": "revoked",
                    "error_message": "OAuth access was revoked or expired at the provider",
                })
                .eq("id", str(connection_id))
            )
            await aexec(
                client.table("connector_tokens")
                .update({"refresh_claimed_until": None})
                .eq("connection_id", str(connection_id))
            )
            raise exc

        except Exception as exc:
            # Clear lease on unexpected error
            await aexec(
                client.table("connector_tokens")
                .update({"refresh_claimed_until": None})
                .eq("connection_id", str(connection_id))
            )
            raise exc

    else:
        # Another worker is refreshing: wait up to 5 seconds for updated token
        for _ in range(10):
            await asyncio.sleep(0.5)
            poll_res = await aexec(
                client.table("connector_tokens")
                .select("access_token_ciphertext, expires_at, refresh_claimed_until")
                .eq("connection_id", str(connection_id))
            )
            if poll_res.data:
                latest = poll_res.data[0]
                latest_exp_str = latest.get("expires_at")
                try:
                    latest_exp = datetime.fromisoformat(latest_exp_str.replace("Z", "+00:00"))
                    if latest_exp > datetime.now(timezone.utc) + timedelta(minutes=5):
                        return decrypt_token_value(latest["access_token_ciphertext"])
                except Exception:
                    pass

        # Fallback to current token if refresh didn't complete
        return decrypt_token_value(token_row["access_token_ciphertext"])


# Alias for callers
get_fresh_access_token = get_valid_oauth_token
