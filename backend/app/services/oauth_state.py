"""Phase 225 — One Way to Hold a Secret Mid-Handshake (BUS-048).

Unified server-side OAuth state storage for both Google/BYO OAuth and MCP OAuth.
Replaces URL-based state encoding with an opaque random handle (32 bytes entropy).
State, code verifier, client credentials, and endpoints remain server-side in Redis.
"""

from __future__ import annotations

import json
import logging
import secrets
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

logger = logging.getLogger(__name__)

FlowType = Literal["provider", "mcp"]

PENDING_TTL_SECONDS: int = 600

_PRIMARY_KEY = "oauth:pending:{handle}"
# Transition fallback: delete after the first prod deploy has been live 24 h
_LEGACY_MCP_KEY = "mcp_oauth:pending:{handle}"


class OAuthStateError(Exception):
    """Raised when an OAuth state handle is invalid, expired, already consumed, or flow-mismatched."""


@dataclass
class PendingOAuthState:
    code_verifier: str
    client_id: str
    client_secret: str | None
    redirect_uri: str
    connection_id: str | None
    user_id: str
    org_id: str
    flow: FlowType = "provider"
    provider: str | None = None
    token_endpoint: str | None = None
    server_url: str | None = None
    created_at: float = field(default_factory=time.time)


async def save_pending_state(
    redis: Any,
    state: PendingOAuthState,
    ttl_seconds: int = PENDING_TTL_SECONDS,
) -> str:
    """Park pending authorization state in Redis under a random opaque handle.

    ⚠ `setex`, not `set` + `expire`: a crash between two commands parks a
    credential-bearing record in Redis with no expiry, forever. One command cannot
    half-succeed.
    """
    handle = secrets.token_urlsafe(32)
    key = _PRIMARY_KEY.format(handle=handle)
    payload = asdict(state)
    payload_json = json.dumps(payload)
    await redis.setex(key, ttl_seconds, payload_json)
    return handle


async def take_pending_state(
    redis: Any,
    handle: str,
    expected_flow: FlowType | None = None,
) -> PendingOAuthState:
    """Read the pending record and DELETE it in the same breath — single use.

    ⚠ THE DELETE IS THE REPLAY DEFENCE AND IT MUST NOT BECOME A LATER CLEANUP STEP. An
    authorization code is redeemable once; a handle that survives its own callback lets a
    replayed redirect re-run the exchange. Deleting BEFORE the exchange means a failed
    exchange also burns the handle, which is the safe direction: the person retries the
    whole consent rather than the attacker retrying the redemption.
    """
    # 1. Primary key lookup
    key = _PRIMARY_KEY.format(handle=handle)
    raw = await redis.get(key)
    if raw is not None:
        await redis.delete(key)
    else:
        # 2. Legacy MCP key fallback (in-flight consent survival)
        # Transition fallback: delete after the first prod deploy has been live 24 h
        legacy_key = _LEGACY_MCP_KEY.format(handle=handle)
        raw = await redis.get(legacy_key)
        if raw is not None:
            await redis.delete(legacy_key)

    if not raw:
        raise OAuthStateError(
            "This sign-in link has already been used or has expired. Start the connection again."
        )

    try:
        data = json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
    except Exception as exc:
        raise OAuthStateError(f"Corrupted pending OAuth state: {exc}") from exc

    # Backward compatibility for pre-225 records that did not serialize `flow` or `created_at`
    if "flow" not in data:
        data["flow"] = "mcp" if data.get("server_url") or data.get("token_endpoint") else "provider"
    if "created_at" not in data:
        data["created_at"] = time.time()

    state = PendingOAuthState(**data)

    # B-3: Assert expected flow if requested
    if expected_flow is not None and state.flow != expected_flow:
        raise OAuthStateError(
            f"OAuth state flow mismatch: expected {expected_flow}, got {state.flow}"
        )

    return state
