"""Phase 215 (OAUTH-01, OAUTH-02) — OAuth 2.0 PKCE & Authorization Code Grant Service.

Implements PKCE (S256) authorization URLs, cryptographically signed state nonces,
token exchange, account profile extraction, and encrypted token storage (enc:v1:).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.models.connector import OAuthProvider
from app.security.secret_cipher import decrypt_secret, encrypt_secret, get_cipher, is_encrypted

logger = logging.getLogger(__name__)

# ── Provider Metadata & Endpoints ───────────────────────────────────────────────
OAUTH_PROVIDERS: dict[OAuthProvider, dict[str, Any]] = {
    "google": {
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v2/userinfo",
        "default_scopes": [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/drive.readonly",
            # WARNING: added 2026-08-31 - ONE CONNECTION, NOT TWO (BUS-037 section B).
            # Gmail hangs off the SAME Google row and the SAME token; a second
            # `connector_connections` row would have meant a second consent and two
            # places to revoke.
            #
            # WARNING: an EXISTING connection does not widen itself. A token carries the
            # scopes granted at consent time, so a row authorised before this line was
            # added answers 403 `ACCESS_TOKEN_SCOPE_INSUFFICIENT` on any mail read until
            # it is reconnected once. `gmail_read._get` turns that into a sentence that
            # says exactly that, rather than a bare HTTP 403.
            #
            # STOP: `.readonly`, never `.modify` or `.send`. The tools built on it read
            # and cannot write; a wider scope here would grant more than any code can
            # use, which is precisely the grant nobody can audit later.
            "https://www.googleapis.com/auth/gmail.readonly",
            # Round 1 (2026-08-31, operator: "all five"). SCOPES BATCH ON ONE CONSENT
            # SCREEN, which is the whole reason these landed together: adding them one
            # surface at a time would have cost one re-consent EACH. Reads only.
            "https://www.googleapis.com/auth/spreadsheets.readonly",
            "https://www.googleapis.com/auth/documents.readonly",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/contacts.readonly",
            # ── WRITES · Phase 221 step 2 (2026-09-01, operator-chosen) ────────────────
            # ⚠ THE "STOP: `.readonly`, never `.modify` or `.send`" ABOVE IS SUPERSEDED,
            # NOT VIOLATED, AND ONLY FOR THE FOUR LINES BELOW. That instruction was the
            # reads-first decision; the operator lifted it deliberately after the approval
            # model shipped, and the standing rule it enforced still binds every scope not
            # named here. It is kept above rather than deleted, because the reasoning —
            # *a wider scope grants more than any code can use, which is the grant nobody
            # can audit later* — is exactly why this list is as narrow as it is.
            #
            # ⚠ `gmail.send` IS DELIBERATELY ABSENT. `gmail.compose` creates a DRAFT and
            # cannot deliver one. The operator chose drafts-only on a stated reason: SMTP
            # already sends mail through a path that has been approval-gated since Phase
            # 190, and a draft is the one shape of outbound mail a person still reads
            # before it leaves. Adding `.send` later is a scope change and a re-consent —
            # which is the correct cost for that decision, not an obstacle to it.
            #
            # ⚠ `drive.file`, NOT `drive`. The app sees and edits ONLY files IT created.
            # Consequence the operator confirmed: `update_file` cannot touch a document
            # they made themselves, and that refusal is the safety property, not a gap.
            # `drive.file` is also neither sensitive nor restricted, unlike `drive`.
            #
            # ⚠ NO DELETE SCOPE IS BROADER THAN A WRITE ONE HERE, so "creates and updates
            # only" is enforced by the TOOL SET rather than by the scopes: `calendar.events`
            # can delete an event and `drive.file` can trash an app-created file. Nothing
            # advertises those actions, and `_TOOL_REGISTRY` is the audit surface — the
            # standing rule is that no outbound capability exists before its approval model
            # does, and none exists for a delete.
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/documents",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/contacts",
        ],
        "supports_pkce": True,
        "access_type": "offline",
        "prompt": "consent",
    },
    "microsoft": {
        "auth_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "userinfo_url": "https://graph.microsoft.com/v1.0/me",
        "default_scopes": [
            "openid",
            "offline_access",
            "User.Read",
            "Files.Read.All",
        ],
        "supports_pkce": True,
        "prompt": "consent",
    },
    "github": {
        "auth_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "default_scopes": ["read:user", "user:email", "repo"],
        "supports_pkce": False,
    },
}


def _get_signing_key() -> bytes:
    """Get secret key used for HMAC signing of OAuth state."""
    raw = (getattr(settings, "jwt_secret", "") or getattr(settings, "secrets_encryption_key", "") or "default-oauth-state-secret").strip()
    return raw.split(",")[0].encode()


def generate_pkce_pair() -> tuple[str, str]:
    """Generate PKCE code_verifier and code_challenge (S256).

    Returns:
        tuple of (code_verifier, code_challenge)
    """
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge


def generate_oauth_state(
    connection_id: str | None,
    user_id: str,
    provider: OAuthProvider,
    code_verifier: str,
    custom_client_id: str | None = None,
    custom_client_secret: str | None = None,
    ttl_seconds: int = 600,
) -> str:
    """Create a tamper-proof HMAC-signed state payload containing PKCE verifier."""
    payload = {
        "cid": connection_id,
        "uid": user_id,
        "prv": provider,
        "cv": code_verifier,
        "cid_ovr": custom_client_id,
        "sec_ovr": custom_client_secret,
        "exp": int(time.time()) + ttl_seconds,
        "nonce": secrets.token_hex(8),
    }
    payload_json = json.dumps(payload, separators=(",", ":"))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")
    sig = hmac.new(_get_signing_key(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_oauth_state(state: str) -> dict[str, Any]:
    """Verify and unpack HMAC-signed state token.

    Raises:
        ValueError if state is invalid, tampered, or expired.
    """
    try:
        parts = state.split(".", 1)
        if len(parts) != 2:
            raise ValueError("Malformed state parameter")
        payload_b64, sig = parts

        expected_sig = hmac.new(_get_signing_key(), payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("State signature verification failed (tampered)")

        # Pad base64
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())

        if time.time() > payload.get("exp", 0):
            raise ValueError("OAuth state expired; please retry connection")

        return payload
    except Exception as exc:
        logger.warning(f"OAuth state verification failed: {exc}")
        raise ValueError(f"Invalid OAuth state: {exc}") from exc


def resolve_client_credentials(
    provider: OAuthProvider,
    custom_client_id: str | None = None,
    custom_client_secret: str | None = None,
) -> tuple[str, str]:
    """Resolve Client ID and Client Secret from custom override or env settings."""
    if custom_client_id and custom_client_secret:
        return custom_client_id.strip(), custom_client_secret.strip()

    if provider == "google":
        client_id = getattr(settings, "google_oauth_client_id", "") or ""
        client_secret = getattr(settings, "google_oauth_client_secret", "") or ""
    elif provider == "microsoft":
        client_id = getattr(settings, "microsoft_oauth_client_id", "") or ""
        client_secret = getattr(settings, "microsoft_oauth_client_secret", "") or ""
    elif provider == "github":
        client_id = getattr(settings, "github_oauth_client_id", "") or ""
        client_secret = getattr(settings, "github_oauth_client_secret", "") or ""
    else:
        client_id, client_secret = "", ""

    if not client_id or not client_secret:
        raise ValueError(
            f"OAuth credentials not configured for provider '{provider}'. "
            f"Please set {provider.upper()}_OAUTH_CLIENT_ID & {provider.upper()}_OAUTH_CLIENT_SECRET "
            "or enter custom application credentials in the connection form."
        )

    return client_id.strip(), client_secret.strip()


def build_authorization_url(
    provider: OAuthProvider,
    connection_id: str | None,
    user_id: str,
    redirect_uri: str,
    custom_client_id: str | None = None,
    custom_client_secret: str | None = None,
    custom_scopes: list[str] | None = None,
) -> tuple[str, str]:
    """Construct authorization URL for given provider with PKCE and state."""
    prov_meta = OAUTH_PROVIDERS.get(provider)
    if not prov_meta:
        raise ValueError(f"Unsupported OAuth provider: {provider}")

    client_id, client_secret = resolve_client_credentials(provider, custom_client_id, custom_client_secret)
    verifier, challenge = generate_pkce_pair()
    state = generate_oauth_state(
        connection_id=connection_id,
        user_id=user_id,
        provider=provider,
        code_verifier=verifier,
        custom_client_id=custom_client_id,
        custom_client_secret=custom_client_secret,
    )

    scopes = custom_scopes or prov_meta["default_scopes"]
    scope_str = " ".join(scopes)

    params: dict[str, str] = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scope_str,
        "state": state,
    }

    if prov_meta.get("supports_pkce"):
        params["code_challenge"] = challenge
        params["code_challenge_method"] = "S256"

    if "access_type" in prov_meta:
        params["access_type"] = prov_meta["access_type"]
    if "prompt" in prov_meta:
        params["prompt"] = prov_meta["prompt"]

    auth_url = f"{prov_meta['auth_url']}?{urlencode(params)}"
    return auth_url, state


async def exchange_code_for_tokens(
    provider: OAuthProvider,
    code: str,
    code_verifier: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str,
) -> dict[str, Any]:
    """Exchange authorization code for access & refresh tokens at provider endpoint."""
    prov_meta = OAUTH_PROVIDERS.get(provider)
    if not prov_meta:
        raise ValueError(f"Unsupported OAuth provider: {provider}")

    token_url = prov_meta["token_url"]
    data: dict[str, str] = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }

    if prov_meta.get("supports_pkce"):
        data["code_verifier"] = code_verifier

    headers = {"Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(token_url, data=data, headers=headers)
        if not res.is_success:
            err_text = res.text
            logger.error(f"OAuth token exchange failed for {provider}: {res.status_code} {err_text}")
            raise ValueError(f"Failed to exchange OAuth code: {err_text}")

        token_data = res.json()
        return token_data


async def fetch_account_profile(provider: OAuthProvider, access_token: str) -> dict[str, str | None]:
    """Fetch user account email and name from provider's identity endpoint."""
    prov_meta = OAUTH_PROVIDERS.get(provider)
    if not prov_meta or "userinfo_url" not in prov_meta:
        return {"email": None, "name": None}

    userinfo_url = prov_meta["userinfo_url"]
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(userinfo_url, headers=headers)
            if not res.is_success:
                logger.warning(f"Could not fetch profile for {provider}: {res.status_code}")
                return {"email": None, "name": None}

            data = res.json()
            if provider == "google":
                return {
                    "email": data.get("email"),
                    "name": data.get("name"),
                }
            elif provider == "microsoft":
                email = data.get("mail") or data.get("userPrincipalName")
                name = data.get("displayName")
                return {"email": email, "name": name}
            elif provider == "github":
                email = data.get("email")
                name = data.get("name") or data.get("login")
                return {"email": email, "name": name}
    except Exception as exc:
        logger.warning(f"Error fetching account profile from {provider}: {exc}")

    return {"email": None, "name": None}


def encrypt_token_value(token: str) -> str:
    """Encrypt a token value under the primary cipher key."""
    cipher = get_cipher()
    if cipher is None:
        return token  # Fail-open plaintext if no encryption key is configured
    return encrypt_secret(token, cipher)


def decrypt_token_value(ciphertext: str) -> str:
    """Decrypt a token ciphertext."""
    if not is_encrypted(ciphertext):
        return ciphertext
    cipher = get_cipher()
    if cipher is None:
        return ciphertext
    return decrypt_secret(ciphertext, cipher)
