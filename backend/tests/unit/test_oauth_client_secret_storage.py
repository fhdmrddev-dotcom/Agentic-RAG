"""The customer-registered OAuth application: persisted, encrypted, and out of `config`.

⚠ **TWO DEFECTS, ONE CAUSE, AND THE OPERATOR FOUND BOTH BY TRYING TO CONNECT GOOGLE.**

1. **NOTHING PERSISTED THE APPLICATION.** They entered a client id and secret, pressed
   Connect, and were asked for them again. `configFromDraft` never wrote them, so
   `/oauth/authorize`'s read-back found `config = {"headers": {}}` and
   `resolve_client_credentials` raised. Reproduced through the live API on 2026-08-31:
   **HTTP 422, "OAuth credentials not configured for provider 'google'"** — the exact
   sentence they saw. Three duplicate `Google Workspace` rows in the table are three
   attempts. Silent refresh (OAUTH-02) read the same absent value, so it could not have
   worked either.

2. **THE PLACE IT WAS MEANT TO GO WAS PUBLIC.** `OAuthConnectionConfig` declared
   `custom_client_secret` as a field of `config`. Measured on the live database:
   ``has_column_privilege('authenticated', 'public.connector_connections', 'config',
   'SELECT')`` is **True**, while the same call for `secret_ciphertext` is **False**. So the
   design would have returned a customer's application secret to every member of the org
   through the ordinary connections list — the same class as CR-01, one column over.

Migration 150 gives it a column of its own, encrypted and ungranted. These are the fences.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services import connector_service


class _FakeQuery:
    """Records the update payload and the predicates, and answers like postgrest does."""

    def __init__(self, sink: dict):
        self.sink = sink

    def table(self, name):
        self.sink["table"] = name
        return self

    def update(self, payload):
        self.sink["update"] = payload
        return self

    def eq(self, column, value):
        self.sink.setdefault("eq", {})[column] = value
        return self


@pytest.mark.asyncio
async def test_the_secret_is_encrypted_and_the_id_is_not(monkeypatch):
    """The id travels in the authorization URL and the address bar — it is not a secret, and
    encrypting it would imply it needed protecting. The secret is the opposite."""
    sink: dict = {}
    monkeypatch.setattr(connector_service, "_client", lambda _s: _FakeQuery(sink))
    monkeypatch.setattr(connector_service, "aexec", AsyncMock(return_value=SimpleNamespace(data=[])))
    monkeypatch.setattr(
        connector_service,
        "_fetch_connection_row",
        AsyncMock(return_value={"id": "c1", "org_id": "o1", "config": {"provider": "google"}}),
    )
    monkeypatch.setattr(
        "app.services.oauth_service.encrypt_token_value", lambda v: f"enc:v1:{v}"
    )

    await connector_service.store_oauth_client_credentials(
        "c1", "o1", client_id="123.apps.googleusercontent.com", client_secret="GOCSPX-plain"
    )

    update = sink["update"]
    assert update["oauth_client_secret_ciphertext"] == "enc:v1:GOCSPX-plain"
    assert update["config"]["custom_client_id"] == "123.apps.googleusercontent.com"
    # ⭐ THE ASSERTION THIS FILE EXISTS FOR. The secret must not reach `config` in any form.
    assert "custom_client_secret" not in update["config"]
    assert "GOCSPX-plain" not in str(update["config"])


@pytest.mark.asyncio
async def test_the_write_is_org_scoped(monkeypatch):
    """D-14. An update keyed on id alone is the leak the resolver's docstring describes: it
    would let a caller in one org overwrite another org's stored application."""
    sink: dict = {}
    monkeypatch.setattr(connector_service, "_client", lambda _s: _FakeQuery(sink))
    monkeypatch.setattr(connector_service, "aexec", AsyncMock(return_value=SimpleNamespace(data=[])))
    monkeypatch.setattr(
        connector_service, "_fetch_connection_row",
        AsyncMock(return_value={"id": "c1", "org_id": "o1", "config": {}}),
    )
    monkeypatch.setattr("app.services.oauth_service.encrypt_token_value", lambda v: v)

    await connector_service.store_oauth_client_credentials(
        "c1", "o1", client_id="cid", client_secret="sec"
    )
    assert sink["eq"]["id"] == "c1"
    assert sink["eq"]["org_id"] == "o1"


@pytest.mark.asyncio
async def test_a_blank_field_never_clears_a_stored_credential(monkeypatch):
    """⚠ THE FORM CANNOT SHOW THE SECRET BACK — the column is ungranted, so every reopen
    submits an empty field. Treating that as *"clear it"* would destroy the credential the
    moment somebody opened the panel to look at it."""
    sink: dict = {}
    monkeypatch.setattr(connector_service, "_client", lambda _s: _FakeQuery(sink))
    aexec = AsyncMock(return_value=SimpleNamespace(data=[]))
    monkeypatch.setattr(connector_service, "aexec", aexec)
    monkeypatch.setattr(
        connector_service, "_fetch_connection_row",
        AsyncMock(return_value={"id": "c1", "org_id": "o1", "config": {}}),
    )

    await connector_service.store_oauth_client_credentials(
        "c1", "o1", client_id=None, client_secret=None
    )
    await connector_service.store_oauth_client_credentials(
        "c1", "o1", client_id="   ", client_secret="   "
    )
    assert aexec.await_count == 0, "a blank submission must write nothing at all"


@pytest.mark.asyncio
async def test_an_existing_plaintext_key_is_swept_on_every_write(monkeypatch):
    """The migration removes it once; this removes it whenever anybody touches the row, so
    the exposure closes without waiting for the migration to reach every environment."""
    sink: dict = {}
    monkeypatch.setattr(connector_service, "_client", lambda _s: _FakeQuery(sink))
    monkeypatch.setattr(connector_service, "aexec", AsyncMock(return_value=SimpleNamespace(data=[])))
    monkeypatch.setattr(
        connector_service, "_fetch_connection_row",
        AsyncMock(return_value={
            "id": "c1", "org_id": "o1",
            "config": {"provider": "google", "custom_client_secret": "LEAKED-PLAINTEXT"},
        }),
    )
    monkeypatch.setattr("app.services.oauth_service.encrypt_token_value", lambda v: v)

    await connector_service.store_oauth_client_credentials(
        "c1", "o1", client_id="cid", client_secret="sec"
    )
    assert "custom_client_secret" not in sink["update"]["config"]
    assert "LEAKED-PLAINTEXT" not in str(sink["update"]["config"])


@pytest.mark.asyncio
async def test_reading_back_returns_the_plaintext(monkeypatch):
    monkeypatch.setattr(
        connector_service, "_fetch_connection_row",
        AsyncMock(return_value={"oauth_client_secret_ciphertext": "enc:v1:x"}),
    )
    monkeypatch.setattr(
        "app.services.oauth_service.decrypt_token_value", lambda c: "GOCSPX-plain"
    )
    assert await connector_service.read_oauth_client_secret("c1", "o1") == "GOCSPX-plain"


@pytest.mark.asyncio
async def test_no_stored_application_is_None_and_not_an_error(monkeypatch):
    """⚠ A connection using the install-wide credentials from the environment legitimately
    has none, and `resolve_client_credentials` falls back to those — so raising here would
    break the non-BYO path that has always worked."""
    for row in ({}, {"oauth_client_secret_ciphertext": None}, {"oauth_client_secret_ciphertext": ""}, None):
        monkeypatch.setattr(
            connector_service, "_fetch_connection_row", AsyncMock(return_value=row)
        )
        assert await connector_service.read_oauth_client_secret("c1", "o1") is None


@pytest.mark.asyncio
async def test_an_undecryptable_secret_is_absent_rather_than_empty(monkeypatch):
    """A credential no configured key can read is ABSENT. Returning "" would be sent to the
    provider as a secret and refused with a message about the wrong thing."""
    monkeypatch.setattr(
        connector_service, "_fetch_connection_row",
        AsyncMock(return_value={"oauth_client_secret_ciphertext": "enc:v1:unreadable"}),
    )

    def _boom(_c):
        raise ValueError("no key")

    monkeypatch.setattr("app.services.oauth_service.decrypt_token_value", _boom)
    assert await connector_service.read_oauth_client_secret("c1", "o1") is None


def test_the_response_model_can_never_carry_the_new_column():
    """`_SELECTABLE_COLUMNS` is derived from the response model's fields, so a field added
    there would silently start projecting the ciphertext onto the user-JWT client — which is
    a `42501` at best and a leak at worst. Asserted rather than assumed, in the shape
    `test_190_connectors_api`'s T7 already uses for `secret_ciphertext`."""
    from app.models.connector import ConnectorConnectionResponse

    assert "oauth_client_secret_ciphertext" not in ConnectorConnectionResponse.model_fields
    assert "oauth_client_secret_ciphertext" not in connector_service._SELECTABLE_COLUMNS
