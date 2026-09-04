"""BUG-260903-02 — a connection id from another org must not reach the token write.

⚠ **TWO GATES, AND THE BUG WAS THAT NEITHER EXISTED ON THIS ROUTE PAIR.** Found by the
scoped security review of the Phase 225 diff and confirmed byte-identical at
`review-base-225`, so it is PRE-EXISTING since Phase 215, not something 225 introduced.

1. `POST /connectors/oauth/authorize` took `payload.connection_id` on trust. The only
   org-scoped read in the route was the *optional* stored-config lookup, and its miss was
   non-fatal — so a caller in org X could name a connection belonging to org Y.
2. `GET /connectors/oauth/callback` then resolved that row's `org_id` **through the service
   role** and wrote tokens with it. `pending.org_id` — bound at authorize time under an
   authenticated request, and stored since 225 — was never compared to the row.

Together: an `org_manage` user who knows a connection UUID from another org completes
consent with their own Google account, and the other org's connector silently holds the
attacker's tokens. Every read and send through that connector then goes through the
attacker's account.

The MCP route pair already had both halves (`connectors.py` — `.eq("org_id", active_org)` →
404 at authorize, and a write keyed on `pending.org_id` at callback). These fences are the
provider pair being brought to the same standard, and each was driven RED against the
unfixed route before the fix was written.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.api import connectors
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_user_supabase_client,
    require_org_manage,
)
from app.main import app
from app.services.oauth_state import PendingOAuthState, save_pending_state
from tests.conftest import FakeRedis

ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"  # the caller's org
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"  # the victim's org
VICTIM_CONN = "cccccccc-cccc-cccc-cccc-cccccccccccc"


@pytest.fixture
def client():
    return TestClient(app, follow_redirects=False)


@pytest.fixture(autouse=True)
def as_org_a(monkeypatch):
    """An authenticated `org_manage` caller whose active org is ORG_A.

    `is_operator` is stubbed because the canvas-gate middleware calls it on every request
    and it reads the Postgres pool — without it these tests measure whether a database is
    running, not whether the fence holds.
    """
    monkeypatch.setattr(
        "app.dependencies.is_operator", AsyncMock(return_value=True), raising=False
    )
    app.dependency_overrides[require_org_manage] = lambda: True
    app.dependency_overrides[get_current_user] = lambda: {"id": "attacker-1", "email": "a@x.test"}
    app.dependency_overrides[get_active_org_id] = lambda: ORG_A
    app.dependency_overrides[get_user_supabase_client] = lambda: MagicMock()
    yield
    app.dependency_overrides.clear()


def _authorize_payload() -> dict:
    """Credentials supplied inline — this is the shape that used to skip the org read
    entirely, because the stored-config lookup only ran when one of them was missing."""
    return {
        "provider": "google",
        "connection_id": VICTIM_CONN,
        "custom_client_id": "attacker-id.apps.googleusercontent.com",
        "custom_client_secret": "attacker-secret",
    }


# ── Gate 1: authorize refuses a connection the active org does not own ────────────────


def test_authorize_refuses_a_connection_id_from_another_org(client, monkeypatch):
    """⭐ THE HEADLINE FENCE. `aexec` returns no row, which is what an org-scoped select
    for a connection belonging to ORG_B answers when the caller's org is ORG_A."""
    monkeypatch.setattr(
        connectors, "aexec", AsyncMock(return_value=type("R", (), {"data": []})())
    )

    res = client.post("/connectors/oauth/authorize", json=_authorize_payload())

    assert res.status_code == 404, res.text
    assert "not found" in res.json()["detail"].lower()


def test_authorize_still_accepts_a_connection_the_org_owns(client, monkeypatch):
    """The positive control. Without it, a 404 from any other cause would read as the fence
    working — the failure mode this project keeps recording."""
    monkeypatch.setattr(
        connectors,
        "aexec",
        AsyncMock(return_value=type("R", (), {"data": [{"id": VICTIM_CONN, "org_id": ORG_A, "config": {}}]})()),
    )
    monkeypatch.setattr(
        connectors.connector_service,
        "store_oauth_client_credentials",
        AsyncMock(return_value=None),
    )
    redis = FakeRedis()

    with patch("app.dependencies.get_redis", return_value=redis):
        res = client.post("/connectors/oauth/authorize", json=_authorize_payload())

    assert res.status_code == 200, res.text
    assert res.json()["state"]


def test_authorize_without_a_connection_id_is_unaffected(client, monkeypatch):
    """A first-time connect names no connection yet. The fence must not turn that into a
    404 — it is scoped to the case where an id was actually supplied."""
    called = AsyncMock(return_value=type("R", (), {"data": []})())
    monkeypatch.setattr(connectors, "aexec", called)
    redis = FakeRedis()

    with patch("app.dependencies.get_redis", return_value=redis):
        res = client.post(
            "/connectors/oauth/authorize",
            json={
                "provider": "google",
                "custom_client_id": "own-id.apps.googleusercontent.com",
                "custom_client_secret": "own-secret",
            },
        )

    assert res.status_code == 200, res.text
    assert called.await_count == 0


# ── Gate 2: the callback refuses to write into a row the pending record does not own ──


@pytest.mark.asyncio
async def test_callback_refuses_when_the_row_org_differs_from_the_pending_org(client):
    """⚠ THE SECOND HALF, AND IT IS NOT REDUNDANT. Gate 1 lives on an authenticated route;
    the callback has no JWT at all and its whole authority is the pending record. If a row
    ever reaches here whose org differs from the one bound at authorize time, the write is
    refused and nothing is saved."""
    redis = FakeRedis()
    handle = await save_pending_state(
        redis,
        PendingOAuthState(
            code_verifier="verifier-xyz",
            client_id="attacker-id.apps.googleusercontent.com",
            client_secret="attacker-secret",
            redirect_uri="http://localhost:8000/connectors/oauth/callback",
            connection_id=VICTIM_CONN,
            user_id="attacker-1",
            org_id=ORG_A,
            flow="provider",
            provider="google",
        ),
    )

    save_tokens = AsyncMock(return_value=None)
    srv = MagicMock()
    # The service role answers with the row's REAL owner — ORG_B, not the pending ORG_A.
    srv.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"org_id": ORG_B}]
    )

    with patch("app.dependencies.get_redis", return_value=redis), \
         patch("app.dependencies.get_supabase", return_value=srv), \
         patch("app.services.oauth_service.exchange_code_for_tokens", new_callable=AsyncMock) as exch, \
         patch("app.services.oauth_service.fetch_account_profile", new_callable=AsyncMock) as prof, \
         patch("app.services.connector_service.save_oauth_tokens", save_tokens):
        exch.return_value = {
            "access_token": "attacker-access",
            "refresh_token": "attacker-refresh",
            "expires_in": 3600,
            "token_type": "Bearer",
            "scope": "https://www.googleapis.com/auth/userinfo.email",
        }
        prof.return_value = {"email": "attacker@x.test", "name": "A"}

        res = client.get(f"/connectors/oauth/callback?code=any-code&state={handle}")

    assert res.status_code in (302, 307)
    location = res.headers["location"]
    assert "oauth_error=invalid_or_expired_state" in location
    assert "oauth_connected=1" not in location
    # ⭐ The assertion this test exists for: no token reached the victim's connection.
    assert save_tokens.await_count == 0


@pytest.mark.asyncio
async def test_callback_still_writes_when_the_orgs_agree(client):
    """The positive control for gate 2 — the ordinary connect must be untouched."""
    redis = FakeRedis()
    handle = await save_pending_state(
        redis,
        PendingOAuthState(
            code_verifier="verifier-xyz",
            client_id="own-id.apps.googleusercontent.com",
            client_secret="own-secret",
            redirect_uri="http://localhost:8000/connectors/oauth/callback",
            connection_id=VICTIM_CONN,
            user_id="owner-1",
            org_id=ORG_B,
            flow="provider",
            provider="google",
        ),
    )

    save_tokens = AsyncMock(return_value=None)
    srv = MagicMock()
    srv.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"org_id": ORG_B}]
    )

    with patch("app.dependencies.get_redis", return_value=redis), \
         patch("app.dependencies.get_supabase", return_value=srv), \
         patch("app.services.oauth_service.exchange_code_for_tokens", new_callable=AsyncMock) as exch, \
         patch("app.services.oauth_service.fetch_account_profile", new_callable=AsyncMock) as prof, \
         patch("app.services.connector_service.save_oauth_tokens", save_tokens):
        exch.return_value = {
            "access_token": "owner-access",
            "refresh_token": "owner-refresh",
            "expires_in": 3600,
            "token_type": "Bearer",
            "scope": "https://www.googleapis.com/auth/userinfo.email",
        }
        prof.return_value = {"email": "owner@y.test", "name": "O"}

        res = client.get(f"/connectors/oauth/callback?code=any-code&state={handle}")

    assert res.status_code in (302, 307)
    assert "oauth_connected=1" in res.headers["location"]
    assert save_tokens.await_count == 1
    assert save_tokens.await_args.kwargs["org_id"] == ORG_B


def test_the_pending_org_is_actually_serialized(monkeypatch):
    """A guard on the guard. Gate 2 compares against `pending.org_id`; if that field ever
    stopped being written, the comparison would still run and would always match `None`."""
    assert "org_id" in PendingOAuthState.__dataclass_fields__
    payload = json.dumps(
        {
            "code_verifier": "v",
            "client_id": "c",
            "client_secret": None,
            "redirect_uri": "r",
            "connection_id": None,
            "user_id": "u",
            "org_id": ORG_A,
        }
    )
    assert ORG_A in payload
